/**
 * Ancient Go - AI Bots
 * Each bot implements selectMove(state, botColor).
 * Pure functions — no side effects beyond Math.random().
 */
import { EMPTY, BLACK, WHITE, isStarPoint, copyState, getLegalMoves, placeStone, pass, countScore } from "./engine.ts"
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

// ============================================================
// Level 3 — Heuristic Bot
// ============================================================

const INFLUENCE_RADIUS = 5
const CAPTURE_WEIGHT = 25
const ATARI_WEIGHT = 15
const DEFENSE_WEIGHT = 12
const INFLUENCE_DELTA_WEIGHT = 2
const CONNECTION_WEIGHT = 4
const TERRITORY_WEIGHT = 3
const EDGE_PENALTY_1 = -4
const EDGE_PENALTY_2 = -2
const STAR_POINT_BONUS = 3
const CENTER_BIAS_WEIGHT = 1

function buildInfluenceMap(board: Board, size: number): number[][] {
  const map = Array.from({ length: size }, () => Array<number>(size).fill(0))
  const radius = INFLUENCE_RADIUS
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY) continue
      const sign = board[r][c] === BLACK ? 1 : -1
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
          const dist = Math.max(Math.abs(dr), Math.abs(dc))
          map[nr][nc] += sign * (radius - dist) / radius
        }
      }
    }
  }
  return map
}

function getInfluenceAround(influence: number[][], r: number, c: number, size: number, radius: number): number {
  let sum = 0
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        sum += influence[nr][nc]
      }
    }
  }
  return sum
}

function edgePenalty(r: number, c: number, size: number): number {
  const minDist = Math.min(r, c, size - 1 - r, size - 1 - c)
  if (minDist === 0) return EDGE_PENALTY_1  // first line
  if (minDist === 1) return EDGE_PENALTY_2  // second line
  return 0
}

function centerBias(r: number, c: number, size: number): number {
  const center = (size - 1) / 2
  const maxDist = center
  const dist = Math.abs(r - center) + Math.abs(c - center)
  return CENTER_BIAS_WEIGHT * (1 - dist / (maxDist * 2))
}

function isEarlyGame(state: GameState): boolean {
  let stones = 0
  for (let r = 0; r < state.size; r++)
    for (let c = 0; c < state.size; c++)
      if (state.board[r][c] !== EMPTY) stones++
  return stones < 40
}

function hasGroupAtari(board: Board, color: Cell): boolean {
  const size = board.length
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === color) {
        const group = findGroupRef(board, r, c)
        if (countLibertiesRef(board, group) === 1) return true
      }
    }
  }
  return false
}

function countFriendlyNeighbors(board: Board, r: number, c: number, color: Cell, size: number): number {
  let count = 0
  for (const [nr, nc] of getNeighborsRef(r, c, size)) {
    if (board[nr][nc] === color) count++
  }
  return count
}

function getLegalMoves(state: GameState, color: Cell): [number, number][] {
  const moves: [number, number][] = []
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.board[r][c] !== EMPTY) continue
      const result = isValidMoveRef(state, r, c, color)
      if (result.valid) moves.push([r, c])
    }
  }
  return moves
}

function scoreMove(state: GameState, r: number, c: number, color: Cell): number {
  const { size } = state
  const opponent: Cell = color === BLACK ? WHITE : BLACK

  // Simulate the move
  const result = isValidMoveRef(state, r, c, color)
  if (!result.valid || !result.newBoard) return -Infinity

  const newBoard = result.newBoard
  const captured = result.captured!

  // Compute scores
  let score = 0

  // 1. Capture value
  score += captured * CAPTURE_WEIGHT

  // 2. Atari — does this move put any enemy group at 1 liberty?
  if (hasGroupAtari(newBoard, opponent)) {
    score += ATARI_WEIGHT
  }

  // 3. Defense — does this move save a friendly group from atari?
  if (hasGroupAtari(state.board, color) && !hasGroupAtari(newBoard, color)) {
    score += DEFENSE_WEIGHT
  }

  // 4. Connection
  score += countFriendlyNeighbors(newBoard, r, c, color, size) * CONNECTION_WEIGHT

  // 5. Influence delta
  const influenceBefore = buildInfluenceMap(state.board, size)
  const influenceAfter = buildInfluenceMap(newBoard, size)
  const deltaBefore = getInfluenceAround(influenceBefore, r, c, size, 3)
  const deltaAfter = getInfluenceAround(influenceAfter, r, c, size, 3)
  const sign = color === BLACK ? 1 : -1
  score += (deltaAfter - deltaBefore) * sign * INFLUENCE_DELTA_WEIGHT

  // 6. Edge penalty
  score += edgePenalty(r, c, size)

  // 7. Star point bonus
  if (isStarPoint(r, c, size) && isEarlyGame(state)) {
    score += STAR_POINT_BONUS
  }

  // 8. Center bias
  score += centerBias(r, c, size)

  return score
}

function evaluatePosition(state: GameState, color: Cell): number {
  const opponent: Cell = color === BLACK ? WHITE : BLACK
  const influence = buildInfluenceMap(state.board, state.size)
  let score = 0
  for (let r = 0; r < state.size; r++)
    for (let c = 0; c < state.size; c++)
      score += influence[r][c]
  const sign = color === BLACK ? 1 : -1
  score += (state.captures[color] - state.captures[opponent]) * CAPTURE_WEIGHT * sign
  return score * sign  // positive = good for color
}

export function createHeuristicBot(): Bot {
  return {
    name: "Heuristic",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const moves = getLegalMoves(state, botColor)
      if (moves.length === 0) return null

      let bestMove = moves[0]!
      let bestScore = -Infinity

      for (const [r, c] of moves) {
        const score = scoreMove(state, r, c, botColor)
        if (score > bestScore) {
          bestScore = score
          bestMove = [r, c]
        }
      }

      return { r: bestMove[0], c: bestMove[1] }
    }
  }
}

export function createHeuristicBot2Ply(): Bot {
  return {
    name: "Heuristic 2-Ply",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const moves = getLegalMoves(state, botColor)
      if (moves.length === 0) return null

      const opponent: Cell = botColor === BLACK ? WHITE : BLACK
      let bestMove = moves[0]!
      let bestScore = -Infinity
      const K = Math.min(8, moves.length)

      // Score all moves with base heuristic, sort, take top K
      const scored = moves.map(([r, c]) => ({ r, c, score: scoreMove(state, r, c, botColor) }))
      scored.sort((a, b) => b.score - a.score)

      for (let i = 0; i < K; i++) {
        const { r, c, score: baseScore } = scored[i]!

        // Simulate this move
        const simResult = isValidMoveRef(state, r, c, botColor)
        if (!simResult.valid || !simResult.newBoard) continue

        // Create simulated state
        const simState: GameState = {
          size: state.size,
          board: simResult.newBoard,
          currentPlayer: opponent,
          captures: { ...state.captures },
          history: [...state.history],
          consecutivePasses: 0,
          gameOver: false,
        }
        simState.captures[botColor] += simResult.captured!

        // Find opponent's best response
        const oppMoves = getLegalMoves(simState, opponent)
        let oppBestScore = 0
        if (oppMoves.length > 0) {
          for (const [or2, oc2] of oppMoves) {
            const oppScore = scoreMove(simState, or2, oc2, opponent)
            if (oppScore > oppBestScore) oppBestScore = oppScore
          }
        }

        const adjustedScore = baseScore - oppBestScore * 0.3
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore
          bestMove = [r, c]
        }
      }

      return { r: bestMove[0], c: bestMove[1] }
    }
  }
}

// ============================================================
// Level 4 — MCTS Bot (Monte Carlo Tree Search)
// ============================================================

const UCB_C = 1.4

interface MCTSNode {
  r: number
  c: number
  parent: MCTSNode | null
  children: MCTSNode[]
  visits: number
  wins: number
  untriedMoves: [number, number][]
  playerJustMoved: Cell
}

function ucb1(node: MCTSNode, parentVisits: number): number {
  if (node.visits === 0) return Infinity
  return node.wins / node.visits + UCB_C * Math.sqrt(Math.log(parentVisits) / node.visits)
}

function selectChild(node: MCTSNode): MCTSNode {
  let best = node.children[0]!
  let bestScore = ucb1(best, node.visits)
  for (let i = 1; i < node.children.length; i++) {
    const score = ucb1(node.children[i]!, node.visits)
    if (score > bestScore) {
      bestScore = score
      best = node.children[i]!
    }
  }
  return best
}

function expand(node: MCTSNode, simState: GameState): MCTSNode {
  const [r, c] = node.untriedMoves.pop()!
  if (r === -1 && c === -1) {
    pass(simState)
  } else {
    placeStone(simState, r, c)
  }
  const child: MCTSNode = {
    r, c,
    parent: node,
    children: [],
    visits: 0,
    wins: 0,
    untriedMoves: simState.gameOver ? [] : getLegalMoves(simState, simState.currentPlayer),
    playerJustMoved: simState.currentPlayer === BLACK ? WHITE : BLACK,
  }
  node.children.push(child)
  return child
}

function rollout(state: GameState): Cell | null {
  const sim = copyState(state)
  for (let i = 0; i < 500; i++) {
    if (sim.gameOver) break
    const moves = getLegalMoves(sim, sim.currentPlayer)
    if (moves.length === 0) {
      pass(sim)
      continue
    }
    const [r, c] = moves[Math.floor(Math.random() * moves.length)]!
    placeStone(sim, r, c)
    if (sim.consecutivePasses >= 2) sim.gameOver = true
  }
  const score = countScore(sim)
  if (score.blackScore > score.whiteScore) return BLACK
  if (score.whiteScore > score.blackScore) return WHITE
  return null
}

function backpropagate(node: MCTSNode, winner: Cell | null): void {
  while (node) {
    node.visits++
    if (winner !== null && node.playerJustMoved === winner) {
      node.wins++
    }
    node = node.parent!
  }
}

function bestChild(node: MCTSNode): MCTSNode {
  let best = node.children[0]!
  for (let i = 1; i < node.children.length; i++) {
    if (node.children[i]!.visits > best.visits) {
      best = node.children[i]!
    }
  }
  return best
}

function getMCTSBudget(size: number): { maxIterations: number; maxTimeMs: number } {
  if (size <= 9) return { maxIterations: 2000, maxTimeMs: 1500 }
  if (size <= 13) return { maxIterations: 800, maxTimeMs: 2500 }
  return { maxIterations: 200, maxTimeMs: 4000 }
}

export function createMCTSBot(budgetOverride?: { maxIterations: number; maxTimeMs: number }): Bot {
  return {
    name: "MCTS",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const moves = getLegalMoves(state, botColor)
      if (moves.length === 0) return null
      if (moves.length === 1) return { r: moves[0][0], c: moves[0][1] }

      const root: MCTSNode = {
        r: -2, c: -2,
        parent: null,
        children: [],
        visits: 0,
        wins: 0,
        untriedMoves: moves,
        playerJustMoved: botColor,
      }

      const budget = budgetOverride ?? getMCTSBudget(state.size)
      const startTime = performance.now()
      let iterations = 0

      while (iterations < budget.maxIterations) {
        const elapsed = performance.now() - startTime
        if (elapsed >= budget.maxTimeMs) break

        let node: MCTSNode = root
        const simState = copyState(state)

        // Selection — traverse tree until a leaf
        while (node.untriedMoves.length === 0 && node.children.length > 0 && !simState.gameOver) {
          node = selectChild(node)
          if (node.r === -1 && node.c === -1) {
            pass(simState)
          } else {
            placeStone(simState, node.r, node.c)
          }
        }

        // Expansion — add one child if there are untried moves
        if (node.untriedMoves.length > 0 && !simState.gameOver) {
          node = expand(node, simState)
        }

        // Simulation — random playout
        const winner = rollout(simState)

        // Backpropagation
        backpropagate(node, winner)
        iterations++
      }

      const best = bestChild(root)
      return { r: best.r, c: best.c }
    }
  }
}
