/**
 * Web UI tests — DOM rendering and game interaction
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
GlobalRegistrator.register()

import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import {
  EMPTY, BLACK, WHITE, createInitialState, placeStone, pass, resign,
} from "../engine.ts"
import {
  setupTestDOM, teardownTestDOM,
  buildGrid, renderStones, renderStatus, render,
  showGameOver, updateGhostColor,
  onCellClick, doPass, doResign, newGame,
  scheduleBotMove, getActiveBot,
  stoneSymbol, isStarPoint,
  S, grid, $board, $status, $overlay, $modalTitle, $modalScores, $sizeSelect, $levelSelect, $colorSelect,
  BOT_FACTORIES,
} from "../web/app.ts"
import type { Bot } from "../bots.ts"

describe("DOM setup", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("creates side-panel with title", () => {
    const panel = document.getElementById("side-panel")
    expect(panel).not.toBeNull()
    expect(panel!.querySelector("h1")?.textContent).toContain("Ancient Go")
  })

  it("creates board element", () => {
    expect($board).not.toBeNull()
    expect($board.id).toBe("board")
  })

  it("creates status element", () => {
    expect($status).not.toBeNull()
    expect($status.id).toBe("status")
  })

  it("creates game-over-overlay", () => {
    expect($overlay).not.toBeNull()
    expect($overlay.classList.contains("active")).toBe(false)
  })

  it("creates size select with 3 options", () => {
    expect($sizeSelect).not.toBeNull()
    expect($sizeSelect.options.length).toBe(3)
    expect($sizeSelect.value).toBe("9")
  })

  it("creates level select with 4 options", () => {
    expect($levelSelect).not.toBeNull()
    expect($levelSelect.options.length).toBe(4)
    expect($levelSelect.value).toBe("3")
  })

  it("creates color select with 2 options", () => {
    expect($colorSelect).not.toBeNull()
    expect($colorSelect.options.length).toBe(2)
    expect($colorSelect.value).toBe("1")
  })
})

describe("buildGrid", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("creates 9x9 grid cells", () => {
    expect(grid.length).toBe(9)
    for (let r = 0; r < 9; r++) {
      expect(grid[r]!.length).toBe(9)
    }
  })

  it("each intersection has data-r and data-c", () => {
    const cell = grid[0]![0]!
    expect(cell.dataset.r).toBe("0")
    expect(cell.dataset.c).toBe("0")
  })

  it("has ghost element in each cell", () => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const ghost = grid[r]![c]!.querySelector(".ghost")
        expect(ghost).not.toBeNull()
      }
    }
  })

  it("adds edge-top/edge-bottom classes", () => {
    expect(grid[0]![0]!.classList.contains("edge-top")).toBe(true)
    expect(grid[8]![0]!.classList.contains("edge-bottom")).toBe(true)
    expect(grid[4]![0]!.classList.contains("edge-top")).toBe(false)
    expect(grid[4]![0]!.classList.contains("edge-bottom")).toBe(false)
  })

  it("adds edge-left/edge-right classes", () => {
    expect(grid[0]![0]!.classList.contains("edge-left")).toBe(true)
    expect(grid[0]![8]!.classList.contains("edge-right")).toBe(true)
    expect(grid[0]![4]!.classList.contains("edge-left")).toBe(false)
    expect(grid[0]![4]!.classList.contains("edge-right")).toBe(false)
  })

  it("adds star-point class and star-dot at 4,4 on 9x9", () => {
    expect(grid[4]![4]!.classList.contains("star-point")).toBe(true)
    const dot = grid[4]![4]!.querySelector(".star-dot")
    expect(dot).not.toBeNull()
  })

  it("no star-dot at non-star positions", () => {
    const dot = grid[0]![0]!.querySelector(".star-dot")
    expect(dot).toBeNull()
  })

  it("sets grid-template-columns", () => {
    expect($board.style.gridTemplateColumns).toBe("repeat(9, var(--cell-size))")
  })

  it("rebuilds grid when called again", () => {
    buildGrid(13)
    expect(grid.length).toBe(13)
    expect($board.style.gridTemplateColumns).toBe("repeat(13, var(--cell-size))")
  })

  it("grid cells are children of board", () => {
    expect($board.children.length).toBe(9 * 9)
  })
})

describe("renderStones", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("adds stone divs for placed stones", () => {
    placeStone(S.game, 4, 4)
    renderStones()
    const stone = grid[4]![4]!.querySelector(".stone")
    expect(stone).not.toBeNull()
    expect(stone!.classList.contains("black")).toBe(true)
  })

  it("adds white stone class for white stone", () => {
    S.game.board[3][3] = WHITE
    renderStones()
    const stone = grid[3]![3]!.querySelector(".stone")
    expect(stone).not.toBeNull()
    expect(stone!.classList.contains("white")).toBe(true)
  })

  it("removes existing stones before re-render", () => {
    placeStone(S.game, 4, 4)
    renderStones()
    expect(grid[4]![4]!.querySelectorAll(".stone").length).toBe(1)
  })

  it("adds last-move class to newest stone", () => {
    placeStone(S.game, 4, 4)
    renderStones()
    const stone = grid[4]![4]!.querySelector(".stone.last-move")
    expect(stone).not.toBeNull()
  })

  it("does not add last-move to older stones", () => {
    placeStone(S.game, 3, 3)
    placeStone(S.game, 4, 4)
    renderStones()
    const older = grid[3]![3]!.querySelector(".stone.last-move")
    const newer = grid[4]![4]!.querySelector(".stone.last-move")
    expect(older).toBeNull()
    expect(newer).not.toBeNull()
  })

  it("clears empty cells of stones", () => {
    grid[0]![0]!.innerHTML = '<div class="stone black"></div>'
    S.game.board[0][0] = EMPTY
    renderStones()
    expect(grid[0]![0]!.querySelector(".stone")).toBeNull()
  })
})

describe("renderStatus", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("shows Your turn for human player", () => {
    S.bot = BOT_FACTORIES[1]?.() ?? null
    S.playerColor = BLACK
    renderStatus()
    expect($status.innerHTML).toContain("Your turn")
  })

  it("shows AI thinking... for bot turn", () => {
    S.bot = BOT_FACTORIES[1]?.() ?? null
    S.playerColor = WHITE
    renderStatus()
    expect($status.innerHTML).toContain("AI thinking...")
  })

  it("shows capture counts", () => {
    S.game.captures[BLACK] = 5
    renderStatus()
    expect($status.innerHTML).toContain("5")
  })

  it("shows last move coordinate", () => {
    S.game.lastMove = { r: 4, c: 3 }
    renderStatus()
    expect($status.innerHTML).toContain("D5")
  })

  it("shows pass when no last move", () => {
    S.game.moveCount = 1
    S.game.lastMove = null
    renderStatus()
    expect($status.innerHTML).toContain("pass")
  })
})

describe("showGameOver", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("displays modal with score", () => {
    S.game.captures[BLACK] = 10
    showGameOver()
    expect($overlay.classList.contains("active")).toBe(true)
    expect($modalTitle.textContent).toBe("Game Over!")
    expect($modalScores.innerHTML).toContain("Black:")
    expect($modalScores.innerHTML).toContain("White:")
  })

  it("shows Black wins when ahead", () => {
    S.game.captures[BLACK] = 10
    showGameOver()
    expect($modalScores.innerHTML).toContain("Black wins")
  })

  it("shows White wins when ahead", () => {
    S.game.captures[WHITE] = 10
    showGameOver()
    expect($modalScores.innerHTML).toContain("White wins")
  })
})

describe("onCellClick", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    S.bot = null
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("places a black stone at clicked intersection", () => {
    onCellClick(4, 4)
    expect(S.game.board[4][4]).toBe(BLACK)
    expect(S.game.moveCount).toBe(1)
  })

  it("does nothing when game is over", () => {
    S.game.gameOver = true
    onCellClick(4, 4)
    expect(S.game.board[4][4]).toBe(EMPTY)
  })

  it("does nothing when it is bots turn", () => {
    S.bot = BOT_FACTORIES[1]?.() ?? null
    S.playerColor = WHITE
    onCellClick(4, 4)
    expect(S.game.board[4][4]).toBe(EMPTY)
  })

  it("shakes board on invalid move", () => {
    S.game.board[4][4] = BLACK
    onCellClick(4, 4)
    expect($board.classList.contains("shake")).toBe(true)
  })
})

describe("doPass", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    S.bot = null
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("increments consecutive passes", () => {
    doPass()
    expect(S.game.consecutivePasses).toBe(1)
    expect(S.game.moveCount).toBe(1)
  })

  it("does nothing when game is over", () => {
    S.game.gameOver = true
    doPass()
    expect(S.game.consecutivePasses).toBe(0)
  })
})

describe("doResign", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    S.bot = null
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("sets game over", () => {
    doResign()
    expect(S.game.gameOver).toBe(true)
  })

  it("shows game over modal", () => {
    doResign()
    expect($overlay.classList.contains("active")).toBe(true)
  })

  it("does nothing when already over", () => {
    S.game.gameOver = true
    S.game.moveCount = 5
    doResign()
    expect(S.game.moveCount).toBe(5)
  })
})

describe("newGame", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    S.bot = null
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("resets game state", () => {
    placeStone(S.game, 4, 4)
    expect(S.game.moveCount).toBe(1)
    newGame()
    expect(S.game.moveCount).toBe(0)
    expect(S.game.gameOver).toBe(false)
    expect(S.game.board[4][4]).toBe(EMPTY)
  })

  it("closes game over overlay", () => {
    $overlay.classList.add("active")
    newGame()
    expect($overlay.classList.contains("active")).toBe(false)
  })

  it("resets busy flag", () => {
    S.busy = true
    newGame()
    expect(S.busy).toBe(false)
  })
})

describe("getActiveBot", () => {
  beforeEach(() => {
    S.game = createInitialState(9)
    S.bot = null
    S.playerColor = BLACK
  })

  it("returns null when no bot", () => {
    expect(getActiveBot()).toBeNull()
  })

  it("returns null when it is humans turn", () => {
    S.bot = BOT_FACTORIES[1]?.() ?? null
    S.playerColor = BLACK
    expect(getActiveBot()).toBeNull()
  })

  it("returns bot when it is bots turn", () => {
    S.bot = BOT_FACTORIES[1]?.() ?? null
    S.playerColor = WHITE
    expect(getActiveBot()).not.toBeNull()
  })
})

describe("isStarPoint", () => {
  it("returns true for center star point on 9x9", () => {
    expect(isStarPoint(4, 4, 9)).toBe(true)
  })

  it("returns true for corner star points on 9x9", () => {
    expect(isStarPoint(2, 2, 9)).toBe(true)
    expect(isStarPoint(2, 6, 9)).toBe(true)
    expect(isStarPoint(6, 2, 9)).toBe(true)
    expect(isStarPoint(6, 6, 9)).toBe(true)
  })

  it("returns false for non-star points", () => {
    expect(isStarPoint(0, 0, 9)).toBe(false)
    expect(isStarPoint(4, 3, 9)).toBe(false)
  })

  it("returns correct star points for 13x13", () => {
    expect(isStarPoint(3, 3, 13)).toBe(true)
    expect(isStarPoint(6, 6, 13)).toBe(true)
    expect(isStarPoint(9, 9, 13)).toBe(true)
    expect(isStarPoint(0, 0, 13)).toBe(false)
  })

  it("returns correct star points for 19x19", () => {
    expect(isStarPoint(3, 3, 19)).toBe(true)
    expect(isStarPoint(9, 9, 19)).toBe(true)
    expect(isStarPoint(15, 15, 19)).toBe(true)
    expect(isStarPoint(0, 0, 19)).toBe(false)
  })

  it("returns false for custom sizes", () => {
    expect(isStarPoint(4, 4, 5)).toBe(false)
  })
})

describe("stoneSymbol", () => {
  it("returns filled circle for BLACK", () => {
    expect(stoneSymbol(BLACK)).toBe("\u25CF")
  })

  it("returns empty circle for WHITE", () => {
    expect(stoneSymbol(WHITE)).toBe("\u25CB")
  })
})

describe("render integration", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    S.bot = null
    buildGrid(9)
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("render calls both renderStones and renderStatus", () => {
    placeStone(S.game, 4, 4)
    render()
    const stone = grid[4]![4]!.querySelector(".stone")
    expect(stone).not.toBeNull()
    expect($status.innerHTML).toContain("Your turn")
  })

  it("updateGhostColor sets correct ghost class", () => {
    S.playerColor = WHITE
    updateGhostColor()
    const ghost = grid[0]![0]!.querySelector(".ghost")
    expect(ghost!.classList.contains("white")).toBe(true)
    expect(ghost!.classList.contains("black")).toBe(false)
  })

  it("game loop: place stone, pass, pass ends game", () => {
    onCellClick(4, 4)
    expect(S.game.moveCount).toBe(1)
    expect(S.game.board[4][4]).toBe(BLACK)
    doPass()
    expect(S.game.consecutivePasses).toBe(1)
    doPass()
    expect(S.game.gameOver).toBe(true)
  })

  it("resign then pass does not crash", () => {
    doResign()
    expect(S.game.gameOver).toBe(true)
    doPass()
    expect(S.game.gameOver).toBe(true)
  })
})

describe("building 13x13 and 19x19 boards", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
  })

  afterEach(() => {
    teardownTestDOM()
    document.body.innerHTML = ""
  })

  it("builds 13x13 grid", () => {
    S.game = createInitialState(13)
    buildGrid(13)
    expect(grid.length).toBe(13)
    expect($board.children.length).toBe(13 * 13)
    expect(grid[3]![3]!.classList.contains("star-point")).toBe(true)
  })

  it("builds 19x19 grid", () => {
    S.game = createInitialState(19)
    buildGrid(19)
    expect(grid.length).toBe(19)
    expect($board.children.length).toBe(19 * 19)
    expect(grid[3]![3]!.classList.contains("star-point")).toBe(true)
    expect(grid[9]![9]!.classList.contains("star-point")).toBe(true)
  })
})

describe("BOT_FACTORIES", () => {
  it("returns valid bots for levels 1-3", () => {
    expect(BOT_FACTORIES[1]().name).toBe("Random")
    expect(BOT_FACTORIES[2]().name).toBe("Greedy")
    expect(BOT_FACTORIES[3]().name).toBe("Heuristic")
  })

  it("returns undefined for unknown level", () => {
    expect(BOT_FACTORIES[0]).toBeUndefined()
    expect(BOT_FACTORIES[999]).toBeUndefined()
  })
})

describe("teardownTestDOM", () => {
  it("resets state completely", () => {
    document.body.innerHTML = '<div id="app"></div>'
    setupTestDOM()
    S.game = createInitialState(9)
    buildGrid(9)
    placeStone(S.game, 4, 4)
    expect(grid.length).toBe(9)
    teardownTestDOM()
    expect(grid.length).toBe(0)
    expect(S.game.moveCount).toBe(0)
    expect(S.bot).toBeNull()
    expect(S.busy).toBe(false)
  })
})
