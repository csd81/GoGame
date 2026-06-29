/**
 * Ancient Go - SGF Export / Import
 * Smart Game Format (FF4) for Go games.
 */
import {
  EMPTY, BLACK, WHITE, createInitialState, placeStone, pass,
  cloneBoard, getNeighbors, findGroup, countLiberties,
  boardKey,
} from "./engine.ts"
import type { GameState, Cell, MoveRecord } from "./engine.ts"

// ── Types ─────────────────────────────────────────────────

export interface SGFMeta {
  playerBlack?: string
  playerWhite?: string
  date?: string
  eventName?: string
  komi?: number
  result?: string
}

export interface SGFParseResult {
  state: GameState
  meta: Required<SGFMeta>
  warnings: string[]
}

// ── Coordinate conversion ─────────────────────────────────

export function toSgfCoord(r: number, c: number): string {
  return String.fromCharCode(97 + c) + String.fromCharCode(97 + r)
}

export function fromSgfCoord(s: string): [number, number] | null {
  if (s.length < 2) return null
  const c = s.charCodeAt(0) - 97
  const r = s.charCodeAt(1) - 97
  if (r < 0 || c < 0) return null
  return [r, c]
}

// ── Export: GameState → SGF string ────────────────────────

const NAME_DEFAULTS = {
  black: "Black",
  white: "White",
}

function formatResult(state: GameState): string {
  if (state.gameOver && state.consecutivePasses >= 2) {
    const { blackScore, whiteScore } = scoreForSGF(state)
    const diff = Math.abs(blackScore - whiteScore)
    const diffStr = diff === Math.floor(diff) ? String(diff) : diff.toFixed(1)
    if (blackScore > whiteScore) return "B+" + diffStr
    if (whiteScore > blackScore) return "W+" + diffStr
    return "0"
  }
  if (state.gameOver) {
    // Resignation — currentPlayer is the one who resigned
    // (resign() doesn't switch currentPlayer)
    const winner = state.currentPlayer === BLACK ? WHITE : BLACK
    return winner === BLACK ? "B+R" : "W+R"
  }
  return ""
}

function scoreForSGF(state: GameState): { blackScore: number; whiteScore: number } {
  // Re-use countScore but without importing it to avoid circular deps
  const { board, size, captures } = state
  const territory: Record<number, number> = { [BLACK]: 0, [WHITE]: 0 }
  const visited = new Set<number>()
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY && !visited.has(r * size + c)) {
        const borders = new Set<Cell>()
        const stack: [number, number][] = [[r, c]]
        const regionVisited = new Set<number>()
        while (stack.length > 0) {
          const [cr, cc] = stack.pop()!
          const key = cr * size + cc
          if (regionVisited.has(key)) continue
          regionVisited.add(key)
          visited.add(key)
          for (const [nr, nc] of getNeighbors(cr, cc, size)) {
            if (board[nr][nc] === EMPTY) {
              if (!regionVisited.has(nr * size + nc)) stack.push([nr, nc])
            } else {
              borders.add(board[nr][nc])
            }
          }
        }
        if (borders.size === 1) {
          const owner = [...borders][0]!
          territory[owner] += regionVisited.size
        }
      }
    }
  }
  return {
    blackScore: territory[BLACK] + captures[BLACK],
    whiteScore: territory[WHITE] + captures[WHITE] + 6.5,
  }
}

export function exportSGF(state: GameState, meta?: SGFMeta): string {
  const pb = meta?.playerBlack ?? NAME_DEFAULTS.black
  const pw = meta?.playerWhite ?? NAME_DEFAULTS.white
  const dt = meta?.date ?? ""
  const ev = meta?.eventName ?? ""
  const km = meta?.komi ?? 6.5
  const re = meta?.result ?? formatResult(state)

  const parts: string[] = []
  parts.push("(;GM[1]FF[4]SZ[" + state.size + "]KM[" + km + "]")
  if (re) parts.push("RE[" + re + "]")
  parts.push("PB[" + pb + "]")
  parts.push("PW[" + pw + "]")
  if (dt) parts.push("DT[" + dt + "]")
  if (ev) parts.push("EV[" + ev + "]")

  for (const move of state.moves) {
    const color = move.color === BLACK ? "B" : "W"
    if (move.r === null || move.c === null) {
      parts.push(";" + color + "[]")
    } else {
      parts.push(";" + color + "[" + toSgfCoord(move.r, move.c) + "]")
    }
  }

  parts.push(")")
  return parts.join("")
}

// ── Import: SGF string → GameState ────────────────────────

function sgfEscape(s: string): string {
  // SGF escaping: \] → ], \\ → \, \n → newline
  return s
    .replace(/\\\]/g, "]")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
}

function parseSGFProperties(nodeStr: string): Array<{ key: string; values: string[] }> {
  const props: Array<{ key: string; values: string[] }> = []
  const re = /([A-Z]+)((?:\[[^\]]*\])+)/g
  let match
  while ((match = re.exec(nodeStr)) !== null) {
    const key = match[1]!
    const valuesStr = match[2]!
    const values: string[] = []
    const valRe = /\[([^\]]*)\]/g
    let vm
    while ((vm = valRe.exec(valuesStr)) !== null) {
      values.push(sgfEscape(vm[1]!))
    }
    props.push({ key, values })
  }
  return props
}

function splitSGFNodes(sgf: string): string[] {
  // Remove outermost (; and )
  let inner = sgf.trim()
  if (inner.startsWith("(;")) inner = inner.slice(2)
  else if (inner.startsWith("(")) inner = inner.slice(1)
  if (inner.endsWith(")")) inner = inner.slice(0, -1)

  // Split by semicolons not inside brackets
  const nodes: string[] = []
  let current = ""
  let depth = 0
  let escape = false
  for (const ch of inner) {
    if (escape) { current += ch; escape = false; continue }
    if (ch === "\\" && depth > 0) { current += ch; escape = true; continue }
    if (ch === "[" && depth === 0) { current += ch; depth = 1 }
    else if (ch === "[" && depth > 0) { current += ch; depth++ }
    else if (ch === "]" && depth > 0) { current += ch; depth-- }
    else if (ch === ";" && depth === 0) {
      if (current.trim()) nodes.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim()) nodes.push(current.trim())
  return nodes
}

export function importSGF(sgf: string): SGFParseResult | null {
  try {
    // Collapse whitespace outside brackets
    const normalized = sgf.replace(/\s+/g, " ").trim()

    if (!normalized.startsWith("(") || !normalized.endsWith(")")) {
      return null
    }

    const nodeStrs = splitSGFNodes(normalized)
    if (nodeStrs.length === 0) return null

    // Parse root node
    const rootProps = parseSGFProperties(nodeStrs[0]!)

    // Extract root metadata
    const getProp = (key: string): string[] | null => {
      const p = rootProps.find(prop => prop.key === key)
      return p ? p.values : null
    }

    // Validate GM[1] (Go)
    const gm = getProp("GM")
    if (gm !== null && gm[0] !== "1") return null

    // Board size — accept any valid size
    const szVal = getProp("SZ")
    const size = szVal ? parseInt(szVal[0]!, 10) : 19
    if (size < 1 || size > 52) return null

    // Komi
    const kmVal = getProp("KM")
    const komi = kmVal ? parseFloat(kmVal[0]!) : 6.5

    // Player names
    const pbVal = getProp("PB")
    const pwVal = getProp("PW")
    const dtVal = getProp("DT")
    const evVal = getProp("EV")
    const reVal = getProp("RE")

    // Create initial state
    const state = createInitialState(size)

    // Apply setup stones (handicap)
    const abStones = getProp("AB") ?? []
    const awStones = getProp("AW") ?? []

    // Place AB stones as black, AW as white
    // We place them directly via board manipulation for setup
    for (const coord of abStones) {
      const parsed = fromSgfCoord(coord)
      if (parsed) {
        const [r, c] = parsed
        if (r >= 0 && r < size && c >= 0 && c < size && state.board[r][c] === EMPTY) {
          state.board[r][c] = BLACK
        }
      }
    }
    for (const coord of awStones) {
      const parsed = fromSgfCoord(coord)
      if (parsed) {
        const [r, c] = parsed
        if (r >= 0 && r < size && c >= 0 && c < size && state.board[r][c] === EMPTY) {
          state.board[r][c] = WHITE
        }
      }
    }

    // Reset moves tracking — we'll replay from scratch
    state.moves = []

    // Process move nodes (skip root node)
    const warnings: string[] = []
    for (let i = 1; i < nodeStrs.length; i++) {
      const props = parseSGFProperties(nodeStrs[i]!)
      for (const prop of props) {
        if (prop.key === "B" || prop.key === "W") {
          const coordStr = prop.values[0] ?? ""
          if (coordStr === "") {
            pass(state)
          } else {
            const parsed = fromSgfCoord(coordStr)
            if (!parsed) {
              warnings.push("Invalid coordinate at move " + state.moveCount + ": " + coordStr)
              // Still record a pass to keep alignment
              pass(state)
            } else {
              const [r, c] = parsed
              if (r < 0 || r >= size || c < 0 || c >= size) {
                warnings.push("Out-of-bounds coordinate at move " + state.moveCount + ": " + coordStr)
                pass(state)
              } else {
                const ok = placeStone(state, r, c)
                if (!ok) {
                  warnings.push("Illegal move at " + coordStr + " (move " + state.moveCount + "), treating as pass")
                  // Manually record a pass in moves since placeStone didn't succeed
                  // But state.currentPlayer may already be wrong...
                  // Actually placeStone returns false, so no state change happened
                  pass(state)
                }
              }
            }
          }
        }
      }
    }

    const meta: Required<SGFMeta> = {
      playerBlack: pbVal?.[0] ?? NAME_DEFAULTS.black,
      playerWhite: pwVal?.[0] ?? NAME_DEFAULTS.white,
      date: dtVal?.[0] ?? "",
      eventName: evVal?.[0] ?? "",
      komi,
      result: "",
    }

    // Handle result field — set gameOver for resignations
    if (reVal && reVal[0]) {
      const re = reVal[0]
      meta.result = re
      if (re.includes("R") || re === "0" || re.includes("+")) {
        state.gameOver = true
      }
    }

    return { state, meta, warnings }
  } catch {
    return null
  }
}

// ── Format SGF string for display ──────────────────────────

export function formatSGF(sgf: string): string {
  // Add line breaks for readability
  return sgf
    .replace(/\)$/, "\n)")
    .replace(/;B\[/g, "\n;B[")
    .replace(/;W\[/g, "\n;W[")
    .replace(/^\(;/g, "(;\n")
    .trim()
}
