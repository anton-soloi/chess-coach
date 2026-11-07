// Sunete scurte generate în browser. Nimic nu pornește când sunetul este oprit.

const STORE = 'chesscoach.sound'

let muted = localStorage.getItem(STORE) === 'off'
let context = null
let pendingMove = 0

function audioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!context) context = new Ctx()
  if (context.state === 'suspended') context.resume()
  return context
}

function tone(audio, { freq, start, duration, type = 'sine', gain = 0.15, attack = 0.008 }) {
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function knock(audio, { start, duration, frequency, gain }) {
  const length = Math.max(1, Math.floor(audio.sampleRate * duration))
  const buffer = audio.createBuffer(1, length, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.012))
  }
  const source = audio.createBufferSource()
  source.buffer = buffer
  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(frequency, start)
  const amp = audio.createGain()
  amp.gain.setValueAtTime(gain, start)
  source.connect(filter)
  filter.connect(amp)
  amp.connect(audio.destination)
  source.start(start)
  source.stop(start + duration)
}

function playMove() {
  const audio = audioContext()
  if (!audio) return
  const now = audio.currentTime
  knock(audio, { start: now, duration: 0.045, frequency: 1800, gain: 0.45 })
  tone(audio, { freq: 210, start: now, duration: 0.06, type: 'triangle', gain: 0.08, attack: 0.004 })
}

function playCapture() {
  const audio = audioContext()
  if (!audio) return
  const now = audio.currentTime
  knock(audio, { start: now, duration: 0.08, frequency: 700, gain: 0.7 })
  tone(audio, { freq: 98, start: now, duration: 0.16, type: 'sine', gain: 0.22, attack: 0.004 })
  tone(audio, { freq: 146, start: now, duration: 0.1, type: 'triangle', gain: 0.08, attack: 0.004 })
}

function playSuccess() {
  const audio = audioContext()
  if (!audio) return
  const now = audio.currentTime
  const chord = [523.25, 659.25, 783.99]
  chord.forEach((freq, index) => {
    tone(audio, {
      freq,
      start: now + index * 0.055,
      duration: 0.32,
      type: 'sine',
      gain: 0.11,
      attack: 0.012,
    })
  })
}

const EFFECTS = { move: playMove, capture: playCapture, success: playSuccess }

export function isSoundOn() {
  return !muted
}

export function setSoundOn(on) {
  muted = !on
  localStorage.setItem(STORE, muted ? 'off' : 'on')
  document.dispatchEvent(new CustomEvent('chesscoach-sound', { detail: !muted }))
}

export function playEffect(name) {
  if (muted) return
  EFFECTS[name]?.()
}

export function playMoveEffect(played) {
  if (muted) return
  const name = played?.captured ? 'capture' : 'move'
  const token = ++pendingMove
  queueMicrotask(() => {
    if (token !== pendingMove || muted) return
    playEffect(name)
  })
}

export function playExerciseEnd() {
  pendingMove += 1
  playEffect('success')
}
