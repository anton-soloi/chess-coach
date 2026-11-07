import { AudioSyncController, collectDueCues } from './audio-sync.js'

const timeline = [
  { time: 0, avatarState: 'pointing', action: 'highlight', target: 'g5' },
  { time: 2.5, avatarState: 'talking', action: 'draw_arrow', from: 'f3', to: 'g5' },
  { time: 4.8, avatarState: 'thinking', action: 'move_piece', from: 'f3', to: 'g5' },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const executed = timeline.map(() => false)
const first = collectDueCues(timeline, 0, executed)
assert(first.length === 1 && first[0].action === 'highlight', 'la 0s pornește highlight')
assert(collectDueCues(timeline, 0.2, executed).length === 0, 'același reper nu se repetă')
const mid = collectDueCues(timeline, 2.5, executed)
assert(mid.length === 1 && mid[0].avatarState === 'talking' && mid[0].action === 'draw_arrow', 'la 2.5s vorbește și trasează săgeata')
const last = collectDueCues(timeline, 4.8, executed)
assert(last.length === 1 && last[0].action === 'move_piece', 'la 4.8s mută piesa')

class FakeAudio extends EventTarget {
  constructor() {
    super()
    this.currentTime = 0
    this.paused = true
    this.src = ''
    this.error = null
    this.hidden = false
  }
  play() {
    this.paused = false
    queueMicrotask(() => this.dispatchEvent(new Event('playing')))
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
  load() {}
  removeAttribute(name) {
    if (name === 'src') this.src = ''
  }
}

const states = []
const actions = []
const mouths = []
const audio = new FakeAudio()
const sync = new AudioSyncController(audio)
sync.load({
  audioUrl: '/assets/audio/l1_p2.mp3',
  scriptText: 'Calul din f3 sare la g5 atacând punctul f7!',
  timeline,
}, {
  soundOn: true,
  onState: (state) => states.push(state),
  onAction: (cue) => actions.push(cue.action),
  onMouth: (open) => mouths.push(open),
})
sync.play()
await new Promise((resolve) => setTimeout(resolve, 0))
audio.currentTime = 0
audio.dispatchEvent(new Event('timeupdate'))
audio.currentTime = 2.5
audio.dispatchEvent(new Event('timeupdate'))
audio.dispatchEvent(new Event('timeupdate'))
audio.currentTime = 4.8
audio.dispatchEvent(new Event('timeupdate'))

assert(states.join(',') === 'pointing,talking,thinking', 'timeupdate schimbă stările avatarului')
assert(actions.join(',') === 'highlight,draw_arrow,move_piece', 'timeupdate apelează acțiunile de pe tablă')
const again = sync.debugAt(4.8)
assert(again.due.length === 0, 'debugAt nu reexecută un reper deja trecut')

sync.pose = 'talking'
assert(sync.pulseMouth() === false, 'buza se închide')
assert(mouths.at(-1) === false, 'gura închisă anunță idle vizual')
assert(sync.pulseMouth() === true, 'buza se deschide')
sync.pose = 'pointing'
const before = mouths.length
sync.pulseMouth()
assert(mouths.length === before, 'pointing nu este acoperit de animația buzelor')

sync.pause()
assert(states.at(-1) === 'thinking', 'pauza lasă avatarul pe thinking')
let finished = false
sync.hooks.onFinish = () => { finished = true }
sync.finish()
assert(states.at(-1) === 'idle', 'finalul readuce avatarul pe idle')
assert(finished, 'finalul timeline-ului anunță exercițiul')

const silent = []
const clock = new AudioSyncController(new FakeAudio())
clock.load({ scriptText: 'fără fișier', timeline }, {
  soundOn: false,
  onState: (state) => silent.push(state),
  onAction: () => {},
})
assert(clock.mode === 'clock', 'mute pornește ceasul intern')
clock.play()
clock.syncTo(0)
clock.syncTo(2.5)
assert(silent.join(',') === 'pointing,talking', 'ceasul intern păstrează aceeași cronologie')
clock.seek(0)
clock.syncTo(0)
assert(silent.at(-1) === 'pointing', 'seek înapoi rearmează reperul')

const report = sync.debug(false)
assert(Array.isArray(report.trace) && report.trace.some((entry) => entry.type === 'cue'), 'debug expune urma reperelor')
sync.stop()
clock.stop()
console.log('audio-sync ok', report.trace.filter((entry) => entry.type === 'cue').map((entry) => entry.time).join(' '))
