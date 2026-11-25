// Biblioteca „Învățăm de la...” — profiluri de maeștri, separate de lecțiile Rege.
// Datele stau în curriculum/masters_library.json. Progresul stă în localStorage.

import { Chess } from './vendor/chess.js'
import { lang, t, tx } from './i18n.js'
import { readPgnGame } from './pgn-import.js'

const STORE = 'chesscoach.masters'
const NOTES = 'chesscoach.masterNotes'

let library = null
let authored = []
let root = null
let api = null
let hooks = {}
let view = 'closed'
let filter = 'all'
let currentId = null
let lessonId = null
let lineEpoch = 0
let replyTimer = 0
let draft = null
let authoring = false

export async function loadMasters(mount) {
  root = mount
  const response = await fetch('curriculum/masters_library.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`masters ${response.status}`)
  library = await response.json()
  await refreshAuthored()
}

export function isMastersMode() {
  return view !== 'closed'
}

export function closeMasters() {
  view = 'closed'
  leaveLine()
  document.querySelector('.shell')?.classList.remove('masters-on')
}

export function openMasters(turnApi, nextHooks = {}) {
  api = turnApi
  hooks = nextHooks || {}
  if (!library) {
    setStatusSafe(t('masters.loadError'))
    return
  }
  showGallery()
}

export function refreshMasters() {
  if (view === 'gallery') showGallery()
  else if (view === 'profile' && currentId) showProfile(currentId)
  else if (view === 'play' && currentId && lessonId) playLesson(currentId, lessonId)
}

function showGallery() {
  leaveLine()
  view = 'gallery'
  document.querySelector('.shell')?.classList.add('masters-on')
  root.replaceChildren(renderGallery())
}

function showProfile(id) {
  const master = findMaster(id)
  if (!master) return showGallery()
  leaveLine()
  currentId = id
  view = 'profile'
  document.querySelector('.shell')?.classList.add('masters-on')
  root.replaceChildren(renderProfile(master))
}

function renderGallery() {
  const page = document.createElement('div')
  page.className = 'masters-page'
  const head = document.createElement('header')
  head.className = 'masters-head'
  const title = document.createElement('h2')
  title.textContent = t('modeTitle.learn')
  const lead = document.createElement('p')
  lead.textContent = t('blurb.learn')
  head.append(title, lead, renderFilters())
  const shelves = document.createElement('div')
  shelves.className = 'master-shelves'
  for (const category of visibleCategories()) shelves.append(renderShelf(category))
  page.append(head, shelves)
  return page
}

function renderShelf(category) {
  const section = document.createElement('section')
  section.className = 'master-shelf'
  const heading = document.createElement('h3')
  heading.textContent = shelfTitle(category)
  section.append(heading)
  if (category.summary) {
    const note = document.createElement('p')
    note.className = 'shelf-lead'
    note.textContent = tx(category.summary)
    section.append(note)
  }
  if (category.id === 'continente') {
    for (const continent of library.continents || []) {
      const group = mastersIn(category).filter((master) => master.continent === continent.id)
      if (!group.length) continue
      const block = document.createElement('div')
      block.className = 'continent-block'
      const name = document.createElement('h4')
      name.textContent = tx(continent.title)
      const grid = document.createElement('div')
      grid.className = 'master-grid'
      for (const master of group) grid.append(renderCard(master))
      block.append(name, grid)
      section.append(block)
    }
    return section
  }
  const grid = document.createElement('div')
  grid.className = 'master-grid'
  for (const master of mastersIn(category)) grid.append(renderCard(master))
  section.append(grid)
  return section
}

function renderFilters() {
  const row = document.createElement('div')
  row.className = 'master-filters'
  row.append(filterButton('all', t('masters.all')))
  for (const category of library.categories || []) {
    row.append(filterButton(category.id, shelfTitle(category)))
  }
  return row
}

function shelfTitle(category) {
  return `${category.emoji || ''} ${tx(category.title)}`.trim()
}

function filterButton(id, label) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `master-filter${filter === id ? ' active' : ''}`
  button.textContent = label
  button.addEventListener('click', () => {
    filter = id
    showGallery()
  })
  return button
}

function renderCard(master) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'master-card'
  const done = doneCount(master)
  const total = (master.interactiveExercises || []).length
  if (done === total && total) button.classList.add('complete')
  button.append(avatar(master), nameBlock(master), progressRow(done, total))
  button.addEventListener('click', () => showProfile(master.masterId))
  return button
}

function renderProfile(master) {
  const page = document.createElement('div')
  page.className = 'masters-page'
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'master-back'
  back.textContent = t('masters.back')
  back.addEventListener('click', showGallery)
  const hero = document.createElement('div')
  hero.className = 'master-hero'
  hero.append(avatar(master), nameBlock(master))
  page.append(back, hero, fact(t('masters.bio'), tx(master.biographyShort)), fact(t('masters.style'), tx(master.playingStyle)), fact(t('masters.signature'), tx(master.signatureMovePattern)), fact(t('masters.quote'), tx(master.quote)))
  const label = document.createElement('h3')
  label.textContent = t('masters.exercises')
  const list = document.createElement('div')
  list.className = 'master-lessons'
  const finished = new Set(readProgress()[master.masterId] || [])
  for (const exercise of master.interactiveExercises || []) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'master-lesson'
    if (finished.has(exercise.lessonId)) item.classList.add('complete')
    const name = document.createElement('strong')
    name.textContent = tx(exercise.title)
    const play = document.createElement('span')
    play.textContent = t('masters.play', { name: master.name })
    item.append(name, play)
    item.addEventListener('click', () => playLesson(master.masterId, exercise.lessonId))
    list.append(item)
    if (exercise.authored && hooks.isTeacher?.()) list.append(removeButton(exercise.lessonId))
  }
  page.append(label, list)
  if (hooks.isTeacher?.()) page.append(authorForm(master))
  return page
}

function playLesson(masterKey, id) {
  const master = findMaster(masterKey)
  const exercise = master?.interactiveExercises?.find((item) => item.lessonId === id)
  if (!master || !exercise || !api) return
  if (Array.isArray(exercise.moves) && exercise.moves.length) {
    playLine(master, exercise)
    return
  }
  showBoardComment('')
  currentId = masterKey
  lessonId = id
  view = 'play'
  document.querySelector('.shell')?.classList.remove('masters-on')
  hooks.prepare?.()
  const fen = exercise.fen
  const squares = squaresOf(exercise)
  api.badge(master.name)
  api.title(tx(exercise.title))
  api.silence()
  api.clearResult()
  api.show(fen, tx(exercise.question))
  api.actions([{ label: t('masters.back'), onClick: () => showProfile(master.masterId) }])
  api.listen((square) => {
    if (exercise.traps && exercise.traps[square]) {
      api.status(tx(exercise.traps[square]))
      return
    }
    if (!squares.includes(square)) {
      api.status(t('masters.miss'))
      return
    }
    const san = exercise.correctMove
    try {
      if (san) api.show(play(fen, san), tx(exercise.goldenRule))
      else api.prompt(tx(exercise.goldenRule))
    } catch (error) {
      api.status(error.message)
      return
    }
    markDone(master.masterId, exercise.lessonId)
    api.silence()
    api.verdict(true, tx(exercise.goldenRule))
    api.actions([
      { label: t('masters.back'), onClick: () => showProfile(master.masterId) },
      { label: t('masters.again'), onClick: () => playLesson(master.masterId, exercise.lessonId) },
    ])
  }, { click: true })
}

function leaveLine() {
  lineEpoch += 1
  clearTimeout(replyTimer)
  replyTimer = 0
  const prev = document.querySelector('#master-prev')
  const next = document.querySelector('#master-next')
  const edit = document.querySelector('#master-edit')
  const form = document.querySelector('#master-comment-form')
  if (prev) prev.onclick = null
  if (next) next.onclick = null
  if (edit) edit.onclick = null
  if (form) {
    form.onsubmit = null
    form.hidden = true
  }
  document.querySelector('#master-comment')?.classList.remove('is-editing')
  showBoardComment('')
}

function stepSan(step) {
  if (typeof step === 'string') return step
  return step?.san || step?.move || ''
}

function stepComment(step) {
  if (!step || typeof step === 'string') return ''
  return tx(step.comment || step.note || '')
}

function readNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(NOTES) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function savedNote(id, key) {
  const bag = readNotes()[id]
  const note = bag && bag[key]
  return note && typeof note === 'object' ? note : null
}

function commentFor(exercise, index) {
  const saved = savedNote(exercise.lessonId, String(index))
  if (saved && Object.prototype.hasOwnProperty.call(saved, lang())) return String(saved[lang()] || '')
  return stepComment(exercise.moves[index])
}

function conclusionFor(exercise) {
  const saved = savedNote(exercise.lessonId, 'end')
  if (saved && Object.prototype.hasOwnProperty.call(saved, lang())) return String(saved[lang()] || '')
  return tx(exercise.goldenRule) || ''
}

function writeNote(id, key, text, base) {
  const all = readNotes()
  const bag = { ...(all[id] || {}) }
  const prev = bag[key] && typeof bag[key] === 'object' ? bag[key] : {}
  const catalog = base && typeof base === 'object' ? base : {}
  const merged = { ...catalog, ...prev }
  const value = String(text || '').trim()
  if (value) merged[lang()] = value
  else delete merged[lang()]
  if (Object.keys(merged).length) bag[key] = merged
  else delete bag[key]
  if (Object.keys(bag).length) all[id] = bag
  else delete all[id]
  localStorage.setItem(NOTES, JSON.stringify(all))
}

function showBoardComment(text) {
  const box = document.querySelector('#master-comment')
  const node = document.querySelector('#master-comment-text')
  if (!box || !node) return
  const value = String(text || '').trim()
  node.textContent = value
  box.hidden = !value
}

function sideOf(fen) {
  return String(fen || '').trim().split(/\s+/)[1] === 'b' ? 'b' : 'w'
}

function blankDraft(masterId) {
  return { masterId, title: '', fen: '', move: '', pgn: '', learner: 'w' }
}

function currentDraft(masterId) {
  if (!draft || draft.masterId !== masterId) draft = blankDraft(masterId)
  return draft
}

function noteLine(form, text) {
  const note = form.querySelector('.master-note')
  if (note) note.textContent = text || ''
}

function fieldValue(form, name) {
  return form.querySelector(`[name="${name}"]`)?.value || ''
}

function rememberDraft(masterId, form) {
  draft = {
    masterId,
    title: fieldValue(form, 'title').trim(),
    fen: fieldValue(form, 'fen').trim(),
    move: fieldValue(form, 'move').trim(),
    pgn: fieldValue(form, 'pgn').trim(),
    learner: fieldValue(form, 'learner') === 'b' ? 'b' : 'w',
  }
}

function legalFen(fen) {
  try {
    const chess = new Chess(fen)
    return chess.fen()
  } catch {
    return ''
  }
}

function destinationSquare(fen, san) {
  try {
    const played = new Chess(fen).move(san)
    return played?.to || ''
  } catch {
    return ''
  }
}

function openBoard(fen, prompt, masterId) {
  view = 'play'
  document.querySelector('.shell')?.classList.remove('masters-on')
  hooks.prepare?.()
  api.silence()
  api.clearResult()
  api.badge('')
  api.title(t('masters.addTitle'))
  api.show(fen, prompt)
  api.actions([{ label: t('masters.previewBack'), onClick: () => showProfile(masterId) }])
}

function authorForm(master) {
  const form = document.createElement('form')
  form.className = 'master-author'
  form.addEventListener('submit', (event) => event.preventDefault())
  const current = currentDraft(master.masterId)
  form.innerHTML = `
    <h3>${t('masters.addTitle')}</h3>
    <label>${t('masters.cardTitle')} <input name="title" spellcheck="false" value="${escapeAttr(current.title)}"></label>
    <label>${t('masters.fen')} <textarea name="fen" rows="2" spellcheck="false">${escapeText(current.fen)}</textarea></label>
    <label>${t('masters.move')} <input name="move" spellcheck="false" value="${escapeAttr(current.move)}"></label>
    <label>${t('masters.pgn')} <textarea name="pgn" rows="4" spellcheck="false">${escapeText(current.pgn)}</textarea></label>
    <label>${t('masters.learner')}
      <select name="learner">
        <option value="w"${current.learner === 'b' ? '' : ' selected'}>${t('masters.white')}</option>
        <option value="b"${current.learner === 'b' ? ' selected' : ''}>${t('masters.black')}</option>
      </select>
    </label>
    <p class="master-note"></p>
    <div class="master-author-actions">
      <button type="button" data-act="fen">${t('masters.loadFen')}</button>
      <button type="button" data-act="pgn">${t('masters.importPgn')}</button>
      <button type="button" data-act="save">${t('masters.save')}</button>
    </div>
  `
  form.addEventListener('input', () => rememberDraft(master.masterId, form))
  form.querySelector('[data-act="fen"]').addEventListener('click', () => loadFen(master.masterId, form))
  form.querySelector('[data-act="pgn"]').addEventListener('click', () => importPgn(master.masterId, form))
  form.querySelector('[data-act="save"]').addEventListener('click', () => { void saveCard(master.masterId, form) })
  return form
}

function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function escapeText(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function loadFen(masterId, form) {
  rememberDraft(masterId, form)
  const fen = legalFen(draft.fen)
  if (!fen) {
    noteLine(form, t('masters.needFen'))
    return
  }
  draft.fen = fen
  draft.learner = sideOf(fen)
  const select = form.querySelector('[name="learner"]')
  if (select) select.value = draft.learner
  noteLine(form, '')
  openBoard(fen, draft.title || t('masters.yourMove'), masterId)
}

function importPgn(masterId, form) {
  rememberDraft(masterId, form)
  const game = readPgnGame(Chess, draft.pgn)
  if (!game.ok) {
    noteLine(form, t('masters.badPgn'))
    return
  }
  draft.fen = game.startFen
  draft.move = game.san[0] || ''
  if (!draft.title) {
    const white = game.headers?.White || ''
    const black = game.headers?.Black || ''
    draft.title = [white, black].filter(Boolean).join(' – ')
  }
  const fenField = form.querySelector('[name="fen"]')
  const moveField = form.querySelector('[name="move"]')
  const titleField = form.querySelector('[name="title"]')
  if (fenField) fenField.value = draft.fen
  if (moveField) moveField.value = draft.move
  if (titleField && !titleField.value.trim()) titleField.value = draft.title
  noteLine(form, t('masters.pgnReady', { n: game.san.length }))
  openBoard(draft.fen, draft.title || t('masters.yourMove'), masterId)
}

function cardFromForm(masterId, form) {
  rememberDraft(masterId, form)
  if (!draft.title) throw new Error(t('masters.needTitle'))
  if (draft.pgn) {
    const game = readPgnGame(Chess, draft.pgn)
    if (!game.ok) throw new Error(t('masters.badPgn'))
    return {
      masterId,
      title: draft.title,
      fen: game.startFen,
      moves: game.san,
      correctMove: game.san[0] || '',
      learner: draft.learner,
      pgn: draft.pgn,
      question: t('masters.yourMove'),
      goldenRule: t('masters.lineDone'),
    }
  }
  const fen = legalFen(draft.fen)
  if (!fen) throw new Error(t('masters.needFen'))
  if (!draft.move) throw new Error(t('masters.needMove'))
  if (!destinationSquare(fen, draft.move)) throw new Error(t('masters.badMove'))
  return {
    masterId,
    title: draft.title,
    fen,
    moves: [draft.move],
    correctMove: draft.move,
    learner: sideOf(fen),
    pgn: '',
    question: t('masters.yourMove'),
    goldenRule: t('masters.diagramDone', { move: draft.move }),
  }
}

async function saveCard(masterId, form) {
  if (authoring) return
  let body
  try {
    body = cardFromForm(masterId, form)
  } catch (err) {
    noteLine(form, err instanceof Error ? err.message : t('masters.fileFail'))
    return
  }
  if (!hooks.saveExercise) {
    noteLine(form, t('masters.fileFail'))
    return
  }
  authoring = true
  try {
    const saved = await hooks.saveExercise(body)
    if (!saved?.exercise?.id) throw new Error(t('masters.fileFail'))
    authored = Array.isArray(saved.exercises) ? saved.exercises : authored.concat(saved.exercise)
    graftAuthored()
    draft = blankDraft(masterId)
    showProfile(masterId)
    api?.status?.(t('masters.saved'))
  } catch (err) {
    noteLine(form, err instanceof Error ? err.message : t('masters.fileFail'))
  } finally {
    authoring = false
  }
}

function removeButton(id) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'master-remove'
  button.textContent = t('masters.remove')
  button.addEventListener('click', () => { void removeCard(id) })
  return button
}

async function removeCard(id) {
  if (!hooks.deleteExercise || authoring) return
  authoring = true
  try {
    const saved = await hooks.deleteExercise(id)
    authored = Array.isArray(saved?.exercises) ? saved.exercises : authored.filter((item) => item.id !== id)
    graftAuthored()
    if (currentId) showProfile(currentId)
  } finally {
    authoring = false
  }
}

async function refreshAuthored() {
  try {
    const response = await fetch('/api/masters-authored', { cache: 'no-store' })
    if (!response.ok) throw new Error()
    const data = await response.json()
    authored = Array.isArray(data?.exercises) ? data.exercises : []
  } catch {
    authored = []
  }
  graftAuthored()
}

function graftAuthored() {
  for (const master of library?.masters || []) {
    master.interactiveExercises = (master.interactiveExercises || []).filter((item) => !item.authored)
    for (const item of authored) {
      if (item.masterId !== master.masterId || !item.id || !item.fen || !item.title) continue
      const moves = Array.isArray(item.moves) ? item.moves.filter(Boolean) : []
      master.interactiveExercises.push({
        lessonId: item.id,
        title: item.title,
        fen: item.fen,
        question: item.question || '',
        correctMove: item.correctMove || moves[0] || '',
        moves,
        learner: item.learner === 'b' ? 'b' : 'w',
        goldenRule: item.goldenRule || '',
        authored: true,
      })
    }
  }
}

function playLine(master, exercise) {
  leaveLine()
  const token = lineEpoch
  currentId = master.masterId
  lessonId = exercise.lessonId
  view = 'play'
  document.querySelector('.shell')?.classList.remove('masters-on')
  hooks.prepare?.()
  const line = exercise.moves.slice()
  const learner = exercise.learner === 'b' ? 'b' : 'w'
  let ply = 0
  let greeted = false
  let celebrated = false
  api.badge(master.name)
  api.title(tx(exercise.title))
  api.clearResult()

  const prevBtn = document.querySelector('#master-prev')
  const nextBtn = document.querySelector('#master-next')
  const editBtn = document.querySelector('#master-edit')
  const label = document.querySelector('#master-move-label')
  const form = document.querySelector('#master-comment-form')
  const input = document.querySelector('#master-comment-input')
  const box = document.querySelector('#master-comment')

  function chessAt(index) {
    const chess = new Chess(exercise.fen)
    for (let i = 0; i < index; i += 1) chess.move(stepSan(line[i]))
    return chess
  }

  function moveLabel(index) {
    const san = stepSan(line[index])
    const number = Math.floor(index / 2) + 1
    return index % 2 === 0 ? `${number}. ${san}` : `${number}... ${san}`
  }

  function noteIndex() {
    if (ply <= 0) return 0
    return Math.min(ply, line.length) - 1
  }

  function atEnd() {
    return ply >= line.length
  }

  function libraryActions() {
    return [
      { label: t('masters.back'), onClick: () => showProfile(master.masterId) },
      { label: t('masters.again'), onClick: () => playLesson(master.masterId, exercise.lessonId) },
    ]
  }

  function finish() {
    if (token !== lineEpoch) return
    markDone(master.masterId, exercise.lessonId)
    const text = conclusionFor(exercise) || t('masters.lineDone')
    api.silence()
    api.verdict(true, text)
    api.actions(libraryActions())
  }

  function paint() {
    if (!box) return
    const end = atEnd()
    const text = end ? (conclusionFor(exercise) || t('masters.lineDone')) : commentFor(exercise, noteIndex())
    const node = document.querySelector('#master-comment-text')
    if (node) node.textContent = text
    box.hidden = false
    if (label) label.textContent = ply <= 0 ? t('masters.startPos') : moveLabel(noteIndex())
    if (prevBtn) {
      prevBtn.disabled = ply <= 0
      prevBtn.setAttribute('aria-label', t('masters.stepBack'))
    }
    if (nextBtn) {
      nextBtn.disabled = end
      nextBtn.setAttribute('aria-label', t('masters.stepForward'))
    }
    if (editBtn) editBtn.textContent = t('masters.editNote')
    const save = form?.querySelector('button')
    if (save) save.textContent = t('masters.saveNote')
  }

  function closeEditor() {
    if (form) form.hidden = true
    box?.classList.remove('is-editing')
  }

  function present() {
    if (token !== lineEpoch) return
    const chess = chessAt(Math.min(ply, line.length))
    const end = atEnd()
    paint()
    if (end) {
      const text = conclusionFor(exercise) || t('masters.lineDone')
      api.show(chess.fen(), text)
      if (!celebrated) {
        celebrated = true
        finish()
      }
      return
    }
    if (chess.turn() !== learner) {
      api.show(chess.fen(), t('masters.wait'))
      api.silence()
      api.actions([{ label: t('masters.back'), onClick: () => showProfile(master.masterId) }])
      return
    }
    const target = destinationSquare(chess.fen(), stepSan(line[ply]))
    const prompt = greeted ? t('masters.continue') : (tx(exercise.question) || t('masters.yourMove'))
    greeted = true
    api.silence()
    api.show(chess.fen(), prompt)
    api.actions([{ label: t('masters.back'), onClick: () => showProfile(master.masterId) }])
    api.listen((square) => {
      if (token !== lineEpoch) return
      if (square !== target) {
        api.status(t('masters.miss'))
        return
      }
      go(1)
    }, { click: true })
  }

  function go(delta) {
    if (token !== lineEpoch) return
    const next = Math.max(0, Math.min(line.length, ply + delta))
    if (next === ply) return
    if (ply >= line.length && next < line.length) {
      celebrated = false
      api.dismiss?.()
    }
    ply = next
    closeEditor()
    present()
  }

  function openEditor() {
    if (token !== lineEpoch || !form || !input) return
    const end = atEnd()
    input.value = end ? conclusionFor(exercise) : commentFor(exercise, noteIndex())
    form.hidden = false
    box?.classList.add('is-editing')
    input.focus()
  }

  function saveEditor(event) {
    event.preventDefault()
    if (token !== lineEpoch) return
    const text = input?.value || ''
    if (atEnd()) {
      writeNote(exercise.lessonId, 'end', text, exercise.goldenRule)
    } else {
      const index = noteIndex()
      const step = exercise.moves[index]
      const base = step && typeof step === 'object' ? (step.comment || step.note || {}) : {}
      writeNote(exercise.lessonId, String(index), text, base)
    }
    closeEditor()
    paint()
    if (atEnd()) api.prompt(conclusionFor(exercise) || t('masters.lineDone'))
    api.status(t('masters.noteSaved'))
  }

  if (prevBtn) prevBtn.onclick = () => go(-1)
  if (nextBtn) nextBtn.onclick = () => go(1)
  if (editBtn) editBtn.onclick = openEditor
  if (form) form.onsubmit = saveEditor

  present()
}

function squaresOf(exercise) {
  if (exercise.correctSquares?.length) return exercise.correctSquares
  const match = String(exercise.correctMove || '').match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/)
  return match ? [match[1]] : []
}

function play(fen, san) {
  const chess = new Chess(fen)
  if (!chess.moves().includes(san)) throw new Error(t('status.illegalMove', { move: san }))
  chess.move(san)
  return chess.fen()
}

function visibleCategories() {
  const categories = library?.categories || []
  if (filter === 'all') return categories
  return categories.filter((category) => category.id === filter)
}

function masterCategories(master) {
  if (Array.isArray(master.categories) && master.categories.length) return master.categories
  return master.category ? [master.category] : []
}

function mastersIn(category) {
  const masters = library?.masters || []
  if (category.id === 'continente') return masters.filter((master) => master.continent)
  return masters.filter((master) => masterCategories(master).includes(category.id))
}

function findMaster(id) {
  return (library?.masters || []).find((master) => master.masterId === id)
}

function doneCount(master) {
  const finished = new Set(readProgress()[master.masterId] || [])
  return (master.interactiveExercises || []).filter((item) => finished.has(item.lessonId)).length
}

function readProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function markDone(masterId, id) {
  const data = readProgress()
  const set = new Set(data[masterId] || [])
  set.add(id)
  data[masterId] = [...set]
  localStorage.setItem(STORE, JSON.stringify(data))
}

function avatar(master) {
  const el = document.createElement('div')
  el.className = 'master-avatar'
  el.style.setProperty('--hue', String(hue(master.masterId)))
  el.textContent = initials(master.name)
  el.setAttribute('aria-hidden', 'true')
  return el
}

function nameBlock(master) {
  const block = document.createElement('div')
  const name = document.createElement('strong')
  name.textContent = master.name
  const style = document.createElement('span')
  style.textContent = tx(master.title)
  const play = document.createElement('em')
  play.textContent = tx(master.playingStyle)
  block.append(name, style, play)
  return block
}

function progressRow(done, total) {
  const row = document.createElement('div')
  row.className = 'master-progress'
  const bar = document.createElement('span')
  bar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%'
  const label = document.createElement('small')
  label.textContent = t('masters.progress', { done, total })
  row.append(bar, label)
  return row
}

function fact(label, text) {
  const block = document.createElement('p')
  block.className = 'master-fact'
  const name = document.createElement('strong')
  name.textContent = label
  block.append(name, document.createTextNode(` ${text}`))
  return block
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function hue(id) {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
}

function setStatusSafe(text) {
  const line = document.querySelector('#status')
  if (line) line.textContent = text
}
