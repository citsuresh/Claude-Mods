import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Monthly figures come from the Claude app's usage card, which a mod cannot read.
// Claude (or you) writes them to this file; the session cost below is live.
//   { "spent": 34.09, "limit": 200, "currency": "USD", "updatedAt": "2026-11-08" }
// Set the `monthlyFile` option (plugin config) to the full path of your monthly.json.
// If it is empty or missing, only the session cost is shown.
const REREAD_MS = 30_000

const usd = atom({ plugin: 'usage-bar', key: 'usd' } as const, null)
const tick = atom({ plugin: 'usage-bar', key: 'tick' } as const, 0)

type Monthly = { spent: number; limit: number; currency: string; updatedAt?: string }

const money = (n: number, cur: string) => (cur === 'USD' ? '$' : cur + ' ') + n.toFixed(2)
const clamp = (n: number) => Math.max(0, Math.min(100, n))

async function loadMonthly($: any, file: string): Promise<Monthly | null> {
  try {
    const j = JSON.parse(await $.fs.read(file))
    if (typeof j.spent === 'number' && typeof j.limit === 'number' && j.limit > 0) {
      return { spent: j.spent, limit: j.limit, currency: j.currency || 'USD', updatedAt: j.updatedAt }
    }
  } catch {}
  return null
}

function svgBar(spentPct: number, sessionPct: number) {
  const W = 260
  const blue = (W * spentPct) / 100
  const red = (W * sessionPct) / 100
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="14" viewBox="0 0 ${W} 14">` +
    `<rect x="0" y="2" width="${W}" height="10" rx="5" fill="#8a8f98" fill-opacity="0.35"/>` +
    `<rect x="0" y="2" width="${blue.toFixed(1)}" height="10" rx="5" fill="#3b82f6"/>` +
    (sessionPct > 0 ? `<rect x="0" y="5" width="${Math.max(red, 3).toFixed(1)}" height="4" rx="2" fill="#ef4444"/>` : '') +
    `</svg>`
  )
}

function textBar(spentPct: number, sessionPct: number, width = 24) {
  const b = Math.round((width * spentPct) / 100)
  const r = Math.min(b, Math.round((width * sessionPct) / 100))
  return '█'.repeat(r) + '▓'.repeat(Math.max(0, b - r)) + '░'.repeat(width - Math.max(b, r))
}

export const register: Register = (on, options) => {
  const monthlyFile = String((options as any)?.monthlyFile ?? '')
  on('session.start', async ($, e, next) => {
    try {
      const u = await $.session.usage()
      await update($, usd, () => u.cost?.usd ?? null)
    } catch {}
    $.clock.every(REREAD_MS, () => update($, tick, n => n + 1))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost) await update($, usd, () => e.cost!.usd)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, tick)
    const session = (await read($, usd)) ?? 0
    const m = (monthlyFile ? await loadMonthly($, monthlyFile) : null)
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const cur = m?.currency ?? 'USD'
    const label = m
      ? `Month ${money(m.spent, cur)} / ${money(m.limit, cur)} (${Math.round((m.spent / m.limit) * 100)}%) · This session ${money(session, cur)}`
      : `This session ${money(session, cur)} · monthly figures not set`
    const spentPct = m ? clamp((m.spent / m.limit) * 100) : 0
    const sessionPct = m ? clamp((session / m.limit) * 100) : 0

    const bar =
      e.surface === 'terminal' ? (
        <Text key="bar" color="blue">{textBar(spentPct, sessionPct)} </Text>
      ) : e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile' ? (
        (() => {
          const { Svg } = $.ui.resolve(e) as any
          return <Svg key="bar" source={svgBar(spentPct, sessionPct)} alt={label} />
        })()
      ) : null

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {m ? bar : null}
        <Text key="label" dimColor>{label}{m?.updatedAt ? `  (monthly as of ${m.updatedAt})` : ''}</Text>
      </Box>
    )
  })
}
