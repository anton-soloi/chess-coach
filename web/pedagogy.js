// Wizardul celor 8 pași. Pozițiile vin din lecțiile profesorului (lessonId).
// Competența se validează doar după pragul de la evaluare sau după remediere.

import { lessonTitle, publishProcedure, refreshCurriculum, saveSubchapterSections } from './curriculum.js'
import { t, tx } from './i18n.js'

const STORE = 'chesscoach.competencies'
const PROGRESS = 'chesscoach.levelProgress'
const STEPS = ['learn', 'examples', 'practice', 'reflect', 'evaluation', 'diagnosis', 'remediation', 'validation']

export function pedagogyStep(id) {
  return STEPS.indexOf(id)
}

let mount = null
let level = null
let sub = null
let play = () => {}
let exitToLevels = () => {}
let onStep = () => {}
let step = 0
let unlocked = 0
let reflection = {}
let submitted = false
let open = false
let session = freshSession()
let activeSlot = null
let procedureOpen = false
let procedureNote = ''

const SET_SIZE = 10

function freshSession() {
  return {
    learn: null,
    examples: null,
    practice: null,
    evaluation: null,
    marks: { learn: [], examples: [], practice: [], evaluation: [] },
  }
}

export function isPedagogyOpen() {
  return open
}

export function pedagogySubId() {
  return sub?.id || ''
}

export function pedagogyStepName() {
  return STEPS[step] || ''
}

export function pedagogyEvalVisible(stepName = '') {
  const name = stepName || (open ? STEPS[step] : '')
  if (!sub || !name) return false
  const flag = sub.sections?.showEval?.[name]
  if (typeof flag === 'boolean') return flag
  return name === 'learn' || name === 'examples'
}

export function isProcedureExamples() {
  return open && sub?.id === 'turn-2' && STEPS[step] === 'examples'
}

export function openPedagogy(root, nextLevel, nextSub, hooks, resume = false) {
  mount = root
  play = hooks.play || (() => {})
  exitToLevels = hooks.exit || (() => {})
  onStep = hooks.onStep || (() => {})
  if (!resume || nextSub?.id !== sub?.id) {
    level = nextLevel
    sub = nextSub
    step = Number.isInteger(hooks.startStep) ? hooks.startStep : 0
    unlocked = step
    reflection = {}
    submitted = false
    session = freshSession()
    activeSlot = null
    procedureOpen = false
    procedureNote = ''
  }
  open = true
  document.querySelector('.shell')?.classList.add('levels-on')
  render()
}

export function resumePedagogy() {
  if (!mount || !sub) return
  open = true
  document.querySelector('.shell')?.classList.add('levels-on')
  render()
}

export function refreshPedagogy() {
  if (open) render()
}

export function refreshPreviewCopy() {
  const learn = sections().learn
  if (session.learn?.[0] && learn) copyPreviewFields(session.learn[0], learn)
  for (const kind of ['examples', 'practice', 'evaluation']) {
    const live = rawList(kind)
    for (const item of session[kind] || []) {
      const fresh = live.find((row) => row && item && row.id === item.id)
      if (fresh) copyPreviewFields(item, fresh)
    }
  }
  if (open) render()
}

function copyPreviewFields(item, fresh) {
  item.explanation = fresh.explanation
  item.hint = fresh.hint
  item.what_to_observe = fresh.what_to_observe
  item.correctMove = fresh.correctMove
  item.solutie = Array.isArray(fresh.solutie) ? fresh.solutie.slice() : fresh.solutie
  item.moves = Array.isArray(fresh.moves) ? fresh.moves.slice() : fresh.moves
  item.fen = fresh.fen
  item.diagram_fen = fresh.diagram_fen
  item.pgn = fresh.pgn
  item.orientation = fresh.orientation
  item.annotations = fresh.annotations
  item.difficulty = fresh.difficulty
  item.level = fresh.level
  item.testSolutionMoves = Array.isArray(fresh.testSolutionMoves) ? fresh.testSolutionMoves.slice() : fresh.testSolutionMoves
  item.solutionMoves = Array.isArray(fresh.solutionMoves) ? fresh.solutionMoves.slice() : fresh.solutionMoves
  item.maxAttempts = fresh.maxAttempts
  item.timeLimitSec = fresh.timeLimitSec
  item.scoreWeight = fresh.scoreWeight
}

export function noteSessionResult(correct) {
  if (!activeSlot) return
  const marks = session.marks[activeSlot.kind]
  if (!marks || activeSlot.index >= marks.length) return
  marks[activeSlot.index] = correct ? 'ok' : 'bad'
}

export function hasSessionNext() {
  if (!activeSlot) return false
  const items = itemsOf(activeSlot.kind)
  return activeSlot.index + 1 < items.length
}

export function takeSessionNext() {
  if (!hasSessionNext()) return null
  const kind = activeSlot.kind
  const index = activeSlot.index + 1
  activeSlot = { kind, index }
  return diagramTarget(itemsOf(kind)[index], kind)
}

export function closePedagogy() {
  open = false
}

function sections() {
  return sub?.sections || {}
}

function render() {
  if (!mount || !sub) return
  const page = document.createElement('div')
  page.className = 'levels-page pedagogy'
  const head = document.createElement('header')
  head.className = 'levels-head'
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'master-back'
  back.textContent = t('pedagogy.levels')
  back.addEventListener('click', () => {
    closePedagogy()
    exitToLevels()
  })
  const title = document.createElement('h2')
  title.textContent = tx(sub.title)
  const lead = document.createElement('p')
  lead.textContent = `${tx(level.title)} · ${t(`pedagogy.step.${STEPS[step]}`)}`
  head.append(back, title, lead)
  if (sub.author) {
    const by = document.createElement('p')
    by.textContent = sub.author
    head.append(by)
  }
  page.append(head, stepper(), body(), nav())
  mount.replaceChildren(page)
}

function stepper() {
  const row = document.createElement('div')
  row.className = 'pedagogy-steps'
  STEPS.forEach((id, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `pedagogy-step${index === step ? ' active' : ''}`
    button.disabled = index > unlocked
    button.textContent = `${index + 1}. ${t(`pedagogy.step.${id}`)}`
    button.addEventListener('click', () => {
      commitStep(index)
    })
    row.append(button)
  })
  return row
}

function body() {
  const block = document.createElement('div')
  block.className = 'pedagogy-body'
  const builders = {
    learn: renderLearn,
    examples: renderExamples,
    practice: renderPractice,
    reflect: renderReflect,
    evaluation: renderEvaluation,
    diagnosis: renderDiagnosis,
    remediation: renderRemediation,
    validation: renderValidation,
  }
  block.append(builders[STEPS[step]]())
  return block
}

function renderLearn() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  wrap.append(paragraph(t('pedagogy.learnLead', { title: tx(sub.title) })))
  wrap.append(paragraph(tx(level.summary)))
  wrap.append(listBlock(t('pedagogy.rules'), (sections().learn?.rules || []).map((id) => t(`pedagogy.rule.${id}`))))
  wrap.append(paragraph(`${t('pedagogy.observe')} ${t('pedagogy.observeLead')}`))
  wrap.append(listBlock(t('pedagogy.thinkTitle'), (sections().learn?.how_i_think || []).map((id) => t(`pedagogy.think.${id}`))))
  const term = document.createElement('p')
  term.className = 'pedagogy-vocab'
  const strong = document.createElement('strong')
  strong.textContent = tx(sub.title)
  term.append(strong, document.createTextNode(` — ${tx(level.summary)}`))
  wrap.append(term)
  const learn = sections().learn || {}
  const diagram = learn.diagram_fen
  const lessonId = learn.lessonId
  const marked = (learn.annotations?.arrows || []).length + (learn.annotations?.highlights || []).length > 0
  if (diagram || marked || learn.correctMove || (Array.isArray(learn.moves) && learn.moves.length)) {
    ensureLearn()
    wrap.append(sessionBar('learn'))
    wrap.append(lessonButton({
      fen: diagram,
      pgn: learn.pgn,
      text: [tx(learn.explanation), tx(learn.what_to_observe)].filter(Boolean).join('\n\n'),
      correctMove: learn.correctMove,
      solutie: learn.solutie,
      moves: learn.moves,
      orientation: learn.orientation,
      annotations: learn.annotations,
      audioUrl: learn.audioUrl,
      scriptText: tx(learn.scriptText) || '',
      timeline: learn.timeline,
    }, t('pedagogy.openDiagram'), { kind: 'learn', index: 0 }))
  } else if (lessonId) {
    ensureLearn()
    wrap.append(lessonButton(lessonId, t('pedagogy.openDiagram'), { kind: 'learn', index: 0 }))
  }
  else wrap.append(paragraph(t('pedagogy.waiting')))
  return wrap
}

function renderExamples() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  const examples = ensureExamples()
  wrap.append(paragraph(t('pedagogy.examplesLead')))
  if (procedureNote) wrap.append(paragraph(procedureNote))
  if (sub?.id === 'turn-2') {
    wrap.append(procedurePanel())
    const courses = sections().procedures || []
    if (courses.length) {
      wrap.append(paragraph(t('pedagogy.procedureList')))
      for (const course of courses) wrap.append(procedureCourseRow(course))
    }
  }
  wrap.append(sessionBar('examples'))
  if (!examples.length) wrap.append(paragraph(t('pedagogy.waiting')))
  examples.forEach((example, index) => {
    const caption = tx(example.title) || tx(example.explanation) || tx(example.what_to_observe) || (example.lessonId ? lessonTitle(example.lessonId) : t('editor.customDiagram'))
    const motif = example.motif ? t(`pedagogy.motifs.${example.motif}`) : ''
    wrap.append(taskRow(
      example,
      `${t('pedagogy.example', { n: example.id || index + 1 })}. ${caption}`,
      [motif, tx(example.what_to_observe)].filter((part, index, list) => part && list.indexOf(part) === index).join(' · '),
      { kind: 'examples', index },
    ))
  })
  return wrap
}

function procedurePanel() {
  const wrap = document.createElement('div')
  wrap.className = 'procedure-panel'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pedagogy-go'
  button.textContent = t('pedagogy.addProcedure')
  button.addEventListener('click', () => {
    if (procedureOpen) return
    procedureOpen = true
    procedureNote = ''
    render()
  })
  wrap.append(button)
  if (procedureOpen) wrap.append(procedureForm())
  return wrap
}

function procedureForm() {
  const form = document.createElement('form')
  form.className = 'procedure-form'
  form.addEventListener('submit', (event) => event.preventDefault())
  const title = labeledField('pedagogy.procedureTitle', 'input', 'pedagogy.procedureTitlePh')
  const definition = labeledField('pedagogy.procedureDefinition', 'textarea')
  const method = labeledField('pedagogy.procedureMethod', 'textarea')
  const examples = document.createElement('div')
  examples.className = 'procedure-examples'
  const examplesLabel = document.createElement('span')
  examplesLabel.textContent = t('pedagogy.procedureExamples')
  const addExample = document.createElement('button')
  addExample.type = 'button'
  addExample.textContent = t('pedagogy.procedureAddExample')
  addExample.addEventListener('click', () => examples.append(procedureExampleRow()))
  const error = document.createElement('p')
  error.className = 'procedure-error'
  error.hidden = true
  const actions = document.createElement('div')
  actions.className = 'procedure-actions'
  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'pedagogy-go'
  save.textContent = t('pedagogy.procedureSave')
  save.addEventListener('click', () => storeProcedure({
    title: title.control.value,
    definition: definition.control.value,
    method: method.control.value,
    examples: readProcedureExamples(examples),
  }, error))
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.textContent = t('pedagogy.procedureCancel')
  cancel.addEventListener('click', () => {
    procedureOpen = false
    render()
  })
  actions.append(addExample, save, cancel)
  form.append(title.label, definition.label, method.label, examplesLabel, examples, error, actions)
  return form
}

function procedureExampleRow() {
  const row = document.createElement('div')
  row.className = 'procedure-example'
  const title = labeledField('pedagogy.procedureExampleTitle', 'input')
  const text = labeledField('pedagogy.procedureExampleText', 'textarea')
  title.control.dataset.field = 'title'
  text.control.dataset.field = 'text'
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.textContent = t('pedagogy.procedureRemoveExample')
  remove.addEventListener('click', () => row.remove())
  row.append(title.label, text.label, remove)
  return row
}

function readProcedureExamples(box) {
  return [...box.querySelectorAll('.procedure-example')].map((row) => ({
    title: row.querySelector('[data-field="title"]').value.trim(),
    text: row.querySelector('[data-field="text"]').value.trim(),
  }))
}

function procedureCourseRow(item) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pedagogy-card pedagogy-row'
  const name = document.createElement('strong')
  name.textContent = tx(item.title)
  const meta = document.createElement('span')
  meta.textContent = t('pedagogy.procedureOpen')
  button.append(name, meta)
  button.addEventListener('click', () => play(item.sidebarId))
  return button
}

function labeledField(name, kind, placeholder) {
  const label = document.createElement('label')
  label.className = 'pedagogy-question'
  const span = document.createElement('span')
  span.textContent = t(name)
  const control = document.createElement(kind)
  if (kind === 'textarea') control.rows = 3
  if (placeholder) control.placeholder = t(placeholder)
  label.append(span, control)
  return { label, control }
}

function storeProcedure(values, error) {
  const title = values.title.trim()
  const definition = values.definition.trim()
  const method = values.method.trim()
  const examples = values.examples.filter((item) => item.title || item.text)
  const fail = (key) => {
    error.hidden = false
    error.textContent = t(key)
  }
  if (!procedureName(title)) return fail('pedagogy.procedureNeedTitle')
  if (!definition) return fail('pedagogy.procedureNeedDefinition')
  if (!method) return fail('pedagogy.procedureNeedMethod')
  if (examples.some((item) => !item.title || !item.text)) return fail('pedagogy.procedureNeedExample')
  const text = (value) => ({ ro: value, en: value, fr: value })
  const procedures = sections().procedures || []
  const published = publishProcedure(level.id, sub.id, {
    type: 'procedure',
    title,
    definition: text(definition),
    method: text(method),
    examples: examples.map((item) => ({ title: text(item.title), text: text(item.text) })),
    levelId: level.id,
    subchapterId: sub.id,
  })
  sub.sections = { ...sections(), procedures: [...procedures, published] }
  saveSubchapterSections(level.id, sub.id, sub.sections)
  refreshCurriculum()
  procedureOpen = false
  procedureNote = t('pedagogy.procedureSaved')
  render()
}

function procedureName(title) {
  return String(title || '').replace(/^B\d+\.\s*/i, '').trim()
}

function renderPractice() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  const practice = sections().practice || {}
  const pool = poolOf('practice')
  const exercises = ensureSet('practice')
  wrap.append(paragraph(t('pedagogy.practiceLead', { tries: practice.max_attempts || 3 })))
  wrap.append(paragraph(t('pedagogy.sessionLead', { count: exercises.length, pool: pool.length })))
  wrap.append(sessionBar('practice'))
  wrap.append(regenButton('practice'))
  if (!exercises.length) wrap.append(paragraph(t('pedagogy.waiting')))
  exercises.forEach((exercise, index) => {
    wrap.append(taskRow(
      exercise,
      `${index + 1}. ${tx(exercise.hint) || (exercise.lessonId ? lessonTitle(exercise.lessonId) : t('editor.customDiagram'))}`,
      bandLabel(exercise.difficulty),
      { kind: 'practice', index },
    ))
  })
  return wrap
}

function renderReflect() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  wrap.append(paragraph(t('pedagogy.reflectLead')))
  for (const id of sections().self_reflection?.questions || []) {
    const label = document.createElement('label')
    label.className = 'pedagogy-question'
    const span = document.createElement('span')
    span.textContent = t(`pedagogy.q.${id}`)
    const input = document.createElement('textarea')
    input.rows = 2
    input.value = reflection[id] || ''
    input.addEventListener('input', () => {
      reflection[id] = input.value
      const next = document.querySelector('.pedagogy-nav .pedagogy-go')
      if (next && STEPS[step] === 'reflect') next.disabled = !canLeave()
    })
    label.append(span, input)
    wrap.append(label)
  }
  return wrap
}

function renderEvaluation() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  const pool = poolOf('evaluation')
  const tests = ensureSet('evaluation')
  const line = sessionScore()
  wrap.append(paragraph(t('pedagogy.evalLead', { pass: line.pass, total: line.total })))
  wrap.append(paragraph(t('pedagogy.sessionLead', { count: tests.length, pool: pool.length })))
  wrap.append(sessionBar('evaluation'))
  wrap.append(regenButton('evaluation'))
  if (!tests.length) wrap.append(paragraph(t('pedagogy.waiting')))
  tests.forEach((test, index) => {
    wrap.append(taskRow(
      test,
      `${index + 1}. ${tx(test.explanation) || (test.lessonId ? lessonTitle(test.lessonId) : t('editor.customDiagram'))}`,
      bandLabel(test.level || test.difficulty),
      { kind: 'evaluation', index },
    ))
  })
  const score = document.createElement('p')
  score.textContent = t('pedagogy.scoreNow', { score: line.score, total: line.total, pass: line.pass })
  wrap.append(score)
  return wrap
}

function renderDiagnosis() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  const { score, total, pass, failed } = sessionScore()
  let text = t('pedagogy.diagnosisEmpty')
  if (total && score >= pass) text = t('pedagogy.diagnosisPass', { score, total })
  else if (total && score === 0) text = t('pedagogy.diagnosisNone', { total })
  else if (total) text = t('pedagogy.diagnosisPartial', { score, total, names: failed.map((id) => lessonTitle(id)).join(', ') })
  wrap.append(paragraph(text))
  wrap.append(paragraph(t('pedagogy.diagnosisNote')))
  return wrap
}

function renderRemediation() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  const { score, pass, failed } = sessionScore()
  if (!submitted) {
    wrap.append(paragraph(t('pedagogy.remediationLater')))
    return wrap
  }
  if (score >= pass) {
    wrap.append(paragraph(t('pedagogy.remediationSkip')))
    return wrap
  }
  wrap.append(paragraph(t('pedagogy.remediationLead')))
  const extra = sections().remediation?.reserve || []
  const ids = [...failed, ...extra].slice(0, 4)
  if (!ids.length) wrap.append(paragraph(t('pedagogy.waiting')))
  for (const id of ids) wrap.append(taskRow(id, lessonTitle(id), t('pedagogy.remediationTag')))
  return wrap
}

function renderValidation() {
  const wrap = document.createElement('div')
  wrap.className = 'pedagogy-stack'
  const record = competencies()[sub.id]
  const ready = canValidate()
  if (record?.status === 'validated') {
    wrap.append(paragraph(t('pedagogy.validatedOn', { date: formatDate(record.validatedAt), next: formatDate(record.nextReview) })))
    wrap.append(paragraph(t('pedagogy.tags', { tags: (record.tags || []).join(', ') })))
    return wrap
  }
  wrap.append(paragraph(ready ? t('pedagogy.ready') : t('pedagogy.notReady')))
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pedagogy-go'
  button.disabled = !ready
  button.textContent = t('pedagogy.validate')
  button.addEventListener('click', () => {
    saveCompetency()
    render()
  })
  wrap.append(button)
  return wrap
}

function nav() {
  const row = document.createElement('div')
  row.className = 'pedagogy-nav'
  const previous = document.createElement('button')
  previous.type = 'button'
  previous.textContent = t('pedagogy.previous')
  previous.disabled = step === 0
  previous.addEventListener('click', () => {
    commitStep(step - 1)
  })
  const next = document.createElement('button')
  next.type = 'button'
  next.className = 'pedagogy-go'
  next.textContent = step === STEPS.length - 1 ? t('pedagogy.stay') : t('pedagogy.next')
  next.disabled = step === STEPS.length - 1 || !canLeave()
  next.addEventListener('click', () => {
    if (STEPS[step] === 'evaluation') submitted = true
    unlocked = Math.max(unlocked, step + 1)
    commitStep(step + 1)
  })
  row.append(previous, next)
  return row
}

function commitStep(next) {
  step = next
  onStep(step)
  render()
}

function canLeave() {
  if (STEPS[step] !== 'reflect') return true
  return (sections().self_reflection?.questions || []).every((id) => String(reflection[id] || '').trim())
}

function canValidate() {
  const tests = ensureSet('evaluation')
  if (!tests.length || !submitted) return false
  const { score, pass, failed } = sessionScore()
  if (score >= pass) return true
  const done = new Set(readDone())
  const extra = sections().remediation?.reserve || []
  const ids = [...failed, ...extra].slice(0, 4)
  return ids.length > 0 && ids.every((id) => done.has(id))
}

function playable(item) {
  if (!item || (item.subchapterId && item.subchapterId !== sub.id)) return false
  if (item.lessonId || String(item.correctMove || '').trim() || (Array.isArray(item.moves) && item.moves.length) || (Array.isArray(item.solutie) && item.solutie.length) || (Array.isArray(item.solutionMoves) && item.solutionMoves.length) || (Array.isArray(item.testSolutionMoves) && item.testSolutionMoves.length)) return true
  const fen = String(item.fen || item.diagram_fen || '').trim()
  return Boolean(fen) && !fen.startsWith('8/8/8/8/8/8/8/8')
}

function rawList(kind) {
  if (kind === 'examples') return sections().examples || []
  if (kind === 'practice') return sections().practice?.exercises || []
  if (kind === 'evaluation') return sections().evaluation?.tests || []
  return []
}

function poolOf(kind) {
  return rawList(kind).filter(playable)
}

function ensureLearn() {
  if (!session.learn) {
    const learn = sections().learn || {}
    const item = learn.diagram_fen || learn.correctMove || (Array.isArray(learn.moves) && learn.moves.length) || learn.lessonId ? [learn] : []
    session.learn = item
    session.marks.learn = item.map(() => 'open')
  }
  return session.learn
}

function ensureExamples() {
  if (!session.examples) {
    session.examples = (sections().examples || []).filter(playable)
    session.marks.examples = session.examples.map(() => 'open')
  }
  return session.examples
}

const STEP_OF = { learn: 0, examples: 1, practice: 2, evaluation: 4 }

export function focusSavedExercise(root, nextLevel, nextSub, hooks, sectionId, itemIndex) {
  mount = root
  play = hooks.play || (() => {})
  exitToLevels = hooks.exit || (() => {})
  onStep = hooks.onStep || (() => {})
  level = nextLevel
  sub = nextSub
  step = STEP_OF[sectionId] ?? 0
  unlocked = step
  reflection = {}
  submitted = false
  session = freshSession()
  activeSlot = null
  const kind = sectionId === 'learn' || sectionId === 'examples' || sectionId === 'evaluation' ? sectionId : 'practice'
  const index = pinSaved(kind, itemIndex)
  if (index >= 0) activeSlot = { kind, index }
  open = true
  document.querySelector('.shell')?.classList.add('levels-on')
  render()
  if (index < 0) return null
  return diagramTarget(itemsOf(kind)[index], kind)
}

function itemsOf(kind) {
  if (kind === 'learn') return ensureLearn()
  if (kind === 'examples') return ensureExamples()
  return ensureSet(kind)
}

function pinSaved(kind, itemIndex) {
  if (kind === 'learn') return ensureLearn().length ? 0 : -1
  const wanted = rawList(kind)[itemIndex]
  if (!wanted || !playable(wanted)) return -1
  if (kind === 'examples') return ensureExamples().indexOf(wanted)
  const set = ensureSet(kind)
  let index = set.indexOf(wanted)
  if (index < 0) {
    set.unshift(wanted)
    session.marks[kind].unshift('open')
    if (set.length > SET_SIZE) {
      set.pop()
      session.marks[kind].pop()
    }
    index = 0
  }
  return index
}

function diagramTarget(item, kind) {
  if (!item) return null
  const testLine = Array.isArray(item.testSolutionMoves) ? item.testSolutionMoves.filter(Boolean) : []
  const practiceLine = Array.isArray(item.solutionMoves) ? item.solutionMoves.filter(Boolean) : []
  const solution = kind === 'evaluation' && testLine.length ? testLine : practiceLine
  const hasLine = solution.length || item.correctMove || (Array.isArray(item.solutie) && item.solutie.length) || (Array.isArray(item.moves) && item.moves.length)
  if (item.fen || item.diagram_fen || item.correctMove || solution.length || (Array.isArray(item.moves) && item.moves.length)) {
    const testing = kind === 'evaluation' && Boolean(hasLine)
    const training = kind === 'practice' && Boolean(hasLine)
    return {
      fen: item.fen || item.diagram_fen || '',
      pgn: item.pgn || '',
      text: [tx(item.title), tx(item.explanation) || tx(item.hint), tx(item.what_to_observe)].filter(Boolean).join('\n\n'),
      correctMove: item.correctMove || '',
      solutionMoves: solution.length ? solution.slice() : undefined,
      testSolutionMoves: testLine.length ? testLine.slice() : undefined,
      solutie: Array.isArray(item.solutie) ? item.solutie.slice() : undefined,
      moves: Array.isArray(item.moves) ? item.moves.slice() : undefined,
      orientation: item.orientation,
      annotations: item.annotations,
      training: Boolean(training) && !item.demo,
      testing: Boolean(testing) && !item.demo,
      demo: Boolean(item.demo),
      maxAttempts: Number(item.maxAttempts) || 3,
      timeLimitSec: Number(item.timeLimitSec || item.timeLimitSeconds) || 0,
      scoreWeight: Number(item.scoreWeight || item.weight) || 1,
      audioUrl: item.audioUrl || '',
      scriptText: tx(item.scriptText) || '',
      timeline: Array.isArray(item.timeline) ? item.timeline : undefined,
      stepType: item.stepType === 'practice' ? 'practice' : 'explanation',
      promptText: item.promptText || '',
      targetMove: item.targetMove,
      practiceHint: item.practiceHint,
      feedback: item.feedback,
    }
  }
  return item.lessonId || null
}

function bandLabel(value) {
  if (!value) return ''
  const band = t(`pedagogy.band.${value}`)
  if (band !== `pedagogy.band.${value}`) return band
  const named = t(`pedagogy.difficulty.${value}`)
  return named === `pedagogy.difficulty.${value}` ? '' : named
}

function shuffle(list) {
  const next = list.slice()
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = next[i]
    next[i] = next[j]
    next[j] = swap
  }
  return next
}

function deal(kind) {
  const picked = shuffle(poolOf(kind)).slice(0, SET_SIZE)
  session[kind] = picked
  session.marks[kind] = picked.map(() => 'open')
  if (activeSlot?.kind === kind) activeSlot = null
}

function ensureSet(kind) {
  if (!session[kind]) deal(kind)
  return session[kind]
}

function sessionScore() {
  const items = ensureSet('evaluation')
  const marks = session.marks.evaluation
  let score = 0
  const failed = []
  items.forEach((item, index) => {
    if (marks[index] === 'ok') score += 1
    else if (item.lessonId) failed.push(item.lessonId)
  })
  const bank = poolOf('evaluation')
  const configured = sections().evaluation?.pass_score ?? bank.length
  const pass = Math.min(configured, items.length)
  return { score, total: items.length, pass, failed }
}

function sessionBar(kind) {
  const marks = session.marks[kind] || []
  const row = document.createElement('div')
  row.className = 'session-bars'
  const ok = marks.filter((mark) => mark === 'ok').length
  row.setAttribute('aria-label', t('pedagogy.sessionProgress', { ok, total: marks.length }))
  for (const mark of marks) {
    const cell = document.createElement('span')
    cell.className = `session-bar${mark === 'ok' ? ' ok' : mark === 'bad' ? ' bad' : ''}`
    row.append(cell)
  }
  return row
}

function regenButton(kind) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pedagogy-go'
  button.textContent = t('pedagogy.newSet')
  button.disabled = !poolOf(kind).length
  button.addEventListener('click', () => {
    deal(kind)
    render()
  })
  return button
}

function saveCompetency() {
  const data = competencies()
  const now = Date.now()
  const previous = data[sub.id]
  const interval = previous?.interval ? Math.min(previous.interval * 2, 28) : 3
  data[sub.id] = {
    status: 'validated',
    tags: [level.id, sub.id],
    validatedAt: now,
    nextReview: now + interval * 86400000,
    interval,
  }
  localStorage.setItem(STORE, JSON.stringify(data))
}

function competencies() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export function competencyNote(id) {
  const row = competencies()[id]
  if (!row) return ''
  if (row.nextReview && row.nextReview <= Date.now()) return t('pedagogy.reviewDue')
  if (row.status === 'validated') return t('pedagogy.validated')
  return ''
}

function readDone() {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS) || '{}')
    return Array.isArray(data.done) ? data.done : []
  } catch {
    return []
  }
}

function lessonButton(target, label, slot) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pedagogy-go'
  button.textContent = label
  button.disabled = !target
  button.addEventListener('click', () => {
    if (slot) activeSlot = slot
    play(target)
  })
  return button
}

function taskRow(item, label, tag, slot) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pedagogy-card pedagogy-row'
  const mark = slot ? session.marks[slot.kind]?.[slot.index] : ''
  if (mark === 'ok') button.classList.add('ok')
  if (mark === 'bad') button.classList.add('bad')
  const name = document.createElement('strong')
  name.textContent = label
  const meta = document.createElement('span')
  const solved = mark === 'ok' || (item.lessonId && readDone().includes(item.lessonId))
  meta.textContent = `${tag || ''}${solved ? ` · ${t('pedagogy.solved')}` : ''}`
  button.append(name, meta)
  button.addEventListener('click', () => {
    if (slot) activeSlot = slot
    if (typeof item === 'string') play(item)
    else {
      const target = diagramTarget(item, slot?.kind)
      if (target && typeof target === 'object') play(target)
      else play(item.lessonId)
    }
  })
  return button
}

function paragraph(text) {
  const node = document.createElement('p')
  node.textContent = text
  return node
}

function listBlock(title, items) {
  const wrap = document.createElement('div')
  const heading = document.createElement('h3')
  heading.textContent = title
  const list = document.createElement('ul')
  for (const item of items) {
    const line = document.createElement('li')
    line.textContent = item
    list.append(line)
  }
  wrap.append(heading, list)
  return wrap
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}
