/**
 * Ancient Go - AI Bots
 *
 * Bot interface and implementations for computer opponents.
 * Each bot implements selectMove(state) which returns a coordinate or null (pass).
 * Pure functions - no side effects beyond Math.random().
 */
import type { GameState, Cell, MoveResult } from './script.ts';

const EMPTY = 0 as const;
const BLACK = 1 as const;
const WHITE = 2 as const;

// ──────────────────────────────────────────────
// Bot Interface
// ──────────────────────────────────────────────

export interface Bot {
  name: string;
  selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null;
}

// ──────────────────────────────────────────────
// Level 1 - Random Bot
// ──────────────────────────────────────────────

export function createRandomBot(): Bot {
  return {
    name: "Random",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const { size, board } = state;

      // Collect all empty intersections
      const empty: [number, number][] = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === EMPTY) {
            empty.push([r, c]);
          }
        }
      }

      if (empty.length === 0) return null; // pass

      // Start from a random offset and wrap around
      const start = Math.floor(Math.random() * empty.length);
      for (let i = 0; i < empty.length; i++) {
        const idx = (start + i) % empty.length;
        const [r, c] = empty[idx]!;
        // Validate the move by checking if it's legal
        const result = isValidMoveExternal(state, r, c, botColor);
        if (result.valid) {
          return { r, c };
        }
      }

      return null; // pass - no valid moves
    }
  };
}

// ──────────────────────────────────────────────
// Level 2 - Greedy / Atari Bot
// ──────────────────────────────────────────────

export function createGreedyBot(): Bot {
  return {
    name: "Greedy",
    selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null {
      const { size, board } = state;
      const opponent: Cell = botColor === BLACK ? WHITE : BLACK;

      // Priority 1: Capture - find enemy groups with 1 liberty and capture them
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === opponent) {
            const group = findGroupExternal(board, r, c);
            if (countLibertiesExternal(board, group) === 1) {
              // Find the liberty point
              for (const [gr, gc] of group) {
                for (const [nr, nc] of getNeighborsExternal(gr, gc, size)) {
                  if (board[nr][nc] === EMPTY) {
                    const result = isValidMoveExternal(state, nr, nc, botColor);
                    if (result.valid) return { r: nr, c: nc };
                  }
                }
              }
            }
          }
        }
      }

      // Priority 2: Atari defense - find own groups with 1 liberty and extend
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === botColor) {
            const group = findGroupExternal(board, r, c);
            if (countLibertiesExternal(board, group) === 1) {
              for (const [gr, gc] of group) {
                for (const [nr, nc] of getNeighborsExternal(gr, gc, size)) {
                  if (board[nr][nc] === EMPTY) {
                    const result = isValidMoveExternal(state, nr, nc, botColor);
                    if (result.valid) return { r: nr, c: nc };
                  }
                }
              }
            }
          }
        }
      }

      // Priority 3: Center-biased random move
      // Prefer moves closer to center, with a random factor
      const center = (size - 1) / 2;
      const empty: Array<{ r: number; c: number; score: number }> = [];

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === EMPTY) {
            const result = isValidMoveExternal(state, r, c, botColor);
            if (result.valid) {
              // Score by distance from center (lower is better)
              const dist = Math.abs(r - center) + Math.abs(c - center);
              const noise = Math.random() * 3; // add randomness
              empty.push({ r, c, score: dist + noise });
            }
          }
        }
      }

      if (empty.length === 0) return null;

      // Sort by score (closest to center + random)
      empty.sort((a, b) => a.score - b.score);
      return { r: empty[0]!.r, c: empty[0]!.c };
    }
  };
}

// ──────────────────────────────────────────────
// External references (imported from script.ts)
// These will be set during initialization
// ──────────────────────────────────────────────

let getNeighborsExternal: (r: number, c: number, size: number) => [number, number][];
let findGroupExternal: (board: any[][], r: number, c: number) => [number, number][];
let countLibertiesExternal: (board: any[][], group: [number, number][]) => number;
let isValidMoveExternal: (state: GameState, r: number, c: number, color: Cell) => MoveResult;

export function setBotDeps(
  getNeighbors: (r: number, c: number, size: number) => [number, number][],
  findGroup: (board: any[][], r: number, c: number) => [number, number][],
  countLiberties: (board: any[][], group: [number, number][]) => number,
  isValidMove: (state: GameState, r: number, c: number, color: Cell) => MoveResult,
): void {
  getNeighborsExternal = getNeighbors;
  findGroupExternal = findGroup;
  countLibertiesExternal = countLiberties;
  isValidMoveExternal = isValidMove;
}
