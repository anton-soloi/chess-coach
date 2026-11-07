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

function solutionText(text) {
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
  return raw.split(/\s*(?:\/|\bsau\b|\bor\b)\s*/i)[0]
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
  const trimmed = String(text || '').trim().replace(/^\d+\.(?:\.\.)?/, '')
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

export function sameMove(played, expected) {
  const want = String(expected || '').trim()
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
