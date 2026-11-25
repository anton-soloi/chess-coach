// Editorul profesorului pentru diagramele celor 7 niveluri.
// Temele de curriculum stau în localStorage. Exercițiile noi din Train
// se scriu în web/curriculum/train-authored.json prin serverul local.

import { sizeDragGhost } from './board.js'
import { Chess } from './vendor/chess.js'
import { fenAlignedToMove, formatSolution, legalPosition, playTypedMove, solutionMoves } from './notation.js'
import { exportThemeBackup, getLevels, importThemeBackup, saveSubchapterSections } from './curriculum.js'
import { lessonFromSections } from './lesson-pack.js'
import { lang, t, tx } from './i18n.js'
import { closePedagogy, openPedagogy, refreshPreviewCopy } from './pedagogy.js'
import { bindBoardDraw, paintBoardNotes } from './board-notes.js'
import { loadBuilderItem, mountLessonBuilder, observeBuilderMove, observeBuilderNote, recordLegalMove, rememberBuilderLine, refreshBuilder, resetBuilderLine } from './lesson-builder.js'

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1'
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
const STEPS = { learn: 0, examples: 1, practice: 2, evaluation: 4 }

let active = false
let brush = 'hand'
let grab = null
let draft = null
let levelId = ''
let subId = ''
let sectionId = 'examples'
let itemIndex = 0
let creating = false
let editorNavLock = false
let entryOpen = false
let hooks = {}
let toastTimer = 0
let notes = emptyNotes()
let savedNotes = emptyNotes()
let notePreview = null
let recording = false
let recordFrom = ''
let lineStartFen = ''
let boundDrill = null
let sectionTemplate = null
let authoringTrain = null
let authoringBusy = false
let trainNav = false
let trainOutline = null
let trainSelectionId = ''
let trainAfterId = ''

const TRAIN_DRILL_KEY = 'chesscoach.trainDrills'

export function isTeacherEditor() {
  return active
}

export function editorSquare(square) {
  if (!active) return false
  if (recording && recordsLine()) return recordSquare(square)
  const before = currentFen()
  const from = brush === 'hand' ? grab : ''
  const map = readMap(before)
  if (brush === 'eraser') map.delete(square)
  else if (brush === 'hand') {
    if (!grab) {
      if (map.has(square)) grab = square
    } else if (grab === square) grab = null
    else {
      const piece = map.get(grab)
      map.delete(grab)
      if (piece) map.set(square, piece)
      grab = null
    }
  } else map.set(square, brush)
  const after = serialize(map, turnOf(before))
  if (from && from !== square) applyDiagramMove(from, square, before, after)
  else {
    writeFen(after)
    if (before !== after) resetBuilderLine(after)
  }
  return true
}

export function editorMove(from, to) {
  if (!active || !from || !to || from === to) return false
  if (recording && recordsLine()) return recordChessMove(from, to)
  const before = currentFen()
  const map = readMap(before)
  const piece = map.get(from)
  if (!piece) return false
  map.delete(from)
  map.set(to, piece)
  const after = serialize(map, turnOf(before))
  applyDiagramMove(from, to, before, after)
  return true
}

function applyDiagramMove(from, to, before, after) {
  if (boundDrill) return applyTrainDiagramMove(from, to, before, after)
  if (!observeBuilderMove({ from, to, before, after })) writeFen(after)
  else mirrorFen(currentFen())
  return true
}

function applyTrainDiagramMove(from, to, before, after) {
  const result = recordLegalMove(before, [], from, to)
  if (!result.ok) {
    writeFen(after)
    resetBuilderLine(after)
    hooks.status?.(t('builder.placed'))
    return true
  }
  const form = document.querySelector('#curriculum-editor')
  const field = form?.querySelector('#ed-move')
  if (field) field.value = result.sans.join(' ')
  const text = form?.querySelector('#ed-text')
  if (text && result.san && /Apasă piesa care dă matul/.test(text.value)) {
    text.value = text.value.replace(/Apasă piesa care dă matul\.?/, `Mută ${result.san}.`)
  }
  const pgnField = form?.querySelector('#ed-pgn')
  if (pgnField) pgnField.value = result.pgn || ''
  rememberBuilderLine(before, result.sans)
  writeFen(before)
  hooks.status?.(t('builder.recorded', { san: result.san }))
  return true
}

export function editorRemove(square) {
  if (!active || !square) return false
  const map = readMap(currentFen())
  if (!map.has(square)) return false
  map.delete(square)
  writeFen(serialize(map, turnOf(currentFen())))
  return true
}

function authoredMoves(typed) {
  const raw = String(typed || '').trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((move) => String(move || '').trim()).filter(Boolean)
      }
    } catch {
      // Textul rămâne o linie de mutări, nu un JSON valid.
    }
  }
  return raw
    .replace(/[\[\]"]/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^\d+\.(?:\.\.)?/, '').replace(/,$/, '').trim())
    .filter((token) => token && !/^(sau|or|oder)$/i.test(token))
}

function formatMoveList(moves) {
  return JSON.stringify(moves).replace(/","/g, '", "')
}

function displaySan(san) {
  if (lang() !== 'ro') return san
  return String(san || '').replace(/[NBRQK]/g, (letter) => ({ Q: 'D', R: 'T', B: 'N', N: 'C', K: 'R' }[letter] || letter))
}

function replayChess(fen, tokens) {
  let chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  for (const token of tokens) {
    try {
      if (!playTypedMove(chess, token)) return chess
    } catch {
      return chess
    }
  }
  return chess
}

function replayRecorded() {
  const tokens = authoredMoves(document.querySelector('#ed-move')?.value)
  const chess = replayChess(lineStartFen, tokens)
  if (chess) hooks.setFen?.(chess.fen())
  if (lineStartFen) hooks.reviewLine?.(lineStartFen, tokens)
}

function recordSquare(square) {
  const chess = replayChess(lineStartFen, authoredMoves(document.querySelector('#ed-move')?.value))
  if (!chess) return true
  if (!recordFrom) {
    const piece = chess.get(square)
    if (!piece || piece.color !== chess.turn()) return true
    recordFrom = square
    hooks.selectSquare?.(square)
    return true
  }
  if (recordFrom === square) {
    recordFrom = ''
    hooks.clearSquare?.()
    return true
  }
  const from = recordFrom
  recordFrom = ''
  hooks.clearSquare?.()
  recordChessMove(from, square)
  return true
}

function recordChessMove(from, to) {
  const field = document.querySelector('#ed-move')
  const tokens = authoredMoves(field?.value)
  const chess = replayChess(lineStartFen, tokens)
  if (!chess) return false
  const piece = chess.get(from)
  if (!piece || piece.color !== chess.turn()) {
    hooks.setFen?.(chess.fen())
    hooks.status?.(t('editor.recordIllegal'))
    return false
  }
  const promotion = piece.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined
  let played
  try {
    played = chess.move({ from, to, promotion })
  } catch {
    hooks.setFen?.(chess.fen())
    hooks.status?.(t('editor.recordIllegal'))
    return false
  }
  tokens.push(displaySan(played.san))
  if (field) field.value = formatMoveList(tokens)
  hooks.setFen?.(played.after)
  hooks.reviewLine?.(lineStartFen, tokens)
  observeBuilderMove({ from, to, before: played.before, after: played.after })
  hooks.status?.(t('editor.recordHint'))
  return true
}

function stopRecording({ resetBoard = false } = {}) {
  const was = recording || recordFrom
  recording = false
  recordFrom = ''
  hooks.clearSquare?.()
  if (was && resetBoard && lineStartFen) hooks.setFen?.(lineStartFen)
  paintRecordButton()
}

function startRecording() {
  const field = document.querySelector('#ed-fen')
  lineStartFen = field?.value.trim() || hooks.getFen?.() || ''
  if (field && lineStartFen && !field.value.trim()) field.value = lineStartFen
  recording = true
  recordFrom = ''
  replayRecorded()
  paintRecordButton()
  hooks.status?.(t('editor.recordHint'))
}

function toggleRecording() {
  if (recording) stopRecording({ resetBoard: true })
  else startRecording()
}

function recordsLine() {
  return sectionId === 'practice' || sectionId === 'evaluation'
}

function paintTestParams() {
  const box = document.querySelector('#ed-test-params')
  if (box) box.hidden = !(active && sectionId === 'evaluation')
}

function readBounded(id, fallback, min, max) {
  const value = Number(document.querySelector(id)?.value)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function writeTestFields(item) {
  const attempts = document.querySelector('#ed-attempts')
  const time = document.querySelector('#ed-time')
  const weight = document.querySelector('#ed-weight')
  if (attempts) attempts.value = String(item?.maxAttempts || 3)
  if (time) time.value = String(item?.timeLimitSec || 0)
  if (weight) weight.value = String(item?.scoreWeight || 1)
}

function paintRecordButton() {
  const row = document.querySelector('#ed-record-row')
  const button = document.querySelector('#ed-record')
  const moveLabel = document.querySelector('label[for="ed-move"] span')
  const lined = active && recordsLine()
  if (!lined && recording) {
    recording = false
    recordFrom = ''
  }
  if (row) row.hidden = !lined
  if (button) {
    button.textContent = recording ? t('editor.recordStop') : t('editor.record')
    button.setAttribute('aria-pressed', recording ? 'true' : 'false')
  }
  if (moveLabel && active) {
    moveLabel.textContent = hooks.inTrain?.()
      ? t('editor.moveOptional')
      : (sectionId === 'evaluation'
        ? t('editor.testSolution')
        : (sectionId === 'practice' ? t('editor.solution') : t('editor.move')))
  }
  syncEngineProbe()
  paintTestParams()
}

function showEngineGoal(goal, text = '') {
  const readout = document.querySelector('#ed-eval')
  if (!readout) return
  const known = goal === 'mate' || goal === 'advantage' ? goal : ''
  readout.dataset.goal = known
  if (!known && !text) {
    readout.hidden = true
    readout.textContent = ''
    return
  }
  readout.hidden = false
  readout.textContent = text || t(known === 'mate' ? 'train.coachGoalMate' : 'train.coachGoalAdvantage')
}

function syncEngineProbe() {
  const row = document.querySelector('#ed-engine')
  if (row) row.hidden = !active
  const moveLabel = document.querySelector('label[for="ed-move"] span')
  if (moveLabel && active && hooks.inTrain?.()) moveLabel.textContent = t('editor.moveOptional')
}

function analysisFen() {
  const typed = document.querySelector('#ed-fen')?.value.trim() || ''
  const board = hooks.getFen?.() || ''
  if (typed && legalPosition(typed)) return typed
  return board || typed
}

function sameEngineMove(fen, written, san) {
  if (!written || !san) return false
  try {
    const left = playTypedMove(new Chess(fen), written)
    const right = playTypedMove(new Chess(fen), san)
    return left.from === right.from && left.to === right.to && (left.promotion || '') === (right.promotion || '')
  } catch {
    return false
  }
}

async function analyzeTrainPosition() {
  const button = document.querySelector('#ed-analyze')
  const fen = analysisFen()
  if (!hooks.analyzeFen) return
  if (button) button.disabled = true
  showEngineGoal('', t('train.analyzing'))
  try {
    const verdict = await hooks.analyzeFen(fen)
    const move = document.querySelector('#ed-move')
    const written = move?.value.trim() || ''
    const san = verdict?.san || ''
    let text = verdict?.text || t('train.coachNone')
    if (written && san && !sameEngineMove(fen, written, san)) {
      text = `${text} ${t('editor.engineKeeps', { written, move: san })}`
    } else if (move && !written && san) {
      move.value = san
    }
    showEngineGoal(verdict?.goal || '', text)
  } catch (err) {
    showEngineGoal('', err instanceof Error ? err.message : t('train.coachNone'))
  } finally {
    if (button) button.disabled = false
  }
}

export function syncBoardAnnotations(whiteAtBottom = true) {
  paintBoardNotes(document.querySelector('#board-notes'), active ? notes : savedNotes, whiteAtBottom !== false, active ? notePreview : null)
}

export function showSavedAnnotations(value) {
  savedNotes = normalizeNotes(value)
  if (!active) syncBoardAnnotations(hooks.whiteAtBottom?.() !== false)
}

export function clearSavedAnnotations() {
  savedNotes = emptyNotes()
  if (!active) notePreview = null
}

export function openTeacherEditor(nextHooks) {
  hooks = nextHooks || {}
  active = true
  entryOpen = false
  releaseTrainBinding()
  document.querySelector('#curriculum-editor').hidden = false
  savedNotes = emptyNotes()
  fillPalette()
  paintEditorTools()
  fillLevels()
  loadItem()
  revealCurrentEntry()
  showDesk('edit')
  paintPositionLegality(currentFen())
  hooks.status?.(t('editor.ready'))
}

function readTrainStore() {
  try {
    const data = JSON.parse(localStorage.getItem(TRAIN_DRILL_KEY) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export function trainDrillRecord(code) {
  if (!code) return null
  const record = readTrainStore()[code]
  return record && typeof record === 'object' ? record : null
}

function rememberSectionOptions() {
  if (sectionTemplate) return
  const select = document.querySelector('#ed-section')
  if (!select) return
  sectionTemplate = [...select.options].map((option) => ({
    value: option.value,
    text: option.textContent,
    i18n: option.dataset.i18n || '',
  }))
}

function restoreSectionOptions() {
  const select = document.querySelector('#ed-section')
  if (!select || !sectionTemplate) return
  const keep = sectionTemplate.some((option) => option.value === sectionId) ? sectionId : 'examples'
  select.replaceChildren()
  for (const item of sectionTemplate) {
    const option = document.createElement('option')
    option.value = item.value
    if (item.i18n) option.dataset.i18n = item.i18n
    option.textContent = item.text
    select.append(option)
  }
  select.value = keep
}

function pinSelect(select, value, label) {
  if (!select) return
  select.replaceChildren()
  const option = document.createElement('option')
  option.value = value
  option.textContent = label || value
  select.append(option)
  select.value = value
}

function applyDrillTitle(title) {
  if (!boundDrill?.code) return
  const name = String(title || '').trim()
  boundDrill.section = name ? `${boundDrill.code} · ${name}` : (boundDrill.section || boundDrill.code)
  const section = document.querySelector('#ed-section')
  const option = [...(section?.options || [])].find((item) => item.value === boundDrill.id)
  if (option) option.textContent = boundDrill.section
  showBoundDrillList(boundDrill.section)
  hooks.renameTrainDrill?.({
    id: boundDrill.id,
    code: boundDrill.code,
    title: name,
    section: boundDrill.section,
  })
}

function showBoundDrillList(label) {
  const select = document.querySelector('#ed-item')
  const list = document.querySelector('#ed-list')
  const head = document.querySelector('.editor-list-head')
  if (head) head.hidden = false
  if (select) {
    select.replaceChildren()
    const option = document.createElement('option')
    option.value = '0'
    option.textContent = label
    select.append(option)
    select.value = '0'
  }
  if (!list) return
  list.hidden = false
  list.replaceChildren()
  const row = document.createElement('li')
  row.className = 'editor-row active'
  const name = document.createElement('span')
  name.className = 'editor-name'
  name.textContent = label
  row.append(name)
  list.append(row)
}

function releaseTrainBinding() {
  if (!boundDrill) return
  boundDrill = null
  if (trainNav) return
  restoreSectionOptions()
}

function clickSquare(value) {
  return /^[a-h][1-8]$/i.test(String(value || '').trim())
}

function commitBoundDrill() {
  if (!boundDrill?.code) return null
  const form = readForm()
  const move = String(form.move || '').trim()
  const square = clickSquare(move) ? move.toLowerCase() : ''
  const record = {
    id: boundDrill.id,
    code: boundDrill.code,
    fen: square ? (form.fen || currentFen()) : fenAlignedToMove(form.fen || currentFen(), move),
    title: form.title,
    prompt: form.text,
    note: form.note,
    move: move || square,
    pgn: form.pgn,
    square,
    level: boundDrill.level,
    chapter: boundDrill.chapter,
    section: form.title ? `${boundDrill.code} · ${form.title}` : (boundDrill.section || boundDrill.code),
  }
  const store = readTrainStore()
  store[record.code] = record
  localStorage.setItem(TRAIN_DRILL_KEY, JSON.stringify(store))
  boundDrill = { ...boundDrill, square, section: record.section }
  applyDrillTitle(form.title)
  return record
}

export function saveBoundTrainDrill(options = {}) {
  if (!boundDrill) return null
  const record = commitBoundDrill()
  if (boundDrill.authored && hooks.saveAuthoredExercise) {
    hooks.saveAuthoredExercise(authoredPayload(record)).then((saved) => {
      hooks.onTrainDrillSaved?.(record)
      hooks.onAuthoredSaved?.(saved || record)
      showBoundDrillList(record.section || saved?.title || record.title || record.code)
      if (!options.quiet) {
        hooks.status?.(t('editor.menuSaved'))
        showToast(t('editor.updated', { name: saved?.title || record.title || record.code }))
      }
    }).catch((err) => {
      hooks.status?.(err instanceof Error ? err.message : t('editor.fileFail'))
    })
    return record
  }
  hooks.onTrainDrillSaved?.(record)
  showBoundDrillList(record.title || record.section || record.code)
  if (!options.quiet) {
    hooks.status?.(t('editor.saved'))
    showToast(t('editor.updated', { name: record.title || record.code }))
  }
  return record
}

export function seedTeacherDrill(drill) {
  if (!active || !drill) return null
  const form = document.querySelector('#curriculum-editor')
  if (!form) return null
  const nextCode = drill.code || drill.id
  if (boundDrill?.code && boundDrill.code !== nextCode) commitBoundDrill()
  rememberSectionOptions()
  const saved = trainDrillRecord(nextCode)
  const record = saved?.code && saved.code !== nextCode ? null : saved
  const prompt = record?.prompt || drill.prompt || ''
  const title = record?.title || drill.title || ''
  const note = record?.title ? (record.note || '') : (record?.note && record.note !== drill.title ? record.note : '')
  const move = record?.move || drill.move || ''
  const storedFen = record?.fen || drill.fen
  const fen = clickSquare(move) ? storedFen : fenAlignedToMove(storedFen, move)
  const pgn = record?.pgn || ''
  const moveField = form.querySelector('#ed-move')
  const pgnField = form.querySelector('#ed-pgn')
  if (moveField) moveField.value = ''
  if (pgnField) pgnField.value = ''
  boundDrill = {
    id: drill.id,
    code: nextCode,
    square: clickSquare(move) ? move.toLowerCase() : (record?.square || drill.square || ''),
    level: drill.level || '',
    chapter: drill.chapter || '',
    section: drill.section || '',
    parentId: drill.parentId || '',
    afterId: drill.authored ? (drill.afterId || '') : (drill.afterId || drill.id || ''),
    ancestors: Array.isArray(drill.ancestors) ? drill.ancestors : [],
    authored: Boolean(drill.authored),
    goal: drill.goal === 'mate' || drill.goal === 'advantage'
      ? drill.goal
      : (record?.goal === 'mate' || record?.goal === 'advantage' ? record.goal : ''),
  }
  creating = false
  showBoundDrillList(drill.section || boundDrill.code)
  hooks.showTrainHierarchy?.(drill.id)
  const text = form.querySelector('#ed-text')
  const titleField = form.querySelector('#ed-title')
  const noteField = form.querySelector('#ed-note')
  if (titleField) titleField.value = title
  applyDrillTitle(title)
  if (text) text.value = prompt
  if (noteField) noteField.value = note
  for (const field of form.querySelectorAll('input, textarea, select, button')) field.disabled = false
  for (const field of [form.querySelector('#ed-fen'), text, noteField, document.querySelector('#board-fen')]) {
    if (field) field.readOnly = false
  }
  setEntryOpen(true)
  writeFen(fen)
  resetBuilderLine(fen)
  if (moveField) moveField.value = move
  if (pgnField) pgnField.value = pgn
  showEngineGoal(boundDrill.goal)
  setPgnOpen(pgn)
  const played = move && !/^[a-h][1-8]$/.test(move)
  if (played) loadBuilderItem({ fen, moves: move.split(/\s+/).filter(Boolean), pgn })
  form.hidden = false
  paintEditorTools()
  showDesk('edit')
  syncEngineProbe()
  return { ...boundDrill, fen, title, prompt, note, move, pgn }
}

export function resumeTeacherEditor() {
  active = true
  document.querySelector('#curriculum-editor').hidden = false
  paintEditorTools()
  setEntryOpen(entryOpen)
  paintPositionLegality(currentFen())
}

export function closeTeacherEditor() {
  releaseTrainBinding()
  active = false
  grab = null
  const form = document.querySelector('#curriculum-editor')
  const bar = document.querySelector('#fen-bar')
  if (form) form.hidden = true
  for (const dock of document.querySelectorAll('.piece-dock')) dock.hidden = true
  if (bar) bar.hidden = true
  savedNotes = emptyNotes()
  notePreview = null
  syncBoardAnnotations(hooks.whiteAtBottom?.() !== false)
  const analysis = document.querySelector('#analysis-fen')
  if (analysis) analysis.hidden = false
  const lesson = document.querySelector('#lesson')
  if (lesson) lesson.hidden = false
  document.querySelector('.side')?.removeAttribute('data-desk')
  paintPositionLegality()
}

function showDesk(name = 'edit') {
  const form = document.querySelector('#curriculum-editor')
  const side = document.querySelector('.side')
  if (!form) return
  if (side) side.dataset.desk = name
  for (const button of form.querySelectorAll('.desk-tab')) {
    button.setAttribute('aria-selected', button.dataset.desk === name ? 'true' : 'false')
  }
  for (const pane of form.querySelectorAll('[data-desk-pane]')) {
    pane.hidden = pane.dataset.deskPane !== name
  }
}

function revealCurrentEntry() {
  setEntryOpen(sectionId === 'learn' || Boolean(listItems()[itemIndex]))
}

export function bindTeacherEditor() {
  const form = document.querySelector('#curriculum-editor')
  form.addEventListener('submit', (event) => event.preventDefault())
  form.querySelector('.desk-tabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('.desk-tab')
    if (tab) showDesk(tab.dataset.desk)
  })
  form.querySelector('#ed-level').addEventListener('change', () => {
    if (editorNavLock) return
    if (trainNav) {
      retargetTrain('level')
      return
    }
    if (boundDrill) return
    persist()
    levelId = form.querySelector('#ed-level').value
    fillSubs()
    loadItem()
    revealCurrentEntry()
  })
  form.querySelector('#ed-sub').addEventListener('change', () => {
    if (editorNavLock) return
    if (trainNav) {
      retargetTrain('chapter')
      return
    }
    if (boundDrill) return
    persist()
    subId = form.querySelector('#ed-sub').value
    draft = clone(currentSub()?.sections || {})
    fillItems()
    loadItem()
    revealCurrentEntry()
  })
  form.querySelector('#ed-section').addEventListener('change', () => {
    if (editorNavLock) return
    if (trainNav) {
      retargetTrain('section')
      return
    }
    if (boundDrill) return
    stopRecording({ resetBoard: true })
    persist()
    sectionId = form.querySelector('#ed-section').value
    itemIndex = 0
    fillItems()
    loadItem()
    revealCurrentEntry()
  })
  form.querySelector('#ed-item').addEventListener('change', () => {
    if (boundDrill || editorNavLock) return
    const next = Number(form.querySelector('#ed-item').value)
    if (creating && next === listItems().length) return
    if (creating) {
      if (formHasContent(readForm())) addItem()
      else creating = false
    } else persist()
    itemIndex = Number.isFinite(next) ? next : 0
    if (itemIndex >= listItems().length) itemIndex = Math.max(0, listItems().length - 1)
    loadItem()
  })
  form.querySelector('#ed-fen').addEventListener('input', () => {
    if (recording) stopRecording()
    showEngineGoal('')
    applyTypedFen(form.querySelector('#ed-fen').value, form.querySelector('#ed-fen'))
  })
  form.querySelector('#ed-analyze')?.addEventListener('click', () => {
    void analyzeTrainPosition()
  })
  const boardFen = document.querySelector('#board-fen')
  boardFen.addEventListener('input', () => applyTypedFen(boardFen.value, boardFen))
  document.querySelector('#load-fen').addEventListener('click', () => {
    const fromBoard = boardFen.value.trim()
    const fromEditor = form.querySelector('#ed-fen').value.trim()
    const chosen = placementRanks(fromEditor) === 8 ? fromEditor : (fromBoard || EMPTY)
    const previous = fenPlacement(currentFen())
    writeFen(chosen)
    if (fenPlacement(chosen) !== previous) hooks.orientToFen?.(chosen)
  })
  form.querySelector('#ed-save').addEventListener('click', save)
  form.querySelector('#ed-title').addEventListener('input', () => {
    if (!boundDrill) return
    applyDrillTitle(form.querySelector('#ed-title').value)
  })
  form.querySelector('#ed-record').addEventListener('click', toggleRecording)
  form.querySelector('#ed-move').addEventListener('input', () => {
    if (recording) replayRecorded()
    if (!boundDrill) return
    const typed = form.querySelector('#ed-move').value.trim()
    if (!typed || clickSquare(typed)) return
    const aligned = fenAlignedToMove(currentFen(), typed)
    if (aligned && aligned !== currentFen()) writeFen(aligned)
  })
  form.querySelector('#ed-delete').addEventListener('click', () => {
    if (boundDrill || (trainNav && creating)) void deleteBoundDrill()
    else deleteItem()
  })
  form.querySelector('#ed-export').addEventListener('click', exportFile)
  form.querySelector('#ed-import').addEventListener('click', () => form.querySelector('#ed-import-file').click())
  form.querySelector('#ed-import-file').addEventListener('change', importFile)
  form.querySelector('#ed-preview').addEventListener('click', preview)
  form.querySelector('#ed-add').addEventListener('click', onPrimary)
  form.querySelector('#ed-new').addEventListener('click', beginNew)
  form.querySelector('#ed-empty').addEventListener('click', () => {
    stopRecording()
    writeFen(EMPTY)
    resetBuilderLine(EMPTY)
  })
  form.querySelector('#ed-start').addEventListener('click', () => {
    stopRecording()
    writeFen(START)
    resetBuilderLine(START)
  })
  document.querySelector('#fen-copy').addEventListener('click', copyFen)
  document.querySelector('#fen-paste').addEventListener('click', pasteFen)
  document.querySelector('#fen-reset').addEventListener('click', () => {
    writeFen(START)
    hooks.applyOrientation?.('white')
  })
  document.querySelector('#ed-eval-bar').addEventListener('change', () => {
    if (!draft) return
    const box = document.querySelector('#ed-eval-bar')
    draft.showEval = { ...(draft.showEval || {}), [sectionId]: box.checked }
  })
  document.querySelector('#fen-clear').addEventListener('click', () => {
    notes = emptyNotes()
    notePreview = null
    syncBoardAnnotations(hooks.whiteAtBottom?.() !== false)
  })
  bindBoardDraw(document.querySelector('#board'), {
    enabled: () => active,
    preview(start, end, color) {
      notePreview = { start, end, color }
      syncBoardAnnotations(hooks.whiteAtBottom?.() !== false)
    },
    commit(start, end, color) {
      notePreview = null
      toggleNote(start, end, color)
      syncBoardAnnotations(hooks.whiteAtBottom?.() !== false)
    },
  })
  form.querySelector('#ed-turn').addEventListener('change', () => {
    const turn = form.querySelector('#ed-turn').value === 'b' ? 'b' : 'w'
    writeFen(serialize(readMap(currentFen()), turn))
  })
  form.querySelector('#ed-pgn').addEventListener('change', applyPgn)
  mountLessonBuilder({
    setAvatarState: (state) => hooks.setAvatarState?.(state),
    status: (message) => hooks.status?.(message),
    exportLesson: () => hooks.exportLesson?.(),
    writeLine: writeBuilderLine,
    setFen: (fen) => hooks.setFen?.(fen),
    getFen: () => currentFen(),
  })
}

function fillPalette() {
  const white = document.querySelector('#palette-white')
  const black = document.querySelector('#palette-black')
  if (!white || !black || white.childElementCount) return
  const tools = document.querySelector('.floating-board-tools')
  if (tools && !tools.querySelector('[data-brush]')) {
    tools.prepend(
      toolButton('hand', t('editor.hand'), { symbol: '✋' }),
      toolButton('eraser', t('editor.trash'), { trash: true }),
    )
  }
  for (const code of PIECES) dockFor(code, white, black).append(pieceButton(code))
  selectBrush('hand')
}

function dockFor(code, white, black) {
  return code.startsWith('w') ? white : black
}

function pieceButton(code) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'palette-piece'
  button.dataset.brush = code
  button.addEventListener('pointerdown', (event) => dragPalettePiece(event, code))
  const image = document.createElement('img')
  image.alt = code
  image.draggable = false
  image.src = `pieces/cburnett/${code}.svg`
  button.append(image)
  button.addEventListener('click', () => selectBrush(code))
  return button
}

function toolButton(code, label, extra = {}) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'palette-piece'
  button.dataset.brush = code
  button.title = label
  button.setAttribute('aria-label', label)
  if (extra.trash) {
    button.dataset.trash = '1'
    button.classList.add('trash')
    button.textContent = '🗑'
  } else button.textContent = extra.symbol || label
  button.addEventListener('click', () => selectBrush(code))
  return button
}

function dragPalettePiece(event, code) {
  if (event.button !== 0 || code === 'hand' || code === 'eraser') return
  selectBrush(code)
  event.preventDefault()
  const image = event.currentTarget.querySelector('img')
  const startX = event.clientX
  const startY = event.clientY
  let ghost = null
  let moved = false
  const follow = (ev) => {
    if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
    moved = true
    if (!ghost && image) {
      ghost = image.cloneNode(true)
      ghost.className = 'piece drag-ghost'
      sizeDragGhost(ghost, document.querySelector('#board .square'))
      document.body.append(ghost)
    }
    if (ghost) {
      ghost.style.left = `${ev.clientX}px`
      ghost.style.top = `${ev.clientY}px`
    }
  }
  const finish = (ev) => {
    window.removeEventListener('pointermove', follow)
    window.removeEventListener('pointerup', finish)
    ghost?.remove()
    if (!moved) return
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)
    const square = hit?.closest?.('[data-square]')?.dataset.square
    if (square) editorSquare(square)
  }
  window.addEventListener('pointermove', follow)
  window.addEventListener('pointerup', finish)
}

function selectBrush(code) {
  brush = code
  grab = null
  for (const button of document.querySelectorAll('[data-brush]')) {
    button.classList.toggle('active', button.dataset.brush === code)
  }
}

function reserveToolSpace() {
  const tools = document.querySelector('.floating-board-tools')
  const board = document.querySelector('#interactive-board')
  if (!tools || !board) return
  const shown = getComputedStyle(tools).display !== 'none'
  const width = shown ? Math.ceil(tools.getBoundingClientRect().width + 8) : 0
  board.style.setProperty('--board-tools-pad', `${width}px`)
}

function paintEditorTools() {
  const bar = document.querySelector('#fen-bar')
  for (const dock of document.querySelectorAll('.piece-dock')) dock.hidden = !active
  if (bar) bar.hidden = !active
  for (const button of document.querySelectorAll('.floating-board-tools [data-brush]')) {
    button.hidden = !active
  }
  reserveToolSpace()
}

function emptyNotes() {
  return { arrows: [], highlights: [] }
}

function normalizeNotes(value) {
  const colors = new Set(['green', 'red', 'yellow', 'blue'])
  const arrows = []
  const highlights = []
  for (const arrow of value?.arrows || []) {
    if (!isSquare(arrow?.start) || !isSquare(arrow?.end) || !colors.has(arrow.color)) continue
    arrows.push({ start: arrow.start, end: arrow.end, color: arrow.color })
  }
  for (const mark of value?.highlights || []) {
    if (!isSquare(mark?.square) || !colors.has(mark.color)) continue
    highlights.push({
      square: mark.square,
      color: mark.color,
      type: mark.type === 'square-fill' ? 'square-fill' : 'circle-ring',
    })
  }
  return { arrows, highlights }
}

function isSquare(square) {
  return /^[a-h][1-8]$/.test(square || '')
}

function loadNotes(value) {
  notes = normalizeNotes(value)
  notePreview = null
}

function toggleNote(start, end, color) {
  if (!isSquare(start) || !isSquare(end)) return
  if (start === end) {
    const same = notes.highlights.findIndex((item) => item.square === start && item.color === color)
    notes.highlights = notes.highlights.filter((item) => item.square !== start)
    if (same < 0) {
      notes.highlights.push({ square: start, color, type: 'circle-ring' })
      observeBuilderNote({ action: 'highlight', target: start })
    }
    return
  }
  const index = notes.arrows.findIndex((item) => item.start === start && item.end === end && item.color === color)
  if (index >= 0) notes.arrows.splice(index, 1)
  else {
    notes.arrows.push({ start, end, color })
    observeBuilderNote({ action: 'draw_arrow', from: start, to: end })
  }
}

function currentOrientation() {
  return hooks.whiteAtBottom?.() === false ? 'black' : 'white'
}

async function copyFen() {
  const fen = currentFen()
  try {
    await navigator.clipboard.writeText(fen)
    hooks.status?.(t('editor.copied'))
  } catch {
    const field = document.querySelector('#board-fen')
    field?.focus()
    field?.select()
    hooks.status?.(t('editor.copyHint'))
  }
}

async function pasteFen() {
  try {
    const text = (await navigator.clipboard.readText()).trim()
    if (placementRanks(text) !== 8) {
      hooks.status?.(t('editor.pasteFail'))
      return
    }
    const previous = fenPlacement(currentFen())
    writeFen(text)
    if (fenPlacement(text) !== previous) hooks.orientToFen?.(text)
  } catch {
    document.querySelector('#board-fen')?.focus()
    hooks.status?.(t('editor.pasteFail'))
  }
}

function replaceSelect(select, options, value) {
  if (!select) return
  select.replaceChildren()
  for (const item of options) {
    const option = document.createElement('option')
    option.value = item.value
    option.textContent = item.label
    select.append(option)
  }
  if ([...select.options].some((option) => option.value === value)) select.value = value
  else if (select.options.length) select.value = select.options[0].value
}

function findOutline(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node
    const found = findOutline(node.children, id)
    if (found) return found
  }
  return null
}

function outlinePath(nodes, id, trail = []) {
  for (const node of nodes || []) {
    const next = [...trail, node]
    if (node.id === id) return next
    const found = outlinePath(node.children, id, next)
    if (found) return found
  }
  return null
}

function chapterChoices(level) {
  const groups = (level?.children || []).filter((child) => !child.drill && !child.authoredSection)
  return [{ value: level.id, label: level.title }, ...groups.map((group) => ({ value: group.id, label: group.title }))]
}

function sectionChoices(parent) {
  const children = parent?.children || []
  const groups = children.filter((child) => !child.drill)
  const drills = children.filter((child) => child.drill)
  if (groups.length && !drills.length) {
    return [
      { value: '', label: t('editor.chooseSection') },
      ...groups.map((group) => ({ value: group.id, label: group.title })),
      { value: 'new-section', label: t('editor.newSection') },
    ]
  }
  return [
    ...drills.map((drill) => {
      const title = trainDrillRecord(drill.code || drill.id)?.title || drill.title
      return {
        value: drill.id,
        label: drill.code ? `${drill.code} · ${title}` : title,
      }
    }),
    { value: 'new', label: t('editor.newExercise') },
  ]
}

function lastDrillId(parent) {
  const drills = (parent?.children || []).filter((child) => child.drill)
  return drills.length ? drills[drills.length - 1].id : ''
}

export function syncTrainHierarchy(outline, selectedId) {
  if (!active || !Array.isArray(outline) || !selectedId) return false
  const path = outlinePath(outline, selectedId)
  if (!path?.length) return false
  trainOutline = outline
  trainNav = true
  trainSelectionId = selectedId
  const level = path[0]
  const authored = [...path].reverse().find((node) => node.authoredSection && !node.drill)
  const chapter = authored
    ? (path[Math.max(0, path.indexOf(authored) - 1)] || level)
    : (path.find((node, index) => index > 0 && !node.drill) || level)
  const drill = path[path.length - 1].drill ? path[path.length - 1] : null
  trainAfterId = drill?.id || lastDrillId(authored || (chapter.drill ? level : chapter))
  const form = document.querySelector('#curriculum-editor')
  editorNavLock = true
  try {
    replaceSelect(form.querySelector('#ed-level'), outline.map((node) => ({ value: node.id, label: node.title })), level.id)
    replaceSelect(form.querySelector('#ed-sub'), chapterChoices(level), chapter.id)
    const parent = findOutline(outline, chapter.id) || level
    const inside = !drill && boundDrill?.id && (boundDrill.parentId === parent.id || (parent.children || []).some((child) => child.id === boundDrill.id))
    if (inside) trainAfterId = boundDrill.id
    const sectionValue = authored ? authored.id : (drill ? drill.id : (inside ? boundDrill.id : 'new'))
    replaceSelect(form.querySelector('#ed-section'), sectionChoices(parent), sectionValue)
  } finally {
    editorNavLock = false
  }
  syncEngineProbe()
  return true
}

export function relabelTrainHierarchy(outline) {
  if (!trainNav || !trainSelectionId) return
  if (Array.isArray(outline)) trainOutline = outline
  syncTrainHierarchy(trainOutline, trainSelectionId)
}

function placementFromSelects() {
  const levelIdValue = document.querySelector('#ed-level')?.value || ''
  const chapterId = document.querySelector('#ed-sub')?.value || ''
  const sectionValue = document.querySelector('#ed-section')?.value || ''
  const level = findOutline(trainOutline, levelIdValue)
  const chapter = findOutline(trainOutline, chapterId)
  const sectionNode = sectionValue && sectionValue !== 'new' && sectionValue !== 'new-section'
    ? findOutline(trainOutline, sectionValue)
    : null
  const folder = sectionNode && !sectionNode.drill ? sectionNode : null
  const parent = folder || (chapter && !chapter.drill ? chapter : level)
  const ancestors = []
  if (level?.id) ancestors.push(level.id)
  if (chapter?.id && chapter.id !== level?.id && !chapter.drill && chapter.id !== folder?.id) ancestors.push(chapter.id)
  if (folder?.id && folder.id !== level?.id) ancestors.push(folder.id)
  const afterId = folder
    ? lastDrillId(folder)
    : (sectionValue && sectionValue !== 'new' ? sectionValue : (trainAfterId || lastDrillId(parent)))
  return {
    id: '',
    parentId: parent?.id || '',
    afterId: afterId === parent?.id ? '' : afterId,
    ancestors,
  }
}

function retargetTrain(which) {
  const form = document.querySelector('#curriculum-editor')
  const level = findOutline(trainOutline, form.querySelector('#ed-level')?.value)
  if (!level) return
  editorNavLock = true
  try {
    if (which === 'level') {
      replaceSelect(form.querySelector('#ed-sub'), chapterChoices(level), level.id)
      replaceSelect(form.querySelector('#ed-section'), sectionChoices(level), 'new')
      trainSelectionId = level.id
      trainAfterId = lastDrillId(level)
    } else if (which === 'chapter') {
      const chapter = findOutline(trainOutline, form.querySelector('#ed-sub')?.value) || level
      const parent = chapter.drill ? level : chapter
      replaceSelect(form.querySelector('#ed-section'), sectionChoices(parent), 'new')
      trainSelectionId = parent.id
      trainAfterId = lastDrillId(parent)
    } else {
      const sectionValue = form.querySelector('#ed-section')?.value || ''
      const picked = sectionValue ? findOutline(trainOutline, sectionValue) : null
      if (!sectionValue || sectionValue === 'new-section') {
        trainSelectionId = form.querySelector('#ed-sub')?.value || level.id
        if (sectionValue === 'new-section') {
          hooks.status?.(t('editor.newSectionHint'))
          document.querySelector('#ed-title')?.focus()
        }
      } else if (picked?.authoredSection) {
        trainSelectionId = picked.id
        trainAfterId = lastDrillId(picked)
      } else if (picked && !picked.drill) {
        const sub = form.querySelector('#ed-sub')
        if (sub && [...sub.options].some((option) => option.value === picked.id)) sub.value = picked.id
        replaceSelect(form.querySelector('#ed-section'), sectionChoices(picked), 'new')
        trainSelectionId = picked.id
        trainAfterId = lastDrillId(picked)
      } else if (sectionValue !== 'new') {
        trainAfterId = sectionValue
        trainSelectionId = sectionValue
        editorNavLock = false
        hooks.focusTrainDrill?.(sectionValue)
        return
      }
    }
  } finally {
    editorNavLock = false
  }
  if (creating) authoringTrain = placementFromSelects()
  hooks.markTrainSelection?.(trainSelectionId)
}

function fillLevels() {
  trainNav = false
  trainOutline = null
  trainSelectionId = ''
  trainAfterId = ''
  const select = document.querySelector('#ed-level')
  select.replaceChildren()
  for (const level of getLevels()) {
    const option = document.createElement('option')
    option.value = level.id
    option.textContent = tx(level.title)
    select.append(option)
  }
  if (!levelId) levelId = select.value
  select.value = levelId
  fillSubs()
  syncEngineProbe()
}

function fillSubs() {
  const select = document.querySelector('#ed-sub')
  select.replaceChildren()
  const level = getLevels().find((item) => item.id === levelId) || getLevels()[0]
  levelId = level?.id || ''
  for (const sub of level?.subchapters || []) {
    const option = document.createElement('option')
    option.value = sub.id
    option.textContent = tx(sub.title)
    select.append(option)
  }
  if (![...select.options].some((option) => option.value === subId)) subId = select.value
  select.value = subId
  draft = clone(currentSub()?.sections || {})
  fillItems()
}

function fillItems() {
  const locked = editorNavLock
  editorNavLock = true
  try {
  const select = document.querySelector('#ed-item')
  const list = document.querySelector('#ed-list')
  const head = document.querySelector('.editor-list-head')
  select.replaceChildren()
  if (list) list.replaceChildren()
  const learn = sectionId === 'learn'
  if (head) head.hidden = learn
  if (list) list.hidden = learn
  const items = listItems()
  items.forEach((item, index) => {
    const option = document.createElement('option')
    option.value = String(index)
    option.textContent = itemLabel(item, index)
    select.append(option)
    if (!list || learn) return
    const row = document.createElement('li')
    row.className = 'editor-row'
    if (!creating && index === itemIndex) row.classList.add('active')
    const name = document.createElement('span')
    name.className = 'editor-name'
    name.textContent = rowTitle(item, index)
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.textContent = t('editor.edit')
    edit.addEventListener('click', () => editItem(index))
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = t('editor.listRemove')
    remove.addEventListener('click', () => deleteItem(index))
    row.append(name, edit, remove)
    list.append(row)
  })
  if (!items.length) {
    const option = document.createElement('option')
    option.value = '0'
    option.textContent = t('editor.emptyItem')
    select.append(option)
    if (list && !learn) {
      const empty = document.createElement('li')
      empty.className = 'editor-name'
      empty.textContent = t('editor.emptyItem')
      list.append(empty)
    }
    creating = true
    itemIndex = 0
    select.value = '0'
  } else if (creating) {
    const option = document.createElement('option')
    option.value = String(items.length)
    option.textContent = t('editor.newExercise')
    select.append(option)
    itemIndex = items.length
    select.value = option.value
  } else {
    if (itemIndex >= items.length) itemIndex = 0
    select.value = String(itemIndex)
  }
  refreshActionButton()
  } finally {
    editorNavLock = locked
  }
}

export function refreshEditorChrome() {
  if (!active) return
  fillItems()
  syncPanelHint()
  paintRecordButton()
  refreshBuilder()
  paintPositionLegality(currentFen())
}

function listItems() {
  if (sectionId === 'learn') return [draft?.learn || {}]
  if (sectionId === 'examples') return draft?.examples || []
  if (sectionId === 'practice') return draft?.practice?.exercises || []
  if (sectionId === 'evaluation') return draft?.evaluation?.tests || []
  return []
}

function itemLabel(item, index) {
  if (sectionId === 'learn') return t('pedagogy.step.learn')
  if (sectionId === 'examples') return t('pedagogy.example', { n: item.id || index + 1 })
  if (sectionId === 'evaluation') return item.id || `T${index + 1}`
  return String(item.id || index + 1)
}

function exerciseCode(item, index) {
  const id = item?.id
  if (typeof id === 'number' || /^\d+$/.test(String(id ?? ''))) return `EX-${String(id).padStart(3, '0')}`
  if (id) return String(id)
  return `EX-${String(index + 1).padStart(3, '0')}`
}

function rowTitle(item, index) {
  const text = tx(item.title) || tx(item.explanation) || tx(item.hint) || tx(item.what_to_observe) || t('editor.customDiagram')
  const first = String(text).split('\n')[0].trim().slice(0, 48)
  return `${index + 1}. ${exerciseCode(item, index)} · ${first}`
}

function editItem(index) {
  if (!creating) persist()
  creating = false
  itemIndex = index
  loadItem()
  fillItems()
  setEntryOpen(true)
}

function refreshActionButton() {
  const button = document.querySelector('#ed-add')
  if (!button) return
  const update = sectionId === 'learn' || (!creating && listItems()[itemIndex])
  button.textContent = update ? t('editor.update') : t('editor.add')
}

function showToast(message) {
  const toast = document.querySelector('#toast')
  if (!toast) return
  toast.textContent = message
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.hidden = true
  }, 2800)
}

function loadItem() {
  stopRecording()
  const item = listItems()[itemIndex]
  if (!item) {
    creating = sectionId !== 'learn'
    const form = document.querySelector('#curriculum-editor')
    form.querySelector('#ed-title').value = ''
    form.querySelector('#ed-text').value = ''
    form.querySelector('#ed-note').value = ''
    form.querySelector('#ed-move').value = ''
    form.querySelector('#ed-pgn').value = ''
    showEngineGoal('')
    setPgnOpen(false)
    refreshActionButton()
    syncPanelHint()
    loadNotes(null)
    paintShowEval()
    writeTestFields(null)
    loadBuilderItem(null)
    return
  }
  creating = false
  const form = document.querySelector('#curriculum-editor')
  form.querySelector('#ed-title').value = tx(item.title) || ''
  form.querySelector('#ed-text').value = tx(item.explanation) || tx(item.hint) || ''
  form.querySelector('#ed-note').value = tx(item.what_to_observe) || ''
  form.querySelector('#ed-move').value = formatLine(item)
  form.querySelector('#ed-difficulty').value = item.difficulty || item.level || 'basic'
  writeTestFields(item)
  const pgn = item.pgn || (sectionId === 'learn' ? draft?.learn?.pgn : '') || ''
  form.querySelector('#ed-pgn').value = pgn
  setPgnOpen(pgn)
  const fen = item.fen || item.diagram_fen || EMPTY
  loadNotes(item.annotations)
  if (item.orientation === 'white' || item.orientation === 'black') hooks.applyOrientation?.(item.orientation)
  writeFen(fen)
  form.querySelector('#ed-turn').value = turnOf(fen)
  refreshActionButton()
  syncPanelHint()
  paintShowEval()
  loadBuilderItem(item)
}

function readForm() {
  const form = document.querySelector('#curriculum-editor')
  return {
    title: form.querySelector('#ed-title')?.value.trim() || '',
    text: form.querySelector('#ed-text').value,
    note: form.querySelector('#ed-note').value,
    move: form.querySelector('#ed-move').value.trim(),
    attempts: readBounded('#ed-attempts', 3, 1, 20),
    time: readBounded('#ed-time', 0, 0, 3600),
    weight: readBounded('#ed-weight', 1, 1, 100),
    fen: form.querySelector('#ed-fen').value.trim(),
    pgn: form.querySelector('#ed-pgn').value.trim(),
    difficulty: form.querySelector('#ed-difficulty').value || 'basic',
  }
}

function formHasContent(form) {
  const emptyBoard = !form.fen || form.fen.startsWith('8/8/8/8/8/8/8/8')
  return Boolean(form.title || form.text.trim() || form.note.trim() || form.move || form.pgn || !emptyBoard)
}

function formatLine(item) {
  if (sectionId === 'evaluation' && Array.isArray(item?.testSolutionMoves) && item.testSolutionMoves.length) return formatMoveList(item.testSolutionMoves)
  if (Array.isArray(item?.solutionMoves) && item.solutionMoves.length) return formatMoveList(item.solutionMoves)
  if (Array.isArray(item?.solutie) && item.solutie.length) return item.solutie.join(' ')
  if (Array.isArray(item?.moves) && item.moves.length) return item.moves.join(' ')
  if (Array.isArray(item?.correctMove)) return item.correctMove.filter(Boolean).join(' ')
  return item?.correctMove || ''
}

function assignLine(item, fen, typed, force) {
  const authored = authoredMoves(typed)
  if (sectionId === 'practice') {
    if (authored.length) item.solutionMoves = authored
    else delete item.solutionMoves
  }
  if (sectionId === 'evaluation') {
    if (authored.length) item.testSolutionMoves = authored
    else delete item.testSolutionMoves
  }
  const line = solutionMoves(fen, authored.length ? authored : typed)
  if (line.length > 1 || (force && line.length)) {
    item.solutie = line
    item.moves = line
    item.correctMove = line.join(' ')
    return
  }
  if (line.length === 1) {
    item.correctMove = line[0]
    if (force || Array.isArray(item.solutie) || Array.isArray(item.moves)) {
      item.solutie = line
      item.moves = line
    }
    return
  }
  const raw = String(typed || '').trim()
  if (raw || item.correctMove) item.correctMove = raw
  if (!raw) delete item.moves
}

function applyToItem(item, form, force = false) {
  item.title = writeText(item.title, form.title)
  item.fen = form.fen
  item.pgn = form.pgn
  assignLine(item, form.fen, form.move, force)
  item.difficulty = form.difficulty
  item.levelId = levelId
  item.subchapterId = subId
  item.what_to_observe = writeText(item.what_to_observe, form.note)
  if (sectionId === 'practice') item.hint = writeText(item.hint, form.text)
  else item.explanation = writeText(item.explanation, form.text)
  if (sectionId === 'evaluation') {
    item.level = form.difficulty
    item.maxAttempts = form.attempts
    item.timeLimitSec = form.time
    item.scoreWeight = form.weight
  }
  item.orientation = currentOrientation()
  item.annotations = clone(notes)
  item.type = item.type || 'interactive_fen'
}

function paintShowEval() {
  const box = document.querySelector('#ed-eval-bar')
  if (!box) return
  const flag = draft?.showEval?.[sectionId]
  box.checked = typeof flag === 'boolean' ? flag : sectionId === 'learn' || sectionId === 'examples'
}

function rememberShowEval() {
  const box = document.querySelector('#ed-eval-bar')
  if (!box || !draft) return
  draft.showEval = { ...(draft.showEval || {}), [sectionId]: box.checked }
}

function rememberItem() {
  if (!draft || (creating && sectionId !== 'learn')) return
  rememberShowEval()
  const form = readForm()
  if (sectionId === 'learn') {
    draft.learn = {
      ...(draft.learn || {}),
      explanation: writeText(draft.learn?.explanation, form.text),
      what_to_observe: writeText(draft.learn?.what_to_observe, form.note),
      diagram_fen: form.fen,
      pgn: form.pgn,
      orientation: currentOrientation(),
      annotations: clone(notes),
    }
    assignLine(draft.learn, form.fen, form.move, false)
    return
  }
  if (!listItems()[itemIndex]) {
    if (!formHasContent(form)) return
    pushBlank(form.fen)
  }
  const item = listItems()[itemIndex]
  if (!item) return
  applyToItem(item, form)
}

function nextExerciseId(items) {
  const used = (items || []).map((item) => {
    const raw = item?.id
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    const match = String(raw ?? '').match(/(\d+)\s*$/)
    return match ? Number(match[1]) : 0
  })
  return Math.max(0, ...(used.length ? used : [0]), (items || []).length) + 1
}

function pushBlank(fen) {
  const difficulty = document.querySelector('#ed-difficulty')?.value || 'basic'
  const mark = { levelId, subchapterId: subId, difficulty }
  if (sectionId === 'examples') {
    draft.examples = draft.examples || []
    const id = nextExerciseId(draft.examples)
    draft.examples.push({ id, type: 'interactive_fen', fen, explanation: blank(), what_to_observe: blank(), correctMove: '', ...mark })
    itemIndex = draft.examples.length - 1
  } else if (sectionId === 'practice') {
    draft.practice = draft.practice || { max_attempts: 3, exercises: [] }
    const id = nextExerciseId(draft.practice.exercises)
    draft.practice.exercises.push({ id, type: 'interactive_fen', fen, hint: blank(), correctMove: '', ...mark })
    itemIndex = draft.practice.exercises.length - 1
  } else if (sectionId === 'evaluation') {
    draft.evaluation = draft.evaluation || { pass_score: 9, tests: [] }
    const id = `T${nextExerciseId(draft.evaluation.tests)}`
    draft.evaluation.tests.push({ id, type: 'find_move', level: difficulty, fen, explanation: blank(), correctMove: '', ...mark })
    itemIndex = draft.evaluation.tests.length - 1
  }
}

function addItem() {
  if (sectionId === 'learn' || !draft || !subId) return
  const form = readForm()
  pushBlank(form.fen || currentFen())
  const item = listItems()[itemIndex]
  applyToItem(item, form, true)
  creating = false
  fillItems()
  loadItem()
  saveSubchapterSections(levelId, subId, clone(draft))
  refreshPreviewCopy()
  hooks.status?.(t('editor.saved'))
  showToast(t('editor.added'))
}

function onPrimary() {
  if (sectionId !== 'learn' && (creating || !listItems()[itemIndex])) addItem()
  else save()
}

export function startNewEditorExercise() {
  if (!active || !draft) return false
  beginNew()
  document.querySelector('#ed-title')?.focus()
  return true
}

function trainPlacement() {
  if (!hooks.inTrain?.()) return null
  if (trainNav) return placementFromSelects()
  if (boundDrill) {
    return {
      id: '',
      parentId: boundDrill.parentId || '',
      afterId: boundDrill.id || '',
      ancestors: Array.isArray(boundDrill.ancestors) ? boundDrill.ancestors.slice() : [],
    }
  }
  return hooks.trainPlacement?.() || { id: '', parentId: '', afterId: '', ancestors: [] }
}

function authoredPayload(record = {}) {
  const form = readForm()
  const source = boundDrill?.authored ? boundDrill : (authoringTrain || (trainNav ? placementFromSelects() : null))
  return {
    id: source?.id || record.id || '',
    code: source?.code || record.code || '',
    parentId: source?.parentId || record.parentId || '',
    afterId: source?.afterId || record.afterId || '',
    ancestors: source?.ancestors || record.ancestors || [],
    title: record.title || form.title,
    section: record.section || boundDrill?.section || '',
    fen: record.fen || form.fen || currentFen(),
    prompt: record.prompt ?? form.text,
    note: record.note ?? form.note,
    move: record.move ?? form.move,
    pgn: record.pgn ?? form.pgn,
    goal: document.querySelector('#ed-eval')?.dataset.goal || source?.goal || record.goal || '',
  }
}

function bindAuthored(saved) {
  const form = readForm()
  boundDrill = {
    id: saved.id,
    code: saved.code,
    square: clickSquare(saved.move || form.move) ? String(saved.move || form.move).toLowerCase() : '',
    level: '',
    chapter: '',
    section: `${saved.code} · ${saved.title}`,
    parentId: saved.parentId || '',
    afterId: saved.afterId || '',
    ancestors: Array.isArray(saved.ancestors) ? saved.ancestors : [],
    authored: true,
    goal: saved.goal === 'mate' || saved.goal === 'advantage' ? saved.goal : '',
  }
  creating = false
  authoringTrain = null
  showBoundDrillList(boundDrill.section)
  hooks.onAuthoredSaved?.(saved)
}

async function publishTrainSection() {
  if (authoringBusy) return
  const title = String(document.querySelector('#ed-title')?.value || '').trim()
  if (!title) {
    hooks.status?.(t('editor.needSectionTitle'))
    document.querySelector('#ed-title')?.focus()
    return
  }
  const parent = findOutline(trainOutline, document.querySelector('#ed-sub')?.value)
    || findOutline(trainOutline, document.querySelector('#ed-level')?.value)
  if (!parent?.id || !hooks.saveTrainSection) {
    hooks.status?.(t('editor.fileFail'))
    return
  }
  const groups = (parent.children || []).filter((child) => !child.drill)
  const afterId = groups.length ? groups[groups.length - 1].id : ''
  authoringBusy = true
  try {
    const saved = await hooks.saveTrainSection({ title, parentId: parent.id, afterId })
    if (!saved?.id) throw new Error(t('editor.fileFail'))
    const titleField = document.querySelector('#ed-title')
    if (titleField) titleField.value = ''
    hooks.status?.(t('editor.sectionSaved'))
    showToast(t('editor.sectionAdded', { name: saved.title || title }))
  } catch (err) {
    hooks.status?.(err instanceof Error ? err.message : t('editor.fileFail'))
  } finally {
    authoringBusy = false
  }
}

async function publishAuthoredExercise() {
  if (authoringBusy || !authoringTrain) return
  const form = readForm()
  if (!form.title) {
    hooks.status?.(t('editor.needTitle'))
    document.querySelector('#ed-title')?.focus()
    return
  }
  if (!hooks.saveAuthoredExercise) {
    hooks.status?.(t('editor.fileFail'))
    return
  }
  authoringBusy = true
  try {
    const saved = await hooks.saveAuthoredExercise(authoredPayload())
    if (!saved?.id) throw new Error(t('editor.fileFail'))
    bindAuthored(saved)
    hooks.status?.(t('editor.menuSaved'))
    showToast(t('editor.added'))
  } catch (err) {
    hooks.status?.(err instanceof Error ? err.message : t('editor.fileFail'))
  } finally {
    authoringBusy = false
  }
}

function beginNew() {
  if (!draft) return
  const placement = trainPlacement()
  if (sectionId === 'learn') {
    sectionId = 'examples'
    const section = document.querySelector('#ed-section')
    if (section && [...section.options].some((option) => option.value === 'examples')) section.value = 'examples'
  }
  stopRecording({ resetBoard: true })
  editorNavLock = true
  try {
    if (boundDrill) {
      commitBoundDrill()
      releaseTrainBinding()
    } else if (!creating) persist()
    authoringTrain = placement
    if (trainNav) {
      const section = document.querySelector('#ed-section')
      if (section && [...section.options].some((option) => option.value === 'new')) {
        editorNavLock = true
        section.value = 'new'
        editorNavLock = false
      }
    }
    creating = true
    itemIndex = listItems().length
    const form = document.querySelector('#curriculum-editor')
    form.querySelector('#ed-title').value = ''
    form.querySelector('#ed-text').value = ''
    form.querySelector('#ed-note').value = ''
    form.querySelector('#ed-move').value = ''
    form.querySelector('#ed-pgn').value = ''
    showEngineGoal('')
    setPgnOpen(false)
    fillItems()
    setEntryOpen(true)
    syncPanelHint()
    showDesk('edit')
  } finally {
    editorNavLock = false
  }
}

function setEntryOpen(open) {
  entryOpen = open
  const block = document.querySelector('#ed-form')
  if (block) block.hidden = !open
  const analysis = document.querySelector('#analysis-fen')
  if (analysis) analysis.hidden = Boolean(active && open)
  paintEditorTools()
}

function discardNewTrainDraft() {
  creating = false
  authoringTrain = null
  const previous = trainSelectionId
  if (previous && previous !== 'new') hooks.focusTrainDrill?.(previous)
}

async function deleteBoundDrill() {
  const drill = boundDrill
  if (!drill?.id && !drill?.code) {
    if (trainNav && creating) discardNewTrainDraft()
    return
  }
  const name = document.querySelector('#ed-title')?.value.trim() || drill.code || drill.id
  if (!window.confirm(t('editor.confirmRemove', { name }))) return
  boundDrill = null
  creating = false
  authoringTrain = null
  try {
    await hooks.deleteTrainDrill?.(drill)
    hooks.status?.(t('editor.deleted'))
    showToast(t('editor.removedToast', { name }))
  } catch (err) {
    boundDrill = drill
    hooks.status?.(err instanceof Error ? err.message : t('editor.fileFail'))
  }
}

function deleteItem(index = itemIndex) {
  if (!draft || sectionId === 'learn' || !subId) return
  const items = listItems()
  if (!Number.isInteger(index) || !items[index]) return
  const name = exerciseCode(items[index], index)
  items.splice(index, 1)
  itemIndex = Math.min(index, Math.max(0, items.length - 1))
  creating = items.length === 0
  saveSubchapterSections(levelId, subId, clone(draft))
  fillItems()
  loadItem()
  if (!items.length) setEntryOpen(false)
  hooks.status?.(t('editor.deleted'))
  showToast(t('editor.removedToast', { name }))
}

function persist() {
  if (boundDrill) return false
  if (!draft || !levelId || !subId) return false
  if (creating) {
    if (sectionId === 'learn' || !formHasContent(readForm())) return false
    addItem()
    return true
  }
  const before = JSON.stringify(draft)
  rememberItem()
  if (JSON.stringify(draft) === before) return false
  return Boolean(saveSubchapterSections(levelId, subId, clone(draft)))
}

function save() {
  const sectionValue = document.querySelector('#ed-section')?.value || ''
  if (trainNav && (sectionValue === 'new-section' || sectionValue === '')) {
    if (sectionValue === 'new-section') void publishTrainSection()
    else hooks.status?.(t('editor.chooseSection'))
    return
  }
  const pickedSection = trainNav && sectionValue ? findOutline(trainOutline, sectionValue) : null
  if (trainNav && pickedSection?.authoredSection && !boundDrill) {
    authoringTrain = placementFromSelects()
    creating = true
    publishAuthoredExercise()
    return
  }
  if (creating && authoringTrain) {
    publishAuthoredExercise()
    return
  }
  if (creating) {
    if (boundDrill) releaseTrainBinding()
    if (sectionId !== 'learn' && draft && subId) addItem()
    return
  }
  if (boundDrill) {
    saveBoundTrainDrill()
    return
  }
  if (!draft || !levelId || !subId) return
  stopRecording({ resetBoard: true })
  if (sectionId !== 'learn' && !listItems()[itemIndex]) {
    addItem()
    return
  }
  rememberItem()
  const form = readForm()
  if (sectionId === 'learn') assignLine(draft.learn, form.fen, form.move, true)
  else if (listItems()[itemIndex]) assignLine(listItems()[itemIndex], form.fen, form.move, true)
  const item = sectionId === 'learn' ? draft.learn : listItems()[itemIndex]
  const stored = sectionId === 'evaluation' && Array.isArray(item?.testSolutionMoves) && item.testSolutionMoves.length
    ? formatMoveList(item.testSolutionMoves)
    : sectionId === 'practice' && Array.isArray(item?.solutionMoves) && item.solutionMoves.length
    ? formatMoveList(item.solutionMoves)
    : formatSolution(item?.solutie)
  if (stored) document.querySelector('#ed-move').value = stored
  saveSubchapterSections(levelId, subId, clone(draft))
  fillItems()
  syncPanelHint()
  refreshPreviewCopy()
  hooks.status?.(t('editor.saved'))
  showToast(t('editor.updated', { name: exerciseCode(item, itemIndex) }))
}

export function currentTrainExport() {
  if (!boundDrill) return null
  const record = commitBoundDrill()
  if (!record) return null
  if (boundDrill.authored) saveBoundTrainDrill({ quiet: true })
  else hooks.onTrainDrillSaved?.(record)
  return authoredPayload(record)
}

function exportFile() {
  save()
  const blob = new Blob([exportThemeBackup()], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'chesscoach-teme.json'
  link.click()
  URL.revokeObjectURL(link.href)
  hooks.status?.(t('editor.exported'))
}

function importFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const count = importThemeBackup(String(reader.result || ''))
      draft = clone(currentSub()?.sections || {})
      fillItems()
      loadItem()
      hooks.status?.(t('editor.imported', { count }))
    } catch {
      hooks.status?.(t('editor.importBad'))
    }
  }
  reader.readAsText(file)
}

function preview() {
  if (boundDrill) {
    const record = saveBoundTrainDrill()
    if (record) hooks.previewTrain?.(record)
    return
  }
  save()
  const level = getLevels().find((item) => item.id === levelId)
  const sub = currentSub()
  if (!level || !sub || !hooks.preview) return
  hooks.preview(level, sub, sectionId, itemIndex)
}

export function captureLessonDocument() {
  if (!active || !draft || !subId) return null
  rememberItem()
  const sub = currentSub()
  return lessonFromSections({
    lessonId: sub?.id || subId,
    title: sub?.title || subId,
    author: sub?.author || '',
    created_at: sub?.created_at || '',
    sections: draft,
  })
}

export function stampNarrative(narrative) {
  if (!active || !draft || !narrative) return false
  const form = document.querySelector('#curriculum-editor')
  if (form && narrative.pgn) form.querySelector('#ed-pgn').value = narrative.pgn
  if (form && narrative.moveText) form.querySelector('#ed-move').value = narrative.moveText
  rememberItem()
  const item = sectionId === 'learn' ? draft.learn : listItems()[itemIndex]
  if (!item) return false
  if (narrative.audioUrl) item.audioUrl = narrative.audioUrl
  else delete item.audioUrl
  item.scriptText = writeText(item.scriptText, narrative.scriptText || '')
  if (narrative.timeline?.length) item.timeline = narrative.timeline.map((cue) => ({ ...cue }))
  else delete item.timeline
  persist()
  return true
}

function writeBuilderLine(moves, pgn) {
  if (recording && recordsLine()) return
  const form = document.querySelector('#curriculum-editor')
  if (!form) return
  const field = form.querySelector('#ed-move')
  const typed = String(field?.value || '').trim()
  if (boundDrill && !moves.length && typed && !clickSquare(typed)) {
    form.querySelector('#ed-pgn').value = pgn || ''
    return
  }
  field.value = moves.join(' ')
  form.querySelector('#ed-pgn').value = pgn || ''
  setPgnOpen(pgn)
}

export function showLoadedLesson(nextLevelId, nextSubId) {
  if (!active || !nextLevelId || !nextSubId) return false
  if (boundDrill) {
    releaseTrainBinding()
    fillLevels()
  }
  levelId = nextLevelId
  subId = nextSubId
  sectionId = 'learn'
  itemIndex = 0
  creating = false
  const section = document.querySelector('#ed-section')
  if (section) section.value = 'learn'
  fillLevels()
  loadItem()
  setEntryOpen(true)
  paintEditorTools()
  return true
}

export function flushEditor() {
  persist()
  return editorSelection()
}

export function editorSelection() {
  if (!levelId || !subId) return null
  return { levelId, subId, sectionId, itemIndex }
}

function setPgnOpen(value) {
  const box = document.querySelector('#ed-pgn-box')
  if (box) box.open = Boolean(String(value || '').trim())
}

function currentHint() {
  const form = document.querySelector('#curriculum-editor')
  if (!form) return ''
  const text = form.querySelector('#ed-text')?.value.trim() || ''
  const note = form.querySelector('#ed-note')?.value.trim() || ''
  return [text, note].filter(Boolean).join('\n\n')
}

function syncPanelHint() {
  hooks.resetTask?.()
  const lesson = document.querySelector('#lesson')
  if (!lesson) return
  if (active) {
    lesson.hidden = true
    return
  }
  const hint = currentHint()
  lesson.textContent = hint
  lesson.hidden = !hint
}

export function focusLessonDiagram(nextLevelId, nextSubId) {
  if (!active || !nextLevelId || !nextSubId) return false
  if (boundDrill) {
    releaseTrainBinding()
    fillLevels()
  }
  const form = document.querySelector('#curriculum-editor')
  const levelSelect = form?.querySelector('#ed-level')
  const sectionSelect = form?.querySelector('#ed-section')
  if (!levelSelect || !sectionSelect) return false
  if (!levelSelect.options.length) fillLevels()
  if (levelId === nextLevelId && subId === nextSubId && sectionId === 'learn') {
    setEntryOpen(true)
    paintEditorTools()
    return true
  }
  persist()
  levelId = nextLevelId
  subId = nextSubId
  sectionId = 'learn'
  itemIndex = 0
  creating = false
  levelSelect.value = nextLevelId
  sectionSelect.value = 'learn'
  fillSubs()
  const subSelect = form.querySelector('#ed-sub')
  if (subSelect && [...subSelect.options].some((option) => option.value === nextSubId)) subSelect.value = nextSubId
  loadItem()
  setEntryOpen(true)
  paintEditorTools()
  return true
}

export function focusEditorLevel(nextLevelId, nextSubId = '') {
  if (!active || !nextLevelId) return false
  if (boundDrill) {
    releaseTrainBinding()
    fillLevels()
  }
  const form = document.querySelector('#curriculum-editor')
  const levelSelect = form?.querySelector('#ed-level')
  const subSelect = form?.querySelector('#ed-sub')
  if (!levelSelect || !subSelect) return false
  if (!levelSelect.options.length) fillLevels()
  if (![...levelSelect.options].some((option) => option.value === nextLevelId)) return false
  const level = getLevels().find((item) => item.id === nextLevelId)
  if (!level?.subchapters?.length) return false
  const requested = nextSubId ? level.subchapters.find((sub) => sub.id === nextSubId) : null
  const sub = requested || (levelId === nextLevelId
    ? level.subchapters.find((item) => item.id === subId) || level.subchapters[0]
    : level.subchapters[0])
  if (levelId === nextLevelId && subId === sub.id) {
    levelSelect.value = nextLevelId
    if ([...subSelect.options].some((option) => option.value === sub.id)) subSelect.value = sub.id
    else fillSubs()
    return true
  }
  persist()
  levelId = nextLevelId
  levelSelect.value = nextLevelId
  subId = sub.id
  itemIndex = 0
  fillSubs()
  loadItem()
  return true
}

export function focusEditorTheme(nextLevelId, nextSubId) {
  if (!active) return false
  const form = document.querySelector('#curriculum-editor')
  const levelSelect = form?.querySelector('#ed-level')
  const subSelect = form?.querySelector('#ed-sub')
  const sectionSelect = form?.querySelector('#ed-section')
  if (!levelSelect || !subSelect || !sectionSelect) return false
  if (![...levelSelect.options].some((option) => option.value === nextLevelId)) return false
  const level = getLevels().find((item) => item.id === nextLevelId)
  if (!level?.subchapters?.some((sub) => sub.id === nextSubId)) return false
  persist()
  levelId = nextLevelId
  levelSelect.value = nextLevelId
  subId = nextSubId
  sectionId = 'learn'
  itemIndex = 0
  creating = false
  sectionSelect.value = 'learn'
  fillSubs()
  loadItem()
  setEntryOpen(true)
  const text = form.querySelector('#ed-text')
  text?.focus()
  form.scrollIntoView({ block: 'nearest' })
  return true
}

function applyPgn() {
  const pgn = document.querySelector('#ed-pgn').value.trim()
  if (!pgn) return
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    writeFen(chess.fen())
    hooks.status?.(t('editor.pgnOk'))
  } catch {
    hooks.status?.(t('editor.pgnBad'))
  }
}

function currentSub() {
  const level = getLevels().find((item) => item.id === levelId)
  return (level?.subchapters || []).find((item) => item.id === subId) || null
}

function applyTypedFen(raw, source) {
  const clean = String(raw || '').trim()
  mirrorFen(clean, source)
  if (placementRanks(clean) === 8) writeFen(clean, false)
}

function writeFen(fen, mirror = true) {
  const clean = String(fen || EMPTY).trim()
  hooks.setFen?.(clean)
  if (mirror) mirrorFen(clean)
  const turn = document.querySelector('#ed-turn')
  if (turn) turn.value = turnOf(clean)
  paintPositionLegality(clean)
}

export function paintPositionLegality(fen = currentFen()) {
  const node = document.querySelector('#ed-legal')
  if (!node) return
  if (!active) {
    node.hidden = true
    node.textContent = ''
    return
  }
  const legal = legalPosition(fen)
  node.hidden = false
  node.classList.toggle('is-ok', legal)
  node.classList.toggle('is-bad', !legal)
  node.textContent = t(legal ? 'editor.positionLegal' : 'editor.positionIllegal')
}

function fenPlacement(fen) {
  return String(fen || '').trim().split(/\s+/)[0] || ''
}

function mirrorFen(clean, source) {
  for (const field of [document.querySelector('#board-fen'), document.querySelector('#ed-fen')]) {
    if (!field || field === source || field.value === clean) continue
    field.value = clean
  }
}

function placementRanks(fen) {
  return String(fen || '').trim().split(/\s+/)[0].split('/').length
}

function currentFen() {
  return hooks.getFen?.() || EMPTY
}

function writeText(previous, value) {
  const next = previous && typeof previous === 'object' ? { ...previous } : { ro: '', en: '', fr: '' }
  next[lang()] = value
  return next
}

function blank() {
  return { ro: '', en: '', fr: '' }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readMap(fen) {
  const map = new Map()
  const ranks = String(fen || '').trim().split(/\s+/)[0].split('/')
  if (ranks.length !== 8) return map
  ranks.forEach((rank, rankIndex) => {
    let file = 0
    for (const symbol of rank) {
      if (symbol >= '1' && symbol <= '8') {
        file += Number(symbol)
        continue
      }
      if (file > 7) break
      const color = symbol === symbol.toUpperCase() ? 'w' : 'b'
      map.set('abcdefgh'[file] + (8 - rankIndex), `${color}${symbol.toUpperCase()}`)
      file += 1
    }
  })
  return map
}

function serialize(map, turn) {
  // FEN standard: rândul 8 primul, coloanele a–h. Nu depinde de rotirea tablei.
  const ranks = []
  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = ''
    let empty = 0
    for (const file of 'abcdefgh') {
      const piece = map.get(file + rank)
      if (!piece) {
        empty += 1
        continue
      }
      if (empty) {
        row += empty
        empty = 0
      }
      row += piece[0] === 'w' ? piece[1] : piece[1].toLowerCase()
    }
    if (empty) row += empty
    ranks.push(row || '8')
  }
  return `${ranks.join('/')} ${turn === 'b' ? 'b' : 'w'} - - 0 1`
}

function turnOf(fen) {
  return String(fen || '').trim().split(/\s+/)[1] === 'b' ? 'b' : 'w'
}
