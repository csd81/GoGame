/**
 * Unit tests for src/render.ts — CLI Rendering
 */
import { describe, it, expect } from "bun:test"
import { renderBoard, renderStatus, parseCoord, showHelp, showResult, printUI } from "../../render.ts"
import { createInitialState, BLACK, WHITE, placeStone, pass, countScore } from "../../engine.ts"

describe("renderBoard", () => {
  const ascii = { unicode: false, color: false } as const

  it("includes column headers", () => {
    const s = createInitialState(9)
    const out = renderBoard(s, ascii)
    expect(out).toContain("A")
    expect(out).toContain("I")
  })
  it("includes row numbers", () => {
    const s = createInitialState(9)
    const out = renderBoard(s, ascii)
    expect(out).toContain(" 1")
    expect(out).toContain(" 9")
  })
  it("shows B for black stones", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const out = renderBoard(s, ascii)
    expect(out).toContain("B")
  })
  it("shows W for white stones", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    const out = renderBoard(s, ascii)
    expect(out).toContain("W")
  })
  it("shows star points as +", () => {
    const s = createInitialState(9)
    const out = renderBoard(s, ascii)
    const plusCount = (out.match(/\+/g) || []).length
    expect(plusCount).toBeGreaterThanOrEqual(4)
  })
  it("last move marker shown via ANSI color in color mode", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const out = renderBoard(s, { unicode: false, color: true })
    // Color mode wraps the last stone in red ANSI codes
    expect(out).toContain("\x1b[31m")  // red ANSI
    expect(out).toContain("\x1b[97;40m")  // black stone bg
  })
  it("no ANSI codes in ASCII mode", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const out = renderBoard(s, ascii)
    expect(out).not.toContain("\x1b")
  })
  it("unified rendering with unicode chars", () => {
    const s = createInitialState(9)
    const out = renderBoard(s, { unicode: true, color: false })
    // Unicode mode should have dots not periods
    expect(out).toContain("\u00B7")  // middle dot
    expect(out).toContain("\u2727")  // star sparkle
  })
})

describe("renderStatus", () => {
  const ascii = { unicode: false, color: false } as const

  it("shows current player", () => {
    const s = createInitialState(9)
    expect(renderStatus(s, ascii)).toContain("B Black")
  })
  it("shows capture counts", () => {
    const s = createInitialState(9)
    s.captures[BLACK] = 5
    expect(renderStatus(s, ascii)).toContain("Captures B 5 W 0")
  })
  it("shows passes after a pass", () => {
    const s = createInitialState(9)
    pass(s)
    expect(renderStatus(s, ascii)).toContain("Passes 1/2")
  })
  it("includes move count", () => {
    const s = createInitialState(9)
    expect(renderStatus(s, ascii)).toContain("Turn 0")
    placeStone(s, 4, 4)
    expect(renderStatus(s, ascii)).toContain("Turn 1")
  })
  it("shows last move coordinate after placeStone", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    expect(renderStatus(s, ascii)).toContain("Last: E5")
  })
  it("shows Last: pass after a pass", () => {
    const s = createInitialState(9)
    pass(s)
    expect(renderStatus(s, ascii)).toContain("Last: pass")
  })
})

describe("parseCoord", () => {
  it("parses A1 on 19x19", () => {
    const coord = parseCoord("A1", 19)
    expect(coord).toEqual([18, 0])
  })
  it("parses S19 on 19x19", () => {
    const coord = parseCoord("S19", 19)
    expect(coord).toEqual([0, 18])
  })
  it("parses D4 on 9x9", () => {
    const coord = parseCoord("D4", 9)
    expect(coord).toEqual([5, 3])
  })
  it("returns null for out of bounds", () => {
    expect(parseCoord("A20", 19)).toBeNull()
    expect(parseCoord("T1", 19)).toBeNull()
  })
  it("returns null for malformed input", () => {
    expect(parseCoord("Z", 9)).toBeNull()
    expect(parseCoord("1A", 9)).toBeNull()
    expect(parseCoord("", 9)).toBeNull()
  })
  it("handles lowercase input", () => {
    const coord = parseCoord("k10", 19)
    expect(coord).toEqual([9, 10])
  })
})

describe("showHelp", () => {
  it("outputs help text without throwing", () => {
    expect(() => showHelp()).not.toThrow()
  })
})

describe("showResult", () => {
  const ascii = { unicode: false, color: false } as const

  it("outputs result without throwing", () => {
    const s = createInitialState(9)
    expect(() => showResult(s, ascii)).not.toThrow()
  })
  it("shows final score with B/W symbols", () => {
    const s = createInitialState(9)
    s.captures[BLACK] = 3
    // Capture console.log output
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      showResult(s, ascii)
      const joined = logs.join(" ")
      expect(joined).toContain("B Black: 3")
      expect(joined).toContain("W White:")
    } finally {
      console.log = origLog
    }
  })
})

describe("printUI", () => {
  const ascii = { unicode: false, color: false } as const

  it("outputs UI without throwing", () => {
    const s = createInitialState(9)
    expect(() => printUI(s, ascii)).not.toThrow()
  })
})
