// Exerciții de tipul „Learn - Chess Basics”: o piesă adună stele prin mutări legale.

import { Chess } from './vendor/chess.js'
import { t } from './i18n.js'

const PROGRESS_KEY = 'chesscoach.piecePath'

export const PIECE_SERIES = [
  {
    piece: 'p',
    kind: 'PawnMovePractice',
    levels: [
      level('pawn-1', 'p', '8/8/8/8/8/8/P7/8 w - - 0 1', ['a4']),
      level('pawn-2', 'p', '8/8/8/8/8/8/4P3/8 w - - 0 1', ['e4', 'e5']),
      level('pawn-3', 'p', '8/8/8/P7/8/8/8/8 w - - 0 1', ['f3']),
    ],
  },
  {
    piece: 'n',
    kind: 'KnightMovePractice',
    levels: [
      level('knight-1', 'n', '8/8/8/8/8/8/8/1N6 w - - 0 1', ['c3']),
      level('knight-2', 'n', '8/8/8/8/8/8/8/1N6 w - - 0 1', ['c3', 'a3']),
      level('knight-3', 'n', '8/8/8/8/8/8/8/6N1 w - - 0 1', ['f3', 'e2']),
    ],
  },
  {
    piece: 'b',
    kind: 'BishopMovePractice',
    levels: [
      level('bishop-1', 'b', '8/8/8/8/8/8/8/2B5 w - - 0 1', ['a3']),
      level('bishop-2', 'b', '8/8/8/8/8/8/8/2B5 w - - 0 1', ['f4']),
      level('bishop-3', 'b', '8/8/8/8/8/8/8/2B5 w - - 0 1', ['a3', 'f4']),
    ],
  },
  {
    piece: 'r',
    kind: 'RookMovePractice',
    levels: [
      level('rook-1', 'r', '8/8/8/8/8/8/8/R7 w - - 0 1', ['a4']),
      level('rook-2', 'r', '8/8/8/8/8/8/8/R7 w - - 0 1', ['h1']),
      level('rook-3', 'r', '8/8/8/8/8/8/8/R7 w - - 0 1', ['a8', 'h8']),
    ],
  },
  {
    piece: 'q',
    kind: 'QueenMovePractice',
    levels: [
      level('queen-1', 'q', '8/8/8/8/8/8/8/3Q4 w - - 0 1', ['d4']),
      level('queen-2', 'q', '8/8/8/8/8/8/8/3Q4 w - - 0 1', ['h5']),
      level('queen-3', 'q', '8/8/8/8/3Q4/8/8/8 w - - 0 1', ['a4', 'h8']),
    ],
  },
  {
    piece: 'k',
    kind: 'KingMovePractice',
    levels: [
      level('king-1', 'k', '8/8/8/8/8/8/8/4K3 w - - 0 1', ['e2']),
      level('king-2', 'k', '8/8/8/8/8/8/8/4K3 w - - 0 1', ['e3']),
      level('king-3', 'k', '8/8/8/8/4K3/8/8/8 w - - 0 1', ['d5', 'f5']),
    ],
  },
]

function level(id, piece, fen, stars) {
  return {
    id,
    type: 'PiecePathExercise',
    piece,
    color: 'w',
    fen,
    stars: stars.slice(),
  }
}

const hintCache = new Map()

function withTurn(fen, color) {
  const parts = fen.trim().split(/\s+/)
  parts[1] = color
  return parts.join(' ')
}

function chessOf(fen, color) {
  return new Chess(withTurn(fen, color), { skipValidation: true })
}

function occupant(fen) {
  const ranks = fen.trim().split(/\s+/)[0].split('/')
  for (let rankIndex = 0; rankIndex < ranks.length; rankIndex += 1) {
    let file = 0
    for (const symbol of ranks[rankIndex]) {
      if (symbol >= '1' && symbol <= '8') {
        file += Number(symbol)
        continue
      }
      return { square: 'abcdefgh'[file] + (8 - rankIndex), type: symbol.toLowerCase() }
    }
  }
  return { square: '', type: '' }
}

function pieceSquare(fen) {
  return occupant(fen).square
}

function playMove(fen, color, move) {
  const chess = chessOf(fen, color)
  const spec = { from: move.from, to: move.to }
  if (move.promotion) spec.promotion = move.promotion
  if (!chess.move(spec)) return ''
  return withTurn(chess.fen(), color)
}

function search(fen, color, stars) {
  const start = occupant(fen)
  const goal = stars.slice().sort().join(',')
  const cacheKey = `${fen}|${goal}`
  if (hintCache.has(cacheKey)) return hintCache.get(cacheKey)
  if (!goal) {
    const done = { moves: 0, first: null }
    hintCache.set(cacheKey, done)
    return done
  }
  const queue = [{ fen, left: goal, moves: 0, first: null }]
  const seen = new Set([`${start.type}${start.square}|${goal}`])
  let found = null
  while (queue.length) {
    const node = queue.shift()
    if (node.moves >= 16) continue
    let chess
    try {
      chess = chessOf(node.fen, color)
    } catch {
      continue
    }
    for (const move of chess.moves({ verbose: true })) {
      const nextFen = playMove(node.fen, color, move)
      if (!nextFen) continue
      const remain = node.left.split(',').filter((square) => square && square !== move.to).sort().join(',')
      const first = node.first || { from: move.from, to: move.to, promotion: move.promotion || '' }
      const kind = occupant(nextFen).type
      if (!remain) {
        found = { moves: node.moves + 1, first }
        queue.length = 0
        break
      }
      const key = `${kind}${move.to}|${remain}`
      if (seen.has(key)) continue
      seen.add(key)
      queue.push({ fen: nextFen, left: remain, moves: node.moves + 1, first })
    }
  }
  const result = found || { moves: null, first: null }
  hintCache.set(cacheKey, result)
  return result
}

export function optimalMoves(exercise) {
  return search(exercise.fen, exercise.color, exercise.stars).moves
}

function starScore(moves, optimal) {
  if (!optimal || moves <= optimal) return 3
  if (moves <= optimal + 2) return 2
  return 1
}

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')
    return parsed && typeof parsed.scores === 'object' ? parsed : { scores: {} }
  } catch {
    return { scores: {} }
  }
}

function writeProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

function seriesOf(levelId) {
  return PIECE_SERIES.find((series) => series.levels.some((item) => item.id === levelId)) || null
}

function levelIndex(series, levelId) {
  return series.levels.findIndex((item) => item.id === levelId)
}

export function piecePathUnlocked(levelId) {
  const series = seriesOf(levelId)
  if (!series) return false
  const index = levelIndex(series, levelId)
  if (index <= 0) return true
  const previous = series.levels[index - 1]
  return Number(readProgress().scores[previous.id] || 0) >= 1
}

let hooks = null
let session = null
const openPieces = new Set(['p'])

function boardWhiteAtBottom() {
  return hooks?.whiteAtBottom?.() !== false
}

function center(square, whiteAtBottom) {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  const col = whiteAtBottom ? file : 7 - file
  const row = whiteAtBottom ? 8 - rank : rank - 1
  return { x: col + 0.5, y: row + 0.5 }
}

function overlay() {
  return document.querySelector('#piece-path-overlay')
}

function paintStars(whiteAtBottom) {
  const host = overlay()?.querySelector('.piece-path-stars')
  if (!host) return
  host.replaceChildren()
  if (!session) return
  for (const square of session.left) {
    const point = center(square, whiteAtBottom)
    const star = document.createElement('span')
    star.className = 'path-star'
    star.style.left = `${(point.x / 8) * 100}%`
    star.style.top = `${(point.y / 8) * 100}%`
    star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.6 6.1 6.6.6-5 4.3 1.5 6.4L12 16.6 6.3 19.8l1.5-6.4-5-4.3 6.6-.6z"/></svg>'
    host.append(star)
  }
}

function paintGuides(whiteAtBottom) {
  const svg = overlay()?.querySelector('.piece-path-guides')
  if (!svg) return
  svg.replaceChildren()
  if (!session || session.done) return
  const hero = pieceSquare(session.fen)
  const guideFrom = session.selected || (session.hover === hero ? hero : '')
  if (!guideFrom) return
  let chess
  try {
    chess = chessOf(session.fen, session.color)
  } catch {
    return
  }
  const hint = search(session.fen, session.color, session.left).first
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  marker.innerHTML = '<marker id="piece-path-arrow" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0 0 L4 2 L0 4 Z" fill="#1f8a4c"/></marker>'
  svg.append(marker)
  for (const move of chess.moves({ square: guideFrom, verbose: true })) {
    const point = center(move.to, whiteAtBottom)
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    dot.setAttribute('cx', String(point.x))
    dot.setAttribute('cy', String(point.y))
    dot.setAttribute('r', '0.18')
    dot.setAttribute('fill', 'rgba(47, 160, 90, 0.45)')
    svg.append(dot)
  }
  if (!hint || hint.from !== guideFrom) return
  const from = center(hint.from, whiteAtBottom)
  const to = center(hint.to, whiteAtBottom)
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  line.setAttribute('x1', String(from.x))
  line.setAttribute('y1', String(from.y))
  line.setAttribute('x2', String(to.x))
  line.setAttribute('y2', String(to.y))
  line.setAttribute('stroke', '#1f8a4c')
  line.setAttribute('stroke-width', '0.1')
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('marker-end', 'url(#piece-path-arrow)')
  line.setAttribute('opacity', '0.9')
  svg.append(line)
}

function paintOverlay(whiteAtBottom) {
  const host = overlay()
  if (!host) return
  host.hidden = !session
  paintStars(whiteAtBottom)
  paintGuides(whiteAtBottom)
}

function starText(count) {
  return `${'★'.repeat(count)}${'☆'.repeat(Math.max(0, 3 - count))}`
}

function paintPanel() {
  const panel = document.querySelector('#piece-path')
  if (!panel || !session) return
  panel.hidden = false
  const goal = document.querySelector('#piece-path-goal')
  const moves = document.querySelector('#piece-path-moves')
  const score = document.querySelector('#piece-path-score')
  const next = document.querySelector('#piece-path-next')
  const promote = document.querySelector('#piece-path-promote')
  if (goal) {
    goal.textContent = t('path.goal', {
      piece: t(`piece.${session.level.piece}`),
      n: String(session.level.stars.length),
    })
  }
  if (moves) {
    moves.textContent = t('path.moves', {
      n: String(session.moves),
      best: session.optimal == null ? '—' : String(session.optimal),
    })
  }
  if (score) {
    score.textContent = session.done
      ? `${t('path.done')} ${starText(session.earned)}`
      : starText(0)
  }
  if (next) {
    const series = seriesOf(session.level.id)
    const index = series ? levelIndex(series, session.level.id) : -1
    const upcoming = series && index >= 0 ? series.levels[index + 1] : null
    next.hidden = !(session.done && upcoming)
    next.dataset.level = upcoming?.id || ''
  }
  if (promote) promote.hidden = !session.pending
}

function renderMenu() {
  const host = document.querySelector('#path-menu')
  if (!host) return
  const scores = readProgress().scores
  host.replaceChildren()
  for (const series of PIECE_SERIES) {
    const block = document.createElement('div')
    block.className = 'path-piece-block'
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'nav-item sub path-piece'
    toggle.textContent = t(`piece.${series.piece}`)
    const list = document.createElement('div')
    list.className = 'path-levels'
    list.hidden = !openPieces.has(series.piece)
    toggle.addEventListener('click', () => {
      if (openPieces.has(series.piece)) openPieces.delete(series.piece)
      else openPieces.add(series.piece)
      renderMenu()
    })
    series.levels.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'nav-item sub path-level'
      button.dataset.pathLevel = item.id
      const earned = Number(scores[item.id] || 0)
      const unlocked = piecePathUnlocked(item.id)
      button.disabled = !unlocked
      button.title = unlocked ? '' : t('path.locked')
      button.textContent = `${t('path.level', { n: String(index + 1) })} ${earned ? starText(earned) : ''}`.trim()
      button.classList.toggle('active', session?.level.id === item.id)
      button.addEventListener('click', () => startPiecePath(item.id))
      list.append(button)
    })
    block.append(toggle, list)
    host.append(block)
  }
}

function finish() {
  session.done = true
  session.selected = null
  session.pending = null
  session.earned = starScore(session.moves, session.optimal)
  const progress = readProgress()
  const previous = Number(progress.scores[session.level.id] || 0)
  progress.scores[session.level.id] = Math.max(previous, session.earned)
  writeProgress(progress)
  paintPanel()
  renderMenu()
  hooks?.status?.(t('path.doneStars', { n: String(session.earned) }))
  hooks?.win?.()
  hooks?.onDone?.()
  hooks?.outline?.(null)
}

function commit(move) {
  const nextFen = playMove(session.fen, session.color, move)
  if (!nextFen) {
    hooks?.status?.(t('path.illegal'))
    return
  }
  session.fen = nextFen
  session.moves += 1
  session.left = session.left.filter((square) => square !== move.to)
  session.selected = null
  session.pending = null
  session.hover = ''
  hooks?.show?.(session.fen, { from: move.from, to: move.to })
  hooks?.sound?.()
  if (!session.left.length) finish()
  else {
    paintPanel()
    hooks?.status?.('')
  }
}

export function piecePathActive() {
  return Boolean(session)
}

export function stopPiecePath() {
  session = null
  const promote = document.querySelector('#piece-path-promote')
  if (promote) promote.hidden = true
  const panel = document.querySelector('#piece-path')
  if (panel) panel.hidden = true
  paintOverlay(true)
  renderMenu()
  hooks?.onStop?.()
}

export function startPiecePath(levelId) {
  const series = seriesOf(levelId)
  const exercise = series?.levels.find((item) => item.id === levelId)
  if (!exercise || !piecePathUnlocked(levelId)) return false
  openPieces.add(series.piece)
  const route = search(exercise.fen, exercise.color, exercise.stars)
  session = {
    level: exercise,
    kind: series.kind,
    color: exercise.color,
    fen: exercise.fen,
    left: exercise.stars.slice(),
    moves: 0,
    optimal: route.moves,
    selected: null,
    hover: '',
    pending: null,
    done: false,
    earned: 0,
  }
  hooks?.onStart?.(exercise, series)
  hooks?.show?.(exercise.fen, null)
  paintPanel()
  renderMenu()
  hooks?.status?.(t('path.goal', {
    piece: t(`piece.${exercise.piece}`),
    n: String(exercise.stars.length),
  }))
  return true
}

export function handlePiecePathSquare(square) {
  if (!session) return false
  if (session.done || session.pending) return true
  const from = session.selected || hooks?.dragFrom?.() || ''
  if (!from) {
    if (square !== pieceSquare(session.fen)) return true
    session.selected = square
    paintGuides(boardWhiteAtBottom())
    hooks?.outline?.(square)
    return true
  }
  if (square === from) {
    session.selected = null
    paintGuides(boardWhiteAtBottom())
    hooks?.outline?.(null)
    return true
  }
  let choices = []
  try {
    const chess = chessOf(session.fen, session.color)
    choices = chess.moves({ verbose: true }).filter((move) => move.from === from && move.to === square)
  } catch {
    choices = []
  }
  if (!choices.length) {
    hooks?.status?.(t('path.illegal'))
    return true
  }
  if (choices.some((move) => move.promotion)) {
    session.pending = { from, to: square }
    const promote = document.querySelector('#piece-path-promote')
    if (promote) promote.hidden = false
    hooks?.status?.(t('path.promote'))
    return true
  }
  commit(choices[0])
  return true
}

export function piecePathCanDrag(square) {
  if (!session || session.done || session.pending) return false
  return square === pieceSquare(session.fen)
}

export function syncPiecePath(whiteAtBottom) {
  paintOverlay(whiteAtBottom)
  if (session?.selected) hooks?.outline?.(session.selected)
}

export function refreshPiecePathChrome() {
  renderMenu()
  paintPanel()
}

export function mountPiecePath(api) {
  hooks = api
  const board = document.querySelector('#board')
  board?.addEventListener('pointerover', (event) => {
    if (!session || session.done) return
    session.hover = event.target.closest?.('[data-square]')?.dataset.square || ''
    paintGuides(boardWhiteAtBottom())
  })
  board?.addEventListener('pointerleave', () => {
    if (!session) return
    session.hover = ''
    paintGuides(boardWhiteAtBottom())
  })
  document.querySelector('#piece-path-retry')?.addEventListener('click', () => {
    if (session) startPiecePath(session.level.id)
  })
  document.querySelector('#piece-path-next')?.addEventListener('click', () => {
    const id = document.querySelector('#piece-path-next')?.dataset.level
    if (id) startPiecePath(id)
  })
  const promote = document.querySelector('#piece-path-promote')
  promote?.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-promote]')
    if (!choice || !session?.pending) return
    commit({ ...session.pending, promotion: choice.dataset.promote })
  })
  renderMenu()
}
