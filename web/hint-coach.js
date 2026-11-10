// Antrenament tactic: fiecare diagramă pornește cu 3 încercări, sau cu 4
// dacă diagrama anterioară a fost rezolvată cu indiciu.
// La 0 dispare contorul și apare butonul „Indiciu”. După indiciu, butonul
// dispare, săgeata gri rămâne, iar diagrama este marcată rezolvată cu indiciu.

const FIRST = 3
const AFTER_HINT = 4

let hooks = {}
let threshold = FIRST
let puzzleId = ''
let remaining = FIRST
let usedHint = false
let arrow = null
let busy = false

export function nextHintThreshold(usedHintThisPuzzle) {
  return usedHintThisPuzzle ? AFTER_HINT : FIRST
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
  if (puzzleId) threshold = nextHintThreshold(usedHint, threshold)
  puzzleId = id
  usedHint = false
  remaining = threshold
  arrow = null
  busy = false
  paint()
  hooks.onArrow?.()
}

export function noteHintMiss() {
  if (!puzzleId || usedHint || remaining <= 0 || busy) return
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
  if (!puzzleId || busy || usedHint || remaining > 0) return
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
    usedHint = true
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
  const active = Boolean(puzzleId) && hooks.active?.() !== false
  const phase = hintPhase(remaining, usedHint)
  box.hidden = !active || phase === 'solved'
  count.hidden = phase !== 'count'
  button.hidden = phase !== 'hint'
  button.disabled = busy
  count.textContent = hooks.text?.('attempt.remaining', { left: remaining }) || ''
  button.textContent = hooks.text?.('attempt.hint') || 'Indiciu'
  box.dataset.threshold = String(threshold)
  box.dataset.remaining = String(remaining)
  box.dataset.used = usedHint ? 'true' : 'false'
  box.dataset.phase = phase
  box.dataset.solved = usedHint ? 'hint' : ''
  box.dataset.puzzle = puzzleId
}
