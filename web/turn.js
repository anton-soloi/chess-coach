// Nivelul Turn — A. Gândirea și decizia, B. Procedee, C. Tipare noi de mat, D. Combinații, E. Atacul la rege, F. Finaluri de pioni, G. Finaluri simple de turn.
// Fiecare subcapitol are un test pe tablă: copilul marchează, alege sau calculează
// fără ca piesele să se miște, până când proba cere explicit pasul următor.

import { Chess } from './vendor/chess.js'

const A1_FEN = 'rnbqkbnr/p1pp1ppp/8/1p2p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 2'
const A2_FEN = '4r1k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1'
const A3_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1'
const A4_FEN = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2'
const A5_FEN = '4k3/4p3/8/8/8/8/8/4R1K1 w - - 0 1'
const A6_FEN = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
const A8_FEN = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
const A9_QUIET = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1'
const A9_TACTIC = 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1'
const A10_BEFORE = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 1 2'
const A7_KEEP = '4q3/5k2/8/8/Q7/3B4/8/6K1 w - - 0 1'
const A7_TRADE = '3kr3/5p2/8/8/8/P7/5PK1/4R3 w - - 0 1'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const B1_ABS = '4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1'
const B1_REL = '2kq4/8/5n2/6B1/8/8/8/4K3 b - - 0 1'
const B1_USE = '4k3/8/2n5/QB6/8/8/8/4K3 b - - 0 1'
const B2_FEN = '3k4/q7/2n5/4N3/8/8/5Q2/4K3 w - - 0 1'
const B3_FEN = 'k7/pp6/8/3N4/8/8/8/3Q2K1 w - - 0 1'
const B4_ATTACK = '4k3/8/8/b7/8/8/2P5/4K3 w - - 0 1'
const B4_DEFENSE = '6k1/8/8/r4q2/8/2N5/8/3RK3 w - - 0 1'
const B5_FEN = 'k7/p4p2/2PB4/8/8/6p1/7P/4K2R w - - 0 1'
const B6_FEN = 'k1N5/pp1Q4/8/8/8/8/8/R5K1 w - - 0 1'
const B7_FEN = '6k1/5qpp/8/8/Q7/8/4R3/6K1 w - - 0 1'
const B8_FEN = '4k2r/8/8/8/Q7/8/8/6K1 w - - 0 1'
const B9_FEN = '7k/5Q2/8/8/8/8/8/6qK w - - 0 1'

const C1_FEN = '3qk3/3p1p2/8/7Q/2B5/8/8/4K3 w - - 0 1'
const C2_FEN = '7k/8/4N3/6Q1/8/8/8/6K1 w - - 0 1'
const C3_FEN = '5rk1/5pp1/8/6NQ/8/8/8/6K1 w - - 0 1'
const C4_FEN = '1RN5/2N5/1P6/k7/8/P7/1N6/7K w - - 0 1'
const C4_FLIGHTS = new Set(['a4', 'a6', 'b4', 'b5'])

const D1_FEN = '4k3/8/8/b3r2Q/8/8/8/6K1 w - - 0 1'
const D2_FEN = '4k3/8/2n5/1B2r3/8/8/4Q3/6K1 w - - 0 1'
const D3_FEN = '4k3/8/8/7Q/8/8/8/R5K1 w - - 0 1'
const D4_FEN = '7k/8/8/8/8/8/6q1/6QK w - - 0 1'

const E1_FEN = '4k3/pppp1ppp/8/8/8/8/PPPP1PPP/R5K1 w - - 0 1'
const E2_FEN = '6k1/5pp1/7p/8/8/8/5PPP/3Q2K1 w - - 0 1'
const E3_FEN = 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/2KR3R w - - 0 1'
const E4_FEN = '5rk1/5p1p/6p1/6N1/7Q/8/8/6K1 w - - 0 1'
const E5_FEN = '6k1/2b3N1/8/7q/8/4p3/3n4/6K1 w - - 0 1'

const F1_IN = '4k3/8/8/8/P7/8/8/7K w - - 0 1'
const F1_OUT = '6k1/8/8/8/P7/8/8/7K w - - 0 1'
const F2_FEN = '8/8/4k3/8/3K4/8/7P/8 w - - 0 1'
const F3_FEN = '3k4/8/4P3/8/4K3/8/8/8 w - - 0 1'
const F3_KEY = '3k4/5K2/4P3/8/8/8/8/8 w - - 0 1'
const F4_FEN = 'k7/8/PK6/8/8/8/8/8 w - - 0 1'
const F5_FEN = '8/4k3/8/4K3/4P3/8/8/8 b - - 0 1'
const F5_REPLY = { d8: ['Kd8', 'Kd6'], e8: ['Ke8', 'Ke6'], f8: ['Kf8', 'Kf6'], d7: ['Kd7', 'Kf6'], f7: ['Kf7', 'Kd6'] }
const F6_FEN = '8/2k3pp/8/8/P3P3/3P4/6PP/2K5 w - - 0 1'

const G1_FEN = '4k3/p7/8/8/3P4/8/8/5RK1 w - - 0 1'
const G2_FEN = '8/8/8/8/7R/8/pk6/3K4 w - - 0 1'
const G3_FEN = '8/8/8/2k5/8/1K6/p6R/8 w - - 0 1'
const G4_FEN = '4k2r/8/3K4/4P3/8/8/8/R7 w - - 0 1'
const G5_FEN = '4K3/4P3/2k5/8/8/8/5r2/R7 w - - 0 1'
const G6_FEN = '4k3/8/r7/3KP3/8/8/8/7R b - - 0 1'
const G7_FEN = '8/8/8/4k3/R7/8/7P/6K1 w - - 0 1'
const G8_FEN = 'R7/8/8/8/ppk5/8/4K3/8 w - - 0 1'
const G9_FEN = 'k6r/8/P7/3K4/8/8/8/7R b - - 0 1'

const A3_GOOD = new Set(['c3', 'f3', 'c4', 'd4'])

function afterMove(fen, move) {
  const chess = new Chess(fen)
  chess.move(move)
  return chess.fen()
}

function sameSet(picked, expected) {
  if (picked.size !== expected.size) return false
  for (const square of expected) {
    if (!picked.has(square)) return false
  }
  return true
}

function grade(api, id, ok, text) {
  api.silence()
  api.verdict(ok, text)
  if (!ok) {
    api.actions([{ label: 'Mai încerc', onClick: () => openTurnChapter(id, api) }])
  }
}

function toggle(picked, square) {
  if (picked.has(square)) picked.delete(square)
  else picked.add(square)
}

const CHAPTERS = {
  'tn-a1': {
    code: 'A1',
    title: 'A1. Identificarea mutărilor forțate',
    open: openA1,
  },
  'tn-a2': {
    code: 'A2',
    title: 'A2. Identificarea amenințării adversarului',
    open: openA2,
  },
  'tn-a3': {
    code: 'A3',
    title: 'A3. Stabilirea mutărilor candidate',
    open: openA3,
  },
  'tn-a4': {
    code: 'A4',
    title: 'A4. Calculul variantelor și al celui mai bun răspuns al adversarului',
    open: openA4,
  },
  'tn-a5': {
    code: 'A5',
    title: 'A5. Calculul până la poziția stabilă',
    open: openA5,
  },
  'tn-a6': {
    code: 'A6',
    title: 'A6. Compararea variantelor',
    open: openA6,
  },
  'tn-a7': {
    code: 'A7',
    title: 'A7. Schimbul pieselor',
    open: openA7,
  },
  'tn-a8': {
    code: 'A8',
    title: 'A8. Verificarea mutării înainte de executare',
    open: openA8,
  },
  'tn-a9': {
    code: 'A9',
    title: 'A9. Calculul fără mutarea pieselor',
    open: openA9,
  },
  'tn-a10': {
    code: 'A10',
    title: 'A10. Recunoașterea momentului în care trebuie să calculeze',
    open: openA10,
  },
  'tn-a11': {
    code: 'A11',
    title: 'A11. Evaluarea rezultatului calculului',
    open: openA11,
  },
  'tn-b1': {
    code: 'B1',
    title: 'B1. Legarea',
    open: openB1,
  },
  'tn-b2': {
    code: 'B2',
    title: 'B2. Eliminarea apărătorului',
    open: openB2,
  },
  'tn-b3': {
    code: 'B3',
    title: 'B3. Ademenirea',
    open: openB3,
  },
  'tn-b4': {
    code: 'B4',
    title: 'B4. Intercepția',
    open: openB4,
  },
  'tn-b5': {
    code: 'B5',
    title: 'B5. Eliberarea unei linii',
    open: openB5,
  },
  'tn-b6': {
    code: 'B6',
    title: 'B6. Eliberarea unui câmp',
    open: openB6,
  },
  'tn-b7': {
    code: 'B7',
    title: 'B7. Sacrificiul pentru un avantaj concret',
    open: openB7,
  },
  'tn-b8': {
    code: 'B8',
    title: 'B8. Șahul perpetuu',
    open: openB8,
  },
  'tn-b9': {
    code: 'B9',
    title: 'B9. Patul ca resursă tactică',
    open: openB9,
  },
  'tn-c1': {
    code: 'C1',
    title: 'C1. Matul lui Lolli',
    open: openC1,
  },
  'tn-c2': {
    code: 'C2',
    title: 'C2. Matul Kiss of Death',
    open: openC2,
  },
  'tn-c3': {
    code: 'C3',
    title: 'C3. Matul cu sacrificiu pe h7',
    open: openC3,
  },
  'tn-c4': {
    code: 'C4',
    title: 'C4. Matul prin restrângerea câmpurilor',
    open: openC4,
  },
  'tn-d1': {
    code: 'D1',
    title: 'D1. Structura unei combinații',
    open: openD1,
  },
  'tn-d2': {
    code: 'D2',
    title: 'D2. Combinații pentru câștig material',
    open: openD2,
  },
  'tn-d3': {
    code: 'D3',
    title: 'D3. Combinații pentru atacul regelui',
    open: openD3,
  },
  'tn-d4': {
    code: 'D4',
    title: 'D4. Combinații defensive',
    open: openD4,
  },
  'tn-d5': {
    code: 'D5',
    title: 'D5. Combinația și calculul',
    open: openD5,
  },
  'tn-e1': {
    code: 'E1',
    title: 'E1. Regele în centru',
    open: openE1,
  },
  'tn-e2': {
    code: 'E2',
    title: 'E2. Regele rocat pe aceeași parte',
    open: openE2,
  },
  'tn-e3': {
    code: 'E3',
    title: 'E3. Regii rocați pe părți opuse',
    open: openE3,
  },
  'tn-e4': {
    code: 'E4',
    title: 'E4. Construirea atacului la rege',
    open: openE4,
  },
  'tn-e5': {
    code: 'E5',
    title: 'E5. Apărarea împotriva atacului la rege',
    open: openE5,
  },
  'tn-f1': {
    code: 'F1',
    title: 'F1. Regula pătratului',
    open: openF1,
  },
  'tn-f2': {
    code: 'F2',
    title: 'F2. Opoziția',
    open: openF2,
  },
  'tn-f3': {
    code: 'F3',
    title: 'F3. Pătrate corespondente',
    open: openF3,
  },
  'tn-f4': {
    code: 'F4',
    title: 'F4. Regula pionului de turn',
    open: openF4,
  },
  'tn-f5': {
    code: 'F5',
    title: 'F5. Zugzwang',
    open: openF5,
  },
  'tn-f6': {
    code: 'F6',
    title: 'F6. Crearea și utilizarea pionului liber',
    open: openF6,
  },
  'tn-g1': {
    code: 'G1',
    title: 'G1. Principiile generale ale finalului de turn',
    open: openG1,
  },
  'tn-g2': {
    code: 'G2',
    title: 'G2. Turn contra pion',
    open: openG2,
  },
  'tn-g3': {
    code: 'G3',
    title: 'G3. Regele și turnul împotriva regelui și pionului',
    open: openG3,
  },
  'tn-g4': {
    code: 'G4',
    title: 'G4. Turn și pion contra turn',
    open: openG4,
  },
  'tn-g5': {
    code: 'G5',
    title: 'G5. Poziția Lucena',
    open: openG5,
  },
  'tn-g6': {
    code: 'G6',
    title: 'G6. Poziția Philidor',
    open: openG6,
  },
  'tn-g7': {
    code: 'G7',
    title: 'G7. Șahurile din spate și din lateral',
    open: openG7,
  },
  'tn-g8': {
    code: 'G8',
    title: 'G8. Turnul împotriva pionilor',
    open: openG8,
  },
  'tn-g9': {
    code: 'G9',
    title: 'G9. Poziții de remiză în finalurile de turn',
    open: openG9,
  },
}


export function isTurnChapter(id) {
  return Object.prototype.hasOwnProperty.call(CHAPTERS, id)
}

export function openTurnChapter(id, api) {
  const chapter = CHAPTERS[id]
  api.badge(chapter.code)
  api.title(chapter.title)
  api.silence()
  api.clearResult()
  chapter.open(api, id)
}

export function describeTurnChapter(id) {
  const chapter = CHAPTERS[id]
  if (!chapter) return null
  const captured = captureOpening(chapter.open, id)
  return {
    id,
    code: chapter.code,
    title: chapter.title,
    definition: captured.prompt,
    prompt: captured.prompt,
    fen: captured.fen,
    solutie: '',
    bad: '',
    ok: '',
    accept: captured.accept,
  }
}

function captureOpening(open, id) {
  let fen = ''
  let prompt = ''
  let listener = null
  let rejected = false
  const api = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'show') {
        return (nextFen, text) => {
          if (fen) return
          fen = String(nextFen || '')
          prompt = String(text || '')
        }
      }
      if (prop === 'listen') {
        return (fn) => {
          if (!listener) listener = fn
        }
      }
      if (prop === 'status') return () => { rejected = true }
      if (prop === 'fen') return () => fen
      return () => {}
    },
  })
  try {
    open(api, id)
  } catch {
    // Prima poziție ajunge pentru ecranul unic.
  }
  return { fen, prompt, accept: pieceClickAccept(listener, prompt, () => rejected, (value) => { rejected = value }) }
}

function pieceClickAccept(listener, prompt, isRejected, setRejected) {
  if (!listener || !/apasă\s+piesa|marchează\s+piesa/i.test(prompt)) return null
  const targets = []
  for (const file of 'abcdefgh') {
    for (let rank = 1; rank <= 8; rank += 1) {
      const square = file + rank
      setRejected(false)
      try {
        listener(square)
      } catch {
        setRejected(true)
      }
      if (!isRejected()) targets.push(square)
    }
  }
  if (!targets.length || targets.length > 8) return null
  return (square) => targets.includes(square)
}

function openA1(api, id) {
  const picked = new Set()
  api.show(
    A1_FEN,
    'Verifică în ordine: șahuri, capturi, amenințări. Marchează toate mutările forțate relevante — câmpul unde ajunge piesa — și abia apoi apasă Gata.',
  )
  api.listen((square) => {
    toggle(picked, square)
    api.mark(picked)
  })
  api.actions([{
    label: 'Gata',
    onClick: () => {
      const ok = sameSet(picked, new Set(['f7', 'b5', 'h5']))
      grade(
        api,
        id,
        ok,
        ok
          ? 'f7 este șah și captură (Bxf7+). b5 este captură, fără șah. h5 este amenințarea: dama atacă e5 și f7.'
          : 'Lipsesc sau prisosesc câmpuri. Cele trei sunt f7 (șah și captură), b5 (captură) și h5 (amenințare).',
      )
    },
  }])
}

function openA2(api, id) {
  api.show(
    A2_FEN,
    'Înainte de mutarea ta, răspunde: ce vrea să facă adversarul la mutarea următoare? Apasă câmpul amenințării.',
  )
  api.listen((square) => {
    if (square !== 'e1') {
      api.status('Turnul negru vrea să intre pe prima linie. Caută câmpul din fața regelui alb.')
      return
    }
    api.silence()
    api.mark(new Set(['e1']))
    api.prompt('Ai găsit câmpul. De ce este periculoasă amenințarea?')
    api.actions([
      { label: 'Ia un pion, nimic mai mult', onClick: () => grade(api, id, false, 'Nu este o captură de pion. Turnul pe e1 dă mat.') },
      { label: 'Dă mat pe linia 1', onClick: () => grade(api, id, true, 'Re1 este mat. Pionii f2, g2 și h2 îi iau regelui alb ieșirea, iar turnul acoperă linia 1.') },
      { label: 'Mută regele negru', onClick: () => grade(api, id, false, 'Amenințarea este o mutare de turn, nu de rege.') },
    ])
  })
}

function openA3(api, id) {
  const picked = new Set()
  api.show(
    A3_FEN,
    'Nu începe calculul la întâmplare. Alege 2–3 mutări candidate — câmpurile unde ajung piesele — și abia apoi apasă Gata.',
  )
  api.listen((square) => {
    toggle(picked, square)
    api.mark(picked)
  })
  api.actions([{
    label: 'Gata',
    onClick: () => {
      const extras = [...picked].filter((square) => !A3_GOOD.has(square))
      const ok = extras.length === 0 && picked.size >= 2 && picked.size <= 3
      grade(
        api,
        id,
        ok,
        ok
          ? 'Candidatele bune de aici sunt Nf3, Nc3, Bc4 și d4. Le compari după ce le-ai ales, nu înainte.'
          : 'Alege două sau trei dintre c3, f3, c4 și d4. O mutare de margine nu intră încă în calcul.',
      )
    },
  }])
}

function openA4(api, id) {
  api.show(
    A4_FEN,
    'Varianta a început cu dama albă pe h5. Calculează cel mai bun răspuns al negrului, nu răspunsul pe care ți-l dorești. Apasă câmpul lui.',
  )
  api.listen((square) => {
    if (square === 'g6') {
      api.status('g6 alungă dama, dar nu dezvoltă o piesă. Caută mutarea care atacă dama și scoate calul.')
      return
    }
    if (square !== 'f6') {
      api.status('Răspunsul care atacă dama și dezvoltă o piesă ajunge pe f6.')
      return
    }
    grade(api, id, true, 'Nf6 atacă dama și dezvoltă calul. Varianta se calculează de la mutarea adversarului cel mai bun, nu de la mutarea comodă.')
  })
}

function openA5(api, id) {
  api.show(
    A5_FEN,
    'Nu te opri la câștigul aparent. Rxe7+ ia un pion cu șah. Apasă câmpul capturii, apoi continuă până când secvența s-a terminat.',
  )
  api.listen((square) => {
    if (square !== 'e7') {
      api.status('Captura cu șah ajunge pe e7.')
      return
    }
    api.show(
      afterMove(A5_FEN, 'Rxe7+'),
      'Turnul a luat pionul și dă șah. Care este cel mai puternic răspuns al regelui? Apasă câmpul.',
    )
    api.listen((reply) => {
      if (reply !== 'e7') {
        api.status('Regele poate lua turnul. Cel mai puternic răspuns este captura de pe e7.')
        return
      }
      api.silence()
      api.prompt('Secvența s-a încheiat. Ce rămâne efectiv pe tablă?')
      api.actions([
        { label: 'Am câștigat un pion', onClick: () => grade(api, id, false, 'Pionul a fost luat, dar regele ia turnul. Câștigul aparent dispare.') },
        { label: 'Turn pentru un pion', onClick: () => grade(api, id, true, 'După Kxe7 rămân doi regi. Albul a dat turnul pentru un pion. Poziția tactică s-a stabilizat.') },
        { label: 'Este mat', onClick: () => grade(api, id, false, 'Nu este mat. Regele negru ia turnul și iese din șah.') },
      ])
    })
  })
}

function openA6(api, id) {
  api.show(
    A6_FEN,
    'Compară două variante. A: Nxe5, apoi dama neagră poate veni pe e7. B: Nc3, calul din f3 rămâne la locul lui. Care este mai bună?',
  )
  api.actions([
    { label: 'Varianta A · Nxe5', onClick: () => grade(api, id, false, 'Nxe5 ia un pion, dar Qe7 atacă calul. Varianta B păstrează piesa și dezvoltă.') },
    {
      label: 'Varianta B · Nc3',
      onClick: () => {
        api.prompt('De ce este Nc3 mai bună decât Nxe5?')
        api.actions([
          { label: 'Material: calul din e5 rămâne atacat', onClick: () => grade(api, id, true, 'Nxe5 câștigă un pion doar pe moment. Qe7 atacă calul, deci materialul nu este sigur. Nc3 dezvoltă și lasă calul pe f3.') },
          { label: 'Nc3 dă mat', onClick: () => grade(api, id, false, 'Nc3 nu dă mat. Este mai bună pentru că nu lasă calul atacat.') },
          { label: 'Regele alb este în șah după Nc3', onClick: () => grade(api, id, false, 'Nc3 nu dă șah și nu primește șah. Motivul este calul atacat din varianta A.') },
        ])
      },
    },
  ])
}

function openA7(api, id) {
  api.show(
    A7_KEEP,
    'Schimbul este o decizie pe poziție, nu o regulă că schimbul este bun. Dama și nebunul atacă. Apasă piesa pe care ai putea să o schimbi.',
  )
  api.listen((square) => {
    if (square !== 'a4' && square !== 'e8') {
      api.status('Damele se pot schimba: a ta este pe a4, a negrului pe e8.')
      return
    }
    api.silence()
    api.mark(new Set(['a4', 'e8']))
    api.prompt('Ce piesă este în joc, și ce decizie iei?')
    api.actions([
      { label: 'Păstrez dama: schimbul îmi slăbește atacul', onClick: () => openA7Trade(api, id) },
      { label: 'Schimb, pentru că schimbul este bun', onClick: () => grade(api, id, false, 'Schimbul nu este automat bun. După Qxe8+ Kxe8 rămâi cu nebunul, iar nebunul singur nu dă mat. Pierzi atacul și nu câștigi nimic. Schimbul îi este favorabil negrului.') },
      { label: 'Schimb nebunul', onClick: () => grade(api, id, false, 'Piesa despre care decizi este dama. Nebunul rămâne oricum, dar singur nu poate încheia atacul.') },
    ])
  })
}

function openA7Trade(api, id) {
  api.show(
    A7_TRADE,
    'Aici ai un pion în plus. Turnul negru de pe e8 este piesa lui activă. Apasă schimbul.',
  )
  api.listen((square) => {
    if (square !== 'e8') {
      api.status('Turnul din e1 ia turnul din e8.')
      return
    }
    api.silence()
    api.show(
      afterMove(afterMove(A7_TRADE, 'Rxe8+'), 'Kxe8'),
      'Cel mai bun răspuns este Kxe8. Turnurile au dispărut. Cui îi este favorabil schimbul?',
    )
    api.actions([
      { label: 'Mie: final cu pion în plus', onClick: () => grade(api, id, true, 'La dame ai păstrat: ai fi pierdut atacul și nu câștigai nimic. La turnuri schimbi. Pierzi turnul tău, scoți piesa activă a adversarului și rămâi cu un pion în plus. Schimbul te apropie de finalul favorabil și nu îți slăbește un atac.') },
      { label: 'Negrului, ca la schimbul de dame', onClick: () => grade(api, id, false, 'La dame, schimbul îți lua atacul. Aici nu ai un atac de piese care să cadă. Rămâi cu pionul în plus, fără turnul activ al negrului.') },
      { label: 'Păstrez turnul ca să atac', onClick: () => grade(api, id, false, 'Turnul negru este piesa care îți ține jocul deschis. Schimbul o elimină și te duce spre finalul în care pionul în plus contează.') },
    ])
  })
}

function openA8(api, id) {


  api.show(
    A6_FEN,
    'Ultima verificare, înainte să execuți Nxe5: ce poate face adversarul imediat după mutarea mea? Apasă câmpul răspunsului tactic cel mai periculos.',
  )
  api.listen((square) => {
    if (square === 'e4') {
      api.status('Nxe4 ia pionul înapoi. Mai periculos este atacul asupra calului care tocmai a sărit pe e5.')
      return
    }
    if (square !== 'e7') {
      api.status('Caută câmpul de unde dama atacă calul de pe e5: e7.')
      return
    }
    grade(api, id, true, 'Qe7 atacă calul de pe e5. Înainte de execuție verifici șahul, captura, amenințarea și piesa lăsată neapărată.')
  })
}

function openA9(api, id) {
  const steps = ['d8', 'f7']
  const seen = []
  api.show(
    A8_FEN,
    'Nu muta piesele. Calculează în minte Qd8+ Kf7. Apasă întâi câmpul damei la sfârșitul variantei, apoi câmpul regelui negru.',
  )
  api.listen((square) => {
    const expect = steps[seen.length]
    if (square !== expect) {
      api.status(seen.length === 0 ? 'Dama ajunge pe d8. Piesele de pe tablă rămân nemișcate.' : 'După Qd8+, regele negru ajunge pe f7.')
      return
    }
    seen.push(square)
    api.mark(new Set(seen))
    if (seen.length === 2) {
      grade(api, id, true, 'Poziția finală, ținută în minte: dama pe d8, regele negru pe f7. Tabla nu s-a mișcat.')
    }
  })
}

function openA10(api, id) {
  const rounds = [
    { fen: START_FEN, need: false, name: 'Poziția inițială' },
    { fen: A9_QUIET, need: false, name: 'După 1.e4 e5' },
    { fen: A9_TACTIC, need: true, name: 'Dama și nebunul privesc spre f7' },
  ]
  const marks = []

  function ask(index) {
    const round = rounds[index]
    api.show(
      round.fen,
      `Proba ${index + 1} din 3 · ${round.name}. Nu orice poziție cere un calcul lung. Aici începi un calcul tactic?`,
    )
    api.actions([
      { label: 'Aici calculez', onClick: () => next(true) },
      { label: 'Încă nu calculez', onClick: () => next(false) },
    ])

    function next(answer) {
      marks.push(answer === round.need)
      if (index < rounds.length - 1) {
        ask(index + 1)
        return
      }
      const found = marks.every(Boolean)
      if (!found) {
        grade(api, id, false, 'Calculul începe la a treia poziție: f7 poate fi luat cu șah. Poziția inițială și 1.e4 e5 nu au încă o mutare forțată.')
        return
      }
      api.show(A9_TACTIC, 'Ai găsit poziția. De ce aici trebuie să calculezi?')
      api.actions([
        { label: 'Rege pe diagonală și mutare forțată pe f7', onClick: () => grade(api, id, true, 'Semnalul este dublu: regele stă pe diagonală, iar Bxf7+ și Qxf7# sunt mutări forțate. Atunci începe calculul.') },
        { label: 'Pentru că s-a mutat pionul din e2', onClick: () => grade(api, id, false, 'Pionul din e4 singur nu cere calcul. Semnalul este f7, unde dama și nebunul pot lua cu șah.') },
        { label: 'Nu există nimic de calculat', onClick: () => grade(api, id, false, 'Există: f7 este atacat de nebun și de damă, iar Qxf7 este mat.') },
      ])
    }
  }

  ask(0)
}

function openA11(api, id) {
  api.show(
    afterMove(A10_BEFORE, 'Qxe5+'),
    'Ai calculat Qxe5+. Evaluează rezultatul: ce ai câștigat și ce ai pierdut?',

  )
  api.actions([
    { label: 'Un pion, iar dama de pe e5 este atacată', onClick: () => grade(api, id, true, 'Material: un pion în plus. Nu este mat. Qe7 atacă dama, deci avantajul se verifică înainte să fie numit combinație câștigată.') },
    { label: 'Mat', onClick: () => grade(api, id, false, 'Qxe5+ este șah, nu mat. Negrul poate răspunde, iar dama de pe e5 este atacată.') },
    { label: 'Dama s-a pierdut pe loc', onClick: () => grade(api, id, false, 'Dama nu este luată imediat. Este atacată după Qe7, deci trebuie mutată sau apărată. Câștigul concret este pionul.') },
  ])
}

function openB1(api, id) {
  api.show(
    B1_ABS,
    'Legătură absolută: piesa nu se poate muta, pentru că în spate stă regele. Apasă piesa legată.',
  )
  api.listen((square) => {
    if (square !== 'c6') {
      api.status('Nebunul din b5 leagă o piesă de regele din e8. Caută piesa din mijloc.')
      return
    }
    api.silence()
    api.mark(new Set(['c6']))
    api.prompt('Ce fel de legătură este pe c6?')
    api.actions([
      { label: 'Absolută: calul nu se poate muta', onClick: () => openB1Relative(api, id) },
      { label: 'Relativă: calul poate muta, dar pierde dama', onClick: () => grade(api, id, false, 'Pe c6 regele stă în spatele calului. Legătura este absolută: calul nu are nicio mutare legală.') },
      { label: 'Nu este legătură', onClick: () => grade(api, id, false, 'Calul din c6 stă între nebunul din b5 și regele din e8. Este legătură absolută.') },
    ])
  })
}

function openB1Relative(api, id) {
  api.show(
    B1_REL,
    'Legătură relativă: piesa se poate muta, dar în spate stă o piesă mai valoroasă. Apasă piesa legată.',
  )
  api.listen((square) => {
    if (square !== 'f6') {
      api.status('Nebunul din g5, calul din f6 și dama din d8 stau pe aceeași diagonală. Regele nu este pe linie.')
      return
    }
    api.silence()
    api.mark(new Set(['f6']))
    api.prompt('Ce fel de legătură este pe f6?')
    api.actions([
      { label: 'Relativă: calul poate muta, dar pierde dama', onClick: () => openB1Use(api, id) },
      { label: 'Absolută: calul nu se poate muta', onClick: () => grade(api, id, false, 'Regele stă pe c8, nu pe diagonală. Calul se poate muta. Dacă pleacă, nebunul ia dama. Legătura este relativă.') },
      { label: 'Nu este legătură', onClick: () => grade(api, id, false, 'Calul din f6 stă între nebun și damă. Este legătură relativă.') },
    ])
  })
}

function openB1Use(api, id) {
  api.show(
    B1_USE,
    'Exploatarea legăturii. Dama albă stă pe a5, în bătaia calului din c6. De ce nu o poate lua?',
  )
  api.actions([
    { label: 'Calul este legat de rege', onClick: () => grade(api, id, true, 'Legătura absolută îl oprește pe cal să ia dama. Poți lăsa dama pe a5. Relativă era când în spate stătea dama, nu regele.') },
    { label: 'Dama este apărată de regele alb', onClick: () => grade(api, id, false, 'Regele alb este pe e1 și nu apără a5. Dama rămâne pentru că piesa care ar lua-o este legată.') },
    { label: 'Calul poate lua dama', onClick: () => grade(api, id, false, 'Nxa5 nu este legală. Calul din c6 este legat absolut de regele din e8.') },
  ])
}

function openB2(api, id) {
  api.show(
    B2_FEN,
    'Dama de pe a7 este apărată. Dacă o iei direct, apărătorul o recaptură. Apasă apărătorul.',
  )
  api.listen((square) => {
    if (square === 'a7') {
      api.status('Qxa7 pierde dama: calul din c6 o ia înapoi. Mai întâi elimină apărătorul.')
      return
    }
    if (square !== 'c6') {
      api.status('Cine apără dama din a7? Calul negru.')
      return
    }
    api.show(
      afterMove(B2_FEN, 'Nxc6+'),
      'Apărătorul a căzut cu șah. Ținta a rămas fără apărare. Apasă ținta.',
    )
    api.listen((target) => {
      if (target !== 'a7') {
        api.status('Dama de pe a7 nu mai are apărător. Acela este câmpul.')
        return
      }
      grade(api, id, true, 'Întâi dispare apărătorul, apoi ținta. Nxc6+ ia calul cu șah, iar Qxa7 câștigă dama rămasă singură.')
    })
  })
}

function openB3(api, id) {
  api.show(
    B3_FEN,
    'Ademenirea aduce piesa adversă pe un câmp rău. Nu o scoate dintr-o apărare. Apasă șahul care îl obligă pe rege.',
  )
  api.listen((square) => {
    if (square !== 'c7') {
      api.status('Calul din d5 poate sări cu șah pe c7. Regele este obligat să iasă.')
      return
    }
    api.show(
      afterMove(afterMove(B3_FEN, 'Nc7+'), 'Kb8'),
      'Regele a fost adus pe b8. Apasă câmpul matului.',
    )
    api.listen((mate) => {
      if (mate !== 'd8') {
        api.status('Dama vine pe d8. De acolo dă mat regelui adus pe b8.')
        return
      }
      grade(api, id, true, 'Nc7+ îl aduce pe rege pe b8, iar Qd8 este mat. La deviație ai fi scos o piesă din post. Aici ai adus regele unde nu poate sta.')
    })
  })
}

function openB4(api, id) {
  api.show(
    B4_ATTACK,
    'Ești în șah pe diagonală. Nu captura nebunul și nu fugi cu regele. Întrerupe linia de atac. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square !== 'c3') {
      api.status('Pionul din c2 poate închide diagonala pe c3. Între nebun și rege rămâne o piesă de-a ta.')
      return
    }
    api.show(
      B4_DEFENSE,
      'Turnul din a5 apără dama din f5. Nu captura dama. Apasă câmpul care întrerupe linia de apărare.',
    )
    api.listen((block) => {
      if (block === 'f5') {
        api.status('Dama este apărată cât timp linia rămâne deschisă. Întrerupe linia, nu o captura.')
        return
      }
      if (block !== 'd5') {
        api.status('Între a5 și f5 stă d5. Acolo întrerupi legătura dintre turn și damă.')
        return
      }
      api.silence()
      api.prompt('Când pui o piesă pe drumul pe care ar fugi regele, ce linie întrerupi?')
      api.actions([
        { label: 'Linia de retragere', onClick: () => grade(api, id, true, 'Trei linii se întrerup la fel, fără captură: atacul (c3), apărarea (d5) și retragerea regelui. Tai legătura dintre două câmpuri.') },
        { label: 'Trebuie să capturez piesa', onClick: () => grade(api, id, false, 'Captura nu este obligatorie. Pe c3 și pe d5 ai pus o piesă între două piese care se vedeau.') },
        { label: 'Doar linia de atac se poate întrerupe', onClick: () => grade(api, id, false, 'Și apărarea, și retragerea se întrerup. Pe d5 ai tăiat apărarea dintre turn și damă.') },
      ])
    })
  })
}

function openB5(api, id) {
  api.show(
    B5_FEN,
    'Turnul vrea coloana h, dar pionul tău o ține închisă. Nu este șah prin descoperire: pionul nu descoperă un șah. Deschide coloana. Apasă câmpul pionului.',
  )
  api.listen((square) => {
    if (square === 'h8') {
      api.status('Turnul nu trece de pionul din h2. Mai întâi scoate pionul de pe coloană.')
      return
    }
    if (square !== 'g3') {
      api.status('hxg3 scoate pionul de pe coloana h. Câmpul capturii este g3.')
      return
    }
    api.show(
      afterMove(B5_FEN, 'hxg3'),
      'Coloana este deschisă. La mutarea următoare turnul poate intra. Apasă câmpul lui.',
    )
    api.listen((entry) => {
      if (entry !== 'h8') {
        api.status('Turnul intră pe h8 și dă mat. Pionul doar a eliberat coloana.')
        return
      }
      grade(api, id, true, 'hxg3 eliberează coloana. Rh8 este mat: a7 și b7 sunt ale regelui, iar b8 este acoperit de nebun. Pionul a deschis linia pentru mutarea următoare.')
    })
  })
}

function openB6(api, id) {
  api.show(
    B6_FEN,
    'Dama are nevoie de c8, dar calul stă chiar acolo. Scoate calul de pe câmp, cu șah. Apasă unde sare.',
  )
  api.listen((square) => {
    if (square === 'c8') {
      api.status('Dama nu poate intra cât timp calul stă pe c8. Mai întâi calul pleacă.')
      return
    }
    if (square !== 'b6') {
      api.status('Calul sare pe b6 cu șah și lasă c8 liber pentru damă.')
      return
    }
    api.show(
      afterMove(afterMove(B6_FEN, 'Nb6+'), 'Kb8'),
      'c8 este liber. Apasă câmpul pe care îl ocupă dama.',
    )
    api.listen((entry) => {
      if (entry !== 'c8') {
        api.status('Dama vine exact pe câmpul părăsit de cal: c8.')
        return
      }
      grade(api, id, true, 'Calul a eliberat c8, iar Qc8 este mat. Pionul din a7 nu poate lua calul: este legat de turnul din a1. Câmpul a fost golit ca să fie ocupat de altă piesă.')
    })
  })
}

function openB7(api, id) {
  api.show(
    B7_FEN,
    'Sacrificiul este permis doar dacă obții ceva concret: mat, material, atac decisiv, promovare sau avantaj clar. Apasă câmpul sacrificiului.',
  )
  api.listen((square) => {
    if (square !== 'e8') {
      api.status('Turnul se sacrifică pe e8, cu șah.')
      return
    }
    api.show(
      afterMove(B7_FEN, 'Re8+'),
      'Dama neagră poate lua turnul pe e8. Apasă recapturarea care încheie sacrificiul.',
    )
    api.listen((back) => {
      if (back !== 'e8') {
        api.status('Dama ta ia pe e8. Acolo s-a oprit dama neagră.')
        return
      }
      api.silence()
      api.prompt('Qxe8 este mat. Ce ai obținut cu sacrificiul turnului?')
      api.actions([
        { label: 'Mat', onClick: () => grade(api, id, true, 'Sacrificiul este justificat: Re8+ Qxe8 Qxe8 este mat. Dacă dama se duce pe f8, Rxf8+ tot îți aduce dama. Nu este o mutare făcută doar ca să arate bine.') },
        { label: 'Doar o mutare spectaculoasă', onClick: () => grade(api, id, false, 'Spectacolul nu ajunge. Aici sacrificiul dă mat. Fără rezultat concret, sacrificiul nu se joacă.') },
        { label: 'Nimic concret', onClick: () => grade(api, id, false, 'Rezultatul este concret: mat. Același sacrificiu poate fi justificat și de material, de promovare sau de un atac decisiv.') },
      ])
    })
  })
}

function openB8(api, id) {
  api.show(
    B8_FEN,
    'Albul are doar dama, negrul are și un turn pe h8. Nu căuta câștigul. Apasă câmpul șahului care începe remiza.',
  )
  api.listen((square) => {
    if (square === 'h8') {
      api.status('Turnul nu se ia. Șahurile damei țin regele ocupat.')
      return
    }
    if (square !== 'a8') {
      api.status('Dama din a4 dă șah pe a8.')
      return
    }
    api.show(
      afterMove(afterMove(B8_FEN, 'Qa8+'), 'Kf7'),
      'Regele a ajuns pe f7. Șahul următor se poate repeta. Apasă câmpul lui.',
    )
    api.listen((next) => {
      if (next !== 'b7') {
        api.status('Dama vine pe b7 cu șah. De acolo îl poți trimite pe rege înapoi.')
        return
      }
      api.silence()
      api.prompt('Qa8+ Kf7 Qb7+ Ke8 și dama poate reveni pe a8. Ce procedeu este?')
      api.actions([
        { label: 'Șah perpetuu: remiză', onClick: () => grade(api, id, true, 'Șahurile nu se opresc: Qa8+ și Qb7+ se repetă, iar dama nu poate fi luată. Ești cu un turn în minus, dar șahul perpetuu salvează remiza.') },
        { label: 'Am câștigat turnul', onClick: () => grade(api, id, false, 'Turnul din h8 rămâne pe tablă. Nu câștigi material. Câștigi remiza, pentru că regele nu iese din șahuri.') },
        { label: 'Este mat', onClick: () => grade(api, id, false, 'Nu este mat. Regele are mereu o mutare, dar după ea primește din nou șah.') },
      ])
    })
  })
}

function openB9(api, id) {
  api.show(
    B9_FEN,
    'Ești în șah și poziția este pierdută dacă nu găsești resursa. Nu repeta regula patului: caută mutarea care salvează. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square !== 'g1') {
      api.status('Singura mutare legală ia dama din g1.')
      return
    }
    api.silence()
    api.show(
      afterMove(B9_FEN, 'Kxg1'),
      'Ai luat dama. Uită-te la regele negru din h8. Ce rezultat ai obținut?',
    )
    api.actions([
      { label: 'Remiză prin pat', onClick: () => grade(api, id, true, 'Kxg1 este singura mutare. Negrul nu este în șah și nu are nicio mutare: pat. Nu ai câștigat dama în partidă. Ai salvat remiza dintr-o poziție pierdută.') },
      { label: 'Am câștigat dama și partida', onClick: () => grade(api, id, false, 'Dama a dispărut, dar negrul nu poate muta. Patul este remiză, nu victorie.') },
      { label: 'Mat', onClick: () => grade(api, id, false, 'Regele din h8 nu este în șah. Pionii nu există, iar dama albă îi acoperă toate câmpurile fără să-l atace. Este pat.') },
    ])
  })
}

function openC1(api, id) {
  api.show(
    C1_FEN,
    'Matul lui Lolli lovește slăbiciunea de pe f7. Dama și nebunul se uită acolo. Apasă câmpul matului.',
  )
  api.listen((square) => {
    if (square !== 'f7') {
      api.status('Pionul din f7 stă în bătaia damei din h5 și a nebunului din c4.')
      return
    }
    api.silence()
    api.mark(new Set(['f7']))
    api.prompt('Qxf7 ia pionul și este apărată de nebun. Ce tipar este?')
    api.actions([
      { label: 'Matul lui Lolli', onClick: () => grade(api, id, true, 'Qxf7 este mat. f7 era slăbit: dama și nebunul îl atacă, iar dama din d8 și pionul din d7 îi iau regelui ieșirea. Același desen există pe f2.') },
      { label: 'Regele poate lua dama', onClick: () => grade(api, id, false, 'Regele nu poate lua dama de pe f7. Nebunul din c4 o apără.') },
      { label: 'Dama nu ajunge pe f7', onClick: () => grade(api, id, false, 'Dama din h5 ia pionul pe f7. Drumul h5–g6–f7 este liber.') },
    ])
  })
}

function openC2(api, id) {
  api.show(
    C2_FEN,
    'Kiss of Death: dama ajunge lângă rege și este apărată, așa că regele nu o poate lua. Apasă câmpul ei.',
  )
  api.listen((square) => {
    if (square === 'g8') {
      api.status('Pe g8 dama nu este apărată de cal. Sărutul este pe g7.')
      return
    }
    if (square !== 'g7') {
      api.status('Dama din g5 coboară lângă rege, pe g7. Calul din e6 păzește câmpul.')
      return
    }
    api.silence()
    api.mark(new Set(['g7']))
    api.prompt('Dama stă lângă rege. De ce nu o poate captura?')
    api.actions([
      { label: 'Este apărată de cal', onClick: () => grade(api, id, true, 'Qg7 este mat. Dama stă lângă regele din h8, iar calul din e6 o apără. Regele nu are captură și nu are câmp de fugă.') },
      { label: 'Regele o ia și scapă', onClick: () => grade(api, id, false, 'g7 este păzit de calul din e6. Captura nu este legală.') },
      { label: 'Dama dă mat de departe', onClick: () => grade(api, id, false, 'Dama este pe câmpul vecin, g7. Apropierea și apărarea fac matul.') },
    ])
  })
}

function openC3(api, id) {
  api.show(
    C3_FEN,
    'Sacrificiul pe h7, Greek Gift, se încheie cu dama pe câmpul pionului dispărut. Calul din g5 păzește h7. Apasă mutarea damei.',
  )
  api.listen((square) => {
    if (square !== 'h7') {
      api.status('Dama din h5 intră pe h7. Calul din g5 stă gata să o apere.')
      return
    }
    grade(api, id, true, 'Qh7 este mat. Pionul de pe h7 a fost sacrificat ca să se deschidă câmpul, calul apără dama, iar pionii f7, g7 și turnul din f8 îi iau regelui ieșirea. Același sacrificiu există pe h2.')
  })
}

function openC4(api, id) {
  const picked = new Set()
  api.show(
    C4_FEN,
    'Matul nu stă în piesa lipită de rege. Patru câmpuri de fugă sunt deja luate. Marchează-le, apoi apasă Gata.',
  )
  api.listen((square) => {
    toggle(picked, square)
    api.mark(picked)
  })
  api.actions([{
    label: 'Gata',
    onClick: () => {
      if (!sameSet(picked, C4_FLIGHTS)) {
        grade(api, id, false, 'Câmpurile goale deja controlate sunt a4, a6, b4 și b5. b6 este pionul tău.')
        return
      }
      api.silence()
      api.mark(C4_FLIGHTS)

      api.prompt('Câmpurile sunt închise. Apasă mutarea care dă mat de pe coloană.')
      api.listen((square) => {
        if (square === 'b5') {
          api.status('b5 este deja acoperit. Turnul intră pe a8.')
          return
        }

        if (square !== 'a8') {
          api.status('Turnul din b8 intră pe a8. De acolo ține coloana.')
          return
        }
        grade(api, id, true, 'a4 este luat de calul din b2, a6 și b5 de calul din c7, b4 de pionul din a3. b6 este pionul tău, apărat de calul din c8. Ra8 dă mat fără să se lipească de rege.')
      })
    },
  }])
}

function openD1(api, id) {
  api.show(
    D1_FEN,
    'Combinația este o succesiune forțată prin care exploatezi o slăbiciune și obții un avantaj concret. Apasă slăbiciunea: piesa apărată o singură dată.',
  )
  api.listen((square) => {
    if (square !== 'a5') {
      api.status('Nebunul din a5 este apărat numai de turnul din e5.')
      return
    }
    api.show(
      D1_FEN,
      'Ideea: scoți apărătorul cu șah. Apasă câmpul capturii.',
    )
    api.mark(new Set(['a5']))
    api.listen((idea) => {
      if (idea !== 'e5') {
        api.status('Dama ia turnul pe e5, cu șah.')
        return
      }
      api.show(
        afterMove(afterMove(D1_FEN, 'Qxe5+'), 'Kf8'),

        'Succesiunea este forțată: regele trebuie să iasă din șah. Nebunul a rămas singur. Apasă-l.',
      )
      api.listen((target) => {
        if (target !== 'a5') {
          api.status('Nebunul din a5 nu mai are apărător.')
          return
        }
        api.silence()
        api.prompt('Qxa5 ia nebunul. Care este rezultatul combinației?')
        api.actions([
          { label: 'Câștig material', onClick: () => grade(api, id, true, 'Slăbiciunea era nebunul apărat o singură dată. Ideea: Qxe5+. Succesiunea este forțată, pentru că dă șah. Rezultatul: iei și turnul, și nebunul.') },
          { label: 'Mat', onClick: () => grade(api, id, false, 'Regele mai are mutări. Avantajul concret este materialul: turnul și nebunul.') },
          { label: 'Nu s-a schimbat nimic', onClick: () => grade(api, id, false, 'Au căzut turnul și nebunul. Rezultatul se numără la sfârșitul succesiunii, nu la prima captură.') },
        ])
      })
    })
  })
}

function openD2(api, id) {
  api.show(
    D2_FEN,
    'Procedeele se leagă între ele. Turnul din e5 este apărat de cal, iar calul este legat de rege. Apasă captura.',
  )
  api.listen((square) => {
    if (square === 'c6') {
      api.status('Calul este apărătorul legat. Ținta este turnul din e5.')
      return
    }
    if (square !== 'e5') {
      api.status('Dama din e2 ia turnul pe e5, cu șah.')
      return
    }
    api.silence()
    api.mark(new Set(['e5']))
    api.prompt('Calul nu poate lua dama. Ce legătură de procedee ai folosit?')
    api.actions([
      { label: 'Legare, apoi câștig material', onClick: () => grade(api, id, true, 'Qxe5 ia turnul. Calul din c6 nu recapturează: nebunul din b5 îl leagă de regele din e8. La fel se citesc și celelalte legături: sacrificiu apoi atac dublu, ademenire apoi atac dublu, eliminarea apărătorului, intercepția.') },
      { label: 'Calul poate lua dama', onClick: () => grade(api, id, false, 'Nxe5 nu este legală. Calul ar părăsi diagonala b5–e8, iar nebunul ar da șah.') },
      { label: 'Este mat', onClick: () => grade(api, id, false, 'Este șah, nu mat. Rezultatul concret este turnul.') },
    ])
  })
}

function openD3(api, id) {
  api.show(
    D3_FEN,
    'Atacul regelui continuă numai prin mutări forțate. Apasă primul șah.',
  )
  api.listen((square) => {
    if (square === 'h8' || square === 'e8') {
      api.status('Dama nu încheie din prima. Mai întâi turnul dă șah pe a7.')
      return
    }
    if (square !== 'a7') {
      api.status('Turnul din a1 intră pe a7 cu șah.')
      return
    }
    api.show(
      afterMove(afterMove(D3_FEN, 'Ra7+'), 'Kd8'),
      'Regele a fost obligat să răspundă. Continuă atacul. Apasă matul.',
    )
    api.listen((mate) => {
      if (mate !== 'h8') {
        api.status('Dama din h5 intră pe h8.')
        return
      }
      grade(api, id, true, 'Ra7+ Kd8 Qh8 este mat. Dacă regele merge pe f8, dama tot dă mat. Liniile se deschid și apărarea cade numai dacă fiecare mutare a ta este șah.')
    })
  })
}

function openD4(api, id) {
  api.show(
    D4_FEN,
    'Ești în șah. Combinația poate fi defensivă: scoate piesa care te atacă. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square !== 'g2') {
      api.status('Dama neagră stă pe g2. Acolo o iei.')
      return
    }
    api.silence()
    api.show(
      afterMove(D4_FEN, 'Qxg2'),
      'Dama care dădea șah a dispărut. Ce fel de combinație ai jucat?',
    )
    api.actions([
      { label: 'Defensivă: atacul dispare', onClick: () => grade(api, id, true, 'Qxg2 elimină piesa atacatoare. Nu mai ești în șah. Combinația poate salva, nu numai ataca: sacrificiu defensiv, schimb forțat, șah intermediar, pat sau șah perpetuu.') },
      { label: 'Combinația înseamnă doar atac', onClick: () => grade(api, id, false, 'Aici ai răspuns la șah. Ai scos dama adversă. Combinația a oprit atacul.') },
      { label: 'Este mat', onClick: () => grade(api, id, false, 'Regele negru din h8 nu este în șah. Rezultatul este că atacul lui a dispărut.') },
    ])
  })
}

function openD5(api, id) {
  api.show(
    D3_FEN,
    'Calculează înainte să muți. Care este primul pas al combinației? Apasă câmpul.',
  )
  api.listen((square) => {
    if (square !== 'a7') {
      api.status('Primul pas este șahul de turn pe a7.')
      return
    }
    api.silence()
    api.mark(new Set(['a7']))
    api.prompt('De ce este forțat primul pas?')
    api.actions([
      { label: 'Este șah', onClick: () => openD5Result(api, id) },
      { label: 'Este o mutare liniștită', onClick: () => grade(api, id, false, 'Ra7 dă șah. Negrul nu poate face o mutare de dezvoltare: trebuie să răspundă la șah.') },
      { label: 'Ia o piesă fără șah', onClick: () => grade(api, id, false, 'Pe a7 nu se capturează nimic. Forța mutării vine din șah.') },
    ])
  })
}

function openD5Result(api, id) {
  api.show(
    afterMove(afterMove(D3_FEN, 'Ra7+'), 'Kd8'),
    'Ai văzut primul pas. Care este rezultatul final? Apasă câmpul lui, dacă este mat.',
  )
  api.listen((square) => {
    if (square !== 'h8') {
      api.status('Rezultatul stă pe h8.')
      return
    }
    api.silence()
    api.prompt('Qh8 este mat. Ce ai obținut la capătul calculului?')
    api.actions([
      { label: 'Mat', onClick: () => grade(api, id, true, 'Primul pas este Ra7, forțat pentru că este șah. Rezultatul final este mat: Qh8. Același calcul se face și când rezultatul este material, nu numai mat.') },
      { label: 'Doar un șah', onClick: () => grade(api, id, false, 'Șahul de pe a7 este primul pas. După răspunsul regelui, Qh8 încheie. Rezultatul se judecă la ultima mutare.') },
      { label: 'Remiză', onClick: () => grade(api, id, false, 'Regele nu mai are mutare legală și este în șah. Rezultatul este mat.') },
    ])
  })
}

function openE1(api, id) {
  api.show(
    E1_FEN,
    'Regele negru a rămas în centru. Arată-l.',
  )
  api.listen((square) => {
    if (square !== 'e8') {
      api.status('Regele neînrocat stă pe e8.')
      return
    }
    api.show(
      E1_FEN,
      'Coloana e nu are pioni, iar rocada nu mai există. Activează turnul pe linia vulnerabilă.',
    )
    api.listen((file) => {
      if (file !== 'e1') {
        api.status('Turnul din a1 intră pe e1.')
        return
      }
      api.silence()
      api.show(
        afterMove(E1_FEN, 'Re1+'),
        'Turnul a intrat cu șah. Ce condiții a folosit atacul?',
      )
      api.actions([
        {
          label: 'Centrul e deschis, rocada nu mai există',
          onClick: () => grade(api, id, true, 'Regele stă pe e8, neînrocat, iar coloana e nu are pioni: centrul este deschis. Rocada nu mai există. Re1 activează turnul imediat pe linia vulnerabilă. Șahul lasă regelui doar f8 și d8.'),
        },
        {
          label: 'Regele poate face rocada',
          onClick: () => grade(api, id, false, 'Regele nu mai are rocadă. A rămas în centru, pe coloana e deschisă.'),
        },
        {
          label: 'Închid centrul cu un pion',
          onClick: () => grade(api, id, false, 'Atacul folosește centrul deschis. Turnul merge pe e1, nu închide coloana.'),
        },
      ])
    })
  })
}

function openE2(api, id) {
  api.show(
    E2_FEN,
    'Ambii regi sunt rocați pe aripa regelui. Unde este slăbiciunea negrului?',
  )
  api.listen((square) => {
    if (square !== 'h6') {
      api.status('Pionul de pe h6 este slăbiciunea.')
      return
    }
    api.show(
      E2_FEN,
      'Concentrează dama spre h6. Nu-ți împinge pionii de lângă propriul rege.',
    )
    api.listen((queen) => {
      if (queen !== 'h5') {
        api.status('Dama din d1 vine pe h5.')
        return
      }
      api.silence()
      api.show(
        afterMove(E2_FEN, 'Qh5'),
        'Dama privește spre h6. Cum continui atacul?',
      )
      api.actions([
        {
          label: 'Qh5 atacă h6, fără sacrificiu',
          onClick: () => grade(api, id, true, 'Slăbiciunea este h6, apărat doar de pionul g7. Dama se concentrează pe h5 și deschide atacul spre acel punct. Qxh6 nu este sacrificiu bun: g7 ia dama. Regele tău rămâne în spatele pionilor f2, g2 și h2.'),
        },
        {
          label: 'Sacrific dama pe h6',
          onClick: () => grade(api, id, false, 'Qxh6 pierde dama: pionul din g7 o ia. Sacrificiul se joacă doar când capeți ceva concret.'),
        },
        {
          label: 'Îmi gonesc pionii de lângă rege',
          onClick: () => grade(api, id, false, 'Pionii f2, g2 și h2 îți apără regele. Atacul se face cu dama, spre slăbiciunea h6.'),
        },
      ])
    })
  })
}

function openE3(api, id) {
  api.show(
    E3_FEN,
    'Regii sunt pe aripi opuse. Arată regele pe care îl ataci.',
  )
  api.listen((square) => {
    if (square !== 'g8') {
      api.status('Regele negru este pe g8.')
      return
    }
    api.show(
      E3_FEN,
      'Turnul stă deja pe coloana h. Pornește furtuna de pioni.',
    )
    api.listen((pawn) => {
      if (pawn !== 'h4') {
        api.status('Pionul din h2 merge pe h4.')
        return
      }
      api.silence()
      api.show(
        afterMove(E3_FEN, 'h4'),
        'Furtuna a pornit. Ce alegi?',
      )
      api.actions([
        {
          label: 'Atacul meu e mai rapid: h4 și turnul',
          onClick: () => grade(api, id, true, 'Regii sunt pe părți opuse: al tău pe c1, al lui pe g8. h4 este furtuna de pioni și deschide coloana h; turnul din h1 este deja pe ea. Negrul poate contraataca spre c1 cu pionii a și b, dar încă nu are piesele grele acolo. Alegi atacul, pentru că ești mai rapid.'),
        },
        {
          label: 'Mă apăr întâi pe aripa damei',
          onClick: () => grade(api, id, false, 'Negrul încă nu are piesele grele spre regele tău din c1. Atacul tău pe coloana h este mai rapid.'),
        },
        {
          label: 'Schimb piesele grele',
          onClick: () => grade(api, id, false, 'Cu regii pe aripi opuse, viteza contează. Deschizi linia și aduci turnul, nu schimbi piesele care atacă.'),
        },
      ])
    })
  })
}

function openE4(api, id) {
  api.show(
    E4_FEN,
    'Construiești atacul la rege. Arată ținta.',
  )
  api.listen((square) => {
    if (square !== 'g8') {
      api.status('Ținta este regele din g8.')
      return
    }
    api.silence()
    api.prompt('Care este punctul slab?')
    api.actions([
      { label: 'Punctul slab este h7', onClick: () => openE4Knight(api, id) },
      { label: 'Punctul slab este a2', onClick: () => grade(api, id, false, 'Regele stă pe g8. Punctul slab de lângă el este h7, apărat doar de rege.') },
      { label: 'Punctul slab este e5', onClick: () => grade(api, id, false, 'Atacul se construiește lângă regele din g8. Punctul slab este h7.') },
    ])
  })
}

function openE4Knight(api, id) {
  api.silence()
  api.show(

    E4_FEN,
    'Calul anulează captura regelui pe h7. Arată calul.',
  )
  api.listen((square) => {
    if (square !== 'g5') {
      api.status('Calul din g5 apără h7.')
      return
    }
    api.show(
      E4_FEN,
      'Forțele sunt concentrate. Amenințarea decisivă o dă dama. Apasă câmpul matului.',
    )
    api.listen((mate) => {
      if (mate !== 'h7') {
        api.status('Dama din h4 capturează pe h7.')
        return
      }
      api.show(afterMove(E4_FEN, 'Qxh7#'), 'Qxh7 este mat.')
      grade(api, id, true, 'Ținta este regele din g8. Punctul slab este h7, apărat doar de rege. Dama și calul sunt concentrate: calul îi ia regelui captura pe h7. Qxh7 este amenințarea decisivă, mat.')
    })
  })
}

function openE5(api, id) {
  api.show(
    E5_FEN,
    'Negrul amenință mat. Arată câmpul pe care dama ar da matul.',
  )
  api.listen((square) => {
    if (square !== 'h2') {
      api.status('Dama din h5 amenință Qh2 mat.')
      return
    }
    api.show(
      E5_FEN,
      'Oprește matul: elimină atacatorul înainte să ajungă pe h2.',
    )
    api.listen((defense) => {
      if (defense === 'g2') {
        api.status('Fuga pe g2 nu oprește Qh2 mat.')
        return
      }
      if (defense !== 'h5') {
        api.status('Calul din g7 ia dama de pe h5.')
        return
      }
      api.silence()
      api.show(
        afterMove(E5_FEN, 'Nxh5'),
        'Dama a dispărut. Ce apărare ai folosit?',
      )
      api.actions([
        {
          label: 'Am eliminat atacatorul',
          onClick: () => grade(api, id, true, 'Amenințarea era Qh2 mat: nebunul din c7 apără dama, iar fuga regelui este închisă. Nxh5 elimină atacatorul înainte să dea mat. Blocarea ar fi pus o piesă pe linia h, schimbul ar fi dat o piesă înapoi, iar fuga pe g2 nu oprește matul. Contraatacul este șahul care câștigă timp; aici captura rezolvă.'),
        },
        {
          label: 'Am blocat linia h',
          onClick: () => grade(api, id, false, 'Nu ai pus o piesă între damă și h2. Ai capturat dama de pe h5.'),
        },
        {
          label: 'Am fugit cu regele',
          onClick: () => grade(api, id, false, 'Regele a rămas pe g1. Fuga pe g2 pierde: urmează Qh2 mat. Apărarea a fost captura damei.'),
        },
      ])
    })
  })
}

function openF1(api, id) {
  api.show(
    F1_IN,
    'Pionul aleargă singur. De la a4 până la a8 sunt patru pași, deci pătratul ajunge pe coloana e. Apasă pionul.',
  )
  api.listen((square) => {
    if (square !== 'a4') {
      api.status('Pionul care aleargă este pe a4.')
      return
    }
    api.show(F1_IN, 'Colțul pătratului este e8. Regele stă chiar acolo. Apasă-l.')
    api.listen((king) => {
      if (king !== 'e8') {
        api.status('Regele din pătrat este pe e8.')
        return
      }
      api.silence()
      api.prompt('Regele este în pătrat. Ajunge la pion?')
      api.actions([
        { label: 'Da: regele ajunge la pion', onClick: () => openF1Out(api, id) },
        { label: 'Nu: pionul promovează', onClick: () => grade(api, id, false, 'e8 este colțul pătratului. Regele oprește pionul: îl ia când ajunge pe a8.') },
        { label: 'Pionul este blocat', onClick: () => grade(api, id, false, 'Coloana a este liberă. Întrebarea este dacă regele din e8 intră în pătrat.') },
      ])
    })
  })
}

function openF1Out(api, id) {
  api.silence()
  api.show(
    F1_OUT,
    'Același pion, regele mutat pe g8. Mai este în pătrat? Apasă regele.',
  )
  api.listen((square) => {
    if (square !== 'g8') {
      api.status('Regele este pe g8, dincolo de coloana e.')
      return
    }
    api.silence()
    api.prompt('g8 este în afara pătratului. Ce se întâmplă?')
    api.actions([
      {
        label: 'Pionul promovează',
        onClick: () => grade(api, id, true, 'De la a4 la a8 sunt patru pași, iar pătratul se întinde până pe coloana e. Regele din e8 este în pătrat și oprește pionul. Regele din g8 este în afară, iar pionul promovează. Dacă pionul încă stă pe linia 2, desenezi pătratul ca și cum ar fi înaintat un pas: are pas dublu.'),
      },
      { label: 'Ajunge și de pe g8', onClick: () => grade(api, id, false, 'g8 este în afara pătratului. Regele nu prinde pionul.') },
      { label: 'Este pat', onClick: () => grade(api, id, false, 'Negrul are mutări. Nu prinde pionul, pentru că este în afara pătratului.') },
    ])
  })
}

function openF2(api, id) {
  api.show(
    F2_FEN,
    'Du-ți regele față în față cu regele negru, cu un singur câmp între ei. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square !== 'e4') {
      api.status('Regele din d4 merge pe e4.')
      return
    }
    api.silence()
    api.show(afterMove(F2_FEN, 'Ke4'), 'Acum mută negrul. Cine ține opoziția?')
    api.actions([
      {
        label: 'Cine nu mută',
        onClick: () => grade(api, id, true, 'Ke4 lasă un câmp între regi, pe același șir: opoziția directă. O ține cel care nu mută, deci tu. La distanță, între regi sunt mai multe câmpuri, pe aceeași coloană. Lateral, regii stau pe aceeași linie. Ideea este una: regele care nu mută îl ține pe celălalt departe.'),
      },
      { label: 'Cine mută acum', onClick: () => grade(api, id, false, 'Negrul este la mutare, deci el trebuie să se dea la o parte. Opoziția o ții tu.') },
      { label: 'Cine împinge pionul', onClick: () => grade(api, id, false, 'Opoziția este a regilor, nu a pionului din h2. Regele de pe e4 o ține, pentru că negrul trebuie să mute.') },
    ])
  })
}

function openF3(api, id) {
  api.show(
    F3_FEN,
    'Calculează invers, de la promovare. Unde trebuie să ajungă regele tău ca pionul să promoveze? Apasă mai întâi pionul.',
  )
  api.listen((square) => {
    if (square !== 'e6') {
      api.status('Pionul este pe e6.')
      return
    }
    api.show(F3_FEN, 'Regele negru acoperă d7 și e7. Care este câmpul tău?')
    api.listen((key) => {
      if (key === 'd7' || key === 'e7') {
        api.status('Regele din d8 acoperă d7 și e7.')
        return
      }
      if (key !== 'f7') {
        api.status('Câmpul pe care trebuie să ajungă regele este f7.')
        return
      }
      api.silence()
      api.show(F3_KEY, 'Regele a ajuns pe f7. Apasă mutarea pionului, apărată de rege.')
      api.listen((pawn) => {
        if (pawn !== 'e7') {
          api.status('Pionul merge pe e7. Regele din f7 îl apără.')
          return
        }
        api.silence()
        api.show(afterMove(F3_KEY, 'e7+'), 'Pionul a intrat pe e7 cu șah. Ce ai calculat?')
        api.actions([
          {
            label: 'De pe f7, promovarea este apărată',
            onClick: () => grade(api, id, true, 'Regelui negru din d8 îi corespunde f7. d7 și e7 sunt acoperite de el, f7 nu. Când regele tău ajunge pe f7, e7 este apărat și pionul promovează. Calculul pornește de la promovare și se întoarce la câmpul regelui.'),
          },
          { label: 'Pionul promovează fără rege', onClick: () => grade(api, id, false, 'Fără rege pe f7, negrul ia pionul. Promovarea este apărată numai de acolo.') },
          { label: 'Este deja mat', onClick: () => grade(api, id, false, 'e7 este șah, nu mat. Următorul pas este promovarea, apărată de regele din f7.') },
        ])
      })
    })
  })
}

function openF4(api, id) {
  api.show(
    F4_FEN,
    'Pionul de pe coloana a este pion de turn. Unde stă regele negru? Apasă colțul.',
  )
  api.listen((square) => {
    if (square !== 'a8') {
      api.status('Regele negru este în colțul a8.')
      return
    }
    api.show(F4_FEN, 'Încearcă să împingi pionul. Apasă câmpul.')
    api.listen((pawn) => {
      if (pawn !== 'a7') {
        api.status('Împingerea este a7.')
        return
      }
      api.silence()
      api.show(afterMove(F4_FEN, 'a7'), 'a7 nu promovează. Ce este poziția?')
      api.actions([
        {
          label: 'Remiză: regele din colț ține pionul',
          onClick: () => grade(api, id, true, 'Pionul de turn stă pe coloana a sau h. Dacă regele advers ajunge în colțul de promovare, împingerea este pat: a7 nu dă șah, iar regele din a8 nu are câmp. Aceeași excepție este pe coloana h.'),
        },
        { label: 'Pionul promovează', onClick: () => grade(api, id, false, 'a7 nu este promovare. Regele din colț nu are mutare și nu este în șah: este pat.') },
        { label: 'Este mat', onClick: () => grade(api, id, false, 'Regele nu este în șah. Este pat, deci remiză.') },
      ])
    })
  })
}

function openF5(api, id) {
  api.show(
    F5_FEN,
    'Negrul trebuie să mute și nu poate aștepta. Apasă regele obligat să plece.',
  )
  api.listen((square) => {
    if (square !== 'e7') {
      api.status('Regele negru este pe e7.')
      return
    }
    api.show(F5_FEN, 'Orice plecare îl dă la o parte. Alege una: d8, e8, f8, d7 sau f7.')
    api.listen((flight) => {
      const reply = F5_REPLY[flight]
      if (!reply) {
        api.status('Alege d8, e8, f8, d7 sau f7.')
        return
      }
      api.silence()
      api.show(
        afterMove(afterMove(F5_FEN, reply[0]), reply[1]),
        'Negrul a fost obligat să plece, iar regele tău a intrat. Cum se numește asta?',
      )
      api.actions([
        {
          label: 'Zugzwang: mutarea îi strică poziția',
          onClick: () => grade(api, id, true, 'Zugzwang înseamnă că adversarul trebuie să mute, iar mutarea îi înrăutățește poziția. Negrul nu poate rămâne pe e7. După orice plecare, regele alb intră. Nu este pat: are mutări, dar toate îl dau la o parte.'),
        },
        { label: 'Poate aștepta fără să mute', onClick: () => grade(api, id, false, 'Nu poate sări peste rând. Trebuie să mute, iar orice plecare îi predă poziția.') },
        { label: 'Este pat', onClick: () => grade(api, id, false, 'Negrul are cinci mutări de rege. Nu este pat. Toate îi predau opoziția.') },
      ])
    })
  })
}

function openF6(api, id) {
  api.show(
    F6_FEN,
    'Sunt doi pioni liberi. Apasă pionul liber îndepărtat, cel rămas departe de ceilalți.',
  )
  api.listen((square) => {
    if (square === 'e4') {
      api.status('e4 este pion liber protejat de pionul din d3. Cel îndepărtat este a4.')
      return
    }
    if (square === 'd3') {
      api.status('d3 doar îl protejează pe e4. Pionul îndepărtat este a4.')
      return
    }
    if (square !== 'a4') {
      api.status('Pionul liber îndepărtat este pe a4.')
      return
    }
    api.show(
      F6_FEN,
      'Dacă îl împingi singur, regele negru îl ia. Sprijină-l cu regele tău. Apasă primul pas.',
    )
    api.listen((king) => {
      if (king !== 'b2') {
        api.status('Regele din c1 merge pe b2, spre pionul din a4.')
        return
      }
      api.silence()
      api.show(afterMove(F6_FEN, 'Kb2'), 'Regele a pornit lângă pion. Ce pion ai folosit?')
      api.actions([
        {
          label: 'Pion liber îndepărtat, sprijinit de rege',
          onClick: () => grade(api, id, true, 'a4 este pion liber: negrul nu are pion pe coloana a sau b. Este și îndepărtat, departe de pionii din d, e, g și h. e4 este pion liber protejat, apărat de pionul din d3. Pionii g și h nu sunt liberi: au pion advers în față. Regele trebuie să sprijine pionul liber. a5 singur se pierde, regele din c7 îl ia.'),
        },
        { label: 'Îl împing fără rege', onClick: () => grade(api, id, false, 'a5 singur ajunge lângă regele din c7 și se pierde. Regele tău trebuie să meargă cu pionul.') },
        { label: 'a4 nu este pion liber', onClick: () => grade(api, id, false, 'Pe coloanele a și b negrul nu are pion. a4 este liber. Pentru că este departe de ceilalți, are nevoie de rege.') },
      ])
    })
  })
}

function openG1(api, id) {
  api.show(
    G1_FEN,
    'Pionul liber cere turnul activ, nu vânătoarea unui pion. Apasă pionul liber.',
  )
  api.listen((square) => {
    if (square === 'a7') {
      api.status('a7 este pionul advers. Pionul tău liber este pe d4.')
      return
    }
    if (square !== 'd4') {
      api.status('Pionul liber este pe d4.')
      return
    }
    api.show(G1_FEN, 'Pune turnul în spatele pionului liber. Apasă câmpul.')
    api.listen((rook) => {
      if (rook === 'a1') {
        api.status('a1 atacă pionul advers din spate. Mai întâi turnul stă în spatele pionului tău, pe d1.')
        return
      }
      if (rook !== 'd1') {
        api.status('Turnul din f1 merge pe d1.')
        return
      }
      api.silence()
      api.show(afterMove(G1_FEN, 'Rd1'), 'Turnul a trecut în spatele pionului. Ce ai ales?')
      api.actions([
        {
          label: 'Turnul activ, în spatele pionului',
          onClick: () => grade(api, id, true, 'Rd1 pune turnul activ în spatele pionului liber, iar regele din g1 poate intra și el. Din spate poți ataca mai târziu și pionul din a7. Activitatea turnului și a regelui cântărește mai greu decât câștigarea unui pion.'),
        },
        { label: 'Iau pionul a7 și las d4', onClick: () => grade(api, id, false, 'Un pion în plus nu înlocuiește turnul activ. d4 are nevoie de turn în spate.') },
        { label: 'Turnul stă în fața pionului', onClick: () => grade(api, id, false, 'În fața pionului, turnul îi încurcă înaintarea. Locul lui este în spate, pe d1.') },
      ])
    })
  })
}

function openG2(api, id) {
  api.show(
    G2_FEN,
    'Pionul este lângă promovare. Unde stă? Apasă-l.',
  )
  api.listen((square) => {
    if (square !== 'a2') {
      api.status('Pionul este pe a2.')
      return
    }
    api.show(G2_FEN, 'Pune turnul pe coloana pionului, ca să poată lua dama. Apasă câmpul.')
    api.listen((rook) => {
      if (rook === 'h1') {
        api.status('Pe linia 1 regele din d1 stă în calea turnului. Coloana pionului este a4.')
        return
      }
      if (rook !== 'a4') {
        api.status('Turnul din h4 merge pe a4.')
        return
      }
      api.silence()
      api.show(afterMove(G2_FEN, 'Ra4'), 'Turnul privește coloana. Ce se întâmplă la promovare?')
      api.actions([
        {
          label: 'Dacă promovează cu șah, turnul ia dama',
          onClick: () => grade(api, id, true, 'Turnul stă corect pe coloana pionului. a1 dă șah, iar Rxa1 ia dama. Dacă turnul părăsește coloana și regele pleacă de pe d1, pionul promovează și dama rămâne. Apropierea de regele negru nu oprește pionul.'),
        },
        { label: 'Pionul nu mai poate promova', onClick: () => grade(api, id, false, 'Poate încerca a1. Turnul nu îl blochează: îl ia pe damă după promovare, pentru că stă pe coloană.') },
        { label: 'Mă apropii cu regele de b2', onClick: () => grade(api, id, false, 'Dacă regele pleacă și turnul nu este pe coloană, pionul promovează și dama rămâne.') },
      ])
    })
  })
}

function openG3(api, id) {
  api.show(
    G3_FEN,
    'Regele tău stă lângă pion și îl atacă. Turnul îl ia, cu sprijinul regelui. Apasă pionul.',
  )
  api.listen((square) => {
    if (square !== 'a2') {
      api.status('Pionul este pe a2. Turnul din h2 îl ia.')
      return
    }
    api.silence()
    api.show(afterMove(G3_FEN, 'Rxa2'), 'Pionul a căzut. Cum ai câștigat?')
    api.actions([
      {
        label: 'Regele și turnul au lucrat împreună',
        onClick: () => grade(api, id, true, 'Regele din b3 atacă pionul și sprijină captura. Turnul îl ia. Așa se blochează pionul, se atacă și se transformă avantajul: rămâi cu rege și turn contra rege.'),
      },
      { label: 'Pionul a promovat', onClick: () => grade(api, id, false, 'Pionul a fost luat pe a2. Nu a ajuns pe a1.') },
      { label: 'Turnul a câștigat singur', onClick: () => grade(api, id, false, 'Turnul ia, iar regele stă lângă pion și sprijină câmpul. Fără rege, pionul nu cade la fel de sigur.') },
    ])
  })
}

function openG4(api, id) {
  api.show(
    G4_FEN,
    'Pionul liber este apărat de rege, iar regele este în fața lui. Pune turnul în spatele pionului.',
  )
  api.listen((square) => {
    if (square !== 'e1') {
      api.status('Turnul din a1 merge pe e1, în spatele pionului din e5.')
      return
    }
    api.silence()
    api.show(afterMove(G4_FEN, 'Re1'), 'Turnul a ajuns în spate. Ce final ai construit?')
    api.actions([
      {
        label: 'Rege în față, turn în spatele pionului',
        onClick: () => grade(api, id, true, 'Regele din d6 este în fața pionului și îl apără. Re1 pune turnul în spate, ca să împingă pionul. Apărarea negrului ar fi turnul tot în spate, pe coloana e. De acolo fie promovezi, fie îl oprește numai dacă ajunge el primul în spate.'),
      },
      { label: 'Turnul trebuie în fața pionului', onClick: () => grade(api, id, false, 'În fața pionului, turnul îi ține locul. Locul turnului tău este în spate, pe e1.') },
      { label: 'Regele rămâne în spatele pionului', onClick: () => grade(api, id, false, 'Regele este deja pe linia 6, în fața pionului. Turnul este cel care trece în spate.') },
    ])
  })
}

function openG5(api, id) {
  api.show(
    G5_FEN,
    'Regele stă lângă pion, pe câmpul de promovare. Ca să promoveze, turnul îi face o punte. Apasă pionul.',
  )
  api.listen((square) => {
    if (square !== 'e7') {
      api.status('Pionul este pe e7, lângă regele din e8.')
      return
    }
    api.show(G5_FEN, 'Urcă turnul pe linia 4. De acolo poate veni între rege și șahurile din spate. Apasă câmpul.')
    api.listen((rook) => {
      if (rook !== 'a4') {
        api.status('Turnul din a1 urcă pe a4.')
        return
      }
      api.silence()
      api.show(afterMove(G5_FEN, 'Ra4'), 'Turnul a urcat. Ce ai început?')
      api.actions([
        {
          label: 'Puntea: turnul apără drumul regelui',
          onClick: () => grade(api, id, true, 'Regele din e8 stă lângă pion și este la adăpost. Ra4 începe puntea Lucena: turnul urcă pe linia 4, apoi poate veni pe e4, între rege și șahurile din spate. Pionul promovează la adăpostul punții. Nu trebuie memorat tot mecanismul: ideea este puntea.'),
        },
        { label: 'Turnul dă șah mat', onClick: () => grade(api, id, false, 'Ra4 nu este mat. Este primul pas al punții, ca regele să iasă de lângă pion.') },
        { label: 'Pionul promovează chiar acum', onClick: () => grade(api, id, false, 'e8 este ocupat de regele tău. Mai întâi turnul construiește puntea.') },
      ])
    })
  })
}

function openG6(api, id) {
  api.show(
    G6_FEN,
    'Ești la apărare. Turnul tău ține regele alb departe de linia a șasea. Apasă turnul.',
  )
  api.listen((square) => {
    if (square === 'a1') {
      api.status('Pionul este încă pe linia 5. Turnul rămâne pe linia 6, nu pleacă în spate.')
      return
    }
    if (square !== 'a6') {
      api.status('Turnul care ține linia a șasea este pe a6.')
      return
    }
    api.silence()
    api.prompt('La ce folosește turnul de pe a6?')
    api.actions([
      {
        label: 'Îl ține pe rege departe de linia 6',
        onClick: () => grade(api, id, true, 'Asta este ideea Philidor. Turnul de pe linia 6 nu îl lasă pe regele alb să urce. Când pionul ajunge pe linia 6, turnul pleacă în spate și dă șahuri. Așa se apără un final, nu numai se câștigă.'),
      },
      { label: 'Duc turnul în spate chiar acum', onClick: () => grade(api, id, false, 'Pionul este pe e5, nu pe linia 6. Cât stă acolo, turnul rămâne pe linia 6.') },
      { label: 'Poziția este pierdută', onClick: () => grade(api, id, false, 'Un pion în minus nu înseamnă că ai pierdut. Turnul de pe linia 6 ține remiza.') },
    ])
  })
}

function openG7(api, id) {
  api.show(
    G7_FEN,
    'Dă șah, dar nu te apropia de rege: te ia turnul. Apasă regele advers.',
  )
  api.listen((square) => {
    if (square !== 'e5') {
      api.status('Regele negru este pe e5.')
      return
    }
    api.show(G7_FEN, 'Șahul de la distanță, din lateral. Apasă câmpul.')
    api.listen((rook) => {
      if (rook === 'e4') {
        api.status('Pe e4 regele ia turnul. Șahul de la distanță este pe a5.')
        return
      }
      if (rook !== 'a5') {
        api.status('Turnul merge pe a5, departe de rege.')
        return
      }
      api.silence()
      api.show(afterMove(G7_FEN, 'Ra5+'), 'Șah din lateral, de la distanță. Ce ai păstrat?')
      api.actions([
        {
          label: 'Distanța: turnul nu se pierde',
          onClick: () => grade(api, id, true, 'Ra5 este șah lateral, de la distanță. Regele nu ajunge la turn. Același lucru este șahul din spate: turnul rămâne departe. Pe e4 te-ai fi apropiat și regele îți lua turnul.'),
        },
        { label: 'Șahul trebuie dat lângă rege', onClick: () => grade(api, id, false, 'Lângă rege, pe e4, turnul se pierde. Distanța îl păstrează.') },
        { label: 'Am câștigat dama', onClick: () => grade(api, id, false, 'Pe tablă nu este damă. Ai dat șah cu turnul și l-ai păstrat departe de rege.') },
      ])
    })
  })
}

function openG8(api, id) {
  api.show(
    G8_FEN,
    'Doi pioni legați, pe flanc. Unul este apărat de rege, celălalt nu. Apasă pionul pe care îl ataci.',
  )
  api.listen((square) => {
    if (square === 'b4') {
      api.status('b4 este apărat de regele din c4. Turnul ia pionul de pe a4.')
      return
    }
    if (square !== 'a4') {
      api.status('Pionul fără apărare este pe a4.')
      return
    }
    api.silence()
    api.show(afterMove(G8_FEN, 'Rxa4'), 'Un pion a căzut. Celălalt rămâne pentru rege și turn. Ce ai făcut?')
    api.actions([
      {
        label: 'Am atacat pionul fără apărare',
        onClick: () => grade(api, id, true, 'a4 și b4 sunt pioni legați, pe flanc. b4 este apărat de regele din c4, a4 nu. Rxa4 îl ia pe cel fără apărare. Regele din e2 vine împreună cu turnul la pionul rămas.'),
      },
      { label: 'Trebuia să iau b4', onClick: () => grade(api, id, false, 'b4 este apărat de regele din c4. Turnul îl ia pe a4, care nu are apărare.') },
      { label: 'Pionii promovează împreună', onClick: () => grade(api, id, false, 'a4 a fost luat. Perechea s-a rupt. La pionul rămas merg regele și turnul.') },
    ])
  })
}

function openG9(api, id) {
  api.show(
    G9_FEN,
    'Ești un pion în minus. Nu ai pierdut. Dă șah de la distanță, cu turnul activ. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square === 'h1') {
      api.status('Schimbul de turnuri îți lasă regele singur contra pionului. Șahul este pe d8.')
      return
    }
    if (square === 'a6') {
      api.status('Pionul din a6 este apărat de rege. Apărarea activă este șahul pe d8.')
      return
    }
    if (square !== 'd8') {
      api.status('Turnul din h8 merge pe d8 cu șah.')
      return
    }
    api.silence()
    api.show(afterMove(G9_FEN, 'Rd8+'), 'Șah de la distanță. Regele nu ia turnul, iar pionul nu promovează. Ce înseamnă?')
    api.actions([
      {
        label: 'Un pion în minus nu înseamnă pierdere',
        onClick: () => grade(api, id, true, 'Rd8 ține turnul activ, departe de rege. Un pion în minus nu pierde singur. Remiza mai vine din șahuri repetate, din blocarea pionului și din turnul activ lăsat în spatele lui.'),
      },
      { label: 'Am pierdut din cauza pionului', onClick: () => grade(api, id, false, 'Pionul nu a promovat, iar turnul nu s-a pierdut. Materialul mai mic nu decide singur.') },
      { label: 'Schimb turnurile și câștig', onClick: () => grade(api, id, false, 'După schimb rămâi cu regele contra pionului. Apărarea este turnul activ, nu schimbul.') },
    ])
  })
}




