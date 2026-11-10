import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Month-only session cost.
// The engine reports a session's cumulative cost, which can span several months for a
// long-lived chat. We want this month only, so we remember the cumulative total
// at the start of each month and show only the difference.

type MonthRecord = {
  /** "YYYY-MM" (local time) the baseline belongs to */
  month: string
  /** cumulative session cost when this month began (as first seen) */
  baseline: number
  /** last cumulative total seen, to notice the engine counting from zero again */
  lastTotal: number
}

// What is saved per chat: the month baseline plus the last turn costs (so bars survive restarts).
type ChatRecord = MonthRecord & { turns?: number[]; updatedAt?: number }

const monthKey = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * @param rec       what was stored for this session, or null the first time it is seen
 * @param total     cumulative session cost now, in dollars
 * @param now       current time, ms
 * @param startedAt when the session first launched, ms
 * @returns the record to store and this month's cost for the session
 */
function monthCost(
  rec: MonthRecord | null,
  total: number,
  now: number,
  startedAt: number,
): { rec: MonthRecord; cost: number } {
  const month = monthKey(now)
  let next: MonthRecord
  if (!rec) {
    // First sight: a session that began this month has spent all of it this month.
    // An older one: we cannot know how much was this month before now, so count from now.
    next = { month, baseline: monthKey(startedAt) === month ? 0 : total, lastTotal: total }
  } else if (total < rec.lastTotal) {
    // The engine started counting again from a lower number: everything since is new.
    next = { month, baseline: 0, lastTotal: total }
  } else if (rec.month !== month) {
    // A new month: the cost so far belongs to earlier months.
    next = { month, baseline: total, lastTotal: total }
  } else {
    next = { ...rec, lastTotal: total }
  }
  return { rec: next, cost: Math.max(0, total - next.baseline) }
}

const usd = atom({ plugin: 'usage-bar', key: 'usd' } as const, null)
const mark = atom({ plugin: 'usage-bar', key: 'mark' } as const, null)
const turns = atom({ plugin: 'usage-bar', key: 'turns' } as const, [] as number[])

// Keep in step with "version" in .claude-plugin/plugin.json (shown top right of the band).
const VERSION = '0.5.1'
const MAX_TURNS = 20
const money = (n: number) => '$' + n.toFixed(2)

// Turn the engine's cumulative total into this month's cost for the session, keeping the
// month baseline in $.store so it survives restarts and reopened chats.
// (Declared at the top level of the file: the engine only lets `$` be passed to such functions.)
async function refresh($: any, total: number) {
  try {
    const sessionId = await $.session.id()
    const startedAt = (await $.session.usage()).startedAt
    const key = `month:${sessionId}`
    const prev = ((await $.store.get(key)) ?? null) as ChatRecord | null
    const { rec, cost } = monthCost(prev, total, await $.clock.now(), startedAt)
    const merged = { ...(prev ?? {}), ...rec } as ChatRecord // keep the saved turns
    if (!prev || prev.month !== merged.month || prev.baseline !== merged.baseline || prev.lastTotal !== merged.lastTotal) {
      await $.store.set(key, { ...merged, updatedAt: await $.clock.now() })
    }
    await update($, usd, () => cost)
  } catch {}
}

// Save this chat's last turn costs next to its baseline.
async function saveTurns($: any, list: number[]) {
  try {
    const key = `month:${await $.session.id()}`
    const prev = ((await $.store.get(key)) ?? null) as ChatRecord | null
    if (!prev) return // no baseline saved yet
    const rounded = list.map(n => Math.round(n * 10000) / 10000)
    await $.store.set(key, { ...prev, turns: rounded, updatedAt: await $.clock.now() })
  } catch {}
}

// Bring the saved bars back when the chat starts (never overwrite with an empty list).
async function loadTurns($: any) {
  try {
    const rec = ((await $.store.get(`month:${await $.session.id()}`)) ?? null) as ChatRecord | null
    if (rec && rec.turns && rec.turns.length > 0) {
      const saved = rec.turns.slice(-MAX_TURNS)
      await update($, turns, () => saved)
    }
  } catch {}
}

// Drop records of chats not touched for 90 days, so the saved data cannot grow without limit.
async function prune($: any) {
  try {
    const keys = ((await $.store.keys()) as string[]).filter(k => k.startsWith('month:'))
    if (keys.length < 200) return
    const cutoff = (await $.clock.now()) - 90 * 24 * 60 * 60 * 1000
    for (const k of keys) {
      const r = (await $.store.get(k)) as ChatRecord | null
      if (r && typeof r.updatedAt === 'number' && r.updatedAt < cutoff) await $.store.delete(k)
    }
  } catch {}
}

// One thin bar per recent turn, scaled to the tallest; hovering a bar shows its cost.
function barsSvg(list: number[]) {
  const STEP = 9, W = list.length * STEP, H = 26
  const max = Math.max(...list, 0.0001)
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  list.forEach((c, i) => {
    const h = Math.max(3, (c / max) * (H - 2))
    const ago = list.length - 1 - i
    const when = ago === 0 ? 'Latest turn' : ago === 1 ? '1 turn ago' : `${ago} turns ago`
    const fill = i === list.length - 1 ? '#2563eb' : '#60a5fa'
    out += `<rect x="${i * STEP}" y="${(H - h).toFixed(1)}" width="7" height="${h.toFixed(1)}" rx="2" fill="${fill}"><title>${when}: ${money(c)}</title></rect>`
  })
  return out + '</svg>'
}

const BLOCKS = '▁▂▃▄▅▆▇█'
function barsText(list: number[]) {
  const max = Math.max(...list, 0.0001)
  return list.map(c => BLOCKS[Math.min(7, Math.floor((c / max) * 7.999))]).join('')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const u = await $.session.usage()
      await refresh($, u.cost?.usd ?? 0)
      await update($, mark, () => 0)
      const now = await read($, usd)
      await update($, mark, () => now ?? 0)
      await loadTurns($)
      await prune($)
    } catch {}
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost) await refresh($, e.cost.usd)
    return next(e)
  })

  // when a turn finishes, record what it cost (growth in this month's session cost since the last turn)
  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)   // only the main chat's turns count
    // ask the engine for the up-to-date total: the cost event can arrive after the turn ends
    try { await refresh($, (await $.session.usage()).cost?.usd ?? 0) } catch {}
    const now = (await read($, usd)) ?? 0
    const before = (await read($, mark)) ?? now
    const delta = now - before
    if (delta > 0.0001) {
      const cur = await read($, turns)
      const nextList = [...cur, delta].slice(-MAX_TURNS)
      await update($, turns, () => nextList)
      await saveTurns($, nextList)
    }
    await update($, mark, () => now)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const session = (await read($, usd)) ?? 0
    const list = await read($, turns)
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const last = list.length > 0 ? list[list.length - 1] : null
    let chart: any = null
    if (list.length > 0) {
      if (e.surface === 'terminal') chart = <Text key="chart" color="blue">{barsText(list)}</Text>
      else {
        const { Svg } = $.ui.resolve(e) as any
        if (Svg) chart = <Svg key="chart" source={barsSvg(list)} alt={`Cost of the last ${list.length} turns`} width={list.length * 9} height={26} isInteractive />
      }
    } else {
      chart = <Text key="empty" dimColor>none recorded yet</Text>
    }
    return (
      <Box flexDirection="column">
        <Box key="total" flexDirection="row" justifyContent="space-between" gap={2}>
          <Box key="total-left" flexDirection="row" gap={1}>
            <Text key="total-label" dimColor>Chat total this month</Text>
            <Text key="total-amount" weight="bold">{money(session)}</Text>
          </Box>
          <Text key="name" dimColor>{`usage-bar v${VERSION}`}</Text>
        </Box>
        <Box key="row1" flexDirection="row" flexWrap="wrap" alignItems="center" gap={1}>
          <Text key="cap" dimColor>Cost per turn</Text>
          {chart}
          <Text key="last" dimColor>{last === null ? '' : `Last turn ${money(last)}`}</Text>
        </Box>
      </Box>
    )
  })
}
