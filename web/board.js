// Tablă interactivă cu timp de gândire separat pentru Alb și pentru Negru.
// Timpul „motor” vine din câmpul UCI `time` al analizei.

import { Chess } from './vendor/chess.js'
import { t } from './i18n.js'


export function sizeDragGhost(ghost, square) {
  const box = square?.getBoundingClientRect?.()
  if (!box?.width || !box?.height) return
  ghost.style.setProperty('--drag-square-w', `${box.width}px`)
  ghost.style.setProperty('--drag-square-h', `${box.height}px`)
}

export function formatEngineTime(ms) {
  const safe = Math.max(0, Math.round(Number(ms) || 0))
  if (safe < 10000) return `${(safe / 1000).toFixed(2)}s`
  const minutes = Math.floor(safe / 60000)
  const seconds = Math.floor((safe % 60000) / 1000)
  const tenths = Math.floor((safe % 1000) / 100)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function formatClock(ms, ceil) {
  const safe = Math.max(0, Number(ms) || 0)
  const total = safe === 0 ? 0 : ceil ? Math.ceil(safe / 1000) : Math.floor(safe / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

function placementOf(fen) {
  const parts = fen.trim().split(/\s+/)
  const ranks = (parts[0] || '').split('/')
  if (ranks.length !== 8) return null
  const map = new Map()
  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    let file = 0
    for (const symbol of ranks[rankIndex]) {
      if (symbol >= '1' && symbol <= '8') {
        file += Number(symbol)
        continue
      }
      const type = symbol.toLowerCase()
      if (!'pnbrqk'.includes(type) || file > 7) return null
      map.set('abcdefgh'[file] + (8 - rankIndex), {
        type,
        color: symbol === symbol.toUpperCase() ? 'w' : 'b',
      })
      file += 1
    }
    if (file !== 8) return null
  }
  return { map, turn: parts[1] === 'b' ? 'b' : 'w' }
}

function coord(text) {
  const label = document.createElement('span')
  label.className = 'coord'
  label.textContent = text
  return label
}

export class InteractiveBoard {
  constructor(root) {
    this.root = root
    this.boardEl = root.querySelector('.board')
    this.whiteAtBottom = true
    this.showTargets = true
    this.blindfold = false
    this.lastMove = null
    this.selected = null
    this.fen = ''
    this.countdown = false
    this.remaining = { w: 0, b: 0 }
    this.spent = { w: 0, b: 0 }
    this.lastEngineMs = { w: 0, b: 0 }
    this.running = null
    this.timer = 0
    this.tickAt = 0
    this.onFlag = null
    this.onSquare = null
    this.onDrop = null
    this.canDrag = null
    this.draggable = true
    this.suppressClick = false
    this.ghost = null
    this.whiteEl = this.#clock('w')
    this.blackEl = this.#clock('b')
    this.#placeClocks()
    this.#paint()
  }

  flip() {
    this.whiteAtBottom = !this.whiteAtBottom
    this.#placeClocks()
  }

  setBlindfold(on) {
    this.blindfold = Boolean(on)
    this.ghost = null
    this.boardEl.classList.toggle('is-blind', this.blindfold)
    if (!on) {
      this.boardEl.querySelectorAll('.blind-ghost').forEach((node) => node.remove())
      this.boardEl.querySelectorAll('.blind-flash').forEach((node) => node.classList.remove('blind-flash'))
    }
  }

  showBlindGhost(move) {
    if (!this.blindfold || !move?.to) {
      this.ghost = null
      return
    }
    const flags = String(move.flags || '')
    const squares = [move.from, move.to]
    const pieces = [{
      square: move.to,
      type: move.promotion || move.piece,
      color: move.color,
    }]
    if (flags.includes('k') || flags.includes('q')) {
      const rank = move.color === 'w' ? '1' : '8'
      const kingside = flags.includes('k')
      squares.push((kingside ? 'h' : 'a') + rank, (kingside ? 'f' : 'd') + rank)
      pieces.push({ square: (kingside ? 'f' : 'd') + rank, type: 'r', color: move.color })
    }
    this.ghost = { squares, pieces }
  }

  clearBlindGhost() {
    this.ghost = null
  }

  resetClocks({ whiteMs = 0, blackMs = 0, countdown = false, incrementMs = 0 } = {}) {
    this.stop()
    this.countdown = countdown
    this.incrementMs = Math.max(0, Number(incrementMs) || 0)
    this.remaining = { w: whiteMs, b: blackMs }
    this.spent = { w: 0, b: 0 }
    this.lastEngineMs = { w: 0, b: 0 }
    this.#paint()
  }

  addIncrement(side) {
    if (!this.countdown || !this.incrementMs || (side !== 'w' && side !== 'b')) return
    if (this.running === side) this.#tick()
    if (this.remaining[side] <= 0) return
    this.remaining[side] += this.incrementMs
    this.#paint()
  }

  setTurn(side) {
    this.stop()
    if (side !== 'w' && side !== 'b') return
    if (this.countdown && this.remaining[side] <= 0) {
      this.onFlag?.(side)
      return
    }
    this.running = side
    this.tickAt = performance.now()
    this.timer = setInterval(() => this.#tick(), 100)
    this.#paint()
  }

  stop() {
    if (!this.running) return
    this.#tick()
    if (!this.running) return
    clearInterval(this.timer)
    this.timer = 0
    this.running = null
    this.#paint()
  }

  addEngineTime(side, ms, { intoClock = false } = {}) {
    if (side !== 'w' && side !== 'b') return
    const amount = Math.max(0, Number(ms) || 0)
    this.lastEngineMs[side] = amount
    if (intoClock && !this.countdown) this.spent[side] += amount
    this.#paint()
  }

  markSelected(square) {
    this.selected = square
    const targets = new Set()
    if (square && this.showTargets && !this.blindfold) {
      try {
        const chess = new Chess(this.fen)
        for (const move of chess.moves({ square, verbose: true })) targets.add(move.to)
      } catch {
        targets.clear()
      }
    }
    for (const cell of this.boardEl.querySelectorAll('.square')) {
      cell.classList.toggle('selected', cell.dataset.square === square)
      cell.classList.toggle('target', targets.has(cell.dataset.square))
    }
  }

  clearSelection() {
    this.markSelected(null)
  }

  draw(fen) {
    this.fen = fen.trim()
    this.selected = null
    this.boardEl.replaceChildren()
    this.boardEl.classList.toggle('is-blind', this.blindfold)
    const placed = placementOf(this.fen)
    if (!placed) return null

    const files = this.whiteAtBottom ? 'abcdefgh' : 'hgfedcba'
    const ranks = this.whiteAtBottom ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
    this.#fileRow(files)
    for (const rank of ranks) {
      this.boardEl.append(coord(String(rank)))
      for (const file of files) {
        const name = file + rank
        const cell = document.createElement('button')
        cell.type = 'button'
        cell.dataset.square = name
        const fileIndex = 'abcdefgh'.indexOf(file)
        const light = (fileIndex + rank) % 2 === 0
        cell.className = 'square ' + (light ? 'light' : 'dark')
        if (this.lastMove && !this.blindfold && (name === this.lastMove.from || name === this.lastMove.to)) {
          cell.classList.add('moved')
        }
        cell.setAttribute('aria-label', name)
        cell.addEventListener('pointerdown', (event) => this.#pointerDown(event, name))
        const square = placed.map.get(name)
        const ghostHere = this.blindfold && this.ghost?.pieces?.find((item) => item.square === name)
        if (this.blindfold && this.ghost?.squares?.includes(name)) {
          cell.classList.add('blind-flash')
          cell.addEventListener('animationend', (event) => {
            if (event.animationName === 'blind-square-fade') cell.classList.remove('blind-flash')
          })
        }
        if (ghostHere) {
          const piece = document.createElement('img')
          piece.className = 'piece blind-ghost'
          piece.alt = `${t(`piece.${ghostHere.type}`)} ${t(ghostHere.color === 'w' ? 'piece.white' : 'piece.black')}`
          piece.src = `pieces/cburnett/${ghostHere.color}${ghostHere.type.toUpperCase()}.svg`
          piece.addEventListener('animationend', (event) => {
            if (event.animationName === 'blind-piece-fade') piece.remove()
          })
          cell.append(piece)
        } else if (square && !this.blindfold) {
          const piece = document.createElement('img')
          piece.className = 'piece'
          piece.alt = `${t(`piece.${square.type}`)} ${t(square.color === 'w' ? 'piece.white' : 'piece.black')}`
          piece.src = `pieces/cburnett/${square.color}${square.type.toUpperCase()}.svg`
          cell.append(piece)
        }
        cell.addEventListener('click', () => {
          if (this.suppressClick) {
            this.suppressClick = false
            return
          }
          this.onSquare?.(name)
        })
        this.boardEl.append(cell)
      }
      this.boardEl.append(coord(String(rank)))
    }
    this.#fileRow(files)
    return placed
  }

  #pointerDown(event, square) {
    if (!this.draggable || this.blindfold || (event.button != null && event.button !== 0)) return
    if (this.canDrag && !this.canDrag(square)) return
    const piece = event.currentTarget.querySelector('.piece')
    if (!piece) return
    const startX = event.clientX
    const startY = event.clientY
    let ghost = null
    let moved = false
    const follow = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
      moved = true
      if (!ghost) {
        ghost = piece.cloneNode(true)
        ghost.className = 'piece drag-ghost'
        sizeDragGhost(ghost, piece.closest('.square'))
        document.body.append(ghost)
      }
      ghost.style.left = `${ev.clientX}px`
      ghost.style.top = `${ev.clientY}px`
    }
    const finish = (ev) => {
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', finish)
      ghost?.remove()
      if (!moved) return
      this.suppressClick = true
      setTimeout(() => {
        this.suppressClick = false
      }, 0)
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)
      const to = hit?.closest?.('[data-square]')?.dataset.square
      if (hit?.closest?.('[data-trash]')) this.onDrop?.({ from: square, to: null, remove: true })
      else if (to && to !== square) this.onDrop?.({ from: square, to })
    }
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', finish)
  }

  #clock(side) {
    const el = document.createElement('div')
    el.className = 'think-clock'
    el.dataset.side = side
    el.setAttribute('role', 'timer')
    const sideEl = document.createElement('span')
    sideEl.className = 'think-side'
    sideEl.textContent = t(side === 'w' ? 'side.white' : 'side.black')
    const timeEl = document.createElement('strong')
    timeEl.className = 'think-time'
    const engineEl = document.createElement('span')
    engineEl.className = 'think-engine'
    el.append(sideEl, timeEl, engineEl)
    return el
  }

  #placeClocks() {
    const top = this.whiteAtBottom ? this.blackEl : this.whiteEl
    const bottom = this.whiteAtBottom ? this.whiteEl : this.blackEl
    this.root.prepend(top)
    this.root.append(bottom)
  }

  #fileRow(files) {
    this.boardEl.append(coord(''))
    for (const file of files) this.boardEl.append(coord(file))
    this.boardEl.append(coord(''))
  }

  #tick() {
    if (!this.running) return
    const now = performance.now()
    const delta = now - this.tickAt
    this.tickAt = now
    const side = this.running
    if (this.countdown) {
      this.remaining[side] = Math.max(0, this.remaining[side] - delta)
      if (this.remaining[side] <= 0) {
        clearInterval(this.timer)
        this.timer = 0
        this.running = null
        this.#paint()
        this.onFlag?.(side)
        return
      }
    } else {
      this.spent[side] += delta
    }
    this.#paint()
  }

  #paint() {
    for (const side of ['w', 'b']) {
      const el = side === 'w' ? this.whiteEl : this.blackEl
      const main = this.countdown ? this.remaining[side] : this.spent[side]
      const shown = formatClock(main, this.countdown)
      const engine = formatEngineTime(this.lastEngineMs[side])
      el.querySelector('.think-time').textContent = shown
      el.querySelector('.think-side').textContent = t(side === 'w' ? 'side.white' : 'side.black')
      el.querySelector('.think-engine').textContent = t('clock.engine', { time: engine })
      el.classList.toggle('running', this.running === side)
      el.classList.toggle('low', this.countdown && this.remaining[side] > 0 && this.remaining[side] < 30000)
      const name = t(side === 'w' ? 'side.white' : 'side.black')
      el.setAttribute('aria-label', t('clock.aria', { side: name, time: shown, engine }))
    }
  }
}
