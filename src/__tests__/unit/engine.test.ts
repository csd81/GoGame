/**
 * Unit tests for src/engine.ts — Pure game engine
 */
import { describe, it, expect } from "bun:test"
import {
  EMPTY, BLACK, WHITE,
  createBoard, cloneBoard, boardKey,
  getNeighbors, findGroup, countLiberties,
  isStarPoint,
  createInitialState,
  isValidMove, isValidMoveForColor, placeStone, pass, resign,
  countScore, copyState, getLegalMoves,
  undo, redo, canUndo, canRedo, undoMultiple,
} from "../../engine.ts"

describe("createBoard", () => {
  it("creates a 9x9 board of all EMPTY", () => {
    const b = createBoard(9)
    expect(b.length).toBe(9)
    expect(b[0].length).toBe(9)
    expect(b[0][0]).toBe(EMPTY)
    expect(b[8][8]).toBe(EMPTY)
  })
  it("creates 19x19 board", () => {
    const b = createBoard(19)
    expect(b.length).toBe(19)
    expect(b[0].length).toBe(19)
  })
  it("creates 13x13 board", () => {
    const b = createBoard(13)
    expect(b.length).toBe(13)
  })
})

describe("cloneBoard", () => {
  it("produces an independent copy", () => {
    const b = createBoard(5)
    b[0][0] = BLACK
    const c = cloneBoard(b)
    expect(c[0][0]).toBe(BLACK)
    c[0][0] = EMPTY
    expect(b[0][0]).toBe(BLACK)
  })
})

describe("boardKey", () => {
  it("produces deterministic keys", () => {
    const b = createBoard(3)
    b[1][1] = BLACK
    const key = boardKey(b)
    expect(key).toContain("1")
    expect(boardKey(cloneBoard(b))).toBe(key)
  })
})

describe("getNeighbors", () => {
  it("returns 2 neighbors at corner", () => {
    const n = getNeighbors(0, 0, 5)
    expect(n).toHaveLength(2)
  })
  it("returns 3 neighbors on edge", () => {
    const n = getNeighbors(0, 2, 5)
    expect(n).toHaveLength(3)
  })
  it("returns 4 neighbors in center", () => {
    const n = getNeighbors(2, 2, 5)
    expect(n).toHaveLength(4)
  })
})

describe("findGroup", () => {
  it("returns empty for EMPTY cell", () => {
    const b = createBoard(5)
    expect(findGroup(b, 2, 2)).toHaveLength(0)
  })
  it("finds a single stone group", () => {
    const b = createBoard(5)
    b[2][2] = BLACK
    expect(findGroup(b, 2, 2)).toHaveLength(1)
  })
  it("finds connected stones", () => {
    const b = createBoard(5)
    b[0][0] = BLACK; b[0][1] = BLACK; b[1][0] = BLACK
    expect(findGroup(b, 0, 0)).toHaveLength(3)
  })
  it("does not include diagonal connections", () => {
    const b = createBoard(5)
    b[0][0] = BLACK; b[1][1] = BLACK
    expect(findGroup(b, 0, 0)).toHaveLength(1)
  })
})

describe("countLiberties", () => {
  it("counts 4 liberties for center stone", () => {
    const b = createBoard(5)
    b[2][2] = BLACK
    const g = findGroup(b, 2, 2)
    expect(countLiberties(b, g)).toBe(4)
  })
  it("counts 2 liberties for corner stone", () => {
    const b = createBoard(5)
    b[0][0] = BLACK
    expect(countLiberties(b, findGroup(b, 0, 0))).toBe(2)
  })
  it("counts 0 liberties when surrounded", () => {
    const b = createBoard(3)
    b[1][1] = BLACK
    b[0][1] = WHITE; b[1][0] = WHITE; b[1][2] = WHITE; b[2][1] = WHITE
    expect(countLiberties(b, findGroup(b, 1, 1))).toBe(0)
  })
})

describe("isStarPoint", () => {
  it("detects center of 9x9", () => {
    expect(isStarPoint(2, 2, 9)).toBe(true)
    expect(isStarPoint(4, 2, 9)).toBe(true)
    expect(isStarPoint(4, 4, 9)).toBe(true)
  })
  it("rejects non-star points on 9x9", () => {
    expect(isStarPoint(0, 0, 9)).toBe(false)
    expect(isStarPoint(1, 1, 9)).toBe(false)
  })
  it("detects star points on 19x19", () => {
    expect(isStarPoint(3, 3, 19)).toBe(true)
    expect(isStarPoint(3, 9, 19)).toBe(true)
    expect(isStarPoint(9, 9, 19)).toBe(true)
    expect(isStarPoint(15, 15, 19)).toBe(true)
  })
  it("returns false for non-standard sizes", () => {
    expect(isStarPoint(2, 2, 5)).toBe(false)
  })
})

describe("createInitialState / isValidMove", () => {
  it("creates a valid initial state", () => {
    const s = createInitialState(9)
    expect(s.size).toBe(9)
    expect(s.currentPlayer).toBe(BLACK)
    expect(s.gameOver).toBe(false)
  })
  it("isValidMove rejects occupied intersection", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const r = isValidMove(s, 4, 4)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain("empty")
  })
  it("isValidMove rejects suicide", () => {
    const s = createInitialState(3)
    // Surround (0,0) with white stones so placing black at (0,0) has no liberties
    s.board[0][1] = WHITE; s.board[1][0] = WHITE
    s.currentPlayer = BLACK
    const r = isValidMove(s, 0, 0)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain("Suicide")
  })
  it("isValidMove returns valid for normal move", () => {
    const s = createInitialState(9)
    expect(isValidMove(s, 4, 4).valid).toBe(true)
  })
  it("isValidMoveForColor works with explicit color", () => {
    const s = createInitialState(9)
    expect(isValidMoveForColor(s, 3, 3, BLACK).valid).toBe(true)
    expect(isValidMoveForColor(s, 3, 3, WHITE).valid).toBe(true)
  })
  it("rejects move when game is over", () => {
    const s = createInitialState(9)
    s.gameOver = true
    expect(isValidMove(s, 4, 4).valid).toBe(false)
  })
})

describe("placeStone / captures", () => {
  it("changes current player", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    expect(s.currentPlayer).toBe(WHITE)
  })
  it("properly captures surrounded stone", () => {
    const s = createInitialState(5)
    s.board[0][0] = WHITE  // stone to be captured
    s.history = [boardKey(s.board)]
    // Place black at (0,1)
    placeStone(s, 0, 1)
    // Now s.currentPlayer switched to WHITE, switch back for second black placement
    s.currentPlayer = BLACK
    s.history.push(boardKey(s.board))
    // Place black at (1,0) — this captures white at (0,0)
    placeStone(s, 1, 0)
    expect(s.captures[BLACK]).toBe(1)
    expect(s.board[0][0]).toBe(EMPTY)
  })
})

describe("pass and resign", () => {
  it("pass switches player", () => {
    const s = createInitialState(9)
    pass(s)
    expect(s.currentPlayer).toBe(WHITE)
    expect(s.consecutivePasses).toBe(1)
  })
  it("two passes end game", () => {
    const s = createInitialState(9)
    pass(s); pass(s)
    expect(s.gameOver).toBe(true)
  })
  it("resign ends game", () => {
    const s = createInitialState(9)
    resign(s)
    expect(s.gameOver).toBe(true)
  })
})

describe("countScore", () => {
  it("initial empty board scores with komi", () => {
    const s = createInitialState(9)
    const score = countScore(s)
    expect(score.blackScore).toBe(0)
    expect(score.whiteScore).toBe(6.5)
  })
  it("counts captures in score", () => {
    const s = createInitialState(9)
    s.captures[BLACK] = 3
    s.captures[WHITE] = 2
    const score = countScore(s)
    expect(score.blackScore).toBe(3)
    expect(score.whiteScore).toBe(8.5)
  })
})

describe("undo / redo", () => {
  it("undo after 1 move restores empty board", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    undo(s)
    expect(s.board[4][4]).toBe(EMPTY)
    expect(s.currentPlayer).toBe(BLACK)
    expect(s.moveCount).toBe(0)
    expect(canUndo(s)).toBe(false)
    expect(canRedo(s)).toBe(true)
  })

  it("undo after 2 moves restores 1-move state", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4) // B
    placeStone(s, 3, 3) // W
    undo(s)
    expect(s.board[4][4]).toBe(BLACK)
    expect(s.board[3][3]).toBe(EMPTY)
    expect(s.currentPlayer).toBe(WHITE)
  })

  it("undo on empty board returns false", () => {
    const s = createInitialState(9)
    expect(undo(s)).toBe(false)
    expect(canUndo(s)).toBe(false)
  })

  it("redo after undo restores state", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    undo(s)
    expect(s.board[3][3]).toBe(EMPTY)
    redo(s)
    expect(s.board[3][3]).toBe(WHITE)
    expect(s.currentPlayer).toBe(BLACK)
  })

  it("redo when nothing to redo returns false", () => {
    const s = createInitialState(9)
    expect(redo(s)).toBe(false)
    placeStone(s, 4, 4)
    expect(canRedo(s)).toBe(false)
  })

  it("new move after undo truncates redo buffer", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4) // B
    placeStone(s, 3, 3) // W
    undo(s)
    expect(canRedo(s)).toBe(true)
    placeStone(s, 5, 5) // W makes a new move
    expect(canRedo(s)).toBe(false)
    expect(s.moves.length).toBe(2)
    expect(s.undoPointer).toBe(2)
  })

  it("undoPointer in copyState is correct", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    undo(s)
    const c = copyState(s)
    expect(c.undoPointer).toBe(1)
    expect(c.currentPlayer).toBe(WHITE)
  })

  it("two undos then two redos restores original", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    placeStone(s, 5, 5)
    undo(s)
    undo(s)
    expect(s.moveCount).toBe(1)
    expect(s.moves.length).toBe(3)
    redo(s)
    redo(s)
    expect(s.moveCount).toBe(3)
    expect(s.board[5][5]).toBe(BLACK)
  })

  it("pass then undo restores pre-pass state", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    pass(s)
    undo(s)
    expect(s.currentPlayer).toBe(WHITE)
    expect(s.board[4][4]).toBe(BLACK)
    expect(s.consecutivePasses).toBe(0)
  })

  it("undoMultiple undoes n moves", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    placeStone(s, 5, 5)
    const undone = undoMultiple(s, 2)
    expect(undone).toBe(2)
    expect(s.moveCount).toBe(1)
    expect(s.board[4][4]).toBe(BLACK)
    expect(s.board[3][3]).toBe(EMPTY)
  })

  it("undoMultiple with n larger than move count stops at 0", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const undone = undoMultiple(s, 10)
    expect(undone).toBe(1)
    expect(canUndo(s)).toBe(false)
  })

  it("cannot undo when game is over", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    s.gameOver = true
    expect(canUndo(s)).toBe(false)
    expect(undo(s)).toBe(false)
  })

  it("undo performance on 200-move game within 100ms", () => {
    const s = createInitialState(19)
    // Play 200 random legal moves
    for (let i = 0; i < 200 && !s.gameOver; i++) {
      const moves = getLegalMoves(s, s.currentPlayer)
      if (moves.length === 0) { pass(s); continue }
      const [r, c] = moves[Math.floor(Math.random() * moves.length)]!
      placeStone(s, r, c)
    }
    expect(s.moves.length).toBeGreaterThan(0)
    const start = performance.now()
    undo(s)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100)
    expect(s.moveCount).toBe(s.moves.length - 1)
  })

  it("moves array is append-only (not mutated by undo)", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    placeStone(s, 5, 5)
    const moveLenBefore = s.moves.length
    undo(s)
    expect(s.moves.length).toBe(moveLenBefore) // still 3
    expect(s.undoPointer).toBe(2)
  })
})
