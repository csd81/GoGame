/**
 * Unit tests for Level 3 — Heuristic Bot
 */
import { describe, it, expect } from "bun:test"
import { EMPTY, BLACK, WHITE, createInitialState, pass, placeStone } from "../../engine.ts"
import type { GameState, Cell } from "../../engine.ts"
import {
  setBotDeps, createRandomBot, createGreedyBot,
  createHeuristicBot, createHeuristicBot2Ply,
} from "../../bots.ts"
import type { Bot } from "../../bots.ts"
import { getNeighbors, findGroup, countLiberties, isValidMoveForColor } from "../../engine.ts"

// Wire up bot dependencies
setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor)

describe("Heuristic Bot Interface", () => {
  it("createHeuristicBot returns a Bot", () => {
    const bot = createHeuristicBot()
    expect(bot.name).toBe("Heuristic")
    expect(typeof bot.selectMove).toBe("function")
  })
  it("createHeuristicBot2Ply returns a Bot", () => {
    const bot = createHeuristicBot2Ply()
    expect(bot.name).toBe("Heuristic 2-Ply")
    expect(typeof bot.selectMove).toBe("function")
  })
})

describe("Heuristic Bot — move selection", () => {
  it("returns a valid move on empty 9x9 board", () => {
    const bot = createHeuristicBot()
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
  it("prefers center over edge on empty board", () => {
    const bot = createHeuristicBot()
    const s = createInitialState(9)
    // Run multiple times to verify consistent center preference
    const moves: Array<{ r: number; c: number }> = []
    for (let i = 0; i < 5; i++) {
      const s2 = createInitialState(9)
      const m = bot.selectMove(s2, BLACK)
      if (m) moves.push(m)
    }
    // At least 3/5 moves should be in the inner 7x7 (not on the first line)
    const innerMoves = moves.filter(m => m.r > 0 && m.r < 8 && m.c > 0 && m.c < 8)
    expect(innerMoves.length).toBeGreaterThanOrEqual(3)
  })
  it("returns null on full board", () => {
    const bot = createHeuristicBot()
    const s = createInitialState(2)
    s.board[0][0] = BLACK; s.board[0][1] = WHITE
    s.board[1][0] = WHITE; s.board[1][1] = BLACK
    const move = bot.selectMove(s, BLACK)
    expect(move).toBeNull()
  })
  it("returns null on 1x1 board (suicide)", () => {
    const bot = createHeuristicBot()
    const s = createInitialState(1)
    const move = bot.selectMove(s, BLACK)
    expect(move).toBeNull()
  })
})

describe("Heuristic Bot — capture priority", () => {
  it("captures an atari group when available", () => {
    const bot = createHeuristicBot()
    // Large atari group so capture clearly beats center influence
    const s = createInitialState(9)
    // 3-stone white group at (3,3),(3,4),(4,3) with 1 liberty at (4,4)
    s.board[3][3] = WHITE
    s.board[3][4] = WHITE
    s.board[4][3] = WHITE
    // Black surrounds
    s.board[2][3] = BLACK; s.board[2][4] = BLACK
    s.board[3][2] = BLACK; s.board[3][5] = BLACK
    s.board[4][2] = BLACK; s.board[5][3] = BLACK
    s.board[4][4] = BLACK  // close the last liberty too? No — that's what the bot should play
    // Wait, if (4,4) is already black, the group is already dead
    // Let's restart
    const s2 = createInitialState(9)
    s2.board[3][3] = WHITE
    s2.board[3][4] = WHITE
    s2.board[4][3] = WHITE
    // Black surrounds all except (4,4)
    s2.board[2][3] = BLACK; s2.board[2][4] = BLACK
    s2.board[3][2] = BLACK; s2.board[3][5] = BLACK
    s2.board[4][2] = BLACK; s2.board[5][3] = BLACK
    s2.history = [""]
    const move = bot.selectMove(s2, BLACK)
    expect(move).not.toBeNull()
    // Bot should capture the 3-stone group by playing at (4,4)
    expect(move!.r).toBe(4)
    expect(move!.c).toBe(4)
  })
  it("defends own atari group", () => {
    const bot = createHeuristicBot()
    // Set up a large valuable atari group so defense is clearly optimal
    const s = createInitialState(9)
    // Create a 3-stone black group at (3,3),(3,4),(4,3) that is in atari
    s.board[3][3] = BLACK
    s.board[3][4] = BLACK
    s.board[4][3] = BLACK
    // Surround with white stones leaving only 1 liberty at (4,4)
    s.board[2][3] = WHITE; s.board[2][4] = WHITE
    s.board[3][2] = WHITE; s.board[3][5] = WHITE
    s.board[4][2] = WHITE; s.board[4][5] = WHITE
    s.board[5][3] = WHITE; s.board[5][4] = WHITE
    // Also put white at (4,4) to make 0 liberties... no, that's the last liberty
    // Actually the black group at (3,3),(3,4),(4,3) — let's trace:
    // (3,3) neighbors: (2,3)=W, (3,2)=W, (3,4)=B, (4,3)=B — liberties: none empty directly
    // Wait, (3,3) has no empty neighbors (all are W, B, or B)
    // Let me redesign this more carefully.
    const s2 = createInitialState(9)
    // Big black group: (3,3),(3,4),(4,3)
    s2.board[3][3] = BLACK
    s2.board[3][4] = BLACK
    s2.board[4][3] = BLACK
    // White surrounds everything except (4,4) which is the last liberty
    // (3,3) neighbors: (2,3),(3,2),(3,4),(4,3)
    s2.board[2][3] = WHITE
    s2.board[3][2] = WHITE
    // (3,4) neighbors: (2,4),(3,3),(3,5),(4,4)
    s2.board[2][4] = WHITE
    s2.board[3][5] = WHITE
    // (4,3) neighbors: (3,3),(4,2),(4,4),(5,3)
    s2.board[4][2] = WHITE
    s2.board[5][3] = WHITE
    // Leave (4,4) empty — it's the only liberty for the 3-stone group
    s2.history = [""]
    const move = bot.selectMove(s2, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      // The bot should play at (4,4) to save the 3-stone group
      expect(move.r).toBe(4)
      expect(move.c).toBe(4)
    }
  })
})

describe("Heuristic 2-Ply Bot", () => {
  it("returns a valid move on empty 9x9 board", () => {
    const bot = createHeuristicBot2Ply()
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
  it("captures atari group (same as base heuristic)", () => {
    const bot = createHeuristicBot2Ply()
    const s = createInitialState(5)
    s.board[0][0] = WHITE
    s.board[0][1] = BLACK
    s.history = [""]
    const move = bot.selectMove(s, BLACK)
    expect(move).not.toBeNull()
    if (move) {
      expect(move.r === 1 && move.c === 0).toBe(true)
    }
  })
  it("returns null on full board", () => {
    const bot = createHeuristicBot2Ply()
    const s = createInitialState(2)
    s.board[0][0] = BLACK; s.board[0][1] = WHITE
    s.board[1][0] = WHITE; s.board[1][1] = BLACK
    const move = bot.selectMove(s, BLACK)
    expect(move).toBeNull()
  })
})

describe("Bot comparison — all 3 levels", () => {
  it("Random, Greedy, Heuristic all return valid moves on empty 9x9", () => {
    const bots: Bot[] = [createRandomBot(), createGreedyBot(), createHeuristicBot()]
    for (const bot of bots) {
      const s = createInitialState(9)
      const move = bot.selectMove(s, BLACK)
      expect(move).not.toBeNull()
      if (move) {
        // Verify the move is legal
        expect(s.board[move.r][move.c]).toBe(EMPTY)
      }
    }
  })
  it("Heuristic vs Random head-to-head plays without crash", () => {
    for (let game = 0; game < 3; game++) {
      const hBot = createHeuristicBot()
      const rBot = createRandomBot()
      const s = createInitialState(7)
      let moves = 0
      while (moves < 40 && !s.gameOver) {
        const bot = s.currentPlayer === BLACK ? hBot : rBot
        const move = bot.selectMove(s, s.currentPlayer)
        if (move === null) {
          pass(s)
        } else {
          placeStone(s, move.r, move.c)
        }
        moves++
      }
      expect(s.gameOver || moves >= 10).toBe(true)
    }
  })
})
