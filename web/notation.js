// Litera piesei din română devine SAN înainte de chess.js.
// D damă → Q, N nebun → B, T turn → R, C cal → N, R rege → K.
// Notația engleză se încearcă prima (Nf3 rămâne cal). UCI-ul păstrează câmpurile.

import { Chess } from './vendor/chess.js'

const PIECE_MAP = { C: 'N', N: 'B', T: 'R', D: 'Q', R: 'K' }

function mapPiece(letter) {
  const upper = String(letter || '').toUpperCase()
  return PIECE_MAP[upper] || upper
}

function splitPiece(prefix, captured) {
  if (!prefix) return ['', '']
  const head = prefix[0]
  const rest = prefix.slice(1)
  const upper = head.toUpperCase()
  const known = Object.hasOwn(PIECE_MAP, upper) || 'KQB'.includes(upper)
  const file = /^[a-h]$/i.test(head)
  if (!known) return ['', prefix.toLowerCase()]
  if (captured && file && !rest) {
    if (head !== head.toLowerCase() && 'BCD'.includes(upper)) return [mapPiece(head), '']
    return ['', prefix.toLowerCase()]
  }
  if (!captured && file && !rest && head === head.toLowerCase() && !'CD'.includes(upper)) {
    return ['', prefix.toLowerCase()]
  }
  return [mapPiece(head), rest.toLowerCase()]
}

export function toInternational(text) {
  const original = String(text || '').trim()
  if (!original || /^(?:O-O|O-O-O|0-0|0-0-0)$/i.test(original)) return original
  let body = original.replace(/[×:]/g, 'x')
  let suffix = ''
  while (/[+#?!]$/.test(body)) {
    suffix = body.slice(-1) + suffix
    body = body.slice(0, -1)
  }
  let promo = ''
  const promoMatch = body.match(/=([A-Za-z])$/)
  if (promoMatch) {
    promo = `=${mapPiece(promoMatch[1])}`
    body = body.slice(0, -2)
  }
  const destMatch = body.match(/([a-h][1-8])$/i)
  if (!destMatch) return original
  const dest = destMatch[1].toLowerCase()
  body = body.slice(0, -2)
  let capture = ''
  if (/x$/i.test(body)) {
    capture = 'x'
    body = body.slice(0, -1)
  }
  const [piece, disambiguation] = splitPiece(body, Boolean(capture))
  return `${piece}${disambiguation}${capture}${dest}${promo}${suffix}`
}

function sanCase(text) {
  const body = String(text || '')
  if (/^[a-h](?:[x×:])?[a-h][1-8]/i.test(body)) return body
  return body
    .replace(/^([pnbrqk])/, (letter) => letter.toUpperCase())
    .replace(/=([pnbrqk])(?=[+#?!]*$)/, (_, piece) => `=${piece.toUpperCase()}`)
}

export function sanTokens(text) {
  return String(text || '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map((token) => token
      .replace(/^\d+\.(?:\.\.)?/, '')
      .replace(/^[,;]+|[,;]+$/g, '')
      .trim())
    .filter((token) => token
      && !/^\d+\.+$/.test(token)
      && !/^\$\d+$/.test(token)
      && !/^(?:1-0|0-1|1\/2-1\/2|\*)$/.test(token)
      && !/^(?:mate|mat|check|șah|sah|échec|echec)$/i.test(token))
}

function unwrapSolution(text) {
  if (Array.isArray(text)) return text.join(' ')
  let raw = String(text || '').trim()
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) raw = parsed.join(' ')
    } catch {
      raw = raw.replace(/[\[\]"]/g, ' ')
    }
  }
  return raw
}

function solutionText(text) {
  return unwrapSolution(text).split(/\s*(?:\/|\bsau\b|\bor\b)\s*/i)[0]
}

function expandParens(text) {
  const source = String(text || '').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim()
  if (!source.includes('(')) return source ? [source] : []
  const lines = []
  const walk = (rest) => {
    const match = rest.match(/^(.*?)\(([^()]*)\)(.*)$/)
    if (!match) {
      const line = rest.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
      if (line) lines.push(line)
      return
    }
    const before = match[1].trim()
    const inside = match[2].trim()
    const after = match[3].trim()
    walk(`${before} ${after}`.replace(/\s+/g, ' ').trim())
    const prefix = before.split(/\s+/).filter(Boolean)
    prefix.pop()
    if (inside) walk(`${prefix.join(' ')} ${inside} ${after}`.replace(/\s+/g, ' ').trim())
  }
  walk(source)
  return lines
}

export function solutionLines(fen, text) {
  const branches = solutionBranches(text)
  const seeds = branches.length ? branches : [String(text || '').trim()]
  const lines = []
  for (const seed of seeds) {
    const line = solutionMoves(fen, seed)
    if (line.length) lines.push(line)
  }
  const playable = (line) => line.every((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(String(token)))
  return lines.filter((line, index) => !lines.some((other, otherIndex) => otherIndex !== index
    && playable(other)
    && other.length > line.length
    && line.every((token, step) => token === other[step])))
}

export function solutionBranches(text) {
  const chunks = unwrapSolution(text).split(/\s*(?:\/|\bsau\b|\bor\b)\s*/i).map((part) => part.trim()).filter(Boolean)
  const lines = []
  for (const chunk of chunks) lines.push(...expandParens(chunk))
  const unique = []
  for (const line of lines) {
    const clean = line.replace(/\s+/g, ' ').trim()
    if (clean && !unique.includes(clean)) unique.push(clean)
  }
  return unique
}

// Linia completă, în ordinea din soluție: mutarea elevului, răspunsul, mutarea următoare.
// O mutare care nu poate fi reluată din FEN rămâne în linie, ca să nu se închidă exercițiul după prima mutare.
export function solutionMoves(fen, text) {
  const tokens = sanTokens(solutionText(text)).filter((token) => !/^(sau|or|oder)$/i.test(token))
  if (!tokens.length) return []
  let chess = null
  try {
    chess = new Chess(fen)
  } catch {
    chess = null
  }
  const line = []
  for (const token of tokens) {
    if (!chess) {
      line.push(token)
      continue
    }
    try {
      const next = new Chess(chess.fen())
      line.push(moveUci(playTypedMove(next, token)))
      chess = next
    } catch {
      line.push(token)
    }
  }
  return line
}

export function firstMoveForSide(fen, text) {
  return solutionMoves(fen, text)[0] || ''
}

// Prima mutare din secvență care nu poate fi jucată pe FEN. Șir gol dacă linia e legală sau goală.
export function illegalSequenceMove(fen, text) {
  const tokens = sanTokens(solutionText(text)).filter((token) => !/^(sau|or|oder)$/i.test(token))
  if (!tokens.length) return ''
  let chess
  try {
    chess = new Chess(fen)
  } catch {
    return tokens[0]
  }
  for (const token of tokens) {
    try {
      const next = new Chess(chess.fen())
      if (!moveUci(playTypedMove(next, token))) return token
      chess = next
    } catch {
      return token
    }
  }
  return ''
}

export function formatSolution(value) {
  if (Array.isArray(value)) return value.map((move) => String(move || '').trim()).filter(Boolean).join(' ')
  return String(value || '').trim()
}

function bareMove(text) {
  return String(text || '')
    .trim()
    .replace(/^\d+\.(?:\.\.)?/, '')
    .replace(/[+#†‡]/g, '')
    .replace(/[!?]+/g, '')
    .replace(/[x×:]/g, '')
    .toLowerCase()
}

function moveUci(move) {
  if (!move?.from || !move?.to) return ''
  return `${move.from}${move.to}${move.promotion || ''}`.toLowerCase()
}

function normalizePromotionText(text) {
  let body = String(text || '').trim()
  if (!body) return body
  body = body.replace(/^([a-h][1-8][a-h][1-8])c(?=[+#†‡!?]*$)/i, '$1n')
  body = body.replace(/=c(?=[+#†‡!?]*$)/i, '=N')
  body = body.replace(/^([a-h][x×:])?([a-h][1-8])c(?=[+#†‡!?]*$)/i, (_, cap, dest) => `${cap || ''}${dest}=N`)
  body = body.replace(/^([a-h][x×:])?([a-h][1-8])n(?=[+#†‡!?]*$)/i, (_, cap, dest) => `${cap || ''}${dest}=N`)
  return body
}

function promotionLetter(text) {
  const normalized = normalizePromotionText(text)
  const uci = uciToken(normalized)
  if (uci[4]) return uci[4]
  const equal = normalized.match(/=([QRBNqrbn])(?=[+#†‡!?]*$)/)
  return equal ? equal[1].toLowerCase() : ''
}

function uciToken(text) {
  const raw = String(text || '')
    .trim()
    .replace(/^\d+\.(?:\.\.)?/, '')
    .toLowerCase()
    .replace(/[+#†‡!?]/g, '')
    .replace(/-/g, '')
  const match = raw.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/)
  if (!match) return ''
  return `${match[1]}${match[2]}${match[3] || ''}`
}

function withoutDecor(text) {
  return String(text || '')
    .trim()
    .replace(/^\d+\.(?:\.\.)?/, '')
    .replace(/[+#†‡!?]/g, '')
}

function pieceChoices(text) {
  const letter = withoutDecor(text)[0] || ''
  const upper = letter.toUpperCase()
  const capital = letter === upper
  if (capital && upper === 'D') return ['q']
  if (capital && upper === 'T') return ['r']
  if (capital && upper === 'C') return ['n']
  if (capital && upper === 'N') return ['n', 'b']
  if (capital && (upper === 'Q' || upper === 'R' || upper === 'B' || upper === 'K')) return [upper.toLowerCase()]
  if (/^[a-h]/i.test(letter)) return ['p']
  return []
}

function originHint(text) {
  const uci = uciToken(text)
  if (uci) return uci.slice(0, 2)
  const intl = toInternational(withoutDecor(text)).replace(/[+#†‡!?]/g, '')
  const match = intl.match(/^([NBRQK])?([a-h][1-8]|[a-h]|[1-8])?x?([a-h][1-8])(?:=?[qrbn])?$/i)
  if (!match) return ''
  return (match[2] || '').toLowerCase()
}

function destinationOf(text) {
  const uci = uciToken(text)
  if (uci) return uci.slice(2, 4)
  const intl = toInternational(withoutDecor(text)).replace(/[+#†‡!?]/g, '')
  const match = intl.match(/([a-h][1-8])(?:=?[qrbn])?$/i)
  return match ? match[1].toLowerCase() : ''
}

function originOk(move, origin) {
  if (!origin) return true
  if (origin.length === 2) return move.from === origin
  return move.from[0] === origin || move.from[1] === origin
}

function matchingLegal(fen, text) {
  let chess
  try {
    chess = new Chess(fen)
  } catch {
    return []
  }
  const legal = chess.moves({ verbose: true })
  const uci = uciToken(text)
  if (uci) return legal.filter((move) => moveUci(move) === uci)
  const bare = bareMove(text)
  const bySan = legal.filter((move) => bare && bareMove(move.san) === bare)
  if (bySan.length) return bySan
  const dest = destinationOf(text)
  if (!dest) return []
  const origin = originHint(text)
  for (const piece of pieceChoices(text)) {
    const hits = legal.filter((move) => move.to === dest
      && (!piece || move.piece === piece)
      && originOk(move, origin))
    if (hits.length) return hits
  }
  return []
}

function romanianPieceToken(text) {
  const trimmed = withoutDecor(text).replace(/[×:]/g, 'x')
  if (!trimmed || uciToken(trimmed) || /^(?:O-O|O-O-O|0-0|0-0-0)$/i.test(trimmed)) return ''
  let body = trimmed
  let suffix = ''
  const promo = body.match(/=([A-Za-z])$/)
  if (promo) {
    suffix = `=${mapPiece(promo[1])}`
    body = body.slice(0, -2)
  }
  const dest = body.match(/([a-h][1-8])$/i)
  if (!dest) return ''
  const square = dest[1].toLowerCase()
  body = body.slice(0, -2)
  let capture = ''
  if (/x$/i.test(body)) {
    capture = 'x'
    body = body.slice(0, -1)
  }
  if (!body) return ''
  const letter = body[0]
  const upper = letter.toUpperCase()
  if (!Object.hasOwn(PIECE_MAP, upper)) return ''
  if (/^[a-h]$/i.test(body) && capture && !'CD'.includes(upper)) return ''
  const rest = body.slice(1).toLowerCase()
  return `${mapPiece(letter)}${rest}${capture}${square}${suffix}`
}

function unique(list) {
  const out = []
  for (const item of list) {
    if (item && !out.includes(item)) out.push(item)
  }
  return out
}

export function playTypedMove(chess, text) {
  const trimmed = normalizePromotionText(String(text || '').trim().replace(/^\d+\.(?:\.\.)?/, ''))
  if (!trimmed) throw new Error('Invalid move: ')
  const compact = trimmed.replace(/[+#†‡!?]/g, '').replace(/-/g, '')
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(compact)) {
    const from = compact.slice(0, 2).toLowerCase()
    const to = compact.slice(2, 4).toLowerCase()
    const occupant = chess.get(from)
    const promotion = compact[4]?.toLowerCase()
      || (occupant?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined)
    return chess.move({ from, to, promotion })
  }
  const plain = withoutDecor(trimmed)
  const captured = plain.replace(/[x×:]/g, '')
  const candidates = unique([
    trimmed,
    plain,
    sanCase(plain),
    toInternational(plain),
    toInternational(trimmed),
    romanianPieceToken(plain),
    romanianPieceToken(trimmed),
    captured,
    sanCase(captured),
    toInternational(captured),
    romanianPieceToken(captured),
  ])
  let last
  for (const candidate of candidates) {
    try {
      return chess.move(candidate)
    } catch (err) {
      last = err
    }
  }
  const hits = matchingLegal(chess.fen(), trimmed)
  if (hits.length === 1) {
    return chess.move({
      from: hits[0].from,
      to: hits[0].to,
      promotion: hits[0].promotion,
    })
  }
  throw last || new Error(`Invalid move: ${trimmed}`)
}

function moveIsLegal(fen, move) {
  try {
    playTypedMove(new Chess(fen), move)
    return true
  } catch {
    return false
  }
}

// Poziție legală pentru editor: exact un rege alb și unul negru, pionii nu stau
// pe rândurile 1 sau 8, iar regele culorii care NU este la mutare nu este în șah.
// Șahul la mutare este legal. Orientarea vizuală a tablei nu intră în calcul.
export function legalPosition(fen) {
  const text = String(fen || '').trim()
  const parts = text.split(/\s+/)
  const ranks = (parts[0] || '').split('/')
  const turn = parts[1] === 'b' ? 'b' : (parts[1] === 'w' ? 'w' : '')
  if (!turn || ranks.length !== 8) return false
  const map = new Map()
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    let file = 0
    let previousNumber = false
    for (const symbol of ranks[rankIndex]) {
      if (symbol >= '1' && symbol <= '8') {
        if (previousNumber) return false
        file += Number(symbol)
        previousNumber = true
        continue
      }
      previousNumber = false
      if (!/^[prnbqkPRNBQK]$/.test(symbol) || file > 7) return false
      map.set('abcdefgh'[file] + (8 - rankIndex), {
        type: symbol.toLowerCase(),
        color: symbol === symbol.toUpperCase() ? 'w' : 'b',
      })
      file += 1
    }
    if (file !== 8) return false
  }
  const kings = { w: '', b: '' }
  for (const [square, piece] of map) {
    if (piece.type === 'p' && (square[1] === '1' || square[1] === '8')) return false
    if (piece.type !== 'k') continue
    if (kings[piece.color]) return false
    kings[piece.color] = square
  }
  if (!kings.w || !kings.b) return false
  const idle = turn === 'w' ? 'b' : 'w'
  try {
    const chess = new Chess(`${parts[0]} ${turn} - - 0 1`, { skipValidation: true })
    return !chess.isAttacked(kings[idle], turn)
  } catch {
    return false
  }
}

function fenWithTurn(fen, turn) {
  const parts = String(fen || '').trim().split(/\s+/)
  if (parts.length < 2 || (turn !== 'w' && turn !== 'b')) return ''
  const next = parts.slice()
  next[1] = turn
  return next.join(' ')
}

// O mutare reală (SAN sau câmp-câmp), legală pentru partea din FEN sau pentru cealaltă.
// Un singur câmp, cum este h8, nu este o mutare.
export function movePlayable(fen, moveText) {
  const current = String(fen || '').trim()
  const move = String(moveText || '').trim()
  if (!current || !move || /^[a-h][1-8]$/i.test(move)) return false
  if (moveIsLegal(current, move)) return true
  const other = fenWithTurn(current, current.split(/\s+/)[1] === 'b' ? 'w' : 'b')
  return Boolean(other) && moveIsLegal(other, move)
}

// Păstrează poziția și schimbă doar culoarea la mutare, dacă soluția e legală doar pentru cealaltă parte.
export function fenAlignedToMove(fen, moveText) {
  const current = String(fen || '').trim()
  const move = String(moveText || '').trim()
  if (!current || !move || /^[a-h][1-8]$/i.test(move)) return current
  if (moveIsLegal(current, move)) return current
  const other = fenWithTurn(current, current.split(/\s+/)[1] === 'b' ? 'w' : 'b')
  return other && moveIsLegal(other, move) ? other : current
}

export function promotionForSquare(fen, from, to, texts) {
  const list = Array.isArray(texts) ? texts : [texts]
  for (const text of list) {
    const promo = promotionLetter(text)
    if (!promo) continue
    const dest = destinationOf(normalizePromotionText(text))
    if (dest && dest !== to) continue
    try {
      playTypedMove(new Chess(fen), `${from}${to}${promo}`)
      return promo
    } catch {
      // Promovarea din text nu este legală din acest câmp.
    }
  }
  return ''
}

export function sameMove(played, expected) {
  const want = normalizePromotionText(String(expected || '').trim())
  if (!want || !played?.from || !played?.to) return false
  const uci = moveUci(played)
  if (uciToken(want) && uciToken(want) === uci) return true
  if (played.san && bareMove(played.san) === bareMove(want)) return true
  if (!played.before) return false
  try {
    const resolved = playTypedMove(new Chess(played.before), want)
    if (moveUci(resolved) === uci) return true
  } catch {
    // Mai multe piese pot ajunge pe același câmp: comparăm lista legală.
  }
  try {
    return matchingLegal(played.before, want).some((move) => moveUci(move) === uci)
  } catch {
    return false
  }
}
