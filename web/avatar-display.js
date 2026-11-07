// Etapa 2. Panoul avatarului, lângă tablă. Patru stări: idle, talking, pointing, thinking.

import { onLang, t } from './i18n.js'
import { avatarLevelNumber, getAvatarPath, onGender, readUserGender } from './avatar-profile.js'

const STATES = ['idle', 'talking', 'pointing', 'thinking']

let host = null
let figure = null
let caption = null
let age = null
let levelId = 'tabla'
let state = 'idle'
let mouthOpen = true

export function mountAvatarDisplay(root) {
  host = root
  if (!host) return
  host.replaceChildren()
  figure = document.createElement('img')
  figure.id = 'avatar-figure'
  figure.width = 120
  figure.height = 165
  figure.decoding = 'async'
  age = document.createElement('p')
  age.id = 'avatar-age'
  age.className = 'avatar-age'
  caption = document.createElement('p')
  caption.id = 'avatar-script'
  caption.className = 'avatar-script'
  caption.hidden = true
  host.append(figure, age, caption)
  onGender(() => paint())
  onLang(() => paint())
  document.addEventListener('chesscoach-level', (event) => {
    setAvatarLevel(event.detail)
  })
  paint()
}

export function setAvatarLevel(id) {
  levelId = id || 'tabla'
  paint()
}

export function setAvatarState(next) {
  state = STATES.includes(next) ? next : 'idle'
  mouthOpen = true
  paint()
}

export function setAvatarMouth(open) {
  mouthOpen = Boolean(open)
  paint()
}

export function setAvatarCaption(text) {
  if (!caption) return
  const value = String(text || '').trim()
  caption.textContent = value
  caption.hidden = !value
}

export function avatarState() {
  return state
}

function paint() {
  if (!host || !figure) return
  const gender = readUserGender()
  const level = avatarLevelNumber(levelId)
  const visual = state === 'talking' && !mouthOpen ? 'idle' : state
  host.dataset.state = state
  host.dataset.mouth = state === 'talking' && !mouthOpen ? 'closed' : 'open'
  host.dataset.level = String(level)
  host.dataset.gender = gender
  figure.src = getAvatarPath(gender, level, visual)
  figure.alt = `${t('avatar.coach')} · ${t(`avatar.state.${state}`)}`
  if (age) age.textContent = t(`avatar.ages.${level}`)
}
