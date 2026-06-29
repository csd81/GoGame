/**
 * Unit tests for MCTS Bot (src/bots.ts)
 */
import { describe, it, expect, beforeAll } from "bun:test"
import {
  createMCTSBot, setBotDeps, createGreedyBot,
} from "../../bots.ts"
import {
  EMPTY, BLACK, WHITE, createInitialState, copyState,
  getNeighbors, findGroup, countLiberties, isValidMoveForColor, countScore,
  placeStone, pass,
} from "../../engine.ts"
import type { GameState, Cell } from "../../engine.ts"

// Quick bot for testing: tiny budget to avoid timeout
const FAST_BUDGET = { maxIterations: 50, maxTimeMs: 500 }
function fastBot() { return createMCTSBot(FAST_BUDGET) }

// Wire up bot dependencies
beforeAll(() => {
  setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor)
})

describe("MCTS Bot — basic structure", () => {
  it("createMCTSBot returns a Bot with name MCTS", () => {
    const bot = createMCTSBot()
    expect(bot.name).toBe("MCTS")
    expect(typeof bot.selectMove).toBe("function")
  })

  it("selectMove returns null on a full board", () => {
    const state = createInitialState(9)
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        state.board[r][c] = (r + c) % 2 === 0 ? BLACK : WHITE
    state.currentPlayer = BLACK
    const bot = fastBot()
    const move = bot.selectMove(state, BLACK)
    expect(move).toBeNull()
  })

  it("selectMove returns a valid move on empty 9x9 board", () => {
    const state = createInitialState(9)
    const bot = fastBot()
    const move = bot.selectMove(state, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      expect(move.r).toBeGreaterThanOrEqual(0)
      expect(move.r).toBeLessThan(9)
      expect(move.c).toBeGreaterThanOrEqual(0)
      expect(move.c).toBeLessThan(9)
      expect(state.board[move.r][move.c]).toBe(EMPTY)
    }
  })

  it("selectMove returns a valid move on 19x19 board", () => {
    const state = createInitialState(19)
    const bot = fastBot()
    const move = bot.selectMove(state, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      expect(state.board[move.r][move.c]).toBe(EMPTY)
    }
  })
})

describe("MCTS Bot — plays valid moves", () => {
  it("only places on empty intersections", () => {
    const state = createInitialState(9)
    placeStone(state, 4, 4)
    placeStone(state, 3, 3)
    placeStone(state, 4, 5)
    const bot = fastBot()
    const move = bot.selectMove(state, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      expect(state.board[move.r][move.c]).toBe(EMPTY)
      const result = isValidMoveForColor(state, move.r, move.c, BLACK)
      expect(result.valid).toBe(true)
    }
  })

  it("does not return ko-violating moves", () => {
    const state = createInitialState(7)
    const koBoard = [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,1,2,0,0],
      [0,0,1,0,1,0,0],
      [0,0,0,1,2,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
    ]
    state.board = koBoard.map(row => [...row]) as any
    state.currentPlayer = BLACK
    state.history = []

    const ok = placeStone(state, 3, 3)
    if (!ok) return

    const bot = fastBot()
    const move = bot.selectMove(state, WHITE)
    if (move) {
      const result = isValidMoveForColor(state, move.r, move.c, WHITE)
      expect(result.valid).toBe(true)
    }
  })

  it("respects ko rule when it exists", () => {
    // Build a proper ko shape: a situation where recapturing immediately is illegal
    const state = createInitialState(5)
    // Ko setup:
    //   . . . . .
    //   . . B W .
    //   . B . W .
    //   . . B W .
    //   . . . . .
    // After Black captures at (2,2), White cannot recapture immediately
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        state.board[r][c] = EMPTY
    state.board[1][2] = BLACK
    state.board[1][3] = WHITE
    state.board[2][1] = BLACK
    state.board[2][3] = WHITE
    state.board[3][2] = BLACK
    state.board[3][3] = WHITE

    // Black plays at (2,2) to capture white at (2,3)
    state.currentPlayer = BLACK
    state.history = []
    state.lastMove = null
    state.moveCount = 0
    state.captures = { [BLACK]: 0, [WHITE]: 0 }
    const captureOk = placeStone(state, 2, 2)
    expect(captureOk).toBe(true)
    // Now White's turn, (2,2) is in history, so recapturing at (2,3) should be ko-rule blocked
    const bot = fastBot()
    const move = bot.selectMove(state, WHITE)
    if (move) {
      const result = isValidMoveForColor(state, move.r, move.c, WHITE)
      expect(result.valid).toBe(true)
    }
  })
})

describe("MCTS Bot — resource management", () => {
  it("completes quickly with fast budget", () => {
    const state = createInitialState(9)
    const bot = fastBot()
    const start = performance.now()
    bot.selectMove(state, BLACK)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000)
  })
})

describe("MCTS Bot — copyState smoke test", () => {
  it("copyState produces an independent copy", () => {
    const state = createInitialState(9)
    placeStone(state, 3, 3)
    const copy = copyState(state)
    expect(copy.board[3][3]).toBe(BLACK)
    expect(copy.moveCount).toBe(1)
    expect(copy.lastMove).toEqual({ r: 3, c: 3 })
    // Mutating copy should not affect original
    copy.board[3][3] = EMPTY
    expect(state.board[3][3]).toBe(BLACK)
  })
})
