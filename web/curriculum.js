// Curriculumul se încarcă din curriculum/index.json.
// Un subcapitol sau o partidă nouă în acele fișiere apare în meniu fără alt cod.

import { Chess } from './vendor/chess.js'
import { formatSolution, playTypedMove, solutionMoves } from './notation.js'
import { lang, t, tx } from './i18n.js'

const lessons = new Map()
let packs = []
let levelIndex = []
let activeLevel = null
let expandFirst = false
let rootEl = null
let curriculumStudent = true

export async function loadCurriculum(root) {
  rootEl = root
  const index = await fetchJson('curriculum/index.json')
  const [catalog, ...loaded] = await Promise.all([
    fetchJson('curriculum/curriculum_levels.json'),
    ...index.include.map((file) => fetchJson(`curriculum/${file}`)),
  ])
  levelIndex = catalog.levels || []
  restoreImportedSubchapters()
  applyStoredEdits()
  packs = loaded
  restoreImportedMenu()
  lessons.clear()
  for (const pack of packs) {
    for (const module of pack.modules || []) collect(module)
  }
  restoreProcedures()
  applyMenuThemes()
  refreshCurriculum()
}

const LEGACY_KEY = 'chesscoach.curriculumEdits'

export function exerciseKey(levelId, subId) {
  return `chess_exercises_level_${levelId}_sub_${subId}`
}

export function getLevels() {
  return levelIndex
}

export function themeForLesson(lessonId) {
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      if (sub.id === lessonId || (sub.lessons || []).includes(lessonId)) {
        return { levelId: level.id, subId: sub.id }
      }
      if (sub.sections?.learn?.lessonId === lessonId) {
        return { levelId: level.id, subId: sub.id }
      }
    }
  }
  return null
}

const IMPORT_KEY = 'chesscoach.importedLessons'
const LESSON_ID = /^[A-Za-z0-9_-]{1,80}$/

export function installLessonPack(lesson, sections) {
  const lessonId = String(lesson?.lessonId || '').trim()
  if (!LESSON_ID.test(lessonId)) {
    const error = new Error('bad-id')
    error.code = 'bad-id'
    throw error
  }
  const title = localizeTitle(lesson.title) || localizeTitle(lessonId)
  let place = themeForLesson(lessonId)
  if (!place) {
    const level = hostLevel(lesson.levelId)
    level.subchapters = level.subchapters || []
    level.subchapters.push({
      id: lessonId,
      author: lesson.author || '',
      created_at: lesson.created_at || '',
      title,
      lessons: [lessonId],
      sections: {},
    })
    place = { levelId: level.id, subId: lessonId }
  }
  const level = levelIndex.find((item) => item.id === place.levelId)
  const sub = level?.subchapters?.find((item) => item.id === place.subId)
  if (!sub) return null
  sub.title = title
  if (lesson.author) sub.author = lesson.author
  if (lesson.created_at) sub.created_at = lesson.created_at
  saveSubchapterSections(place.levelId, place.subId, sections)
  rememberImport({
    lessonId,
    levelId: place.levelId,
    title,
    author: sub.author || '',
    created_at: sub.created_at || '',
  })
  attachMenuLesson(level, lessonId, title)
  refreshCurriculum()
  return place
}

function hostLevel(preferred) {
  return levelIndex.find((item) => item.id === preferred)
    || levelIndex.find((item) => item.id === activeLevel)
    || levelIndex.find((item) => item.id === 'cal')
    || levelIndex[0]
}

function localizeTitle(value) {
  if (value && typeof value === 'object') {
    const ro = value.ro || value.en || value.fr || ''
    return { ro, en: value.en || ro, fr: value.fr || ro }
  }
  const text = String(value || '').trim()
  if (!text) return null
  return { ro: text, en: text, fr: text }
}

function readImports() {
  try {
    const data = JSON.parse(localStorage.getItem(IMPORT_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function rememberImport(record) {
  const next = readImports().filter((item) => item.lessonId !== record.lessonId)
  next.push(record)
  localStorage.setItem(IMPORT_KEY, JSON.stringify(next))
}

function restoreImportedSubchapters() {
  for (const record of readImports()) {
    if (!record?.lessonId || !LESSON_ID.test(record.lessonId)) continue
    const place = themeForLesson(record.lessonId)
    if (place) {
      const level = levelIndex.find((item) => item.id === place.levelId)
      const sub = level?.subchapters?.find((item) => item.id === place.subId)
      if (!sub) continue
      if (record.title) sub.title = record.title
      if (record.author) sub.author = record.author
      if (record.created_at) sub.created_at = record.created_at
      continue
    }
    const level = hostLevel(record.levelId)
    if (!level) continue
    level.subchapters = level.subchapters || []
    level.subchapters.push({
      id: record.lessonId,
      author: record.author || '',
      created_at: record.created_at || '',
      title: record.title || localizeTitle(record.lessonId),
      lessons: [record.lessonId],
      sections: {},
    })
  }
}

function restoreImportedMenu() {
  for (const record of readImports()) {
    if (!record?.lessonId) continue
    const place = themeForLesson(record.lessonId)
    const level = levelIndex.find((item) => item.id === (place?.levelId || record.levelId))
    if (!level) continue
    attachMenuLesson(level, record.lessonId, record.title || localizeTitle(record.lessonId))
  }
}

function attachMenuLesson(level, lessonId, title) {
  const moduleId = (level?.modules || [])[0]
  if (!moduleId) return
  for (const pack of packs) {
    for (const module of pack.modules || []) {
      if (module.moduleId !== moduleId) continue
      const menu = (module.subchapters || [])[0]
      if (!menu) continue
      menu.lessons = menu.lessons || []
      let lesson = menu.lessons.find((item) => item.id === lessonId)
      if (!lesson) {
        lesson = { id: lessonId, title, engine: 'app' }
        menu.lessons.push(lesson)
      } else if (title) lesson.title = title
      lessons.set(lessonId, lesson)
    }
  }
}

export function saveSubchapterSections(levelId, subId, sections) {
  const level = levelIndex.find((item) => item.id === levelId)
  const sub = level?.subchapters?.find((item) => item.id === subId)
  if (!level || !sub) return null
  const clean = isolate(levelId, subId, sections)
  sub.sections = clean
  const record = {
    levelId,
    subchapterId: subId,
    updatedAt: Date.now(),
    sections: clean,
  }
  localStorage.setItem(exerciseKey(levelId, subId), JSON.stringify(record))
  return record
}

export function exportThemeBackup() {
  const themes = []
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      const record = readTheme(level.id, sub.id)
      if (record) themes.push(record)
    }
  }
  const menu = readMenuStore()
  return JSON.stringify({
    kind: 'chesscoach-themes',
    version: 1,
    themes,
    menu: {
      themes: menu.themes || [],
      parents: menu.parents || {},
      subTopics: menu.subTopics || {},
    },
  }, null, 2)
}

export function importThemeBackup(text) {
  const data = JSON.parse(text)
  if (data?.kind !== 'chesscoach-themes' || !Array.isArray(data.themes)) {
    throw new Error('bad-backup')
  }
  let count = 0
  for (const theme of data.themes) {
    if (!theme?.sections) continue
    const saved = saveSubchapterSections(theme.levelId, theme.subchapterId, theme.sections)
    if (saved) count += 1
  }
  if (data.menu && typeof data.menu === 'object') {
    const store = readMenuStore()
    const incoming = Array.isArray(data.menu.themes) ? data.menu.themes : []
    const byId = new Map((store.themes || []).map((item) => [item.id, item]))
    for (const theme of incoming) {
      if (!theme?.id) continue
      byId.set(theme.id, { ...(byId.get(theme.id) || {}), ...theme })
    }
    store.themes = [...byId.values()]
    store.parents = { ...(store.parents || {}), ...(data.menu.parents || {}) }
    if (data.menu.subTopics && typeof data.menu.subTopics === 'object') store.subTopics = data.menu.subTopics
    writeThemeGraph(store)
    for (const theme of store.themes || []) installTheme(theme)
    applyParentLinks(store)
    refreshCurriculum()
  }
  return count
}

function readTheme(levelId, subId) {
  try {
    const data = JSON.parse(localStorage.getItem(exerciseKey(levelId, subId)) || 'null')
    if (!data || data.levelId !== levelId || data.subchapterId !== subId || !data.sections) return null
    return {
      levelId,
      subchapterId: subId,
      updatedAt: data.updatedAt || 0,
      sections: isolate(levelId, subId, data.sections),
    }
  } catch {
    return null
  }
}

function applyStoredEdits() {
  migrateLegacy()
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      const record = readTheme(level.id, sub.id)
      if (record) sub.sections = record.sections
    }
  }
}

function migrateLegacy() {
  let legacy = null
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null')
  } catch {
    legacy = null
  }
  if (!legacy || typeof legacy !== 'object') return
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      if (localStorage.getItem(exerciseKey(level.id, sub.id))) continue
      if (legacy[sub.id]) saveSubchapterSections(level.id, sub.id, legacy[sub.id])
    }
  }
  localStorage.removeItem(LEGACY_KEY)
}

function isolate(levelId, subId, sections) {
  const next = JSON.parse(JSON.stringify(sections || {}))
  const keep = (item) => !item?.subchapterId || (item.subchapterId === subId && (!item.levelId || item.levelId === levelId))
  if (Array.isArray(next.examples)) next.examples = next.examples.filter(keep).map((item) => tag(levelId, subId, item))
  if (Array.isArray(next.practice?.exercises)) {
    next.practice.exercises = next.practice.exercises.filter(keep).map((item) => tag(levelId, subId, item))
  }
  if (Array.isArray(next.evaluation?.tests)) {
    next.evaluation.tests = next.evaluation.tests.filter(keep).map((item) => tag(levelId, subId, item))
  }
  return next
}

function tag(levelId, subId, item) {
  return { ...item, levelId, subchapterId: subId }
}

export function currentCurriculumLevel() {
  return activeLevel
}

export function levelForModule(moduleId) {
  if (!moduleId) return null
  return levelIndex.find((level) => (level.modules || []).includes(moduleId)) || null
}

export function setCurriculumLevel(id) {
  activeLevel = id
  expandFirst = true
  refreshCurriculum()
  expandFirst = false
  document.dispatchEvent(new CustomEvent('chesscoach-level', { detail: id }))
}

export function setCurriculumStudent(value) {
  curriculumStudent = Boolean(value)
  refreshCurriculum()
}

export function refreshCurriculum() {
  if (!rootEl) return
  const open = new Set(
    [...rootEl.querySelectorAll('.submenu')].filter((menu) => !menu.hidden).map((menu) => menu.id),
  )
  const active = rootEl.querySelector('.nav-item.active')?.dataset.module
  const firstPaint = rootEl.childElementCount === 0
  rootEl.replaceChildren()
  const currentIds = new Set(currentLevelModuleIds())
  visibleModules().forEach((module, index) => {
    const menuId = `${module.moduleId}-menu`
    const expanded = expandFirst || firstPaint ? index === 0 : open.has(menuId)
    const group = renderModule(module, expanded)
    if (curriculumStudent && currentIds.has(module.moduleId)) group.classList.add('current-level')
    rootEl.append(group)
  })
  if (active) rootEl.querySelector(`[data-module="${active}"]`)?.classList.add('active')
  paintLevelBadge()
}

export function paintLevelBadge() {
  const badge = document.querySelector('#level-badge')
  if (!badge) return
  const chapters = document.querySelector('.sidebar')?.dataset.view === 'chapters'
  const label = curriculumStudent ? activeLevelLabel() : ''
  if (!chapters || !label) {
    badge.hidden = true
    badge.textContent = ''
    return
  }
  badge.hidden = false
  badge.textContent = t('levels.activeBadge', { level: label })
}

function activeLevelLabel() {
  const level = levelIndex.find((item) => item.id === activeLevel)
  if (!level) return ''
  const module = moduleMap().get((level.modules || [])[0])
  return module ? tx(module.title) : tx(level.title)
}

function currentLevelModuleIds() {
  const level = levelIndex.find((item) => item.id === activeLevel)
  return level?.modules || []
}

export function lessonTitle(id) {
  const lesson = lessons.get(id)
  return lesson ? tx(lesson.title) : id
}

export function procedureLesson(id) {
  const lesson = lessons.get(id)
  return lesson?.procedure ? lesson : null
}

export function lessonRecord(id) {
  return lessons.get(id) || null
}

export function publishProcedure(levelId, subId, item) {
  const menu = menuSubchapter(subId)
  const index = nextProcedureIndex(menu?.lessons || [])
  const name = procedureName(item.title)
  const title = `B${index}. ${name}`
  const id = freeProcedureId(menu, index)
  const lesson = {
    id,
    code: `B${index}`,
    title: { ro: title, en: title, fr: title },
    definition: item.definition,
    method: item.method,
    examples: item.examples || [],
    fen: item.fen || '',
    prompt: item.prompt,
    solutie: item.solutie || item.correctMove || '',
    correctMove: item.correctMove || '',
    bad: item.bad,
    ok: item.ok,
    pgn: item.pgn || '',
    procedure: true,
  }
  if (menu) menu.lessons.push(lesson)
  lessons.set(id, lesson)
  return { ...item, title, sidebarId: id, code: `B${index}`, type: 'procedure' }
}

function storedCourseLine(fen, value) {
  const typed = formatSolution(value)
  if (!typed) return ''
  const line = solutionMoves(fen, typed)
  return line.length ? line : typed
}

export function saveProcedureCourse(id, fields, language = lang()) {
  const lesson = lessons.get(id)
  if (!lesson?.procedure) return false
  const definition = writeLocalized(lesson.definition, fields.definition, language)
  const fen = String(fields.fen ?? lesson.fen ?? '').trim()
  lesson.definition = definition
  lesson.fen = fen
  if (fields.prompt != null) lesson.prompt = writeLocalized(lesson.prompt, fields.prompt, language)
  if (fields.bad != null) lesson.bad = writeLocalized(lesson.bad, fields.bad, language)
  if (fields.solutie != null) lesson.solutie = storedCourseLine(fen, fields.solutie)
  if (lesson.custom) {
    saveCustomThemeFields(id, lesson)
    return true
  }
  const located = findProcedureRecord(id)
  if (located) {
    located.item.definition = writeLocalized(located.item.definition, fields.definition, language)
    located.item.fen = fen
    if (fields.prompt != null) located.item.prompt = lesson.prompt
    if (fields.bad != null) located.item.bad = lesson.bad
    if (fields.solutie != null) located.item.solutie = lesson.solutie
    saveSubchapterSections(located.level.id, located.sub.id, located.sub.sections)
    return true
  }
  const owner = findMenuOwner(id)
  if (!owner) return true
  const procedures = owner.sub.sections?.procedures || []
  owner.sub.sections = {
    ...(owner.sub.sections || {}),
    procedures: [...procedures, {
      type: 'procedure',
      title: lesson.title,
      definition,
      method: lesson.method,
      examples: lesson.examples || [],
      fen,
      prompt: lesson.prompt,
      solutie: lesson.solutie || '',
      bad: lesson.bad,
      sidebarId: id,
      code: lesson.code,
      levelId: owner.level.id,
      subchapterId: owner.sub.id,
    }],
  }
  saveSubchapterSections(owner.level.id, owner.sub.id, owner.sub.sections)
  return true
}

function writeLocalized(current, value, language) {
  const text = String(value ?? '')
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    return { ...current, [language]: text }
  }
  const seed = typeof current === 'string' ? current : text
  return { ro: seed, en: seed, fr: seed, [language]: text }
}

function findProcedureRecord(id) {
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      const procedures = sub.sections?.procedures
      if (!Array.isArray(procedures)) continue
      const item = procedures.find((course) => course.sidebarId === id)
      if (item) return { level, sub, item }
    }
  }
  return null
}

function findMenuOwner(id) {
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      const menu = menuSubchapter(sub.id)
      if (menu?.lessons?.some((lesson) => lesson.id === id)) return { level, sub }
    }
  }
  return null
}

export function procedureHome(id) {
  return findProcedureRecord(id) || findMenuOwner(id)
}

export function isDataLesson(id) {
  const lesson = lessons.get(id)
  return Boolean(lesson && !lesson.procedure && !lesson.engine && (lesson.fen || lesson.pgn))
}

export function openDataLesson(id, api) {
  const lesson = lessons.get(id)
  api.badge(lesson.code || id.toUpperCase())
  api.title(tx(lesson.title))
  api.silence()
  api.clearResult()
  openExercise(api, lesson)
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
}

function moduleMap() {
  const all = new Map()
  for (const pack of packs) {
    for (const module of pack.modules || []) all.set(module.moduleId, module)
  }
  return all
}

function visibleModules() {
  const all = moduleMap()
  if (!curriculumStudent) {
    const ids = []
    const seen = new Set()
    for (const level of levelIndex) {
      for (const id of level.modules || []) {
        if (seen.has(id)) continue
        seen.add(id)
        ids.push(id)
      }
    }
    for (const id of all.keys()) {
      if (!seen.has(id)) ids.push(id)
    }
    return ids.map((id) => all.get(id)).filter(Boolean)
  }
  return currentLevelModuleIds().map((id) => all.get(id)).filter(Boolean)
}

function collect(module) {
  for (const sub of module.subchapters || []) {
    for (const lesson of sub.lessons || []) lessons.set(lesson.id, lesson)
  }
}

function menuSubchapter(subId) {
  for (const pack of packs) {
    for (const module of pack.modules || []) {
      const found = (module.subchapters || []).find((sub) => sub.subchapterId === subId || sub.id === subId)
      if (found) return found
    }
  }
  return null
}

const MENU_KEY = 'chesscoach.menu.themes'
const collapsedThemes = new Set()

function readMenuStore() {
  try {
    const data = JSON.parse(localStorage.getItem(MENU_KEY) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function writeMenuStore(data) {
  localStorage.setItem(MENU_KEY, JSON.stringify(data))
}

function hiddenThemeIds() {
  const hidden = readMenuStore().hidden
  return new Set(Array.isArray(hidden) ? hidden : [])
}

function codeFromTitle(text) {
  const match = String(text || '').trim().match(/^([A-Za-z]+\d+)\b/)
  return match ? match[1].toUpperCase() : ''
}

function localizedTitle(text) {
  const value = String(text || '').trim()
  return { ro: value, en: value, fr: value }
}

function eachMenuSubchapter(visit) {
  for (const pack of packs) {
    for (const module of pack.modules || []) {
      for (const sub of module.subchapters || []) visit(module, sub)
    }
  }
}

function sectionOfTheme(id) {
  let found = ''
  eachMenuSubchapter((module, sub) => {
    if (sub.lessons?.some((lesson) => lesson.id === id)) found = sub.subchapterId || sub.id || found
  })
  return found
}

function detachTheme(id) {
  eachMenuSubchapter((_module, sub) => {
    if (!Array.isArray(sub.lessons)) return
    sub.lessons = sub.lessons.filter((lesson) => lesson.id !== id)
  })
}

function installTheme(theme) {
  const menu = menuSubchapter(theme.sectionId)
  let lesson = lessons.get(theme.id)
  const next = {
    id: theme.id,
    code: theme.code || codeFromTitle(tx(theme.title)),
    title: theme.title,
    definition: theme.definition || '',
    fen: theme.fen || '',
    prompt: theme.prompt || '',
    solutie: theme.solutie || '',
    bad: theme.bad || '',
    procedure: true,
    custom: true,
    sectionId: theme.sectionId,
    parentId: theme.parentId || '',
    subTopics: Array.isArray(theme.subTopics) ? theme.subTopics : [],
  }
  if (lesson) Object.assign(lesson, next)
  else {
    lesson = next
    lessons.set(theme.id, lesson)
  }
  if (menu && !menu.lessons.some((item) => item.id === theme.id)) menu.lessons.push(lesson)
}

function applyMenuThemes() {
  const store = readMenuStore()
  const renames = store.renames || {}
  for (const [id, title] of Object.entries(renames)) {
    const lesson = lessons.get(id)
    if (lesson && !lesson.custom) lesson.title = title
  }
  for (const theme of store.themes || []) installTheme(theme)
  applyParentLinks(store)
}

function parentMap(store = readMenuStore()) {
  const parents = {}
  for (const [id, parentId] of Object.entries(store.parents || {})) {
    if (parentId) parents[id] = parentId
  }
  for (const theme of store.themes || []) {
    if (theme.parentId) parents[theme.id] = theme.parentId
    else delete parents[theme.id]
  }
  return parents
}

function writeThemeGraph(store) {
  const parents = parentMap(store)
  const subTopics = {}
  for (const [child, parent] of Object.entries(parents)) {
    if (!parent || parent === child) continue
    if (!subTopics[parent]) subTopics[parent] = []
    subTopics[parent].push(child)
  }
  store.parents = parents
  store.subTopics = subTopics
  for (const theme of store.themes || []) {
    theme.parentId = parents[theme.id] || ''
    theme.subTopics = subTopics[theme.id] || []
  }
  for (const lesson of lessons.values()) {
    if (lesson.custom || Object.prototype.hasOwnProperty.call(parents, lesson.id)) {
      lesson.parentId = parents[lesson.id] || ''
    }
    if (subTopics[lesson.id] || lesson.custom) lesson.subTopics = subTopics[lesson.id] || []
  }
  writeMenuStore(store)
  return store
}

function applyParentLinks(store = readMenuStore()) {
  const parents = parentMap(store)
  const subTopics = store.subTopics || {}
  for (const lesson of lessons.values()) {
    if (lesson.custom || Object.prototype.hasOwnProperty.call(parents, lesson.id)) {
      lesson.parentId = parents[lesson.id] || ''
    }
    if (subTopics[lesson.id]) lesson.subTopics = subTopics[lesson.id]
    else if (lesson.custom) lesson.subTopics = []
  }
}

function descendantIds(id, seen = new Set()) {
  if (!id || seen.has(id)) return []
  seen.add(id)
  const kids = []
  for (const lesson of lessons.values()) {
    if (lesson.parentId === id) kids.push(lesson.id)
  }
  return kids.flatMap((kid) => [kid, ...descendantIds(kid, seen)])
}

function normalizeParent(id, parentId) {
  const parent = String(parentId || '').trim()
  if (!parent || (id && parent === id) || !lessons.has(parent)) return ''
  if (id && descendantIds(id).includes(parent)) return ''
  return parent
}

function sectionForParent(parentId, fallback) {
  if (!parentId) return fallback
  return sectionOfTheme(parentId) || lessons.get(parentId)?.sectionId || fallback
}

function placeTheme(lesson, sectionId) {
  detachTheme(lesson.id)
  lesson.sectionId = sectionId
  const menu = menuSubchapter(sectionId)
  if (menu && !menu.lessons.some((item) => item.id === lesson.id)) menu.lessons.push(lesson)
}

function moveCustomDescendants(store, id, sectionId) {
  for (const childId of descendantIds(id)) {
    const child = lessons.get(childId)
    const theme = (store.themes || []).find((item) => item.id === childId)
    if (!child?.custom || !theme) continue
    theme.sectionId = sectionId
    placeTheme(child, sectionId)
  }
}

function reparentChildren(store, id) {
  const parents = parentMap(store)
  const fallback = parents[id] && parents[id] !== id ? parents[id] : ''
  for (const theme of store.themes || []) {
    if (theme.parentId === id) theme.parentId = fallback
  }
  delete parents[id]
  for (const [child, parent] of Object.entries(parents)) {
    if (parent === id) parents[child] = fallback
  }
  store.parents = parents
}

function saveCustomThemeFields(id, lesson) {
  const store = readMenuStore()
  const theme = (store.themes || []).find((item) => item.id === id)
  if (!theme) return
  theme.title = lesson.title
  theme.code = lesson.code
  theme.definition = lesson.definition
  theme.fen = lesson.fen
  theme.prompt = lesson.prompt
  theme.solutie = lesson.solutie
  theme.bad = lesson.bad
  theme.sectionId = lesson.sectionId
  theme.parentId = lesson.parentId || ''
  writeThemeGraph(store)
}

export function menuSections() {
  return visibleModules().flatMap((module) => (module.subchapters || []).map((sub) => ({
    id: sub.subchapterId || sub.id,
    title: tx(sub.title) || tx(module.title),
  })).filter((section) => section.id))
}

export function menuThemeRecord(id) {
  const lesson = lessons.get(id)
  if (!lesson) return null
  const store = readMenuStore()
  const custom = (store.themes || []).find((item) => item.id === id)
  return {
    id,
    title: tx(lesson.title),
    sectionId: custom?.sectionId || lesson.sectionId || sectionOfTheme(id),
    parentId: lesson.parentId || custom?.parentId || store.parents?.[id] || '',
    custom: Boolean(lesson.custom || custom),
  }
}

export function moduleOfSection(sectionId) {
  if (!sectionId) return null
  for (const pack of packs) {
    for (const module of pack.modules || []) {
      if (module.moduleId === sectionId) return module
      if ((module.subchapters || []).some((sub) => (sub.subchapterId || sub.id) === sectionId)) return module
    }
  }
  return null
}

export function moduleOfTheme(themeId) {
  if (!themeId) return null
  let found = null
  eachMenuSubchapter((module, sub) => {
    if ((sub.lessons || []).some((lesson) => lesson.id === themeId)) found = module
  })
  return found
}

export function menuThemeOptions(sectionId, themeId = '') {
  const module = moduleOfSection(sectionId) || moduleOfTheme(themeId) || moduleOfTheme(sectionId)
  if (!module) return []
  const blocked = new Set([themeId, ...descendantIds(themeId)].filter(Boolean))
  const hidden = hiddenThemeIds()
  const seen = new Set()
  const options = []
  for (const sub of module.subchapters || []) {
    for (const lesson of sub.lessons || []) {
      if (!lesson?.id || seen.has(lesson.id) || blocked.has(lesson.id) || hidden.has(lesson.id)) continue
      seen.add(lesson.id)
      options.push({ id: lesson.id, title: tx(lesson.title) })
    }
  }
  return options
}

export function addMenuTheme({ title, sectionId, parentId = '' }) {
  const text = String(title || '').trim()
  const store = readMenuStore()
  const themes = Array.isArray(store.themes) ? store.themes : []
  const id = `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const nextParent = normalizeParent(id, parentId)
  const theme = {
    id,
    sectionId: sectionForParent(nextParent, sectionId),
    parentId: nextParent,
    subTopics: [],
    title: localizedTitle(text),
    code: codeFromTitle(text),
    definition: '',
    fen: '',
    prompt: '',
    solutie: '',
    bad: '',
  }
  themes.push(theme)
  store.themes = themes
  writeThemeGraph(store)
  installTheme(theme)
  if (nextParent) collapsedThemes.delete(nextParent)
  refreshCurriculum()
  return theme
}

export function updateMenuTheme(id, { title, sectionId, parentId }) {
  const text = String(title || '').trim()
  if (!text) return false
  const lesson = lessons.get(id)
  if (!lesson) return false
  const store = readMenuStore()
  const custom = (store.themes || []).find((item) => item.id === id)
  const localized = localizedTitle(text)
  const nextParent = parentId === undefined ? (lesson.parentId || '') : normalizeParent(id, parentId)
  lesson.title = localized
  lesson.code = codeFromTitle(text) || lesson.code
  lesson.parentId = nextParent
  if (custom) {
    custom.title = localized
    custom.code = lesson.code
    custom.parentId = nextParent
    const nextSection = sectionForParent(nextParent, sectionId || custom.sectionId)
    if (nextSection && nextSection !== (custom.sectionId || lesson.sectionId)) {
      custom.sectionId = nextSection
      placeTheme(lesson, nextSection)
      moveCustomDescendants(store, id, nextSection)
    } else {
      custom.sectionId = nextSection || custom.sectionId
      lesson.sectionId = custom.sectionId
    }
    writeThemeGraph(store)
  } else {
    store.renames = { ...(store.renames || {}), [id]: localized }
    store.parents = { ...(store.parents || {}) }
    if (nextParent) store.parents[id] = nextParent
    else delete store.parents[id]
    writeThemeGraph(store)
  }
  if (nextParent) collapsedThemes.delete(nextParent)
  refreshCurriculum()
  return true
}

export function deleteMenuTheme(id) {
  const store = readMenuStore()
  const custom = (store.themes || []).some((item) => item.id === id)
  reparentChildren(store, id)
  if (custom) {
    store.themes = (store.themes || []).filter((item) => item.id !== id)
    detachTheme(id)
    lessons.delete(id)
  } else {
    const hidden = Array.isArray(store.hidden) ? store.hidden : []
    if (!hidden.includes(id)) hidden.push(id)
    store.hidden = hidden
  }
  collapsedThemes.delete(id)
  writeThemeGraph(store)
  refreshCurriculum()
  return { custom }
}

function procedureName(title) {
  return String(title || '').replace(/^B\d+\.\s*/i, '').trim()
}

function nextProcedureIndex(list) {
  let max = 0
  for (const lesson of list) {
    const title = tx(lesson.title)
    const match = title.match(/^B(\d+)\b/i) || String(lesson.code || '').match(/^B(\d+)/i)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

function freeProcedureId(menu, index) {
  const used = new Set((menu?.lessons || []).map((lesson) => lesson.id))
  const preferred = `tn-b${index}`
  if (!used.has(preferred) && !lessons.has(preferred)) return preferred
  return `tn-proc-${index}-${Date.now()}`
}

function restoreProcedures() {
  for (const level of levelIndex) {
    for (const sub of level.subchapters || []) {
      for (const course of sub.sections?.procedures || []) {
        if (!course?.sidebarId || lessons.has(course.sidebarId)) continue
        const menu = menuSubchapter(sub.id)
        const lesson = {
          id: course.sidebarId,
          code: course.code,
          title: course.title,
          definition: course.definition,
          method: course.method,
          examples: course.examples || [],
          fen: course.fen || '',
          prompt: course.prompt,
          solutie: course.solutie || course.correctMove || '',
          correctMove: course.correctMove || '',
          bad: course.bad,
          ok: course.ok,
          pgn: course.pgn || '',
          procedure: true,
        }
        if (menu && !menu.lessons.some((item) => item.id === lesson.id)) menu.lessons.push(lesson)
        lessons.set(lesson.id, lesson)
      }
    }
  }
}

function squareFromSan(san) {
  const match = String(san || '').match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/)
  return match ? match[1] : ''
}

function squaresOf(exercise) {
  if (exercise.correctSquares?.length) return exercise.correctSquares
  const square = squareFromSan(exercise.correctMove)
  return square ? [square] : []
}

function sanFor(exercise, square) {
  if (exercise.moves && exercise.moves[square]) return exercise.moves[square]
  const mapped = Object.keys(exercise.moves || {}).length
  if (!mapped && exercise.correctMove && squaresOf(exercise).includes(square)) return exercise.correctMove
  return ''
}

function play(fen, san) {
  return playTypedMove(new Chess(fen), san).after
}

function fenOf(lesson) {
  if (lesson.fen) return lesson.fen
  const chess = new Chess()
  chess.loadPgn(lesson.pgn)
  const moves = chess.history()
  const ply = lesson.exercise?.ply
  if (ply == null) return chess.fen()
  const board = new Chess()
  for (let i = 0; i < ply && i < moves.length; i++) board.move(moves[i])
  return board.fen()
}

function grade(api, lesson, ok, text) {
  api.silence()
  api.verdict(ok, text)
  if (!ok) api.actions([{ label: t('task.retry'), onClick: () => openDataLesson(lesson.id, api) }])
}

function ask(api, buttons) {
  api.silence()
  api.actions(buttons)
  api.listen(() => api.status(t('task.choose')))
}

function openReplay(api, lesson, resume) {
  const chess = new Chess()
  chess.loadPgn(lesson.pgn)
  const moves = chess.history()
  const showAt = (index) => {
    const board = new Chess()
    for (let i = 0; i < index; i++) board.move(moves[i])
    api.silence()
    api.show(board.fen(), t('task.replay', { index, total: moves.length }))
    api.actions([
      { label: t('task.back'), onClick: () => showAt(Math.max(0, index - 1)) },
      { label: t('task.forward'), onClick: () => showAt(Math.min(moves.length, index + 1)) },
      { label: t('task.exercise'), onClick: resume },
    ])
  }
  showAt(Number.isInteger(lesson.exercise?.ply) ? lesson.exercise.ply : 0)
}

function openExercise(api, lesson) {
  const exercise = lesson.exercise || {}
  const fen = fenOf(lesson)
  const prompt = tx(exercise.prompt) || tx(lesson.concept) || tx(lesson.title)
  const squares = squaresOf(exercise)
  const choices = exercise.choices || []
  const start = () => {
    api.silence()
    api.clearResult()
    api.show(fen, prompt)
    if (lesson.pgn) api.actions([{ label: t('task.game'), onClick: () => openReplay(api, lesson, start) }])
    if (!squares.length && lesson.pgn) {
      openReplay(api, lesson, start)
      return
    }
    api.listen((square) => {
      if (exercise.traps && exercise.traps[square]) {
        api.status(tx(exercise.traps[square]))
        return
      }
      if (!squares.includes(square)) {
        api.status(tx(exercise.miss) || t('task.miss'))
        return
      }
      const san = sanFor(exercise, square)
      const question = tx(exercise.question) || t('task.question')
      try {
        if (san) api.show(play(fen, san), question)
        else api.prompt(question)
      } catch (error) {
        api.status(error.message)
        return
      }
      if (!choices.length) {
        grade(api, lesson, true, tx(lesson.goldenRule) || tx(exercise.explanation) || t('task.correct'))
        return
      }
      ask(api, choices.map((choice) => ({
        label: tx(choice.label),
        onClick: () => grade(api, lesson, Boolean(choice.correct), tx(choice.explanation) || tx(lesson.goldenRule) || ''),
      })))
    })
  }
  start()
}

function visibleLessons(list) {
  const hidden = hiddenThemeIds()
  return (list || []).filter((lesson) => lesson?.id && !hidden.has(lesson.id))
}

function themeChildren(list) {
  const visible = visibleLessons(list)
  const ids = new Set(visible.map((lesson) => lesson.id))
  const children = new Map()
  for (const lesson of visible) {
    const parentId = lesson.parentId || ''
    if (!parentId || !ids.has(parentId) || parentId === lesson.id) continue
    if (!children.has(parentId)) children.set(parentId, [])
    children.get(parentId).push(lesson)
  }
  return children
}

function themeRoots(list) {
  const visible = visibleLessons(list)
  const ids = new Set(visible.map((lesson) => lesson.id))
  return visible.filter((lesson) => {
    const parentId = lesson.parentId || ''
    return !parentId || !ids.has(parentId) || parentId === lesson.id
  })
}

function renderThemeBranch(lesson, children, depth, host) {
  const kids = children.get(lesson.id) || []
  const row = document.createElement('div')
  row.className = `nav-lesson depth-${Math.min(depth, 4)}`
  let branch = null
  if (kids.length) {
    const fold = document.createElement('button')
    fold.type = 'button'
    fold.className = 'theme-fold'
    const collapsed = collapsedThemes.has(lesson.id)
    fold.textContent = collapsed ? '▸' : '▾'
    fold.setAttribute('aria-expanded', String(!collapsed))
    fold.title = t('pedagogy.themeFold')
    fold.setAttribute('aria-label', t('pedagogy.themeFold'))
    fold.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const next = !collapsedThemes.has(lesson.id)
      if (next) collapsedThemes.add(lesson.id)
      else collapsedThemes.delete(lesson.id)
      if (branch) branch.hidden = next
      fold.textContent = next ? '▸' : '▾'
      fold.setAttribute('aria-expanded', String(!next))
    })
    row.append(fold)
  } else {
    const spacer = document.createElement('span')
    spacer.className = 'theme-fold spacer'
    spacer.setAttribute('aria-hidden', 'true')
    row.append(spacer)
  }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nav-item sub'
  button.dataset.module = lesson.id
  button.textContent = tx(lesson.title)
  const admin = document.createElement('button')
  admin.type = 'button'
  admin.className = 'theme-admin'
  admin.dataset.themeAdmin = lesson.id
  admin.textContent = '✏️'
  admin.title = t('pedagogy.themeAdmin')
  admin.setAttribute('aria-label', t('pedagogy.themeAdmin'))
  const subadd = document.createElement('button')
  subadd.type = 'button'
  subadd.className = 'theme-subadd'
  subadd.dataset.addSubTheme = lesson.id
  subadd.textContent = t('pedagogy.themeSubAdd')
  subadd.title = t('pedagogy.themeSubAdd')
  subadd.setAttribute('aria-label', t('pedagogy.themeSubAdd'))
  row.append(button, admin)
  host.append(row, subadd)
  if (!kids.length) return
  branch = document.createElement('div')
  branch.className = 'theme-children'
  branch.hidden = collapsedThemes.has(lesson.id)
  for (const child of kids) renderThemeBranch(child, children, depth + 1, branch)
  host.append(branch)
}

function renderModule(module, open) {
  const group = document.createElement('div')
  group.className = 'nav-group'
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = `nav-item nav-parent${open ? ' open' : ''}`
  toggle.id = `${module.moduleId}-toggle`
  toggle.dataset.levelModule = module.moduleId
  const menuId = `${module.moduleId}-menu`
  toggle.setAttribute('aria-controls', menuId)
  toggle.setAttribute('aria-expanded', String(open))
  const title = document.createElement('strong')
  title.textContent = tx(module.title)
  const summary = document.createElement('span')
  summary.textContent = tx(module.summary)
  toggle.append(title, summary)
  const menu = document.createElement('div')
  menu.className = 'submenu'
  menu.id = menuId
  menu.hidden = !open
  for (const sub of module.subchapters || []) {
    if (tx(sub.title)) {
      const label = document.createElement('div')
      label.className = 'submenu-label'
      label.textContent = tx(sub.title)
      menu.append(label)
    }
    for (const lesson of themeRoots(sub.lessons || [])) renderThemeBranch(lesson, themeChildren(sub.lessons || []), 0, menu)
    const sectionId = sub.subchapterId || sub.id
    if (sectionId) {
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'theme-add'
      add.dataset.addTheme = sectionId
      add.textContent = t('pedagogy.themeAdd')
      menu.append(add)
    }
  }
  toggle.addEventListener('click', () => {
    const next = menu.hasAttribute('hidden')
    menu.toggleAttribute('hidden', !next)
    toggle.classList.toggle('open', next)
    toggle.setAttribute('aria-expanded', String(next))
  })
  group.append(toggle, menu)
  return group
}
