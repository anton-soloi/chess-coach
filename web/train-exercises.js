// Pedagogical tree for the Train "Exerciții" sidebar.
// Mate pattern names stay in English, as in the curriculum spec.

const click = (square) => (picked) => picked === square

function drill(fields) {
  return { ...fields, accept: click(fields.square) }
}

function mates(id, title, positions) {
  return {
    id,
    title,
    children: positions.map((item, index) => {
      const common = {
        id: `${id}-${index + 1}`,
        code: item.code,
        title: `${title} #${index + 1}`,
        fen: item.fen,
      }
      const move = String(item.move || '').trim()
      if (move && !/^[a-h][1-8]$/i.test(move)) {
        return {
          ...common,
          pieceClick: false,
          correctMove: move,
          solutie: move.split(/\s+/).filter(Boolean),
          prompt: item.prompt || `Pe tablă este ${title}. Găsește mutarea corectă.`,
          ok: item.ok || `Corect. ${move.split(/\s+/)[0]} este mutarea.`,
          bad: item.bad || `Mutarea corectă este ${move.split(/\s+/)[0]}.`,
        }
      }
      return drill({
        ...common,
        square: item.square,
        pieceClick: true,
        expect: 'mate',
        prompt: `Pe tablă este ${title}. Apasă piesa care dă matul.`,
        ok: `Corect. Piesa de pe ${item.square} dă ${title}.`,
        bad: `Piesa care dă matul este pe ${item.square}.`,
      })
    }),
  }
}

function authoredLeaf(item) {
  const move = String(item.move || '').trim()
  const square = /^[a-h][1-8]$/i.test(move) ? move.toLowerCase() : ''
  const base = {
    id: item.id,
    code: item.code || item.id,
    title: item.title,
    fen: item.fen,
    prompt: item.prompt || '',
    note: item.note || '',
    authored: true,
    parentId: item.parentId || '',
    afterId: item.afterId || '',
    ancestors: Array.isArray(item.ancestors) ? item.ancestors : [],
    goal: item.goal === 'mate' || item.goal === 'advantage' ? item.goal : '',
    pgn: item.pgn || '',
  }
  if (square) {
    return drill({
      ...base,
      square,
      pieceClick: true,
      expect: 'quiet',
    })
  }
  return {
    ...base,
    pieceClick: false,
    correctMove: move,
    solutie: move ? move.split(/\s+/).filter(Boolean) : [],
  }
}

function insertLeaf(nodes, parentId, afterId, leaf) {
  if (!parentId) return false
  for (const node of nodes) {
    if (node.id === parentId && Array.isArray(node.children)) {
      const index = node.children.findIndex((child) => child.id === afterId)
      if (index >= 0) node.children.splice(index + 1, 0, leaf)
      else node.children.push(leaf)
      return true
    }
    if (node.children && insertLeaf(node.children, parentId, afterId, leaf)) return true
  }
  return false
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = node.children && findNode(node.children, id)
    if (found) return found
  }
  return null
}

function graftSections(tree, sections) {
  for (const item of Array.isArray(sections) ? sections : []) {
    const id = String(item?.id || '').trim()
    const title = String(item?.title || '').trim()
    const parentId = String(item?.parentId || '').trim()
    if (!id || !title || !parentId || findNode(tree, id)) continue
    const node = { id, title, children: [], authoredSection: true }
    insertLeaf(tree, parentId, item.afterId || '', node)
  }
}

function graftAuthored(tree, authored) {
  const pending = []
  for (const item of Array.isArray(authored) ? authored : []) {
    if (!item?.id || !item.fen || !item.title) continue
    const leaf = authoredLeaf(item)
    if (!insertLeaf(tree, item.parentId, item.afterId, leaf)) pending.push(leaf)
  }
  if (pending.length) {
    tree.push({
      id: 'authored',
      titleKey: 'trainEx.authored',
      children: pending,
    })
  }
}

export function trainExerciseTree(apiItems = [], authored = [], sections = []) {
  const incoming = Array.isArray(apiItems) ? apiItems : []
  const published = incoming.map((item) => ({
    exerciseId: item.id,
    code: item.code,
    title: `${item.code} · ${item.title}`,
    difficulty: item.difficulty,
    level: item.level,
    published: item.published,
  }))

  const tree = [
    {
      id: 'check',
      titleKey: 'trainEx.check',
      children: [
        drill({
          id: 'check-pawn',
          code: 'S.01',
          titleKey: 'trainEx.checkPawn',
          fen: '8/8/3k4/4P3/8/8/8/4K3 b - - 0 1',
          square: 'e5',
          pieceClick: true,
          expect: 'check',
          prompt: 'Pionul alb dă șah regelui negru. Apasă pionul care dă șahul.',
          ok: 'Pionul de pe e5 dă șah regelui de pe d6.',
          bad: 'Șahul vine de la pionul de pe e5.',
        }),
        drill({
          id: 'check-knight',
          code: 'S.02',
          titleKey: 'trainEx.checkKnight',
          fen: '4k3/8/3N4/8/8/8/8/4K3 b - - 0 1',
          square: 'd6',
          pieceClick: true,
          expect: 'check',
          prompt: 'Calul alb dă șah. Apasă calul care dă șahul.',
          ok: 'Calul de pe d6 dă șah regelui de pe e8.',
          bad: 'Șahul vine de la calul de pe d6.',
        }),
        drill({
          id: 'check-bishop',
          code: 'S.03',
          titleKey: 'trainEx.checkBishop',
          fen: '4k3/8/8/8/B7/8/8/4K3 b - - 0 1',
          square: 'a4',
          pieceClick: true,
          expect: 'check',
          prompt: 'Nebunul alb dă șah pe diagonală. Apasă nebunul care dă șahul.',
          ok: 'Nebunul de pe a4 dă șah regelui de pe e8.',
          bad: 'Șahul vine de la nebunul de pe a4.',
        }),
        drill({
          id: 'check-rook',
          code: 'S.04',
          titleKey: 'trainEx.checkRook',
          fen: '4k3/8/8/8/8/8/8/4RK2 b - - 0 1',
          square: 'e1',
          pieceClick: true,
          expect: 'check',
          prompt: 'Turnul alb dă șah pe coloană. Apasă turnul care dă șahul.',
          ok: 'Turnul de pe e1 dă șah regelui de pe e8.',
          bad: 'Șahul vine de la turnul de pe e1.',
        }),
        drill({
          id: 'check-queen',
          code: 'S.05',
          titleKey: 'trainEx.checkQueen',
          fen: '4k3/8/8/8/8/8/8/4QK2 b - - 0 1',
          square: 'e1',
          pieceClick: true,
          expect: 'check',
          prompt: 'Dama albă dă șah. Apasă dama care dă șahul.',
          ok: 'Dama de pe e1 dă șah regelui de pe e8.',
          bad: 'Șahul vine de la dama de pe e1.',
        }),
      ],
    },
    {
      id: 'mate',
      titleKey: 'trainEx.mate',
      children: [
        mates('back-rank', 'Back-Rank Mate', [
          { code: 'M.BR1', fen: 'R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1', square: 'a8' },
          { code: 'M.BR2', fen: '1R4k1/5ppp/8/8/8/8/8/4K3 b - - 0 1', square: 'b8' },
          { code: 'M.BR3', fen: '2R3k1/5ppp/8/8/8/8/8/4K3 b - - 0 1', square: 'c8' },
          { code: 'M.BR4', fen: '3R2k1/5ppp/8/8/8/8/8/4K3 b - - 0 1', square: 'd8' },
        ]),
        mates('hook', 'Hook Mate', [
          { code: 'M.HK1', fen: '6Rk/6p1/5N2/6P1/8/8/8/6K1 b - - 0 1', square: 'g8' },
          { code: 'M.HK2', fen: 'kR6/1p6/2N5/1P6/8/8/8/K7 b - - 0 1', square: 'b8' },
          { code: 'M.HK3', fen: '6Rk/6p1/5N2/6P1/8/8/6K1/8 b - - 0 1', square: 'g8' },
        ]),
        mates('anastasia', "Anastasia's Mate", [
          { code: 'M.AN1', fen: '7k/4N1p1/8/8/8/8/6K1/7R b - - 0 1', square: 'h1' },
          { code: 'M.AN2', fen: '7k/6p1/5N2/8/8/8/6K1/7R b - - 0 1', square: 'h1' },
          { code: 'M.AN3', fen: 'k7/1p6/2N5/8/8/8/1K6/R7 b - - 0 1', square: 'a1' },
          { code: 'M.AN4', fen: '7k/6p1/5N2/8/8/8/5K2/7R b - - 0 1', square: 'h1' },
        ]),
        mates('blind-swine', 'Blind Swine Mate', [
          { code: 'M.BS1', fen: 'k7/RR6/8/8/8/8/8/4K3 b - - 0 1', square: 'a7' },
          { code: 'M.BS2', fen: 'k7/RR6/8/8/8/8/8/6K1 b - - 0 1', square: 'a7' },
          { code: 'M.BS3', fen: 'k7/RR6/8/8/8/8/6K1/8 b - - 0 1', square: 'a7' },
        ]),
        mates('smothered', 'Smothered Mate', [
          { code: 'M.SM1', fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1', square: 'f7' },
          { code: 'M.SM2', fen: 'kr6/ppN5/8/8/8/8/8/K7 b - - 0 1', square: 'c7' },
          { code: 'M.SM3', fen: '6rk/5Npp/8/8/8/8/6K1/8 b - - 0 1', square: 'f7' },
          { code: 'M.SM4', fen: '6rk/5Npp/8/8/8/4K3/8/8 b - - 0 1', square: 'f7' },
        ]),
      ],
    },
    {
      id: 'mate-2',
      titleKey: 'trainEx.mate2',
      children: [
        mates('double-bishop', 'Double Bishop Mate', [
          { code: 'M2.DB1', fen: '7k/5B1p/8/8/8/8/1B6/4K3 b - - 0 1', square: 'b2' },
          { code: 'M2.DB2', fen: '7k/5B1p/8/8/8/2B5/8/4K3 b - - 0 1', square: 'c3' },
          { code: 'M2.DB3', fen: 'k7/p1B5/8/8/8/8/6B1/4K3 b - - 0 1', square: 'g2' },
        ]),
        mates('boden', "Boden's Mate", [
          {
            code: 'M2.BO1',
            fen: '2k1rb1r/ppp3pp/2n2q2/3B1b2/5P2/2P1BQ2/PP1N1P1P/2KR3R b - - 0 14',
            move: 'Qxc3+',
            prompt: 'Schulder–Boden, Londra 1853. Negrul la mutare. Dama de pe f6 sacrifică și dă șah: Qxc3+.',
            ok: 'Qxc3+ este sacrificiul. Dama pleacă de pe f6 și capturează pe c3, cu șah.',
            bad: 'Mutarea corectă este Qxc3+. Dama capturează pe c3, nu pe alt câmp.',
          },
          { code: 'M2.BO2', fen: '2kr4/3p4/B7/8/5B2/8/8/3K4 b - - 0 1', square: 'a6' },
          { code: 'M2.BO3', fen: '2kr4/3p4/B7/4B3/8/8/8/4K3 b - - 0 1', square: 'a6' },
        ]),
        mates('balestra', 'Balestra Mate', [
          { code: 'M2.BA1', fen: '7k/6Q1/5B2/8/8/8/8/6K1 b - - 0 1', square: 'g7' },
        ]),
        mates('arabian', 'Arabian Mate', [
          { code: 'M2.AR1', fen: '7k/7R/5N2/8/8/8/8/6K1 b - - 0 1', square: 'h7' },
          { code: 'M2.AR2', fen: 'k7/R7/2N5/8/8/8/8/K7 b - - 0 1', square: 'a7' },
          { code: 'M2.AR3', fen: '7k/7R/5N2/8/8/8/6K1/8 b - - 0 1', square: 'h7' },
        ]),
        mates('corner', 'Corner Mate', [
          { code: 'M2.CO1', fen: 'k7/1Q6/1K6/8/8/8/8/8 b - - 0 1', square: 'b7' },
          { code: 'M2.CO2', fen: 'k1R5/8/1K6/8/8/8/8/8 b - - 0 1', square: 'c8' },
        ]),
        mates('morphy', "Morphy's Mate", [
          { code: 'M2.MO1', fen: 'R5k1/6pp/8/8/8/8/B7/4K3 b - - 0 1', square: 'a8' },
          { code: 'M2.MO2', fen: '1R4k1/6pp/8/8/8/8/B7/4K3 b - - 0 1', square: 'b8' },
          { code: 'M2.MO3', fen: '5Rk1/7p/7B/8/8/8/8/4K3 b - - 0 1', square: 'f8' },
        ]),
        mates('pillsbury', "Pillsbury's Mate", [
          { code: 'M2.PI1', fen: '6kR/5p2/8/8/8/8/1B6/4K3 b - - 0 1', square: 'h8' },
          { code: 'M2.PI2', fen: '6kR/5p1p/8/8/8/8/1B6/4K3 b - - 0 1', square: 'h8' },
        ]),
        mates('damiano', "Damiano's Mate", [
          { code: 'M2.DA1', fen: '7k/6pQ/6P1/8/8/8/8/6K1 b - - 0 1', square: 'h7' },
          { code: 'M2.DA2', fen: 'k7/Qp6/1P6/8/8/8/8/K7 b - - 0 1', square: 'a7' },
          { code: 'M2.DA3', fen: '7k/6pQ/6P1/8/8/8/5K2/8 b - - 0 1', square: 'h7' },
        ]),
        mates('lolli', "Lolli's Mate", [
          { code: 'M2.LO1', fen: '7k/7Q/6B1/8/8/8/8/6K1 b - - 0 1', square: 'h7' },
          { code: 'M2.LO2', fen: '6k1/6Q1/5B2/8/8/8/8/6K1 b - - 0 1', square: 'g7' },
          { code: 'M2.LO3', fen: 'k7/Q7/1B6/8/8/8/8/K7 b - - 0 1', square: 'a7' },
        ]),
      ],
    },
    {
      id: 'mate-3',
      titleKey: 'trainEx.mate3',
      children: [
        mates('opera', 'Opera Mate', [
          { code: 'M3.OP1', fen: '6Rk/7p/8/8/8/8/B7/4K3 b - - 0 1', square: 'g8' },
          { code: 'M3.OP2', fen: '3Rk3/4pp2/8/B7/8/8/8/4K3 b - - 0 1', square: 'd8' },
          { code: 'M3.OP3', fen: 'kR6/p7/8/8/8/8/7B/4K3 b - - 0 1', square: 'b8' },
        ]),
        mates('anderssen', "Anderssen's Mate", [
          { code: 'M3.AN1', fen: 'Rk6/1P6/1K6/8/8/8/8/8 b - - 0 1', square: 'a8' },
          { code: 'M3.AN2', fen: '6kR/6P1/6K1/8/8/8/8/8 b - - 0 1', square: 'h8' },
          { code: 'M3.AN3', fen: '5Rk1/6P1/6K1/8/8/8/8/8 b - - 0 1', square: 'f8' },
        ]),
        mates('dovetail', 'Dovetail Mate', [
          { code: 'M3.DO1', fen: '8/8/8/8/8/p7/kpK5/1Q6 b - - 0 1', square: 'b1' },
          { code: 'M3.DO2', fen: '8/8/8/8/8/1p6/pk6/2QK4 b - - 0 1', square: 'c1' },
          { code: 'M3.DO3', fen: '8/8/8/8/8/2p5/2kp4/KQ6 b - - 0 1', square: 'b1' },
          { code: 'M3.DO4', fen: '8/8/8/8/8/7p/5Kpk/6Q1 b - - 0 1', square: 'g1' },
        ]),
        mates('cozio', "Cozio's Mate", [
          { code: 'M3.CO1', fen: '1Q6/kpK5/p7/8/8/8/8/8 b - - 0 1', square: 'b8' },
        ]),
        mates('swallow', "Swallow's Tail Mate", [
          { code: 'M3.SW1', fen: '8/8/4R1Q1/6k1/5p1p/5K2/8/8 b - - 0 1', square: 'g6' },
          { code: 'M3.SW2', fen: '8/8/8/8/8/8/p1p5/1kQRK3 b - - 0 1', square: 'c1' },
        ]),
        mates('epaulette', 'Epaulette Mate', [
          { code: 'M3.EP1', fen: '3rkr2/8/4Q3/8/8/8/8/4K3 b - - 0 1', square: 'e6' },
          { code: 'M3.EP2', fen: '5rkr/8/6Q1/8/8/8/8/6K1 b - - 0 1', square: 'g6' },
          { code: 'M3.EP3', fen: '1rkr4/8/2Q5/8/8/8/8/2K5 b - - 0 1', square: 'c6' },
        ]),
        mates('pawn-mate', 'Pawn Mate', [
          { code: 'M3.PA1', fen: '1k6/R1PK4/1P6/8/8/8/8/8 b - - 0 1', square: 'c7' },
          { code: 'M3.PA2', fen: '6k1/4KP1R/6P1/8/8/8/8/8 b - - 0 1', square: 'f7' },
        ]),
      ],
    },
    {
      id: 'basic',
      titleKey: 'trainEx.basic',
      children: [
        drill({
          id: 'fork',
          code: 'TB.01',
          titleKey: 'trainEx.fork',
          fen: '4k3/3q4/8/8/6N1/8/8/6K1 w - - 0 1',
          square: 'f6',
          expect: 'quiet',
          prompt: 'Calul alb de pe g4 poate ataca dintr-o dată regele și dama. Apasă câmpul furculiței.',
          ok: 'Nf6 este furculiță: calul dă șah pe e8 și atacă dama de pe d7.',
          bad: 'Câmpul furculiței este f6.',
        }),
        {
          id: 'discovery',
          code: 'TB.02',
          titleKey: 'trainEx.discovery',
          fen: '4k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1',
          square: 'c4',
          expect: 'quiet',
          correctMove: 'Nc4+',
          prompt: 'Calul de pe e5 stă în fața turnului. Mută calul la c4: pleacă de pe coloană, iar turnul dă șah prin descoperire.',
          ok: 'Nc4+ descoperă turnul de pe e1. Șahul vine de la piesa din spate.',
          bad: 'Mutarea este Nc4+. Calul părăsește coloana e, iar turnul dă șah.',
        },
      ],
    },
    {
      id: 'advanced',
      titleKey: 'trainEx.advanced',
      children: [
        drill({
          id: 'overload',
          code: 'TA.01',
          titleKey: 'trainEx.overload',
          fen: '6k1/6pp/5n2/3q4/8/2N5/8/1Q4K1 w - - 0 1',
          square: 'f6',
          expect: 'quiet',
          prompt: 'Calul negru din f6 apără și h7, și dama din d5. Nu le poate salva pe ambele. Apasă piesa supraîncărcată.',
          ok: 'Calul din f6 este supraîncărcat: o singură piesă are două sarcini.',
          bad: 'Piesa cu două sarcini este calul din f6.',
        }),
        drill({
          id: 'deflection',
          code: 'TA.02',
          titleKey: 'trainEx.deflection',
          fen: '6k1/1q3ppp/2B5/8/8/8/Q7/R5K1 w - - 0 1',
          square: 'a8',
          expect: 'quiet',
          prompt: 'Dama neagră stă pe b7. Dama albă dă șah pe a8 și o atrage de acolo. Apasă a8.',
          ok: 'Qa8+ este deflecție. Dacă dama neagră ia pe a8, turnul reia și dă mat.',
          bad: 'Câmpul deflecției este a8.',
        }),
      ],
    },
    {
      id: 'pawn-endings',
      titleKey: 'trainEx.pawnEnd',
      children: [
        {
          id: 'active-king',
          code: 'FP.01',
          titleKey: 'trainEx.activeKing',
          fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
          expect: 'quiet',
          prompt: 'În finalul de pioni, regele nu mai stă deoparte. Ce face regele alb?',
          choices: [
            { id: 'activ', label: 'Se apropie de pion' },
            { id: 'pasiv', label: 'Rămâne pe e1 toată partida' },
          ],
          answer: 'activ',
          ok: 'În final regele devine o piesă activă și se apropie de pion.',
          bad: 'Regele intră în joc și sprijină pionul.',
        },
      ],
    },
    {
      id: 'rook-endings',
      titleKey: 'trainEx.rookEnd',
      children: [
        drill({
          id: 'rook-mate',
          code: 'FT.01',
          titleKey: 'trainEx.rookMate',
          fen: 'R6k/8/6K1/8/8/8/8/8 b - - 0 1',
          square: 'a8',
          pieceClick: true,
          expect: 'mate',
          prompt: 'Turnul și regele alb au închis regele negru pe ultima linie. Apasă turnul care dă matul.',
          ok: 'Turnul de pe a8 dă mat, iar regele din g6 acoperă câmpurile de fugă.',
          bad: 'Matul vine de la turnul de pe a8.',
        }),
      ],
    },
    {
      id: 'sacrifice',
      titleKey: 'trainEx.sacrifice',
      children: [
        drill({
          id: 'sac-h7',
          code: 'ST.01',
          titleKey: 'trainEx.h7',
          fen: '6k1/6pp/8/7Q/8/8/8/6K1 w - - 0 1',
          square: 'h7',
          expect: 'quiet',
          prompt: 'Dama albă poate intra pe h7, în fața regelui, chiar dacă poate fi capturată. Apasă câmpul sacrificiului.',
          ok: 'h7 este sacrificiul tematic: dama se oferă lângă regele negru.',
          bad: 'Câmpul sacrificiului este h7.',
        }),
        ...published,
      ],
    },
  ]
  graftSections(tree, sections)
  graftAuthored(tree, authored)
  return tree
}
