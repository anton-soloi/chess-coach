import { cueAt, recordLegalMove } from './lesson-builder.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const first = recordLegalMove(start, [], 'e2', 'e4')
assert(first.ok && first.san === 'e4', 'e2-e4 intră în linie')
assert(first.pgn.includes('e4'), 'PGN-ul conține mutarea')
const second = recordLegalMove(start, first.sans, 'e7', 'e5')
assert(second.ok && second.sans.join(' ') === 'e4 e5', 'linia continuă cu mutarea adversă')
const illegal = recordLegalMove(start, [], 'e2', 'e5')
assert(!illegal.ok, 'mutarea ilegală nu intră în PGN')

const marked = cueAt(2.46, { avatarState: 'pointing', action: 'highlight', target: 'f7' })
assert(marked.time === 2.5 && marked.action === 'highlight' && marked.target === 'f7', 'reperul rotunjește secunda și păstrează evidențierea')
const arrow = cueAt(0, { avatarState: 'talking', action: 'draw_arrow', from: 'f3', to: 'g5' })
assert(arrow.avatarState === 'talking' && arrow.from === 'f3' && arrow.to === 'g5', 'săgeata păstrează starea de vorbire')
const move = cueAt(4.8, { avatarState: 'thinking', action: 'move_piece', from: 'f3', to: 'g5' })
assert(move.action === 'move_piece' && move.time === 4.8, 'mutarea de pe tablă primește timestamp')

console.log('lesson-builder ok', second.sans.join(' '))
