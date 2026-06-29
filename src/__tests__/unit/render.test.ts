/**
 * Unit tests for src/render.ts — CLI Rendering
 */
import { describe, it, expect } from "bun:test"
import { renderBoard, renderStatus, parseCoord, showHelp, showResult, printUI } from "../../render.ts"
import { createInitialState, BLACK, WHITE, placeStone, pass } from "../../engine.ts"

describe("renderBoard", () => {
  it("includes column headers", () => {
    const s = createInitialState(9)
    const out = renderBoard(s)
    expect(out).toContain("A")
    expect(out).toContain("I")
  })
  it("includes row numbers", () => {
    const s = createInitialState(9)
    const out = renderBoard(s)
    expect(out).toContain(" 1")
    expect(out).toContain(" 9")
  })
  it("shows B for black stones", () => {
    const s = createInitialState(9)
    placeStone(s, 4, 4)
    const out = renderBoard(s)
    expect(out).toContain("B")
  })
  it("shows W for white stones", () => {
    const s = createInitialState(9)
    // Place black, then white
    placeStone(s, 4, 4)
    placeStone(s, 3, 3)
    const out = renderBoard(s)
    expect(out).toContain("W")
  })
  it("shows star points as +", () => {
    const s = createInitialState(9)
    const out = renderBoard(s)
    const plusCount = (out.match(/\+/g) || []).length
    expect(plusCount).toBeGreaterThanOrEqual(4)
  })
})

describe("renderStatus", () => {
  it("shows current player", () => {
    const s = createInitialState(9)
    expect(renderStatus(s)).toContain("B Black")
  })
  it("shows capture counts", () => {
    const s = createInitialState(9)
    s.captures[BLACK] = 5
    expect(renderStatus(s)).toContain("Black: 5")
  })
  it("shows passes after a pass", () => {
    const s = createInitialState(9)
    pass(s)
    expect(renderStatus(s)).toContain("Passes: 1/2")
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
  it("outputs result without throwing", () => {
    const s = createInitialState(9)
    expect(() => showResult(s)).not.toThrow()
  })
})

describe("printUI", () => {
  it("outputs UI without throwing", () => {
    const s = createInitialState(9)
    expect(() => printUI(s)).not.toThrow()
  })
})
