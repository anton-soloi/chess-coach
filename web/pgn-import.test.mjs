import { Chess } from './vendor/chess.js'
import { playTypedMove } from './notation.js'
import { pgnGameTitle, readPgnFile, readPgnGame, splitPgnGames, cleanPgnText, mainlineMoves } from './pgn-import.js'

const complex = `[Event "Scoala de vara"]
[Site "Bucuresti"]
[Date "2024.06.01"]
[White "Popescu"]
[Black "Ionescu"]
[Result "1-0"]

{Deschiderea spaniola. Vezi si (1... c5) daca vrei un alt plan.}
1. e4! e5 $1 2. Nf3 Nc6 (2... Nf6 3. Nc3 {varianta} (3. d4)) 3. Bb5 a6
4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 (7... O-O 8. c3 d5) 8. c3 O-O
9. h3 Nb8 10. d4 Nbd7 1-0

[Event "Mate scurt"]
[White "Ana"]
[Black "Dan"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# {matul ciobanului} 1-0

[Event "Rocada mare"]
[White "Maria"]
[Black "Ion"]
[Result "1/2-1/2"]

1. d4 d5 2. Nc3 Nf6 3. Bf4 c6 4. e3 e6 5. Nf3 Bd6 6. Qd2 O-O
; comentariu de linie
7. 0-0-0 1/2-1/2

[Event "Stricata"]
[White "Greseala"]
[Black "Text"]
[Result "*"]

1. e5 e4 2. Nf3 *

[Event "Dupa eroare"]
[White "Elena"]
[Black "Radu"]
[Result "0-1"]

1. e4 (1. d4 d5 2. c4) c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 0-1
`

function replay(game) {
  const chess = new Chess(game.startFen)
  const frames = [chess.fen()]
  for (const move of game.san) {
    playTypedMove(chess, move)
    frames.push(chess.fen())
  }
  return frames
}

const parts = splitPgnGames(complex)
if (parts.length !== 5) throw new Error(`expected 5 game blocks, got ${parts.length}`)

const file = readPgnFile(Chess, complex)
if (!file.ok) throw new Error('the file should keep the readable games')
if (file.games.length !== 4 || file.skipped !== 1) throw new Error(`expected 4 games and 1 skip, got ${file.games.length} / ${file.skipped}`)

const [spanish, mate, castle, sicilian] = file.games
if (spanish.san.join(' ').startsWith('e4 e5 Nf3 Nf6')) throw new Error('the side variation replaced the main line')
if (!spanish.san.includes('O-O') || spanish.san.includes('c5')) throw new Error('comments and the side line should stay out of the main line')
if (spanish.headers.White !== 'Popescu' || spanish.headers.Black !== 'Ionescu' || spanish.headers.Result !== '1-0') {
  throw new Error('white, black and result should come from the headers')
}
const spanishTitle = pgnGameTitle(spanish.headers, 0)
if (`${spanishTitle.n}. ${spanishTitle.white} – ${spanishTitle.black} · ${spanishTitle.result}` !== '1. Popescu – Ionescu · 1-0') {
  throw new Error('the side button label should name the players and the result')
}

if (mate.san.at(-1) !== 'Qxf7#') throw new Error('checkmate notation should survive')
if (!castle.san.includes('O-O') || !castle.san.includes('O-O-O')) throw new Error('both castling moves should be on the main line')
if (sicilian.san[0] !== 'e4' || sicilian.san[1] !== 'c5') throw new Error('the alternative first move should not replace the main line')
if (file.games.some((game) => game.headers.White === 'Greseala')) throw new Error('the illegal game should not become a button')

for (const game of file.games) {
  const frames = replay(game)
  if (frames.length !== game.ply + 1) throw new Error(`${game.headers.White} did not replay from the start`)
  if (frames[0] !== game.startFen) throw new Error(`${game.headers.White} did not reset to the initial position`)
}

const brokenVariation = readPgnGame(Chess, '1. e4 e5 (1... e4) 2. Nf3 Nc6 *')
if (!brokenVariation.ok || brokenVariation.san.join(' ') !== 'e4 e5 Nf3 Nc6') {
  throw new Error('a broken side variation should leave the main line playable')
}

const hiddenHeader = readPgnFile(Chess, `[Event "Una"]
[White "Una"]
[Black "Doi"]
[Result "*"]

1. e4 {
[Event "fals"]
[White "Nu"]
} e5 2. Nf3 Nc6 *`)
if (!hiddenHeader.ok || hiddenHeader.games.length !== 1 || hiddenHeader.games[0].san.join(' ') !== 'e4 e5 Nf3 Nc6') {
  throw new Error('a tag inside a comment should not start another game')
}

const fenGame = readPgnGame(Chess, `[SetUp "1"]
[FEN "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"]

1. Qg7#`)
if (!fenGame.ok || fenGame.san[0] !== 'Qg7#' || !fenGame.startFen.startsWith('7k/5Q2/6K1')) {
  throw new Error('a FEN header should be the start of the game')
}

const glued = cleanPgnText('15. c4{comentariu\npe doua randuri}16.d5')
if (glued.includes('c416')) throw new Error('a multiline comment must not glue the moves together')
const gluedMoves = mainlineMoves(glued)
if (gluedMoves.join(' ') !== 'c4 d5') throw new Error(`cleaned moves should be c4 d5, got ${gluedMoves.join(' ')}`)

const annotated = mainlineMoves(cleanPgnText('1. e4! e5$1 2. Nf3?! Nc6 (2... Nf6) *'))
if (annotated.join(' ') !== 'e4 e5 Nf3 Nc6') throw new Error('marks, NAGs and the side line should leave only the main moves')

const beside = readPgnFile(Chess, `[White "Buna"]
[Black "Alba"]
[Result "*"]

1. e4 e5 2. e5 *

[White "Ana"]
[Black "Dan"]
[Result "*"]

1. d4 d5 *`)
if (!beside.ok || beside.games.length !== 1 || beside.skipped !== 1) throw new Error('an illegal main line should drop only that game')
if (beside.games[0].headers.White !== 'Ana' || beside.games[0].san.join(' ') !== 'd4 d5') {
  throw new Error('the valid game after an illegal one should stay selectable')
}

const inline = readPgnGame(Chess, '1. e4{comentariu\npe doua randuri}e5 2. Nf3{cal}Nc6 *')
if (!inline.ok || inline.san.join(' ') !== 'e4 e5 Nf3 Nc6') throw new Error('comments placed between moves should keep the main line')

const broken = readPgnFile(Chess, '1. e5')
if (broken.ok || broken.error !== 'invalid') throw new Error('an illegal first move should fail gently')

const empty = readPgnFile(Chess, '   ')
if (empty.ok || empty.error !== 'empty') throw new Error('blank text is empty')

console.log('pgn-import ok', file.games.map((game) => game.ply).join(' '))
