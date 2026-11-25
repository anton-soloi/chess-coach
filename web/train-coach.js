// Judecata unui exercițiu Train: mat forțat sau avantaj, fără o linie fixă.

import { scoreForMover } from './engine/uci.js'

export const COACH_SEARCH = { depth: 14, movetime: 500, multiPv: 1 }
export const ADVANTAGE_CP = 300

export function goalFromLine(line) {
  return line?.mateIn > 0 ? 'mate' : 'advantage'
}

export function studentView(line) {
  const score = scoreForMover(line)
  return { cp: score.evaluationCp, mate: score.mateIn }
}

export function describeLine(fen, line) {
  const san = line?.san || ''
  const parts = String(fen || '').trim().split(/\s+/)
  const full = Number(parts[5]) || 1
  const move = san ? (parts[1] === 'b' ? `${full}... ${san}` : `${full}. ${san}`) : ''
  return {
    goal: goalFromLine(line),
    san,
    move,
    mateIn: line?.mateIn ?? null,
    cp: line?.evaluationCp ?? null,
  }
}

export function playedUci(played) {
  if (!played?.from || !played?.to) return ''
  return `${played.from}${played.to}${played.promotion || ''}`.toLowerCase()
}

export function judgeTrainMove({ goal, student, bestMove, playedUci: uci, bestCp, checkmate, gameOver }) {
  if (checkmate) return { ok: true, done: true }
  if (gameOver) return { ok: false, done: false }
  const mate = student?.mate != null && student.mate > 0
  const cp = student?.cp
  const matches = Boolean(bestMove && uci && String(bestMove).toLowerCase() === uci)
  if (goal === 'mate') return { ok: mate || matches, done: false }
  const winning = mate || (cp != null && cp >= ADVANTAGE_CP)
  const near = bestCp != null && cp != null && bestCp - cp <= 50
  return { ok: winning || matches || near, done: winning }
}
