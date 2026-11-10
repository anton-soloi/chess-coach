// Săgeți și pătrate colorate desenate peste tablă.
// Click dreapta trage o săgeată; click dreapta pe un singur câmp îl colorează.

const COLORS = {
  green: '#1f8a4c',
  red: '#c4473a',
  yellow: '#d4a017',
  blue: '#2f6fad',
  gray: '#b7b7b7',
}

const RINGS = {
  green: '#3dce74',
  red: '#ff5b4a',
  yellow: '#ffd23a',
  blue: '#4aa3ff',
}

export function noteColor(event) {
  if (event.ctrlKey || event.metaKey) return 'blue'
  if (event.altKey) return 'yellow'
  if (event.shiftKey) return 'red'
  return 'green'
}

export function paintBoardNotes(root, notes, whiteAtBottom, preview = null) {
  if (!root) return
  const svg = root.querySelector('svg')
  if (!svg) return
  const arrows = [...(notes?.arrows || [])]
  const highlights = [...(notes?.highlights || [])]
  if (preview?.start && preview?.end && preview.start !== preview.end) arrows.push({ ...preview, preview: true })
  else if (preview?.start) highlights.push({ square: preview.start, color: preview.color, preview: true })
  root.hidden = arrows.length + highlights.length === 0
  const marks = svg.querySelector('[data-notes="highlights"]')
  const lines = svg.querySelector('[data-notes="arrows"]')
  marks.replaceChildren()
  lines.replaceChildren()
  for (const mark of highlights) {
    const cell = squareCell(mark.square, whiteAtBottom)
    if (!cell || !COLORS[mark.color]) continue
    if (mark.type === 'square-fill') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(cell.col))
      rect.setAttribute('y', String(cell.row))
      rect.setAttribute('width', '1')
      rect.setAttribute('height', '1')
      rect.setAttribute('fill', COLORS[mark.color])
      rect.setAttribute('fill-opacity', mark.preview ? '0.28' : '0.45')
      marks.append(rect)
      continue
    }
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    ring.setAttribute('cx', String(cell.col + 0.5))
    ring.setAttribute('cy', String(cell.row + 0.5))
    ring.setAttribute('r', '0.38')
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', RINGS[mark.color])
    ring.setAttribute('stroke-width', '0.07')
    ring.setAttribute('stroke-opacity', mark.preview ? '0.55' : '1')
    marks.append(ring)
  }
  for (const arrow of arrows) {
    if (!COLORS[arrow.color]) continue
    const ends = arrowEnds(arrow.start, arrow.end, whiteAtBottom)
    if (!ends) continue
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(ends.x1))
    line.setAttribute('y1', String(ends.y1))
    line.setAttribute('x2', String(ends.x2))
    line.setAttribute('y2', String(ends.y2))
    line.setAttribute('stroke', COLORS[arrow.color])
    line.setAttribute('stroke-width', '0.12')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('marker-end', `url(#note-arrow-${arrow.color})`)
    if (arrow.color === 'gray') line.setAttribute('stroke-opacity', '0.45')
    if (arrow.preview) line.setAttribute('stroke-dasharray', '0.18 0.12')
    lines.append(line)
  }
}

export function paintHintArrow(root, arrow, whiteAtBottom) {
  const lines = root?.querySelector('[data-notes="arrows"]')
  if (!lines) return
  lines.querySelector('[data-hint-arrow]')?.remove()
  if (!arrow?.from || !arrow?.to) {
    const marks = root.querySelector('[data-notes="highlights"]')
    if (!lines.childElementCount && !marks?.childElementCount) root.hidden = true
    return
  }
  const ends = arrowEnds(arrow.from, arrow.to, whiteAtBottom)
  if (!ends) return
  root.hidden = false
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  line.dataset.hintArrow = '1'
  line.setAttribute('x1', String(ends.x1))
  line.setAttribute('y1', String(ends.y1))
  line.setAttribute('x2', String(ends.x2))
  line.setAttribute('y2', String(ends.y2))
  line.setAttribute('stroke', COLORS.gray)
  line.setAttribute('stroke-opacity', '0.45')
  line.setAttribute('stroke-width', '0.12')
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('marker-end', 'url(#note-arrow-gray)')
  lines.append(line)
}

export function bindBoardDraw(board, hooks) {
  board.addEventListener('contextmenu', (event) => {
    if (hooks.enabled()) event.preventDefault()
  })
  board.addEventListener('pointerdown', (event) => {
    if (!hooks.enabled() || event.button !== 2) return
    const square = event.target.closest?.('[data-square]')?.dataset.square
    if (!square) return
    event.preventDefault()
    const color = noteColor(event)
    const move = (ev) => {
      const end = squareAt(ev.clientX, ev.clientY) || square
      hooks.preview(square, end, color)
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      hooks.commit(square, squareAt(ev.clientX, ev.clientY) || square, color)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
}

function squareAt(x, y) {
  const stack = document.elementsFromPoint(x, y)
  for (const node of stack) {
    const square = node.closest?.('[data-square]')?.dataset.square
    if (square) return square
  }
  return ''
}

function squareCell(square, whiteAtBottom) {
  if (!/^[a-h][1-8]$/.test(square || '')) return null
  const file = 'abcdefgh'.indexOf(square[0])
  const rank = Number(square[1])
  return {
    col: whiteAtBottom ? file : 7 - file,
    row: whiteAtBottom ? 8 - rank : rank - 1,
  }
}

function arrowEnds(start, end, whiteAtBottom) {
  const from = squareCell(start, whiteAtBottom)
  const to = squareCell(end, whiteAtBottom)
  if (!from || !to) return null
  const x1 = from.col + 0.5
  const y1 = from.row + 0.5
  const x2 = to.col + 0.5
  const y2 = to.row + 0.5
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  return {
    x1: x1 + (dx / len) * 0.12,
    y1: y1 + (dy / len) * 0.12,
    x2: x2 - (dx / len) * 0.36,
    y2: y2 - (dy / len) * 0.36,
  }
}
