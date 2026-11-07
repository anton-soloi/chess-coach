// Nivelul Damă — planul pe termen lung.
// Strategia jocului de mijloc, profilaxia, calculul, deschiderea pe idei,
// finalurile legate de mijlocul jocului și transformarea avantajului.
// Lucena și Philidor rămân la Turn. Aici apare tăierea regelui.

import { Chess } from './vendor/chess.js'

const A1_FEN = 'r5k1/2p5/2p5/8/8/8/PP6/R5K1 w - - 0 1'
const A2_FEN = '3rk3/3p4/8/8/8/8/8/3R1K2 w - - 0 1'
const A3_FEN = '4k3/8/5n2/8/3P4/8/8/4K2R b - - 0 1'
const A4_FEN = '2r3k1/8/8/8/2PP4/8/2R3K1/8 w - - 0 1'
const A5_FEN = '8/4pk2/4p3/8/8/8/8/4R1K1 w - - 0 1'
const A6_FEN = '4k3/p7/8/8/8/8/PPP5/4K3 w - - 0 1'
const A7_FEN = '4k3/ppp2ppp/8/8/8/8/PPP2PPP/R3K3 w - - 0 1'
const A8_FEN = '4k3/pp3ppp/8/8/8/2N5/8/4K3 w - - 0 1'
const A9_FEN = '4k3/pp6/2n5/8/2B5/8/1B4K1/8 w - - 0 1'

const B1_FEN = '3rk3/8/8/8/8/8/8/R3K3 w - - 0 1'
const B2_FEN = '6k1/8/8/8/8/8/5PPP/1N4K1 w - - 0 1'
const B3_FEN = '4k3/8/8/8/4n3/2N5/8/4K3 w - - 0 1'

const C1_FEN = '4k3/8/8/8/8/8/3N4/4K3 w - - 0 1'
const C2_FEN = '4k3/p7/8/8/8/8/4Q3/4K3 w - - 0 1'
const C3_FEN = '6kr/pR6/8/8/8/8/1P6/6K1 w - - 0 1'

const D1_FEN = '3k4/ppp2ppp/8/3p4/3P4/8/PP2P1PP/2R1K3 w - - 0 1'
const D2_CLASSIC = '4k3/8/8/8/3PP3/8/8/4K3 w - - 0 1'
const D2_HYPER = '4k3/8/8/8/8/5N2/6B1/4K3 w - - 0 1'

const E1_FEN = '8/2k5/8/R7/4P3/5K2/8/8 w - - 0 1'
const E2_FEN = '4k3/3b4/2p1p3/3p4/8/8/B7/4K3 w - - 0 1'
const E3_FEN = '4kb2/8/8/8/4P3/8/6B1/4K3 w - - 0 1'
const E4_FEN = '2b1k3/5p2/2p1p3/3p4/4N3/8/8/4K3 w - - 0 1'

const F1_FEN = '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K1N1 w - - 0 1'
const F2_FEN = 'rnbqkbnr/pppppppp/8/8/8/2N2N2/PPPPPPPP/R1BQKB1R w KQkq - 0 1'
const F3_FEN = '4k3/8/3pp3/5p2/3PPP2/8/8/4K3 w - - 0 1'
const F4_FEN = '4k3/8/8/3N4/8/8/8/n3K3 w - - 0 1'
const F5_FEN = '4k3/pp6/p7/8/8/8/PPP5/4K3 w - - 0 1'
const F6_FEN = '6k1/5ppp/8/7Q/8/8/5PPP/6K1 w - - 0 1'
const F7_FEN = 'n5kn/8/8/8/8/B6B/8/6K1 w - - 0 1'
const F8_FEN = '4k3/ppp5/8/4P3/8/8/PP6/4K3 w - - 0 1'

function afterMove(fen, move) {
  const chess = new Chess(fen)
  if (!chess.moves().includes(move)) throw new Error(`Mutare ilegală: ${move}`)
  chess.move(move)
  return chess.fen()
}

function grade(api, id, ok, text) {
  api.silence()
  api.verdict(ok, text)
  if (!ok) {
    api.actions([{ label: 'Mai încerc', onClick: () => openDamaChapter(id, api) }])
  }
}

function ask(api, buttons) {
  api.silence()
  api.actions(buttons)
  api.listen(() => api.status('Alege unul dintre butoane.'))
}

function openA1(api, id) {
  api.show(
    A1_FEN,
    'Patru piloni: siguranța regelui, materialul, activitatea pieselor, structura de pioni. Apasă slăbiciunea care schimbă diagnoza.',
  )
  api.listen((square) => {
    if (square !== 'c6' && square !== 'c7') {
      api.status('Pionii dublați sunt pe c6 și c7.')
      return
    }
    api.prompt('Regii sunt la adăpost, materialul este egal, turnurile stau pe coloana a. Ce pilon decide?')
    ask(api, [
      {
        label: 'Structura de pioni',
        onClick: () => grade(api, id, true, 'Diagnoza pleacă de la patru piloni: siguranța regelui, materialul, activitatea pieselor și structura de pioni. Aici regii sunt la adăpost, materialul este egal, iar turnurile se privesc pe coloana a. Diferența este structura: pionii de pe c6 și c7 sunt dublați.'),
      },
      { label: 'Siguranța regelui', onClick: () => grade(api, id, false, 'Niciun rege nu este atacat. Pilonul care se vede este structura: pionii dublați de pe coloana c.') },
      { label: 'Materialul', onClick: () => grade(api, id, false, 'Turn, rege și doi pioni de fiecare parte. Materialul este egal. Structura nu este.') },
    ])
  })
}

function openA2(api, id) {
  api.show(
    A2_FEN,
    'Nu există mat și nu iei pionul: regele și turnul îl apără. Ce vrei din poziție? Apasă pionul slab.',
  )
  api.listen((square) => {
    if (square === 'd1' || square === 'd8') {
      api.status('Turnurile sunt deja pe coloană. Ținta planului este pionul de pe d7.')
      return
    }
    if (square !== 'd7') {
      api.status('Pionul izolat, fără vecin, este pe d7.')
      return
    }
    api.prompt('Mutarea izolată nu câștigă pionul. Care este planul?')
    ask(api, [
      {
        label: 'Presiune pe pionul slab',
        onClick: () => grade(api, id, true, 'Întrebarea de la Damă este: ce vreau din poziție și cum ajung acolo? d7 este izolat. Nu îl iei acum, pentru că regele și turnul îl apără. Planul este presiunea, nu o mutare scoasă din poziție și nu matul.'),
      },
      { label: 'Mat imediat', onClick: () => grade(api, id, false, 'Regele din e8 nu este în șah. Nu există mat într-o mutare. Planul este presiunea pe d7.') },
      { label: 'Schimb totul, fără motiv', onClick: () => grade(api, id, false, 'Schimbul fără plan îți ia tocmai turnul care apasă pionul. Mai întâi spui ce vrei: presiune pe d7.') },
    ])
  })
}

function openA3(api, id) {
  api.show(
    A3_FEN,
    'Albul are pion izolat pe d4. Tu ești la apărare. Blochează-l pe câmpul din fața lui. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square === 'd4') {
      api.status('d4 este pionul. Câmpul de blocadă, în fața lui, este d5.')
      return
    }
    if (square !== 'd5') {
      api.status('Calul din f6 merge pe d5, în fața pionului.')
      return
    }
    api.silence()
    api.show(afterMove(A3_FEN, 'Nd5'), 'Calul stă în fața pionului izolat. Planul apărătorului?')
    ask(api, [
      {
        label: 'Blocadă și schimburi',
        onClick: () => grade(api, id, true, 'Pionul izolat de pe d4 nu are vecin pe coloana c sau e. Cine îl are atacă, ca să nu rămână o țintă. Cine joacă împotriva lui îl blochează, aici cu Nd5, și caută schimburi. Calul de pe d5 nu poate fi alungat de un pion.'),
      },
      { label: 'Iau pionul imediat', onClick: () => grade(api, id, false, 'Calul de pe d5 nu ia pionul de pe d4: nu sare așa. Planul tău este blocada și schimburile.') },
      { label: 'Atac cu pionul izolat', onClick: () => grade(api, id, false, 'Atacul este planul celui care are pionul izolat. Tu ești de cealaltă parte: blochezi și schimbi.') },
    ])
  })
}

function openA4(api, id) {
  api.show(
    A4_FEN,
    'Pionii de pe c4 și d4 sunt vecini, fără pion propriu pe coloana b sau e. Apasă unul dintre ei.',
  )
  api.listen((square) => {
    if (square !== 'c4' && square !== 'd4') {
      api.status('Pionii suspendați sunt pe c4 și d4.')
      return
    }
    api.prompt('Turnul tău apără pionul de pe c4. Cum trăiesc pionii suspendați?')
    ask(api, [
      {
        label: 'Forță dacă înaintează, țintă dacă stau',
        onClick: () => grade(api, id, true, 'Pionii suspendați stau unul lângă altul, fără pion propriu pe coloanele vecine. Dacă înaintează, câștigă spațiu și deschid piese. Dacă rămân pe loc, coloana pe care stă turnul advers îi face țintă. Aici turnul din c2 îl ține pe c4.'),
      },
      { label: 'Sunt doi pioni izolați, fiecare singur', onClick: () => grade(api, id, false, 'Nu sunt izolați unul de altul: c4 și d4 se învecinează. Izolat este pionul fără niciun vecin.') },
      { label: 'Nu au nicio forță', onClick: () => grade(api, id, false, 'Au forță când înaintează. Devin țintă când stau și turnul advers îi apasă.') },
    ])
  })
}

function openA5(api, id) {
  api.show(
    A5_FEN,
    'Pionii de pe e6 și e7 sunt dublați. Regele din f7 îi apără. Apasă ținta, nu o lua.',
  )
  api.listen((square) => {
    if (square === 'e1') {
      api.status('Turnul este deja pe coloană. Ținta este pionul de pe e6.')
      return
    }
    if (square !== 'e6' && square !== 'e7') {
      api.status('Pionii dublați sunt pe e6 și e7.')
      return
    }
    api.prompt('Rxe6 pierde turnul: urmează Kxe6. Ce faci cu slăbiciunea?')
    ask(api, [
      {
        label: 'O apăs, nu o iau acum',
        onClick: () => grade(api, id, true, 'Pionii dublați sunt o țintă pe coloană. Aici nu îi iei: regele din f7 apără e6 și e7, iar Rxe6 se pierde după Kxe6. Compensarea lor, când sunt ale tale, este activitatea pieselor. Când sunt ale adversarului, le ții sub presiune.'),
      },
      { label: 'Iau pe e6', onClick: () => grade(api, id, false, 'Regele din f7 apără e6. După Rxe6 urmează Kxe6 și pierzi turnul.') },
      { label: 'Slăbiciunea nu contează', onClick: () => grade(api, id, false, 'Contează: turnul stă pe coloană și pionul rămâne țintă. Nu o transformi într-o captură pierzătoare.') },
    ])
  })
}

function openA6(api, id) {
  api.show(
    A6_FEN,
    'Pe flancul damei ai trei pioni contra unu. Creează majoritatea. Apasă un pion de-al tău care înaintează.',
  )
  api.listen((square) => {
    if (square === 'a7') {
      api.status('a7 este pionul advers. Majoritatea ta este a2, b2 și c2.')
      return
    }
    if (square !== 'a4' && square !== 'b4' && square !== 'c4') {
      api.status('Înaintează un pion din majoritate: a4, b4 sau c4.')
      return
    }
    api.silence()
    api.show(afterMove(A6_FEN, square), 'Ai înaintat pe flancul unde ai mai mulți pioni. Pentru ce?')
    ask(api, [
      {
        label: 'Ca să fac un pion liber',
        onClick: () => grade(api, id, true, 'Majoritatea este trei contra unu pe flancul damei. Planul este pionul liber, pe flancul unde ai mai mulți pioni. Nu cauți liberul pe flancul unde ești în minoritate.'),
      },
      { label: 'Ca să atac regele', onClick: () => grade(api, id, false, 'Regele din e8 nu este ținta acestei înaintări. Vrei un pion liber din majoritate.') },
      { label: 'Ca să schimb toți pionii', onClick: () => grade(api, id, false, 'Schimbul tuturor pionilor îți anulează majoritatea. Vrei să rămână un pion liber.') },
    ])
  })
}

function openA7(api, id) {
  api.show(
    A7_FEN,
    'Pe coloana d nu este niciun pion. Du turnul pe coloana deschisă. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square === 'e1' || square === 'e4' || square === 'e5') {
      api.status('Pe coloana e sunt pioni de ambele părți. Coloana deschisă este d.')
      return
    }
    if (square !== 'd1') {
      api.status('Turnul din a1 merge pe d1.')
      return
    }
    api.silence()
    api.show(afterMove(A7_FEN, 'Rd1'), 'Turnul a luat coloana deschisă. Ce coloană mai există?')
    ask(api, [
      {
        label: 'Și coloana semi-deschisă, cu pionul advers',
        onClick: () => grade(api, id, true, 'Coloana deschisă nu are niciun pion: aici d, iar turnul intră cu Rd1. Coloana semi-deschisă are doar pionul adversarului. Turnul vrea coloana, nu o mutare lângă un pion propriu care o închide.'),
      },
      { label: 'Coloana e este la fel de deschisă', onClick: () => grade(api, id, false, 'Pe e stau pioni de ambele părți. Deschisă este coloana fără niciun pion.') },
      { label: 'Turnul trebuie să ia un pion', onClick: () => grade(api, id, false, 'Nu iei un pion. Iei coloana, ca turnul să aibă linie.') },
    ])
  })
}

function openA8(api, id) {
  api.show(
    A8_FEN,
    'd5 este în tabăra adversă. Niciun pion negru nu poate ajunge să-l atace. Du calul acolo.',
  )
  api.listen((square) => {
    if (square === 'e4' || square === 'c4' || square === 'b5') {
      api.status('Calul poate sări și acolo, dar avanpostul este d5.')
      return
    }
    if (square !== 'd5') {
      api.status('Avanpostul este d5.')
      return
    }
    api.silence()
    api.show(afterMove(A8_FEN, 'Nd5'), 'Calul a ocupat d5. De ce rămâne?')
    ask(api, [
      {
        label: 'Pionii adversarului nu-l pot alunga',
        onClick: () => grade(api, id, true, 'Avanpostul este un câmp în tabăra adversă pe care niciun pion de-al lui nu îl poate ataca. Negrul nu are pion pe coloana c sau e, deci d5 rămâne al calului. Calul pe avanpost este mai puternic decât un cal care poate fi alungat.'),
      },
      { label: 'Am dat șah', onClick: () => grade(api, id, false, 'Nd5 nu este șah. Câștigul este câmpul, nu șahul.') },
      { label: 'Orice câmp din centru este avanpost', onClick: () => grade(api, id, false, 'Nu. Avanpostul nu poate fi atacat de pionii adversarului. e4 poate fi alungat când pionul din f7 ajunge pe f5. d5 nu.') },
    ])
  })
}

function openA9(api, id) {
  const picked = new Set()
  api.show(
    A9_FEN,
    'Centrul este deschis. Ai doi nebuni, adversarul are cai. Apasă ambii nebuni.',
  )
  api.listen((square) => {
    if (square === 'f7' || square === 'g8') {
      api.status('Asta atacă o piesă sau dă șah și pierde nebunul. Perechea stă pe c4 și b2.')
      return
    }
    if (square !== 'c4' && square !== 'b2') {
      api.status('Nebunii sunt pe c4 și pe b2.')
      return
    }
    if (picked.has(square)) picked.delete(square)
    else picked.add(square)
    api.mark(picked)
    if (!picked.has('c4') || !picked.has('b2')) {
      api.status('Mai apasă și celălalt nebun.')
      return
    }
    api.prompt('Centrul nu este închis de pioni. La ce folosește perechea?')
    ask(api, [
      {
        label: 'În poziție deschisă, perechea lucrează',
        onClick: () => grade(api, id, true, 'Perechea de nebuni cere spațiu: poziție deschisă, culori de ambele părți. Caii adversarului nu acoperă ce acoperă doi nebuni. Nu începi cu Bf7+ sau cu capturi care îți dau nebunul.'),
      },
      { label: 'Dau șah pe f7', onClick: () => grade(api, id, false, 'Bf7+ pierde nebunul. Perechea se folosește în poziția deschisă, nu se sacrifică fără motiv.') },
      { label: 'Schimb un nebun pe cal', onClick: () => grade(api, id, false, 'Schimbul îți desface perechea. O păstrezi cât centrul rămâne deschis.') },
    ])
  })
}

function openB1(api, id) {
  api.show(
    B1_FEN,
    'Înainte de planul tău: ce vrea adversarul? Apasă turnul lui.',
  )
  api.listen((square) => {
    if (square === 'd1') {
      api.status('Mai întâi vezi planul lui. Turnul negru este pe d8 și vrea d1.')
      return
    }
    if (square !== 'd8') {
      api.status('Turnul negru este pe d8.')
      return
    }
    api.show(B1_FEN, 'Vrea Rd1+, pe coloana deschisă, lângă regele din e1. Oprește-l. Apasă câmpul.')
    api.listen((next) => {
      if (next !== 'd1') {
        api.status('Turnul tău merge pe d1 înaintea lui.')
        return
      }
      api.silence()
      api.show(afterMove(B1_FEN, 'Rd1'), 'Ai luat coloana. Care este ordinea gândului?')
      ask(api, [
        {
          label: 'Ce vrea el, îi opresc planul, apoi planul meu',
          onClick: () => grade(api, id, true, 'Ordinea este: ce vreau eu, ce vrea el, cum îi opresc planul, abia apoi planul meu. Aici el voia Rd1+. Rd1 îi ia coloana înainte. Profilaxia este să-i vezi mutarea înainte să-ți începi atacul.'),
        },
        { label: 'Ignor turnul și atac', onClick: () => grade(api, id, false, 'Dacă ignori d8, urmează Rd1+ lângă regele tău. Mai întâi îi oprești planul.') },
        { label: 'Orice mutare de turn este la fel', onClick: () => grade(api, id, false, 'Nu. Rd1 este mutarea care îi ia exact coloana pe care o voia.') },
      ])
    })
  })
}

function openB2(api, id) {
  api.show(
    B2_FEN,
    'Calul din b1 stă rău. Îl aduci pe c3. Nu împinge pionii de lângă rege. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square === 'f3' || square === 'f4' || square === 'g3' || square === 'g4' || square === 'h3' || square === 'h4') {
      api.status('Împingerea pionilor de lângă rege creează slăbiciuni. Mută calul pe c3.')
      return
    }
    if (square !== 'c3') {
      api.status('Calul din b1 merge pe c3.')
      return
    }
    api.silence()
    api.show(afterMove(B2_FEN, 'Nc3'), 'Pionii de lângă rege au rămas pe loc. Ce ai făcut?')
    ask(api, [
      {
        label: 'Am mutat piesa, nu am slăbit pionii',
        onClick: () => grade(api, id, true, 'Apărarea pozițională mută piesele pe câmpuri mai bune și nu creează slăbiciuni de pioni. Nc3 activează calul. f3, g4 sau h4 lângă regele din g1 ar fi slăbiciuni noi, fără să fie nevoie de ele.'),
      },
      { label: 'Trebuia să înaintez pionii', onClick: () => grade(api, id, false, 'Pionii de pe f2, g2 și h2 îl acoperă pe rege. Împinși fără motiv, lasă câmpuri slabe.') },
      { label: 'Calul trebuia dat', onClick: () => grade(api, id, false, 'Nu ai ce captura. Îl reorganizezi pe c3.') },
    ])
  })
}

function openB3(api, id) {
  api.show(
    B3_FEN,
    'Calul negru de pe e4 este piesa lui cea mai activă. Schimb-o. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square === 'd5' || square === 'a4' || square === 'e2') {
      api.status('Nu pleca calul în altă parte. Ia calul activ de pe e4.')
      return
    }
    if (square !== 'e4') {
      api.status('Captura este pe e4.')
      return
    }
    api.silence()
    api.show(afterMove(B3_FEN, 'Nxe4'), 'Ai schimbat calul din centru. Ce schimb este bun?')
    ask(api, [
      {
        label: 'Schimb piesa lui cea mai activă',
        onClick: () => grade(api, id, true, 'Ghidul schimbului: schimbi piesa cea mai activă a adversarului, sau îți păstrezi piesele care atacă. Nxe4 face prima. Nu orice schimb este bun. La Turn ai văzut deja că schimbul este o decizie, nu un reflex.'),
      },
      { label: 'Orice schimb este bun', onClick: () => grade(api, id, false, 'Nu. Schimbi piesa care lucrează pentru el, nu o piesă oarecare și nu piesa cu care tu ataci.') },
      { label: 'Îmi păstrez calul pasiv', onClick: () => grade(api, id, false, 'Calul tău de pe c3 este cel care face schimbul. Ținta este calul lui din e4.') },
    ])
  })
}

function openC1(api, id) {
  api.show(
    C1_FEN,
    'Calul din d2 nu sare pe d5 dintr-o mutare. Drumul este d2–f1–e3–d5. Primul pas. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square === 'd5') {
      api.status('d5 este destinația, nu prima mutare. Calul merge întâi pe f1.')
      return
    }
    if (square === 'b3' || square === 'c4' || square === 'e4') {
      api.status('Poate sări și acolo. Drumul spre d5 începe cu f1.')
      return
    }
    if (square !== 'f1') {
      api.status('Primul pas este f1.')
      return
    }
    api.silence()
    api.show(afterMove(C1_FEN, 'Nf1'), 'Un pas, nu tot drumul. Cum se numește manevra?')
    ask(api, [
      {
        label: 'Regrupare: f1, apoi e3, apoi d5',
        onClick: () => grade(api, id, true, 'Regruparea duce o piesă inactivă pe un câmp mai bun, chiar în două sau trei mutări. Nd2–f1–e3–d5 nu este o singură săritură. Nf1 este doar primul pas. În poziție liniștită, asta face piesa bună, nu o tactică.'),
      },
      { label: 'Nf1 a ajuns deja pe d5', onClick: () => grade(api, id, false, 'Calul este pe f1. Mai are e3, apoi d5. Regruparea cere răbdare.') },
      { label: 'Trebuia o captură', onClick: () => grade(api, id, false, 'Nu ai ce captura. În poziție liniștită îți muți piesa, nu inventezi o tactică.') },
    ])
  })
}

function openC2(api, id) {
  api.show(
    C2_FEN,
    'Calculează cinci jumătăți de mutare: șah, răspuns, șah, răspuns, captură cu șah. Prima este șah. Apasă câmpul.',
  )
  api.listen((square) => {
    if (square !== 'b5') {
      api.status('Dama din e2 dă șah pe b5.')
      return
    }
    const afterCheck = afterMove(afterMove(C2_FEN, 'Qb5+'), 'Kf8')
    api.show(afterCheck, 'Regele mai avea și alte câmpuri. În varianta aceasta a mers pe f8. Următorul șah. Apasă câmpul.')
    api.listen((next) => {
      if (next !== 'b8') {
        api.status('Dama urcă pe b8, cu șah.')
        return
      }
      const afterSecond = afterMove(afterMove(afterCheck, 'Qb8+'), 'Kg7')
      api.show(afterSecond, 'În variantă regele merge pe g7. Captura cu șah. Apasă pionul.')
      api.listen((pawn) => {
        if (pawn !== 'a7') {
          api.status('Pionul de pe a7 cade, cu șah.')
          return
        }
        api.show(afterMove(afterSecond, 'Qxa7+'), 'Qb5+, Kf8, Qb8+, Kg7, Qxa7+. Cinci jumătăți de mutare. Ce ai urmărit?')
        ask(api, [
          {
            label: 'Șah, șah, captură cu șah',
            onClick: () => grade(api, id, true, 'Varianta forțată de aici este șah, captură și amenințare, calculată cinci jumătăți de mutare: Qb5+, Kf8, Qb8+, Kg7, Qxa7+. Regele mai avea și alte răspunsuri la primul șah; în ramura aceasta pionul cade cu șah. La Damă calculezi ramura până la capăt, nu doar prima mutare.'),
          },
          { label: 'Am dat mat', onClick: () => grade(api, id, false, 'Qxa7+ este șah, nu mat. Regele mai are câmpuri. Ai câștigat pionul.') },
          { label: 'M-am oprit după primul șah', onClick: () => grade(api, id, false, 'Primul șah nu ia pionul. Linia continuă cu Qb8+ și abia apoi cu Qxa7+.') },
        ])
      })
    })
  })
}

function openC3(api, id) {
  api.show(
    C3_FEN,
    'Turnul este deja pe linia 7. Trecerea spre final este pionul fără apărare. Apasă-l.',
  )
  api.listen((square) => {
    if (square === 'h8' || square === 'g8') {
      api.status('Nu schimbi turnul și nu iei regele. Pionul fără apărare este pe a7.')
      return
    }
    if (square === 'b8' || square === 'b2') {
      api.status('Pionul tău de pe b2 rămâne. Iei pionul de pe a7.')
      return
    }
    if (square !== 'a7') {
      api.status('Captura este Rxa7.')
      return
    }
    api.show(afterMove(C3_FEN, 'Rxa7'), 'Activitatea a devenit pion. Cum treci mai departe?')
    ask(api, [
      {
        label: 'Am calculat finalul cu pion în plus',
        onClick: () => grade(api, id, true, 'Lichidarea este trecerea calculată din jocul de mijloc într-un final bun. Rxa7 transformă turnul activ în pion. Îți rămâne pionul de pe b2. Schimbul de turnuri vine după captură, când finalul îți convine, nu înainte.'),
      },
      { label: 'Mă opresc la activitate', onClick: () => grade(api, id, false, 'Activitatea este începutul. Aici ea ia pionul și deschide finalul.') },
      { label: 'Schimb turnul înainte de pion', onClick: () => grade(api, id, false, 'Dacă schimbi turnul înainte, nu mai iei a7 cu turnul de pe linia 7. Întâi pionul, apoi schimburile.') },
    ])
  })
}

function openD1(api, id) {
  api.show(
    D1_FEN,
    'Structura a ieșit din deschidere: d4 și d5 stau, coloana c este semi-deschisă pentru tine. Apasă turnul de pe ea.',
  )
  api.listen((square) => {
    if (square === 'c7') {
      api.status('Regele din d8 apără c7. Rxc7 pierde turnul. Planul este coloana, iar turnul este deja pe c1.')
      return
    }
    if (square !== 'c1') {
      api.status('Turnul care ține coloana semi-deschisă este pe c1.')
      return
    }
    api.prompt('Nu memorezi mutarea următoare. De unde vine planul?')
    ask(api, [
      {
        label: 'Din structura de pioni, nu din memorie',
        onClick: () => grade(api, id, true, 'Deschiderea se învață pe idei. Din structură iese planul: coloana c este semi-deschisă, pentru că tu nu ai pion pe c, iar el are pe c7. Turnul stă pe c1. d4 și d5 fixează centrul. Nu ataci regele dintr-o dată și nu joci Rxc7: regele din d8 apără pionul.'),
      },
      { label: 'Din mutarea memorată, următoarea', onClick: () => grade(api, id, false, 'Nu ai de memorat o mutare. Ai de citit structura: coloana c și pionii d4, d5.') },
      { label: 'Atac imediat la rege', onClick: () => grade(api, id, false, 'Regele din d8 nu este descoperit. Planul care iese din deschidere este coloana semi-deschisă.') },
    ])
  })
}

function openD2(api, id) {
  api.show(
    D2_CLASSIC,
    'Centrul clasic. Pionii stau pe d4 și e4. Apasă unul dintre ei.',
  )
  api.listen((square) => {
    if (square !== 'd4' && square !== 'e4') {
      api.status('Centrul ocupat cu pioni este d4 și e4.')
      return
    }
    api.prompt('Cine ține centrul în poziția aceasta?')
    ask(api, [
      { label: 'Pionii, din centru', onClick: () => openD2Hyper(api, id) },
      { label: 'Piesele, de departe', onClick: () => grade(api, id, false, 'Aici pionii stau pe d4 și e4. Controlul de departe, cu piese, este celălalt centru.') },
      { label: 'Nimeni: centrul este gol', onClick: () => grade(api, id, false, 'd4 și e4 ocupă centrul. Nu este gol.') },
    ])
  })
}

function openD2Hyper(api, id) {
  api.silence()
  api.show(
    D2_HYPER,
    'Același centru, altă idee. Nu ai pion pe d sau e. Calul și nebunul îl privesc de departe. Apasă o piesă.',
  )
  api.listen((square) => {
    if (square !== 'f3' && square !== 'g2') {
      api.status('Calul este pe f3, nebunul pe g2.')
      return
    }
    api.prompt('Cum se numește centrul ținut așa?')
    ask(api, [
      {
        label: 'Hipermodern: piese, de la distanță',
        onClick: () => grade(api, id, true, 'Centrul clasic este ocupat cu pioni, ca d4 și e4. Centrul hipermodern este controlat de la distanță, cu piese: aici calul din f3 și nebunul din g2, fără pion în centru. Ambele sunt lupte pentru centru. Nu memorezi mutările, recunoști ideea.'),
      },
      { label: 'Tot centru clasic, cu pioni', onClick: () => grade(api, id, false, 'Nu ai pion pe d4 sau e4. Centrul este ținut de cal și de nebun.') },
      { label: 'Piesele nu se uită la centru', onClick: () => grade(api, id, false, 'Nf3 și Bg2 lovesc spre centru tocmai de la distanță.') },
    ])
  })
}

function openE1(api, id) {
  api.show(
    E1_FEN,
    'Pionul liber este pe e4. Turnul de pe a5 taie linia 5, iar regele din c7 nu trece spre pion. Apasă turnul.',
  )
  api.listen((square) => {
    if (square === 'e4') {
      api.status('e4 este pionul. Piesa care taie linia este turnul de pe a5.')
      return
    }
    if (square !== 'a5') {
      api.status('Turnul care taie linia 5 este pe a5.')
      return
    }
    api.prompt('Turnul nu dă șah. Ce face pe linia 5?')
    ask(api, [
      {
        label: 'Îl taie pe rege de pion',
        onClick: () => grade(api, id, true, 'Tăierea ține regele advers departe de pion, pe o linie sau pe o coloană. Turnul de pe a5 nu îl lasă pe regele din c7 să treacă de linia 5 spre e4. Puntea Lucena și linia a 6-a din Philidor le-ai văzut la Turn. Aici ideea nouă este tăierea.'),
      },
      { label: 'Construiesc puntea Lucena', onClick: () => grade(api, id, false, 'Puntea Lucena este la Turn. Aici turnul stă pe linia 5 și taie regele de pion.') },
      { label: 'Țin linia a 6-a, ca în Philidor', onClick: () => grade(api, id, false, 'Philidor este apărarea de la Turn, cu turnul pe linia 6. Aici tai linia 5, ca regele să nu ajungă la pionul liber.') },
    ])
  })
}

function openE2(api, id) {
  api.show(
    E2_FEN,
    'Pionii negri stau pe c6, d5 și e6, pe câmpuri de culoarea nebunului tău. Apasă nebunul bun.',
  )
  api.listen((square) => {
    if (square === 'd5') {
      api.status('d5 este apărat de c6 și de e6. Nu iei pionul. Nebunul bun este pe a2.')
      return
    }
    if (square === 'd7') {
      api.status('Nebunul din d7 este nebunul rău: stă în spatele propriilor pioni. Nebunul bun este pe a2.')
      return
    }
    if (square !== 'a2') {
      api.status('Nebunul alb este pe a2.')
      return
    }
    api.prompt('Același lanț de pioni. Care nebun lucrează?')
    ask(api, [
      {
        label: 'a2 lovește lanțul, d7 stă în spatele lui',
        onClick: () => grade(api, id, true, 'Nebunul bun atacă lanțul de pioni al adversarului: de pe a2 vezi c4, d5 și e6. Nebunul rău stă pe culoarea propriilor pioni ficși, aici d7, în spatele lui c6, d5 și e6. Nu joci Bxd5: pionii îți iau nebunul.'),
      },
      { label: 'Iau pionul de pe d5', onClick: () => grade(api, id, false, 'c6 și e6 apără d5. Bxd5 pierde nebunul. Îl păstrezi pe a2, unde lovește lanțul.') },
      { label: 'Nebunul din d7 este cel bun', onClick: () => grade(api, id, false, 'd7 este blocat de propriii pioni. Nebunul bun este cel de pe a2.') },
    ])
  })
}

function openE3(api, id) {
  const picked = new Set()
  api.show(
    E3_FEN,
    'Cei doi nebuni nu stau pe aceeași culoare. Apasă-i pe amândoi.',
  )
  api.listen((square) => {
    if (square === 'c6' || square === 'a8' || square === 'b7') {
      api.status('Nu muta nebunul. Arată-i pe cel din g2 și pe cel din f8.')
      return
    }
    if (square !== 'g2' && square !== 'f8') {
      api.status('Nebunul alb este pe g2, nebunul negru pe f8.')
      return
    }
    if (picked.has(square)) picked.delete(square)
    else picked.add(square)
    api.mark(picked)
    if (!picked.has('g2') || !picked.has('f8')) {
      api.status('Mai apasă și celălalt nebun.')
      return
    }
    api.prompt('Nu se pot captura unul pe altul. Ce urmează din asta?')
    ask(api, [
      {
        label: 'Remiză dacă regele blochează, atac pe culoarea mea',
        onClick: () => grade(api, id, true, 'Nebunii de culori opuse nu se pot lua. Pionul liber de pe e4 se remizează des când regele advers stă în fața lui și nebunul tău nu-l poate alunga. Atacul apare când joci pe culoarea nebunului tău, unde nebunul lui nu ajunge. Aici regele din e8 nu blochează încă pionul.'),
      },
      { label: 'Îi schimb pe f8', onClick: () => grade(api, id, false, 'Nebunul din g2 nu ajunge pe f8: sunt culori diferite. Nu există schimb.') },
      { label: 'Regele blochează deja pionul', onClick: () => grade(api, id, false, 'Pionul este pe e4, regele pe e8. Nu stă în fața pionului. Blocada ar fi pe câmpul din fața lui.') },
    ])
  })
}

function openE4(api, id) {
  api.show(
    E4_FEN,
    'Pionii închid poziția: c6, d5, e6, f7. Nebunul din c8 stă în spatele lor. Apasă piesa căreia îi priește închiderea.',
  )
  api.listen((square) => {
    if (square === 'd6' || square === 'f6') {
      api.status('Nd6 și Nf6 sunt șahuri, nu diagnoza. Piesa este deja pe e4.')
      return
    }
    if (square === 'c8') {
      api.status('Nebunul din c8 este stingherit de propriii pioni. Calul bun este pe e4.')
      return
    }
    if (square !== 'e4') {
      api.status('Calul este pe e4.')
      return
    }
    api.prompt('Poziția este închisă. Cal sau nebun?')
    ask(api, [
      {
        label: 'Închisă: calul sare peste pioni',
        onClick: () => grade(api, id, true, 'Calul contra nebunului depinde de pioni. În poziție închisă, calul de pe e4 sare peste lanț, iar nebunul din c8 se lovește de c6, d5, e6 și f7. În poziție deschisă, nebunul capătă diagonale. Nu începi cu Nd6+ doar pentru că este șah.'),
      },
      { label: 'Deschisă: nebunul este mai bun aici', onClick: () => grade(api, id, false, 'Lanțul de pioni închide diagonalele. Aici îi priește calului, nu nebunului din c8.') },
      { label: 'Dau șah pe d6', onClick: () => grade(api, id, false, 'Nd6+ este șah, nu planul. Planul este că poziția închisă îl face pe cal mai bun decât nebunul.') },
    ])
  })
}

function openF1(api, id) {
  api.show(
    F1_FEN,
    'Aceiași pioni, de fiecare parte. Tu mai ai un cal. Apasă-l.',
  )
  api.listen((square) => {
    if (square !== 'g1') {
      api.status('Calul în plus este pe g1.')
      return
    }
    api.prompt('Pionii stau la fel. Ce fel de avantaj ai?')
    ask(api, [
      {
        label: 'Avantaj material',
        onClick: () => grade(api, id, true, 'Avantajul material înseamnă că ai mai mult: aici un cal, pionii fiind egali. Calul stă încă pe g1, deci nu este dezvoltare. Nu ai mai mult spațiu și nu ai pion liber. Materialul este pur și simplu piesa pe care el nu o are.'),
      },
      { label: 'Avantaj de dezvoltare', onClick: () => grade(api, id, false, 'Calul nu a ieșit de pe g1. Ai piesa, nu poziția ei. Asta este material.') },
      { label: 'Avantaj de spațiu', onClick: () => grade(api, id, false, 'Pionii sunt pe aceleași linii, de fiecare parte. Diferența este calul.') },
    ])
  })
}

function openF2(api, id) {
  api.show(
    F2_FEN,
    'Material egal, pionii nu s-au mișcat. Caii tăi au ieșit, piesele lui sunt încă pe linia 8. Apasă un cal de-al tău.',
  )
  api.listen((square) => {
    if (square === 'a8' || square === 'b8' || square === 'c8' || square === 'd8' || square === 'e8' || square === 'f8' || square === 'g8' || square === 'h8') {
      api.status('Acelea sunt piesele lui, încă acasă. Caii tăi sunt pe c3 și f3.')
      return
    }
    if (square !== 'c3' && square !== 'f3') {
      api.status('Caii dezvoltați sunt pe c3 și f3.')
      return
    }
    api.prompt('Nu ai piesă în plus și nu ai împins pionii. Ce avantaj este?')
    ask(api, [
      {
        label: 'Avantaj de dezvoltare',
        onClick: () => grade(api, id, true, 'Dezvoltarea înseamnă că piesele tale sunt în joc, iar ale lui încă nu. Nc3 și Nf3 au ieșit; negrul este pe linia 8. Materialul este egal și pionii nu dau spațiu. Nu este perechea de nebuni: nebunii tăi sunt încă pe c1 și f1.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Aveți aceleași piese. Diferența este că ale tale au ieșit.') },
      { label: 'Avantaj de spațiu', onClick: () => grade(api, id, false, 'Niciun pion nu a trecut de linia 2. Spațiul este egal. Au ieșit caii.') },
    ])
  })
}

function openF3(api, id) {
  api.show(
    F3_FEN,
    'Trei pioni contra trei. Ai tăi stau pe d4, e4 și f4. Apasă unul dintre ei.',
  )
  api.listen((square) => {
    if (square === 'f5') {
      api.status('f5 este pionul advers și atacă e4. exf5 există, dar diagnoza nu este captura. Spațiul tău este d4, e4, f4.')
      return
    }
    if (square === 'd6' || square === 'e6') {
      api.status('Aceia sunt pionii lui, mai în spate. Spațiul tău este pe linia 4.')
      return
    }
    if (square !== 'd4' && square !== 'e4' && square !== 'f4') {
      api.status('Pionii care îți dau spațiul sunt d4, e4 și f4.')
      return
    }
    api.prompt('Material egal, niciun pion liber. Ce avantaj vezi?')
    ask(api, [
      {
        label: 'Avantaj de spațiu',
        onClick: () => grade(api, id, true, 'Spațiul înseamnă că pionii tăi stau mai în față și piesele au loc în spatele lor. Aici sunteți trei pioni contra trei, deci materialul este egal, și niciun pion nu este liber. f5 atacă e4, iar exf5 se poate juca. Diagnoza rămâne spațiul.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Sunt trei pioni de fiecare parte. Materialul este egal. Avantajul este spațiul.') },
      { label: 'Pion liber', onClick: () => grade(api, id, false, 'Niciun pion nu a trecut de pionii adversarului. d4, e4 și f4 dau spațiu, nu un pion liber.') },
    ])
  })
}

function openF4(api, id) {
  api.show(
    F4_FEN,
    'Același material: cal și rege de fiecare parte. Calul tău este pe d5, al lui pe a1. Apasă calul care lucrează.',
  )
  api.listen((square) => {
    if (square === 'a1') {
      api.status('Calul din a1 stă în colț. Calul activ este pe d5.')
      return
    }
    if (square === 'c7' || square === 'f6') {
      api.status('Nc7 și Nf6 sunt șahuri, nu numele avantajului. Calul care lucrează este deja pe d5.')
      return
    }
    if (square !== 'd5') {
      api.status('Calul activ este pe d5.')
      return
    }
    api.prompt('Nu ai piesă în plus. Cum se numește faptul că a ta lucrează, iar a lui nu?')
    ask(api, [
      {
        label: 'Avantaj de activitate',
        onClick: () => grade(api, id, true, 'Activitatea este cât de bine lucrează piesele pe care le ai deja. Calul din d5 este în centru, calul din a1 nu face nimic. Materialul este egal. Avanpostul, ca idee, l-ai văzut la A8; aici numești avantajul: activitate.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Este cal contra cal. Nu ai mai mult material. Ai un cal care lucrează.') },
      { label: 'Pion liber', onClick: () => grade(api, id, false, 'Nu este niciun pion pe tablă. Diferența este calul din d5.') },
    ])
  })
}

function openF5(api, id) {
  api.show(
    F5_FEN,
    'Trei pioni contra trei. Ai tăi stau unul lângă altul. Ai lui sunt doi pe coloana a. Apasă un pion dublat.',
  )
  api.listen((square) => {
    if (square === 'a4' || square === 'b4' || square === 'c4') {
      api.status('Înaintarea este mai târziu. Mai întâi vezi slăbiciunea: pionii dublați sunt pe a6 și a7.')
      return
    }
    if (square !== 'a6' && square !== 'a7') {
      api.status('Pionii dublați sunt pe a6 și a7.')
      return
    }
    api.prompt('Material egal. Nu ai încă pion liber. Ce avantaj ai?')
    ask(api, [
      {
        label: 'Avantaj structural',
        onClick: () => grade(api, id, true, 'Avantajul structural stă în pioni: ai tăi sunt legați, pe a2, b2 și c2, ai lui sunt dublați pe coloana a. Materialul este egal și pionul liber încă nu există. Cum se apasă pionii dublați ai văzut la A5. Aici îi pui numele: structură.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Sunt trei pioni de fiecare parte. Nu ai mai mult material. Ai pioni mai sănătoși.') },
      { label: 'Pion liber', onClick: () => grade(api, id, false, 'c2 nu este liber: pe coloanele a și b negrul încă are pioni. Avantajul de acum este structura.') },
    ])
  })
}

function openF6(api, id) {
  api.show(
    F6_FEN,
    'Material egal, pionii stau la fel. Dama atacă și negrul trebuie să răspundă. Apasă dama.',
  )
  api.listen((square) => {
    if (square === 'f7' || square === 'h7') {
      api.status('Regele apără f7 și h7. Captura pierde dama. Avantajul este că dama de pe h5 îl pune pe negru să răspundă.')
      return
    }
    if (square !== 'h5') {
      api.status('Dama este pe h5.')
      return
    }
    api.prompt('Nu iei nimic. Negrul tot trebuie să se ocupe de atac. Ce avantaj este?')
    ask(api, [
      {
        label: 'Avantaj de inițiativă',
        onClick: () => grade(api, id, true, 'Inițiativa înseamnă că tu pui întrebările și el trebuie să răspundă. Dama de pe h5 atacă spre rege, materialul este egal, pionii sunt la fel. Qxf7 și Qxh7 pierd dama, pentru că regele le apără. Nu transforma inițiativa într-o captură pierzătoare.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Damă și trei pioni de fiecare parte. Nu ai mai mult material. Ai atacul.') },
      { label: 'Iau pe h7', onClick: () => grade(api, id, false, 'Regele din g8 apără h7. Qxh7 pierde dama. Inițiativa se păstrează, nu se aruncă.') },
    ])
  })
}

function openF7(api, id) {
  const picked = new Set()
  api.show(
    F7_FEN,
    'Doi nebuni contra doi cai, pe tablă deschisă. Material egal. Apasă ambii nebuni.',
  )
  api.listen((square) => {
    if (square === 'e6' || square === 'f8' || square === 'c8') {
      api.status('Nu muta nebunul. Arată-i pe cel din a3 și pe cel din h3.')
      return
    }
    if (square !== 'a3' && square !== 'h3') {
      api.status('Nebunii sunt pe a3 și h3.')
      return
    }
    if (picked.has(square)) picked.delete(square)
    else picked.add(square)
    api.mark(picked)
    if (!picked.has('a3') || !picked.has('h3')) {
      api.status('Mai apasă și celălalt nebun.')
      return
    }
    api.prompt('Caii stau în colțuri. Cum se numește avantajul celor doi nebuni?')
    ask(api, [
      {
        label: 'Avantajul perechii de nebuni',
        onClick: () => grade(api, id, true, 'Perechea de nebuni este un tip de avantaj: doi nebuni contra doi cai, când tabla este deschisă. Cum lucrează perechea ai văzut la A9. Aici o deosebești de material, care este egal, și de un nebun singur.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Doi nebuni valorează cât doi cai, la numărătoare. Avantajul este perechea, nu o piesă în plus.') },
      { label: 'Dau șah pe e6', onClick: () => grade(api, id, false, 'Be6+ este șah, nu numele avantajului. Avantajul este că ai rămas cu ambii nebuni.') },
    ])
  })
}

function openF8(api, id) {
  api.show(
    F8_FEN,
    'Trei pioni contra trei. Unul de-al tău nu poate fi oprit de niciun pion advers. Apasă-l.',
  )
  api.listen((square) => {
    if (square === 'e6') {
      api.status('Pionul este deja liber pe e5. Nu trebuie să-l împingi ca să-l recunoști.')
      return
    }
    if (square === 'a2' || square === 'b2' || square === 'a7' || square === 'b7' || square === 'c7') {
      api.status('Pe flancul damei pionii se privesc. Pionul liber este pe e5.')
      return
    }
    if (square !== 'e5') {
      api.status('Pionul liber este pe e5.')
      return
    }
    api.prompt('Sunt trei pioni de fiecare parte. Ce are e5 și nu au ceilalți?')
    ask(api, [
      {
        label: 'Avantajul pionului liber',
        onClick: () => grade(api, id, true, 'Pionul liber nu are pion advers pe coloana lui și nici pe coloanele vecine, în drumul spre promovare. e5 este liber: negrul nu are pion pe d, e sau f. a2 și b2 nu sunt, pentru că negrul are pioni pe a, b și c. Materialul este egal. Cum se conduce pionul liber ai învățat la finalurile de pioni, la Turn.'),
      },
      { label: 'Avantaj material', onClick: () => grade(api, id, false, 'Trei pioni contra trei. Nu ai mai mult material. Ai un pion care nu poate fi oprit de pionii lui.') },
      { label: 'Toți pionii mei sunt liberi', onClick: () => grade(api, id, false, 'a2 și b2 au pioni adverși pe coloanele vecine. Liber este doar e5.') },
    ])
  })
}

function openF9(api, id) {
  api.show(
    C3_FEN,
    'Turnul de pe linia 7 este activ. Transformă activitatea într-un avantaj concret. Apasă pionul.',
  )
  api.listen((square) => {
    if (square !== 'a7') {
      api.status('Pionul care transformă activitatea este pe a7.')
      return
    }
    api.show(afterMove(C3_FEN, 'Rxa7'), 'Activitatea a luat un pion. Care este lanțul întreg?')
    ask(api, [
      {
        label: 'Activitate, pion, schimburi, final câștigat',
        onClick: () => grade(api, id, true, 'Un avantaj se transformă în altul, mai concret. Aici: activitatea turnului de pe linia 7, apoi pionul de pe a7, apoi schimbul pieselor, apoi finalul câștigat. Nu te oprești la „piesele stau frumos” și nu schimbi turnul înainte să iei pionul. Așa se leagă strategia, calculul, schimbul și finalul.'),
      },
      { label: 'Mă opresc la activitate', onClick: () => grade(api, id, false, 'Activitatea este primul pas. Fără pion și fără trecerea în final, avantajul rămâne doar o impresie.') },
      { label: 'Schimb turnul înainte de pion', onClick: () => grade(api, id, false, 'Schimbul înainte de Rxa7 îți ia tocmai piesa care câștigă pionul. Întâi avantajul concret, apoi schimburile.') },
    ])
  })
}

const CHAPTERS = {
  'dm-a1': { code: 'DM-A1', title: 'A1. Evaluarea poziției', open: openA1 },
  'dm-a2': { code: 'DM-A2', title: 'A2. Planul, nu mutarea izolată', open: openA2 },
  'dm-a3': { code: 'DM-A3', title: 'A3. Pionul izolat', open: openA3 },
  'dm-a4': { code: 'DM-A4', title: 'A4. Pionii suspendați', open: openA4 },
  'dm-a5': { code: 'DM-A5', title: 'A5. Pionii dublați', open: openA5 },
  'dm-a6': { code: 'DM-A6', title: 'A6. Majoritatea de pioni', open: openA6 },
  'dm-a7': { code: 'DM-A7', title: 'A7. Coloane deschise și semi-deschise', open: openA7 },
  'dm-a8': { code: 'DM-A8', title: 'A8. Avanpostul', open: openA8 },
  'dm-a9': { code: 'DM-A9', title: 'A9. Perechea de nebuni', open: openA9 },
  'dm-b1': { code: 'DM-B1', title: 'B1. Gândirea profilactică', open: openB1 },
  'dm-b2': { code: 'DM-B2', title: 'B2. Apărarea fără slăbiciuni noi', open: openB2 },
  'dm-b3': { code: 'DM-B3', title: 'B3. Ghidul schimburilor', open: openB3 },
  'dm-c1': { code: 'DM-C1', title: 'C1. Regruparea', open: openC1 },
  'dm-c2': { code: 'DM-C2', title: 'C2. Calculul în adâncime', open: openC2 },
  'dm-c3': { code: 'DM-C3', title: 'C3. Lichidarea spre final', open: openC3 },
  'dm-d1': { code: 'DM-D1', title: 'D1. De la deschidere la plan', open: openD1 },
  'dm-d2': { code: 'DM-D2', title: 'D2. Centrul clasic și centrul hipermodern', open: openD2 },
  'dm-e1': { code: 'DM-E1', title: 'E1. Tăierea regelui', open: openE1 },
  'dm-e2': { code: 'DM-E2', title: 'E2. Nebun bun și nebun rău', open: openE2 },
  'dm-e3': { code: 'DM-E3', title: 'E3. Nebuni de culori opuse', open: openE3 },
  'dm-e4': { code: 'DM-E4', title: 'E4. Calul și nebunul', open: openE4 },
  'dm-f1': { code: 'DM-F1', title: 'F1. Avantaj material', open: openF1 },
  'dm-f2': { code: 'DM-F2', title: 'F2. Avantaj de dezvoltare', open: openF2 },
  'dm-f3': { code: 'DM-F3', title: 'F3. Avantaj de spațiu', open: openF3 },
  'dm-f4': { code: 'DM-F4', title: 'F4. Avantaj de activitate', open: openF4 },
  'dm-f5': { code: 'DM-F5', title: 'F5. Avantaj structural', open: openF5 },
  'dm-f6': { code: 'DM-F6', title: 'F6. Avantaj de inițiativă', open: openF6 },
  'dm-f7': { code: 'DM-F7', title: 'F7. Avantajul perechii de nebuni', open: openF7 },
  'dm-f8': { code: 'DM-F8', title: 'F8. Avantajul pionului liber', open: openF8 },
  'dm-f9': { code: 'DM-F9', title: 'F9. Transformarea avantajului', open: openF9 },
}

export function isDamaChapter(id) {
  return Object.prototype.hasOwnProperty.call(CHAPTERS, id)
}

export function openDamaChapter(id, api) {
  const chapter = CHAPTERS[id]
  api.badge(chapter.code)
  api.title(chapter.title)
  api.silence()
  api.clearResult()
  chapter.open(api, id)
}

export function describeDamaChapter(id) {
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
