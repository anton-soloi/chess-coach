import { matchesTarget, practiceOf } from './practice-engine.js'
import { lessonFromSections, sectionsFromLesson } from './lesson-pack.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const step = {
  stepType: 'practice',
  title: 'Găsește mutarea Calului!',
  promptText: 'Unde trebuie să sară Calul din f3 pentru a ataca punctul f7?',
  targetMove: { from: 'f3', to: 'g5' },
  hint: {
    avatarState: 'pointing',
    highlightSquare: 'f7',
    text: 'Fii atent la pionul neapărat din f7!',
  },
  feedback: {
    correct: {
      avatarState: 'idle',
      audioUrl: '/assets/audio/correct.mp3',
      text: 'Bravo! Ai găsit mutarea corectă!',
    },
    wrong: {
      avatarState: 'thinking',
      audioUrl: '/assets/audio/try_again.mp3',
      text: 'Nu aceasta este mutarea. Mai încearcă!',
    },
  },
}

assert(practiceOf({ stepType: 'explanation', targetMove: { from: 'f3', to: 'g5' } }) === null, 'explicația nu deschide exercițiul')
assert(practiceOf({ title: 'doar text' }) === null, 'fără stepType practice nu există exercițiu')

const practice = practiceOf(step)
assert(practice.targetMove.from === 'f3' && practice.targetMove.to === 'g5', 'mutarea țintă este f3-g5')
assert(practice.hint.highlightSquare === 'f7' && practice.hint.avatarState === 'pointing', 'indiciul arată f7')
assert(practice.feedback.correct.avatarState === 'idle', 'răspunsul corect lasă avatarul idle')
assert(practice.feedback.wrong.avatarState === 'thinking', 'răspunsul greșit lasă avatarul pe thinking')
assert(practice.feedback.correct.audioUrl === '/assets/audio/correct.mp3', 'feedback-ul corect păstrează audioUrl')
assert(matchesTarget({ from: 'f3', to: 'g5' }, practice), 'f3-g5 este mutarea cerută')
assert(!matchesTarget({ from: 'f3', to: 'e5' }, practice), 'o altă mutare nu trece')
assert(practiceOf({ stepType: 'practice', hint: 'text vechi', targetMove: { from: 'a2', to: 'a3' } }).hint === null, 'indiciul text nu este confundat cu indiciul grafic')

const sections = sectionsFromLesson({ lessonId: 'lectie', steps: [{ stepNumber: 2, ...step, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }] })
const restored = lessonFromSections({ lessonId: 'lectie', sections }).steps[1]
assert(restored.stepType === 'practice' && restored.targetMove.to === 'g5', 'schema de exercițiu se păstrează la salvare')
assert(restored.hint.highlightSquare === 'f7', 'indiciul grafic se păstrează')
assert(restored.feedback.wrong.text === 'Nu aceasta este mutarea. Mai încearcă!', 'feedback-ul greșit se păstrează')

console.log('practice-engine ok', practice.targetMove.from + practice.targetMove.to)
