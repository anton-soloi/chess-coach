// Limba aleasă stă în localStorage. t() citește dicționarul de interfață.
// tx() citește un câmp de lecție: șir simplu sau { ro, en, fr }.

const KEY = 'chesscoach.lang'
const LANGS = ['ro', 'en', 'fr']

let current = 'ro'
let packs = { ro: {}, en: {}, fr: {} }
const listeners = new Set()

export function lang() {
  return current
}

export function t(key, vars = {}) {
  const text = pick(packs[current], key) ?? pick(packs.ro, key) ?? key
  if (typeof text !== 'string') return key
  return Object.entries(vars).reduce(
    (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
    text,
  )
}

export function tList(key) {
  const value = pick(packs[current], key) ?? pick(packs.ro, key)
  return Array.isArray(value) ? value : []
}

export function tx(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return value[current] || value.ro || value.en || value.fr || ''
  return String(value)
}

export async function initI18n() {
  const saved = localStorage.getItem(KEY)
  current = LANGS.includes(saved) ? saved : 'ro'
  const [ro, en, fr] = await Promise.all([
    fetchJson('i18n/ro.json'),
    fetchJson('i18n/en.json'),
    fetchJson('i18n/fr.json'),
  ])
  packs = { ro, en, fr }
  document.documentElement.lang = current
  applyDom()
  document.querySelector('.lang')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lang]')
    if (!button) return
    setLang(button.dataset.lang)
  })
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return
  current = next
  localStorage.setItem(KEY, next)
  document.documentElement.lang = next
  applyDom()
  for (const fn of listeners) fn(next)
}

export function onLang(fn) {
  listeners.add(fn)
}

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria))
  })
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle)
  })
  root.querySelectorAll('[data-lang]').forEach((button) => {
    const on = button.dataset.lang === current
    button.classList.toggle('active', on)
    button.setAttribute('aria-pressed', String(on))
  })
}

function pick(tree, key) {
  return key.split('.').reduce((node, part) => (
    node && typeof node === 'object' ? node[part] : undefined
  ), tree)
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
}
