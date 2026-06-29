/**
 * Ancient Go - Web UI
 * Browser entry point. Renders board, handles clicks, orchestrates AI.
 */
import {
  EMPTY, BLACK, WHITE, createInitialState, placeStone, pass, resign,
  countScore, computeTerritoryMap, isValidMove, getNeighbors, findGroup, countLiberties,
  isValidMoveForColor, undo, redo, canUndo, canRedo, undoMultiple,
} from "../engine.ts"
import type { GameState, Cell } from "../engine.ts"
import { setBotDeps, createRandomBot, createGreedyBot, createHeuristicBot, createMCTSBot } from "../bots.ts"
import type { Bot } from "../bots.ts"
import { exportSGF, importSGF } from "../sgf.ts"

setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor)

interface AppState {
  game: GameState
  bot: Bot | null
  playerColor: typeof BLACK | typeof WHITE
  size: number
  level: number
  busy: boolean
}

export const BOT_FACTORIES: Record<number, () => Bot> = {
  1: createRandomBot,
  2: createGreedyBot,
  3: createHeuristicBot,
  4: createMCTSBot,
}

export const S: AppState = {
  game: createInitialState(9),
  bot: null,
  playerColor: BLACK,
  size: 9,
  level: 3,
  busy: false,
}

export let $board: HTMLElement
export let $status: HTMLElement
export let $overlay: HTMLElement
export let $modalTitle: HTMLElement
export let $modalScores: HTMLElement
export let grid: HTMLElement[][] = []
export let $sizeSelect: HTMLSelectElement
export let $levelSelect: HTMLSelectElement
export let $colorSelect: HTMLSelectElement

export function stoneSymbol(color: Cell): string {
  return color === BLACK ? "\u25CF" : "\u25CB"
}

export function getActiveBot(): Bot | null {
  if (S.bot === null) return null
  return S.game.currentPlayer === S.playerColor ? null : S.bot
}

export function isStarPoint(r: number, c: number, size: number): boolean {
  if (size === 9) return [2, 4, 6].includes(r) && [2, 4, 6].includes(c)
  if (size === 13) return [3, 6, 9].includes(r) && [3, 6, 9].includes(c)
  if (size === 19) { const s = [3, 9, 15]; return s.includes(r) && s.includes(c) }
  return false
}

export function buildGrid(size: number): void {
  $board.innerHTML = ""
  $board.style.gridTemplateColumns = "repeat(" + size + ", var(--cell-size))"
  grid = []

  for (let r = 0; r < size; r++) {
    const row: HTMLElement[] = []
    for (let c = 0; c < size; c++) {
      const cell = document.createElement("div")
      cell.className = "intersection"
      cell.dataset.r = String(r)
      cell.dataset.c = String(c)

      if (r === 0) cell.classList.add("edge-top")
      if (r === size - 1) cell.classList.add("edge-bottom")
      if (c === 0) cell.classList.add("edge-left")
      if (c === size - 1) cell.classList.add("edge-right")

      if (isStarPoint(r, c, size)) {
        cell.classList.add("star-point")
        const dot = document.createElement("div")
        dot.className = "star-dot"
        cell.appendChild(dot)
      }

      const ghost = document.createElement("div")
      ghost.className = "ghost " + (S.playerColor === BLACK ? "black" : "white")
      cell.appendChild(ghost)

      cell.addEventListener("click", () => onCellClick(r, c))
      $board.appendChild(cell)
      row.push(cell)
    }
    grid.push(row)
  }
}

export function renderStones(): void {
  const { board, size, lastMove } = S.game
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = grid[r][c]
      if (!cell) continue
      const existing = cell.querySelector(".stone")
      if (existing) existing.remove()

      const val = board[r][c]
      if (val === EMPTY) continue

      const stone = document.createElement("div")
      stone.className = "stone " + (val === BLACK ? "black" : "white")
      if (lastMove && lastMove.r === r && lastMove.c === c) {
        stone.classList.add("last-move")
      }
      cell.appendChild(stone)
    }
  }
}

export function updateGhostColor(): void {
  const cls = S.playerColor === BLACK ? "black" : "white"
  for (let r = 0; r < S.size; r++) {
    for (let c = 0; c < S.size; c++) {
      const ghost = grid[r]?.[c]?.querySelector(".ghost")
      if (ghost) ghost.className = "ghost " + cls
    }
  }
}

export function renderStatus(): void {
  const { game } = S
  const cur = game.currentPlayer
  const curSymbol = stoneSymbol(cur)
  const curName = cur === BLACK ? "Black" : "White"
  const bSymbol = stoneSymbol(BLACK)
  const wSymbol = stoneSymbol(WHITE)
  const isBot = getActiveBot() !== null

  let html = ""
  html += '<div class="turn-label">' + (isBot ? "AI thinking..." : "Your turn") + " \u2014 " + curSymbol + " " + curName + "</div>"
  html += '<div class="captures">Captures  ' + bSymbol + " " + game.captures[BLACK] + "  " + wSymbol + " " + game.captures[WHITE] + "</div>"

  // Live score estimate
  const score = countScore(game)
  const diff = score.blackScore - score.whiteScore
  const diffStr = diff >= 0
    ? "B+" + (diff === Math.floor(diff) ? String(diff) : diff.toFixed(1))
    : "W+" + (Math.abs(diff) === Math.floor(Math.abs(diff)) ? String(Math.abs(diff)) : Math.abs(diff).toFixed(1))
  html += '<div class="score-line">Score  ' + bSymbol + " " + score.blackScore.toFixed(1) + " | " + wSymbol + " " + score.whiteScore.toFixed(1) + " (" + diffStr + ")</div>"

  if (game.consecutivePasses > 0) {
    html += '<div class="captures">Passes ' + game.consecutivePasses + "/2</div>"
  }
  if (game.lastMove) {
    const col = String.fromCharCode(65 + game.lastMove.c)
    const row = game.size - game.lastMove.r
    html += '<div class="last-move">Last: ' + col + row + "</div>"
  } else if (game.moveCount > 0) {
    html += '<div class="last-move">Last: pass</div>'
  }

  $status.innerHTML = html
}

export function showGameOver(): void {
  const score = countScore(S.game)
  const bSymbol = stoneSymbol(BLACK)
  const wSymbol = stoneSymbol(WHITE)

  $modalTitle.textContent = "Game Over!"
  $modalScores.innerHTML =
    '<div class="score-line">' + bSymbol + " Black: " + score.blackScore + "</div>" +
    '<div class="score-line">' + wSymbol + " White: " + score.whiteScore + "</div>" +
    "<p>" + (score.blackScore > score.whiteScore ? bSymbol + " Black wins!" :
             score.whiteScore > score.blackScore ? wSymbol + " White wins!" :
             "Draw!") + "</p>"
  $overlay.classList.add("active")
}

export function renderTerritory(): void {
  const { size } = S.game
  const map = computeTerritoryMap(S.game)

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = grid[r]?.[c]
      if (!cell) continue

      const existing = cell.querySelector(".territory-overlay")
      if (existing) existing.remove()

      if (map[r][c] === EMPTY) continue

      const overlay = document.createElement("div")
      overlay.className = "territory-overlay " + (map[r][c] === BLACK ? "territory-black" : "territory-white")
      cell.appendChild(overlay)
    }
  }
}

export function render(): void {
  renderStones()
  renderTerritory()
  renderStatus()
}

export function onCellClick(r: number, c: number): void {
  if (S.game.gameOver || S.busy) return
  if (getActiveBot() !== null) return

  const ok = placeStone(S.game, r, c)
  if (!ok) {
    $board.classList.remove("shake")
    void $board.offsetWidth
    $board.classList.add("shake")
    return
  }

  render()

  if (S.game.gameOver) {
    showGameOver()
    return
  }

  scheduleBotMove()
}

export function scheduleBotMove(): void {
  const bot = getActiveBot()
  if (!bot) return

  S.busy = true
  renderStatus()

  setTimeout(() => {
    if (S.game.gameOver) { S.busy = false; return }

    const move = bot.selectMove(S.game, S.game.currentPlayer)

    if (move === null) {
      pass(S.game)
    } else {
      placeStone(S.game, move.r, move.c)
    }

    S.busy = false
    render()

    if (S.game.gameOver) {
      showGameOver()
      return
    }

    scheduleBotMove()
  }, 300)
}

export function doPass(): void {
  if (S.game.gameOver || S.busy) return
  if (getActiveBot() !== null) return

  pass(S.game)
  render()

  if (S.game.gameOver) { showGameOver(); return }
  scheduleBotMove()
}

export function doResign(): void {
  if (S.game.gameOver || S.busy) return
  if (getActiveBot() !== null) return

  resign(S.game)
  render()
  showGameOver()
}

export function doUndo(): void {
  if (S.game.gameOver || S.busy) return

  if (S.bot && getActiveBot() !== null) {
    // Bot's turn — undo both human and bot moves
    const undone = undoMultiple(S.game, 2)
    if (undone === 0) return
  } else if (getActiveBot() !== null) {
    // Not our turn (dual-AI game? shouldn't happen)
    return
  } else if (!canUndo(S.game)) {
    return
  } else {
    undo(S.game)
  }
  render()
}

export function doRedo(): void {
  if (S.game.gameOver || S.busy) return
  if (getActiveBot() !== null) return
  if (!canRedo(S.game)) return

  redo(S.game)
  render()

  if (S.game.gameOver) {
    showGameOver()
    return
  }
  scheduleBotMove()
}

export function doSGFExport(): void {
  const sgfStr = exportSGF(S.game, {
    playerBlack: S.playerColor === BLACK ? "Human" : "AI (Level " + S.level + ")",
    playerWhite: S.playerColor === WHITE ? "Human" : "AI (Level " + S.level + ")",
    komi: 6.5,
  })
  const blob = new Blob([sgfStr], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "ancient-go-" + Date.now() + ".sgf"
  a.click()
  URL.revokeObjectURL(url)
}

export function doSGFImport(this: HTMLInputElement): void {
  const file = this.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const result = importSGF(text)
    if (!result) {
      alert("Invalid SGF file or not a Go game.")
      return
    }
    S.game = result.state
    S.size = result.state.size
    S.busy = false
    $overlay.classList.remove("active")
    if (grid.length !== S.size) {
      buildGrid(S.size)
    } else {
      for (let r = 0; r < S.size; r++) {
        for (let c = 0; c < S.size; c++) {
          const stone = grid[r]?.[c]?.querySelector(".stone")
          if (stone) stone.remove()
        }
      }
    }
    $sizeSelect.value = String(S.size)
    updateGhostColor()
    render()
    if (result.warnings.length > 0) {
      console.warn("SGF import warnings:", result.warnings)
    }
    setTimeout(() => scheduleBotMove(), 200)
  }
  reader.readAsText(file)
  // Reset so the same file can be re-selected
  this.value = ""
}

export function newGame(): void {
  S.game = createInitialState(S.size)
  S.bot = BOT_FACTORIES[S.level]?.() ?? null
  S.playerColor = parseInt($colorSelect.value) as typeof BLACK | typeof WHITE
  S.busy = false

  $overlay.classList.remove("active")

  if (grid.length !== S.size) {
    buildGrid(S.size)
  } else {
    for (let r = 0; r < S.size; r++) {
      for (let c = 0; c < S.size; c++) {
        const stone = grid[r][c]?.querySelector(".stone")
        if (stone) stone.remove()
      }
    }
  }

  updateGhostColor()
  render()

  setTimeout(() => scheduleBotMove(), 200)
}

// ── Test support ──────────────────────────────────────
// Sets up DOM refs for testing (browser auto-boot uses DOMContentLoaded below)
export function setupTestDOM(): void {
  const $app = document.getElementById("app")
  if (!$app) return
  $app.innerHTML = [
    '<div id="side-panel">',
    '  <h1>Ancient Go</h1>',
    '  <div class="control-group">',
    '    <label for="size-select">Board Size</label>',
    '    <select id="size-select">',
    '      <option value="9">9 x 9</option>',
    '      <option value="13">13 x 13</option>',
    '      <option value="19">19 x 19</option>',
    '    </select>',
    '  </div>',
    '  <div class="control-group">',
    '    <label for="level-select">AI Level</label>',
    '    <select id="level-select">',
    '      <option value="1">1 Random</option>',
    '      <option value="2">2 Greedy</option>',
    '      <option value="3">3 Heuristic</option>',
    '      <option value="4">4 MCTS</option>',
    '    </select>',
    '  </div>',
    '  <div class="control-group">',
    '    <label for="color-select">Play as</label>',
    '    <select id="color-select">',
    '      <option value="1">Black</option>',
    '      <option value="2">White</option>',
    '    </select>',
    '  </div>',
    '  <div class="control-group">',
    '    <button id="new-game-btn">New Game</button>',
    '  </div>',
    '  <div class="control-group undo-group">',
    '    <button id="undo-btn">Undo (Ctrl+Z)</button>',
    '    <button id="redo-btn">Redo (Ctrl+Y)</button>',
    '  </div>',
    '  <div class="control-group">',
    '    <button id="pass-btn">Pass (P)</button>',
    '    <button id="resign-btn">Resign (R)</button>',
    '  </div>',
    '  <div class="control-group sgf-group">',
    '    <button id="sgf-export-btn">Download SGF</button>',
    '    <button id="sgf-import-btn">Import SGF</button>',
    '    <input type="file" id="sgf-file-input" accept=".sgf" style="display:none">',
    '  </div>',
    '  <div id="status"></div>',
    '</div>',
    '<div id="board-wrapper">',
    '  <div id="board"></div>',
    '</div>',
    '<div id="game-over-overlay">',
    '  <div id="game-over-modal">',
    '    <h2 id="modal-title"></h2>',
    '    <div id="modal-scores"></div>',
    '    <button onclick="this.parentElement.parentElement.classList.remove(\'active\')">Close</button>',
    '  </div>',
    '</div>',
  ].join("\n")

  $board = document.getElementById("board")!
  $status = document.getElementById("status")!
  $overlay = document.getElementById("game-over-overlay")!
  $modalTitle = document.getElementById("modal-title")!
  $modalScores = document.getElementById("modal-scores")!
  $sizeSelect = document.getElementById("size-select") as HTMLSelectElement
  $levelSelect = document.getElementById("level-select") as HTMLSelectElement
  $colorSelect = document.getElementById("color-select") as HTMLSelectElement

  $sizeSelect.value = "9"
  $levelSelect.value = "3"
  $colorSelect.value = "1"
}

export function teardownTestDOM(): void {
  const $app = document.getElementById("app")
  if ($app) $app.innerHTML = ""
  S.game = createInitialState(9)
  S.bot = null
  S.playerColor = BLACK
  S.size = 9
  S.level = 3
  S.busy = false
  grid = []
}

// Auto-boot in browser (guarded for test environments using happy-dom)
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
  setupTestDOM()

  const params = new URLSearchParams(location.search)
  S.size = parseInt(params.get("size") ?? "9") || 9
  S.level = parseInt(params.get("level") ?? "3") || 3
  S.playerColor = parseInt(params.get("color") ?? String(BLACK)) === WHITE ? WHITE : BLACK

  $sizeSelect.value = String(S.size)
  $levelSelect.value = String(S.level)
  $colorSelect.value = String(S.playerColor)

  document.getElementById("pass-btn")!.addEventListener("click", doPass)
  document.getElementById("resign-btn")!.addEventListener("click", doResign)
  document.getElementById("undo-btn")!.addEventListener("click", doUndo)
  document.getElementById("redo-btn")!.addEventListener("click", doRedo)
  document.getElementById("new-game-btn")!.addEventListener("click", newGame)
  document.getElementById("sgf-export-btn")!.addEventListener("click", doSGFExport)
  document.getElementById("sgf-import-btn")!.addEventListener("click", () => {
    document.getElementById("sgf-file-input")!.click()
  })
  document.getElementById("sgf-file-input")!.addEventListener("change", doSGFImport)

  $sizeSelect.addEventListener("change", () => { S.size = parseInt($sizeSelect.value); newGame() })
  $levelSelect.addEventListener("change", () => {
    S.level = parseInt($levelSelect.value)
    S.bot = BOT_FACTORIES[S.level]?.() ?? null
    newGame()
  })
  $colorSelect.addEventListener("change", () => newGame())

  document.addEventListener("keydown", (e) => {
    // Skip shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); doUndo() }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); doRedo() }
    if ((e.ctrlKey || e.metaKey) && e.key === "Z") { e.preventDefault(); doRedo() } // Ctrl+Shift+Z
    if (!e.ctrlKey && !e.metaKey) {
      if (e.key === "p" || e.key === "P") doPass()
      if (e.key === "r" || e.key === "R") doResign()
      if (e.key === "n" || e.key === "N") newGame()
    }
  })

  buildGrid(S.size)
  S.bot = BOT_FACTORIES[S.level]?.() ?? null
  updateGhostColor()
  render()

  if (S.bot && S.playerColor !== BLACK) {
    setTimeout(() => scheduleBotMove(), 300)
  }
})
}
