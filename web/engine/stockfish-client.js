// Client Stockfish 19 lite, un fir, WebAssembly.
// Binarele sunt build-ul oficial stockfish.js (GPLv3): stockfish-19-lite-single.js/.wasm.

import { Chess, validateFen } from '../vendor/chess.js'
import { collectSearch, lossInCentipawns, scoreForMover } from './uci.js'

const WORKER_URL = new URL('./stockfish-19-lite-single.js', import.meta.url)

function playUserMove(fen, moveText) {
  const check = validateFen(fen.trim())
  if (!check.ok) {
    throw new Error(check.error)
  }

  const chess = new Chess(fen.trim())
  const text = moveText.trim()
  const uci = /^[a-h][1-8][a-h][1-8][qrbn]?$/i.exec(text)
  const played = uci
    ? chess.move({
        from: uci[0].slice(0, 2).toLowerCase(),
        to: uci[0].slice(2, 4).toLowerCase(),
        promotion: uci[0][4]?.toLowerCase(),
      })
    : chess.move(text)

  return {
    san: played.san,
    uci: played.lan,
    fenAfter: played.after,
  }
}

function withSan(fen, line) {
  const chess = new Chess(fen)
  const pvSan = []
  for (const uci of line.pv) {
    try {
      const played = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      })
      pvSan.push(played.san)
    } catch {
      pvSan.push(uci)
      break
    }
  }
  return { ...line, san: pvSan[0] || line.move, pvSan }
}

export class StockfishClient {
  #worker
  #pending = null
  #chain = Promise.resolve()
  #ready
  #restarting = false
  #liveId = 0

  constructor() {
    this.#bootWorker()
  }

  #bootWorker() {
    this.#worker = new Worker(WORKER_URL)
    this.#worker.onmessage = (event) => this.#onMessage(event.data)
    this.#worker.onerror = (event) => {
      const reason = this.#pending?.failReason
      const detail = reason || event.error?.message || event.message || 'Stockfish nu a putut porni'
      this.#fail(new Error(detail))
    }
    this.#ready = this.#boot()
  }

  ready() {
    return this.#ready
  }

  analyze(fen, options = {}) {
    this.#cancelLive()
    return this.#enqueue(() => this.#analyze(fen, options))
  }

  requestLive(fen, options = {}) {
    const id = ++this.#liveId
    if (this.#pending?.live) this.#worker.postMessage('stop')
    const promise = this.#enqueue(async () => {
      if (id !== this.#liveId) return null
      const check = validateFen(String(fen || '').trim())
      if (!check.ok) return null
      return this.#analyze(fen, { depth: options.depth ?? 15, multiPv: 1, live: true })
    })
    return { id, promise }
  }

  stopLive() {
    this.#cancelLive()
  }

  #cancelLive() {
    this.#liveId += 1
    if (this.#pending?.live) this.#worker.postMessage('stop')
  }

  async evaluateUserMove(fen, moveText, options = {}) {
    const position = await this.analyze(fen, options)
    let played = null
    let error = null
    try {
      played = playUserMove(fen, moveText)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      error = raw.startsWith('Invalid move') ? 'Mutarea nu este legală în poziție.' : raw
    }

    if (!played) {
      return {
        ...position,
        legal: false,
        error,
        userMove: null,
        userEvaluationCp: null,
        userMateIn: null,
        lossCp: null,
        matchesBest: false,
        replyTimeMs: null,
      }
    }

    const after = await this.analyze(played.fenAfter, options)
    const fromMover = scoreForMover(after.lines[0])
    const best = position.lines[0] || null
    return {
      ...position,
      legal: true,
      error: null,
      userMove: { san: played.san, uci: played.uci },
      userEvaluationCp: fromMover.evaluationCp,
      userMateIn: fromMover.mateIn,
      lossCp: lossInCentipawns(best, fromMover),
      matchesBest: played.uci === position.bestMove,
      replyTimeMs: after.timeMs,
    }
  }

  terminate() {
    this.#worker.terminate()
  }

  async #boot() {
    await this.#waitFor('uci', (line) => line === 'uciok', 30000)
    await this.#waitFor('isready', (line) => line === 'readyok', 30000)
  }

  #enqueue(task) {
    const run = this.#chain.then(task, task)
    this.#chain = run.then(() => {}, () => {})
    return run
  }

  async #analyze(fen, options) {
    const check = validateFen(fen.trim())
    if (!check.ok) throw new Error(check.error)

    const depth = options.depth ?? 12
    const multiPv = options.multiPv ?? 3
    const cleanFen = fen.trim()
    const started = performance.now()

    this.#worker.postMessage(`setoption name MultiPV value ${multiPv}`)
    this.#worker.postMessage(`position fen ${cleanFen}`)
    const output = await this.#waitFor(
      `go depth ${depth}`,
      (line) => line.startsWith('bestmove'),
      120000,
      options.onProgress,
      Boolean(options.live),
    )
    const search = collectSearch(output)
    const measured = Math.max(0, Math.round(performance.now() - started))
    return {
      fen: cleanFen,
      bestMove: search.bestMove,
      depth: search.depth,
      timeMs: search.timeMs > 0 ? search.timeMs : measured,
      lines: search.lines.map((line) => withSan(cleanFen, line)),
    }
  }

  #waitFor(command, isDone, timeoutMs, onProgress, live = false) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.#pending) this.#pending = null
        reject(new Error(`Motorul nu a răspuns la „${command}”`))
      }, timeoutMs)

      this.#pending = {
        isDone,
        onProgress,
        live,
        lines: [],
        resolve: (lines) => {
          clearTimeout(timer)
          resolve(lines)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      }
      this.#worker.postMessage(command)
    })
  }

  #onMessage(data) {
    const pending = this.#pending
    if (!pending) return

    for (const raw of String(data).split(/\n/)) {
      const line = raw.trim()
      if (!line) continue
      pending.lines.push(line)
      const info = line.startsWith('info ') ? /(?:^|\s)depth (\d+)/.exec(line) : null
      if (info && pending.onProgress) {
        pending.onProgress({ depth: Number(info[1]) })
      }
      if (/Invalid FEN|CRITICAL ERROR/.test(line)) {
        pending.failReason = /32 pieces/.test(line)
          ? 'Poziția are mai mult de 32 de piese. Motorul nu poate răspunde.'
          : line.replace(/^info string\s*/, '')
      }
      if (pending.isDone(line)) {
        this.#pending = null
        if (line.includes('bestmove (none)') && pending.failReason) pending.reject(new Error(pending.failReason))
        else pending.resolve(pending.lines)
        return
      }
    }
  }

  #fail(error) {
    const pending = this.#pending
    this.#pending = null
    if (pending) pending.reject(error)
    try {
      this.#worker.terminate()
    } catch {
      // Firul s-a închis deja după o poziție refuzată.
    }
    if (this.#restarting) return
    this.#restarting = true
    this.#bootWorker()
    this.#ready.finally(() => {
      this.#restarting = false
    })
  }
}
