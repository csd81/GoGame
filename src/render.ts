// Ancient Go - CLI Rendering
import { isStarPoint, EMPTY, BLACK, WHITE, countScore } from "./engine.ts"
import type { GameState } from "./engine.ts"

// ── Auto-detection helpers ──────────────────────────────────

export function hasColorSupport(): boolean {
  if (typeof process === "undefined") return false
  if (process.env?.NO_COLOR) return false
  if (!process.stdout?.isTTY) return false
  return true
}

export function hasUnicodeSupport(): boolean {
  if (typeof process === "undefined") return true
  // Windows cmd.exe doesn't handle Unicode well; Windows Terminal does
  if (process.platform === "win32" && !process.env?.WT_SESSION) return false
  return true
}

// ── Rendering options ───────────────────────────────────────

export interface RenderOpts {
  color?: boolean
  unicode?: boolean
}

function resolveOpts(opts?: RenderOpts): Required<RenderOpts> {
  return {
    color: opts?.color ?? hasColorSupport(),
    unicode: opts?.unicode ?? hasUnicodeSupport(),
  }
}

// ── Character maps ──────────────────────────────────────────

const UNICODE_CHARS = {
  black: "\u25CF",   // ●
  white: "\u25CB",   // ○
  empty: "\u00B7",   // ·
  star:  "\u2727",   // ✧
} as const

const ASCII_CHARS = {
  black: "B",
  white: "W",
  empty: ".",
  star:  "+",
} as const

// ── ANSI color codes ────────────────────────────────────────

const C = {
  rst:  "\x1b[0m",
  blk:  "\x1b[97;40m",   // white on dark gray bg
  wht:  "\x1b[30;107m",  // black on light bg
  star: "\x1b[33;2m",    // dim yellow
  emp:  "\x1b[90m",      // dim gray
  hdr:  "\x1b[36m",      // cyan
  last: "\x1b[31m",      // red
  dim:  "\x1b[2m",       // dim
} as const

// ── Help: format a coordinate string ────────────────────────

function coordStr(r: number, c: number, size: number): string {
  const col = String.fromCharCode(65 + c)
  const row = size - r
  return col + row
}

// ── renderBoard ──────────────────────────────────────────────

export function renderBoard(state: GameState, opts?: RenderOpts): string {
  const { color, unicode } = resolveOpts(opts)
  const { size, board, lastMove } = state
  const chars = unicode ? UNICODE_CHARS : ASCII_CHARS
  const lines: string[] = []
  const colWidth = size > 13 ? 3 : 2

  // Header
  let header = " ".repeat(colWidth + 1)
  for (let c = 0; c < size; c++) {
    const label = String.fromCharCode(65 + (c < 26 ? c : c - 26))
    if (color) {
      header += C.hdr + label.padStart(colWidth) + C.rst
    } else {
      header += label.padStart(colWidth)
    }
  }
  lines.push(header)

  // Empty separator line (keep for visual spacing)
  lines.push("")

  // Board rows
  for (let r = 0; r < size; r++) {
    const rowNum = (size - r).toString().padStart(colWidth)
    let row = color ? C.hdr + rowNum + C.rst + " " : rowNum + " "
    for (let c = 0; c < size; c++) {
      const cell = board[r][c]
      const isLast = lastMove !== null && lastMove.r === r && lastMove.c === c
      let char: string
      let ansiBefore = ""
      let ansiAfter = ""

      if (cell === EMPTY) {
        char = isStarPoint(r, c, size) ? chars.star : chars.empty
        if (color) {
          ansiBefore = isStarPoint(r, c, size) ? C.star : C.emp
          ansiAfter = C.rst
        }
      } else if (cell === BLACK) {
        char = chars.black
        if (color) {
          ansiBefore = (isLast ? C.last : "") + C.blk
          ansiAfter = C.rst
        }
      } else {
        char = chars.white
        if (color) {
          ansiBefore = (isLast ? C.last : "") + C.wht
          ansiAfter = C.rst
        }
      }

      if (ansiBefore) {
        row += ansiBefore + char.padStart(colWidth) + ansiAfter
      } else {
        row += char.padStart(colWidth)
      }
    }
    row += " " + (color ? C.hdr + rowNum + C.rst : rowNum)
    lines.push(row)
  }

  // Bottom header
  lines.push("")
  lines.push(header)

  return lines.join("\n")
}

// ── renderStatus ─────────────────────────────────────────────

export function renderStatus(state: GameState, opts?: RenderOpts): string {
  const { color, unicode } = resolveOpts(opts)
  const turnSymbol = state.currentPlayer === BLACK
    ? (unicode ? UNICODE_CHARS.black : "B")
    : (unicode ? UNICODE_CHARS.white : "W")
  const turnName = state.currentPlayer === BLACK ? "Black" : "White"
  const bSymbol = unicode ? UNICODE_CHARS.black : "B"
  const wSymbol = unicode ? UNICODE_CHARS.white : "W"

  let s = ""
  if (color) s += C.dim
  s += "Turn " + state.moveCount
  if (color) s += C.rst
  s += " \u2014 " + turnSymbol + " " + turnName

  if (color) s += C.dim
  s += "  |  Captures " + bSymbol + " " + state.captures[BLACK] + " " + wSymbol + " " + state.captures[WHITE]
  if (color) s += C.rst

  if (state.consecutivePasses > 0) {
    if (color) s += C.dim
    s += "  |  Passes " + state.consecutivePasses + "/2"
    if (color) s += C.rst
  }

  // Last move
  if (state.lastMove) {
    s += "  |  Last: " + coordStr(state.lastMove.r, state.lastMove.c, state.size)
  } else if (state.moveCount > 0) {
    s += "  |  Last: pass"
  }

  // Live score estimate
  const score = countScore(state)
  const diff = score.blackScore - score.whiteScore
  const diffStr = diff >= 0
    ? "B+" + (diff === Math.floor(diff) ? String(diff) : diff.toFixed(1))
    : "W+" + (Math.abs(diff) === Math.floor(Math.abs(diff)) ? String(Math.abs(diff)) : Math.abs(diff).toFixed(1))
  const bSym = unicode ? UNICODE_CHARS.black : "B"
  const wSym = unicode ? UNICODE_CHARS.white : "W"
  if (color) s += "\n" + C.dim
  else s += "\n"
  s += "Score: " + bSym + " " + score.blackScore.toFixed(1) + " | " + wSym + " " + score.whiteScore.toFixed(1)
  s += " (" + diffStr + ")"
  if (color) s += C.rst

  return s
}

// ── parseCoord ───────────────────────────────────────────────

export function parseCoord(input: string, size: number): [number, number] | null {
  const trimmed = input.trim().toUpperCase()
  const match = trimmed.match(/^([A-Z])(\d+)$/)
  if (!match) return null
  const col = match[1]!.charCodeAt(0) - 65
  const rowNum = parseInt(match[2]!, 10)
  const row = size - rowNum
  if (row < 0 || row >= size || col < 0 || col >= size) return null
  return [row, col]
}

// ── showHelp ─────────────────────────────────────────────────

export function showHelp(): void {
  console.log("Commands:")
  console.log("  <col><row>   Place a stone, e.g. A1, D4, K10")
  console.log("  pass         Pass your turn")
  console.log("  resign       Resign the game")
  console.log("  undo         Undo last move")
  console.log("  redo         Redo last undone move")
  console.log("  export       Save game to SGF file")
  console.log("  import       Load game from SGF file")
  console.log("  sgf          Print SGF to console")
  console.log("  help         Show this help")
  console.log("  quit         Exit")
}

// ── showResult ───────────────────────────────────────────────

export function showResult(state: GameState, opts?: RenderOpts): void {
  const { unicode } = resolveOpts(opts)
  const { blackScore, whiteScore } = countScore(state)
  const bSymbol = unicode ? UNICODE_CHARS.black : "B"
  const wSymbol = unicode ? UNICODE_CHARS.white : "W"
  console.log("")
  console.log("Final Score - " + bSymbol + " Black: " + blackScore + ", " + wSymbol + " White: " + whiteScore)
  if (blackScore > whiteScore) console.log(bSymbol + " Black wins!")
  else if (whiteScore > blackScore) console.log(wSymbol + " White wins!")
  else console.log("Draw!")
}

// ── printUI ──────────────────────────────────────────────────

export function printUI(state: GameState, opts?: RenderOpts): void {
  console.log(renderBoard(state, opts))
  console.log("")
  console.log(renderStatus(state, opts))
  console.log("")
}
