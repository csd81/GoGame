/**
 * Adversarial / edge-case tests
 */
import { describe, it, expect } from "bun:test"
import {
  EMPTY, BLACK, WHITE,
  createBoard, cloneBoard, boardKey,
  getNeighbors, findGroup, countLiberties,
  createInitialState, isValidMove, isValidMoveForColor,
  placeStone, pass, resign, countScore,
} from "../../engine.ts"
import { parseCoord, renderBoard, renderStatus } from "../../render.ts"
import { setBotDeps, createRandomBot, createGreedyBot } from "../../bots.ts"
import { exportSGF, importSGF } from "../../sgf.ts"
import {
  getNeighbors as gn, findGroup as fg,
  countLiberties as cl, isValidMoveForColor as ivmfc,
} from "../../engine.ts"

// Wire up bot deps
setBotDeps(gn, fg, cl, ivmfc)

describe("Engine — edge cases", () => {
  it("createBoard(1) produces 1x1", () => {
    const b = createBoard(1)
    expect(b.length).toBe(1)
    expect(b[0][0]).toBe(EMPTY)
  })
  it("createBoard(25) produces 25x25", () => {
    const b = createBoard(25)
    expect(b.length).toBe(25)
    expect(b[0].length).toBe(25)
  })
  it("getNeighbors at all corners", () => {
    expect(getNeighbors(0, 0, 5)).toHaveLength(2)
    expect(getNeighbors(0, 4, 5)).toHaveLength(2)
    expect(getNeighbors(4, 0, 5)).toHaveLength(2)
    expect(getNeighbors(4, 4, 5)).toHaveLength(2)
  })
  it("findGroup with 100 stones", () => {
    const b = createBoard(10)
    // Fill whole board with BLACK
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        b[r][c] = BLACK
    const g = findGroup(b, 0, 0)
    expect(g).toHaveLength(100)
  })
  it("countLiberties of large group", () => {
    const b = createBoard(10)
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        b[r][c] = BLACK
    expect(countLiberties(b, findGroup(b, 0, 0))).toBe(0)
  })
  it("boardKey with empty board", () => {
    const b = createBoard(19)
    const key = boardKey(b)
    expect(key.length).toBe(19 * 19 + 18)  // 19 rows * 19 chars + 18 separators
  })
  it("isValidMove on gameOver state", () => {
    const s = createInitialState(9)
    s.gameOver = true
    const r = isValidMove(s, 4, 4)
    expect(r.valid).toBe(false)
    expect(r.reason).toBe("Game is over.")
  })
})

describe("Scoring — edge cases", () => {
  it("full board with alternating stones — no empty intersections, territory is 0", () => {
    const s = createInitialState(4)
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        s.board[r][c] = (r + c) % 2 === 0 ? BLACK : WHITE
    const score = countScore(s)
    // No empty cells means no territory, only captures (0) + komi
    expect(score.blackScore).toBe(0)
    expect(score.whiteScore).toBe(6.5)
  })
  it("board with territory", () => {
    // 3x3 board: black stones at (0,0),(0,1),(0,2),(1,0)
    // Remaining 5 cells are enclosed by black only
    const s = createInitialState(3)
    s.board[0][0] = BLACK; s.board[0][1] = BLACK; s.board[0][2] = BLACK
    s.board[1][0] = BLACK
    const score = countScore(s)
    // 5 empty cells all bordered only by black → territory 5 for black
    expect(score.blackScore).toBe(5)
    expect(score.whiteScore).toBe(6.5)
  })
  it("empty board komi is 6.5", () => {
    const s = createInitialState(19)
    const score = countScore(s)
    expect(score.whiteScore).toBe(6.5)
  })
})

describe("Render — edge cases", () => {
  const ascii = { unicode: false, color: false } as const

  it("renderBoard with size 1", () => {
    const s = createInitialState(1)
    const out = renderBoard(s, ascii)
    expect(out).toContain("1")
    expect(out).toContain("A")
  })
  it("renderBoard with size 25", () => {
    const s = createInitialState(25)
    const out = renderBoard(s, ascii)
    expect(out).toContain("A")
    expect(out).toContain("Y")  // 25th letter
  })
  it("parseCoord with large numbers", () => {
    expect(parseCoord("Z999", 19)).toBeNull()  // out of bounds
    expect(parseCoord("A999", 19)).toBeNull()  // row out of bounds
  })
  it("renderStatus at game over", () => {
    const s = createInitialState(9)
    s.gameOver = true
    expect(() => renderStatus(s, ascii)).not.toThrow()
  })
  it("renderBoard at game over with last move still renders", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    s.gameOver = true
    const out = renderBoard(s, ascii)
    expect(out).toContain("B")
    expect(out).not.toContain("\x1b")
  })
  it("fallback mode produces clean ASCII output with no ANSI codes", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const out = renderBoard(s, ascii)
    expect(out).not.toContain("\x1b")
  })
  it("status with no moves shows turn count 0 and no last move", () => {
    const s = createInitialState(9)
    const status = renderStatus(s, ascii)
    expect(status).toContain("Turn 0")
    expect(status).not.toContain("Last:")
  })
})

describe("Bots — edge cases", () => {
  it("random bot on 1x1 board returns null or valid move", () => {
    const bot = createRandomBot()
    const s = createInitialState(1)
    const move = bot.selectMove(s, BLACK)
    if (move) {
      expect(move.r).toBe(0)
      expect(move.c).toBe(0)
    }
    // null is also acceptable if no valid move
  })
  it("greedy bot on 1x1 board — 1x1 has no legal moves (suicide)", () => {
    const bot = createGreedyBot()
    const s = createInitialState(1)
    const move = bot.selectMove(s, BLACK)
    // On a 1x1 board, any move has 0 liberties (suicide), so null
    expect(move).toBeNull()
  })
  it("bot on board with only suicidal moves returns null", () => {
    const bot = createRandomBot()
    const s = createInitialState(3)
    // Set up 4 disconnected white groups, leaving center (1,1) empty
    // Each white group has its own liberties, so they won't be captured
    // W W .
    // W . W
    // . W .
    s.board[0][0] = WHITE; s.board[0][1] = WHITE
    s.board[1][0] = WHITE
    s.board[1][2] = WHITE
    s.board[2][1] = WHITE
    s.history = [""]
    const move = bot.selectMove(s, BLACK)
    // Center (1,1) is the only empty cell; playing there is suicide
    expect(move).toBeNull()
  })
})

describe("Multiple passes and resign — adversarial", () => {
  it("resign during AI game does not crash", () => {
    const s = createInitialState(9)
    resign(s)
    expect(s.gameOver).toBe(true)
    expect(() => countScore(s)).not.toThrow()
  })
  it("pass after resign still game over", () => {
    const s = createInitialState(9)
    resign(s)
    expect(s.gameOver).toBe(true)
    pass(s)  // should not crash
    expect(s.gameOver).toBe(true)
  })
})

describe("SGF — edge cases", () => {
  it("import empty/whitespace string returns null", () => {
    expect(importSGF("")).toBeNull()
    expect(importSGF("   ")).toBeNull()
  })
  it("import SGF with backslash-escaped brackets", () => {
    // SGF escaping: \] inside brackets
    const sgf = '(;GM[1]FF[4]SZ[9]C[escaped \\[bracket\\]];B[dd])'
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.moves.length).toBe(1)
  })
  it("import SGF with missing SZ defaults to 19", () => {
    const sgf = "(;GM[1]FF[4]KM[6.5];B[dd])"
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.size).toBe(19)
  })
  it("export->import on a resigned game", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    resign(s)
    const sgf = exportSGF(s)
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    // After resign, the game is over
    expect(result!.state.gameOver).toBe(true)
  })
  it("import non-Go SGF returns null", () => {
    expect(importSGF("(;GM[2]FF[4])")).toBeNull()
    expect(importSGF("not sgf")).toBeNull()
  })
})
