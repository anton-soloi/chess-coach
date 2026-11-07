import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)))
const levels = [1, 2, 3, 4, 5, 6, 7]
const states = ['idle', 'talking', 'pointing', 'thinking']
const genders = ['boy', 'girl']

const fit = {
  1: { head: 36, y: 86, shoulder: 118, hip: 156, reach: 18 },
  2: { head: 32, y: 78, shoulder: 108, hip: 160, reach: 24 },
  3: { head: 29, y: 70, shoulder: 98, hip: 166, reach: 30 },
  4: { head: 26, y: 64, shoulder: 90, hip: 172, reach: 36 },
  5: { head: 24, y: 58, shoulder: 84, hip: 178, reach: 42 },
  6: { head: 23, y: 54, shoulder: 80, hip: 184, reach: 46 },
  7: { head: 22, y: 52, shoulder: 76, hip: 188, reach: 48 },
}

const boyCloth = ['#7ec8e3', '#4ea8de', '#1d4e89', '#1b4332', '#415a77', '#1d3557', '#6c584c']
const girlCloth = ['#ffc2d4', '#ff8fab', '#e85d75', '#c9184a', '#9d4edd', '#7b2cbf', '#6d597a']

function svg(gender, level, state) {
  const box = fit[level]
  const cloth = (gender === 'girl' ? girlCloth : boyCloth)[level - 1]
  const hair = level >= 7 ? '#d8d2c8' : (gender === 'girl' ? '#6b3f2a' : '#3d2b1f')
  const look = state === 'pointing' || state === 'thinking' ? 3.2 : 0
  const skin = '#f2c7a5'
  const cheek = '#e7a48a'
  const cx = 80
  const { head, y, shoulder, hip, reach } = box
  const mouth = mouthMarkup(state, y)
  const arms = armMarkup(state, shoulder, reach, cloth)
  const hairMarkup = hairFor(gender, level, cx, y, head, hair)
  const extra = level >= 7 ? glasses(cx, y, look) : ''
  const beard = gender === 'boy' && level >= 7 ? `<path d="M${cx - 10} ${y + 10} Q${cx} ${y + 24} ${cx + 10} ${y + 10}" fill="${hair}" opacity="0.85"/>` : ''
  const legs = gender === 'girl' && level < 6
    ? ''
    : `<path d="M${cx - 12} ${hip - 4} L${cx - 16} 206 M${cx + 12} ${hip - 4} L${cx + 16} 206" stroke="#2c3036" stroke-width="7" stroke-linecap="round"/>`
  const torso = gender === 'girl'
    ? `<path d="M${cx - 16} ${shoulder - 2} L${cx + 16} ${shoulder - 2} L${cx + 28} ${hip} L${cx - 28} ${hip} Z" fill="${cloth}"/>`
    : `<path d="M${cx - 18} ${shoulder} Q${cx} ${shoulder - 8} ${cx + 18} ${shoulder} L${cx + 16} ${hip} L${cx - 16} ${hip} Z" fill="${cloth}"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220" role="img">
  <ellipse cx="80" cy="208" rx="28" ry="6" fill="#000" opacity="0.18"/>
  ${legs}
  ${torso}
  <path d="M${cx - 10} ${shoulder + 2} H${cx + 10}" stroke="#e2b657" stroke-width="3" stroke-linecap="round"/>
  ${arms}
  ${hairMarkup}
  <circle cx="${cx}" cy="${y}" r="${head}" fill="${skin}"/>
  <ellipse cx="${cx - 10}" cy="${y + 6}" rx="4" ry="2.4" fill="${cheek}" opacity="0.55"/>
  <ellipse cx="${cx + 10}" cy="${y + 6}" rx="4" ry="2.4" fill="${cheek}" opacity="0.55"/>
  <ellipse cx="${cx - 8 + look}" cy="${y - 1}" rx="3.2" ry="3.6" fill="#2a2118"/>
  <ellipse cx="${cx + 8 + look}" cy="${y - 1}" rx="3.2" ry="3.6" fill="#2a2118"/>
  <circle cx="${cx - 7 + look}" cy="${y - 2.2}" r="1" fill="#fff"/>
  <circle cx="${cx + 9 + look}" cy="${y - 2.2}" r="1" fill="#fff"/>
  ${mouth}
  ${beard}
  ${extra}
</svg>
`
}

function mouthMarkup(state, y) {
  const cy = y + 14
  if (state === 'talking') {
    return `<ellipse cx="80" cy="${cy}" rx="6" ry="3" fill="#7a3040">
      <animate attributeName="ry" values="1.6;6;1.6" dur="0.42s" repeatCount="indefinite"/>
    </ellipse>`
  }
  if (state === 'thinking') return `<path d="M74 ${cy} H86" stroke="#7a3040" stroke-width="1.6" stroke-linecap="round"/>`
  return `<path d="M72 ${cy - 1} Q80 ${cy + 6} 88 ${cy - 1}" fill="none" stroke="#7a3040" stroke-width="1.8" stroke-linecap="round"/>`
}

function armMarkup(state, shoulder, reach, cloth) {
  if (state === 'pointing') {
    return `<path d="M64 ${shoulder + 8} Q52 ${shoulder + 28} 50 ${shoulder + 48}" stroke="${cloth}" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M96 ${shoulder + 6} L${100 + reach} ${shoulder - 2}" stroke="${cloth}" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="${104 + reach}" cy="${shoulder - 4}" r="4" fill="#f2c7a5"/>`
  }
  if (state === 'thinking') {
    return `<path d="M64 ${shoulder + 8} Q52 ${shoulder + 28} 50 ${shoulder + 48}" stroke="${cloth}" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M96 ${shoulder + 6} Q112 ${shoulder + 20} 92 ${shoulder - 18}" stroke="${cloth}" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="88" cy="${shoulder - 20}" r="4.5" fill="#f2c7a5"/>`
  }
  return `<path d="M64 ${shoulder + 6} Q54 ${shoulder + 30} 56 ${shoulder + 52}" stroke="${cloth}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M96 ${shoulder + 6} Q106 ${shoulder + 30} 104 ${shoulder + 52}" stroke="${cloth}" stroke-width="8" stroke-linecap="round" fill="none"/>`
}

function hairFor(gender, level, cx, y, head, color) {
  if (gender === 'girl' && level >= 7) {
    return `<circle cx="${cx}" cy="${y - head + 6}" r="${head * 0.55}" fill="${color}"/>
      <circle cx="${cx + 16}" cy="${y - 4}" r="10" fill="${color}"/>`
  }
  if (gender === 'girl' && level >= 3) {
    const drop = 18 + level * 6
    return `<path d="M${cx - head} ${y - 4} Q${cx} ${y - head - 12} ${cx + head} ${y - 4} L${cx + head - 2} ${y + drop} Q${cx} ${y + 8} ${cx - head + 2} ${y + drop} Z" fill="${color}"/>`
  }
  if (gender === 'girl') {
    return `<path d="M${cx - head + 2} ${y - 2} Q${cx} ${y - head - 10} ${cx + head - 2} ${y - 2} Z" fill="${color}"/>
      <circle cx="${cx - head + 2}" cy="${y + 8}" r="7" fill="${color}"/>
      <circle cx="${cx + head - 2}" cy="${y + 8}" r="7" fill="${color}"/>`
  }
  if (level === 1) {
    return `<path d="M${cx - 8} ${y - head + 8} Q${cx} ${y - head - 6} ${cx + 10} ${y - head + 10}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  }
  return `<path d="M${cx - head + 3} ${y - 2} Q${cx} ${y - head - 8} ${cx + head - 3} ${y - 2} Q${cx} ${y - head + 8} ${cx - head + 3} ${y - 2} Z" fill="${color}"/>`
}

function glasses(cx, y, look) {
  return `<g fill="none" stroke="#2a2118" stroke-width="1.4">
    <circle cx="${cx - 8 + look}" cy="${y - 1}" r="6"/>
    <circle cx="${cx + 8 + look}" cy="${y - 1}" r="6"/>
    <path d="M${cx - 2 + look} ${y - 1} H${cx + 2 + look}"/>
  </g>`
}

for (const gender of genders) {
  for (const level of levels) {
    for (const state of states) {
      const file = join(root, gender, `level_${level}_${state}.svg`)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, svg(gender, level, state), 'utf8')
    }
  }
}
console.log('avatars', genders.length * levels.length * states.length)
