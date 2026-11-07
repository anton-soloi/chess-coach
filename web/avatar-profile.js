// Etapa 1. Profilul antrenorului: genul ales de utilizator și calea SVG pe nivel.

const STORE = 'userGender'
const STATES = ['idle', 'talking', 'pointing', 'thinking']

export const AVATAR_LEVELS = [
  { id: 'tabla', level: 1 },
  { id: 'pion', level: 2 },
  { id: 'cal', level: 3 },
  { id: 'nebun', level: 4 },
  { id: 'turn', level: 5 },
  { id: 'dama', level: 6 },
  { id: 'rege', level: 7 },
]

const listeners = new Set()

export function readUserGender() {
  const saved = localStorage.getItem(STORE)
  return saved === 'girl' ? 'girl' : 'boy'
}

export function writeUserGender(gender) {
  const next = gender === 'girl' ? 'girl' : 'boy'
  localStorage.setItem(STORE, next)
  for (const listener of listeners) listener(next)
  return next
}

export function onGender(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function avatarLevelNumber(level) {
  if (typeof level === 'number' && level >= 1 && level <= 7) return level
  const text = String(level ?? '')
  if (/^[1-7]$/.test(text)) return Number(text)
  const found = AVATAR_LEVELS.find((item) => item.id === text)
  return found ? found.level : 1
}

export function getAvatarPath(gender, level, state) {
  const who = gender === 'girl' ? 'girl' : 'boy'
  const pose = STATES.includes(state) ? state : 'idle'
  return `/assets/avatars/${who}/level_${avatarLevelNumber(level)}_${pose}.svg`
}

export function bindGenderSelector(root = document) {
  const group = root.querySelector?.('.avatar-gender') || root
  const buttons = group.querySelectorAll?.('[data-gender]') || []
  const paint = () => {
    const gender = readUserGender()
    buttons.forEach((button) => {
      const on = button.dataset.gender === gender
      button.classList.toggle('active', on)
      button.setAttribute('aria-pressed', String(on))
    })
  }
  buttons.forEach((button) => {
    button.addEventListener('click', () => writeUserGender(button.dataset.gender))
  })
  onGender(paint)
  paint()
}
