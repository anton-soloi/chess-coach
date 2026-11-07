// Biblioteca „Învățăm de la...” — profiluri de maeștri, separate de lecțiile Rege.
// Datele stau în curriculum/masters_library.json. Progresul stă în localStorage.

import { Chess } from './vendor/chess.js'
import { t, tx } from './i18n.js'

const STORE = 'chesscoach.masters'

let library = null
let root = null
let api = null
let prepare = () => {}
let view = 'closed'
let filter = 'all'
let currentId = null
let lessonId = null

export async function loadMasters(mount) {
  root = mount
  const response = await fetch('curriculum/masters_library.json')
  if (!response.ok) throw new Error(`masters ${response.status}`)
  library = await response.json()
}

export function isMastersMode() {
  return view !== 'closed'
}

export function closeMasters() {
  view = 'closed'
  document.querySelector('.shell')?.classList.remove('masters-on')
}

export function openMasters(turnApi, hooks = {}) {
  api = turnApi
  prepare = hooks.prepare || (() => {})
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
  view = 'gallery'
  document.querySelector('.shell')?.classList.add('masters-on')
  root.replaceChildren(renderGallery())
}

function showProfile(id) {
  const master = findMaster(id)
  if (!master) return showGallery()
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
  }
  page.append(label, list)
  return page
}

function playLesson(masterKey, id) {
  const master = findMaster(masterKey)
  const exercise = master?.interactiveExercises?.find((item) => item.lessonId === id)
  if (!master || !exercise || !api) return
  currentId = masterKey
  lessonId = id
  view = 'play'
  document.querySelector('.shell')?.classList.remove('masters-on')
  prepare()
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
  })
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
