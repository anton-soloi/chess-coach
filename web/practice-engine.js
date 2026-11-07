// Exercițiul activ de după explicație: mutarea țintă, indiciul și feedback-ul.

const STATES = new Set(['idle', 'talking', 'pointing', 'thinking'])

export function practiceOf(source) {
  if (!source || source.stepType !== 'practice') return null
  const from = square(source.targetMove?.from)
  const to = square(source.targetMove?.to)
  if (!from || !to) return null
  return {
    title: source.title || '',
    promptText: source.promptText || '',
    targetMove: { from, to },
    hint: hintOf(source.practiceHint || source.hint),
    feedback: {
      correct: beatOf(source.feedback?.correct, 'idle'),
      wrong: beatOf(source.feedback?.wrong, 'thinking'),
    },
  }
}

export function matchesTarget(played, practice) {
  if (!played || !practice?.targetMove) return false
  return square(played.from) === practice.targetMove.from && square(played.to) === practice.targetMove.to
}

function beatOf(source, fallback) {
  return {
    avatarState: stateOf(source?.avatarState, fallback),
    audioUrl: typeof source?.audioUrl === 'string' ? source.audioUrl : '',
    text: source?.text || '',
  }
}

function hintOf(source) {
  if (!source || typeof source !== 'object' || source.ro || source.en || source.fr) return null
  const highlightSquare = square(source.highlightSquare)
  if (!highlightSquare && !source.text && !source.avatarState) return null
  return {
    avatarState: stateOf(source.avatarState, 'pointing'),
    highlightSquare,
    text: source.text || '',
  }
}

function stateOf(value, fallback) {
  return STATES.has(value) ? value : fallback
}

function square(value) {
  const text = String(value || '').trim().toLowerCase()
  return /^[a-h][1-8]$/.test(text) ? text : ''
}
