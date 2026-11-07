// Constructorul de lecție: linie de mutări, PGN, avatar și timeline pentru exportul JSON.

import { Chess } from './vendor/chess.js'
import { t, tx } from './i18n.js'

const STATES = ['idle', 'talking', 'pointing', 'thinking']

let hooks = {}
let mounted = false
let avatarState = 'idle'
let audioUrl = ''
let sans = []
let lineFen = ''
let timeline = []
let armed = true
let touched = false
let transportPlaying = false
let frozen = 0
let clockOrigin = 0
let clockTimer = 0
let previewUrl = ''

export function mountLessonBuilder(nextHooks = {}) {
  hooks = nextHooks
  const root = document.querySelector('#lesson-builder')
  if (!root || mounted) return
  mounted = true
  root.querySelector('.builder-states')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-avatar-state]')
    if (!button) return
    setBuilderAvatar(button.dataset.avatarState)
  })
  root.querySelector('#builder-audio')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0]
    if (file) connectAudioFile(file)
  })
  root.querySelector('#builder-audio-url')?.addEventListener('change', (event) => {
    audioUrl = event.target.value.trim()
    touched = true
  })
  root.querySelector('#builder-script')?.addEventListener('input', () => {
    touched = true
  })
  root.querySelector('#builder-play')?.addEventListener('click', toggleAudio)
  root.querySelector('#builder-record')?.addEventListener('click', toggleArm)
  root.querySelector('#builder-mark')?.addEventListener('click', () => stamp({ avatarState }))
  root.querySelector('#builder-clear')?.addEventListener('click', clearTimeline)
  root.querySelector('#builder-export')?.addEventListener('click', () => hooks.exportLesson?.())
  root.querySelector('#builder-cues')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cue]')
    if (!button) return
    timeline.splice(Number(button.dataset.cue), 1)
    touched = true
    paintCues()
  })
  const audio = lessonAudio()
  audio?.addEventListener('timeupdate', paintClock)
  audio?.addEventListener('pause', () => {
    paintPlay()
    paintClock()
    if (!audio.ended) hooks.status?.(t('builder.pausedAt', { time: currentSeconds().toFixed(1) }))
  })
  audio?.addEventListener('play', () => {
    paintPlay()
    paintClock()
  })
  audio?.addEventListener('ended', paintPlay)
  paintAvatar()
  paintCues()
  paintClock()
  paintArm()
  paintPlay()
}

export function refreshBuilder() {
  paintAvatar()
  paintCues()
  paintPlay()
  paintArm()
  paintClock()
}

export function loadBuilderItem(item) {
  pauseTransport()
  avatarState = 'idle'
  audioUrl = typeof item?.audioUrl === 'string' ? item.audioUrl : ''
  sans = sanList(item)
  lineFen = item?.fen || item?.diagram_fen || hooks.getFen?.() || ''
  timeline = Array.isArray(item?.timeline) ? item.timeline.map((cue) => ({ ...cue })) : []
  touched = false
  const script = document.querySelector('#builder-script')
  const url = document.querySelector('#builder-audio-url')
  if (script) script.value = tx(item?.scriptText)
  if (url) url.value = audioUrl
  paintAvatar()
  paintLine()
  paintCues()
  paintClock()
}

export function resetBuilderLine(fen) {
  lineFen = fen || hooks.getFen?.() || ''
  sans = []
  touched = true
  paintLine()
  hooks.writeLine?.([], '')
}

export function observeBuilderMove({ from, to, before, after }) {
  const result = recordLegalMove(lineFen || before, sans, from, to)
  if (!result.ok) {
    lineFen = after || before
    sans = []
    touched = true
    paintLine()
    hooks.writeLine?.([], '')
    hooks.status?.(t('builder.placed'))
    if (armed) stamp({ avatarState, action: 'move_piece', from, to })
    return false
  }
  lineFen = result.fen
  sans = result.sans
  touched = true
  paintLine()
  hooks.setFen?.(result.after)
  hooks.writeLine?.(sans, result.pgn)
  hooks.status?.(t('builder.recorded', { san: result.san }))
  if (armed) stamp({ avatarState, action: 'move_piece', from: result.uci.from, to: result.uci.to })
  return true
}

export function observeBuilderNote(cue) {
  if (!armed || !cue) return
  stamp({ avatarState, ...cue })
}

export function builderTouched() {
  return touched
}

export function builderSnapshot() {
  const script = document.querySelector('#builder-script')?.value.trim() || ''
  const typed = document.querySelector('#builder-audio-url')?.value.trim() || audioUrl
  return {
    audioUrl: typed,
    scriptText: script,
    timeline: timeline.map((cue) => ({ ...cue })),
    pgn: currentPgn(),
    moveText: sans.join(' '),
  }
}

export function recordLegalMove(fen, line, from, to) {
  let chess
  try {
    chess = new Chess(fen)
  } catch {
    return { ok: false }
  }
  for (const token of line) {
    let played = null
    try {
      played = chess.move(token)
    } catch {
      played = null
    }
    if (!played) return { ok: false }
  }
  const piece = chess.get(from)
  if (!piece) return { ok: false }
  const promotion = piece.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined
  let played = null
  try {
    played = chess.move({ from, to, promotion })
  } catch {
    played = null
  }
  if (!played) return { ok: false }
  return {
    ok: true,
    fen,
    sans: [...line, played.san],
    san: played.san,
    uci: { from: played.from, to: played.to },
    after: chess.fen(),
    pgn: chess.pgn(),
  }
}

export function cueAt(seconds, fields) {
  const cue = { time: Math.round(Math.max(0, Number(seconds) || 0) * 10) / 10 }
  if (STATES.includes(fields.avatarState)) cue.avatarState = fields.avatarState
  if (fields.action === 'highlight' && fields.target) {
    cue.action = 'highlight'
    cue.target = fields.target
  } else if (fields.action === 'draw_arrow' && fields.from && fields.to) {
    cue.action = 'draw_arrow'
    cue.from = fields.from
    cue.to = fields.to
  } else if (fields.action === 'move_piece' && fields.from && fields.to) {
    cue.action = 'move_piece'
    cue.from = fields.from
    cue.to = fields.to
  }
  return cue
}

function setBuilderAvatar(state) {
  if (!STATES.includes(state)) return
  avatarState = state
  touched = true
  paintAvatar()
  hooks.setAvatarState?.(state)
  if (armed) stamp({ avatarState: state })
}

function connectAudioFile(file) {
  const audio = lessonAudio()
  if (previewUrl) URL.revokeObjectURL(previewUrl)
  previewUrl = URL.createObjectURL(file)
  audioUrl = audioPath(file.name)
  touched = true
  const url = document.querySelector('#builder-audio-url')
  if (url) url.value = audioUrl
  if (audio) {
    audio.src = previewUrl
    audio.load()
  }
  hooks.status?.(audioUrl)
}

function toggleAudio() {
  const audio = lessonAudio()
  if (audio && (audio.currentSrc || audioUrl)) {
    if (!audio.currentSrc && audioUrl) audio.src = audioUrl
    if (audio.paused) {
      audio.play()?.catch(() => {
        hooks.status?.(t('builder.audioMissing'))
        startClock()
      })
    } else audio.pause()
    paintPlay()
    return
  }
  if (transportPlaying) pauseTransport()
  else startClock()
}

function toggleArm() {
  armed = !armed
  touched = true
  paintArm()
}

function startClock() {
  transportPlaying = true
  clockOrigin = performance.now()
  clearInterval(clockTimer)
  clockTimer = setInterval(paintClock, 200)
  paintPlay()
  paintClock()
}

function pauseTransport() {
  frozen = currentSeconds()
  transportPlaying = false
  clearInterval(clockTimer)
  clockTimer = 0
  const audio = lessonAudio()
  if (audio && !audio.paused) audio.pause()
  paintPlay()
  paintClock()
}

function clearTimeline() {
  timeline = []
  touched = true
  paintCues()
}

function stamp(fields) {
  const cue = cueAt(currentSeconds(), fields)
  timeline.push(cue)
  timeline.sort((a, b) => a.time - b.time)
  touched = true
  paintCues()
  hooks.status?.(t('builder.marked', { time: cue.time.toFixed(1) }))
}

function currentSeconds() {
  const audio = lessonAudio()
  if (audio?.currentSrc && Number.isFinite(audio.currentTime)) return audio.currentTime
  if (!transportPlaying) return frozen
  return frozen + Math.max(0, (performance.now() - clockOrigin) / 1000)
}

function currentPgn() {
  if (!sans.length || !lineFen) return ''
  try {
    const chess = new Chess(lineFen)
    for (const token of sans) {
      if (!chess.move(token)) return ''
    }
    return chess.pgn()
  } catch {
    return ''
  }
}

function sanList(item) {
  const moves = Array.isArray(item?.moves) ? item.moves : []
  return moves.filter((token) => token && !/^[a-h][1-8][a-h][1-8]/.test(token))
}

function lessonAudio() {
  return document.querySelector('#lesson-audio')
}

function audioPath(name) {
  const base = String(name || '').split(/[/\\]/).pop().replace(/[^\w.\-]+/g, '_')
  return base ? `/assets/audio/${base}` : ''
}

function paintAvatar() {
  for (const button of document.querySelectorAll('#lesson-builder [data-avatar-state]')) {
    button.setAttribute('aria-pressed', button.dataset.avatarState === avatarState ? 'true' : 'false')
  }
}

function paintLine() {
  const node = document.querySelector('#builder-pgn')
  if (!node) return
  node.textContent = sans.length ? sans.join(' ') : t('builder.noLine')
}

function paintCues() {
  const list = document.querySelector('#builder-cues')
  if (!list) return
  list.replaceChildren()
  if (!timeline.length) {
    const item = document.createElement('li')
    item.textContent = t('builder.empty')
    list.append(item)
    return
  }
  timeline.forEach((cue, index) => {
    const item = document.createElement('li')
    const label = document.createElement('span')
    label.textContent = cueLabel(cue)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.dataset.cue = String(index)
    remove.textContent = t('builder.removeCue')
    item.append(label, remove)
    list.append(item)
  })
}

function cueLabel(cue) {
  const state = cue.avatarState ? t(`builder.${cue.avatarState}`) : ''
  const action = cue.action ? t(`builder.action.${cue.action}`) : t('builder.action.state')
  const squares = cue.target || [cue.from, cue.to].filter(Boolean).join('→')
  return `${Number(cue.time).toFixed(1)} s · ${[state, action, squares].filter(Boolean).join(' · ')}`
}

function paintClock() {
  const node = document.querySelector('#builder-clock')
  if (node) node.textContent = t('builder.clock', { time: currentSeconds().toFixed(1) })
}

function paintPlay() {
  const button = document.querySelector('#builder-play')
  const audio = lessonAudio()
  const playing = Boolean((audio?.currentSrc && !audio.paused) || transportPlaying)
  if (button) button.textContent = playing ? t('builder.pause') : t('builder.play')
}

function paintArm() {
  const button = document.querySelector('#builder-record')
  if (!button) return
  button.setAttribute('aria-pressed', armed ? 'true' : 'false')
  button.textContent = armed ? t('builder.recordStop') : t('builder.record')
}
