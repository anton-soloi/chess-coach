/** Întrebări ghidate după o greșeală. Nu conțin mutarea-soluție. */

const FILES = 'abcdefgh'

function enemyKing(chess) {
  const enemy = chess.turn() === 'w' ? 'b' : 'w'
  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of FILES) {
      const square = file + rank
      const piece = chess.get(square)
      if (piece && piece.type === 'k' && piece.color === enemy) return square
    }
  }
  return null
}

function hangingPiece(chess) {
  const turn = chess.turn()
  const enemy = turn === 'w' ? 'b' : 'w'
  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of FILES) {
      const square = file + rank
      const piece = chess.get(square)
      if (!piece || piece.color !== enemy || piece.type === 'k' || piece.type === 'p') continue
      if (chess.isAttacked(square, turn) && !chess.isAttacked(square, enemy)) return true
    }
  }
  return false
}

function backRankIdea(chess) {
  const king = enemyKing(chess)
  if (!king) return false
  const enemy = chess.turn() === 'w' ? 'b' : 'w'
  const rank = enemy === 'b' ? '8' : '1'
  if (!king.endsWith(rank)) return false
  return chess.moves({ verbose: true }).some((move) =>
    move.to.endsWith(rank) && (move.piece === 'r' || move.piece === 'q'))
}

function hasCheck(chess) {
  return chess.moves({ verbose: true }).some((move) => {
    const played = chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
    const check = Boolean(played) && chess.inCheck()
    if (played) chess.undo()
    return check
  })
}

function knightFork(chess) {
  const enemy = chess.turn() === 'w' ? 'b' : 'w'
  for (const move of chess.moves({ verbose: true })) {
    if (move.piece !== 'n') continue
    const played = chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
    if (!played) continue
    let targets = 0
    for (let rank = 1; rank <= 8; rank += 1) {
      for (const file of FILES) {
        const square = file + rank
        const piece = chess.get(square)
        if (!piece || piece.color !== enemy || piece.type === 'k' || piece.type === 'p') continue
        if (chess.isAttacked(square, played.color)) targets += 1
      }
    }
    chess.undo()
    if (targets >= 2) return true
  }
  return false
}

export function coachQuestion(chess) {
  if (hangingPiece(chess)) return 'Observi vreo piesă neapărată în tabăra adversă?'
  if (backRankIdea(chess)) return 'Ce s-ar întâmpla dacă regele ar părăsi ultima linie?'
  if (hasCheck(chess)) return 'Există o mutare care dă șah? Uită-te la piesele care văd regele.'
  if (knightFork(chess)) return 'Un cal poate lovi două piese deodată. Unde poate sări?'
  return 'Uită-te întâi la șah, apoi la captură, apoi la amenințare.'
}
