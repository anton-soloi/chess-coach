// Parsează liniile UCI ale Stockfish. Scorul este din perspectiva părții care mută.

export function parseInfoLine(line) {
  if (!line.startsWith('info ') || line.includes(' currmove ')) return null
  if (line.includes(' lowerbound') || line.includes(' upperbound')) return null

  const depth = /(?:^|\s)depth (\d+)/.exec(line)
  const score = /(?:^|\s)score (cp|mate) (-?\d+)/.exec(line)
  const pv = /(?:^|\s)pv ([a-h][1-8][a-h][1-8][qrbn]?(?:\s+[a-h][1-8][a-h][1-8][qrbn]?)*)/.exec(line)
  if (!depth || !score || !pv) return null

  const multipv = /(?:^|\s)multipv (\d+)/.exec(line)
  const time = /(?:^|\s)time (\d+)/.exec(line)
  return {
    depth: Number(depth[1]),
    multipv: multipv ? Number(multipv[1]) : 1,
    kind: score[1],
    value: Number(score[2]),
    timeMs: time ? Number(time[1]) : 0,
    pv: pv[1].trim().split(/\s+/),
  }
}

export function collectSearch(lines) {
  const byRank = new Map()
  let bestMove = null
  let timeMs = 0

  for (const line of lines) {
    if (line.startsWith('bestmove ')) {
      const match = /^bestmove (\S+)/.exec(line)
      bestMove = match && match[1] !== '(none)' ? match[1] : null
      continue
    }
    const info = parseInfoLine(line)
    if (!info) continue
    byRank.set(info.multipv, info)
    if (info.timeMs > timeMs) timeMs = info.timeMs
  }

  const variants = [...byRank.values()]
    .sort((a, b) => a.multipv - b.multipv)
    .map((info) => ({
      rank: info.multipv,
      depth: info.depth,
      move: info.pv[0],
      pv: info.pv,
      evaluationCp: info.kind === 'cp' ? info.value : null,
      mateIn: info.kind === 'mate' ? info.value : null,
    }))

  return {
    bestMove: bestMove || variants[0]?.move || null,
    depth: variants.reduce((max, line) => Math.max(max, line.depth), 0),
    timeMs,
    lines: variants,
  }
}

// După mutarea jucătorului, scorul UCI e din perspectiva adversarului.
export function scoreForMover(line) {
  if (!line) return { evaluationCp: null, mateIn: null }
  if (line.mateIn != null) return { evaluationCp: null, mateIn: -line.mateIn }
  if (line.evaluationCp != null) return { evaluationCp: -line.evaluationCp, mateIn: null }
  return { evaluationCp: null, mateIn: null }
}

export function lossInCentipawns(best, played) {
  if (!best || !played) return null
  if (best.evaluationCp == null || played.evaluationCp == null) return null
  return best.evaluationCp - played.evaluationCp
}
