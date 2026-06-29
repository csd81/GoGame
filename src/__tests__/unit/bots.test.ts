/**
 * Unit tests for src/bots.ts — AI Bots
 */
import { describe, it, expect } from "bun:test"
import { EMPTY, BLACK, WHITE, createInitialState } from "../../engine.ts"
import type { GameState, Cell } from "../../engine.ts"
import { setBotDeps, createRandomBot, createGreedyBot } from "../../bots.ts"
import type { Bot } from "../../bots.ts"
// Direct engine imports for DI wiring
import { getNeighbors, findGroup, countLiberties, isValidMoveForColor } from "../../engine.ts"

// Wire up bot dependencies before any tests
setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor)

describe("Bot Interface", () => {
  it("createRandomBot returns a Bot", () => {
    const bot = createRandomBot()
    expect(bot.name).toBe("Random")
    expect(typeof bot.selectMove).toBe("function")
  })
  it("createGreedyBot returns a Bot", () => {
    const bot = createGreedyBot()
    expect(bot.name).toBe("Greedy")
    expect(typeof bot.selectMove).toBe("function")
  })
})

describe("Random Bot", () => {
  it("returns a valid move on empty board", () => {
    const bot = createRandomBot()
    const s = createInitialState(9)
    const move = bot.selectMove(s, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      expect(move.r).toBeGreaterThanOrEqual(0)
      expect(move.r).toBeLessThan(9)
      expect(move.c).toBeGreaterThanOrEqual(0)
      expect(move.c).toBeLessThan(9)
    }
  })
  it("returns null on full board", () => {
    const bot = createRandomBot()
    const s = createInitialState(2)
    // Fill board
    s.board[0][0] = BLACK; s.board[0][1] = WHITE
    s.board[1][0] = WHITE; s.board[1][1] = BLACK
    const move = bot.selectMove(s, BLACK)
    expect(move).toBeNull()
  })
})

describe("Greedy Bot", () => {
  it("returns a valid move on empty board", () => {
    const bot = createGreedyBot()
    const s = createInitialState(9)
    const move = bot.selectMove(s, BLACK)
    expect(move).not.toBeNull()
  })
  it("captures an atari group (priority 1)", () => {
    const bot = createGreedyBot()
    const s = createInitialState(5)
    // Place a white stone at (0,0) with black at (0,1) — white has 1 liberty at (1,0)
    s.board[0][0] = WHITE
    s.board[0][1] = BLACK
    s.history = [""]
    const move = bot.selectMove(s, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      // Should target the liberty of the atari group
      expect(move.r === 1 && move.c === 0).toBe(true)
    }
  })
  it("defends own atari group (priority 2)", () => {
    const bot = createGreedyBot()
    const s = createInitialState(5)
    // Place a BLACK stone at (0,0) with white at (0,1) — black has 1 liberty at (1,0)
    s.board[0][0] = BLACK
    s.board[0][1] = WHITE
    s.history = [""]
    const move = bot.selectMove(s, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      // Should defend by playing at (1,0)
      expect(move.r === 1 && move.c === 0).toBe(true)
    }
  })
})
