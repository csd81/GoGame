/**
 * Ancient Go - Pure Game Engine
 * Types, board operations, move logic, scoring.
 * Zero CLI or UI dependencies — importable by tests and bots.
 */

// 1. Constants & Types

export const EMPTY = 0 as const
export const BLACK = 1 as const
export const WHITE = 2 as const

export type Cell = typeof EMPTY | typeof BLACK | typeof WHITE
export type Board = Cell[][]

export interface GameState {
  size: number
  board: Board
  currentPlayer: typeof BLACK | typeof WHITE
  captures: { [BLACK]: number; [WHITE]: number }
  history: string[]
  consecutivePasses: number
  gameOver: boolean
}

export interface MoveResult {
  valid: boolean
  reason?: string
  newBoard?: Board
  captured?: number
}

// 2. Board Utilities

export function createBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(EMPTY))
}

export function cloneBoard(board: Board): Board {
  return board.map(row => [...row])
}

export function boardKey(board: Board): string {
  return board.map(row => row.join("")).join("|")
}

export function getNeighbors(r: number, c: number, size: number): [number, number][] {
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  const result: [number, number][] = []
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) result.push([nr, nc])
  }
  return result
}

export function findGroup(board: Board, r: number, c: number): [number, number][] {
  const color = board[r][c]
  if (color === EMPTY) return []
  const size = board.length
  const visited = new Set<number>()
  const group: [number, number][] = []
  const stack: [number, number][] = [[r, c]]
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!
    const key = cr * size + cc
    if (visited.has(key)) continue
    visited.add(key)
    group.push([cr, cc])
    for (const [nr, nc] of getNeighbors(cr, cc, size)) {
      if (!visited.has(nr * size + nc) && board[nr][nc] === color) stack.push([nr, nc])
    }
  }
  return group
}

export function countLiberties(board: Board, group: [number, number][]): number {
  const size = board.length
  const liberties = new Set<number>()
  for (const [r, c] of group) {
    for (const [nr, nc] of getNeighbors(r, c, size)) {
      if (board[nr][nc] === EMPTY) liberties.add(nr * size + nc)
    }
  }
  return liberties.size
}

// 3. Star Points

export function isStarPoint(r: number, c: number, size: number): boolean {
  if (size === 9) return ([2, 4, 6].includes(r) && [2, 4, 6].includes(c))
  if (size === 13) return ([3, 6, 9].includes(r) && [3, 6, 9].includes(c))
  if (size === 19) { const s = [3, 9, 15]; return s.includes(r) && s.includes(c) }
  return false
}

// 4. Move Logic

function tryPlaceStone(board: Board, r: number, c: number, color: Cell): MoveResult {
  const size = board.length
  if (board[r][c] !== EMPTY) {
    return { valid: false, reason: "Intersection is not empty." }
  }
  const newBoard = cloneBoard(board)
  newBoard[r][c] = color
  let totalCaptured = 0
  const opponent: Cell = color === BLACK ? WHITE : BLACK
  for (const [nr, nc] of getNeighbors(r, c, size)) {
    if (newBoard[nr][nc] === opponent) {
      const enemyGroup = findGroup(newBoard, nr, nc)
      if (countLiberties(newBoard, enemyGroup) === 0) {
        for (const [cr, cc] of enemyGroup) newBoard[cr][cc] = EMPTY
        totalCaptured += enemyGroup.length
      }
    }
  }
  const ownGroup = findGroup(newBoard, r, c)
  if (countLiberties(newBoard, ownGroup) === 0) {
    return { valid: false, reason: "Suicide is not allowed." }
  }
  return { valid: true, newBoard, captured: totalCaptured }
}

function checkKo(newBoard: Board, history: string[]): boolean {
  const key = boardKey(newBoard)
  return history.length >= 2 && key === history[history.length - 2]
}

export function isValidMove(state: GameState, r: number, c: number): MoveResult {
  if (state.gameOver) return { valid: false, reason: "Game is over." }
  const result = tryPlaceStone(state.board, r, c, state.currentPlayer)
  if (!result.valid || !result.newBoard) return result
  if (checkKo(result.newBoard, state.history))
    return { valid: false, reason: "Ko rule - cannot repeat previous position." }
  return result
}

export function isValidMoveForColor(state: GameState, r: number, c: number, color: Cell): MoveResult {
  if (state.gameOver) return { valid: false, reason: "Game is over." }
  const result = tryPlaceStone(state.board, r, c, color)
  if (!result.valid || !result.newBoard) return result
  if (checkKo(result.newBoard, state.history))
    return { valid: false, reason: "Ko rule - cannot repeat previous position." }
  return result
}

export function placeStone(state: GameState, r: number, c: number): boolean {
  const result = isValidMove(state, r, c)
  if (!result.valid || !result.newBoard) return false
  state.board = result.newBoard
  state.history.push(boardKey(state.board))
  state.captures[state.currentPlayer] += result.captured!
  state.consecutivePasses = 0
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK
  return true
}

export function pass(state: GameState): void {
  state.consecutivePasses++
  state.history.push(boardKey(state.board))
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK
  if (state.consecutivePasses >= 2) state.gameOver = true
}

export function resign(state: GameState): void {
  state.gameOver = true
}

export function createInitialState(size: number = 19): GameState {
  return {
    size,
    board: createBoard(size),
    currentPlayer: BLACK,
    captures: { [BLACK]: 0, [WHITE]: 0 },
    history: [],
    consecutivePasses: 0,
    gameOver: false,
  }
}

export function countScore(state: GameState): { blackScore: number; whiteScore: number } {
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
