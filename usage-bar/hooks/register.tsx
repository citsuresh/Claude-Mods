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

const money = (n: number) => '$' + n.toFixed(2)

// Turn the engine's cumulative total into this month's cost for the session, keeping the
// month baseline in $.store so it survives restarts and reopened chats.
// (Declared at the top level of the file: the engine only lets `$` be passed to such functions.)
async function refresh($: any, total: number) {
  try {
    const sessionId = await $.session.id()
    const startedAt = (await $.session.usage()).startedAt
    const key = `month:${sessionId}`
    const prev = ((await $.store.get(key)) ?? null) as MonthRecord | null
    const { rec, cost } = monthCost(prev, total, await $.clock.now(), startedAt)
    if (!prev || prev.month !== rec.month || prev.baseline !== rec.baseline || prev.lastTotal !== rec.lastTotal) {
      await $.store.set(key, rec)
    }
    await update($, usd, () => cost)
  } catch {}
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const u = await $.session.usage()
      await refresh($, u.cost?.usd ?? 0)
    } catch {}
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost) await refresh($, e.cost.usd)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const session = (await read($, usd)) ?? 0
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>Session cost this month: {money(session)}</Text>
      </Box>
    )
  })
}
