// Etapa 3. Forma cronologiei unui pas: audioUrl, textul rostit și reperele.

const STATES = new Set(['idle', 'talking', 'pointing', 'thinking'])
const ACTIONS = new Set(['highlight', 'draw_arrow', 'move_piece'])

export function narrativeOf(step) {
  const source = step && typeof step === 'object' ? step : {}
  const timeline = Array.isArray(source.timeline) ? source.timeline.map(normalizeCue).filter(Boolean) : []
  timeline.sort((a, b) => a.time - b.time)
  return {
    audioUrl: typeof source.audioUrl === 'string' ? source.audioUrl : '',
    scriptText: typeof source.scriptText === 'string' ? source.scriptText : '',
    timeline,
  }
}

function normalizeCue(cue) {
  if (!cue || typeof cue !== 'object') return null
  const time = Number(cue.time)
  if (!Number.isFinite(time) || time < 0) return null
  const next = { time }
  if (STATES.has(cue.avatarState)) next.avatarState = cue.avatarState
  if (ACTIONS.has(cue.action)) next.action = cue.action
  if (cue.target) next.target = String(cue.target)
  if (cue.from) next.from = String(cue.from)
  if (cue.to) next.to = String(cue.to)
  return next
}
