// Ceas de perete discret. Ora se actualizează o dată pe secundă, aliniat la
// secunda următoare, și se oprește cât timp fila este ascunsă.

const HOLD_MS = 2200
const FADE_MS = 1600

let el = null
let readKey = () => ''
let key = ''
let glancing = false
let glanceGen = 0
let holdTimer = 0
let fadeTimer = 0
let tickTimer = 0

export function mountStudyClock(anchor, read) {
  if (typeof read === 'function') readKey = read
  el = anchor?.querySelector('#study-clock') || document.createElement('time')
  el.id = 'study-clock'
  el.classList.add('study-clock')
  if (!el.parentElement && anchor) anchor.append(el)
  paintTime()
  refreshStudyClock()
  startTicker()
  document.addEventListener('visibilitychange', () => {
    stopTicker()
    if (document.hidden) return
    paintTime()
    startTicker()
  })
}

export function refreshStudyClock() {
  if (!el) return
  const next = readKey() || ''
  if (next === key) return
  const prev = key
  key = next
  if (prev) beginGlance()
  else applyRest()
}

export function glanceStudyClock() {
  if (!el) return
  beginGlance()
}

function beginGlance() {
  const gen = ++glanceGen
  glancing = true
  clearTimeout(holdTimer)
  clearTimeout(fadeTimer)
  el.classList.remove('is-focus', 'is-fade')
  el.classList.add('is-glance')
  el.setAttribute('aria-hidden', 'false')
  holdTimer = setTimeout(() => {
    if (gen !== glanceGen) return
    glancing = false
    el.classList.remove('is-glance')
    if (!key) {
      applyRest()
      return
    }
    void el.offsetWidth
    el.classList.add('is-fade')
    el.setAttribute('aria-hidden', 'true')
    fadeTimer = setTimeout(() => {
      if (gen !== glanceGen || !key) return
      el.classList.remove('is-fade')
      el.classList.add('is-focus')
    }, FADE_MS)
  }, HOLD_MS)
}

function applyRest() {
  if (!el) return
  glanceGen += 1
  glancing = false
  clearTimeout(holdTimer)
  clearTimeout(fadeTimer)
  el.classList.remove('is-glance', 'is-fade')
  const hidden = Boolean(key)
  el.classList.toggle('is-focus', hidden)
  el.setAttribute('aria-hidden', hidden ? 'true' : 'false')
}

function paintTime() {
  if (!el) return
  const now = new Date()
  const text = now.toLocaleTimeString(clockLocale(), { hour: '2-digit', minute: '2-digit' })
  if (el.textContent !== text) el.textContent = text
  el.dateTime = now.toISOString()
}

function clockLocale() {
  const lang = document.documentElement.lang || 'ro'
  if (lang === 'en') return 'en-GB'
  if (lang === 'fr') return 'fr-FR'
  return 'ro-RO'
}

function startTicker() {
  stopTicker()
  const beat = () => {
    paintTime()
    refreshStudyClock()
    const wait = 1000 - (Date.now() % 1000)
    tickTimer = setTimeout(beat, wait)
  }
  const wait = 1000 - (Date.now() % 1000)
  tickTimer = setTimeout(beat, wait)
}

function stopTicker() {
  clearTimeout(tickTimer)
  tickTimer = 0
}
