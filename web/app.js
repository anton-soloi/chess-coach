import { Chess, validateFen } from './vendor/chess.js'
import { formatSolution, illegalSequenceMove, playTypedMove, sameMove, solutionMoves } from './notation.js'
import { StockfishClient } from './engine/stockfish-client.js'
import { coachQuestion } from './tutor.js'
import { InteractiveBoard, formatEngineTime } from './board.js'
import { addMenuTheme, currentCurriculumLevel, deleteMenuTheme, getLevels, installLessonPack, lessonTitle, loadCurriculum, levelForModule, menuSections, menuThemeOptions, menuThemeRecord, moduleOfSection, moduleOfTheme, paintLevelBadge, procedureHome, procedureLesson, refreshCurriculum, saveProcedureCourse, setCurriculumLevel, setCurriculumStudent, themeForLesson, updateMenuTheme } from './curriculum.js'
import { deletePracticeExercise, listPracticeExercises, resolveInteractiveLesson, saveLessonOverride, savePracticeExercise } from './interactive-lesson.js'
import { closeLevels, isLevelsMode, loadLevels, markLessonDone, markLessonStarted, openLevels, refreshLevels } from './levels.js'
import { closePedagogy, focusSavedExercise, hasSessionNext, isPedagogyOpen, isProcedureExamples, noteSessionResult, openPedagogy, pedagogyEvalVisible, pedagogyStep, pedagogyStepName, pedagogySubId, refreshPedagogy, resumePedagogy, takeSessionNext } from './pedagogy.js'
import { bindTeacherEditor, captureLessonDocument, clearSavedAnnotations, closeTeacherEditor, editorMove, editorRemove, editorSelection, editorSquare, flushEditor, focusEditorLevel, focusEditorTheme, focusLessonDiagram, isTeacherEditor, openTeacherEditor, refreshEditorChrome, resumeTeacherEditor, showLoadedLesson, showSavedAnnotations, stampNarrative, syncBoardAnnotations } from './editor.js'
import { sectionsFromLesson } from './lesson-pack.js'
import { closeMasters, isMastersMode, loadMasters, openMasters, refreshMasters } from './masters.js'
import { initI18n, lang, onLang, t, tList, tx } from './i18n.js'
import { isSoundOn, playEffect, playExerciseEnd, playMoveEffect, setSoundOn } from './audio.js'
import { bindGenderSelector } from './avatar-profile.js'
import { mountAvatarDisplay, setAvatarCaption, setAvatarLevel, setAvatarMouth, setAvatarState } from './avatar-display.js'
import { playNarrative, stopNarrative } from './audio-sync.js'
import { matchesTarget, practiceOf } from './practice-engine.js'
import { builderSnapshot, builderTouched } from './lesson-builder.js'
import { handlePiecePathSquare, mountPiecePath, piecePathActive, piecePathCanDrag, refreshPiecePathChrome, startPiecePath, stopPiecePath, syncPiecePath } from './piece-path.js'

const EXERCISE_FEN = '6b1/3k2p1/1p1b1p1p/1K3P1P/2B3P1/2P3B1/8/8 w - - 0 37'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const LESSONS = {
  menu: 'Introdu mutarea, explică alegerea și selectează motivul tactic. Ai trei încercări.',
  train: 'Alege un mod din meniul Train. Ceasul de gândire al albului și cel al negrului merg separat, iar motorul de analiză răspunde la mutare.',
  analysis: 'Motorul primește FEN-ul, evaluează mutarea și arată variantele în centipawns.',
  learn: 'Sacrificiul de la Exercițiul 2: o piesă se oferă ca să urmeze un șah forțat. Motivul se alege din listă, nu se ghicește dintr-o cerință vagă.',
  tabla: 'Tabla: orientarea, coloanele, liniile, diagonalele, notația și culoarea unui câmp.',
  pion: 'Pion: mutările pieselor, șahul, matul și verificarea că mutarea este legală.',
  cal: 'Cal: furculița, descoperirea, ultima linie și sacrificiul tactic.',
  nebun: 'Nebun: tipare de mat, procedee tactice și idei de combinație.',
  turn: 'Turn: gândirea și decizia, procedeele noi, tiparele de mat care nu sunt la Cal sau la Nebun, combinațiile, atacul la rege, finalurile de pioni și finalurile simple de turn.',
  dama: 'Damă: planul pe termen lung. Evaluezi poziția, vezi ce vrea adversarul și transformi avantajul.',
  rege: 'Rege: măiestria. Legi etapele partidei, joci sigur, îți ții timpul și îți vezi greșeala înainte de motor.',
}

const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1'
const STALEMATE_FEN = '7k/5Q2/5K2/8/8/8/8/8 b - - 0 1'

const TABLA = {
  orientare: {
    code: 'T.01',
    label: 'Tabla, câmpurile și orientarea',
    fen: EMPTY_FEN,
    prompt: 'Albul stă jos. Apasă colțul lui din stânga: câmpul a1.',
    accept: (square) => square === 'a1',
    ok: 'a1 este colțul din stânga al albului.',
    bad: 'Mai caută colțul din stânga jos.',
  },
  fisiere: {
    code: 'T.02',
    label: 'Coloane, linii și diagonale',
    fen: EMPTY_FEN,
    prompt: 'Coloana d este o coloană. Apasă un câmp de pe coloana d.',
    accept: (square) => square[0] === 'd',
    ok: 'Ești pe coloana d.',
    bad: 'Acest câmp nu este pe coloana d.',
  },
  linii: {
    code: 'T.03',
    label: 'Linii, coloane și diagonale',
    fen: EMPTY_FEN,
    prompt: 'Linia 4 este linia cu cifra 4. Apasă un câmp de pe linia 4.',
    accept: (square) => square[1] === '4',
    ok: 'Ești pe linia 4.',
    bad: 'Acest câmp nu este pe linia 4.',
  },
  notatie: {
    code: 'T.04',
    label: 'Notația și identificarea câmpurilor',
    fen: EMPTY_FEN,
    prompt: 'Identifică câmpul e4. Apasă-l pe tablă.',
    accept: (square) => square === 'e4',
    ok: 'e4 este coloana e, linia 4.',
    bad: 'Acesta nu este e4.',
  },
  culoare: {
    code: 'T.05',
    label: 'Identificarea culorii unui câmp',
    fen: EMPTY_FEN,
    prompt: 'Ce culoare are câmpul d5?',
    mark: 'd5',
    choices: [
      { id: 'light', label: 'Deschis' },
      { id: 'dark', label: 'Închis' },
    ],
    answer: 'light',
    ok: 'd5 este un câmp deschis.',
    bad: 'd5 este deschis, nu închis.',
  },
  initial: {
    code: 'T.06',
    label: 'Poziția inițială',
    fen: START_FEN,
    prompt: 'Aceasta este poziția inițială. Apasă regele alb.',
    accept: (square) => square === 'e1',
    ok: 'Regele alb stă pe e1.',
    bad: 'Regele alb este pe e1.',
  },
  pat: {
    code: 'T.07',
    label: 'Patul și elementele fundamentale ale regulilor',
    fen: STALEMATE_FEN,
    prompt: 'Negrul este la mutare, nu are nicio mutare legală și nu este în șah. Ce este poziția?',
    choices: [
      { id: 'pat', label: 'Pat' },
      { id: 'mat', label: 'Mat' },
    ],
    answer: 'pat',
    ok: 'Este pat: nu există mutare legală și regele nu este în șah.',
    bad: 'Nu este mat, pentru că regele nu este în șah. Este pat.',
  },
}

const PION = {
  reguli: {
    code: 'P.01',
    label: 'Mutările pieselor și regulile de bază',
    fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
    mark: 'e2',
    prompt: 'Pionul alb de pe e2 poate înainta două câmpuri la prima mutare. Apasă câmpul unde ajunge.',
    accept: (square) => square === 'e4',
    ok: 'e4 este saltul de două câmpuri al pionului.',
    bad: 'Prima mutare a pionului de pe e2 poate ajunge pe e4.',
  },
  valoare: {
    code: 'P.02',
    label: 'Valoarea relativă a pieselor',
    fen: START_FEN,
    prompt: 'Dama valorează mai mult decât turnul. Câte puncte are dama?',
    choices: [
      { id: '9', label: '9' },
      { id: '5', label: '5' },
      { id: '3', label: '3' },
      { id: '1', label: '1' },
    ],
    answer: '9',
    ok: 'Dama are 9 puncte. Turnul are 5, nebunul și calul 3, pionul 1.',
    bad: 'Dama are 9 puncte.',
  },
  sah: {
    code: 'P.03',
    label: 'Șah, mat și apărarea împotriva șahului',
    fen: '4q2k/8/8/8/8/8/8/4K3 w - - 0 1',
    prompt: 'Dama neagră îl atacă pe regele alb, iar regele mai are câmpuri libere. Ce este poziția și care este apărarea?',
    choices: [
      { id: 'sah', label: 'Șah: regele părăsește coloana e' },
      { id: 'mat', label: 'Mat: partida s-a terminat' },
      { id: 'ignora', label: 'Șahul poate fi ignorat' },
    ],
    answer: 'sah',
    ok: 'Este șah. Regele se mută de pe coloana atacată, se interpune o piesă sau se capturează atacatorul.',
    bad: 'Nu este mat: regele mai poate părăsi coloana e. Șahul nu se ignoră.',
  },
  maturi: {
    code: 'P.04',
    label: 'Mat cu regină, două turnuri, turn și doi nebuni',
    fen: 'k7/Q7/1K6/8/8/8/8/8 b - - 0 1',
    prompt: 'Negrul nu are nicio mutare, iar regele este în șah. Ce model de mat este pe tablă?',
    choices: [
      { id: 'dama', label: 'Damă' },
      { id: 'doua-turnuri', label: 'Două turnuri' },
      { id: 'turn', label: 'Turn' },
      { id: 'nebuni', label: 'Doi nebuni' },
    ],
    answer: 'dama',
    ok: 'Dama de pe a7, apărată de regele din b6, dă mat regelui din a8.',
    bad: 'Pe tablă este mat cu dama.',
  },
  legalitate: {
    code: 'P.05',
    label: 'Verificarea legalității mutării adversarului și a propriei mutări',
    fen: '4r2k/8/8/8/8/8/8/4K3 w - - 0 1',
    prompt: 'Turnul negru dă șah pe coloana e. Albul mută regele de pe e1 pe e2. Verifici mutarea: este legală?',
    choices: [
      { id: 'da', label: 'Da' },
      { id: 'nu', label: 'Nu' },
    ],
    answer: 'nu',
    ok: 'Nu este legală. Regele rămâne în șah pe coloana e. O mutare proprie sau a adversarului este legală doar dacă regele propriu nu rămâne atacat.',
    bad: 'Ke2 lasă regele în șah. Mutarea nu este legală.',
  },
  deschidere: {
    code: 'P.06',
    label: 'Principii de deschidere',
    fen: START_FEN,
    prompt: 'În deschidere lupți pentru centru. Apasă câmpul e4.',
    accept: (square) => square === 'e4',
    ok: 'e4 deschide linii pentru nebun și damă și controlează centrul.',
    bad: 'Câmpul cerut este e4.',
  },
  finaluri: {
    code: 'P.07',
    label: 'Elemente de final',
    fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
    prompt: 'În finalul de pioni, regele nu mai stă deoparte. Ce face regele alb?',
    choices: [
      { id: 'activ', label: 'Se apropie de pion' },
      { id: 'pasiv', label: 'Rămâne pe e1 toată partida' },
    ],
    answer: 'activ',
    ok: 'În final regele devine o piesă activă și se apropie de pion.',
    bad: 'Regele intră în joc și sprijină pionul.',
  },
  repetare: {
    code: 'P.08',
    label: 'Repetarea poziției',
    fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    prompt: 'Aceeași poziție apare a treia oară, cu același jucător la mutare și aceleași drepturi. Care este rezultatul?',
    choices: [
      { id: 'remiza', label: 'Remiză' },
      { id: 'mat', label: 'Mat' },
      { id: 'victorie', label: 'Victorie pentru alb' },
    ],
    answer: 'remiza',
    ok: 'Repetarea de trei ori a aceleiași poziții poate fi reclamată ca remiză.',
    bad: 'Rezultatul este remiza, nu matul și nu victoria.',
  },
  ceas: {
    code: 'P.09',
    label: 'Ceasul de șah; bullet, blitz și clasic',
    fen: START_FEN,
    prompt: 'Fiecare jucător are 5 minute pe ceas. Ce ritm este partida?',
    choices: [
      { id: 'bullet', label: 'Bullet' },
      { id: 'blitz', label: 'Blitz' },
      { id: 'clasic', label: 'Clasic' },
    ],
    answer: 'blitz',
    ok: '5 minute este blitz. Bullet este mai scurt, de circa un minut. Clasic este partida lungă.',
    bad: '5 minute este blitz.',
  },
  ordine: {
    code: 'P.10',
    label: 'Ordinea gândirii: mat → șah → captură → amenințare → plan',
    fen: 'k7/Q7/1K6/8/8/8/8/8 b - - 0 1',
    prompt: 'Înainte să muți, care este primul lucru pe care îl cauți?',
    choices: [
      { id: 'mat', label: 'Mat' },
      { id: 'sah', label: 'Șah' },
      { id: 'captura', label: 'Captură' },
      { id: 'plan', label: 'Plan' },
    ],
    answer: 'mat',
    ok: 'Ordinea este mat, apoi șah, captură, amenințare și abia apoi plan.',
    bad: 'Întâi cauți matul. Apoi șah, captură, amenințare și plan.',
  },
}

const CAL = {
  furculita: {
    code: 'C.01',
    label: 'Atacul dublu / furculița.',
    fen: '4k3/3q4/8/8/6N1/8/8/6K1 w - - 0 1',
    mark: 'g4',
    prompt: 'Calul alb de pe g4 poate ataca dintr-o dată regele și dama. Apasă câmpul furculiței.',
    accept: (square) => square === 'f6',
    ok: 'Nf6 este furculiță: calul dă șah pe e8 și atacă dama de pe d7.',
    bad: 'Câmpul furculiței este f6.',
  },
  descoperire: {
    code: 'C.02',
    label: 'Atacul sau șahul prin descoperire.',
    fen: '4k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1',
    mark: 'e5',
    prompt: 'Calul de pe e5 stă în fața turnului. Mută calul la c4: pleacă de pe coloană, iar turnul dă șah prin descoperire.',
    correctMove: 'Nc4+',
    accept: (square) => square === 'c4',
    ok: 'Nc4+ descoperă turnul de pe e1. Șahul vine de la piesa din spate.',
    bad: 'Mutarea este Nc4+. Calul părăsește coloana e, iar turnul dă șah.',
  },
  ultima: {
    code: 'C.03',
    label: 'Slăbiciunea ultimei linii.',
    fen: '3q3k/8/8/8/4n3/8/5P2/3RK3 b - - 0 1',
    solutie: ['Qxd1+', 'Kxd1', 'Nxf2+'],
    attempts: 3,
    prompt: 'Negrul este la mutare. Joacă toată secvența: Qxd1+, apoi, după Kxd1, încheie cu Nxf2+.',
    ok: 'Secvența este completă: Qxd1+, Kxd1, Nxf2+.',
    bad: 'Linia are trei mutări: Qxd1+, Kxd1 și Nxf2+.',
  },
  supraincarcare: {
    code: 'C.04',
    label: 'Supraîncărcarea.',
    fen: '6k1/6pp/5n2/3q4/8/2N5/8/1Q4K1 w - - 0 1',
    prompt: 'Calul negru din f6 apără și h7, și dama din d5. Nu le poate salva pe ambele. Apasă piesa supraîncărcată.',
    accept: (square) => square === 'f6',
    ok: 'Calul din f6 este supraîncărcat: o singură piesă are două sarcini.',
    bad: 'Piesa cu două sarcini este calul din f6.',
  },
  deflectie: {
    code: 'C.05',
    label: 'Deflecția apărătorului.',
    fen: '6k1/1q3ppp/2B5/8/8/8/Q7/R5K1 w - - 0 1',
    prompt: 'Dama neagră stă pe b7. Dama albă dă șah pe a8 și o atrage de acolo. Apasă a8.',
    accept: (square) => square === 'a8',
    ok: 'Qa8+ este deflecție. Dacă dama neagră ia pe a8, turnul reia și dă mat.',
    bad: 'Câmpul deflecției este a8.',
  },
  sahdublu: {
    code: 'C.06',
    label: 'Șahul dublu după deflecție.',
    fen: '4k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1',
    mark: 'e4',
    prompt: 'Nebunul a rămas în fața turnului, pe coloana e. Apasă câmpul unde nebunul dă șah și descoperă și turnul.',
    accept: (square) => square === 'c6',
    ok: 'Bc6 este șah dublu. Regele trebuie să se mute: o singură captură sau o interpunere nu oprește ambele șahuri.',
    bad: 'Câmpul șahului dublu este c6.',
  },
  analiza: {
    code: 'C.07',
    label: 'Analiza tactică de la piesa cu valoare mai mare spre cea cu valoare mai mică.',
    fen: START_FEN,
    prompt: 'Când cauți o tactică, pornești de la piesa cu valoarea cea mai mare. Cu ce piesă începi?',
    choices: [
      { id: 'dama', label: 'Dama' },
      { id: 'turn', label: 'Turnul' },
      { id: 'cal', label: 'Calul' },
      { id: 'pion', label: 'Pionul' },
    ],
    answer: 'dama',
    ok: 'Începi cu dama, apoi turnul, nebunul și calul, și la urmă pionul.',
    bad: 'Prima este dama, piesa cu valoarea cea mai mare.',
  },
  modele: {
    code: 'C.08',
    label: 'Modele de mat: nebun + cal, mat sufocat, Legal, Anastasia și ultima linie.',
    fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Calul dă șah, iar piesele negre iau regelui toate câmpurile. Ce model de mat este pe tablă?',
    choices: [
      { id: 'nebun-cal', label: 'Nebun și cal' },
      { id: 'sufocat', label: 'Mat sufocat' },
      { id: 'legal', label: 'Legal' },
      { id: 'anastasia', label: 'Anastasia' },
      { id: 'ultima', label: 'Ultima linie' },
    ],
    answer: 'sufocat',
    ok: 'Este mat sufocat. În aceeași lecție intră și matul cu nebun și cal, Legal, Anastasia și ultima linie.',
    bad: 'Este mat sufocat: calul dă șah, iar regele nu are aer din cauza propriilor piese.',
  },
}

const NEBUN = {
  'nb-hook': {
    code: 'N.01',
    label: 'Hook',
    fen: '6Rk/6p1/5N2/6P1/8/8/8/6K1 b - - 0 1',
    prompt: 'Turnul stă lângă rege și este apărat de cal. Pionul alb apără calul, iar pionul negru de pe g7 este cârligul. Apasă piesa care dă matul.',
    accept: (square) => square === 'g8',
    ok: 'Turnul de pe g8 dă matul Hook. Calul de pe f6 îl apără și ia h7, iar pionul g7 închide cârligul.',
    bad: 'Piesa care dă matul este turnul de pe g8.',
  },
  'nb-swine': {
    code: 'N.02',
    label: 'Blind Swine',
    fen: 'k7/RR6/8/8/8/8/8/4K3 b - - 0 1',
    prompt: 'Cei doi turnuri stau pe linia 7, ca porcii orbi. Apasă turnul care dă șah.',
    accept: (square) => square === 'a7',
    ok: 'Turnul de pe a7 dă mat. Cel de pe b7 îi ia regelui b8 și apără turnul din față.',
    bad: 'Șahul vine de la turnul de pe a7.',
  },
  'nb-balestra': {
    code: 'N.03',
    label: 'Balestra',
    fen: '7k/8/6Q1/8/8/8/1B6/6K1 b - - 0 1',
    prompt: 'Dama taie ieșirile, iar nebunul dă lovitura. Apasă piesa care dă matul.',
    accept: (square) => square === 'b2',
    ok: 'Nebunul de pe b2 dă matul Balestra. Dama de pe g6 acoperă g7, g8 și h7.',
    bad: 'Matul îl dă nebunul de pe b2.',
  },
  'nb-opera': {
    code: 'N.04',
    label: 'Opera',
    fen: '3Rkr2/2Bppp2/8/8/8/8/8/4K3 b - - 0 1',
    prompt: 'Turnul a intrat pe ultima linie și este apărat de nebun. Pionii negri închid regele. Apasă piesa care dă matul.',
    accept: (square) => square === 'd8',
    ok: 'Turnul de pe d8 dă matul Opera. Nebunul de pe c7 îl apără.',
    bad: 'Matul îl dă turnul de pe d8.',
  },
  'nb-kill': {
    code: 'N.05',
    label: 'Kill Box',
    fen: '6kR/8/5Q2/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Dama și turnul formează o cutie de 3 pe 3 în jurul regelui. Între ele, pe diagonală, este un câmp gol. Apasă piesa care dă matul.',
    accept: (square) => square === 'h8',
    ok: 'Turnul de pe h8 dă matul Kill Box. Dama de pe f6 îl apără peste câmpul gol g7.',
    bad: 'Matul îl dă turnul de pe h8.',
  },
  'nb-guerrilla': {
    code: 'N.06',
    label: 'Guerrilla',
    fen: '6rk/5N2/6K1/8/8/8/8/8 b - - 0 1',
    prompt: 'Calul, piesa mică, dă mat cu ajutorul regelui său. Turnul negru îi ia regelui câmpul g8. Apasă piesa care dă matul.',
    accept: (square) => square === 'f7',
    ok: 'Calul de pe f7 dă matul Guerrilla. Regele alb de pe g6 apără calul și ia g7 și h7.',
    bad: 'Matul îl dă calul de pe f7.',
  },
  'nb-swallow': {
    code: 'N.07',
    label: 'Swallow-tail',
    fen: '3rkr2/4Q3/4R3/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Dama este apărată de turnul din spate, iar turnurile negre stau ca o coadă de rândunică, de o parte și de alta a regelui. Apasă piesa care dă matul.',
    accept: (square) => square === 'e7',
    ok: 'Dama de pe e7 dă matul Swallow-tail. Turnul de pe e6 o apără.',
    bad: 'Matul îl dă dama de pe e7.',
  },
  'nb-blackburne': {
    code: 'N.08',
    label: 'Blackburne',
    fen: '5r1k/6Bp/8/5N2/8/8/B7/6K1 b - - 0 1',
    prompt: 'Doi nebuni taie diagonalele, calul apără nebunul din g7, iar turnul negru stă lângă rege. Apasă piesa care dă matul.',
    accept: (square) => square === 'g7',
    ok: 'Nebunul de pe g7 dă matul Blackburne. Calul de pe f5 îl apără, iar nebunul de pe a2 acoperă g8.',
    bad: 'Matul îl dă nebunul de pe g7.',
  },
  'nb-corner': {
    code: 'N.09',
    label: 'Corner',
    fen: 'k1R5/pp6/1N6/8/8/8/8/4K3 b - - 0 1',
    prompt: 'Regele este în colț. Turnul îl ține pe linie, pionii lui îi blochează ieșirea, iar o piesă mică dă matul. Apasă piesa care dă matul.',
    accept: (square) => square === 'b6',
    ok: 'Calul de pe b6 dă matul Corner. Turnul de pe c8 acoperă b8, iar pionii a7 și b7 închid restul.',
    bad: 'Matul îl dă calul de pe b6.',
  },
  'nb-cozio': {
    code: 'N.10',
    label: 'Cozio',
    fen: '2k5/1pQp4/3B4/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Cozio este același desen cu Dovetail, pe aripa damei: dama stă lângă rege, iar pionii lui formează coada. Apasă piesa care dă matul.',
    accept: (square) => square === 'c7',
    ok: 'Dama de pe c7 dă matul Cozio. Nebunul de pe d6 o apără, iar pionii b7 și d7 închid coada.',
    bad: 'Matul îl dă dama de pe c7.',
  },
  'nb-david': {
    code: 'N.11',
    label: 'David & Goliath',
    fen: '6bk/6P1/7K/8/8/8/8/8 b - - 0 1',
    prompt: 'Pionul, piesa cea mică, dă mat regelui. Nebunul negru îi blochează g8. Apasă piesa care dă matul.',
    accept: (square) => square === 'g7',
    ok: 'Pionul de pe g7 este David. Regele alb de pe h6 îl apără și ia h7.',
    bad: 'Matul îl dă pionul de pe g7.',
  },
  'nb-lange': {
    code: 'N.12',
    label: 'Max Lange',
    fen: '6Qk/7B/8/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Dama dă șah și este apărată de nebun. Nebunul îi ia regelui și un câmp de fugă. Apasă piesa care dă matul.',
    accept: (square) => square === 'g8',
    ok: 'Dama de pe g8 dă matul Max Lange. Nebunul de pe h7 o apără și acoperă g7.',
    bad: 'Matul îl dă dama de pe g8.',
  },
  'nb-mayet': {
    code: 'N.13',
    label: "Mayet's",
    fen: '6kR/5p1p/8/4B3/8/8/8/6K1 b - - 0 1',
    prompt: 'Turnul stă lângă rege, pe ultima linie, și este apărat de departe de nebun. Apasă piesa care dă matul.',
    accept: (square) => square === 'h8',
    ok: 'Turnul de pe h8 dă matul lui Mayet. Nebunul de pe e5 îl apără pe diagonală.',
    bad: 'Matul îl dă turnul de pe h8.',
  },
  'nb-morphy': {
    code: 'N.14',
    label: "Morphy's",
    fen: '7k/5p1p/5B2/8/8/8/5K2/6R1 b - - 0 1',
    prompt: 'Nebunul dă șah. Turnul și pionii negri îl țin pe rege în colț. Apasă piesa care dă matul.',
    accept: (square) => square === 'f6',
    ok: 'Nebunul de pe f6 dă matul lui Morphy. Turnul de pe g1 taie coloana g.',
    bad: 'Matul îl dă nebunul de pe f6.',
  },
  'nb-reti': {
    code: 'N.15',
    label: "Réti's",
    fen: '5nkb/5Bpp/8/8/8/8/8/5RK1 b - - 0 1',
    prompt: 'Patru piese negre stau pe câmpurile de fugă, iar nebunul care dă șah este apărat de turn. Apasă piesa care dă matul.',
    accept: (square) => square === 'f7',
    ok: 'Nebunul de pe f7 dă matul lui Réti. Turnul de pe f1 îl apără.',
    bad: 'Matul îl dă nebunul de pe f7.',
  },
  'nb-vukovic': {
    code: 'N.16',
    label: 'Vukovic',
    fen: '4k3/4R3/4NK2/8/8/8/8/8 b - - 0 1',
    prompt: 'Turnul dă șah la margine și este apărat de rege. Calul ia ultimele câmpuri, d8 și f8. Apasă piesa care dă matul.',
    accept: (square) => square === 'e7',
    ok: 'Turnul de pe e7 dă matul Vukovic. Regele de pe f6 îl apără, iar calul de pe e6 acoperă d8 și f8.',
    bad: 'Matul îl dă turnul de pe e7.',
  },
  'nb-anderssen': {
    code: 'N.17',
    label: 'Anderssen',
    fen: '6kR/5pPp/5B2/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Turnul stă lângă rege pe ultima linie și este apărat de pionul din g7. Pionul acela este apărat de nebun. Apasă piesa care dă matul.',
    accept: (square) => square === 'h8',
    ok: 'Turnul de pe h8 dă matul lui Anderssen. Pionul g7 îl apără, iar nebunul de pe f6 apără pionul.',
    bad: 'Matul îl dă turnul de pe h8.',
  },
  'nb-ultima': {
    code: 'N.18',
    label: 'ultima linie',
    fen: 'R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1',
    prompt: 'Pionii f7, g7 și h7 îi iau regelui ieșirea, iar turnul a intrat pe linia 8. Apasă piesa care dă matul.',
    accept: (square) => square === 'a8',
    ok: 'Turnul de pe a8 dă mat pe ultima linie.',
    bad: 'Matul îl dă turnul de pe a8.',
  },
  'nb-sufocat': {
    code: 'N.19',
    label: 'sufocat',
    fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Calul dă șah, iar piesele negre îi iau regelui tot aerul. Apasă piesa care dă matul.',
    accept: (square) => square === 'f7',
    ok: 'Calul de pe f7 dă matul sufocat.',
    bad: 'Matul îl dă calul de pe f7.',
  },
  'nb-arab': {
    code: 'N.20',
    label: 'Arab',
    fen: '7k/7R/5N2/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Regele este în colț. Turnul stă lângă el, iar calul apără turnul și acoperă g8. Apasă piesa care dă matul.',
    accept: (square) => square === 'h7',
    ok: 'Turnul de pe h7 dă matul arab. Calul de pe f6 îl apără și ia g8.',
    bad: 'Matul îl dă turnul de pe h7.',
  },
  'nb-anastasia': {
    code: 'N.21',
    label: 'Anastasia',
    fen: '7k/4N1p1/8/8/8/8/6K1/7R b - - 0 1',
    prompt: 'Turnul dă șah pe coloana de margine. Calul acoperă g8, iar pionul negru stă pe g7. Apasă piesa care dă matul.',
    accept: (square) => square === 'h1',
    ok: 'Turnul de pe h1 dă matul Anastasia. Calul de pe e7 acoperă g8.',
    bad: 'Matul îl dă turnul de pe h1.',
  },
  'nb-boden': {
    code: 'N.22',
    label: 'Boden',
    fen: '1rkr4/2p5/B3B3/8/8/8/8/4K3 b - - 0 1',
    prompt: 'Doi nebuni dau șah pe diagonale care se încrucișează. Turnurile și pionul regelui îi închid ieșirile. Apasă unul dintre nebuni.',
    accept: (square) => square === 'a6' || square === 'e6',
    ok: 'Nebunii de pe a6 și e6 dau împreună matul lui Boden.',
    bad: 'Apasă nebunul de pe a6 sau pe cel de pe e6.',
  },
  'nb-dovetail': {
    code: 'N.23',
    label: 'Dovetail',
    fen: '4k3/3pQp2/8/2B5/8/8/8/6K1 b - - 0 1',
    prompt: 'Dama stă lângă rege, iar pionii de pe d7 și f7 formează coada. Apasă piesa care dă matul.',
    accept: (square) => square === 'e7',
    ok: 'Dama de pe e7 dă matul Dovetail. Nebunul de pe c5 o apără.',
    bad: 'Matul îl dă dama de pe e7.',
  },
  'nb-epaulette': {
    code: 'N.24',
    label: 'Epaulette',
    fen: '3rkr2/4Q3/8/2B5/8/8/8/6K1 b - - 0 1',
    prompt: 'Turnurile negre stau ca epoleții, de o parte și de alta a regelui, pe aceeași linie cu el. Apasă piesa care dă matul.',
    accept: (square) => square === 'e7',
    ok: 'Dama de pe e7 dă matul Epaulette. Nebunul de pe c5 o apără, iar turnurile de pe d8 și f8 închid umerii.',
    bad: 'Matul îl dă dama de pe e7.',
  },
  'nb-damiano': {
    code: 'N.25',
    label: 'Damiano',
    fen: '7k/6pQ/6P1/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Pionul alb închide regele și apără dama. Apasă piesa care dă matul.',
    accept: (square) => square === 'h7',
    ok: 'Dama de pe h7 dă matul lui Damiano. Pionul de pe g6 o apără.',
    bad: 'Matul îl dă dama de pe h7.',
  },
  'nb-greco': {
    code: 'N.26',
    label: 'Greco',
    fen: '7k/6p1/8/8/8/8/B5K1/7R b - - 0 1',
    prompt: 'Nebunul îl ține pe rege cu ajutorul pionului de pe g7. Turnul dă șah pe coloana de margine. Apasă piesa care dă matul.',
    accept: (square) => square === 'h1',
    ok: 'Turnul de pe h1 dă matul lui Greco. Nebunul de pe a2 acoperă g8.',
    bad: 'Matul îl dă turnul de pe h1.',
  },
  'nb-legal': {
    code: 'N.27',
    label: 'Legal',
    fen: 'rnbq1b1r/ppppkBpp/3p4/3NN3/8/8/8/4K3 b - - 0 1',
    prompt: 'Doi cai și un nebun lucrează împreună. Regele negru a fost scos pe e7. Apasă piesa care dă matul.',
    accept: (square) => square === 'd5',
    ok: 'Calul de pe d5 dă matul lui Legal. Nebunul de pe f7 și calul de pe e5 îi iau câmpurile din jur.',
    bad: 'Matul îl dă calul de pe d5.',
  },
  'nb-intermediar': {
    code: 'N.28',
    label: 'mutarea intermediară',
    fen: '4k3/8/q3p3/8/2B5/8/8/6K1 w - - 0 1',
    mark: 'c4',
    prompt: 'Poți lua pionul de pe e6. Mai întâi există un șah care atacă și dama. Apasă câmpul șahului intermediar.',
    accept: (square) => square === 'b5',
    ok: 'Bb5+ este mutarea intermediară: dă șah și atacă dama de pe a6. Captura pionului poate aștepta.',
    bad: 'Șahul intermediar este pe b5.',
  },
  'nb-contraatac': {
    code: 'N.29',
    label: 'contraatacul',
    fen: '6k1/8/8/8/8/5n2/8/4Q2K w - - 0 1',
    mark: 'e1',
    prompt: 'Calul negru atacă dama. Nu o retrage simplu: pleacă cu șah. Apasă e8.',
    accept: (square) => square === 'e8',
    ok: 'Qe8+ este contraatacul. Dama iese de sub atacul calului și dă șah.',
    bad: 'Contraatacul este dama pe e8.',
  },
  'nb-prindere': {
    code: 'N.30',
    label: 'prinderea unei piese valoroase',
    fen: '6kr/7p/8/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Turnul din colț nu mai are niciun câmp: regele stă pe g8, pionul pe h7. Apasă piesa prinsă.',
    accept: (square) => square === 'h8',
    ok: 'Turnul de pe h8 este prins. Propriile piese i-au închis și linia, și coloana.',
    bad: 'Piesa prinsă este turnul de pe h8.',
  },
  'nb-raze': {
    code: 'N.31',
    label: 'atacul prin raze X',
    fen: '4k3/8/8/8/4q3/8/8/4R1K1 w - - 0 1',
    mark: 'e1',
    prompt: 'Turnul de pe e1 vede regele de pe e8 prin dama neagră. Apasă piesa care stă pe raza X.',
    accept: (square) => square === 'e4',
    ok: 'Dama de pe e4 stă pe raza X, între turn și rege. Dacă pleacă de pe coloană, turnul dă șah.',
    bad: 'Piesa de pe rază este dama de pe e4.',
  },
  'nb-fortat': {
    code: 'N.32',
    label: 'mutări forțate',
    fen: '7k/6Qp/8/8/8/8/8/6K1 b - - 0 1',
    prompt: 'Ești în șah și ai o singură mutare legală. Apasă-o.',
    accept: (square) => square === 'g7',
    ok: 'Kxg7 este singura mutare. Șahul a limitat partida la un singur răspuns.',
    bad: 'Singura mutare legală este pe g7.',
  },
  'nb-limitare': {
    code: 'N.33',
    label: 'limitarea opțiunilor adversarului',
    fen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
    mark: 'd1',
    prompt: 'Regele negru are cinci ieșiri. Dama poate să-i lase una singură, fără să dea șah. Apasă câmpul.',
    accept: (square) => square === 'd6',
    ok: 'Qd6 îi lasă regelui doar f7. Nu este șah: îi limitează opțiunile.',
    bad: 'Câmpul este d6.',
  },
  'nb-ascuns': {
    code: 'N.34',
    label: 'identificarea motivului ascuns',
    fen: '4k3/3q4/8/8/6N1/4p3/8/6K1 w - - 0 1',
    mark: 'g4',
    prompt: 'Pionul de pe e3 poate fi luat. Motivul ascuns este altul: calul poate ataca dintr-o dată regele și dama. Apasă câmpul motivului.',
    accept: (square) => square === 'f6',
    ok: 'Nf6+ este motivul ascuns: furculiță, nu captura pionului.',
    bad: 'Motivul este pe f6.',
  },
}

const EXAM = [
  {
    prompt: 'Proba 1 din 4. Apasă câmpul a1.',
    fen: EMPTY_FEN,
    accept: (square) => square === 'a1',
    ok: 'a1.',
    bad: 'Răspunsul era a1.',
  },
  {
    prompt: 'Proba 2 din 4. Apasă un câmp de pe coloana c.',
    fen: EMPTY_FEN,
    accept: (square) => square[0] === 'c',
    ok: 'Coloana c.',
    bad: 'Răspunsul era un câmp de pe coloana c.',
  },
  {
    prompt: 'Proba 3 din 4. Ce culoare are câmpul h1?',
    fen: EMPTY_FEN,
    mark: 'h1',
    choices: [
      { id: 'light', label: 'Deschis' },
      { id: 'dark', label: 'Închis' },
    ],
    answer: 'light',
    ok: 'h1 este deschis.',
    bad: 'h1 este deschis.',
  },
  {
    prompt: 'Proba 4 din 4. Negrul nu poate muta și nu este în șah. Pat sau mat?',
    fen: STALEMATE_FEN,
    choices: [
      { id: 'pat', label: 'Pat' },
      { id: 'mat', label: 'Mat' },
    ],
    answer: 'pat',
    ok: 'Pat.',
    bad: 'Este pat.',
  },
]
const MODE_TITLE = { menu: 'Meniu', train: 'Antrenament', analysis: 'Analiză', learn: 'Învățăm de la…' }

const QUEST_STEPS = [
  {
    prompt: 'Quest 1/3. Albul dă mat pe ultima linie.',
    fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
  },
  {
    prompt: 'Quest 2/3. Dama albă dă mat.',
    fen: '6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1',
  },
  {
    prompt: 'Quest 3/3. Sacrificiul: o piesă se oferă ca să urmeze un șah forțat.',
    fen: EXERCISE_FEN,
  },
]

const PUZZLE_FEN = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'

const TRAIN_COPY = {
  quest: {
    title: 'Quest mode',
    badge: 'QUEST',
    text: 'Trei poziții. Timpul de gândire al albului și al negrului se adună separat. Motorul confirmă mutarea.',
  },
  puzzle: {
    title: 'Chess Puzzle',
    badge: 'PUZZLE',
    text: 'Dă mat într-o mutare. Ceasul pornește doar pentru partea care gândește. Analiza motorului judecă răspunsul.',
  },
  random: {
    title: 'Random games',
    badge: 'RANDOM',
    text: 'Poziție scoasă dintr-o deschidere aleatoare. Alb ești tu, negrul e motorul. Fiecare parte are 5 minute.',
  },
  custom: {
    title: 'Custom game',
    badge: 'CUSTOM',
    text: 'Pune minutele albului și, separat, minutele negrului. Poziția este FEN-ul din panou. Tu joci cu albul.',
  },
  classical: {
    title: 'Classical game',
    badge: 'CLASIC',
    text: 'Partidă clasică de la poziția inițială: 30 de minute pentru alb și 30 de minute pentru negru. Motorul joacă negrul.',
  },
  blindfold: {
    title: 'Blindfold game',
    badge: 'ORB',
    text: 'Piesele sunt ascunse. Mută din câmpul de mutare, în notație sau în coordonate. 10 minute pentru fiecare culoare.',
  },
}

const fenInput = document.querySelector('#fen')
const moveInput = document.querySelector('#move')
const depthInput = document.querySelector('#depth')
const evalButton = document.querySelector('#eval')
const statusEl = document.querySelector('#status')
const engineLine = document.querySelector('#engine-line')
const resultEl = document.querySelector('#result')
const boardEl = document.querySelector('#board')
const activityTitle = document.querySelector('#activity-title')
const panelTitle = document.querySelector('#panel-title')
const lessonEl = document.querySelector('#lesson')

const taskActions = document.querySelector('#task-actions')
const badge = document.querySelector('.badge')

fenInput.value = START_FEN

await initI18n()
const engine = new StockfishClient()
const interactive = new InteractiveBoard(document.querySelector('#interactive-board'))
let busy = false
let mode = 'analysis'
let task = null
let curriculumLessonId = null
let exam = null
let examProbeIndex = -1
let train = null
let trainMode = null

function setStatus(text) {
  statusEl.textContent = text
}

function formatScore(evaluationCp, mateIn) {
  if (mateIn != null) {
    const sign = mateIn > 0 ? '+' : ''
    return `${sign}mat în ${Math.abs(mateIn)}`
  }
  if (evaluationCp == null) return '—'
  const sign = evaluationCp > 0 ? '+' : ''
  return `${sign}${evaluationCp} cp`
}

function currentFen() {
  return fenInput.value.trim()
}

function sideToMove(fen) {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w'
}

function otherSide(side) {
  return side === 'w' ? 'b' : 'w'
}

let historyFENs = []
let currentMoveIndex = 0
let isPlaying = false
let autoPlayTimer = 0
let testRun = null
let testSummary = null
let demoLine = false
let practiceGate = null
let liveFen = ''
let applyingHistory = false

function canonicalFen(fen) {
  try {
    return new Chess(fen).fen()
  } catch {
    return String(fen || '').trim()
  }
}

function historyFromLine(fen, moves) {
  let chess
  try {
    chess = new Chess(fen)
  } catch {
    return fen ? [String(fen).trim()] : []
  }
  const frames = [chess.fen()]
  for (const move of moves || []) {
    try {
      if (!playTypedMove(chess, move)) break
      frames.push(chess.fen())
    } catch {
      break
    }
  }
  return frames
}

function paintMoveNav() {
  const play = document.querySelector('#nav-play')
  if (!play) return
  const last = Math.max(0, historyFENs.length - 1)
  document.querySelector('#nav-start').disabled = currentMoveIndex <= 0
  document.querySelector('#nav-prev').disabled = currentMoveIndex <= 0
  document.querySelector('#nav-next').disabled = currentMoveIndex >= last
  document.querySelector('#nav-end').disabled = currentMoveIndex >= last
  play.disabled = historyFENs.length < 2
  play.textContent = isPlaying ? '⏸' : '▶'
  play.setAttribute('aria-pressed', String(isPlaying))
  play.setAttribute('aria-label', t(isPlaying ? 'replay.pause' : 'replay.play'))
  play.title = t(isPlaying ? 'replay.pause' : 'replay.play')
}

function stopAutoPlay() {
  if (autoPlayTimer) clearInterval(autoPlayTimer)
  autoPlayTimer = 0
  const was = isPlaying
  isPlaying = false
  if (was) paintMoveNav()
}

function adoptFen(fen) {
  const canon = canonicalFen(fen)
  if (!canon) return
  const at = historyFENs.indexOf(canon)
  if (at >= 0) {
    currentMoveIndex = at
    liveFen = canon
    paintMoveNav()
    return
  }
  stopAutoPlay()
  historyFENs = [canon]
  currentMoveIndex = 0
  liveFen = canon
  paintMoveNav()
}

function publishLine(fen, moves, atEnd = false) {
  const frames = historyFromLine(fen, moves)
  if (!frames.length) return
  stopAutoPlay()
  historyFENs = frames
  const shown = canonicalFen(currentFen())
  const found = frames.indexOf(shown)
  currentMoveIndex = atEnd ? frames.length - 1 : (found >= 0 ? found : 0)
  liveFen = frames[found >= 0 ? found : currentMoveIndex]
  paintMoveNav()
}

function followOrAppend(fen) {
  const canon = canonicalFen(fen)
  if (!canon) return
  if (isPlaying) stopAutoPlay()
  if (historyFENs[currentMoveIndex] === canon) {
    liveFen = canon
    paintMoveNav()
    return
  }
  const ahead = historyFENs.indexOf(canon, currentMoveIndex + 1)
  if (ahead >= 0) {
    currentMoveIndex = ahead
    liveFen = canon
    paintMoveNav()
    return
  }
  const behind = historyFENs.lastIndexOf(canon, currentMoveIndex)
  if (behind >= 0) {
    currentMoveIndex = behind
    liveFen = canon
    paintMoveNav()
    return
  }
  historyFENs = historyFENs.slice(0, currentMoveIndex + 1)
  historyFENs.push(canon)
  currentMoveIndex = historyFENs.length - 1
  liveFen = canon
  paintMoveNav()
}

function applyHistoryFrame() {
  const fen = historyFENs[currentMoveIndex]
  if (!fen) return
  applyingHistory = true
  showPosition(fen)
  applyingHistory = false
  paintMoveNav()
}

function browsingHistory() {
  if (historyFENs.length < 2 || !liveFen) return false
  return canonicalFen(currentFen()) !== canonicalFen(liveFen)
}

function returnToLive() {
  const target = canonicalFen(liveFen)
  const at = historyFENs.indexOf(target)
  if (at >= 0) currentMoveIndex = at
  applyingHistory = true
  showPosition(historyFENs[currentMoveIndex] || target)
  applyingHistory = false
  paintMoveNav()
}

function goToStart() {
  if (!historyFENs.length) return
  currentMoveIndex = 0
  applyHistoryFrame()
}

function prevMove() {
  if (currentMoveIndex <= 0) return
  currentMoveIndex -= 1
  applyHistoryFrame()
}

function nextMove() {
  if (currentMoveIndex >= historyFENs.length - 1) return
  currentMoveIndex += 1
  applyHistoryFrame()
}

function goToEnd() {
  if (!historyFENs.length) return
  currentMoveIndex = historyFENs.length - 1
  applyHistoryFrame()
  if (isPlaying) stopAutoPlay()
}

function toggleAutoPlay() {
  if (isPlaying) {
    stopAutoPlay()
    return
  }
  if (historyFENs.length < 2) return
  if (currentMoveIndex >= historyFENs.length - 1) goToStart()
  isPlaying = true
  paintMoveNav()
  autoPlayTimer = setInterval(() => {
    if (currentMoveIndex >= historyFENs.length - 1) {
      stopAutoPlay()
      return
    }
    nextMove()
    if (currentMoveIndex >= historyFENs.length - 1) stopAutoPlay()
  }, 1500)
}

function showPosition(fen) {
  fenInput.value = String(fen || '').trim()
  drawBoard()
  const side = sideToMove(fenInput.value)
  boardEl.dataset.turn = side
  if (!applyingHistory) adoptFen(fenInput.value)
  return side
}

function drawBoard() {
  syncBoardZones()
  const placed = interactive.draw(currentFen())
  if (!placed) {
    const check = validateFen(currentFen())
    setStatus(check.ok ? 'FEN invalid' : check.error)
    scheduleLiveEval()
    return
  }
  boardEl.dataset.turn = placed.turn
  document.querySelector('#side-white').classList.toggle('on', placed.turn === 'w')
  document.querySelector('#side-black').classList.toggle('on', placed.turn === 'b')
  syncPiecePath(interactive.whiteAtBottom)
  syncBoardAnnotations(interactive.whiteAtBottom)
  scheduleLiveEval()
}

let studentEvalStep = ''
let liveTimer = 0
let liveSerial = 0

function boardCovered() {
  const shell = document.querySelector('.shell')
  return Boolean(shell?.classList.contains('levels-on') || shell?.classList.contains('masters-on'))
}

function viewingAsTeacher() {
  return document.querySelector('.role.active')?.dataset.role === 'teacher'
}

function evalBarVisible() {
  if (piecePathActive() || train || interactive.blindfold || boardCovered()) return false
  if (viewingAsTeacher()) return true
  if (practiceIndex >= 0) return false
  if (isPedagogyOpen()) return pedagogyEvalVisible()
  if (studentEvalStep) return pedagogyEvalVisible(studentEvalStep)
  return false
}

function whiteScore(line, fen) {
  const sign = sideToMove(fen) === 'w' ? 1 : -1
  if (!line) return { cp: null, mate: null }
  if (line.mateIn != null) return { cp: null, mate: sign * line.mateIn }
  if (line.evaluationCp != null) return { cp: sign * line.evaluationCp, mate: null }
  return { cp: null, mate: null }
}

function formatEval(score) {
  if (score.mate != null) return score.mate > 0 ? `M${score.mate}` : `-M${Math.abs(score.mate)}`
  if (score.cp == null) return '—'
  const pawns = score.cp / 100
  const text = Math.abs(pawns).toFixed(1)
  if (pawns > 0) return `+${text}`
  if (pawns < 0) return `-${text}`
  return '0.0'
}

function whiteShare(score) {
  if (score.mate != null) return score.mate > 0 ? 100 : 0
  if (score.cp == null) return 50
  const pawns = Math.max(-3, Math.min(3, score.cp / 100))
  return 50 + (pawns / 3) * 50
}

function paintEval(line, fen) {
  const score = whiteScore(line, fen)
  const readout = document.querySelector('#eval-readout')
  const fill = document.querySelector('#eval-fill')
  if (readout) readout.textContent = formatEval(score)
  if (fill) fill.style.width = `${whiteShare(score)}%`
}

function scheduleLiveEval() {
  const bar = document.querySelector('#eval-bar')
  if (!bar) return
  const show = evalBarVisible()
  bar.hidden = !show
  liveSerial += 1
  clearTimeout(liveTimer)
  if (!show) {
    engine.stopLive()
    return
  }
  const serial = liveSerial
  liveTimer = setTimeout(() => { void runLiveEval(serial) }, 350)
}

async function runLiveEval(serial) {
  const fen = currentFen()
  if (!validateFen(fen).ok) {
    if (serial === liveSerial) paintEval(null, fen)
    return
  }
  const readout = document.querySelector('#eval-readout')
  if (readout && readout.textContent === '—') readout.textContent = '…'
  try {
    const { promise } = engine.requestLive(fen, { depth: 15 })
    const result = await promise
    if (serial !== liveSerial || !result || currentFen() !== fen) return
    paintEval(result.lines[0], fen)
  } catch {
    if (serial === liveSerial) paintEval(null, fen)
  }
}

function squareEdges(square, whiteAtBottom) {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  const col = whiteAtBottom ? file : 7 - file
  const row = whiteAtBottom ? 8 - rank : rank - 1
  return { left: col / 8, top: row / 8, right: (col + 1) / 8, bottom: (row + 1) / 8 }
}

function unionBox(squares, whiteAtBottom) {
  const edges = squares.map((square) => squareEdges(square, whiteAtBottom))
  const left = Math.min(...edges.map((edge) => edge.left))
  const top = Math.min(...edges.map((edge) => edge.top))
  const right = Math.max(...edges.map((edge) => edge.right))
  const bottom = Math.max(...edges.map((edge) => edge.bottom))
  return { left, top, width: right - left, height: bottom - top }
}

function placeOrientFrame(node, squares, whiteAtBottom) {
  const box = unionBox(squares, whiteAtBottom)
  node.style.left = `${box.left * 100}%`
  node.style.top = `${box.top * 100}%`
  node.style.width = `${box.width * 100}%`
  node.style.height = `${box.height * 100}%`
}

function syncBoardZones() {
  const zones = document.querySelector('#board-zones')
  if (!zones) return
  const on = openProcedureId === 'orientare' && practiceIndex < 0 && !interactive.blindfold
  zones.hidden = !on
  if (!on) return
  const whiteAtBottom = interactive.whiteAtBottom
  zones.classList.toggle('is-flipped', !whiteAtBottom)
  const label = (zone, key) => {
    const node = zones.querySelector(`[data-zone="${zone}"]`)
    if (node) node.textContent = t(key)
  }
  label('white', 'board.whiteSide')
  label('black', 'board.blackSide')
  label('queen', 'board.queenFlank')
  label('king', 'board.kingFlank')
  placeOrientFrame(zones.querySelector('.orient-outer'), ['c3', 'c6', 'f6', 'f3'], whiteAtBottom)
  placeOrientFrame(zones.querySelector('.orient-inner'), ['d4', 'd5', 'e5', 'e4'], whiteAtBottom)
  for (const node of zones.querySelectorAll('[data-orient]')) {
    const edge = squareEdges(node.dataset.orient, whiteAtBottom)
    node.style.left = `${((edge.left + edge.right) / 2) * 100}%`
    node.style.top = `${((edge.top + edge.bottom) / 2) * 100}%`
    node.textContent = node.dataset.orient
  }
}

function markSelected(square) {
  interactive.markSelected(square)
}

function playTeacherBoardMove(square) {
  const chess = positionChess()
  if (!chess) return
  if (!interactive.selected) {
    const piece = chess.get(square)
    if (!piece || piece.color !== chess.turn()) return
    markSelected(square)
    return
  }
  if (interactive.selected === square) {
    interactive.clearSelection()
    return
  }
  const from = interactive.selected
  interactive.clearSelection()
  const piece = chess.get(from)
  const promotion = piece?.type === 'p' && (square[1] === '8' || square[1] === '1') ? 'q' : undefined
  try {
    const played = chess.move({ from, to: square, promotion })
    fenInput.value = played.after
    interactive.lastMove = { from: played.from, to: played.to }
    drawBoard()
    playMoveEffect(played)
    syncPracticeFenFromBoard()
  } catch {
    const next = chess.get(square)
    if (next && next.color === chess.turn()) markSelected(square)
  }
}

function recordAnalysisTime(fen, result) {
  const turn = sideToMove(fen)
  interactive.addEngineTime(turn, result.timeMs || 0, { intoClock: !train })
  if (result.replyTimeMs) interactive.addEngineTime(otherSide(turn), result.replyTimeMs, { intoClock: false })
}

let openProcedureId = ''
let procedureEditLang = ''
let procedureBaseline = { definition: '', fen: '', prompt: '', solutie: '', bad: '' }
let procedureToastTimer = 0
let procedurePuzzle = false
let procedureSolved = false
let learnerSide = ''
let practiceView = 'theory'
let practiceIndex = -1
let practiceEditId = ''

function showProcedureCourse(procedure) {
  clearTask()
  closePedagogy()
  closeLevels()
  const cheer = document.querySelector('#cheer')
  if (cheer) cheer.hidden = true
  const storedFen = String(procedure.fen || '').trim()
  interactive.lastMove = null
  interactive.clearSelection()
  fenInput.value = storedFen || START_FEN
  drawBoard()
  badge.textContent = procedure.code || procedure.id
  activityTitle.textContent = tx(procedure.title)
  const child = role === 'child'
  const definition = document.querySelector('#procedure-definition')
  const notes = document.querySelector('#procedure-rest')
  const panel = document.querySelector('#procedure-course')
  const save = document.querySelector('#procedure-save')
  const analysis = document.querySelector('#analysis-fen')
  definition.value = tx(procedure.definition) || tx(procedure.explanation)
  document.querySelector('#procedure-prompt').value = tx(procedure.prompt) || tx(procedure.question)
  document.querySelector('#procedure-line').value = procedureLineText(procedure)
  document.querySelector('#procedure-bad').value = tx(procedure.bad)
  const extra = procedureNotes(procedure)
  notes.textContent = extra
  notes.hidden = child || !extra
  panel.hidden = false
  lessonEl.hidden = true
  for (const field of panel.querySelectorAll('.procedure-edit')) field.hidden = child
  const ask = document.querySelector('#procedure-ask')
  const reading = document.querySelector('#procedure-read')
  const readDefinition = document.querySelector('#procedure-read-definition')
  const readRest = document.querySelector('#procedure-read-rest')
  ask.textContent = procedureAsk(procedure, fenInput.value)
  ask.hidden = !child
  readDefinition.textContent = definition.value
  readRest.textContent = extra
  readRest.hidden = !extra
  reading.hidden = !child
  showProcedureFeedback('', '')
  hidePracticeGrid()
  const next = document.querySelector('#procedure-next')
  next.hidden = !child
  next.disabled = true
  save.hidden = child
  if (analysis) analysis.hidden = child
  fenInput.readOnly = child
  interactive.draggable = true
  interactive.showTargets = child
  openProcedureId = procedure.id
  procedureEditLang = lang()
  procedureBaseline = readProcedureDraft()
  practiceView = 'theory'
  practiceIndex = -1
  practiceEditId = ''
  if (child) armProcedurePuzzle(procedure)
  else procedurePuzzle = false
  syncPracticeChrome()
  setStatus('')
  syncBoardZones()
}

function procedureLineText(procedure) {
  const line = procedure.solutie || procedure.correctMove || procedure.moves || ''
  if (Array.isArray(line)) return line.map((move) => tx(move) || String(move || '')).filter(Boolean).join(' ')
  return tx(line) || String(line || '')
}

function procedurePuzzleName(procedure) {
  const raw = String(tx(procedure.title) || '').replace(/^B\d+\.\s*/i, '').trim().toLowerCase()
  if (/ția$/i.test(raw)) return raw.replace(/ția$/i, 'ție')
  if (raw.endsWith('a')) return raw.slice(0, -1)
  return raw
}

function procedureAsk(procedure, fen) {
  const saved = tx(procedure.prompt) || tx(procedure.question)
  if (saved) return saved
  const side = sideName(sideToMove(fen || START_FEN))
  return t('pedagogy.procedureAsk', { side, name: procedurePuzzleName(procedure) })
}

function procedureGood(procedure) {
  return tx(procedure.ok) || t('pedagogy.procedureGood', { name: procedurePuzzleName(procedure) })
}

function procedureWrong(procedure) {
  return tx(procedure.bad) || t('pedagogy.procedureWrong', { name: procedurePuzzleName(procedure) })
}

function asksForPiece(text) {
  return /apasă\s+piesa|marchează\s+piesa/i.test(String(text || ''))
}

function readPosition(fen) {
  const text = String(fen || '').trim()
  if (!text) return null
  try {
    return new Chess(text)
  } catch {
    return null
  }
}

function matingPieceSquares(fen) {
  const chess = readPosition(fen)
  if (!chess) return []
  const checked = []
  if (chess.inCheck()) checked.push(chess)
  const parts = String(fen || '').trim().split(/\s+/)
  if (parts.length >= 2) {
    const flipped = parts.slice()
    flipped[1] = parts[1] === 'w' ? 'b' : 'w'
    const other = readPosition(flipped.join(' '))
    if (other?.inCheck()) checked.push(other)
  }
  const squares = new Set()
  for (const board of checked) {
    const side = board.turn()
    const enemy = side === 'w' ? 'b' : 'w'
    let king = ''
    for (const rank of board.board()) {
      for (const piece of rank) {
        if (piece?.type === 'k' && piece.color === side) king = piece.square
      }
    }
    const attackers = king && typeof board.attackers === 'function' ? board.attackers(king, enemy) : []
    if (Array.isArray(attackers)) {
      for (const square of attackers) squares.add(square)
    }
  }
  return [...squares]
}

function inferredPieceAccept(fen, prompt, source) {
  const token = String(source || '').trim().toLowerCase()
  if (/^[a-h][1-8]$/.test(token)) return (square) => square === token
  if (!/dă matul|da matul/i.test(prompt)) return null
  const squares = matingPieceSquares(fen)
  if (!squares.length) return null
  return (square) => squares.includes(square)
}

function finishRecognition(correct, bad, pieceClick) {
  const lead = correct
    ? t(pieceClick ? 'pedagogy.pieceFound' : 'pedagogy.moveSolved')
    : t('pedagogy.moveIncorrect')
  const detail = String(bad || '').trim()
  const text = !correct && detail && detail !== lead ? `${lead}\n${detail}` : lead
  showProcedureFeedback(correct ? 'ok' : 'bad', text)
  if (!correct) return
  procedureSolved = true
  paintProcedureNext(true)
  playExerciseEnd()
}

function showProcedureFeedback(kind, text) {
  const box = document.querySelector('#procedure-feedback')
  if (!box) return
  box.className = `procedure-feedback${kind ? ` ${kind}` : ''}`
  box.textContent = text || ''
  box.hidden = !text
}

function armProcedurePuzzle(procedure) {
  const source = procedureLineText(procedure)
  const fen = fenInput.value.trim()
  const ok = procedureGood(procedure)
  const bad = procedureWrong(procedure)
  const prompt = procedureAsk(procedure, fen)
  const pieceClick = asksForPiece(prompt)
  const line = pieceClick ? [] : (source ? startLine(fen, source, { ok, bad }) : [])
  const accept = typeof procedure.accept === 'function'
    ? procedure.accept
    : (pieceClick ? inferredPieceAccept(fen, prompt, source) : null)
  const recognition = pieceClick
    ? typeof accept === 'function'
    : (!line.length && (typeof accept === 'function' || procedure.choices?.length))
  if (recognition) {
    procedurePuzzle = false
    learnerSide = ''
    const item = {
      fen,
      prompt,
      accept,
      pieceClick,
      choices: pieceClick ? null : procedure.choices,
      answer: procedure.answer,
      mark: procedure.mark,
      ok,
      bad,
    }
    const grade = (correct, identified) => {
      finishRecognition(correct, bad, identified)
      if (!correct) armTask(item, grade)
    }
    armTask(item, grade)
    if (procedure.mark) markAsked(procedure.mark)
    interactive.showTargets = false
    return
  }
  learnerSide = sideToMove(fen)
  void engine.ready().catch((err) => {
    setStatus(err instanceof Error ? err.message : String(err))
  })
  if (!line.length) {
    procedurePuzzle = true
    task = null
    return
  }
  procedurePuzzle = true
  task = {
    expectMove: {
      san: line[0],
      ok,
      bad,
    },
  }
}

function procedureNotes(procedure) {
  const examples = (procedure.examples || []).map((item, index) => {
    const name = tx(item.title) || t('pedagogy.example', { n: index + 1 })
    const body = tx(item.text)
    return body ? `${index + 1}. ${name}\n${body}` : `${index + 1}. ${name}`
  })
  return [
    tx(procedure.method) ? `${t('pedagogy.courseMethod')}\n${tx(procedure.method)}` : '',
    examples.length ? `${t('pedagogy.courseExamples')}\n${examples.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n')
}

function closeProcedureCourse() {
  openProcedureId = ''
  procedurePuzzle = false
  procedureSolved = false
  learnerSide = ''
  practiceView = 'theory'
  practiceIndex = -1
  practiceEditId = ''
  for (const id of ['#practice-tabs', '#practice-list', '#practice-form', '#practice-child']) {
    const node = document.querySelector(id)
    if (node) node.hidden = true
  }
  const panel = document.querySelector('#procedure-course')
  const save = document.querySelector('#procedure-save')
  const analysis = document.querySelector('#analysis-fen')
  const entry = document.querySelector('#ed-form')
  if (panel) panel.hidden = true
  if (save) save.hidden = true
  const editorOwnsFen = isTeacherEditor() && entry && !entry.hidden
  if (analysis && !editorOwnsFen) analysis.hidden = false
  if (fenInput) fenInput.readOnly = false
  if (lessonEl) lessonEl.hidden = false
  syncBoardZones()
}

function readProcedureDraft() {
  return {
    definition: document.querySelector('#procedure-definition').value,
    fen: fenInput.value.trim(),
    prompt: document.querySelector('#procedure-prompt').value,
    solutie: document.querySelector('#procedure-line').value.trim(),
    bad: document.querySelector('#procedure-bad').value,
  }
}

function idleKingSquare(chess) {
  const idle = chess.turn() === 'w' ? 'b' : 'w'
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (piece?.type === 'k' && piece.color === idle) return piece.square
    }
  }
  return ''
}

function legalChessPosition(fen) {
  const text = String(fen || '').trim()
  if (!validateFen(text).ok) return false
  try {
    const chess = new Chess(text)
    const king = idleKingSquare(chess)
    if (!king || chess.isAttacked(king, chess.turn())) return false
    return true
  } catch {
    return false
  }
}

function warnIllegalFen() {
  const message = t('pedagogy.fenIllegal')
  setStatus(message)
  showProcedureFeedback('bad', message)
}

function clearSequenceWarning(id) {
  const node = document.querySelector(id)
  if (!node) return
  node.hidden = true
  node.textContent = ''
}

function warnIllegalSequence(id, move) {
  const message = t('pedagogy.moveIllegal', { move })
  const node = document.querySelector(id)
  if (node) {
    node.textContent = message
    node.hidden = false
  }
  setStatus(message)
  return message
}

function saveOpenProcedure({ toast, onlyIfChanged }) {
  if (!openProcedureId || role !== 'teacher' || practiceView !== 'theory') return false
  const draft = readProcedureDraft()
  const changed = draft.definition !== procedureBaseline.definition
    || draft.fen !== procedureBaseline.fen
    || draft.prompt !== procedureBaseline.prompt
    || draft.solutie !== procedureBaseline.solutie
    || draft.bad !== procedureBaseline.bad
  if (onlyIfChanged && !changed) return false
  if (draft.fen && !legalChessPosition(draft.fen)) {
    warnIllegalFen()
    return false
  }
  if (draft.solutie) {
    const illegal = illegalSequenceMove(draft.fen, draft.solutie)
    if (illegal) {
      warnIllegalSequence('#procedure-line-warn', illegal)
      return false
    }
  }
  clearSequenceWarning('#procedure-line-warn')
  const line = solutionMoves(draft.fen, draft.solutie)
  if (line.length) {
    draft.solutie = line.join(' ')
    const field = document.querySelector('#procedure-line')
    if (field) field.value = draft.solutie
  }
  const saved = saveProcedureCourse(openProcedureId, draft, procedureEditLang)
  if (!saved) saveLessonOverride(openProcedureId, draft, procedureEditLang)
  procedureBaseline = draft
  if (toast) showProcedureToast()
  return true
}

function measurableProbeLesson(index) {
  const probe = EXAM[index]
  if (!probe) return null
  const lesson = resolveInteractiveLesson('test', lessonCatalogs(), {
    title: lessonTitle('test'),
    code: 'T.08',
    fen: probe.fen,
    prompt: probe.prompt || '',
    definition: probe.prompt || '',
    bad: probe.bad || '',
    ok: probe.ok || '',
    accept: probe.accept,
    choices: probe.choices,
    answer: probe.answer,
    mark: probe.mark,
  })
  lesson.fen = probe.fen
  lesson.prompt = probe.prompt || ''
  lesson.ok = probe.ok || ''
  lesson.bad = probe.bad || ''
  lesson.accept = probe.accept
  lesson.choices = probe.choices || null
  lesson.answer = probe.answer
  lesson.mark = probe.mark || ''
  lesson.solutie = ''
  lesson.correctMove = ''
  return lesson
}

function showMeasurableProbe(index) {
  const lesson = measurableProbeLesson(index)
  if (!lesson) return false
  curriculumLessonId = 'test'
  showProcedureCourse(lesson)
  examProbeIndex = index
  const position = `${index + 1}/${EXAM.length}`
  badge.textContent = position
  activityTitle.textContent = t('exam.title', { index: index + 1 })
  const ask = document.querySelector('#procedure-ask')
  const readDefinition = document.querySelector('#procedure-read-definition')
  const prompt = lesson.prompt
  if (ask) ask.textContent = prompt
  if (readDefinition) readDefinition.textContent = prompt
  engineLine.textContent = ''
  return true
}

function clearProbeBoard() {
  interactive.lastMove = null
  interactive.clearSelection()
  for (const cell of boardEl.querySelectorAll('.square')) {
    cell.classList.remove('asked', 'selected', 'target', 'moved')
  }
  showProcedureFeedback('', '')
  resultEl.replaceChildren()
  engineLine.textContent = ''
}

function finishMeasurableTest() {
  const place = themeForLesson('test')
  const level = getLevels().find((item) => item.id === place?.levelId)
  const sub = level?.subchapters?.find((item) => item.id === place?.subId)
  examProbeIndex = -1
  const next = document.querySelector('#procedure-next')
  if (next) next.disabled = true
  clearProbeBoard()
  clearTask()
  markLessonDone('test')
  if (!level || !sub) return
  panelTitle.textContent = tx(level.title)
  activityTitle.textContent = tx(sub.title)
  openPedagogy(document.querySelector('#levels'), level, sub, {
    ...studentPlayHooks(),
    startStep: pedagogyStep('learn'),
  })
}

function advanceMeasurableProbe() {
  if (examProbeIndex < 0 || !procedureSolved) return false
  if ((openProcedureId || curriculumLessonId) !== 'test') return false
  if (practiceIndex >= 0) return false
  const nextIndex = examProbeIndex + 1
  if (nextIndex >= EXAM.length) {
    finishMeasurableTest()
    return true
  }
  return showMeasurableProbe(nextIndex)
}

function advanceProcedure() {
  if (advanceMeasurableProbe()) return
  const items = listPracticeExercises(openProcedureId)
  if (practiceIndex >= 0 && practiceIndex + 1 < items.length) {
    showThemePractice(practiceIndex + 1)
    return
  }
  if (practiceIndex < 0 && items.length) {
    showThemePractice(0)
    return
  }
  const next = nextModuleLesson()
  if (next) {
    loadModule(next)
    return
  }
  const home = procedureHome(openProcedureId)
  if (!home?.level || !home?.sub) return
  openPedagogy(
    document.querySelector('#levels'),
    home.level,
    home.sub,
    { ...studentPlayHooks(), startStep: pedagogyStep('remediation') },
  )
}

function showProcedureToast(message) {
  const toast = document.querySelector('#toast')
  if (!toast) return
  toast.textContent = message || t('pedagogy.procedureUpdated')
  toast.hidden = false
  clearTimeout(procedureToastTimer)
  procedureToastTimer = setTimeout(() => {
    toast.hidden = true
  }, 2800)
}

function practiceNextLabel() {
  const items = openProcedureId ? listPracticeExercises(openProcedureId) : []
  if (!items.length) return t('pedagogy.procedureNext')
  if (practiceIndex < 0) return t('pedagogy.practiceGo', { n: 1 })
  if (practiceIndex + 1 < items.length) return t('pedagogy.practiceGo', { n: practiceIndex + 2 })
  return t('pedagogy.procedureNext')
}

function paintProcedureNext(enabled) {
  const next = document.querySelector('#procedure-next')
  if (!next) return
  next.textContent = practiceNextLabel()
  if (typeof enabled === 'boolean') next.disabled = !enabled
}

function syncPracticeChrome() {
  const tabs = document.querySelector('#practice-tabs')
  const child = role === 'child'
  if (tabs) tabs.hidden = child || !openProcedureId
  document.querySelector('#practice-tab-theory')?.classList.toggle('active', practiceView === 'theory')
  document.querySelector('#practice-tab-list')?.classList.toggle('active', practiceView === 'list')
  const list = document.querySelector('#practice-list')
  if (list) list.hidden = child || practiceView !== 'list'
  if (!child && practiceView === 'list') renderPracticeList()
  else {
    const form = document.querySelector('#practice-form')
    if (form && practiceView !== 'list') form.hidden = true
  }
  renderPracticeChild()
  paintProcedureNext(false)
}

function renderPracticeChild() {
  const box = document.querySelector('#practice-child')
  const host = document.querySelector('#practice-child-buttons')
  const back = document.querySelector('#practice-back')
  if (!box || !host) return
  const items = role === 'child' && openProcedureId ? listPracticeExercises(openProcedureId) : []
  if (!items.length) {
    host.replaceChildren()
    box.hidden = true
    return
  }
  box.hidden = false
  if (back) back.hidden = practiceIndex < 0
  host.replaceChildren()
  items.forEach((item, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = practiceIndex < 0 && index === 0
      ? t('pedagogy.practiceGo', { n: 1 })
      : t('pedagogy.practiceItem', { n: index + 1 })
    button.title = tx(item.title)
    button.classList.toggle('active', index === practiceIndex)
    button.addEventListener('click', () => showThemePractice(index))
    host.append(button)
  })
}

function renderPracticeList() {
  const host = document.querySelector('#practice-items')
  const empty = document.querySelector('#practice-empty')
  if (!host) return
  const items = listPracticeExercises(openProcedureId)
  if (empty) empty.hidden = items.length > 0
  host.replaceChildren()
  items.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'practice-item'
    const illegal = item.type !== 'grid' && !legalChessPosition(item.fen)
    if (illegal) row.classList.add('is-illegal')
    const text = document.createElement('div')
    text.className = 'practice-copy'
    const title = document.createElement('strong')
    title.textContent = `${index + 1}. ${tx(item.title)}`
    const meta = document.createElement('span')
    meta.textContent = item.type === 'grid' ? t('pedagogy.practiceGrid') : (formatSolution(item.solutie) || item.fen)
    text.append(title, meta)
    if (illegal) {
      const warn = document.createElement('span')
      warn.className = 'practice-illegal'
      warn.textContent = t('pedagogy.fenIllegal')
      text.append(warn)
    }
    const actions = document.createElement('div')
    actions.className = 'practice-actions'
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.textContent = t('pedagogy.practiceOpen')
    edit.hidden = item.type === 'grid'
    edit.addEventListener('click', () => openPracticeForm(item))
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'practice-remove'
    remove.textContent = t('pedagogy.practiceRemove')
    remove.addEventListener('click', () => confirmDeletePractice(item.id))
    actions.append(edit, remove)
    row.append(text, actions)
    host.append(row)
  })
}

function showPracticeTab(view) {
  if (role !== 'teacher' || !openProcedureId) return
  practiceView = view
  const theory = view === 'theory'
  for (const field of document.querySelectorAll('#procedure-course .procedure-edit')) field.hidden = !theory
  const notes = document.querySelector('#procedure-rest')
  if (notes) notes.hidden = !theory || !notes.textContent
  const analysis = document.querySelector('#analysis-fen')
  const save = document.querySelector('#procedure-save')
  if (analysis) analysis.hidden = !theory
  if (save) save.hidden = !theory
  const form = document.querySelector('#practice-form')
  if (theory && form) form.hidden = true
  syncPracticeChrome()
}

function openPracticeForm(item) {
  const form = document.querySelector('#practice-form')
  if (!form) return
  practiceEditId = item?.id || ''
  document.querySelector('#practice-title').value = item?.title || ''
  document.querySelector('#practice-fen').value = item?.fen || fenInput.value.trim()
  document.querySelector('#practice-line').value = formatSolution(item?.solutie)
  document.querySelector('#practice-bad').value = item?.bad || ''
  clearSequenceWarning('#practice-line-warn')
  document.querySelector('#practice-delete').hidden = !practiceEditId
  document.querySelector('#practice-save').textContent = practiceEditId
    ? t('pedagogy.practiceUpdate')
    : t('pedagogy.practiceSave')
  form.hidden = false
  previewPracticeFen()
}

function savePracticeForm(event) {
  event.preventDefault()
  if (!openProcedureId || role !== 'teacher') return
  const title = document.querySelector('#practice-title').value.trim()
  const fen = document.querySelector('#practice-fen').value.trim()
  if (!title) {
    setStatus(t('pedagogy.practiceNeedTitle'))
    return
  }
  if (!legalChessPosition(fen)) {
    warnIllegalFen()
    renderPracticeList()
    return
  }
  const solutie = document.querySelector('#practice-line').value.trim()
  const illegal = illegalSequenceMove(fen, solutie)
  if (illegal) {
    warnIllegalSequence('#practice-line-warn', illegal)
    return
  }
  clearSequenceWarning('#practice-line-warn')
  const editing = Boolean(practiceEditId)
  savePracticeExercise(openProcedureId, {
    id: practiceEditId,
    title,
    fen,
    solutie,
    bad: document.querySelector('#practice-bad').value.trim(),
  })
  practiceEditId = ''
  document.querySelector('#practice-form').hidden = true
  renderPracticeList()
  showProcedureToast(t(editing ? 'pedagogy.procedureUpdated' : 'pedagogy.practiceSaved'))
  setStatus('')
}

function practiceFormOpen() {
  const form = document.querySelector('#practice-form')
  return Boolean(form && !form.hidden && practiceView === 'list')
}

function syncPracticeFenFromBoard() {
  if (!practiceFormOpen()) return
  const field = document.querySelector('#practice-fen')
  if (field) field.value = fenInput.value.trim()
}

function previewPracticeFen() {
  const fen = document.querySelector('#practice-fen')?.value.trim()
  if (!fen || !validateFen(fen).ok || fen === fenInput.value.trim()) return
  fenInput.value = fen
  interactive.lastMove = null
  drawBoard()
}

function confirmDeletePractice(id) {
  if (!id || !openProcedureId) return
  if (!window.confirm(t('pedagogy.practiceConfirm'))) return
  deletePracticeExercise(openProcedureId, id)
  if (practiceEditId === id) {
    practiceEditId = ''
    const form = document.querySelector('#practice-form')
    if (form) form.hidden = true
  }
  renderPracticeList()
}

function showThemePractice(index) {
  const themeId = openProcedureId
  const items = listPracticeExercises(themeId)
  const item = items[index]
  if (!item || role !== 'child') return
  cancelReply()
  hideSuccess()
  resetLine()
  task = null
  practiceIndex = index
  practiceView = 'play'
  procedureSolved = false
  procedurePuzzle = false
  learnerSide = ''
  if (item.type !== 'grid') fenInput.value = item.fen || START_FEN
  fenInput.readOnly = true
  drawBoard()
  interactive.lastMove = null
  interactive.draggable = item.type !== 'grid'
  interactive.showTargets = item.type !== 'grid'
  document.querySelector('#procedure-ask').textContent = tx(item.title)
  document.querySelector('#procedure-ask').hidden = false
  document.querySelector('#procedure-read-definition').textContent = t('pedagogy.practiceItem', { n: index + 1 })
  document.querySelector('#procedure-read-rest').hidden = true
  document.querySelector('#procedure-read').hidden = false
  for (const field of document.querySelectorAll('#procedure-course .procedure-edit')) field.hidden = true
  const notes = document.querySelector('#procedure-rest')
  if (notes) notes.hidden = true
  showProcedureFeedback('', '')
  const next = document.querySelector('#procedure-next')
  if (next) next.hidden = false
  paintProcedureNext(false)
  const analysis = document.querySelector('#analysis-fen')
  if (analysis) analysis.hidden = true
  const tabs = document.querySelector('#practice-tabs')
  if (tabs) tabs.hidden = true
  const list = document.querySelector('#practice-list')
  if (list) list.hidden = true
  renderPracticeChild()
  if (item.type === 'grid') {
    showPracticeGrid(item)
    setStatus('')
    return
  }
  hidePracticeGrid()
  armProcedurePuzzle({
    id: themeId,
    title: item.title,
    prompt: item.title,
    fen: item.fen,
    solutie: item.solutie,
    bad: item.bad,
  })
  if (!formatSolution(item.solutie)) paintProcedureNext(true)
  setStatus('')
}

function hidePracticeGrid() {
  const form = document.querySelector('#practice-grid')
  if (form) form.hidden = true
}

function showPracticeGrid(item) {
  const form = document.querySelector('#practice-grid')
  const host = document.querySelector('#practice-grid-options')
  if (!form || !host) return
  form.hidden = false
  form.dataset.accept = item.accept || 'exact'
  form.dataset.correct = item.correct.join(',')
  form.dataset.ok = tx(item.ok)
  form.dataset.bad = tx(item.bad)
  host.replaceChildren()
  for (const choice of item.choices) {
    const label = document.createElement('label')
    label.className = 'practice-option'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.value = choice.id
    const text = document.createElement('span')
    text.textContent = tx(choice.label)
    label.append(input, text)
    host.append(label)
  }
  const check = document.querySelector('#practice-grid-check')
  if (check) check.disabled = false
}

function checkPracticeGrid(event) {
  event.preventDefault()
  const form = document.querySelector('#practice-grid')
  if (!form || form.hidden || role !== 'child') return
  const correct = new Set((form.dataset.correct || '').split(',').filter(Boolean))
  const selectedAnswers = [...form.querySelectorAll('input:checked')].map((input) => input.value)
  const any = form.dataset.accept === 'any'
  const hit = selectedAnswers.length > 0
    && selectedAnswers.every((id) => correct.has(id))
    && (any || selectedAnswers.length === correct.size)
  for (const label of form.querySelectorAll('.practice-option')) {
    const input = label.querySelector('input')
    label.classList.toggle('is-correct', hit && correct.has(input.value))
    label.classList.toggle('is-wrong', !hit && input.checked && !correct.has(input.value))
  }
  showProcedureFeedback(hit ? 'ok' : 'bad', hit ? form.dataset.ok : form.dataset.bad)
  if (!hit) return
  for (const input of form.querySelectorAll('input')) input.disabled = true
  const check = document.querySelector('#practice-grid-check')
  if (check) check.disabled = true
  procedureSolved = true
  paintProcedureNext(true)
  playExerciseEnd()
}

function returnToThemeLesson() {
  const id = openProcedureId || curriculumLessonId
  if (!id) return
  showProcedureCourse(resolveInteractiveLesson(id, lessonCatalogs(), {
    title: lessonTitle(id),
  }))
}

function showTeacherDiagram(target) {
  clearTask()
  demoLine = Boolean(target.demo)
  closeLevels()
  curriculumLessonId = null
  showSavedAnnotations(target.annotations)
  const wantWhite = target.orientation !== 'black'
  if (target.orientation && interactive.whiteAtBottom !== wantWhite) interactive.flip()
  if (target.fen) showPosition(target.fen)
  else if (target.pgn) {
    try {
      const chess = new Chess()
      chess.loadPgn(target.pgn)
      fenInput.value = chess.fen()
    } catch {
      fenInput.value = fenInput.value
    }
  }
  drawBoard()
  if (target.text) lessonEl.textContent = target.text
  const line = startLine(fenInput.value, solutionSource(fenInput.value, target), target)
  if (demoLine) {
    learnerSide = ''
    task = null
    interactive.showTargets = false
  } else {
  const student = role === 'child' || document.body.classList.contains('student')
  learnerSide = student && line.length ? sideToMove(fenInput.value) : ''
  if (line.length) {
    const testing = Boolean(target.testing)
    const training = Boolean(target.training) && !testing
    interactive.showTargets = true
    task = {
      expectMove: {
        san: line[currentStepIndex] || line[0],
        ok: testing ? t('pedagogy.testPass') : (training ? t('pedagogy.moveSolved') : (target.text || target.ok || t('status.correct'))),
        bad: testing || training ? t('pedagogy.tryAgain') : (target.bad || target.text || t('status.retry')),
        training,
        testing,
        maxAttempts: target.maxAttempts,
        timeLimitSec: target.timeLimitSec,
        scoreWeight: target.scoreWeight,
      },
    }
    if (testing) beginTest(target, fenInput.value, line)
    else clearTestRun()
  } else clearTestRun()
  }
  beginNarrative(target)
}

function beginNarrative(target) {
  const spec = practiceOf(target)
  const startFen = target.fen || currentFen()
  practiceGate = spec ? { spec, fen: startFen, open: false, solved: false } : null
  const notes = {
    arrows: (target.annotations?.arrows || []).map((arrow) => ({ ...arrow })),
    highlights: (target.annotations?.highlights || []).map((mark) => ({ ...mark })),
  }
  if (spec) {
    demoLine = true
    interactive.draggable = false
    interactive.showTargets = false
  }
  const narrative = playNarrative(target, {
    soundOn: isSoundOn(),
    onState: setAvatarState,
    onMouth: setAvatarMouth,
    onCaption: setAvatarCaption,
    onFinish: () => openPractice(),
    onAction: (cue) => {
      if (cue.action === 'highlight' && cue.target) {
        notes.highlights.push({ square: cue.target, color: 'yellow', type: 'circle-ring' })
      } else if (cue.action === 'draw_arrow' && cue.from && cue.to) {
        notes.arrows.push({ start: cue.from, end: cue.to, color: 'red' })
      }
      showSavedAnnotations(notes)
      if (cue.action === 'move_piece' && cue.from && cue.to) {
        try {
          const chess = new Chess(currentFen())
          const played = chess.move({ from: cue.from, to: cue.to, promotion: 'q' })
          if (played) commitPlayed(played)
        } catch {
          return
        }
      }
    },
  })
  if (spec && !narrative.timeline.length) openPractice()
}

function openPractice() {
  const gate = practiceGate
  if (!gate || gate.open) return
  gate.open = true
  demoLine = false
  task = null
  showSavedAnnotations({ arrows: [], highlights: [] })
  if (gate.fen) showPosition(gate.fen)
  interactive.draggable = true
  interactive.showTargets = true
  interactive.clearSelection()
  const prompt = tx(gate.spec.promptText) || tx(gate.spec.title)
  setAvatarState('idle')
  setAvatarCaption(prompt)
  if (lessonEl) {
    lessonEl.hidden = false
    lessonEl.textContent = prompt
  }
  setStatus(prompt)
}

function playPracticeSquare(square) {
  const chess = positionChess()
  if (!interactive.selected) {
    const piece = chess?.get(square)
    if (!piece || !chess || piece.color !== chess.turn()) return
    interactive.showTargets = true
    markSelected(square)
    return
  }
  if (interactive.selected === square) {
    interactive.clearSelection()
    return
  }
  const from = interactive.selected
  interactive.clearSelection()
  gradePracticeMove(chess, from, square)
}

function gradePracticeMove(chess, from, to) {
  const spec = practiceGate?.spec
  if (!spec || !chess) return
  const piece = chess.get(from)
  const promotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined
  let played = null
  try {
    played = chess.move({ from, to, promotion })
  } catch {
    played = null
  }
  if (!played) {
    showCheer('again')
    setStatus(t('status.notLegal'))
    return
  }
  if (!matchesTarget(played, spec)) {
    showPracticeFeedback(spec, false)
    return
  }
  commitPlayed(played)
  practiceGate.solved = true
  interactive.draggable = false
  interactive.showTargets = false
  showPracticeFeedback(spec, true)
}

function showPracticeFeedback(spec, correct) {
  const beat = correct ? spec.feedback.correct : spec.feedback.wrong
  const hint = spec.hint
  const text = tx(beat.text)
  setAvatarState(correct ? beat.avatarState : (hint?.avatarState || beat.avatarState))
  setAvatarCaption(text)
  if (lessonEl) {
    lessonEl.hidden = false
    lessonEl.textContent = hint && !correct && tx(hint.text) ? `${text}\n${tx(hint.text)}` : text
  }
  if (correct) {
    showCheer('ok', text, 4200)
    showSavedAnnotations({
      arrows: [{ start: spec.targetMove.from, end: spec.targetMove.to, color: 'green' }],
      highlights: [],
    })
  } else {
    showCheer('again', text, 4200)
    showSavedAnnotations({
      arrows: [],
      highlights: hint?.highlightSquare ? [{ square: hint.highlightSquare, color: 'yellow', type: 'circle-ring' }] : [],
    })
  }
  playPracticeClip(beat.audioUrl, correct)
}

function playPracticeClip(url, correct) {
  if (!isSoundOn()) return
  if (!url) {
    if (correct) playEffect('success')
    return
  }
  const clip = new Audio(url)
  const fallback = () => { if (correct) playEffect('success') }
  clip.addEventListener('error', fallback, { once: true })
  const played = clip.play()
  if (played && typeof played.catch === 'function') played.catch(fallback)
}

function onSquare(square) {
  if (isPlaying) stopAutoPlay()
  if (testRun?.finished) {
    interactive.clearSelection()
    return
  }
  if (handlePiecePathSquare(square)) return
  if (replyLock) return
  if (procedureSolved) {
    interactive.clearSelection()
    return
  }
  if (isTeacherEditor() && editorSquare(square)) return
  if (practiceGate) {
    if (!practiceGate.open || practiceGate.solved) {
      interactive.clearSelection()
      drawBoard()
      return
    }
    playPracticeSquare(square)
    return
  }
  if (demoLine) {
    interactive.clearSelection()
    drawBoard()
    return
  }
  if (browsingHistory()) {
    returnToLive()
    return
  }
  if (train?.setup) {
    nudgePosition(square)
    return
  }
  if (train && !train.over && train.kind === 'game') {
    playGameSquare(square)
    return
  }
  if (train && !train.over && (train.kind === 'quest' || train.kind === 'puzzle')) {
    playGradedSquare(square)
    return
  }
  if (openProcedureId && role === 'teacher') {
    playTeacherBoardMove(square)
    return
  }
  if (task) {
    handleLessonSquare(square)
    return
  }
  if (solving()) {
    placeSolverMove(square)
    return
  }
  if (busy) return
  const check = validateFen(currentFen())
  if (!check.ok) return
  const chess = new Chess(currentFen())

  if (!interactive.selected) {
    const piece = chess.get(square)
    if (!piece || piece.color !== chess.turn()) return
    markSelected(square)
    return
  }

  if (interactive.selected === square) {
    interactive.clearSelection()
    return
  }

  const from = interactive.selected
  interactive.clearSelection()
  if (studentPlay()) {
    playStudentMove(from, square)
    return
  }
  moveInput.value = from + square
  evaluate()
}

interactive.onSquare = onSquare
interactive.canDrag = (square) => {
  if (practiceGate && (!practiceGate.open || practiceGate.solved)) return false
  if (piecePathActive()) return piecePathCanDrag(square)
  if (replyLock || procedureSolved || task?.pieceClick) return false
  if (role !== 'child' || !learnerSide) return true
  const chess = positionChess()
  if (chess && chess.turn() !== learnerSide) return false
  const piece = chess?.get(square)
  return Boolean(piece && piece.color === learnerSide)
}
interactive.onDrop = ({ from, to, remove }) => {
  if (isTeacherEditor()) {
    if (remove) editorRemove(from)
    else editorMove(from, to)
    return
  }
  if (!interactive.draggable) return
  interactive.selected = from
  onSquare(to)
}

let cheerTimer = 0

function showCheer(kind, message, duration = 2400) {
  const list = tList(kind === 'ok' ? 'cheer.ok' : 'cheer.again')
  const text = message || (list.length ? list[Math.floor(Math.random() * list.length)] : '')
  if (!text) return
  const banner = document.querySelector('#cheer')
  banner.textContent = text
  banner.className = `cheer ${kind === 'ok' ? 'ok' : 'again'}`
  banner.hidden = false
  banner.style.animation = 'none'
  void banner.offsetWidth
  banner.style.animation = ''
  clearTimeout(cheerTimer)
  cheerTimer = setTimeout(() => {
    banner.hidden = true
  }, duration)
}

function positionChess() {
  try {
    return new Chess(currentFen())
  } catch {
    return null
  }
}

function blockForeign(piece) {
  if (role !== 'child' || !learnerSide || !piece || piece.color === learnerSide) return false
  interactive.clearSelection()
  setStatus(t('status.toMove', { side: sideName(learnerSide) }))
  return true
}

function handleLessonSquare(square) {
  if (task?.pieceClick) {
    submitPieceClick(square)
    return
  }
  const chess = positionChess()
  if (!interactive.selected) {
    const piece = chess?.get(square)
    if (blockForeign(piece)) return
    if (piece && piece.color === chess.turn() && !(task.accept && task.accept(square))) {
      interactive.showTargets = true
      markSelected(square)
      return
    }
    if (piece && chess && piece.color !== chess.turn()) {
      if (task?.accept) {
        submitLessonSquare(square)
        return
      }
      setStatus(t('status.toMove', { side: sideName(chess.turn()) }))
      return
    }
    submitLessonSquare(square)
    return
  }
  if (interactive.selected === square) {
    interactive.clearSelection()
    return
  }
  const from = interactive.selected
  interactive.clearSelection()
  playLessonMove(chess, from, square)
}

function submitPieceClick(square) {
  if (!task?.pieceClick || typeof task.accept !== 'function') return
  const correct = Boolean(task.accept(square))
  const grade = task.grade
  interactive.clearSelection()
  if (!correct) {
    grade?.(false, true)
    return
  }
  task = { accept: null }
  markAsked(square)
  grade?.(true, true)
}

function submitLessonSquare(square) {
  if (task?.expectMove) {
    const chess = positionChess()
    const hits = chess ? chess.moves({ verbose: true }).filter((move) => move.to === square) : []
    if (hits.length === 1) {
      playLessonMove(chess, hits[0].from, square)
      return
    }
    showCheer('again')
    setStatus(t('status.notLegal'))
    return
  }
  if (task?.accept) {
    const correct = task.accept(square)
    const grade = task.grade
    if (correct) revealMove(square)
    task = { accept: null }
    grade(correct)
    return
  }
  if (task?.collect) task.collect(square)
}

function playLessonMove(chess, from, to) {
  if (replyLock) return
  if (task?.pieceClick) {
    submitPieceClick(to)
    return
  }
  if (!chess) {
    submitLessonSquare(to)
    return
  }
  const piece = chess.get(from)
  if (blockForeign(piece)) return
  if (piece && piece.color !== chess.turn()) {
    setStatus(t('status.toMove', { side: sideName(chess.turn()) }))
    return
  }
  const promotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined
  let played
  try {
    played = chess.move({ from, to, promotion })
  } catch {
    if (task?.expectMove) {
      showCheer('again')
      setStatus(t('status.notLegal'))
      return
    }
    submitLessonSquare(to)
    return
  }
  if (task?.expectMove || solutie.length) {
    const item = task?.expectMove
    if (!solutie.length) startLine(played.before || currentFen(), [item.san], item)
    const expected = solutie[currentStepIndex]
    const correct = moveMatches(played, expected) || (currentStepIndex === 0 && Boolean(task?.accept?.(played.to)))
    if (!correct) {
      rejectLineMove(item)
      return
    }
    acceptSolvedMove(played, item)
    return
  }
  if (task?.accept) {
    const correct = task.accept(to)
    const grade = task.grade
    if (correct) {
      fenInput.value = played.after
      interactive.lastMove = { from: played.from, to: played.to }
      drawBoard()
      playMoveEffect(played)
    }
    task = { accept: null }
    grade(correct)
    return
  }
  if (task?.collect) task.collect(to)
}

function revealMove(square) {
  const chess = positionChess()
  if (!chess) return
  const hits = chess.moves({ verbose: true }).filter((move) => move.to === square)
  if (hits.length !== 1) return
  const played = chess.move(hits[0])
  fenInput.value = chess.fen()
  interactive.lastMove = { from: played.from, to: played.to }
  drawBoard()
  playMoveEffect(played)
}

function pgnLine(fen, pgn) {
  if (!pgn) return []
  try {
    const game = new Chess()
    game.loadPgn(pgn)
    const history = game.history({ verbose: true })
    const placement = String(fen || '').split(' ')[0]
    const side = sideToMove(fen)
    const start = history.findIndex((move) => {
      const parts = String(move.before || '').split(' ')
      const turn = parts[1] === 'b' ? 'b' : 'w'
      return parts[0] === placement && turn === side
    })
    if (start < 0) return []
    return history.slice(start).map((move) => move.san).filter(Boolean)
  } catch {
    return []
  }
}

function lineFrom(fen, pgn, correctMove) {
  const fromText = solutionMoves(fen, correctMove)
  const fromPgn = solutionMoves(fen, pgnLine(fen, pgn).join(' '))
  if (fromText.length > 1) return fromText
  if (fromText.length === 1 && fromPgn.length > 1 && fromPgn[0] === fromText[0]) return fromPgn
  if (fromText.length) return fromText
  const raw = Array.isArray(correctMove) ? String(correctMove[0] || '').trim() : String(correctMove || '').trim()
  return raw && !fromPgn.length ? [raw] : fromPgn
}

function normalizeSolution(fen, source) {
  if (Array.isArray(source) && source.length) {
    const replayed = solutionMoves(fen, source)
    return replayed.length >= source.length ? replayed : source.map((move) => String(move || '').trim()).filter(Boolean)
  }
  const replayed = solutionMoves(fen, source)
  if (replayed.length) return replayed
  const raw = String(source || '').trim()
  return raw ? [raw] : []
}

function solutionSource(fen, target) {
  const explicit = Array.isArray(target?.testSolutionMoves) && target.testSolutionMoves.length
    ? target.testSolutionMoves
    : Array.isArray(target?.solutionMoves) && target.solutionMoves.length
    ? target.solutionMoves
    : (target?.solutie || target?.moves || target?.correctMove || '')
  const textLine = normalizeSolution(fen, explicit)
  const pgnMoves = solutionMoves(fen, pgnLine(fen, target?.pgn).join(' '))
  if (textLine.length > 1) return textLine
  if (textLine.length === 1 && pgnMoves.length > 1 && pgnMoves[0] === textLine[0]) return pgnMoves
  if (textLine.length) return textLine
  return pgnMoves
}

function startLine(fen, source, item) {
  cancelReply()
  const line = normalizeSolution(fen, source)
  solutie = line
  currentStepIndex = 0
  stepFen = fen
  lineAttempts = Number(item?.attempts || item?.maxAttempts || 3)
  continuation = line.slice()
  if (line.length) publishLine(fen, line, false)
  return line
}

function resetLine() {
  cancelReply()
  solutie = []
  currentStepIndex = 0
  stepFen = ''
  lineAttempts = 3
  continuation = []
  endTestClock()
  testRun = null
  hideTestSummary()
}

function restoreStep() {
  interactive.clearSelection()
  if (stepFen) fenInput.value = stepFen
  drawBoard()
}

function mistakeText(item) {
  const lead = t('pedagogy.moveIncorrect')
  const detail = String(item?.bad || '').trim()
  if (!detail || detail === lead || detail === t('status.retry')) return lead
  const procedure = procedurePuzzle ? procedureLesson(openProcedureId) : null
  const generic = procedure ? t('pedagogy.procedureWrong', { name: procedurePuzzleName(procedure) }) : ''
  if (generic && detail === generic) return lead
  return `${lead}\n${detail}`
}

function rejectLineMove(item) {
  if (item?.testing) {
    restoreStep()
    hideSuccess()
    if (testRun) testRun.wrong += 1
    lineAttempts -= 1
    const text = t('pedagogy.tryAgain')
    showCheer('again', text)
    if (lineAttempts <= 0) {
      completeTest(false)
      return
    }
    setStatus(text)
    return
  }
  if (item?.training) {
    restoreStep()
    hideSuccess()
    const text = t('pedagogy.tryAgain')
    showCheer('again', text)
    setStatus(text)
    return
  }
  if (role === 'child' && (procedurePuzzle || learnerSide)) {
    restoreStep()
    hideSuccess()
    const text = mistakeText(item)
    if (procedurePuzzle) {
      showProcedureFeedback('bad', text)
      return
    }
    lineAttempts -= 1
    showCheer('again', text)
    if (lineAttempts <= 0) {
      noteSessionResult(false)
      task = null
      setStatus(t('attempt.closed'))
      return
    }
    setStatus(text)
    return
  }
  if (procedurePuzzle) {
    restoreStep()
    hideSuccess()
    showProcedureFeedback('bad', item?.bad || t('status.retry'))
    return
  }
  lineAttempts -= 1
  restoreStep()
  hideSuccess()
  const hint = item?.bad || t('status.retry')
  showCheer('again', hint)
  if (lineAttempts <= 0) {
    noteSessionResult(false)
    task = null
    setStatus(t('attempt.closed'))
    return
  }
  setStatus(lineAttempts === 1 ? t('attempt.one') : t('attempt.left', { left: lineAttempts }))
}

function formatTestTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function testPercent(wrong, maxAttempts, solved) {
  const max = Math.max(1, Number(maxAttempts) || 1)
  if (!solved) return 0
  return Math.round(100 * Math.max(0, max - wrong) / max)
}

function endTestClock() {
  if (testRun?.timer) clearInterval(testRun.timer)
  if (testRun) testRun.timer = 0
}

function clearTestRun() {
  endTestClock()
  testRun = null
  hideTestSummary()
}

function hideTestSummary() {
  const box = document.querySelector('#test-summary')
  if (box) box.hidden = true
  testSummary = null
}

function paintTestSummary() {
  if (!testSummary) return
  const lead = document.querySelector('#test-summary-lead')
  const score = document.querySelector('#test-summary-score')
  const meta = document.querySelector('#test-summary-meta')
  const weight = document.querySelector('#test-summary-weight')
  if (lead) lead.textContent = t(testSummary.solved ? 'pedagogy.testPass' : 'pedagogy.testFail')
  if (score) score.textContent = t('pedagogy.testScore', { score: testSummary.score })
  if (meta) meta.textContent = t('pedagogy.testMeta', { wrong: testSummary.wrong, time: formatTestTime(testSummary.elapsed) })
  if (weight) {
    const show = testSummary.weight !== 1
    weight.hidden = !show
    if (show) {
      const points = Math.round(testSummary.score * testSummary.weight) / 100
      weight.textContent = t('pedagogy.testWeight', { weight: testSummary.weight, points })
    }
  }
}

function showTestSummary(summary) {
  testSummary = summary
  const box = document.querySelector('#test-summary')
  if (box) box.hidden = false
  paintTestSummary()
}

function tickTestClock() {
  if (!testRun || testRun.finished) return
  const left = testRun.timeLimitSec - (performance.now() - testRun.started) / 1000
  if (left <= 0) {
    completeTest(false)
    return
  }
  const cheer = document.querySelector('#cheer')
  if (!cheer || cheer.hidden) setStatus(t('pedagogy.testTime', { time: formatTestTime(left) }))
}

function beginTest(target, fen, moves) {
  endTestClock()
  hideTestSummary()
  testRun = {
    fen,
    moves: moves.slice(),
    maxAttempts: Math.max(1, Number(target?.maxAttempts) || 3),
    timeLimitSec: Math.max(0, Number(target?.timeLimitSec) || 0),
    scoreWeight: Math.max(1, Number(target?.scoreWeight) || 1),
    wrong: 0,
    started: performance.now(),
    timer: 0,
    finished: false,
  }
  if (testRun.timeLimitSec > 0) testRun.timer = setInterval(tickTestClock, 250)
}

function completeTest(solved) {
  if (!testRun || testRun.finished) return
  testRun.finished = true
  endTestClock()
  cancelReply()
  replyLock = false
  const elapsed = Math.max(0, Math.round((performance.now() - testRun.started) / 1000))
  const score = testPercent(testRun.wrong, testRun.maxAttempts, solved)
  task = null
  if (solved) playExerciseEnd()
  showTestSummary({
    score,
    wrong: testRun.wrong,
    elapsed,
    weight: testRun.scoreWeight,
    solved,
  })
  setStatus(t(solved ? 'pedagogy.testPass' : 'pedagogy.testFail'))
}

function retryTest() {
  if (!testRun) return
  const spec = testRun
  hideTestSummary()
  showPosition(spec.fen)
  const line = startLine(spec.fen, spec.moves, { maxAttempts: spec.maxAttempts })
  learnerSide = line.length ? sideToMove(spec.fen) : ''
  task = {
    expectMove: {
      san: line[0] || '',
      ok: t('pedagogy.testPass'),
      bad: t('pedagogy.tryAgain'),
      training: false,
      testing: true,
      maxAttempts: spec.maxAttempts,
      timeLimitSec: spec.timeLimitSec,
      scoreWeight: spec.scoreWeight,
    },
  }
  beginTest(spec, spec.fen, line)
}

function finishTestLesson() {
  const solved = Boolean(testSummary?.solved)
  hideTestSummary()
  clearTestRun()
  noteSessionResult(solved)
  showPedagogyReturn(false)
  resumePedagogy()
}

function finishLine(item) {
  if (item?.testing) {
    completeTest(true)
    return
  }
  task = null
  solutie = []
  currentStepIndex = 0
  playExerciseEnd()
  showTaskFeedback(true, {
    ok: item?.ok || t('status.correct'),
    bad: item?.bad || t('status.retry'),
    training: Boolean(item?.training),
  })
}

function cancelReply() {
  clearTimeout(replyTimer)
  replyTimer = 0
  replyLock = false
  replyEpoch += 1
  stopMotorPulse()
}

let motorPulse = 0

function stopMotorPulse() {
  clearInterval(motorPulse)
  motorPulse = 0
  if (interactive.running) interactive.stop()
}

function startMotorPulse(side) {
  stopMotorPulse()
  const started = performance.now()
  interactive.addEngineTime(side, 0)
  interactive.setTurn(side)
  motorPulse = setInterval(() => {
    interactive.addEngineTime(side, performance.now() - started)
  }, 100)
}

function finishMotorPulse(side, ms) {
  stopMotorPulse()
  if (side) interactive.addEngineTime(side, ms)
}

const OPPONENT_REPLY_MS = 400

function tryLineMove(fen, san) {
  if (!san) return null
  try {
    return playTypedMove(new Chess(fen), san)
  } catch {
    return null
  }
}

function moveFromUci(fen, uci) {
  if (!uci || uci.length < 4) return null
  try {
    return new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    })
  } catch {
    return null
  }
}

function scheduleReply(played, done, delay = 500, engineMs = null) {
  cancelReply()
  replyLock = true
  const side = played?.color
  if (side && engineMs == null) startMotorPulse(side)
  replyTimer = setTimeout(() => {
    replyTimer = 0
    replyLock = false
    if (side) finishMotorPulse(side, engineMs == null ? delay : engineMs)
    commitPlayed(played)
    if (done) done()
  }, delay)
}

function resumeAfterMissingReply(fen, pendingSan, item) {
  stepFen = fen
  if (pendingSan && tryLineMove(fen, pendingSan)) {
    armExpect(pendingSan, item)
    return
  }
  replyLock = false
  if (!pendingSan && currentStepIndex >= solutie.length) finishLine(item)
}

async function playEngineReply(fen, pendingSan, item) {
  const token = replyEpoch
  const game = new Chess(fen)
  if (game.turn() === (learnerSide || 'w') || game.isGameOver()) {
    replyLock = false
    return
  }
  replyLock = true
  const side = game.turn()
  setStatus(t('train.thinking', { side: sideName(side) }))
  startMotorPulse(side)
  try {
    await engine.ready()
    if (token !== replyEpoch) return
    const result = await engine.analyze(fen, { depth: 12, multiPv: 1 })
    if (token !== replyEpoch) return
    const played = moveFromUci(fen, result.bestMove)
    stopMotorPulse()
    if (!played) {
      replyLock = false
      finishMotorPulse(side, result.timeMs || 0)
      if (pendingSan) resumeAfterMissingReply(fen, pendingSan, item)
      else setStatus(t('train.noEngineMove'))
      return
    }
    finishMotorPulse(side, result.timeMs || 0)
    scheduleReply(played, () => {
      stepFen = fenInput.value
      setStatus('')
      if (!pendingSan) return
      if (tryLineMove(stepFen, pendingSan)) {
        armExpect(pendingSan, item)
        hideSuccess()
        return
      }
      replyLock = false
      hideSuccess()
    }, OPPONENT_REPLY_MS, result.timeMs || 0)
  } catch (err) {
    if (token !== replyEpoch) return
    stopMotorPulse()
    replyLock = false
    setStatus(err instanceof Error ? err.message : String(err))
    if (pendingSan) resumeAfterMissingReply(fen, pendingSan, item)
  }
}

function acceptSolvedMove(played, item) {
  const guided = role === 'child' && Boolean(learnerSide)
  replyLock = true
  if (procedurePuzzle) {
    if (guided) showProcedureFeedback('', '')
    else showProcedureFeedback('ok', item?.ok || t('status.correct'))
  }
  hideSuccess()
  commitPlayed(played)
  const nextIndex = currentStepIndex + 1
  continuation = solutie.slice(nextIndex)
  if (nextIndex >= solutie.length) {
    currentStepIndex = nextIndex
    replyLock = false
    finishLine(item)
    return
  }
  const replySan = solutie[nextIndex]
  const reply = tryLineMove(played.after, replySan)
  const opponentReply = reply && reply.color !== (learnerSide || played.color)
  if (opponentReply) {
    currentStepIndex = nextIndex
    scheduleReply(reply, () => {
      currentStepIndex += 1
      continuation = solutie.slice(currentStepIndex)
      stepFen = fenInput.value
      if (currentStepIndex >= solutie.length) {
        finishLine(item)
        return
      }
      armExpect(solutie[currentStepIndex], item)
      hideSuccess()
      if (procedurePuzzle && guided) showProcedureFeedback('', '')
    }, item?.training || item?.testing ? 500 : (guided ? OPPONENT_REPLY_MS : 500))
    return
  }
  if (guided && !replySan) {
    stepFen = played.after
    void playEngineReply(played.after, '', item)
    return
  }
  replyLock = false
  currentStepIndex = nextIndex
  stepFen = played.after
  armExpect(replySan, item)
  hideSuccess()
}

function armExpect(san, item) {
  const feedback = {
    san,
    ok: item?.ok || t('status.correct'),
    bad: item?.bad || t('status.retry'),
  }
  if (!task) task = { expectMove: feedback }
  else {
    task.accept = currentStepIndex === 0 ? task.accept : null
    task.expectMove = { ...(task.expectMove || {}), ...feedback }
  }
}

function commitPlayed(played) {
  fenInput.value = played.after
  interactive.lastMove = { from: played.from, to: played.to }
  drawBoard()
  playMoveEffect(played)
  followOrAppend(played.after)
}

function playStudentMove(from, to) {
  const chess = positionChess()
  const piece = chess?.get(from)
  if (blockForeign(piece)) return
  const promotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined
  let played
  try {
    played = chess.move({ from, to, promotion })
  } catch {
    showCheer('again')
    setStatus(t('status.notLegal'))
    return
  }
  const expected = task?.expectMove?.san || solutie[currentStepIndex] || ''
  if (solutie.length || expected) {
    if (!solutie.length) startLine(played.before || currentFen(), [expected], task?.expectMove)
    if (!moveMatches(played, solutie[currentStepIndex])) {
      rejectLineMove(task?.expectMove)
      return
    }
    acceptSolvedMove(played, task?.expectMove)
    return
  }
  commitPlayed(played)
  if (role === 'child' && learnerSide) {
    const after = new Chess(played.after)
    if (after.turn() !== learnerSide && !after.isGameOver()) {
      stepFen = played.after
      void playEngineReply(played.after, '', null)
    }
  }
}

function moveMatches(played, expected) {
  return sameMove(played, expected)
}

function lineItem(line) {
  const item = document.createElement('li')
  const title = document.createElement('strong')
  title.textContent = `${line.rank}. ${line.san}  ${formatScore(line.evaluationCp, line.mateIn)}`
  const pv = document.createElement('span')
  pv.className = 'pv'
  pv.textContent = line.pvSan.join(' ')
  item.append(title, pv)
  return item
}

function showResult(result) {
  if (studentPlay()) return
  resultEl.replaceChildren()

  const best = document.createElement('p')
  best.className = 'best'
  const bestLine = result.lines[0]
  const bestSan = bestLine?.san || result.bestMove || '—'
  const score = formatScore(bestLine?.evaluationCp, bestLine?.mateIn)
  best.textContent = t('analysis.best', { san: bestSan, uci: result.bestMove || '—', score, depth: result.depth, time: formatEngineTime(result.timeMs) })
  engineLine.textContent = t('analysis.line', { depth: result.depth, san: bestSan, score })
  resultEl.append(best)

  const list = document.createElement('ol')
  list.className = 'lines'
  for (const line of result.lines) list.append(lineItem(line))
  resultEl.append(list)

  if (!('legal' in result)) return

  const verdict = document.createElement('p')
  verdict.className = 'verdict'
  if (!result.legal) {
    verdict.textContent = t('analysis.illegal', { error: result.error })
  } else if (result.matchesBest) {
    verdict.textContent = t('analysis.match', { san: result.userMove.san, score: formatScore(result.userEvaluationCp, result.userMateIn) })
  } else {
    const loss = result.lossCp == null ? t('analysis.mateLoss') : t('analysis.cpLoss', { cp: result.lossCp })
    verdict.textContent = t('analysis.user', { san: result.userMove.san, uci: result.userMove.uci, score: formatScore(result.userEvaluationCp, result.userMateIn), loss })
  }
  resultEl.append(verdict)
}

async function evaluate() {
  if (busy || studentPlay()) return
  const fen = currentFen()
  const check = validateFen(fen)
  if (!check.ok) {
    setStatus(check.error)
    return
  }

  const move = moveInput.value.trim()
  const depth = Number(depthInput.value) || 12
  const resumeSide = interactive.running
  interactive.stop()
  busy = true
  evalButton.disabled = true
  setStatus(t('status.search'))

  try {
    await engine.ready()
    const options = {
      depth,
      multiPv: 3,
      onProgress: ({ depth: reached }) => setStatus(t('status.depth', { reached, depth })),
    }
    const result = move
      ? await engine.evaluateUserMove(fen, move, options)
      : await engine.analyze(fen, options)
    recordAnalysisTime(fen, result)
    showResult(result)
    setStatus(t('status.done'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
  } finally {
    busy = false
    evalButton.disabled = evalLocked()
    if (resumeSide && train && !train.over && !train.setup) interactive.setTurn(resumeSide)
  }
}

function clearTask() {
  stopNarrative()
  setAvatarState('idle')
  setAvatarCaption('')
  demoLine = false
  practiceGate = null
  resetLine()
  task = null
  exam = null
  taskActions.replaceChildren()
  resultEl.replaceChildren()
  interactive.showTargets = true
  hideSuccess()
  closeProcedureCourse()
}

function hideSuccess() {
  const box = document.querySelector('#success')
  if (box) box.hidden = true
  const next = document.querySelector('#success-next')
  if (next) next.hidden = true
}

function showSuccess(message) {
  const cheer = document.querySelector('#cheer')
  if (cheer) cheer.hidden = true
  const box = document.querySelector('#success')
  const text = document.querySelector('#success-text')
  const next = document.querySelector('#success-next')
  if (!box || !text || !next) return
  text.textContent = message || t('success.solved')
  next.textContent = t('success.next')
  next.hidden = !canAdvanceExercise()
  box.hidden = false
}

function canAdvanceExercise() {
  if (exam) return exam.index < EXAM.length
  if (hasSessionNext()) return true
  return Boolean(nextModuleLesson() || (solver?.id && nextSolverId()))
}

function nextModuleLesson() {
  if (!curriculumLessonId) return null
  const current = document.querySelector(`#curriculum-root [data-module="${CSS.escape(curriculumLessonId)}"]`)
  const group = current?.closest('.nav-group')
  if (!group) return null
  const buttons = [...group.querySelectorAll('[data-module]')]
  const index = buttons.findIndex((button) => button.dataset.module === curriculumLessonId)
  return buttons[index + 1]?.dataset.module || null
}

function nextSolverId() {
  if (!solver?.id) return null
  const buttons = [...document.querySelectorAll('#exercise-list [data-exercise]')]
  const index = buttons.findIndex((button) => button.dataset.exercise === solver.id)
  return buttons[index + 1]?.dataset.exercise || null
}

function advanceExercise() {
  hideSuccess()
  if (exam && exam.index < EXAM.length) {
    showExamItem()
    return
  }
  const sessionNext = takeSessionNext()
  if (sessionNext) {
    studentPlayHooks().play(sessionNext)
    return
  }
  const lesson = nextModuleLesson()
  if (lesson) {
    loadModule(lesson)
    return
  }
  const id = nextSolverId()
  if (id) openExercise(id)
}

function showTaskFeedback(correct, item) {
  if (procedurePuzzle && correct) {
    noteSessionResult(true)
    if (curriculumLessonId && !exam && !isMastersMode()) markLessonDone(curriculumLessonId)
    const solved = role === 'child' ? t('pedagogy.moveSolved') : (item?.ok || t('status.correct'))
    showProcedureFeedback('ok', solved)
    const next = document.querySelector('#procedure-next')
    if (next) next.hidden = false
    paintProcedureNext(true)
    procedurePuzzle = false
    procedureSolved = true
    task = null
    setStatus('')
    return
  }
  noteSessionResult(correct)
  if (correct && curriculumLessonId && !exam && !isMastersMode()) markLessonDone(curriculumLessonId)
  resultEl.replaceChildren()
  const guided = Boolean(item?.training) || (role === 'child' && Boolean(learnerSide))
  const line = document.createElement('p')
  line.className = 'verdict'
  line.textContent = correct ? (guided ? t('pedagogy.moveSolved') : item.ok) : item.bad
  resultEl.append(line)
  setStatus(correct ? (guided ? t('pedagogy.moveSolved') : t('status.correct')) : t('status.retry'))
  if (correct) showSuccess(guided ? t('pedagogy.moveSolved') : '')
  else {
    hideSuccess()
    showCheer('again')
  }
}

function renderChoices(item, onPick) {
  taskActions.replaceChildren()
  for (const choice of item.choices) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = choice.label
    button.addEventListener('click', () => {
      for (const other of taskActions.querySelectorAll('button')) other.disabled = true
      onPick(choice.id === item.answer)
    })
    taskActions.append(button)
  }
}

function armTask(item, onGrade) {
  lessonEl.textContent = item.prompt
  taskActions.replaceChildren()
  interactive.showTargets = false
  if (item.pieceClick) {
    resetLine()
    learnerSide = ''
    task = {
      accept: item.accept || null,
      pieceClick: true,
      expectMove: null,
      grade: onGrade,
    }
    return
  }
  if (item.choices) {
    resetLine()
    learnerSide = ''
    task = { accept: null }
    renderChoices(item, (correct) => {
      task = null
      onGrade(correct)
    })
    return
  }
  const source = Array.isArray(item.solutie) && item.solutie.length
    ? item.solutie
    : (Array.isArray(item.moves) && item.moves.length ? item.moves : item.correctMove)
  const line = startLine(item.fen, source, item)
  continuation = line
  learnerSide = role === 'child' && line.length && !item.accept ? sideToMove(item.fen || currentFen()) : ''
  task = {
    accept: item.accept || null,
    expectMove: line.length || item.correctMove ? {
      san: line[currentStepIndex] || line[0] || item.correctMove,
      ok: item.ok,
      bad: item.bad,
    } : null,
    grade: onGrade,
  }
}

function markAsked(square) {
  const cell = boardEl.querySelector(`[data-square="${square}"]`)
  if (cell) cell.classList.add('asked')
}

function presentItem(item, onGrade) {
  showPosition(item.fen)
  if (item.mark) markAsked(item.mark)
  armTask(item, onGrade)
}

function finishExam() {
  const passed = exam.score >= 3
  const banner = document.querySelector('#success-next')
  if (banner) banner.hidden = true
  if (passed && curriculumLessonId) markLessonDone(curriculumLessonId)
  task = null
  taskActions.replaceChildren()
  lessonEl.textContent = t('exam.score', { score: exam.score, ending: passed ? t('exam.passed') : t('exam.failed') })
  resultEl.replaceChildren()
  setStatus(passed ? t('exam.statusPass') : t('exam.statusFail'))
  exam = null
}

function showExamItem() {
  const item = EXAM[exam.index]
  activityTitle.textContent = t('exam.title', { index: exam.index + 1 })
  presentItem(item, (correct) => {
    exam.score += correct ? 1 : 0
    exam.index += 1
    showTaskFeedback(correct, item)
    taskActions.replaceChildren()
    if (exam.index >= EXAM.length) {
      finishExam()
      return
    }
    const next = document.createElement('button')
    next.type = 'button'
    next.textContent = t('exam.next')
    next.addEventListener('click', showExamItem)
    taskActions.append(next)
  })
}

const VIEW_KEY = 'chesscoach.view'

function emptyView() {
  return {
    mode: 'copil',
    topTab: 'niveluri',
    selectedLevelId: null,
    selectedLessonId: null,
    selectedStepId: 0,
  }
}

function topTabName() {
  if (mode === 'learn') return 'invatam'
  if (mode === 'train') return 'train'
  if (mode === 'menu') return 'menu'
  return 'niveluri'
}

function readView() {
  try {
    const data = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}')
    const step = Number(data.selectedStepId)
    return {
      mode: data.mode === 'profesor' ? 'profesor' : 'copil',
      topTab: typeof data.topTab === 'string' ? data.topTab : 'niveluri',
      selectedLevelId: data.selectedLevelId || null,
      selectedLessonId: data.selectedLessonId || null,
      selectedStepId: Number.isInteger(step) && step >= 0 ? step : 0,
    }
  } catch {
    return emptyView()
  }
}

function writeView(patch) {
  const next = {
    ...readView(),
    ...patch,
    mode: role === 'teacher' ? 'profesor' : 'copil',
    topTab: topTabName(),
  }
  localStorage.setItem(VIEW_KEY, JSON.stringify(next))
  return next
}

function rememberLesson(id, stepId) {
  const place = id ? themeForLesson(id) : null
  const prev = readView()
  return writeView({
    selectedLessonId: id || null,
    selectedLevelId: place?.levelId || currentCurriculumLevel() || prev.selectedLevelId,
    selectedStepId: Number.isInteger(stepId) ? stepId : prev.selectedStepId || 0,
  })
}

function markSidebarLesson(id) {
  document.querySelectorAll('#curriculum-root .nav-item').forEach((item) => item.classList.remove('active'))
  if (!id) return
  const button = document.querySelector(`#curriculum-root [data-module="${CSS.escape(id)}"]`)
  if (!button) return
  button.classList.add('active')
  const group = button.closest('.nav-group')
  const parent = group?.querySelector('.nav-parent')
  if (!parent) return
  parent.classList.add('open')
  group.querySelector('.submenu')?.removeAttribute('hidden')
  parent.setAttribute('aria-expanded', 'true')
}

function teacherEditorHooks() {
  return {
    getFen: currentFen,
    setFen(fen) {
      fenInput.value = fen
      drawBoard()
      adoptFen(fen)
    },
    reviewLine(fen, moves) {
      publishLine(fen, moves, true)
    },
    selectSquare: markSelected,
    clearSquare() {
      interactive.clearSelection()
    },
    resetTask: clearTask,
    status: setStatus,
    setAvatarState,
    exportLesson: exportBuiltLesson,
    whiteAtBottom: () => interactive.whiteAtBottom,
    applyOrientation(orientation) {
      const wantWhite = orientation !== 'black'
      if (interactive.whiteAtBottom !== wantWhite) interactive.flip()
    },
    preview(nextLevel, sub, sectionId, itemIndex) {
      closeTeacherEditor()
      interactive.draggable = true
      document.body.classList.add('student')
      resultEl.replaceChildren()
      engineLine.textContent = ''
      const hooks = studentPlayHooks(() => {
        learnerSide = ''
        closePedagogy()
        closeLevels()
        showPedagogyReturn(false)
        resumeTeacherEditor()
        interactive.draggable = true
        document.body.classList.remove('student')
      })
      const target = focusSavedExercise(document.querySelector('#levels'), nextLevel, sub, hooks, sectionId, itemIndex)
      if (target) hooks.play(target)
    },
  }
}

function showTeacherWorkspace(lessonId) {
  clearTask()
  leaveExercise()
  closeLevels()
  closePedagogy()
  showPedagogyReturn(false)
  document.body.classList.remove('student')
  interactive.draggable = true
  if (!isTeacherEditor()) openTeacherEditor(teacherEditorHooks())
  else resumeTeacherEditor()
  const id = lessonId || readView().selectedLessonId
  if (!id) {
    scheduleLiveEval()
    return
  }
  const place = themeForLesson(id)
  if (place?.levelId && currentCurriculumLevel() !== place.levelId) setCurriculumLevel(place.levelId)
  markSidebarLesson(id)
  syncEditorToLesson(id)
  const level = getLevels().find((item) => item.id === place?.levelId)
  if (level) panelTitle.textContent = tx(level.title)
  scheduleLiveEval()
}

function showCopilLesson(lessonId) {
  leaveExercise()
  closeTeacherEditor()
  document.body.classList.add('student')
  interactive.draggable = true
  if (lessonId) {
    showLessonSteps(lessonId, readView().selectedStepId, { resume: true })
    scheduleLiveEval()
    return
  }
  closePedagogy()
  showPedagogyReturn(false)
  if (!openProcedureId) showAnalysisChrome()
  openLevelSelector(readView().selectedLevelId)
  scheduleLiveEval()
}

function showLessonSteps(lessonId, stepId = 0, options = {}) {
  const resume = Boolean(options.resume)
  const place = themeForLesson(lessonId)
  const step = Number.isInteger(stepId) ? stepId : 0
  rememberLesson(lessonId, resume ? step : 0)
  if (role === 'teacher') {
    showTeacherWorkspace(lessonId)
    return
  }
  if (lessonId === 'test') {
    loadModule('test')
    return
  }
  markLessonStarted(lessonId)
  if (place?.levelId && currentCurriculumLevel() !== place.levelId) setCurriculumLevel(place.levelId)
  markSidebarLesson(lessonId)
  syncEditorToLesson(lessonId)
  const level = getLevels().find((item) => item.id === place?.levelId)
  const sub = level?.subchapters?.find((item) => item.id === place?.subId)
  if (!level || !sub) {
    loadModule(lessonId)
    return
  }
  panelTitle.textContent = tx(level.title)
  activityTitle.textContent = tx(sub.title)
  closeLevels()
  if (resume && pedagogySubId() === sub.id) {
    resumePedagogy()
    return
  }
  openPedagogy(document.querySelector('#levels'), level, sub, {
    ...studentPlayHooks(),
    startStep: resume ? step : 0,
  })
}

function showMasteryView() {
  if (role === 'teacher') {
    showTeacherWorkspace(readView().selectedLessonId)
    return
  }
  showCopilLesson(readView().selectedLessonId)
}

function loadModule(id) {
  clearSavedAnnotations()
  rememberLesson(id)
  cancelReply()
  hideSuccess()
  closeLevels()
  closeMasters()
  curriculumLessonId = id
  markLessonStarted(id)
  leaveExercise()
  endTrain()
  if (!interactive.whiteAtBottom) interactive.flip()
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'))
  const button = document.querySelector(`[data-module="${CSS.escape(id)}"]`)
  if (button) {
    button.classList.add('active')
    const group = button.closest('.nav-group')
    const parent = group?.querySelector('.nav-parent')
    if (parent && group) {
      parent.classList.add('open')
      group.querySelector('.submenu')?.removeAttribute('hidden')
      parent.setAttribute('aria-expanded', 'true')
      panelTitle.textContent = parent.querySelector('strong')?.textContent || lessonTitle(id)
    }
  }
  resultEl.replaceChildren()
  engineLine.textContent = ''
  setStatus('')

  exam = null
  syncEditorToLesson(id)
  if (id === 'test') {
    showMeasurableProbe(0)
    return
  }
  examProbeIndex = -1
  showProcedureCourse(resolveInteractiveLesson(id, lessonCatalogs(), {
    title: lessonTitle(id),
    code: id,
    fen: START_FEN,
  }))
}

function lessonCatalogs() {
  return { ...TABLA, ...PION, ...CAL, ...NEBUN }
}

function showLesson(key) {
  const id = LESSONS[key] ? key : mode
  lessonEl.textContent = t(`blurb.${id}`)
}

const turnApi = {
  show(fen, prompt) {
    showPosition(fen)
    interactive.lastMove = null
    interactive.showTargets = false
    lessonEl.textContent = prompt
    resultEl.replaceChildren()
  },
  prompt(text) {
    lessonEl.textContent = text
  },
  title(text) {
    activityTitle.textContent = text
  },
  badge(text) {
    badge.textContent = text
  },
  status(text) {
    setStatus(text)
  },
  clearResult() {
    resultEl.replaceChildren()
    setStatus('')
  },
  verdict(ok, text) {
    showTaskFeedback(ok, { ok: text, bad: text })
  },
  actions(buttons) {
    taskActions.replaceChildren()
    for (const spec of buttons) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = spec.label
      button.addEventListener('click', spec.onClick)
      taskActions.append(button)
    }
  },
  listen(fn) {
    task = { collect: fn }
  },
  silence() {
    task = null
    taskActions.replaceChildren()
  },
  mark(squares) {
    for (const cell of boardEl.querySelectorAll('.square')) {
      cell.classList.toggle('asked', squares.has(cell.dataset.square))
    }
  },
}

function bindMenuToggle(toggleId, menuId) {
  const toggle = document.querySelector(toggleId)
  const menu = document.querySelector(menuId)
  toggle.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden')
    menu.toggleAttribute('hidden', !open)
    toggle.classList.toggle('open', open)
    toggle.setAttribute('aria-expanded', String(open))
  })
}

bindMenuToggle('#exercise-toggle', '#exercise-menu')
bindMenuToggle('#train-toggle', '#train-menu')
bindMenuToggle('#path-toggle', '#path-menu')

function leavePiecePath() {
  if (!piecePathActive()) return
  stopPiecePath()
  fenInput.value = START_FEN
  interactive.showTargets = true
  interactive.draggable = true
  drawBoard()
}

mountPiecePath({
  whiteAtBottom: () => interactive.whiteAtBottom,
  dragFrom: () => interactive.selected,
  outline(square) {
    if (square) markSelected(square)
    else interactive.clearSelection()
  },
  show(fen, last) {
    fenInput.value = fen
    interactive.lastMove = last
    interactive.draggable = true
    interactive.showTargets = false
    drawBoard()
  },
  sound: () => playMoveEffect(),
  win: () => playExerciseEnd(),
  status: (message) => setStatus(message || ''),
  onStart(exercise) {
    clearTask()
    endTrain()
    leaveExercise()
    closeLevels()
    if (isMastersMode()) closeMasters()
    setMode('menu')
    document.querySelector('#lesson').hidden = true
    document.querySelector('#procedure-course').hidden = true
    const piece = t(`piece.${exercise.piece}`)
    activityTitle.textContent = `${piece} · ${exercise.id}`
    panelTitle.textContent = t('path.title')
    badge.textContent = ''
  },
  onStop() {
    const panel = document.querySelector('#piece-path')
    if (panel) panel.hidden = true
    document.querySelector('#lesson').hidden = false
    if (!openProcedureId && !solver) {
      activityTitle.textContent = t(`modeTitle.${mode}`)
      panelTitle.textContent = t(`modeTitle.${mode}`)
      showLesson(mode)
    }
  },
})

function setMode(next) {
  mode = next
  document.querySelectorAll('.modes .mode').forEach((item) => {
    item.classList.toggle('active', item.dataset.mode === next)
  })
  syncSidebar(next)
}

function syncSidebar(next) {
  const sidebar = document.querySelector('.sidebar')
  if (!sidebar) return
  const view = next === 'analysis' || next === 'learn' ? 'chapters' : next === 'train' ? 'train' : 'menu'
  sidebar.dataset.view = view
  clearSidebarSelection(view)
  paintLevelBadge()
  if (view !== 'menu' && view !== 'train') return
  const trainMenu = document.querySelector('#train-menu')
  const trainToggle = document.querySelector('#train-toggle')
  if (trainMenu) trainMenu.hidden = false
  if (trainToggle) {
    trainToggle.classList.add('open')
    trainToggle.setAttribute('aria-expanded', 'true')
  }
}

function clearSidebarSelection(view) {
  const sidebar = document.querySelector('.sidebar')
  if (!sidebar) return
  const drop = view === 'chapters'
    ? '[data-exercise], #new-exercise, [data-train], #focus-fen'
    : view === 'train'
      ? '[data-exercise], #new-exercise, #curriculum-root .nav-item, #focus-fen'
      : '#curriculum-root .nav-item, #focus-fen, [data-train]'
  sidebar.querySelectorAll(drop).forEach((item) => item.classList.remove('active'))
}

function showAnalysisChrome() {
  if (openProcedureId || solver) return
  activityTitle.textContent = t('modeTitle.analysis')
  panelTitle.textContent = t('panel.analysis')
  badge.textContent = ''
  if (!validateFen(fenInput.value).ok) {
    fenInput.value = START_FEN
    drawBoard()
  }
}

function openTrainMenu() {
  const menu = document.querySelector('#train-menu')
  const toggle = document.querySelector('#train-toggle')
  menu.removeAttribute('hidden')
  toggle.classList.add('open')
  toggle.setAttribute('aria-expanded', 'true')
}

function endTrain() {
  train = null
  trainMode = null
  interactive.stop()
  interactive.onFlag = null
  interactive.setBlindfold(false)
  interactive.lastMove = null
  interactive.resetClocks()
  fenInput.readOnly = false
  evalButton.disabled = solving()
}

function evalLocked() {
  if (solving()) return true
  return Boolean(train && !train.over && !train.setup)
}

function analysisOptions() {
  const depth = Number(depthInput.value) || 12
  return {
    depth,
    multiPv: train?.kind === 'game' ? 1 : 3,
    onProgress: ({ depth: reached }) => setStatus(t('status.depth', { reached, depth })),
  }
}

function playLoose(chess, text) {
  return playTypedMove(chess, text)
}

function sideName(side) {
  return t(side === 'w' ? 'side.whiteName' : 'side.blackName')
}

function nudgePosition(square) {
  let chess
  try {
    chess = new Chess(currentFen())
  } catch {
    return
  }
  if (!interactive.selected) {
    if (!chess.get(square)) return
    markSelected(square)
    return
  }
  const from = interactive.selected
  if (from === square) {
    interactive.clearSelection()
    return
  }
  const piece = chess.get(from)
  const promotion = piece?.type === 'p' && (square[1] === '8' || square[1] === '1') ? 'q' : undefined
  try {
    const played = chess.move({ from, to: square, promotion })
    interactive.lastMove = { from: played.from, to: played.to }
    fenInput.value = chess.fen()
    drawBoard()
    playMoveEffect(played)
  } catch {
    if (chess.get(square)) markSelected(square)
    else interactive.clearSelection()
  }
}

function selectTrainPiece(chess, square) {
  if (!interactive.selected) {
    const piece = chess.get(square)
    if (!piece || piece.color !== chess.turn()) return null
    markSelected(square)
    return null
  }
  const from = interactive.selected
  if (from === square) {
    interactive.clearSelection()
    return null
  }
  const piece = chess.get(from)
  const promotion = piece?.type === 'p' && (square[1] === '8' || square[1] === '1') ? 'q' : undefined
  interactive.clearSelection()
  return { from, to: square, promotion }
}

function playGameSquare(square) {
  if (busy || train.chess.turn() !== train.human) return
  const spec = selectTrainPiece(train.chess, square)
  if (!spec) return
  let played
  try {
    played = train.chess.move(spec)
  } catch {
    setStatus(t('status.notLegal'))
    return
  }
  if (commitGameMove(played)) return
  void engineReply()
}

function playGradedSquare(square) {
  if (busy) return
  let chess
  try {
    chess = new Chess(currentFen())
  } catch {
    return
  }
  const spec = selectTrainPiece(chess, square)
  if (!spec) return
  let played
  try {
    played = chess.move(spec)
  } catch {
    setStatus(t('status.notLegal'))
    return
  }
  void gradePlayed(currentFen(), played)
}

function paintMoves() {
  let note = resultEl.querySelector('.train-moves')
  if (!note) {
    note = document.createElement('p')
    note.className = 'verdict train-moves'
    resultEl.append(note)
  }
  note.textContent = train.moves.length ? train.moves.join(' ') : t('train.noMoves')
}

function commitGameMove(played) {
  train.moves.push(played.san)
  interactive.lastMove = train.blindfold ? null : { from: played.from, to: played.to }
  if (train.blindfold) interactive.showBlindGhost(played)
  else interactive.clearBlindGhost()
  fenInput.value = train.chess.fen()
  moveInput.value = ''
  if (played?.color) interactive.addIncrement(played.color)
  drawBoard()
  playMoveEffect(played)
  if (gameOverCheck()) return true
  paintMoves()
  return false
}

function gameOverCheck() {
  const chess = train.chess
  if (!chess.isGameOver()) return false
  train.over = true
  interactive.stop()
  evalButton.disabled = false
  let text = t('train.over')
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? t('side.blackName') : t('side.whiteName')
    text = t('train.mate', { side: winner })
    playExerciseEnd()
  } else if (chess.isStalemate()) {
    text = t('train.stalemate')
  } else if (chess.isThreefoldRepetition()) {
    text = t('train.repetition')
  } else if (chess.isInsufficientMaterial()) {
    text = t('train.material')
  } else if (chess.isDraw()) {
    text = t('train.draw')
  }
  setStatus(text)
  lessonEl.textContent = text
  paintMoves()
  return true
}

async function engineReply() {
  if (!train || train.over || train.kind !== 'game') return
  const side = train.chess.turn()
  if (side === train.human) {
    interactive.setTurn(side)
    return
  }
  busy = true
  evalButton.disabled = true
  interactive.setTurn(side)
  setStatus(t('train.thinking', { side: sideName(side) }))
  const fen = train.chess.fen()
  try {
    await engine.ready()
    const result = await engine.analyze(fen, analysisOptions())
    if (!train || train.over) return
    interactive.addEngineTime(side, result.timeMs || 0, { intoClock: false })
    const uci = result.bestMove
    if (!uci) {
      setStatus(t('train.noEngineMove'))
      interactive.stop()
      return
    }
    const played = train.chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    })
    if (train.blindfold) resultEl.replaceChildren()
    else showResult(result)
    const ended = commitGameMove(played)
    engineLine.textContent = t('train.engineLine', { side: sideName(side), time: formatEngineTime(result.timeMs), san: played.san })
    if (!ended) {
      setStatus(t('train.moved', { side: sideName(side), san: played.san }))
      interactive.setTurn(train.human)
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
    interactive.stop()
  } finally {
    busy = false
    evalButton.disabled = evalLocked()
  }
}

function acceptedLine(result, trial) {
  if (trial.isCheckmate()) return true
  if (!result.legal) return false
  if (result.matchesBest) return true
  if (result.userMateIn != null && result.userMateIn > 0) return true
  return result.lossCp != null && result.lossCp <= 30
}

async function gradePlayed(fen, played) {
  if (busy || !train || train.over) return
  busy = true
  evalButton.disabled = true
  const turn = sideToMove(fen)
  interactive.stop()
  setStatus(t('train.analyzing'))
  try {
    await engine.ready()
    const result = await engine.evaluateUserMove(fen, played.san, analysisOptions())
    if (!train || train.over) return
    recordAnalysisTime(fen, result)
    showResult(result)
    if (!acceptedLine(result, new Chess(played.after))) {
      showCheer('again')
      setStatus(t('train.thinkMore'))
      interactive.setTurn(turn)
      return
    }
    showCheer('ok')
    if (train.kind === 'puzzle') {
      train.over = true
      interactive.stop()
      setStatus(t('train.puzzleSolved'))
      lessonEl.textContent = t('train.confirmed', { san: played.san })
      return
    }
    train.index += 1
    if (train.index >= QUEST_STEPS.length) {
      train.over = true
      interactive.stop()
      setStatus(t('train.questDone'))
      lessonEl.textContent = t('train.questDoneText')
      return
    }
    loadQuestStep()
    setStatus(t('train.nextPosition'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
    if (train && !train.over) interactive.setTurn(turn)
  } finally {
    busy = false
    evalButton.disabled = evalLocked()
  }
}

function playTrainNotation(text) {
  if (!train || train.over || train.setup || busy) return
  if (train.kind === 'game') {
    if (train.chess.turn() !== train.human) {
      setStatus(t('train.wait'))
      return
    }
    let played
    try {
      played = playLoose(train.chess, text)
    } catch {
      setStatus(t('status.notLegal'))
      return
    }
    if (commitGameMove(played)) return
    void engineReply()
    return
  }
  let trial
  let played
  try {
    trial = new Chess(currentFen())
    played = playLoose(trial, text)
  } catch {
    setStatus(t('status.notLegal'))
    return
  }
  void gradePlayed(currentFen(), played)
}

function loadQuestStep() {
  const step = QUEST_STEPS[train.index]
  activityTitle.textContent = t('train.questStep', { index: train.index + 1, total: QUEST_STEPS.length })
  lessonEl.textContent = step.prompt
  badge.textContent = 'QUEST'
  interactive.lastMove = null
  fenInput.value = step.fen
  drawBoard()
  interactive.setTurn(sideToMove(step.fen))
}

function minutesField(id, label, value) {
  const wrap = document.createElement('label')
  wrap.className = 'field'
  wrap.htmlFor = id
  wrap.append(document.createTextNode(label))
  const input = document.createElement('input')
  input.id = id
  input.type = 'number'
  input.min = '1'
  input.max = '180'
  input.value = String(value)
  wrap.append(input)
  return wrap
}

function clampMinutes(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 5
  return Math.min(180, Math.max(1, Math.round(parsed)))
}

function previewCustom() {
  const white = clampMinutes(document.querySelector('#custom-white')?.value)
  const black = clampMinutes(document.querySelector('#custom-black')?.value)
  interactive.resetClocks({ whiteMs: white * 60000, blackMs: black * 60000, countdown: true })
}

function showCustomSetup() {
  train = { kind: 'setup', setup: true, id: 'custom', over: false }
  fenInput.readOnly = false
  fenInput.value = currentFen() || START_FEN
  interactive.setBlindfold(false)
  interactive.lastMove = null
  drawBoard()
  taskActions.replaceChildren()
  const white = minutesField('custom-white', t('train.minutesWhite'), 10)
  const black = minutesField('custom-black', t('train.minutesBlack'), 5)
  const start = document.createElement('button')
  start.type = 'button'
  start.textContent = t('train.start')
  white.querySelector('input').addEventListener('input', previewCustom)
  black.querySelector('input').addEventListener('input', previewCustom)
  start.addEventListener('click', () => {
    const fen = currentFen()
    const check = validateFen(fen)
    if (!check.ok) {
      setStatus(check.error)
      return
    }
    const whiteMs = clampMinutes(white.querySelector('input').value) * 60000
    const blackMs = clampMinutes(black.querySelector('input').value) * 60000
    taskActions.replaceChildren()
    startGame({ id: 'custom', fen, whiteMs, blackMs, blindfold: false })
    activityTitle.textContent = t('train.customTitle')
  })
  taskActions.append(white, black, start)
  previewCustom()
  setStatus(t('train.pickTimes'))
}

function randomFen() {
  const chess = new Chess()
  const plies = 6 + Math.floor(Math.random() * 7)
  for (let i = 0; i < plies; i += 1) {
    const moves = chess.moves({ verbose: true })
    if (!moves.length || chess.isGameOver()) break
    chess.move(moves[Math.floor(Math.random() * moves.length)])
  }
  return chess.fen()
}

function startGame(options) {
  const chess = new Chess(options.fen)
  train = {
    kind: 'game',
    id: options.id,
    chess,
    human: 'w',
    blindfold: Boolean(options.blindfold),
    over: false,
    setup: false,
    moves: [],
  }
  interactive.onFlag = (side) => {
    if (!train || train.over || train.kind !== 'game') return
    train.over = true
    interactive.stop()
    evalButton.disabled = false
    const text = `${sideName(side)} a pierdut la timp.`
    setStatus(text)
    lessonEl.textContent = text
  }
  interactive.setBlindfold(train.blindfold)
  interactive.lastMove = null
  interactive.resetClocks({
    whiteMs: options.whiteMs,
    blackMs: options.blackMs,
    countdown: true,
    incrementMs: options.incrementMs || 0,
  })
  fenInput.value = chess.fen()
  fenInput.readOnly = true
  moveInput.value = ''
  resultEl.replaceChildren()
  drawBoard()
  evalButton.disabled = true
  if (chess.isGameOver()) {
    gameOverCheck()
    return
  }
  if (chess.turn() !== train.human) void engineReply()
  else interactive.setTurn(train.human)
}

function trainCopy(id) {
  const key = { quest: 'quest', puzzle: 'puzzle', random: 'random', custom: 'custom', classical: 'classical', blindfold: 'blind' }[id]
  if (!key) return null
  return {
    title: t(`train.${key}Title`),
    badge: t(`train.${key}Badge`),
    text: t(`train.${key}Text`),
  }
}

function openTrain(id) {
  closeLevels()
  closeMasters()
  const copy = trainCopy(id)
  if (!copy) return
  endTrain()
  trainMode = id
  leaveExercise()
  clearTask()
  if (!interactive.whiteAtBottom) interactive.flip()
  setMode('train')
  openTrainMenu()
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'))
  document.querySelector(`[data-train="${id}"]`).classList.add('active')
  panelTitle.textContent = t('train.panel')
  activityTitle.textContent = copy.title
  badge.textContent = copy.badge
  lessonEl.textContent = copy.text
  engineLine.textContent = ''
  resultEl.replaceChildren()

  if (id === 'custom') {
    showCustomSetup()
    return
  }
  if (id === 'quest') {
    train = { kind: 'quest', index: 0, over: false, setup: false }
    fenInput.readOnly = true
    interactive.resetClocks()
    evalButton.disabled = true
    loadQuestStep()
    return
  }
  if (id === 'puzzle') {
    train = { kind: 'puzzle', over: false, setup: false }
    fenInput.readOnly = true
    interactive.resetClocks()
    interactive.lastMove = null
    fenInput.value = PUZZLE_FEN
    drawBoard()
    evalButton.disabled = true
    interactive.setTurn('w')
    return
  }
  if (id === 'random') {
    startGame({ id, fen: randomFen(), whiteMs: 5 * 60000, blackMs: 5 * 60000, blindfold: false })
    return
  }
  if (id === 'classical') {
    startGame({ id, fen: START_FEN, whiteMs: 30 * 60000, blackMs: 30 * 60000, blindfold: false })
    return
  }
  if (id === 'blindfold') {
    startGame({
      id,
      fen: START_FEN,
      whiteMs: 10 * 60 * 1000,
      blackMs: 10 * 60 * 1000,
      incrementMs: 3 * 1000,
      blindfold: true,
    })
  }
}

document.querySelectorAll('[data-train]').forEach((button) => {
  button.addEventListener('click', () => openTrain(button.dataset.train))
})

document.querySelector('.sidebar').addEventListener('click', (event) => {
  const subadd = event.target.closest('[data-add-sub-theme]')
  if (subadd) {
    if (role === 'teacher') openSubThemeForm(subadd.dataset.addSubTheme)
    return
  }
  const add = event.target.closest('[data-add-theme]')
  if (add) {
    if (role === 'teacher') openThemeForm({ sectionId: add.dataset.addTheme })
    return
  }
  const admin = event.target.closest('[data-theme-admin]')
  if (admin) {
    if (role === 'teacher') openThemeFromPencil(admin.dataset.themeAdmin)
    return
  }
  const button = event.target.closest('[data-module]')
  if (button) {
    if (mode === 'analysis') showLessonSteps(button.dataset.module, 0)
    else loadModule(button.dataset.module)
    return
  }
  const chapter = event.target.closest('[data-level-module]')
  if (chapter && role === 'teacher') syncEditorToModule(chapter.dataset.levelModule)
})

document.querySelector('.sidebar').addEventListener('dblclick', (event) => {
  const lesson = event.target.closest('#curriculum-root [data-module]')
  if (!lesson || role !== 'teacher') return
  event.preventDefault()
  openThemeFromPencil(lesson.dataset.module)
})

function syncEditorToModule(moduleId) {
  if (role !== 'teacher' || !isTeacherEditor()) return
  const level = levelForModule(moduleId)
  if (level) focusEditorLevel(level.id)
}

function syncEditorToLesson(id) {
  if (role !== 'teacher' || !isTeacherEditor()) return
  const place = themeForLesson(id)
  if (place) {
    focusLessonDiagram(place.levelId, place.subId)
    return
  }
  const button = document.querySelector(`#curriculum-root [data-module="${CSS.escape(id)}"]`)
  const moduleId = button?.closest('.nav-group')?.querySelector('[data-level-module]')?.dataset.levelModule
  if (moduleId) syncEditorToModule(moduleId)
}

function openThemeFromPencil(themeId) {
  if (!themeId) return
  if (!isTeacherEditor()) resumeTeacherEditor()
  const place = themeForLesson(themeId)
  if (place) focusEditorTheme(place.levelId, place.subId)
  document.querySelectorAll('#curriculum-root .nav-item').forEach((item) => item.classList.remove('active'))
  document.querySelector(`#curriculum-root [data-module="${CSS.escape(themeId)}"]`)?.classList.add('active')
  openThemeForm({ themeId })
}

function fillThemeParents(sectionId, themeId, selectedId) {
  const select = document.querySelector('#theme-of')
  if (!select) return
  const current = selectedId ?? select.value
  select.replaceChildren()
  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = t('pedagogy.themeSubPick')
  select.append(empty)
  for (const theme of menuThemeOptions(sectionId, themeId)) {
    const option = document.createElement('option')
    option.value = theme.id
    option.textContent = theme.title
    select.append(option)
  }
  if (current && [...select.options].some((option) => option.value === current)) select.value = current
}

function syncThemeParentControl() {
  const sub = document.querySelector('#theme-sub')
  const of = document.querySelector('#theme-of')
  const section = document.querySelector('#theme-parent')
  if (!sub || !of || !section) return
  of.disabled = !sub.checked
  if (sub.checked) fillThemeParents(section.value, document.querySelector('#theme-dialog')?.dataset.themeId || '')
}

function activeSidebarModuleId() {
  const active = document.querySelector('#curriculum-root .nav-item.active')
  const fromActive = active?.closest('.nav-group')?.querySelector('[data-level-module]')?.dataset.levelModule
  if (fromActive) return fromActive
  const open = [...document.querySelectorAll('#curriculum-root [data-level-module].open')].at(-1)
  return open?.dataset.levelModule || ''
}

function themeModalModule(sectionId, themeId) {
  return moduleOfTheme(themeId) || moduleOfSection(sectionId) || moduleOfSection(activeSidebarModuleId())
}

function syncEditorToThemeContext(moduleId, themeId) {
  if (role !== 'teacher' || !moduleId) return
  if (!isTeacherEditor()) resumeTeacherEditor()
  const level = levelForModule(moduleId)
  if (!level) return
  const place = themeId ? themeForLesson(themeId) : null
  focusEditorLevel(level.id, place?.levelId === level.id ? place.subId : '')
}

function openSubThemeForm(parentId) {
  const parent = menuThemeRecord(parentId)
  if (!parent) return
  if (!isTeacherEditor()) resumeTeacherEditor()
  openThemeForm({ sectionId: parent.sectionId, parentId: parent.id })
}

function openThemeForm({ sectionId = '', themeId = '', parentId = '' } = {}) {
  const dialog = document.querySelector('#theme-dialog')
  const select = document.querySelector('#theme-parent')
  const title = document.querySelector('#theme-title')
  const heading = document.querySelector('#theme-heading')
  const remove = document.querySelector('#theme-delete')
  const sub = document.querySelector('#theme-sub')
  if (!dialog || !select || !title || !sub) return
  const record = themeId ? menuThemeRecord(themeId) : null
  const parent = !record && parentId ? menuThemeRecord(parentId) : null
  const owner = themeModalModule(record?.sectionId || parent?.sectionId || sectionId, themeId)
  select.replaceChildren()
  for (const section of menuSections()) {
    const option = document.createElement('option')
    option.value = section.id
    option.textContent = section.title
    select.append(option)
  }
  let current = record?.sectionId || parent?.sectionId || sectionId
  if (!moduleOfSection(current)) {
    const first = owner?.subchapters?.[0]
    current = first?.subchapterId || first?.id || ''
  }
  if (current && [...select.options].some((option) => option.value === current)) select.value = current
  select.disabled = Boolean(record && !record.custom)
  title.value = record?.title || ''
  dialog.dataset.themeId = record?.id || ''
  sub.checked = Boolean(record?.parentId || parent)
  syncEditorToThemeContext(moduleOfSection(select.value)?.moduleId || owner?.moduleId || '', record?.id || parent?.id || '')
  fillThemeParents(select.value, record?.id || '', record ? record.parentId || '' : parent?.id || '')
  const of = document.querySelector('#theme-of')
  if (of) of.disabled = !sub.checked
  if (heading) heading.textContent = record ? t('pedagogy.themeEdit') : parent ? t('pedagogy.themeSubAdd') : t('pedagogy.themeAdd')
  if (remove) remove.hidden = !record
  dialog.hidden = false
  title.focus()
  if (record) title.select()
}

function paintSidebarToggle() {
  const button = document.querySelector('#sidebar-toggle')
  const shell = document.querySelector('.shell')
  if (!button || !shell) return
  if (role !== 'teacher') shell.classList.remove('sidebar-collapsed')
  const collapsed = shell.classList.contains('sidebar-collapsed')
  button.hidden = role !== 'teacher'
  button.setAttribute('aria-expanded', String(!collapsed))
  const label = t(collapsed ? 'nav.sidebarExpand' : 'nav.sidebarCollapse')
  button.title = label
  button.setAttribute('aria-label', label)
  button.textContent = collapsed ? '›' : '‹'
}

function toggleSidebar() {
  if (role !== 'teacher') return
  document.querySelector('.shell')?.classList.toggle('sidebar-collapsed')
  paintSidebarToggle()
  drawBoard()
}

function closeThemeForm() {
  const dialog = document.querySelector('#theme-dialog')
  if (dialog) dialog.hidden = true
}

function saveThemeForm(event) {
  event.preventDefault()
  if (role !== 'teacher') return
  const title = document.querySelector('#theme-title').value.trim()
  const sectionId = document.querySelector('#theme-parent').value
  const themeId = document.querySelector('#theme-dialog').dataset.themeId || ''
  const asChild = document.querySelector('#theme-sub').checked
  const parentId = asChild ? document.querySelector('#theme-of').value : ''
  if (!title) {
    setStatus(t('pedagogy.themeNeedTitle'))
    return
  }
  if (!sectionId) return
  if (asChild && !parentId) {
    setStatus(t('pedagogy.themeNeedParent'))
    return
  }
  if (themeId) {
    updateMenuTheme(themeId, { title, sectionId, parentId })
    if (openProcedureId === themeId) {
      activityTitle.textContent = title
      const code = title.match(/^([A-Za-z]+\d+)\b/)
      if (code) badge.textContent = code[1].toUpperCase()
    }
    closeThemeForm()
    showProcedureToast(t('pedagogy.themeUpdated'))
    setStatus('')
    return
  }
  const theme = addMenuTheme({ title, sectionId, parentId })
  closeThemeForm()
  loadModule(theme.id)
  showProcedureToast(t('pedagogy.themeSaved'))
  setStatus('')
}

function removeThemeForm() {
  const themeId = document.querySelector('#theme-dialog')?.dataset.themeId || ''
  if (!themeId || role !== 'teacher') return
  if (!window.confirm(t('pedagogy.themeConfirm'))) return
  deleteMenuTheme(themeId)
  if (openProcedureId === themeId) closeProcedureCourse()
  closeThemeForm()
  setStatus('')
}

function paintSoundToggle() {
  const button = document.querySelector('#sound-toggle')
  if (!button) return
  const on = isSoundOn()
  button.setAttribute('aria-pressed', String(on))
  const label = t(on ? 'sound.on' : 'sound.off')
  button.setAttribute('aria-label', label)
  button.title = label
}

document.querySelector('#sound-toggle').addEventListener('click', () => {
  setSoundOn(!isSoundOn())
  paintSoundToggle()
})
paintSoundToggle()
mountAvatarDisplay(document.querySelector('#avatar-panel'))
bindGenderSelector(document)

document.querySelector('#test-retry').addEventListener('click', retryTest)
document.querySelector('#test-finish').addEventListener('click', finishTestLesson)
document.querySelector('#lesson-save').addEventListener('click', saveCurrentLesson)
document.querySelector('#lesson-export').addEventListener('click', exportCurrentLesson)
document.querySelector('#lesson-pick').addEventListener('change', (event) => {
  const id = event.target.value
  if (id) loadStoredLesson(id)
})
document.querySelector('#lesson-file').addEventListener('change', (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) loadLessonFile(file)
})

let lessonToast = 0

function flashLesson(message) {
  setStatus(message)
  const toast = document.querySelector('#toast')
  if (!toast) return
  toast.textContent = message
  toast.hidden = false
  clearTimeout(lessonToast)
  lessonToast = setTimeout(() => {
    toast.hidden = true
  }, 2800)
}

async function refreshLessonList(selected = '') {
  const select = document.querySelector('#lesson-pick')
  if (!select) return
  let names = []
  try {
    const data = await api('/api/list-lessons')
    names = Array.isArray(data.lessons) ? data.lessons : []
  } catch {
    names = []
  }
  const keep = selected || select.value
  select.replaceChildren()
  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = t('lesson.pick')
  select.append(empty)
  for (const id of names) {
    const option = document.createElement('option')
    option.value = id
    option.textContent = id
    select.append(option)
  }
  select.value = [...select.options].some((option) => option.value === keep) ? keep : ''
}

async function saveCurrentLesson() {
  rememberBuiltLesson()
  const lesson = captureLessonDocument()
  if (!lesson) {
    flashLesson(t('lesson.missing'))
    return
  }
  try {
    const result = await api('/api/save-lesson', { method: 'POST', body: lesson })
    await refreshLessonList(lesson.lessonId)
    flashLesson(result.message || t('lesson.saved', { id: lesson.lessonId }))
  } catch (error) {
    flashLesson(error.message)
  }
}

function rememberBuiltLesson() {
  if (builderTouched()) stampNarrative(builderSnapshot())
}

function exportBuiltLesson() {
  exportCurrentLesson()
}

function exportCurrentLesson() {
  rememberBuiltLesson()
  const lesson = captureLessonDocument()
  if (!lesson) {
    flashLesson(t('lesson.missing'))
    return
  }
  const blob = new Blob([`${JSON.stringify(lesson, null, 2)}\n`], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${lesson.lessonId}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  flashLesson(t('lesson.exported', { id: lesson.lessonId }))
}

async function loadStoredLesson(id) {
  try {
    const lesson = await api(`/api/lesson/${encodeURIComponent(id)}`)
    await openPackedLesson(lesson)
  } catch (error) {
    flashLesson(error.message)
  }
}

async function loadLessonFile(file) {
  try {
    const lesson = JSON.parse(await file.text())
    await openPackedLesson(lesson)
    await refreshLessonList(lesson.lessonId)
  } catch (error) {
    flashLesson(error.code === 'bad-id' ? t('lesson.badId') : t('lesson.invalid'))
  }
}

async function openPackedLesson(lesson) {
  if (!lesson || typeof lesson !== 'object' || !lesson.lessonId || !Array.isArray(lesson.steps)) {
    const error = new Error('invalid')
    error.code = 'invalid'
    throw error
  }
  const place = themeForLesson(lesson.lessonId)
  const level = place ? getLevels().find((item) => item.id === place.levelId) : null
  const sub = level?.subchapters?.find((item) => item.id === place.subId)
  const installed = installLessonPack(lesson, sectionsFromLesson(lesson, sub?.sections || {}))
  if (!installed) {
    const error = new Error('bad-id')
    error.code = 'bad-id'
    throw error
  }
  if (role === 'teacher') {
    setCurriculumLevel(installed.levelId)
    if (!isTeacherEditor()) openTeacherEditor(teacherEditorHooks())
    showLoadedLesson(installed.levelId, installed.subId)
  } else {
    showLessonSteps(installed.subId, 0)
    document.querySelector('#levels .pedagogy-body .pedagogy-go')?.click()
  }
  flashLesson(t('lesson.loaded'))
}

onLang(() => {
  paintMoveNav()
  paintTestSummary()
  if (piecePathActive()) {
    paintSoundToggle()
    refreshPiecePathChrome()
    drawBoard()
    return
  }
  paintSoundToggle()
  const success = document.querySelector('#success')
  if (success && !success.hidden) showSuccess()
  refreshEditorChrome()
  refreshLessonList()
  refreshCurriculum()
  const active = document.querySelector('#curriculum-root .nav-item.active')
  const reopen = trainMode
  if (isPedagogyOpen()) {
    refreshPedagogy()
  } else if (isMastersMode()) {
    refreshMasters()
  } else if (isLevelsMode()) {
    refreshLevels()
  } else if (openProcedureId || (active?.dataset.module && !reopen)) {
    saveOpenProcedure({ toast: false, onlyIfChanged: true })
    loadModule(openProcedureId || active.dataset.module)
  } else if (reopen) {
    openTrain(reopen)
  } else if (!task && !exam && !solver) {
    panelTitle.textContent = t(`modeTitle.${mode}`)
    showLesson(mode)
  }
  drawBoard()
  paintSidebarToggle()
  const motifEmpty = document.querySelector('#motif option[value=""]')
  if (motifEmpty) motifEmpty.textContent = t('motif.choose')
})

function showPedagogyReturn(show) {
  const button = document.querySelector('#pedagogy-return')
  if (!button) return
  button.hidden = !show
  button.textContent = t('pedagogy.return')
}

document.querySelector('#pedagogy-return').addEventListener('click', () => {
  showPedagogyReturn(false)
  resumePedagogy()
})

function studentPlayHooks(exit) {
  return {
    play(target) {
      studentEvalStep = pedagogyStepName()
      closePedagogy()
      showPedagogyReturn(true)
      if (target && typeof target === 'object') showTeacherDiagram(target)
      else loadModule(target)
    },
    exit: exit || (() => {
      studentEvalStep = ''
      showPedagogyReturn(false)
      writeView({ selectedLessonId: null, selectedStepId: 0 })
      markSidebarLesson('')
      openLevelSelector(readView().selectedLevelId)
    }),
    onStep(index) {
      writeView({ selectedStepId: index })
      scheduleLiveEval()
    },
  }
}

function presentEditorExercise(selection, hooks) {
  if (!selection?.levelId || !selection.subId) return false
  const level = getLevels().find((item) => item.id === selection.levelId)
  const sub = level?.subchapters?.find((item) => item.id === selection.subId)
  if (!level || !sub) return false
  const target = focusSavedExercise(document.querySelector('#levels'), level, sub, hooks, selection.sectionId, selection.itemIndex)
  if (!target) return false
  panelTitle.textContent = tx(level.title)
  activityTitle.textContent = tx(sub.title)
  hooks.play(target)
  return true
}

function openLevelSelector(focusId) {
  showPedagogyReturn(false)
  closePedagogy()
  const hooks = {
    onFocus(levelId) {
      writeView({ selectedLevelId: levelId, selectedLessonId: null, selectedStepId: 0 })
      markSidebarLesson('')
      if (levelId) setCurriculumLevel(levelId)
    },
    onOpen(nextLevel, sub) {
      panelTitle.textContent = tx(nextLevel.title)
      writeView({
        selectedLevelId: nextLevel.id,
        selectedLessonId: sub.id,
        selectedStepId: 0,
      })
      markSidebarLesson(sub.id)
      if (sub.id === 'test') {
        closePedagogy()
        loadModule('test')
        return
      }
      if (role === 'teacher') {
        showTeacherWorkspace(sub.id)
        return
      }
      activityTitle.textContent = tx(sub.title)
      openPedagogy(document.querySelector('#levels'), nextLevel, sub, { ...studentPlayHooks(), startStep: 0 })
    },
  }
  if (focusId) hooks.focusId = focusId
  openLevels(hooks)
}

loadLevels(document.querySelector('#levels'))

loadCurriculum(document.querySelector('#curriculum-root')).then(() => {
  refreshLessonList()
  setAvatarLevel(currentCurriculumLevel() || 'tabla')
  if (mode === 'analysis') showMasteryView()
}).catch((error) => {
  console.error(error)
  setStatus(t('status.curriculum'))
})

loadMasters(document.querySelector('#masters')).catch((error) => {
  console.error(error)
  setStatus(t('masters.loadError'))
})

document.querySelectorAll('.modes .mode').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.mode !== 'menu') leavePiecePath()
    setMode(button.dataset.mode)
    if (mode === 'learn') {
      clearTask()
      endTrain()
      leaveExercise()
      closeLevels()
      openMasters(turnApi, {
        prepare() {
          if (!interactive.whiteAtBottom) interactive.flip()
        },
      })
      return
    }
    if (mode === 'analysis') {
      const fromExercise = Boolean(solver)
      if (isMastersMode()) clearTask()
      closeMasters()
      endTrain()
      leaveExercise()
      if (fromExercise) clearTask()
      showMasteryView()
      return
    }
    if (isMastersMode()) clearTask()
    closeMasters()
    closeLevels()
    if (mode === 'train') openTrainMenu()
    if (task || exam || solver || train) return
    panelTitle.textContent = t(`modeTitle.${mode}`)
    showLesson(mode)
  })
})

document.querySelectorAll('.nav-item:not(.sub):not(.nav-parent)').forEach((button) => {
  button.addEventListener('click', () => {
    leavePiecePath()
    clearTask()
    endTrain()
    leaveExercise()
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'))
    button.classList.add('active')
    if (button.dataset.position === 'exercise') {
      fenInput.value = EXERCISE_FEN
      badge.textContent = 'EX-002 · N3'
    }
    closeLevels()
    if (button.id === 'focus-fen') {
      fenInput.focus()
      badge.textContent = 'FEN'
      activityTitle.textContent = t('nav.fen')
    }
    panelTitle.textContent = t(`modeTitle.${mode}`)
    showLesson(button.dataset.lesson || mode)
    drawBoard()
  })
})

document.querySelector('#nav-start').addEventListener('click', goToStart)
document.querySelector('#nav-prev').addEventListener('click', prevMove)
document.querySelector('#nav-play').addEventListener('click', toggleAutoPlay)
document.querySelector('#nav-next').addEventListener('click', nextMove)
document.querySelector('#nav-end').addEventListener('click', goToEnd)
historyFENs = [canonicalFen(currentFen() || START_FEN)]
currentMoveIndex = 0
liveFen = historyFENs[0]
paintMoveNav()

document.querySelector('#flip').addEventListener('click', () => {
  interactive.flip()
  drawBoard()
})

for (const field of ['#procedure-definition', '#procedure-prompt', '#procedure-line', '#procedure-bad']) {
  document.querySelector(field).addEventListener('blur', () => {
    saveOpenProcedure({ toast: true, onlyIfChanged: true })
  })
}
document.querySelector('#procedure-save').addEventListener('click', () => {
  saveOpenProcedure({ toast: true, onlyIfChanged: false })
})
document.querySelector('#procedure-next').addEventListener('click', () => {
  if (document.querySelector('#procedure-next').disabled) return
  advanceProcedure()
})
document.querySelector('#theme-form').addEventListener('submit', saveThemeForm)
document.querySelector('#theme-cancel').addEventListener('click', closeThemeForm)
document.querySelector('#theme-delete').addEventListener('click', removeThemeForm)
document.querySelector('#theme-sub').addEventListener('change', syncThemeParentControl)
document.querySelector('#theme-parent').addEventListener('change', () => {
  const sectionId = document.querySelector('#theme-parent').value
  const themeId = document.querySelector('#theme-dialog')?.dataset.themeId || ''
  const owner = moduleOfSection(sectionId)
  if (owner) syncEditorToThemeContext(owner.moduleId, themeId)
  if (!document.querySelector('#theme-sub')?.checked) return
  fillThemeParents(sectionId, themeId)
})
document.querySelector('#theme-dialog').addEventListener('click', (event) => {
  if (event.target.id === 'theme-dialog') closeThemeForm()
})
document.querySelector('#practice-tab-theory').addEventListener('click', () => showPracticeTab('theory'))
document.querySelector('#practice-tab-list').addEventListener('click', () => showPracticeTab('list'))
document.querySelector('#practice-add').addEventListener('click', () => openPracticeForm(null))
document.querySelector('#practice-form').addEventListener('submit', savePracticeForm)
document.querySelector('#practice-grid').addEventListener('submit', checkPracticeGrid)
document.querySelector('#practice-cancel').addEventListener('click', () => {
  practiceEditId = ''
  clearSequenceWarning('#practice-line-warn')
  document.querySelector('#practice-form').hidden = true
})
document.querySelector('#practice-line').addEventListener('input', () => {
  clearSequenceWarning('#practice-line-warn')
})
document.querySelector('#procedure-line').addEventListener('input', () => {
  clearSequenceWarning('#procedure-line-warn')
})
document.querySelector('#practice-delete').addEventListener('click', () => {
  confirmDeletePractice(practiceEditId)
})
document.querySelector('#practice-fen').addEventListener('input', previewPracticeFen)
document.querySelector('#practice-from-board').addEventListener('click', () => {
  document.querySelector('#practice-fen').value = fenInput.value.trim()
})
document.querySelector('#practice-show-board').addEventListener('click', () => {
  const fen = document.querySelector('#practice-fen').value.trim()
  if (!validateFen(fen).ok) {
    setStatus(t('pedagogy.practiceNeedFen'))
    return
  }
  fenInput.value = fen
  drawBoard()
  setStatus('')
})
document.querySelector('#practice-back').addEventListener('click', returnToThemeLesson)
fenInput.addEventListener('blur', () => {
  saveOpenProcedure({ toast: true, onlyIfChanged: true })
})
fenInput.addEventListener('input', () => {
  drawBoard()
  if (!applyingHistory && validateFen(currentFen()).ok) adoptFen(currentFen())
  if (!studentPlay()) return
  resultEl.replaceChildren()
  engineLine.textContent = ''
  resetLine()
  if (task?.expectMove) task = null
  if (solver) {
    solver = null
    solverEl.hidden = true
  }
})
evalButton.addEventListener('click', evaluate)
moveInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return
  if (train && !train.setup) playTrainNotation(moveInput.value)
  else if (solving()) submitAttempt()
  else evaluate()
})

if (mode === 'analysis' && !validateFen(fenInput.value).ok) fenInput.value = START_FEN
drawBoard()
statusEl.dataset.loading = '1'
if (mode !== 'analysis') setStatus(t('status.exercises'))

let role = 'child'
document.body.classList.add('student')
let continuation = []
let solutie = []
let currentStepIndex = 0
let stepFen = ''
let lineAttempts = 3
let replyTimer = 0
let replyLock = false
let replyEpoch = 0

function studentPlay() {
  return document.body.classList.contains('student')
}
let solver = null
let exerciseCatalog = null
let savingAttempt = false

const solverEl = document.querySelector('#solver')
const teacherEl = document.querySelector('#teacher')
const explainInput = document.querySelector('#explain')
const motifInput = document.querySelector('#motif')
const solverMoveInput = document.querySelector('#solver-move')
const attemptCount = document.querySelector('#attempt-count')
const submitAttemptButton = document.querySelector('#submit-attempt')
const retryAttemptButton = document.querySelector('#retry-attempt')

function solving() {
  return role === 'child' && solver?.id && !solver.closed
}

function leaveExercise() {
  solver = null
  solverEl.hidden = true
  teacherEl.hidden = true
  fenInput.readOnly = false
  evalButton.disabled = false
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Nu am putut vorbi cu baza de exerciții.')
  return data
}

function fillSelect(select, options, placeholder) {
  select.replaceChildren()
  if (placeholder) {
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = placeholder
    select.append(empty)
  }
  for (const option of options) {
    const node = document.createElement('option')
    node.value = option.value
    node.textContent = option.label
    select.append(node)
  }
}

function solverFen() {
  return solver?.startFen || currentFen()
}

function playOnFen(fen, text) {
  return playTypedMove(new Chess(fen), text)
}

function rememberSolverMove(played) {
  solverMoveInput.value = played.san
  moveInput.value = played.san
  if (currentFen() !== solverFen()) {
    fenInput.value = solverFen()
  }
  interactive.lastMove = { from: played.from, to: played.to }
  drawBoard()
  playMoveEffect(played)
  setStatus(t('status.moveOnBoard'))
}

function placeSolverMove(square) {
  const from = interactive.selected
  if (currentFen() !== solverFen()) {
    fenInput.value = solverFen()
    interactive.lastMove = null
    drawBoard()
  }
  let chess
  try {
    chess = new Chess(solverFen())
  } catch {
    return
  }
  if (!from) {
    const piece = chess.get(square)
    if (blockForeign(piece)) return
    if (!piece || piece.color !== chess.turn()) {
      if (piece) setStatus(t('status.toMove', { side: sideName(chess.turn()) }))
      return
    }
    markSelected(square)
    return
  }
  interactive.clearSelection()
  if (from === square) return
  const piece = chess.get(from)
  const promotion = piece?.type === 'p' && (square[1] === '8' || square[1] === '1') ? 'q' : undefined
  try {
    rememberSolverMove(chess.move({ from, to: square, promotion }))
  } catch {
    setStatus(t('status.otherPiece'))
  }
}

function moveIsLegal(fen, text) {
  try {
    return Boolean(playTypedMove(new Chess(fen), text))
  } catch {
    return false
  }
}

function showSolverFeedback(text, questions, { center = false } = {}) {
  resultEl.replaceChildren()
  const line = document.createElement('p')
  line.className = 'verdict'
  line.textContent = text
  resultEl.append(line)
  const hints = []
  for (const question of questions) {
    if (!question || question === text) continue
    hints.push(question)
    const hint = document.createElement('p')
    hint.className = 'hint-row'
    hint.textContent = question
    resultEl.append(hint)
  }
  if (center && document.body.classList.contains('student')) {
    showCheer('again', [text, ...hints].filter(Boolean).join('\n'), 6500)
  }
}

async function engineNudge(fen, move) {
  try {
    await engine.ready()
    const result = await engine.evaluateUserMove(fen, move, { depth: 8, multiPv: 1 })
    if (!result.legal) return ''
    if (result.userMateIn != null && result.userMateIn < 0) {
      return t('train.kingDanger')
    }
    if (result.lossCp != null && result.lossCp >= 80) {
      return t('train.forced')
    }
  } catch {
    return ''
  }
  return ''
}

function paintAttempt(item) {
  const left = item.triesLeft
  if (item.closed && item.lastVerdict === 'pass') {
    attemptCount.textContent = t('attempt.solved')
  } else if (item.closed) {
    attemptCount.textContent = t('attempt.closed')
  } else if (left === 1) {
    attemptCount.textContent = t('attempt.one')
  } else {
    attemptCount.textContent = t('attempt.left', { left })
  }
  submitAttemptButton.disabled = item.closed || left <= 0
  retryAttemptButton.hidden = !item.canRetry
  fenInput.readOnly = true
  evalButton.disabled = true
}

function showChild(item) {
  teacherEl.hidden = true
  solverEl.hidden = false
  solver = { id: item.id, closed: item.closed, startFen: item.fen }
  explainInput.value = ''
  motifInput.value = ''
  solverMoveInput.value = ''
  moveInput.value = ''
  paintAttempt(item)
}

function showTeacher(item) {
  solver = item?.id ? { id: item.id, editing: true } : { id: null, editing: true }
  solverEl.hidden = true
  teacherEl.hidden = false
  fenInput.readOnly = false
  evalButton.disabled = false
  document.querySelector('#ex-title').value = item?.title || ''
  document.querySelector('#ex-prompt').value = item?.prompt || 'Introdu mutarea, explică alegerea și selectează motivul tactic.'
  document.querySelector('#ex-competency').value = item?.competencyCode || 'C.SAC'
  document.querySelector('#ex-difficulty').value = String(item?.difficulty || 3)
  document.querySelector('#ex-motif').value = item?.motifCode || 'sacrifice'
  document.querySelector('#ex-solution').value = item?.solution || ''
  document.querySelector('#ex-concepts').value = (item?.concepts || []).join(', ')
  const hints = item?.hints || []
  document.querySelector('#ex-hint-1').value = hints[0] || ''
  document.querySelector('#ex-hint-2').value = hints[1] || ''
  document.querySelector('#ex-hint-3').value = hints[2] || ''
  document.querySelector('#ex-published').checked = item ? item.published : true
  document.querySelector('#ex-delete').hidden = !item?.id
  const log = document.querySelector('#attempt-log')
  log.replaceChildren()
  for (const attempt of item?.attempts || []) {
    const line = document.createElement('p')
    line.className = 'hint-row'
    line.textContent = `${attempt.tryNo}. ${attempt.move} · ${attempt.verdict}`
    log.append(line)
  }
}

function renderExerciseList(items) {
  const list = document.querySelector('#exercise-list')
  list.replaceChildren()
  if (!items.length) {
    const empty = document.createElement('p')
    empty.className = 'submenu-label'
    empty.textContent = t('nav.noExercise')
    list.append(empty)
    return
  }
  for (const item of items) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'nav-item sub'
    button.dataset.exercise = item.id
    if (solver?.id === item.id) button.classList.add('active')
    const title = document.createElement('strong')
    title.textContent = `${item.code} · ${item.title}`
    const meta = document.createElement('span')
    meta.textContent = t('attempt.level', { difficulty: item.difficulty, level: item.level }) + (item.published ? '' : t('attempt.draft'))
    button.append(title, meta)
    button.addEventListener('click', () => openExercise(item.id))
    list.append(button)
  }
}

async function refreshExercises() {
  const data = await api(`/api/exercises?role=${role}`)
  renderExerciseList(data.exercises)
  return data.exercises
}

async function openExercise(id) {
  hideSuccess()
  endTrain()
  const item = await api(`/api/exercises/${id}?role=${role}`)
  clearTask()
  document.querySelectorAll('.nav-item').forEach((node) => node.classList.remove('active'))
  document.querySelector(`[data-exercise="${id}"]`)?.classList.add('active')
  panelTitle.textContent = t('panel.exercises')
  activityTitle.textContent = item.title
  badge.textContent = t('attempt.badge', { code: item.code, ui: item.uiCode, difficulty: item.difficulty })
  lessonEl.textContent = `${item.prompt} ${t('teacher.competencyLine', { name: item.competencyTitle })}`
  fenInput.value = item.fen
  resultEl.replaceChildren()
  engineLine.textContent = ''
  showPosition(item.fen)
  if (role === 'teacher') showTeacher(item)
  else showChild(item)
  setStatus('')
}

function startNewExercise() {
  endTrain()
  clearTask()
  document.querySelectorAll('.nav-item').forEach((node) => node.classList.remove('active'))
  document.querySelector('#new-exercise').classList.add('active')
  panelTitle.textContent = t('panel.exercises')
  activityTitle.textContent = t('teacher.newTitle')
  badge.textContent = t('teacher.newBadge')
  lessonEl.textContent = t('teacher.newHint')
  fenInput.value = START_FEN
  resultEl.replaceChildren()
  drawBoard()
  showTeacher(null)
}

async function submitAttempt() {
  if (!solving() || savingAttempt) return
  const typed = solverMoveInput.value.trim() || moveInput.value.trim()
  const explanation = explainInput.value.trim()
  const motifCode = motifInput.value
  if (!typed) {
    setStatus(t('status.putMove'))
    return
  }
  if (!explanation) {
    setStatus(t('status.writeWhy'))
    return
  }
  if (!motifCode) {
    setStatus(t('status.pickMotif'))
    return
  }
  const fen = solverFen()
  let played = null
  try {
    played = playOnFen(fen, typed)
  } catch {
    played = null
  }
  if (!played) {
    showSolverFeedback(t('status.ownPiece'), [coachQuestion(new Chess(fen))], { center: true })
    setStatus(t('status.illegal'))
    return
  }
  const move = played.san
  solverMoveInput.value = move
  moveInput.value = move

  savingAttempt = true
  submitAttemptButton.disabled = true
  setStatus(t('status.checking'))
  try {
    const result = await api(`/api/exercises/${solver.id}/attempt`, {
      method: 'POST',
      body: { move, explanation, motifCode },
    })
    const questions = []
    if (result.verdict !== 'pass') {
      if (result.hint && !result.feedback.includes(result.hint)) questions.push(result.hint)
      const question = coachQuestion(new Chess(fen))
      if (question && question !== result.hint && question !== result.feedback) questions.push(question)
      const nudge = await engineNudge(fen, move)
      if (nudge) questions.push(nudge)
    }
    if (result.verdict === 'pass') {
      fenInput.value = played.after
      interactive.lastMove = { from: played.from, to: played.to }
      drawBoard()
      playExerciseEnd()
      showSuccess()
    } else if (!result.moveOk || !result.motifOk) {
      fenInput.value = fen
      interactive.lastMove = null
      drawBoard()
      showSolverFeedback(result.feedback, questions, { center: true })
    } else {
      showSolverFeedback(result.feedback, questions, { center: true })
    }
    solver.closed = result.closed
    paintAttempt({
      triesLeft: result.triesLeft,
      closed: result.closed,
      canRetry: result.closed,
      lastVerdict: result.closed ? result.verdict : null,
    })
    setStatus(result.verdict === 'pass' ? t('status.correct') : t('status.retry'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
    submitAttemptButton.disabled = false
  } finally {
    savingAttempt = false
  }
}

async function saveExercise(event) {
  event.preventDefault()
  const fen = fenInput.value.trim()
  const check = validateFen(fen)
  if (!check.ok) {
    setStatus(check.error)
    return
  }
  const solution = document.querySelector('#ex-solution').value.trim()
  if (!solution) {
    setStatus(t('teacher.needLine'))
    return
  }
  try {
    const first = solution.split(/\s*(?:,|\/|\bsau\b)\s*/i)[0].trim().split(/\s+/)[0]
    if (!moveIsLegal(fen, first)) {
      setStatus(t('teacher.badFirst'))
      return
    }
  } catch {
    setStatus(t('teacher.badFirst'))
    return
  }
  const body = {
    title: document.querySelector('#ex-title').value,
    prompt: document.querySelector('#ex-prompt').value,
    fen,
    competencyCode: document.querySelector('#ex-competency').value,
    difficulty: Number(document.querySelector('#ex-difficulty').value),
    motifCode: document.querySelector('#ex-motif').value,
    solution,
    concepts: document.querySelector('#ex-concepts').value,
    hints: [
      document.querySelector('#ex-hint-1').value,
      document.querySelector('#ex-hint-2').value,
      document.querySelector('#ex-hint-3').value,
    ],
    published: document.querySelector('#ex-published').checked,
  }
  setStatus(t('teacher.saving'))
  try {
    const saved = solver?.id
      ? await api(`/api/exercises/${solver.id}`, { method: 'PUT', body })
      : await api('/api/exercises', { method: 'POST', body })
    await refreshExercises()
    await openExercise(saved.id)
    setStatus(t('teacher.saved'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
  }
}

document.querySelectorAll('.role').forEach((button) => {
  button.addEventListener('click', async () => {
    const procedureId = openProcedureId
    const nextRole = button.dataset.role
    if (procedureId && role === 'teacher' && nextRole === 'child') {
      saveOpenProcedure({ toast: false, onlyIfChanged: true })
    }
    role = nextRole
    document.querySelectorAll('.role').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelector('#new-exercise').hidden = role !== 'teacher'
    setCurriculumStudent(role === 'child')
    document.body.classList.toggle('student', role !== 'teacher')
    if (role === 'child' && isTeacherEditor()) {
      const savedMove = document.querySelector('#ed-move')?.value.trim()
      const savedPgn = document.querySelector('#ed-pgn')?.value.trim()
      const sectionNow = editorSelection()?.sectionId
      if ((sectionNow === 'practice' || sectionNow === 'evaluation') && savedMove) {
        const testing = sectionNow === 'evaluation'
        const maxAttempts = Number(document.querySelector('#ed-attempts')?.value) || 3
        const timeLimitSec = Number(document.querySelector('#ed-time')?.value) || 0
        const scoreWeight = Number(document.querySelector('#ed-weight')?.value) || 1
        const selection = flushEditor()
        closeTeacherEditor()
        interactive.draggable = true
        document.body.classList.add('student')
        resultEl.replaceChildren()
        engineLine.textContent = ''
        const shown = presentEditorExercise(selection, studentPlayHooks())
        if (!shown && currentFen()) {
          const start = document.querySelector('#ed-fen')?.value.trim() || currentFen()
          const target = { training: !testing, testing, maxAttempts, timeLimitSec, scoreWeight }
          const line = startLine(start, solutionSource(start, { correctMove: savedMove, pgn: savedPgn }), target)
          learnerSide = line.length ? sideToMove(start) : ''
          task = {
            expectMove: {
              san: line[0] || savedMove,
              ok: testing ? t('pedagogy.testPass') : t('pedagogy.moveSolved'),
              bad: t('pedagogy.tryAgain'),
              training: !testing,
              testing,
              maxAttempts,
              timeLimitSec,
              scoreWeight,
            },
          }
          if (testing && line.length) beginTest(target, start, line)
        }
        paintSidebarToggle()
        return
      }
    }
    if (mode === 'analysis') {
      const lessonId = readView().selectedLessonId || procedureId
      if (role === 'teacher') showTeacherWorkspace(lessonId)
      else showCopilLesson(lessonId)
      paintSidebarToggle()
      return
    }
    if (procedureId) {
      leaveExercise()
      closeTeacherEditor()
      document.body.classList.toggle('student', role !== 'teacher')
      showProcedureCourse(resolveInteractiveLesson(procedureId, lessonCatalogs(), {
        title: lessonTitle(procedureId),
        fen: fenInput.value,
      }))
      paintSidebarToggle()
      return
    }
    leaveExercise()
    if (role === 'teacher' && isProcedureExamples()) {
      document.body.classList.remove('student')
      interactive.draggable = true
      refreshPedagogy()
      paintSidebarToggle()
      return
    }
    if (role === 'teacher') {
      clearTask()
      document.body.classList.remove('student')
      closeLevels()
      closePedagogy()
      interactive.draggable = true
      openTeacherEditor(teacherEditorHooks())
      const activeLesson = document.querySelector('#curriculum-root .nav-item.active')?.dataset.module
      if (activeLesson) syncEditorToLesson(activeLesson)
    } else {
      const savedMove = document.querySelector('#ed-move')?.value.trim()
      const savedPgn = document.querySelector('#ed-pgn')?.value.trim()
      const selection = flushEditor()
      closeTeacherEditor()
      interactive.draggable = true
      document.body.classList.add('student')
      resultEl.replaceChildren()
      engineLine.textContent = ''
      const shown = presentEditorExercise(selection, studentPlayHooks())
      if (!shown && savedMove && currentFen()) {
        const practice = selection?.sectionId === 'practice'
        const testing = selection?.sectionId === 'evaluation'
        const line = startLine(currentFen(), solutionSource(currentFen(), { correctMove: savedMove, pgn: savedPgn }), { ok: t('status.correct'), bad: t('status.retry'), maxAttempts: Number(document.querySelector('#ed-attempts')?.value) || 3 })
        learnerSide = line.length ? sideToMove(currentFen()) : ''
        task = {
          expectMove: {
            san: line[0] || savedMove,
            ok: testing ? t('pedagogy.testPass') : (practice ? t('pedagogy.moveSolved') : t('status.correct')),
            bad: practice || testing ? t('pedagogy.tryAgain') : t('status.retry'),
            training: practice,
            testing,
          },
        }
        if (testing && line.length) beginTest({ maxAttempts: Number(document.querySelector('#ed-attempts')?.value) || 3, timeLimitSec: Number(document.querySelector('#ed-time')?.value) || 0, scoreWeight: Number(document.querySelector('#ed-weight')?.value) || 1 }, currentFen(), line)
      }
      if (solver) {
        solver = null
        solverEl.hidden = true
      }
    }
    paintSidebarToggle()
    try {
      const items = await refreshExercises()
      if (role === 'teacher') {
        panelTitle.textContent = 'Exerciții'
        setStatus('')
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  })
})

document.querySelector('#sidebar-toggle').addEventListener('click', toggleSidebar)
paintSidebarToggle()
document.querySelector('#teacher').addEventListener('submit', saveExercise)
bindTeacherEditor()
submitAttemptButton.addEventListener('click', submitAttempt)
document.querySelector('#success-next').addEventListener('click', advanceExercise)
retryAttemptButton.addEventListener('click', async () => {
  if (!solver?.id) return
  try {
    const item = await api(`/api/exercises/${solver.id}/retry`, { method: 'POST' })
    showChild(item)
    resultEl.replaceChildren()
    setStatus(t('status.restartTries'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
  }
})
document.querySelector('#ex-delete').addEventListener('click', async () => {
  if (!solver?.id) return
  if (!window.confirm(t('status.confirmDelete'))) return
  try {
    await api(`/api/exercises/${solver.id}`, { method: 'DELETE' })
    leaveExercise()
    await refreshExercises()
    lessonEl.textContent = t('status.deletedText')
    setStatus(t('status.deleted'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
  }
})

async function bootExercises() {
  try {
    exerciseCatalog = await api('/api/catalog')
    fillSelect(
      document.querySelector('#ex-competency'),
      exerciseCatalog.competencies.map((item) => ({
        value: item.code,
        label: `${item.code} · ${item.title}`,
      })),
    )
    fillSelect(
      document.querySelector('#ex-difficulty'),
      exerciseCatalog.levels.map((item) => ({
        value: String(item.value),
        label: `${item.value} · ${item.label}`,
      })),
    )
    const motifOptions = exerciseCatalog.motifs.map((item) => ({ value: item.code, label: item.title }))
    fillSelect(document.querySelector('#ex-motif'), motifOptions)
    fillSelect(motifInput, motifOptions, t('motif.choose'))
    await refreshExercises()
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err))
  }
}

bootExercises()
engine.ready().then(() => {
  if (!statusEl.textContent || statusEl.dataset.loading === '1') {
    statusEl.dataset.loading = ''
    setStatus(t('status.engineReady'))
  }
}).catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err))
})
