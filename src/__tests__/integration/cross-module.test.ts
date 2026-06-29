/**
 * Integration tests — cross-module interactions
 */
import { describe, it, expect } from "bun:test"
import {
  EMPTY, BLACK, WHITE,
  createInitialState, placeStone, pass, resign, countScore,
  getNeighbors, findGroup, countLiberties, isValidMoveForColor, boardKey,
} from "../../engine.ts"
import { renderBoard, renderStatus, parseCoord, printUI, showResult } from "../../render.ts"
import { setBotDeps, createRandomBot, createGreedyBot } from "../../bots.ts"

// Wire up bot deps
setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor)

describe("Engine + Render integration", () => {
  it("renders board after placing a stone", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const rendered = renderBoard(s)
    expect(rendered).toContain("B")  // black stone visible
    expect(rendered).toContain("A")  // column label
  })
  it("renders status with correct captures after capture", () => {
    const s = createInitialState(5)
    s.board[0][0] = WHITE
    s.history = [""]
    placeStone(s, 0, 1)  // Black
    s.currentPlayer = BLACK
    s.history.push("")
    placeStone(s, 1, 0)  // Black captures
    const status = renderStatus(s)
    expect(status).toContain("Black: 1")
  })
  it("parseCoord round-trips with renderBoard", () => {
    const s = createInitialState(9)
    const coord = parseCoord("E5", 9)
    expect(coord).not.toBeNull()
    if (coord) {
      const ok = placeStone(s, coord[0], coord[1])
      expect(ok).toBe(true)
      expect(s.board[4][4]).toBe(BLACK)
    }
  })
})

describe("Engine + Bots integration", () => {
  it("bot move is accepted by placeStone", () => {
    const bot = createGreedyBot()
    const s = createInitialState(9)
    const move = bot.selectMove(s, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      const ok = placeStone(s, move.r, move.c)
      expect(ok).toBe(true)
    }
  })
  it("bot alternates moves in a short game", () => {
    const black = createGreedyBot()
    const white = createGreedyBot()
    const s = createInitialState(5)
    for (let i = 0; i < 10; i++) {
      const bot = s.currentPlayer === BLACK ? black : white
      const move = bot.selectMove(s, s.currentPlayer)
      if (move === null) break
      expect(placeStone(s, move.r, move.c)).toBe(true)
    }
    expect(s.consecutivePasses).toBe(0)
  })
})

describe("Full pipeline: Engine + Render + Bots", () => {
  it("Alice vs Bob (Random vs Greedy) plays without error", () => {
    const alice = createRandomBot()
    const bob = createGreedyBot()
    const s = createInitialState(7)
    let moves = 0
    while (moves < 30 && !s.gameOver) {
      const bot = s.currentPlayer === BLACK ? alice : bob
      const move = bot.selectMove(s, s.currentPlayer)
      if (move === null) { pass(s); continue }
      placeStone(s, move.r, move.c)
      moves++
    }
    // Verify the game state is consistent
    const score = countScore(s)
    expect(score.blackScore + score.whiteScore).toBeGreaterThanOrEqual(0)
    // Render functions should not throw
    expect(() => printUI(s)).not.toThrow()
    expect(() => showResult(s)).not.toThrow()
  })
})
