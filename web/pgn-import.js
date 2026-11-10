// Import PGN: împarte fișierul în partide și reia linia principală cu chess.js.
// Nu atinge DOM-ul. Montarea de mai jos doar leagă formularul de aceste funcții.

export const MAX_PGN_BYTES = 1_500_000
const MAX_GAMES = 30

const HEADER_KEYS = ['Event', 'White', 'Black', 'Result', 'Date', 'FEN', 'Opening']
const HEADER_LINE = /^\[[A-Za-z0-9_]+\s+".*"\]$/
const MOVE_TOKEN = /(?:O-O-O|0-0-0|O-O|0-0|(?:[KQRBN])?[a-h](?:x[a-h])?[1-8])/i
const RESULT_TOKEN = /^(?:1-0|0-1|1\/2-1\/2|\*)$/
const MOVE_NUMBER = /^\d+\.+$/

function stripBlocks(text, state) {
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (state.brace > 0) {
      if (ch === '}') state.brace = 0
      continue
    }
    if (state.paren > 0) {
      if (ch === '{') state.brace = 1
      else if (ch === '(') state.paren += 1
      else if (ch === ')') state.paren -= 1
      continue
    }
    if (ch === ';') {
      out += ' '
      while (i + 1 < text.length && text[i + 1] !== '\n') i += 1
      continue
    }
    if (ch === '{') {
      state.brace = 1
      out += ' '
      continue
    }
    if (ch === '(') {
      state.paren = 1
      out += ' '
      continue
    }
    out += ch
  }
  return out
}

export function cleanPgnText(source) {
  const text = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  return stripBlocks(text, { brace: 0, paren: 0 })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

export function mainlineMoves(cleaned) {
  const moves = []
  for (const raw of String(cleaned || '').split(/\s+/)) {
    if (!raw || RESULT_TOKEN.test(raw) || MOVE_NUMBER.test(raw)) continue
    let token = raw.replace(/^\d+\.+/, '')
    token = token.replace(/\$\d+/g, '')
    token = token.replace(/[!?]+/g, '')
    if (!token || RESULT_TOKEN.test(token) || MOVE_NUMBER.test(token)) continue
    if (/^0-0-0$/i.test(token)) token = 'O-O-O'
    else if (/^0-0$/i.test(token)) token = 'O-O'
    moves.push(token)
  }
  return moves
}

function headerAndBody(source) {
  const lines = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const headerLines = []
  let index = 0
  while (index < lines.length && !lines[index].trim()) index += 1
  while (index < lines.length && HEADER_LINE.test(lines[index].trim())) {
    headerLines.push(lines[index].trim())
    index += 1
  }
  const headers = {}
  for (const line of headerLines) {
    const match = line.match(/^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/)
    if (match && HEADER_KEYS.includes(match[1])) headers[match[1]] = match[2]
  }
  return { headers, body: lines.slice(index).join('\n') }
}

export function splitPgnGames(source) {
  const text = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const games = []
  let chunk = []
  let sawMoves = false
  const state = { brace: 0, paren: 0 }
  for (const line of text.split('\n')) {
    const atRoot = state.brace === 0 && state.paren === 0
    const header = atRoot && HEADER_LINE.test(line.trim())
    if (header && sawMoves && chunk.length) {
      games.push(chunk.join('\n').trim())
      chunk = []
      sawMoves = false
      if (games.length >= MAX_GAMES) return games
    }
    const visible = stripBlocks(line, state)
    if (!header && MOVE_TOKEN.test(visible)) sawMoves = true
    chunk.push(line)
  }
  const last = chunk.join('\n').trim()
  if (last && games.length < MAX_GAMES) games.push(last)
  return games
}

function playedGame(chess, headers) {
  const history = chess.history({ verbose: true })
  if (!history.length) return { ok: false, error: 'nomoves' }
  return {
    ok: true,
    headers,
    startFen: history[0].before,
    san: history.map((move) => move.san),
    ply: history.length,
  }
}

function playMainline(Chess, headers, moves) {
  const chess = new Chess()
  if (headers.FEN) {
    try {
      chess.load(headers.FEN)
    } catch {
      return { ok: false, error: 'invalid' }
    }
  }
  for (const move of moves) {
    try {
      if (!chess.move(move)) return { ok: false, error: 'invalid' }
    } catch {
      return { ok: false, error: 'invalid' }
    }
  }
  return playedGame(chess, headers)
}

export function readPgnGame(Chess, source) {
  const text = String(source || '').trim()
  if (!text) return { ok: false, error: 'empty' }
  const { headers, body } = headerAndBody(text)
  const moves = mainlineMoves(cleanPgnText(body))
  if (!moves.length) return { ok: false, error: 'nomoves' }
  return playMainline(Chess, headers, moves)
}

export function readPgnFile(Chess, source) {
  if (String(source || '').length > MAX_PGN_BYTES) return { ok: false, error: 'tooBig', games: [], skipped: 0 }
  const chunks = splitPgnGames(source)
  if (!chunks.length) return { ok: false, error: 'empty', games: [], skipped: 0 }
  const games = []
  let error = 'invalid'
  for (const chunk of chunks) {
    const game = readPgnGame(Chess, chunk)
    if (game.ok) games.push(game)
    else error = game.error
  }
  if (!games.length) return { ok: false, error, games: [], skipped: chunks.length }
  return { ok: true, games, skipped: chunks.length - games.length }
}

export function pgnGameTitle(headers, index) {
  return {
    n: index + 1,
    white: headers?.White || '',
    black: headers?.Black || '',
    result: headers?.Result && headers.Result !== '*' ? headers.Result : '',
  }
}

export function mountPgnImport(hooks) {
  const root = document.querySelector('#pgn-import')
  const text = document.querySelector('#pgn-text')
  const file = document.querySelector('#pgn-file')
  const load = document.querySelector('#pgn-load')
  const status = document.querySelector('#pgn-status')
  const list = document.querySelector('#pgn-games')
  if (!root || !text || !file || !load || !status || !list) {
    return { show() {}, hide() {}, refresh() {} }
  }
  let pack = null
  let selected = -1
  let note = null

  function paintStatus() {
    if (!note) {
      status.textContent = ''
      status.classList.remove('is-error', 'is-ok')
      return
    }
    status.textContent = hooks.text?.(note.key, note.vars) || ''
    status.classList.toggle('is-error', note.kind === 'error')
    status.classList.toggle('is-ok', note.kind === 'ok')
  }

  function setNote(kind, key, vars) {
    note = { kind, key, vars }
    paintStatus()
  }

  function paintList() {
    list.replaceChildren()
    if (!pack?.games?.length) {
      list.hidden = true
      return
    }
    list.hidden = false
    pack.games.forEach((game, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-pressed', String(index === selected))
      const title = pgnGameTitle(game.headers, index)
      button.textContent = hooks.label?.(title) || `${title.n}. ${title.white} – ${title.black}`
      button.addEventListener('click', () => choose(index, true))
      list.append(button)
    })
  }

  function choose(index, sound) {
    const game = pack?.games?.[index]
    if (!game) return
    selected = index
    paintList()
    setNote(pack.skipped ? 'error' : 'ok', pack.skipped ? 'pgn.skipped' : 'pgn.ready', { n: pack.skipped })
    hooks.onGame?.(game, { sound })
  }

  function loadText(source) {
    const result = readPgnFile(hooks.Chess, source)
    if (!result.ok) {
      pack = null
      selected = -1
      paintList()
      const key = { empty: 'pgn.empty', nomoves: 'pgn.nomoves', tooBig: 'pgn.tooBig' }[result.error] || 'pgn.invalid'
      setNote('error', key)
      return
    }
    pack = result
    choose(0, true)
  }

  load.addEventListener('click', () => loadText(text.value))
  file.addEventListener('change', () => {
    const picked = file.files?.[0]
    file.value = ''
    if (!picked) return
    if (picked.size > MAX_PGN_BYTES) {
      setNote('error', 'pgn.tooBig')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      text.value = String(reader.result || '')
      loadText(text.value)
    }
    reader.onerror = () => setNote('error', 'pgn.readError')
    reader.readAsText(picked)
  })

  return {
    show() {
      root.hidden = false
      paintList()
      paintStatus()
      const game = selected >= 0 ? pack?.games?.[selected] : null
      if (game) hooks.onCaption?.(game)
    },
    hide() {
      root.hidden = true
    },
    refresh() {
      paintList()
      paintStatus()
    },
  }
}
