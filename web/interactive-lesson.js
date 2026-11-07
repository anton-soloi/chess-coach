// Același ecran pentru orice capitol din meniul din stânga.
// Profesorul editează definiția, cerința, FEN-ul și soluția.
// Copilul vede textul și joacă pe tablă.

import { Chess } from './vendor/chess.js'
import { formatSolution, solutionMoves } from './notation.js'
import { lessonRecord, procedureLesson } from './curriculum.js'
import { describeTurnChapter } from './turn.js'
import { describeDamaChapter } from './dama.js'
import { tx } from './i18n.js'

const OVERRIDE_KEY = 'chesscoach.lesson.overrides'
const PRACTICE_KEY = 'chesscoach.practice.exercises'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const text = (ro, en, fr) => ({ ro, en, fr })

const GRID_ITEMS = {
  columns: {
    id: 'grid-columns',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Câte coloane sunt pe tabla de șah?',
      'How many files are there on the chessboard?',
      'Combien de colonnes compte l’échiquier ?',
    ),
    choices: [
      { id: '8', label: '8', correct: true },
      { id: '16', label: '16' },
      { id: '26', label: '26' },
    ],
    correct: ['8'],
    ok: text(
      'Tabla de șah are 8 coloane, de la a la h.',
      'The chessboard has 8 files, from a to h.',
      'L’échiquier a 8 colonnes, de a à h.',
    ),
    bad: text(
      'Nu. Tabla de șah are 8 coloane.',
      'No. The chessboard has 8 files.',
      'Non. L’échiquier a 8 colonnes.',
    ),
  },
  queen: {
    id: 'grid-queen-center',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Care sunt câmpurile de pe flancul damei care fac parte din centrul mic?',
      'Which squares on the queen’s side belong to the small centre?',
      'Quelles cases de l’aile dame font partie du petit centre ?',
    ),
    choices: [
      { id: 'e4e5', label: text('e4 și e5', 'e4 and e5', 'e4 et e5') },
      { id: 'd5e5', label: text('d5 și e5', 'd5 and e5', 'd5 et e5') },
      { id: 'd4e4', label: text('d4 și e4', 'd4 and e4', 'd4 et e4') },
      { id: 'd4d5', label: text('d4 și d5', 'd4 and d5', 'd4 et d5'), correct: true },
    ],
    correct: ['d4d5'],
    ok: text(
      'Centrul mic este d4, d5, e4 și e5. Pe flancul damei, din centrul mic, sunt d4 și d5.',
      'The small centre is d4, d5, e4 and e5. On the queen’s side, that is d4 and d5.',
      'Le petit centre est d4, d5, e4 et e5. Sur l’aile dame, ce sont d4 et d5.',
    ),
    bad: text(
      'Flancul damei cuprinde coloanele a–d. Din centrul mic fac parte d4 și d5.',
      'The queen’s side is the a–d files. From the small centre, that is d4 and d5.',
      'L’aile dame couvre les colonnes a–d. Du petit centre, ce sont d4 et d5.',
    ),
  },
  diagonals: {
    id: 'grid-diagonals',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Câte diagonale are tabla de șah?',
      'How many diagonals does the chessboard have?',
      'Combien de diagonales compte l’échiquier ?',
    ),
    choices: [
      { id: '26', label: '26', correct: true },
      { id: '2', label: '2' },
      { id: '6', label: '6' },
    ],
    correct: ['26'],
    ok: text(
      'Tabla de șah are 26 de diagonale.',
      'The chessboard has 26 diagonals.',
      'L’échiquier a 26 diagonales.',
    ),
    bad: text(
      'Nu sunt doar cele două diagonale mari. Tabla are 26 de diagonale.',
      'There are more than the two long diagonals. The board has 26 diagonals.',
      'Il n’y a pas seulement les deux grandes diagonales. L’échiquier en a 26.',
    ),
  },
  short: {
    id: 'grid-short-white',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Care sunt câmpurile care formează cele mai scurte diagonale albe?',
      'Which squares form the shortest white diagonals?',
      'Quelles cases forment les plus courtes diagonales blanches ?',
    ),
    choices: [
      { id: 'a7b8', label: 'a7 - b8', correct: true },
      { id: 'a1b2', label: 'a1 - b2', correct: true },
    ],
    correct: ['a7b8', 'a1b2'],
    ok: text(
      'Cele mai scurte diagonale albe din colțuri sunt a7-b8 și a1-b2.',
      'The shortest white diagonals in the corners are a7-b8 and a1-b2.',
      'Les plus courtes diagonales blanches dans les coins sont a7-b8 et a1-b2.',
    ),
    bad: text(
      'Bifează ambele diagonale din colțuri: a7-b8 și a1-b2.',
      'Tick both corner diagonals: a7-b8 and a1-b2.',
      'Coche les deux diagonales des coins : a7-b8 et a1-b2.',
    ),
  },
  shortFisiere: {
    id: 'grid-short-fisiere',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Care sunt câmpurile care formează cele mai scurte diagonale albe?',
      'Which squares form the shortest white diagonals?',
      'Quelles cases forment les plus courtes diagonales blanches ?',
    ),
    choices: [
      { id: 'a7b8', label: 'a7 - b8' },
      { id: 'b1a2', label: 'b1 - a2', correct: true },
      { id: 'f1h3', label: 'f1 - h3' },
    ],
    correct: ['b1a2'],
    ok: text(
      'Răspunsul corect este b1 - a2.',
      'The correct answer is b1 - a2.',
      'La bonne réponse est b1 - a2.',
    ),
    bad: text(
      'Bifează doar b1 - a2.',
      'Tick only b1 - a2.',
      'Coche seulement b1 - a2.',
    ),
  },
  shortOrient: {
    id: 'grid-short-orientare',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Care dintre variante reprezintă cea mai scurtă diagonală formată din câmpuri negre?',
      'Which option is the shortest diagonal made of dark squares?',
      'Quelle variante représente la plus courte diagonale formée de cases noires ?',
    ),
    choices: [
      { id: 'a7b8', label: 'a7-b8', correct: true },
      { id: 'g1a7', label: 'g1-a7' },
      { id: 'f8h6', label: 'f8-h6' },
    ],
    correct: ['a7b8'],
    ok: text(
      'Răspunsul corect este a7-b8.',
      'The correct answer is a7-b8.',
      'La bonne réponse est a7-b8.',
    ),
    bad: text(
      'Bifează doar a7-b8.',
      'Tick only a7-b8.',
      'Coche seulement a7-b8.',
    ),
  },
  ranks: {
    id: 'grid-ranks',
    type: 'grid',
    accept: 'exact',
    title: text(
      'Câte linii sunt pe tabla de șah?',
      'How many ranks are there on the chessboard?',
      'Combien de rangées compte l’échiquier ?',
    ),
    choices: [
      { id: '8', label: '8', correct: true },
      { id: '6', label: '6' },
      { id: '64', label: '64' },
    ],
    correct: ['8'],
    ok: text(
      'Tabla de șah are 8 linii, de la 1 la 8.',
      'The chessboard has 8 ranks, from 1 to 8.',
      'L’échiquier a 8 rangées, de 1 à 8.',
    ),
    bad: text(
      'Nu. Tabla de șah are 8 linii.',
      'No. The chessboard has 8 ranks.',
      'Non. L’échiquier a 8 rangées.',
    ),
  },
}

const GRID_BY_THEME = {
  orientare: ['columns', 'queen', 'diagonals', 'shortOrient', 'ranks'],
  fisiere: ['columns', 'diagonals', 'shortFisiere', 'ranks'],
  linii: ['diagonals', 'short', 'ranks'],
}

const GRID_SEEDED_BEFORE_RANKS = {
  orientare: ['columns', 'queen', 'diagonals', 'short'],
  fisiere: ['columns', 'diagonals', 'short'],
  linii: ['diagonals', 'short'],
}

export function resolveInteractiveLesson(id, catalogs, fallback = {}) {
  const procedure = procedureLesson(id)
  if (procedure) return { ...procedure, id }
  const base = fromData(lessonRecord(id))
    || describeTurnChapter(id)
    || describeDamaChapter(id)
    || fromCatalog(id, catalogs?.[id])
    || fromFallback(id, fallback)
  return applyOverride(id, base)
}

export function listPracticeExercises(themeId) {
  ensureBoardGrids()
  const list = readPractice()[themeId]
  if (!Array.isArray(list)) return []
  return list.map((item) => {
    if (item?.type === 'grid') {
      const choices = Array.isArray(item.choices) ? item.choices : []
      return {
        id: String(item.id || ''),
        type: 'grid',
        accept: item.accept === 'any' ? 'any' : 'exact',
        title: item.title,
        choices: choices.map((choice, index) => ({
          id: String(choice?.id || index),
          label: choice?.label || '',
        })).filter((choice) => choice.id && tx(choice.label)),
        correct: Array.isArray(item.correct) ? item.correct.map(String) : [],
        ok: item.ok || '',
        bad: item.bad || '',
      }
    }
    return {
      id: String(item?.id || ''),
      title: item?.title,
      fen: String(item?.fen || '').trim(),
      solutie: storedSolution(item?.fen, item?.solutie),
      bad: item?.bad || '',
    }
  }).filter((item) => {
    if (!item.id || !tx(item.title)) return false
    if (item.type === 'grid') return item.choices.length > 0 && item.correct.length > 0
    return Boolean(item.fen)
  })
}

function canonicalShortWhite(item) {
  if (item?.id !== 'grid-short-white') return item
  const ids = (Array.isArray(item.choices) ? item.choices : []).map((choice) => choice?.id).join(',')
  if (item.accept === 'exact' && ids === 'a7b8,a1b2' && (item.correct || []).join(',') === 'a7b8,a1b2') return item
  return JSON.parse(JSON.stringify(GRID_ITEMS.short))
}

function orientareShortList(list) {
  const source = JSON.parse(JSON.stringify(GRID_ITEMS.shortOrient))
  const expectedIds = source.choices.map((choice) => choice.id).join(',')
  let placed = false
  let changed = false
  const next = []
  for (const item of list) {
    if (item?.id !== 'grid-short-white' && item?.id !== source.id) {
      next.push(item)
      continue
    }
    if (placed) {
      changed = true
      continue
    }
    const ids = (Array.isArray(item.choices) ? item.choices : []).map((choice) => choice?.id).join(',')
    const ready = item.id === source.id
      && item.accept === 'exact'
      && ids === expectedIds
      && (item.correct || []).join(',') === source.correct.join(',')
      && item.title?.ro === source.title.ro
    next.push(ready ? item : source)
    if (!ready) changed = true
    placed = true
  }
  return changed ? next : list
}

function fisiereShortList(list) {
  const source = JSON.parse(JSON.stringify(GRID_ITEMS.shortFisiere))
  const expectedIds = source.choices.map((choice) => choice.id).join(',')
  let placed = false
  let changed = false
  const next = []
  for (const item of list) {
    if (item?.id !== 'grid-short-white' && item?.id !== source.id) {
      next.push(item)
      continue
    }
    if (placed) {
      changed = true
      continue
    }
    const ids = (Array.isArray(item.choices) ? item.choices : []).map((choice) => choice?.id).join(',')
    const ready = item.id === source.id
      && item.accept === 'exact'
      && ids === expectedIds
      && (item.correct || []).join(',') === source.correct.join(',')
    next.push(ready ? item : source)
    if (!ready) changed = true
    placed = true
  }
  return changed ? next : list
}

function seededGridKeys(value, themeId) {
  if (Array.isArray(value)) return new Set(value)
  if (value === true) return new Set(GRID_SEEDED_BEFORE_RANKS[themeId] || [])
  return new Set()
}

function ensureBoardGrids() {
  const all = readPractice()
  const seeded = all.__gridSeed && typeof all.__gridSeed === 'object' ? { ...all.__gridSeed } : {}
  let changed = false
  for (const [themeId, keys] of Object.entries(GRID_BY_THEME)) {
    const done = seededGridKeys(seeded[themeId], themeId)
    let list = Array.isArray(all[themeId]) ? all[themeId] : []
    if (themeId === 'orientare') {
      const migrated = orientareShortList(list)
      if (migrated !== list) list = migrated
    }
    if (themeId === 'fisiere') {
      const migrated = fisiereShortList(list)
      if (migrated !== list) list = migrated
    }
    const ids = new Set(list.map((item) => item?.id))
    let themeChanged = !Array.isArray(seeded[themeId]) || list !== (Array.isArray(all[themeId]) ? all[themeId] : [])
    for (const key of keys) {
      if (done.has(key)) continue
      const item = GRID_ITEMS[key]
      if (item && !ids.has(item.id)) {
        list.push(JSON.parse(JSON.stringify(item)))
        ids.add(item.id)
        themeChanged = true
      }
      done.add(key)
      themeChanged = true
    }
    const refreshed = list.map(canonicalShortWhite)
    if (refreshed.some((item, index) => item !== list[index])) themeChanged = true
    if (!themeChanged) continue
    all[themeId] = refreshed
    seeded[themeId] = [...done]
    changed = true
  }
  if (!changed) return
  all.__gridSeed = seeded
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(all))
}

export function savePracticeExercise(themeId, draft) {
  const all = readPractice()
  const list = Array.isArray(all[themeId]) ? all[themeId] : []
  const fen = String(draft.fen || '').trim()
  const item = {
    id: draft.id || `px-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(draft.title || '').trim(),
    fen,
    solutie: storedSolution(fen, draft.solutie),
    bad: String(draft.bad || '').trim(),
  }
  const index = list.findIndex((entry) => entry.id === item.id)
  if (index >= 0) list[index] = item
  else list.push(item)
  all[themeId] = list
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(all))
  return item
}

export function deletePracticeExercise(themeId, id) {
  const all = readPractice()
  all[themeId] = (Array.isArray(all[themeId]) ? all[themeId] : []).filter((entry) => entry.id !== id)
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(all))
}

export function saveLessonOverride(id, draft, language) {
  const all = readOverrides()
  const prev = all[id] || {}
  all[id] = {
    ...prev,
    fen: String(draft.fen || '').trim(),
    solutie: storedSolution(draft.fen, draft.solutie),
    definition: writeLocalized(prev.definition, draft.definition, language),
    prompt: writeLocalized(prev.prompt, draft.prompt, language),
    bad: writeLocalized(prev.bad, draft.bad, language),
  }
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(all))
}

function storedSolution(fen, value) {
  const typed = formatSolution(value)
  if (!typed) return ''
  const line = solutionMoves(fen, typed)
  return line.length ? line : typed
}

function fromData(lesson) {
  if (!lesson || lesson.procedure || lesson.engine) return null
  if (!lesson.fen && !lesson.pgn) return null
  const exercise = lesson.exercise || {}
  const picked = choiceList(exercise)
  return {
    id: lesson.id,
    code: lesson.code || lesson.id,
    title: lesson.title,
    definition: lesson.concept || lesson.goldenRule || exercise.explanation || '',
    method: lesson.goldenRule && lesson.concept ? lesson.goldenRule : '',
    prompt: exercise.prompt || exercise.question || lesson.concept || '',
    fen: fenOf(lesson),
    solutie: lineValue(exercise),
    bad: exercise.miss || '',
    ok: lesson.goldenRule || '',
    examples: lesson.examples || [],
    choices: picked.choices,
    answer: picked.answer,
  }
}

function fromCatalog(id, item) {
  if (!item) return null
  const line = item.solutie || item.correctMove || item.moves || ''
  return {
    id,
    code: item.code || id,
    title: item.label || item.title || id,
    definition: item.text || item.prompt || '',
    method: item.method || '',
    prompt: item.prompt || '',
    fen: item.fen || '',
    solutie: Array.isArray(line) ? line.join(' ') : line,
    bad: item.bad || '',
    ok: item.ok || '',
    examples: item.examples || [],
    accept: item.accept,
    choices: item.choices,
    answer: item.answer,
    mark: item.mark,
  }
}

function fromFallback(id, fallback) {
  return {
    id,
    code: fallback.code || id,
    title: fallback.title || id,
    definition: fallback.definition || fallback.prompt || '',
    method: fallback.method || '',
    prompt: fallback.prompt || '',
    fen: fallback.fen || START_FEN,
    solutie: fallback.solutie || '',
    bad: fallback.bad || '',
    ok: fallback.ok || '',
    examples: fallback.examples || [],
    accept: fallback.accept,
    choices: fallback.choices,
    answer: fallback.answer,
    mark: fallback.mark,
  }
}

function lineValue(exercise) {
  if (exercise.solutie) return exercise.solutie
  if (exercise.solution) return exercise.solution
  if (exercise.correctMove) return exercise.correctMove
  if (Array.isArray(exercise.moves)) return exercise.moves.join(' ')
  return ''
}

function choiceList(exercise) {
  const list = Array.isArray(exercise.choices) ? exercise.choices : []
  if (!list.length) return { choices: null, answer: '' }
  const choices = list.map((choice, index) => ({
    id: choice.id || `c${index}`,
    label: tx(choice.label),
  }))
  const marked = list.findIndex((choice) => choice.correct)
  const answer = exercise.answer || (marked >= 0 ? choices[marked].id : '')
  return { choices, answer }
}

function fenOf(lesson) {
  if (lesson.fen) return lesson.fen
  try {
    const chess = new Chess()
    chess.loadPgn(lesson.pgn)
    const moves = chess.history()
    const ply = lesson.exercise?.ply
    if (ply == null) return chess.fen()
    const board = new Chess()
    for (let i = 0; i < ply && i < moves.length; i += 1) board.move(moves[i])
    return board.fen()
  } catch {
    return ''
  }
}

function applyOverride(id, lesson) {
  const saved = readOverrides()[id]
  if (!saved) return lesson
  return {
    ...lesson,
    fen: saved.fen ?? lesson.fen,
    solutie: saved.solutie ?? lesson.solutie,
    definition: saved.definition ?? lesson.definition,
    prompt: saved.prompt ?? lesson.prompt,
    bad: saved.bad ?? lesson.bad,
  }
}

function readPractice() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRACTICE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalized(current, value, language) {
  const text = String(value ?? '')
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    return { ...current, [language]: text }
  }
  if (!current || current === text) return text
  return { [language]: text }
}
