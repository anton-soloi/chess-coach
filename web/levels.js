// Selectorul „Niveluri de Măiestrie”. Capitolele rămân în curriculum/*.json.
// Un nivel doar indică ce module apar în meniul din stânga.

import { t, tx } from './i18n.js'
import { currentCurriculumLevel, getLevels, setCurriculumLevel } from './curriculum.js'
import { competencyNote } from './pedagogy.js'

const PROGRESS = 'chesscoach.levelProgress'

let root = null
let view = 'closed'
let openId = null
let onOpen = () => {}
let onFocus = () => {}

export function loadLevels(mount) {
  root = mount
}

export function isLevelsMode() {
  return view !== 'closed'
}

export function closeLevels() {
  view = 'closed'
  document.querySelector('.shell')?.classList.remove('levels-on')
}

export function openLevels(hooks = {}) {
  onOpen = hooks.onOpen || (() => {})
  onFocus = hooks.onFocus || (() => {})
  if (Object.prototype.hasOwnProperty.call(hooks, 'focusId')) openId = hooks.focusId || null
  if (!getLevels().length) {
    const line = document.querySelector('#status')
    if (line) line.textContent = t('levels.loadError')
    return
  }
  showSelector()
}

export function refreshLevels() {
  if (view === 'selector') showSelector()
}

function showSelector() {
  view = 'selector'
  document.querySelector('.shell')?.classList.add('levels-on')
  root.replaceChildren(renderSelector())
}

function renderSelector() {
  const page = document.createElement('div')
  page.className = 'levels-page'
  const head = document.createElement('header')
  head.className = 'levels-head'
  const title = document.createElement('h2')
  title.textContent = t('modeTitle.analysis')
  const lead = document.createElement('p')
  lead.textContent = t('blurb.analysis')
  head.append(title, lead)
  const grid = document.createElement('div')
  grid.className = 'level-grid'
  const current = currentCurriculumLevel()
  getLevels().forEach((level, index) => grid.append(renderCard(level, index + 1, level.id === current, openId === level.id)))
  page.append(head, grid)
  return page
}

function renderCard(level, index, current, open) {
  const card = document.createElement('article')
  card.className = `level-card${current ? ' current' : ''}${open ? ' open' : ''}`
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'level-toggle'
  toggle.setAttribute('aria-expanded', String(open))
  const mark = document.createElement('span')
  mark.className = 'level-mark'
  const order = document.createElement('span')
  order.className = 'level-index'
  order.textContent = String(index)
  const icon = document.createElement('span')
  icon.className = 'level-icon'
  icon.textContent = level.icon || ''
  icon.setAttribute('aria-hidden', 'true')
  mark.append(order, icon)
  const copy = document.createElement('span')
  copy.className = 'level-copy'
  const name = document.createElement('strong')
  name.textContent = tx(level.title)
  const summary = document.createElement('span')
  summary.textContent = tx(level.summary)
  copy.append(name, summary)
  const chevron = document.createElement('span')
  chevron.className = 'level-chevron'
  chevron.textContent = open ? '▾' : '▸'
  chevron.setAttribute('aria-hidden', 'true')
  toggle.append(mark, copy, chevron)
  toggle.addEventListener('click', () => {
    openId = open ? null : level.id
    onFocus(openId)
    showSelector()
  })
  const list = document.createElement('div')
  list.className = 'level-subs'
  for (const sub of level.subchapters || []) list.append(renderSubchapter(level, sub))
  card.append(toggle, list)
  return card
}

function renderSubchapter(level, sub) {
  const button = document.createElement('button')
  button.type = 'button'
  const lessons = sub.lessons || []
  const status = subchapterStatus(lessons)
  button.className = `subchapter ${status}`
  const name = document.createElement('strong')
  name.textContent = tx(sub.title)
  const meta = document.createElement('span')
  meta.className = 'subchapter-status'
  const countLabel = lessons.length === 1 ? t('levels.lessonOne') : t('levels.lessons', { count: lessons.length })
  meta.textContent = `${t(`levels.${status}`)} · ${countLabel}`
  button.append(name, meta)
  const note = competencyNote(sub.id)
  if (note) meta.textContent = `${meta.textContent} · ${note}`
  button.addEventListener('click', () => {
    setCurriculumLevel(level.id)
    onOpen(level, sub)
  })
  return button
}

export function markLessonStarted(id) {
  if (!id) return
  const data = readProgress()
  if (!data.started.includes(id)) data.started.push(id)
  writeProgress(data)
}

export function markLessonDone(id) {
  if (!id) return
  const data = readProgress()
  if (!data.started.includes(id)) data.started.push(id)
  if (!data.done.includes(id)) data.done.push(id)
  writeProgress(data)
}

function subchapterStatus(lessons) {
  if (!lessons.length) return 'new'
  const data = readProgress()
  const done = lessons.filter((id) => data.done.includes(id)).length
  const started = lessons.filter((id) => data.started.includes(id) || data.done.includes(id)).length
  if (done === lessons.length) return 'done'
  if (started) return 'active'
  return 'new'
}

function readProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS) || '{}')
    return {
      started: Array.isArray(data.started) ? data.started : [],
      done: Array.isArray(data.done) ? data.done : [],
    }
  } catch {
    return { started: [], done: [] }
  }
}

function writeProgress(data) {
  localStorage.setItem(PROGRESS, JSON.stringify(data))
}
