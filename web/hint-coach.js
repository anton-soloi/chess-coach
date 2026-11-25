// Indiciu adaptiv pe diagramă.
// Prima diagramă pornește cu 3 încercări. Fiecare mutare greșită scade contorul.
// La 0 dispare textul și apare butonul „Indiciu”. Indiciul desenează săgeata gri,
// marchează usedHintThisPuzzle și lasă contorul la 0.
// Diagrama următoare: indiciu folosit → 3 + 1; altfel max(3, pragul anterior − 1).
// Butonul se ascunde, săgeata se șterge, contorul revine cu noul prag.

const FIRST = 3

let hooks = {}
let threshold = FIRST
let puzzleId = ''
let remaining = FIRST
let usedHintThisPuzzle = false
let arrow = null
let busy = false

export function nextHintThreshold(usedHint, previous = FIRST) {
  if (usedHint) return FIRST + 1
  const current = Number.isFinite(previous) ? previous : FIRST
  return Math.max(FIRST, current - 1)
}

export function hintPhase(triesLeft, usedHintThisPuzzle) {
  if (usedHintThisPuzzle) return 'solved'
  if (triesLeft <= 0) return 'hint'
  return 'count'
}

export function mountHintCoach(nextHooks) {
  hooks = nextHooks || {}
  const button = document.querySelector('#attempt-hint-btn')
  button?.addEventListener('click', () => {
    void requestHint()
  })
  paint()
}

export function openHintDiagram(id) {
  if (!id || id === puzzleId) {
    paint()
    return
  }
  if (puzzleId) threshold = nextHintThreshold(usedHintThisPuzzle, threshold)
  puzzleId = id
  usedHintThisPuzzle = false
  remaining = threshold
  arrow = null
  busy = false
  paint()
  hooks.onArrow?.()
}

export function noteHintMiss() {
  if (!puzzleId || usedHintThisPuzzle || remaining <= 0 || busy) return
  remaining -= 1
  paint()
}

export function hintArrow() {
  return arrow
}

export function clearHintArrow() {
  arrow = null
}

export function refreshHintCoach() {
  paint()
}

async function requestHint() {
  if (!puzzleId || busy || usedHintThisPuzzle || remaining > 0) return
  const fen = hooks.fen?.()
  if (!fen) return
  busy = true
  paint()
  try {
    const uci = await hooks.bestMove?.(fen)
    const from = String(uci || '').slice(0, 2)
    const to = String(uci || '').slice(2, 4)
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
      hooks.status?.(hooks.text?.('attempt.hintMissing') || '')
      return
    }
    arrow = { from, to }
    usedHintThisPuzzle = true
    remaining = 0
    hooks.onArrow?.()
  } catch (err) {
    hooks.status?.(err instanceof Error ? err.message : String(err))
  } finally {
    busy = false
    paint()
  }
}

function paint() {
  const box = document.querySelector('#attempt-hint')
  const count = box?.querySelector('.attempt-count')
  const button = box?.querySelector('.attempt-hint-btn')
  if (!box || !count || !button) return
  if (box.dataset.guide === '1') return
  const active = Boolean(puzzleId) && hooks.active?.() !== false
  const phase = hintPhase(remaining, usedHintThisPuzzle)
  box.hidden = !active || phase === 'solved'
  count.hidden = phase !== 'count'
  button.hidden = phase !== 'hint'
  button.disabled = busy
  count.textContent = hooks.text?.('attempt.remaining', { left: remaining }) || ''
  button.textContent = hooks.text?.('attempt.hint') || 'Indiciu'
  box.dataset.threshold = String(threshold)
  box.dataset.remaining = String(remaining)
  box.dataset.used = usedHintThisPuzzle ? 'true' : 'false'
  box.dataset.phase = phase
  box.dataset.solved = usedHintThisPuzzle ? 'hint' : ''
  box.dataset.puzzle = puzzleId
}
