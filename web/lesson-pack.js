// Lecția completă, în forma salvată pe server și descărcată ca fișier.

import { Chess } from './vendor/chess.js'
import { playTypedMove, solutionMoves } from './notation.js'

const STEP_TITLES = [
  'Prezentare / Introducere',
  'Explicații / Demonstrator',
  'Antrenament',
  'Evaluare / Test',
]

export function lessonFromSections({ lessonId, title, author, created_at, sections }) {
  const learn = sections?.learn || {}
  const example = (sections?.examples || [])[0] || {}
  const practice = (sections?.practice?.exercises || [])[0] || {}
  const test = (sections?.evaluation?.tests || [])[0] || {}
  const today = new Date().toISOString().slice(0, 10)
  return {
    lessonId,
    title: plain(title) || lessonId,
    author: author || '',
    created_at: created_at || today,
    steps: [
      stepIntro(learn),
      stepDemo(example),
      stepPractice(practice),
      stepTest(test),
    ],
  }
}

export function sectionsFromLesson(lesson, existing = {}) {
  const intro = takeStep(lesson, 1)
  const demo = takeStep(lesson, 2)
  const practice = takeStep(lesson, 3)
  const test = takeStep(lesson, 4)
  const previous = existing || {}
  const learn = { ...(previous.learn || {}) }
  if (intro) {
    learn.lessonId = lesson.lessonId
    if (intro.fen) learn.diagram_fen = intro.fen
    const explanation = localize(intro.description)
    if (explanation) learn.explanation = explanation
    learn.annotations = importAnnotations(intro.annotations)
    Object.assign(learn, importNarrative(intro), importPractice(intro))
    learn.rules = learn.rules || ['oneIdea', 'opponent', 'observe']
    learn.how_i_think = learn.how_i_think || ['checks', 'threat', 'candidates', 'after']
  }
  const examples = Array.isArray(previous.examples) ? previous.examples.slice() : []
  if (demo) examples[0] = demoItem(demo, examples[0])
  const exercises = Array.isArray(previous.practice?.exercises) ? previous.practice.exercises.slice() : []
  if (practice) exercises[0] = practiceItem(practice, exercises[0])
  const tests = Array.isArray(previous.evaluation?.tests) ? previous.evaluation.tests.slice() : []
  if (test) tests[0] = testItem(test, tests[0])
  return {
    ...previous,
    learn,
    examples,
    practice: { ...(previous.practice || { max_attempts: 3 }), exercises },
    self_reflection: previous.self_reflection || { questions: ['noticed', 'idea', 'threat', 'why', 'after'] },
    evaluation: { ...(previous.evaluation || { pass_score: 1 }), tests },
    remediation: previous.remediation || { trigger_under_score: 1, reserve: [], exercises: [] },
  }
}

function stepIntro(learn) {
  return {
    stepNumber: 1,
    title: STEP_TITLES[0],
    fen: learn.diagram_fen || learn.fen || '',
    description: plain(learn.explanation) || plain(learn.what_to_observe),
    annotations: exportAnnotations(learn.annotations),
    ...exportNarrative(learn),
    ...exportPractice(learn),
  }
}

function stepDemo(item) {
  const fen = item.fen || ''
  const uci = lineOf(item.solutie, item.moves)
  const moves = sanList(fen, item.moves, uci)
  return {
    stepNumber: 2,
    title: plain(item.title) || STEP_TITLES[1],
    fen,
    description: plain(item.explanation) || plain(item.what_to_observe),
    moves,
    annotations: exportAnnotations(item.annotations),
    ...exportNarrative(item),
    ...exportPractice(item),
  }
}

function stepPractice(item) {
  const fen = item.fen || ''
  const uci = lineOf(item.solutie, item.moves)
  const solution = sanList(fen, item.solutionMoves, uci)
  return {
    stepNumber: 3,
    title: plain(item.title) || STEP_TITLES[2],
    fen,
    description: plain(item.hint) || plain(item.explanation),
    solutionMoves: solution,
    solutie: uci.length ? uci : uciFrom(fen, solution),
    ...exportNarrative(item),
    ...exportPractice(item),
  }
}

function stepTest(item) {
  const fen = item.fen || ''
  const uci = lineOf(item.solutie, item.moves)
  const solution = sanList(fen, item.testSolutionMoves, uci)
  const attempts = Number(item.maxAttempts) || 3
  const seconds = Number(item.timeLimitSec ?? item.timeLimitSeconds) || 0
  const weight = Number(item.scoreWeight ?? item.weight) || 1
  return {
    stepNumber: 4,
    title: plain(item.title) || STEP_TITLES[3],
    fen,
    description: plain(item.explanation) || plain(item.hint),
    testSolutionMoves: solution,
    solutie: uci.length ? uci : uciFrom(fen, solution),
    maxAttempts: attempts,
    timeLimitSeconds: seconds,
    weight,
    ...exportNarrative(item),
    ...exportPractice(item),
  }
}

function demoItem(step, previous = {}) {
  const moves = Array.isArray(step.moves) ? step.moves.filter(Boolean) : []
  const solutie = storedUci(step, moves)
  const graded = Array.isArray(step.solutionMoves) && step.solutionMoves.length
  return {
    ...previous,
    id: previous.id || 1,
    type: 'interactive_fen',
    demo: !graded,
    title: localize(step.title) || localize(STEP_TITLES[1]),
    explanation: localize(step.description) || previous.explanation || blank(),
    fen: step.fen || previous.fen || '',
    moves,
    solutie,
    correctMove: solutie.join(' '),
    annotations: importAnnotations(step.annotations),
    ...importNarrative(step),
    ...importPractice(step),
  }
}

function practiceItem(step, previous = {}) {
  const solutionMoves = Array.isArray(step.solutionMoves) ? step.solutionMoves.filter(Boolean) : []
  const solutie = storedUci(step, solutionMoves)
  return {
    ...previous,
    id: previous.id || 1,
    type: 'interactive_fen',
    title: localize(step.title) || localize(STEP_TITLES[2]),
    hint: localize(step.description) || previous.hint || blank(),
    fen: step.fen || previous.fen || '',
    solutionMoves,
    solutie,
    moves: solutie.slice(),
    correctMove: solutie.join(' '),
    difficulty: previous.difficulty || 'basic',
    orientation: previous.orientation || 'white',
    annotations: importAnnotations(step.annotations),
    ...importNarrative(step),
    ...importPractice(step),
  }
}

function testItem(step, previous = {}) {
  const testSolutionMoves = Array.isArray(step.testSolutionMoves) ? step.testSolutionMoves.filter(Boolean) : []
  const solutie = storedUci(step, testSolutionMoves)
  const attempts = Number(step.maxAttempts) || Number(previous.maxAttempts) || 3
  const seconds = Number(step.timeLimitSeconds ?? step.timeLimitSec ?? previous.timeLimitSec) || 0
  const weight = Number(step.weight ?? step.scoreWeight ?? previous.scoreWeight) || 1
  return {
    ...previous,
    id: previous.id || 'T1',
    type: previous.type || 'find_move',
    title: localize(step.title) || localize(STEP_TITLES[3]),
    explanation: localize(step.description) || previous.explanation || blank(),
    fen: step.fen || previous.fen || '',
    testSolutionMoves,
    solutie,
    moves: solutie.slice(),
    correctMove: solutie.join(' '),
    maxAttempts: attempts,
    timeLimitSec: seconds,
    timeLimitSeconds: seconds,
    scoreWeight: weight,
    weight,
    level: previous.level || 'basic',
    difficulty: previous.difficulty || 'basic',
    orientation: previous.orientation || 'white',
    annotations: importAnnotations(step.annotations),
    ...importNarrative(step),
    ...importPractice(step),
  }
}

function exportNarrative(source) {
  const out = {}
  if (source?.audioUrl) out.audioUrl = String(source.audioUrl)
  const script = plain(source?.scriptText)
  if (script) out.scriptText = script
  if (Array.isArray(source?.timeline) && source.timeline.length) out.timeline = source.timeline
  return out
}

function importNarrative(step) {
  const out = {}
  if (!step) return out
  if (step.audioUrl) out.audioUrl = String(step.audioUrl)
  if (step.scriptText) out.scriptText = localize(step.scriptText)
  if (Array.isArray(step.timeline)) out.timeline = step.timeline
  return out
}

function exportPractice(source) {
  if (source?.stepType !== 'practice' || !source.targetMove?.from || !source.targetMove?.to) return {}
  const hint = source.practiceHint || source.hint
  const out = {
    stepType: 'practice',
    targetMove: {
      from: String(source.targetMove.from).toLowerCase(),
      to: String(source.targetMove.to).toLowerCase(),
    },
  }
  const title = plain(source.title)
  if (title) out.title = title
  const prompt = plain(source.promptText)
  if (prompt) out.promptText = prompt
  if (hint && typeof hint === 'object' && !hint.ro && !hint.en) {
    out.hint = {
      avatarState: hint.avatarState || 'pointing',
      highlightSquare: String(hint.highlightSquare || '').toLowerCase(),
      text: plain(hint.text),
    }
  }
  if (source.feedback) {
    out.feedback = {
      correct: exportBeat(source.feedback.correct, 'idle'),
      wrong: exportBeat(source.feedback.wrong, 'thinking'),
    }
  }
  return out
}

function importPractice(step) {
  if (step?.stepType !== 'practice' || !step.targetMove?.from || !step.targetMove?.to) return {}
  return {
    stepType: 'practice',
    promptText: localize(step.promptText) || blank(),
    targetMove: {
      from: String(step.targetMove.from).toLowerCase(),
      to: String(step.targetMove.to).toLowerCase(),
    },
    practiceHint: step.hint && typeof step.hint === 'object' && !step.hint.ro ? {
      avatarState: step.hint.avatarState || 'pointing',
      highlightSquare: String(step.hint.highlightSquare || '').toLowerCase(),
      text: localize(step.hint.text) || blank(),
    } : undefined,
    feedback: {
      correct: importBeat(step.feedback?.correct, 'idle'),
      wrong: importBeat(step.feedback?.wrong, 'thinking'),
    },
  }
}

function exportBeat(source, fallback) {
  return {
    avatarState: source?.avatarState || fallback,
    audioUrl: source?.audioUrl || '',
    text: plain(source?.text),
  }
}

function importBeat(source, fallback) {
  return {
    avatarState: source?.avatarState || fallback,
    audioUrl: source?.audioUrl || '',
    text: localize(source?.text) || blank(),
  }
}

function storedUci(step, authored) {
  if (Array.isArray(step.solutie) && step.solutie.length) return step.solutie.filter(Boolean)
  return uciFrom(step.fen, authored)
}

function takeStep(lesson, number) {
  const steps = Array.isArray(lesson?.steps) ? lesson.steps : []
  return steps.find((step) => Number(step?.stepNumber) === number) || null
}

function lineOf(solutie, moves) {
  if (Array.isArray(solutie) && solutie.length) return solutie.filter(Boolean)
  if (Array.isArray(moves) && moves.every(isUci)) return moves.filter(Boolean)
  return []
}

function sanList(fen, authored, uci) {
  const tokens = Array.isArray(authored) ? authored.filter(Boolean) : []
  if (tokens.length && tokens.some((token) => !isUci(token))) return tokens
  const source = uci.length ? uci : tokens
  const san = toSan(fen, source)
  return san.length ? san : tokens
}

function uciFrom(fen, tokens) {
  if (!fen || !tokens?.length) return []
  const line = solutionMoves(fen, tokens.join(' '))
  return line.length ? line : []
}

function toSan(fen, tokens) {
  if (!fen || !tokens?.length) return []
  try {
    const chess = new Chess(fen)
    const out = []
    for (const token of tokens) {
      const played = playTypedMove(chess, token)
      if (!played) return out
      out.push(played.san)
    }
    return out
  } catch {
    return []
  }
}

function isUci(token) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(String(token || ''))
}

function exportAnnotations(notes) {
  const list = []
  for (const arrow of notes?.arrows || []) {
    if (!arrow?.start || !arrow?.end) continue
    list.push({ type: 'arrow', from: arrow.start, to: arrow.end, color: arrow.color || 'green' })
  }
  for (const mark of notes?.highlights || []) {
    if (!mark?.square) continue
    list.push({ type: 'circle', square: mark.square, color: mark.color || 'yellow' })
  }
  return list
}

function importAnnotations(value) {
  if (value && !Array.isArray(value) && (value.arrows || value.highlights)) {
    return {
      arrows: Array.isArray(value.arrows) ? value.arrows : [],
      highlights: Array.isArray(value.highlights) ? value.highlights : [],
    }
  }
  const arrows = []
  const highlights = []
  for (const mark of value || []) {
    if (mark?.type === 'arrow' && mark.from && mark.to) {
      arrows.push({ start: mark.from, end: mark.to, color: mark.color || 'red' })
    } else if (mark?.square) {
      highlights.push({
        square: mark.square,
        color: mark.color || 'yellow',
        type: mark.type === 'square' ? 'square-fill' : 'circle-ring',
      })
    }
  }
  return { arrows, highlights }
}

function plain(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return value.ro || value.en || value.fr || ''
  return String(value)
}

function localize(value) {
  if (value && typeof value === 'object') {
    const ro = value.ro || value.en || value.fr || ''
    if (!String(ro).trim() && !value.en && !value.fr) return null
    return {
      ro,
      en: value.en || ro,
      fr: value.fr || ro,
    }
  }
  const text = String(value || '').trim()
  if (!text) return null
  return { ro: text, en: text, fr: text }
}

function blank() {
  return { ro: '', en: '', fr: '' }
}
