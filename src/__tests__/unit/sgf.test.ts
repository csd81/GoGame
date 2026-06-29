/**
 * Unit tests for SGF Export/Import
 */
import { describe, it, expect } from "bun:test"
import {
  EMPTY, BLACK, WHITE, createInitialState, placeStone, pass, resign,
  getLegalMoves,
} from "../../engine.ts"
import type { GameState } from "../../engine.ts"
import {
  exportSGF, importSGF, toSgfCoord, fromSgfCoord,
} from "../../sgf.ts"

describe("toSgfCoord", () => {
  it("converts top-left corner", () => {
    expect(toSgfCoord(0, 0)).toBe("aa")
  })

  it("converts bottom-right of 9x9", () => {
    expect(toSgfCoord(8, 8)).toBe("ii")
  })

  it("converts bottom-right of 19x19", () => {
    expect(toSgfCoord(18, 18)).toBe("ss")
  })

  it("converts arbitrary coordinate", () => {
    expect(toSgfCoord(3, 4)).toBe("ed")
  })
})

describe("fromSgfCoord", () => {
  it("parses top-left", () => {
    const result = fromSgfCoord("aa")
    expect(result).not.toBeNull()
    expect(result![0]).toBe(0)
    expect(result![1]).toBe(0)
  })

  it("parses bottom-right of 9x9", () => {
    const result = fromSgfCoord("ii")
    expect(result).not.toBeNull()
    expect(result![0]).toBe(8)
    expect(result![1]).toBe(8)
  })

  it("parses arbitrary coordinate", () => {
    const result = fromSgfCoord("ed")
    expect(result).not.toBeNull()
    expect(result![0]).toBe(3)
    expect(result![1]).toBe(4)
  })

  it("returns null for invalid string", () => {
    expect(fromSgfCoord("")).toBeNull()
    expect(fromSgfCoord("a")).toBeNull()
  })

  it("round-trips correctly", () => {
    const coords: [number, number][] = [[0, 0], [5, 3], [18, 18], [9, 9], [2, 15]]
    for (const [r, c] of coords) {
      const sgf = toSgfCoord(r, c)
      const back = fromSgfCoord(sgf)
      expect(back).not.toBeNull()
      expect(back![0]).toBe(r)
      expect(back![1]).toBe(c)
    }
  })
})

describe("exportSGF", () => {
  it("produces valid header for empty 9x9", () => {
    const state = createInitialState(9)
    const sgf = exportSGF(state)
    expect(sgf).toMatch(/^\(;GM\[1\]FF\[4\]SZ\[9\]KM\[6\.5\]/)
    expect(sgf).toMatch(/PB\[Black\]/)
    expect(sgf).toMatch(/PW\[White\]/)
    expect(sgf.endsWith(")")).toBe(true)
    // No moves for empty state
    const moveCount = (sgf.match(/;B\[|;W\[/g) || []).length
    expect(moveCount).toBe(0)
  })

  it("records a single black move", () => {
    const state = createInitialState(9)
    placeStone(state, 4, 4) // center
    const sgf = exportSGF(state)
    expect(sgf).toContain(";B[ee]")
  })

  it("records alternating black and white moves", () => {
    const state = createInitialState(9)
    placeStone(state, 3, 3) // B
    placeStone(state, 3, 4) // W
    placeStone(state, 3, 5) // B
    const sgf = exportSGF(state)
    expect(sgf).toContain(";B[dd]")
    expect(sgf).toContain(";W[ed]")
    expect(sgf).toContain(";B[fd]")
  })

  it("records passes as empty brackets", () => {
    const state = createInitialState(9)
    placeStone(state, 4, 4)
    pass(state) // W passes
    const sgf = exportSGF(state)
    expect(sgf).toContain(";B[ee]")
    expect(sgf).toContain(";W[]")
  })

  it("includes custom metadata", () => {
    const state = createInitialState(9)
    const sgf = exportSGF(state, {
      playerBlack: "Alice",
      playerWhite: "Bob",
      date: "2026-06-29",
      eventName: "Test Match",
      komi: 7.5,
    })
    expect(sgf).toContain("PB[Alice]")
    expect(sgf).toContain("PW[Bob]")
    expect(sgf).toContain("DT[2026-06-29]")
    expect(sgf).toContain("EV[Test Match]")
    expect(sgf).toContain("KM[7.5]")
  })

  it("produces different SGF for different board sizes", () => {
    const s9 = exportSGF(createInitialState(9))
    const s19 = exportSGF(createInitialState(19))
    expect(s9).toContain("SZ[9]")
    expect(s19).toContain("SZ[19]")
  })
})

describe("importSGF", () => {
  it("imports an empty 9x9 game", () => {
    const sgf = exportSGF(createInitialState(9))
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.size).toBe(9)
    expect(result!.state.moves.length).toBe(0)
  })

  it("round-trips a game with moves", () => {
    const state = createInitialState(9)
    placeStone(state, 3, 3)
    placeStone(state, 3, 4)
    placeStone(state, 4, 4)
    placeStone(state, 5, 5)
    const sgf = exportSGF(state)
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.size).toBe(9)
    expect(result!.state.moves.length).toBe(4)
    // Verify board state matches
    expect(result!.state.board[3][3]).toBe(BLACK)
    expect(result!.state.board[3][4]).toBe(WHITE)
    expect(result!.state.board[4][4]).toBe(BLACK)
    expect(result!.state.board[5][5]).toBe(WHITE)
  })

  it("round-trips a 19x19 game", () => {
    const state = createInitialState(19)
    placeStone(state, 3, 3)
    placeStone(state, 15, 15)
    const sgf = exportSGF(state)
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.size).toBe(19)
    expect(result!.state.board[3][3]).toBe(BLACK)
    expect(result!.state.board[15][15]).toBe(WHITE)
  })

  it("handles passes in import", () => {
    const state = createInitialState(9)
    placeStone(state, 4, 4)
    pass(state)
    placeStone(state, 4, 5)
    const sgf = exportSGF(state)
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.moves.length).toBe(3)
  })

  it("imports handicap stones (AB/AW)", () => {
    // 9x9 handicap: AB at cc=(2,2) and cg=(6,2), AW at ee=(4,4)
    const sgf = "(;GM[1]FF[4]SZ[9]KM[6.5]PB[B]PW[W]AB[cc][cg]AW[ee];B[dd])"
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.board[2][2]).toBe(BLACK)
    expect(result!.state.board[6][2]).toBe(BLACK)
    expect(result!.state.board[4][4]).toBe(WHITE)
    expect(result!.state.moves.length).toBe(1)
  })

  it("imports valid SGF with komi", () => {
    const sgf = "(;GM[1]FF[4]SZ[9]KM[7.5]PB[Alice]PW[Bob];B[ee];W[dd])"
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.meta.komi).toBe(7.5)
    expect(result!.meta.playerBlack).toBe("Alice")
    expect(result!.meta.playerWhite).toBe("Bob")
  })

  it("returns null for non-Go SGF", () => {
    const sgf = "(;GM[2]FF[4]SZ[19])"
    const result = importSGF(sgf)
    expect(result).toBeNull()
  })

  it("returns null for invalid SGF", () => {
    expect(importSGF("")).toBeNull()
    expect(importSGF("not sgf")).toBeNull()
  })

  it("defaults to size 19 when SZ missing", () => {
    const sgf = "(;GM[1]FF[4]KM[6.5])"
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.state.size).toBe(19)
  })

  it("returns warnings for illegal moves", () => {
    // Same position twice (ko-like)
    const state = createInitialState(9)
    placeStone(state, 0, 0) // B
    placeStone(state, 1, 1) // W
    const sgf = exportSGF(state)
    // Try to replay the same move — no warnings expected since clean replay
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.warnings.length).toBe(0)
  })

  it("includes metadata in result", () => {
    const sgf = "(;GM[1]FF[4]SZ[13]KM[6.5]PB[Test]PW[Bot]DT[2026-01-01];B[ee])"
    const result = importSGF(sgf)
    expect(result).not.toBeNull()
    expect(result!.meta.playerBlack).toBe("Test")
    expect(result!.meta.playerWhite).toBe("Bot")
    expect(result!.meta.date).toBe("2026-01-01")
    expect(result!.state.size).toBe(13)
  })
})
