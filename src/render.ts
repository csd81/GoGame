// Ancient Go - CLI Rendering
import { isStarPoint, EMPTY, BLACK, WHITE, countScore } from "./engine.ts"
import type { GameState } from "./engine.ts"

export function renderBoard(state: GameState): string {
  const { size, board } = state
  const lines: string[] = []
  const colWidth = size > 13 ? 3 : 2
  let header = " ".repeat(colWidth + 1)
  for (let c = 0; c < size; c++) {
    const label = String.fromCharCode(65 + (c < 26 ? c : c - 26))
    header += label.padStart(colWidth)
  }
  lines.push(header)
  lines.push("")
  for (let r = 0; r < size; r++) {
    const rowNum = (size - r).toString().padStart(colWidth)
    let row = rowNum + " "
    for (let c = 0; c < size; c++) {
      const cell = board[r][c]
      let char: string
      if (cell === EMPTY) {
        char = isStarPoint(r, c, size) ? "+" : "."
      } else if (cell === BLACK) {
        char = "B"
      } else {
        char = "W"
      }
      row += char.padStart(colWidth)
    }
    row += " " + rowNum
    lines.push(row)
  }
  lines.push("")
  lines.push(header)
  return lines.join("\n")
}

export function renderStatus(state: GameState): string {
  const turnName = state.currentPlayer === BLACK ? "Black" : "White"
  const turnSymbol = state.currentPlayer === BLACK ? "B" : "W"
  let s = "Turn: " + turnSymbol + " " + turnName
  s += "  |  Captures - Black: " + state.captures[BLACK] + " White: " + state.captures[WHITE]
  if (state.consecutivePasses > 0) s += "  |  Passes: " + state.consecutivePasses + "/2"
  return s
}

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

export function showHelp(): void {
  console.log("Commands:")
  console.log("  <col><row>   Place a stone, e.g. A1, D4, K10")
  console.log("  pass         Pass your turn")
  console.log("  resign       Resign the game")
  console.log("  help         Show this help")
  console.log("  quit         Exit")
}

export function showResult(state: GameState): void {
  const { blackScore, whiteScore } = countScore(state)
  console.log("")
  console.log("Final Score - Black: " + blackScore + ", White: " + whiteScore)
  if (blackScore > whiteScore) console.log("Black wins!")
  else if (whiteScore > blackScore) console.log("White wins!")
  else console.log("Draw!")
}

export function printUI(state: GameState): void {
  console.log(renderBoard(state))
  console.log("")
  console.log(renderStatus(state))
  console.log("")
}
