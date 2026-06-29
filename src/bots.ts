/**
 * Ancient Go - AI Bots
 * Each bot implements selectMove(state, botColor).
 * Pure functions — no side effects beyond Math.random().
 */
import { EMPTY, BLACK, WHITE } from "./engine.ts"
import type { GameState, Cell, MoveResult } from "./engine.ts"

export interface Bot {
  name: string
  selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null
}

// External references (dependency injection from engine)
let getNeighborsRef: (r: number, c: number, size: number) => [number, number][]
let findGroupRef: (board: any[][], r: number, c: number) => [number, number][]
let countLibertiesRef: (board: any[][], group: [number, number][]) => number
let isValidMoveRef: (state: GameState, r: number, c: number, color: Cell) => MoveResult

export function setBotDeps(
  getNeighbors: (r: number, c: number, size: number) => [number, number][],
  findGroup: (board: any[][], r: number, c: number) => [number, number][],
  countLiberties: (board: any[][], group: [number, number][]) => number,
  isValidMove: (state: GameState, r: number, c: number, color: Cell) => MoveResult
): void {
  getNeighborsRef = getNeighbors
  findGroupRef = findGroup
  countLibertiesRef = countLiberties
  isValidMoveRef = isValidMove
}

export function createRandomBot(): Bot {
  return {
    name: "Random",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const { size, board } = state
      const empty: [number, number][] = []
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === EMPTY) empty.push([r, c])
        }
      }
      if (empty.length === 0) return null
      const start = Math.floor(Math.random() * empty.length)
      for (let i = 0; i < empty.length; i++) {
        const idx = (start + i) % empty.length
        const [r, c] = empty[idx]!
        const result = isValidMoveRef(state, r, c, botColor)
        if (result.valid) return { r, c }
      }
      return null
    }
  }
}

export function createGreedyBot(): Bot {
  return {
    name: "Greedy",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const { size, board } = state
      const opponent: Cell = botColor === BLACK ? WHITE : BLACK
      // Priority 1: Capture enemy groups with 1 liberty
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === opponent) {
            const group = findGroupRef(board, r, c)
            if (countLibertiesRef(board, group) === 1) {
              for (const [gr, gc] of group) {
                for (const [nr, nc] of getNeighborsRef(gr, gc, size)) {
                  if (board[nr][nc] === EMPTY) {
                    const result = isValidMoveRef(state, nr, nc, botColor)
                    if (result.valid) return { r: nr, c: nc }
                  }
                }
              }
            }
          }
        }
      }
      // Priority 2: Defend own groups with 1 liberty
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === botColor) {
            const group = findGroupRef(board, r, c)
            if (countLibertiesRef(board, group) === 1) {
              for (const [gr, gc] of group) {
                for (const [nr, nc] of getNeighborsRef(gr, gc, size)) {
                  if (board[nr][nc] === EMPTY) {
                    const result = isValidMoveRef(state, nr, nc, botColor)
                    if (result.valid) return { r: nr, c: nc }
                  }
                }
              }
            }
          }
        }
      }
      // Priority 3: Center-biased random
      const center = (size - 1) / 2
      const candidates: Array<{ r: number; c: number; score: number }> = []
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === EMPTY) {
            const result = isValidMoveRef(state, r, c, botColor)
            if (result.valid) {
              const dist = Math.abs(r - center) + Math.abs(c - center)
              candidates.push({ r, c, score: dist + Math.random() * 3 })
            }
          }
        }
      }
      if (candidates.length === 0) return null
      candidates.sort((a, b) => a.score - b.score)
      return { r: candidates[0]!.r, c: candidates[0]!.c }
    }
  }
}
