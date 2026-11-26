// Ecranul de bun venit și profilul local.
// Textele scurte se editează doar din obiectul WELCOME.copy.

import { lang, onLang } from './i18n.js'
import { getAvatarPath, readUserGender, writeUserGender } from './avatar-profile.js'

export const WELCOME = {
  storageKey: 'chesscoach.profile',
  seenKey: 'chesscoach.welcomeSeen',
  logo: 'assets/caissa-wisdom-logo.jpg',
  bannerDir: 'assets',
  bannerFile: 'Caïssa Wisdom_ Chess Journey Begins.png',
  pillars: ['vision', 'mission', 'purpose', 'theme'],
  copy: {
    ro: {
      open: 'Bun venit',
      openAbout: 'Bun venit / Despre',
      profile: 'Profil',
      profileAbout: 'Profil / Înregistrare',
      enter: 'Începem călătoria!',
      hello: 'Salut, {name}!',
      homeHint: 'Viziune, misiune, scop și tematică.',
      bannerAlt: 'CAÏSSA’S WISDOM — călătoria în șah începe',
      profileTitle: 'Profil / Înregistrare',
      profileLead: 'Opțional. Poți intra în aplicație fără profil și îl poți completa oricând.',
      name: 'Nume / poreclă',
      role: 'Rol',
      roleHint: 'Rolul se aplică imediat și rămâne în profilul salvat.',
      child: 'Copil',
      teacher: 'Profesor',
      age: 'Vârstă (opțional)',
      gender: 'Gen / avatar',
      boy: 'Băiat',
      girl: 'Fată',
      unset: 'Necompletat',
      registered: 'Profil înregistrat',
      registeredEnter: 'Intră cu profilul și istoricul salvat.',
      registeredMeta: '{name} · {role}',
      save: 'Salvează profilul',
      update: 'Salvează modificările',
      reset: 'Resetează profilul',
      resetAsk: 'Ștergi profilul salvat în acest browser?',
      saved: 'Profil salvat.',
      cleared: 'Profilul a fost șters.',
      needName: 'Scrie un nume sau o poreclă.',
      badAge: 'Vârsta trebuie să fie un număr între 1 și 120.',
      visionTitle: 'Viziune',
      vision: 'Un spațiu de formare șahistă unde gândirea limpede, curiozitatea și caracterul cresc împreună, de la primii pași până la măiestrie.',
      missionTitle: 'Misiune',
      mission: 'Să oferim o învățare ghidată, clară și interactivă, în care elevul înțelege de ce se face o mutare, iar profesorul are instrumente complete de lucru și analiză.',
      missionEm: 'de ce',
      purposeTitle: 'Scop',
      purpose: 'Să cultivăm atenția, rigoarea calculului, gândirea critică și încrederea de a lua decizii asumate pe tablă și în viață.',
      themeTitle: 'Tematică',
      theme: 'Fundamentele șahului, tactică și calcul, tipare de mat, finaluri și gândire strategică, structurate progresiv pe niveluri.',
    },
    en: {
      open: 'Welcome',
      openAbout: 'Welcome / About',
      profile: 'Profile',
      profileAbout: 'Profile / Register',
      enter: 'Let’s begin the journey!',
      hello: 'Hello, {name}!',
      homeHint: 'Vision, mission, purpose and themes.',
      bannerAlt: 'CAÏSSA’S WISDOM — the chess journey begins',
      profileTitle: 'Profile / Register',
      profileLead: 'Optional. You can enter the app without a profile and fill it in later.',
      name: 'Name / nickname',
      role: 'Role',
      roleHint: 'The role applies at once and stays in the saved profile.',
      child: 'Child',
      teacher: 'Teacher',
      age: 'Age (optional)',
      gender: 'Gender / avatar',
      boy: 'Boy',
      girl: 'Girl',
      unset: 'Not set',
      registered: 'Registered profile',
      registeredEnter: 'Enter with the saved profile and history.',
      registeredMeta: '{name} · {role}',
      save: 'Save profile',
      update: 'Save changes',
      reset: 'Reset profile',
      resetAsk: 'Delete the profile saved in this browser?',
      saved: 'Profile saved.',
      cleared: 'Profile cleared.',
      needName: 'Add a name or a nickname.',
      badAge: 'Age must be a number from 1 to 120.',
      visionTitle: 'Vision',
      vision: 'A chess training space where clear thinking, curiosity and character grow together, from the first steps to mastery.',
      missionTitle: 'Mission',
      mission: 'To offer guided, clear and interactive learning, in which the student understands why a move is played, and the teacher has complete tools for work and analysis.',
      missionEm: 'why',
      purposeTitle: 'Purpose',
      purpose: 'To cultivate attention, rigor in calculation, critical thinking and the confidence to make committed decisions on the board and in life.',
      themeTitle: 'Themes',
      theme: 'The fundamentals of chess, tactics and calculation, mating patterns, endgames and strategic thinking, structured progressively by level.',
    },
    fr: {
      open: 'Bienvenue',
      openAbout: 'Bienvenue / À propos',
      profile: 'Profil',
      profileAbout: 'Profil / Inscription',
      enter: 'Commençons le voyage !',
      hello: 'Bonjour, {name} !',
      homeHint: 'Vision, mission, but et thématique.',
      bannerAlt: 'CAÏSSA’S WISDOM — le voyage aux échecs commence',
      profileTitle: 'Profil / Inscription',
      profileLead: 'Facultatif. Tu peux entrer sans profil et le remplir plus tard.',
      name: 'Nom / surnom',
      role: 'Rôle',
      roleHint: 'Le rôle s’applique tout de suite et reste dans le profil enregistré.',
      child: 'Enfant',
      teacher: 'Professeur',
      age: 'Âge (facultatif)',
      gender: 'Genre / avatar',
      boy: 'Garçon',
      girl: 'Fille',
      unset: 'Non renseigné',
      registered: 'Profil enregistré',
      registeredEnter: 'Entrer avec le profil et l’historique enregistrés.',
      registeredMeta: '{name} · {role}',
      save: 'Enregistrer le profil',
      update: 'Enregistrer les modifications',
      reset: 'Réinitialiser le profil',
      resetAsk: 'Effacer le profil enregistré dans ce navigateur ?',
      saved: 'Profil enregistré.',
      cleared: 'Profil effacé.',
      needName: 'Écris un nom ou un surnom.',
      badAge: 'L’âge doit être un nombre entre 1 et 120.',
      visionTitle: 'Vision',
      vision: 'Un espace de formation échiquéenne où la pensée claire, la curiosité et le caractère grandissent ensemble, des premiers pas jusqu’à la maîtrise.',
      missionTitle: 'Mission',
      mission: 'Offrir un apprentissage guidé, clair et interactif, où l’élève comprend pourquoi un coup se joue, et où le professeur dispose d’outils complets de travail et d’analyse.',
      missionEm: 'pourquoi',
      purposeTitle: 'But',
      purpose: 'Cultiver l’attention, la rigueur du calcul, la pensée critique et la confiance de prendre des décisions assumées sur l’échiquier et dans la vie.',
      themeTitle: 'Thématique',
      theme: 'Les fondements des échecs, la tactique et le calcul, les schémas de mat, les finales et la pensée stratégique, structurés progressivement par niveaux.',
    },
  },
}

let hooks = {}
let holdWelcome = false
let statusKey = ''
let statusError = false

export function welcomeBannerUrl() {
  return `${WELCOME.bannerDir}/${encodeURIComponent(WELCOME.bannerFile)}`
}

export function readProfile() {
  try {
    const data = JSON.parse(localStorage.getItem(WELCOME.storageKey) || 'null')
    if (!data || typeof data !== 'object') return null
    const name = String(data.name || '').trim()
    if (!name) return null
    const age = cleanAge(data.age)
    return {
      name,
      role: data.role === 'teacher' ? 'teacher' : 'child',
      age: age == null ? '' : String(age),
      gender: data.gender === 'boy' || data.gender === 'girl' ? data.gender : '',
    }
  } catch {
    return null
  }
}

export function mountWelcome(options = {}) {
  hooks = options
  const topbar = document.querySelector('.topbar')
  topbar?.addEventListener('click', onTopbarClick, true)
  document.querySelector('#home-menu')?.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-welcome]')
    if (!opener) return
    openWelcome('top')
  })
  document.querySelector('#welcome-enter')?.addEventListener('click', () => closeWelcome(true))
  document.querySelector('#welcome-profile')?.addEventListener('submit', onSave)
  document.querySelector('#welcome-profile')?.addEventListener('change', (event) => {
    if (event.target?.name !== 'profileGender') return
    paintAvatar()
    const gender = event.target.value === 'boy' || event.target.value === 'girl' ? event.target.value : ''
    if (gender) writeUserGender(gender)
    syncSavedProfile({ gender })
  })
  document.querySelectorAll('.roles .role').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.role === 'teacher' ? 'teacher' : 'child'
      syncSavedProfile({ role: next })
    })
  })
  document.querySelector('#profile-reset')?.addEventListener('click', onReset)
  document.querySelector('#profile-registered')?.addEventListener('click', enterRegistered)
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (document.querySelector('#theme-dialog:not([hidden]), #test-summary:not([hidden])')) return
    if (isProfileOpen()) {
      closeProfile()
      return
    }
    if (isWelcomeOpen()) closeWelcome(true)
  })
  onLang(paint)
  const saved = readProfile()
  fillForm(saved)
  paint()
  syncWelcomeTop()
  window.addEventListener('resize', syncWelcomeTop)
  if (saved) hooks.onApplyRole?.(saved.role)
  if (localStorage.getItem(WELCOME.seenKey) !== '1') openWelcome('top')
}

function syncWelcomeTop() {
  const bar = document.querySelector('.topbar')
  if (!bar) return
  document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`)
}

function copy() {
  return WELCOME.copy[lang()] || WELCOME.copy.ro
}

function cleanAge(value) {
  if (value == null || value === '') return null
  const age = Number(value)
  if (!Number.isInteger(age) || age < 1 || age > 120) return undefined
  return age
}

function isWelcomeOpen() {
  const root = document.querySelector('#welcome')
  return Boolean(root && !root.hidden)
}

function setCovered(on) {
  document.querySelector('.shell')?.toggleAttribute('inert', on)
  document.querySelector('.statusbar')?.toggleAttribute('inert', on)
}

function syncCovered() {
  setCovered(isWelcomeOpen() || isProfileOpen())
}

function openWelcome() {
  const root = document.querySelector('#welcome')
  if (!root) return
  closeProfile()
  statusKey = ''
  statusError = false
  root.hidden = false
  syncCovered()
  paint()
  requestAnimationFrame(() => {
    root.scrollTop = 0
  })
}

function closeWelcome(remember) {
  const root = document.querySelector('#welcome')
  if (!root || root.hidden) return
  root.hidden = true
  syncCovered()
  if (remember) localStorage.setItem(WELCOME.seenKey, '1')
  paint()
}

function isProfileOpen() {
  const root = document.querySelector('#profile')
  return Boolean(root && !root.hidden)
}

function openProfile() {
  const root = document.querySelector('#profile')
  if (!root) return
  if (isWelcomeOpen()) closeWelcome(true)
  statusKey = ''
  statusError = false
  fillForm(readProfile())
  root.hidden = false
  syncCovered()
  paint()
  requestAnimationFrame(() => {
    root.scrollTop = 0
    const entry = readProfile() ? '#profile-registered' : '#profile-name'
    document.querySelector(entry)?.focus({ preventScroll: true })
  })
}

function enterRegistered() {
  const profile = readProfile()
  if (!profile) return
  fillForm(profile)
  if ((profile.gender === 'boy' || profile.gender === 'girl') && readUserGender() !== profile.gender) {
    writeUserGender(profile.gender)
  }
  holdWelcome = true
  try {
    hooks.onApplyRole?.(profile.role)
  } finally {
    holdWelcome = false
  }
  closeProfile()
}

function closeProfile() {
  const root = document.querySelector('#profile')
  if (!root || root.hidden) return
  root.hidden = true
  syncCovered()
  paint()
}

function onTopbarClick(event) {
  if (holdWelcome) return
  if (event.target.closest('[data-open-welcome]')) {
    openWelcome()
    return
  }
  if (event.target.closest('[data-open-profile]')) {
    openProfile()
    return
  }
  if (!event.target.closest('button')) return
  if (isWelcomeOpen()) closeWelcome(true)
  if (isProfileOpen()) closeProfile()
}

function fillForm(profile) {
  const form = document.querySelector('#welcome-profile')
  if (!form) return
  form.elements.profileName.value = profile?.name || ''
  form.elements.profileAge.value = profile?.age || ''
  setRadio(form, 'profileGender', profile?.gender === 'boy' || profile?.gender === 'girl' ? profile.gender : '')
}

function syncSavedProfile(patch) {
  const profile = readProfile()
  if (!profile) return
  localStorage.setItem(WELCOME.storageKey, JSON.stringify({ ...profile, ...patch }))
}

function setRadio(form, name, value) {
  form.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.value === value
  })
}

function onSave(event) {
  event.preventDefault()
  const form = event.currentTarget
  const name = form.elements.profileName.value.trim()
  if (!name) {
    setStatus('needName', true)
    form.elements.profileName.focus()
    return
  }
  const ageRaw = form.elements.profileAge.value.trim()
  const age = cleanAge(ageRaw)
  if (ageRaw && age == null) {
    setStatus('badAge', true)
    form.elements.profileAge.focus()
    return
  }
  const role = document.querySelector('.roles .role.active')?.dataset.role === 'teacher' ? 'teacher' : 'child'
  const genderValue = form.querySelector('input[name="profileGender"]:checked')?.value || ''
  const gender = genderValue === 'boy' || genderValue === 'girl' ? genderValue : ''
  const profile = { name, role, age: age == null ? '' : String(age), gender }
  localStorage.setItem(WELCOME.storageKey, JSON.stringify(profile))
  if (gender) writeUserGender(gender)
  holdWelcome = true
  try {
    hooks.onApplyRole?.(role)
  } finally {
    holdWelcome = false
  }
  setStatus('saved', false)
  paint()
}

function onReset() {
  if (!readProfile()) {
    fillForm(null)
    setStatus('cleared', false)
    paint()
    return
  }
  if (!window.confirm(copy().resetAsk)) return
  localStorage.removeItem(WELCOME.storageKey)
  fillForm(null)
  setStatus('cleared', false)
  paint()
}

function setStatus(key, isError) {
  statusKey = key || ''
  statusError = Boolean(isError)
  const el = document.querySelector('#welcome-status')
  if (!el) return
  el.textContent = statusKey ? (copy()[statusKey] || '') : ''
  el.classList.toggle('is-error', statusError)
}

function paint() {
  const text = copy()
  document.querySelectorAll('[data-welcome-text]').forEach((el) => {
    const key = el.dataset.welcomeText
    if (text[key]) el.textContent = text[key]
  })
  const openBtn = document.querySelector('#welcome-open')
  if (openBtn) {
    openBtn.setAttribute('aria-label', text.open)
    openBtn.setAttribute('aria-expanded', String(isWelcomeOpen()))
    const logo = openBtn.querySelector('img')
    if (logo) {
      logo.title = text.open
      logo.setAttribute('aria-label', text.open)
    }
  }
  const profileBtn = document.querySelector('#profile-open')
  if (profileBtn) {
    profileBtn.title = text.profileAbout
    profileBtn.setAttribute('aria-label', text.profileAbout)
    profileBtn.setAttribute('aria-expanded', String(isProfileOpen()))
  }
  const banner = document.querySelector('#welcome-banner')
  if (banner) {
    const url = welcomeBannerUrl()
    if (banner.getAttribute('src') !== url) banner.setAttribute('src', url)
    banner.alt = text.bannerAlt
  }
  document.querySelectorAll('.welcome-logo, .brand img').forEach((img) => {
    if (img.getAttribute('src') !== WELCOME.logo) img.setAttribute('src', WELCOME.logo)
  })
  const saveBtn = document.querySelector('#profile-save')
  if (saveBtn) saveBtn.textContent = readProfile() ? text.update : text.save
  paintRegistered(text)
  paintCards(text)
  paintHello(text)
  paintAvatar()
  setStatus(statusKey, statusError)
}

function paintCards(text) {
  const host = document.querySelector('#welcome-cards')
  if (!host) return
  host.replaceChildren()
  for (const id of WELCOME.pillars) {
    const card = document.createElement('article')
    card.className = 'welcome-card'
    const title = document.createElement('h3')
    title.textContent = text[`${id}Title`] || ''
    const body = document.createElement('p')
    fillRich(body, text[id], text[`${id}Em`])
    card.append(title, body)
    host.append(card)
  }
}

function paintRegistered(text) {
  const button = document.querySelector('#profile-registered')
  if (!button) return
  const profile = readProfile()
  const meta = document.querySelector('#profile-registered-meta')
  button.hidden = !profile
  if (!profile) {
    if (meta) meta.textContent = ''
    button.removeAttribute('aria-label')
    return
  }
  const role = profile.role === 'teacher' ? text.teacher : text.child
  const line = text.registeredMeta.replaceAll('{name}', profile.name).replaceAll('{role}', role)
  if (meta) meta.textContent = line
  button.setAttribute('aria-label', `${text.registered}. ${line}. ${text.registeredEnter}`)
}

function paintHello(text) {
  const profile = readProfile()
  const line = profile ? text.hello.replaceAll('{name}', profile.name) : ''
  const hello = document.querySelector('#welcome-hello')
  const barHello = document.querySelector('#profile-hello')
  if (hello) {
    hello.hidden = !profile
    hello.textContent = line
  }
  if (barHello) {
    barHello.hidden = !profile
    barHello.textContent = line
    barHello.title = line
  }
}

function paintAvatar() {
  const img = document.querySelector('#profile-avatar')
  if (!img) return
  const gender = document.querySelector('input[name="profileGender"]:checked')?.value
  if (gender !== 'boy' && gender !== 'girl') {
    img.hidden = true
    img.removeAttribute('src')
    return
  }
  img.hidden = false
  img.src = getAvatarPath(gender, 1, 'idle')
  img.alt = copy()[gender] || ''
}

function fillRich(el, text, emphasis) {
  const value = text || ''
  const index = emphasis ? value.indexOf(emphasis) : -1
  if (index < 0) {
    el.textContent = value
    return
  }
  const em = document.createElement('em')
  em.textContent = emphasis
  el.replaceChildren(value.slice(0, index), em, value.slice(index + emphasis.length))
}
