// Sincronizează audio-ul lecției cu tabla și cu avatarul.
// timeupdate conduce reperele; fără fișier sau cu sunetul oprit, același timeline rulează pe ceasul paginii.

import { narrativeOf } from './avatar-timeline.js'

const LIP_MS = 280
const CUE_SLOP = 0.05
const CLOCK_TAIL = 1

export function collectDueCues(timeline, currentTime, executed) {
  const due = []
  const time = Number(currentTime) || 0
  for (let index = 0; index < timeline.length; index += 1) {
    if (executed[index]) continue
    if (timeline[index].time <= time + CUE_SLOP) {
      executed[index] = true
      due.push(timeline[index])
    }
  }
  return due
}

export class AudioSyncController {
  constructor(audio = null) {
    this.audio = audio
    this.hooks = {}
    this.timeline = []
    this.executed = []
    this.trace = []
    this.mode = 'idle'
    this.pose = 'idle'
    this.mouthOpen = true
    this.playing = false
    this.ended = false
    this.lastTime = 0
    this.clockOrigin = 0
    this.clockStarted = 0
    this.frame = 0
    this.watch = 0
    this.lipTimer = 0
    this.debugEnabled = false
    this.missingFile = false
    this.bound = false
    if (audio) this.bindAudio()
    if (typeof document !== 'undefined') {
      document.addEventListener('chesscoach-sound', (event) => this.onSound(event.detail))
    }
  }

  ensureAudio() {
    if (this.audio) return this.audio
    const existing = typeof document !== 'undefined' ? document.querySelector('#lesson-audio') : null
    if (existing) this.audio = existing
    else if (typeof document !== 'undefined') {
      const audio = document.createElement('audio')
      audio.id = 'lesson-audio'
      audio.preload = 'auto'
      audio.hidden = true
      document.body.append(audio)
      this.audio = audio
    }
    if (this.audio) this.bindAudio()
    return this.audio
  }

  bindAudio() {
    if (!this.audio || this.bound) return
    this.bound = true
    this.audio.addEventListener('timeupdate', () => {
      if (this.mode !== 'audio' || !this.playing) return
      this.syncTo(this.audio.currentTime)
    })
    this.audio.addEventListener('seeked', () => {
      if (this.mode !== 'audio') return
      this.syncTo(this.audio.currentTime)
    })
    this.audio.addEventListener('playing', () => {
      clearTimeout(this.watch)
      this.missingFile = false
      this.mode = 'audio'
      this.playing = true
      this.startLips()
      this.note('playing', { time: this.audio.currentTime })
    })
    this.audio.addEventListener('pause', () => {
      if (this.mode !== 'audio' || this.ended || !this.playing) return
      this.hold('thinking')
    })
    this.audio.addEventListener('ended', () => {
      this.syncTo(this.audio.currentTime || this.lastTime)
      this.finish()
    })
    this.audio.addEventListener('error', () => {
      this.missingFile = true
      this.note('error', { src: this.audio.src || '' })
      this.useClock()
    })
  }

  load(step, hooks = {}) {
    this.stop({ silent: true })
    this.hooks = hooks
    const narrative = narrativeOf(step)
    this.timeline = narrative.timeline
    this.executed = this.timeline.map(() => false)
    this.trace = []
    this.pose = 'idle'
    this.mouthOpen = true
    this.ended = false
    this.lastTime = 0
    this.clockOrigin = 0
    this.missingFile = false
    this.hooks.onCaption?.(narrative.scriptText)
    const audio = this.ensureAudio()
    const url = narrative.audioUrl
    if (!url || !this.soundAllowed()) {
      this.mode = 'clock'
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        if (typeof audio.load === 'function') audio.load()
      }
      return narrative
    }
    this.mode = 'audio'
    audio.src = url
    if (typeof audio.load === 'function') audio.load()
    return narrative
  }

  play() {
    if (!this.timeline.length) {
      this.hooks.onState?.('idle')
      this.note('idle', { reason: 'empty' })
      return
    }
    this.playing = true
    this.ended = false
    this.startLips()
    if (this.mode === 'audio' && this.audio && !this.missingFile) {
      const played = this.audio.play?.()
      if (played && typeof played.catch === 'function') played.catch(() => this.useClock())
      clearTimeout(this.watch)
      this.watch = setTimeout(() => {
        if (this.mode === 'audio' && this.audio?.paused) this.useClock()
      }, 700)
      return
    }
    this.useClock()
  }

  pause() {
    this.hold('thinking')
  }

  seek(seconds) {
    const time = Math.max(0, Number(seconds) || 0)
    if (time < this.lastTime - 0.05) {
      this.executed = this.timeline.map((cue) => cue.time < time - CUE_SLOP)
    }
    this.lastTime = time
    this.ended = false
    this.clockOrigin = time
    this.clockStarted = now()
    if (this.mode === 'audio' && this.audio && !this.missingFile) {
      try { this.audio.currentTime = time } catch { this.useClock() }
    }
    this.syncTo(time)
    this.note('seek', { time })
    return time
  }

  stop(options = {}) {
    this.playing = false
    this.stopLips()
    clearTimeout(this.watch)
    cancelFrame(this.frame)
    this.frame = 0
    if (this.audio) {
      this.audio.pause()
      if (!options.keepSrc) {
        this.audio.removeAttribute('src')
        if (typeof this.audio.load === 'function') this.audio.load()
      }
    }
    if (!options.silent) {
      this.pose = 'idle'
      this.hooks.onState?.('idle')
    }
  }

  syncTo(seconds) {
    const time = Math.max(0, Number(seconds) || 0)
    const due = collectDueCues(this.timeline, time, this.executed)
    for (const cue of due) {
      if (cue.avatarState) {
        this.pose = cue.avatarState
        this.mouthOpen = true
        this.hooks.onState?.(cue.avatarState)
      }
      if (cue.action) this.hooks.onAction?.(cue)
      this.note('cue', {
        time: cue.time,
        avatarState: cue.avatarState || '',
        action: cue.action || '',
        target: cue.target || '',
        from: cue.from || '',
        to: cue.to || '',
      })
    }
    this.lastTime = time
    return due
  }

  pulseMouth() {
    if (this.pose !== 'talking') return this.mouthOpen
    this.mouthOpen = !this.mouthOpen
    this.hooks.onMouth?.(this.mouthOpen)
    this.note('mouth', { open: this.mouthOpen })
    return this.mouthOpen
  }

  debug(enabled = true) {
    this.debugEnabled = enabled !== false
    const report = this.report()
    console.info('[AudioSync]', report)
    return report
  }

  debugAt(seconds) {
    const before = this.trace.length
    const due = this.syncTo(seconds)
    const fired = this.trace.slice(before)
    console.info(`[AudioSync] ${seconds}s`, fired)
    return { due, fired }
  }

  explain(seconds) {
    const executed = this.timeline.map(() => false)
    return collectDueCues(this.timeline, seconds, executed)
  }

  report() {
    return {
      mode: this.mode,
      playing: this.playing,
      time: this.currentTime(),
      pose: this.pose,
      mouthOpen: this.mouthOpen,
      missingFile: this.missingFile,
      cues: this.timeline.map((cue, index) => ({ ...cue, done: Boolean(this.executed[index]) })),
      trace: this.trace.slice(),
    }
  }

  currentTime() {
    if (this.mode === 'audio' && this.audio && !this.audio.paused && !this.missingFile) return this.audio.currentTime
    if (!this.playing) return this.lastTime
    return this.clockOrigin + Math.max(0, (now() - this.clockStarted) / 1000)
  }

  startLips() {
    this.stopLips()
    this.mouthOpen = true
    this.lipTimer = setInterval(() => this.pulseMouth(), LIP_MS)
  }

  stopLips() {
    clearInterval(this.lipTimer)
    this.lipTimer = 0
  }

  hold(state) {
    this.playing = false
    this.stopLips()
    clearTimeout(this.watch)
    cancelFrame(this.frame)
    this.frame = 0
    if (this.audio && this.mode === 'audio') this.audio.pause()
    this.pose = state
    this.hooks.onState?.(state)
    this.note(state === 'thinking' ? 'pause' : 'hold', { state })
  }

  finish() {
    if (this.ended) return
    this.ended = true
    this.playing = false
    this.stopLips()
    clearTimeout(this.watch)
    cancelFrame(this.frame)
    this.frame = 0
    this.pose = 'idle'
    this.hooks.onState?.('idle')
    this.note('ended', { state: 'idle' })
    this.hooks.onFinish?.()
  }

  useClock() {
    clearTimeout(this.watch)
    const continueAt = this.lastTime
    this.mode = 'clock'
    if (this.audio && !this.audio.paused) this.audio.pause()
    this.clockOrigin = continueAt
    this.clockStarted = now()
    this.note('clock', { time: continueAt })
    if (this.playing) this.pumpClock()
  }

  pumpClock() {
    cancelFrame(this.frame)
    const end = this.timeline.reduce((max, cue) => Math.max(max, cue.time), 0) + CLOCK_TAIL
    const tick = () => {
      if (!this.playing || this.mode !== 'clock') return
      const time = this.currentTime()
      this.syncTo(time)
      if (time >= end) {
        this.finish()
        return
      }
      this.frame = requestFrame(tick)
    }
    this.frame = requestFrame(tick)
  }

  onSound(on) {
    if (!this.playing) return
    if (!on) this.useClock()
    else if (this.mode === 'clock' && this.audio?.src && !this.missingFile && !this.audio.error) {
      this.mode = 'audio'
      try { this.audio.currentTime = this.currentTime() } catch { /* ceasul rămâne */ }
      const played = this.audio.play?.()
      if (played && typeof played.catch === 'function') played.catch(() => this.useClock())
    }
  }

  soundAllowed() {
    const flag = this.hooks.soundOn
    if (typeof flag === 'function') return flag() !== false
    return flag !== false
  }

  note(type, detail) {
    const entry = { type, ...detail }
    this.trace.push(entry)
    if (this.debugEnabled) console.info('[AudioSync]', entry)
  }
}

function now() {
  return globalThis.performance?.now?.() || Date.now()
}

function requestFrame(callback) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
  return setTimeout(() => callback(now()), 16)
}

function cancelFrame(handle) {
  if (!handle) return
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  clearTimeout(handle)
}

export const lessonAudio = new AudioSyncController()

export function playNarrative(step, hooks = {}) {
  const narrative = lessonAudio.load(step, hooks)
  lessonAudio.play()
  return narrative
}

export function stopNarrative() {
  lessonAudio.stop()
}

if (typeof window !== 'undefined') window.chesscoachAudioSync = lessonAudio
