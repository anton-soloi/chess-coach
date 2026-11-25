import { hintPhase, nextHintThreshold } from './hint-coach.js'

const first = 3
if (nextHintThreshold(true, first) !== 4) throw new Error('hint raises the next threshold to 4')
if (nextHintThreshold(false, first) !== 3) throw new Error('without a hint the floor stays at 3')
if (nextHintThreshold(false, 4) !== 3) throw new Error('a spared hint lowers 4 back to 3')
if (nextHintThreshold(true, 4) !== 4) throw new Error('using the hint sets the next threshold to 4, not 5')
if (nextHintThreshold(false, 5) !== 4) throw new Error('without a hint the previous threshold falls by one')
if (nextHintThreshold(true, 5) !== 4) throw new Error('a used hint sets the next diagram to 3 + 1')
if (hintPhase(3, false) !== 'count') throw new Error('a fresh diagram shows the counter')
if (hintPhase(1, false) !== 'count') throw new Error('tries above zero keep the counter')
if (hintPhase(0, false) !== 'hint') throw new Error('zero tries shows the hint button')
if (hintPhase(0, true) !== 'solved') throw new Error('a used hint hides the button and marks the diagram')

console.log('hint-coach ok 3 4')
