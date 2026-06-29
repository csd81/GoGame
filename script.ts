/**
 * Ancient Go - Game Engine + CLI Interface
 *
 * Phase 1: Terminal-based ASCII Go.
 * Core logic kept pure for reuse in Phase 2 (Web UI).
 */

// 1. Constants & Types

const EMPTY = 0 as const;
const BLACK = 1 as const;
const WHITE = 2 as const;

export type Cell = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Board = Cell[][];

export interface GameState {
  size: number;
  board: Board;
  currentPlayer: typeof BLACK | typeof WHITE;
  captures: { [BLACK]: number; [WHITE]: number };
  history: string[];
  consecutivePasses: number;
  gameOver: boolean;
}

function createBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(EMPTY));
}

function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

function boardKey(board: Board): string {
  return board.map(row => row.join('')).join('|');
}

export function getNeighbors(r: number, c: number, size: number): [number, number][] {
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const result: [number, number][] = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      result.push([nr, nc]);
    }
  }
  return result;
}

export function findGroup(board: Board, r: number, c: number): [number, number][] {
  const color = board[r][c];
  if (color === EMPTY) return [];
  const size = board.length;
  const visited = new Set<number>();
  const group: [number, number][] = [];
  const stack: [number, number][] = [[r, c]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    const key = cr * size + cc;
    if (visited.has(key)) continue;
    visited.add(key);
    group.push([cr, cc]);
    for (const [nr, nc] of getNeighbors(cr, cc, size)) {
      if (!visited.has(nr * size + nc) && board[nr][nc] === color) {
        stack.push([nr, nc]);
      }
    }
  }
  return group;
}

export function countLiberties(board: Board, group: [number, number][]): number {
  const size = board.length;
  const liberties = new Set<number>();
  for (const [r, c] of group) {
    for (const [nr, nc] of getNeighbors(r, c, size)) {
      if (board[nr][nc] === EMPTY) {
        liberties.add(nr * size + nc);
      }
    }
  }
  return liberties.size;
}

// 3. Move Logic

export interface MoveResult {
  valid: boolean;
  reason?: string;
  newBoard?: Board;
  captured?: number;
}

function tryPlaceStone(board: Board, r: number, c: number, color: Cell): MoveResult {
  const size = board.length;
  if (board[r][c] !== EMPTY) {
    return { valid: false, reason: "Intersection is not empty." };
  }
  const newBoard = cloneBoard(board);
  newBoard[r][c] = color;
  let totalCaptured = 0;
  const opponent: Cell = color === BLACK ? WHITE : BLACK;
  for (const [nr, nc] of getNeighbors(r, c, size)) {
    if (newBoard[nr][nc] === opponent) {
      const enemyGroup = findGroup(newBoard, nr, nc);
      if (countLiberties(newBoard, enemyGroup) === 0) {
        for (const [cr, cc] of enemyGroup) {
          newBoard[cr][cc] = EMPTY;
        }
        totalCaptured += enemyGroup.length;
      }
    }
  }
  const ownGroup = findGroup(newBoard, r, c);
  if (countLiberties(newBoard, ownGroup) === 0) {
    return { valid: false, reason: "Suicide is not allowed." };
  }
  return { valid: true, newBoard, captured: totalCaptured };
}

function isValidMove(state: GameState, r: number, c: number): MoveResult {
  if (state.gameOver) {
    return { valid: false, reason: "Game is over." };
  }
  const result = tryPlaceStone(state.board, r, c, state.currentPlayer);
  if (!result.valid || !result.newBoard) return result;
  const newKey = boardKey(result.newBoard);
  if (state.history.length >= 2 && newKey === state.history[state.history.length - 2]) {
    return { valid: false, reason: "Ko rule - cannot repeat previous position." };
  }
  return result;
}

/** Same as isValidMove but accepts an explicit color (used by bots). */
export function isValidMoveForColor(state: GameState, r: number, c: number, color: Cell): MoveResult {
  if (state.gameOver) {
    return { valid: false, reason: "Game is over." };
  }
  const result = tryPlaceStone(state.board, r, c, color);
  if (!result.valid || !result.newBoard) return result;
  const newKey = boardKey(result.newBoard);
  if (state.history.length >= 2 && newKey === state.history[state.history.length - 2]) {
    return { valid: false, reason: "Ko rule - cannot repeat previous position." };
  }
  return result;
}

function placeStone(state: GameState, r: number, c: number): boolean {
  const result = isValidMove(state, r, c);
  if (!result.valid || !result.newBoard) {
    console.log("  [X] " + result.reason);
    return false;
  }
  state.board = result.newBoard;
  state.history.push(boardKey(state.board));
  state.captures[state.currentPlayer] += result.captured!;
  state.consecutivePasses = 0;
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK;
  return true;
}

function pass(state: GameState): void {
  state.consecutivePasses++;
  state.history.push(boardKey(state.board));
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK;
  if (state.consecutivePasses >= 2) {
    state.gameOver = true;
    console.log("  [END] Two consecutive passes - game over!");
  } else {
    console.log("  [PASS] " + (state.currentPlayer === BLACK ? "Black" : "White") + " to play.");
  }
}

function resign(state: GameState): void {
  state.gameOver = true;
  const loser = state.currentPlayer === BLACK ? "Black" : "White";
  const winner = state.currentPlayer === BLACK ? "White" : "Black";
  console.log("  [RESIGN] " + loser + " resigns. " + winner + " wins!");
}

// 4. ASCII Rendering

function renderBoard(state: GameState): string {
  const { size, board } = state;
  const lines: string[] = [];
  const colWidth = size > 13 ? 3 : 2;
  let header = " ".repeat(colWidth + 1);
  for (let c = 0; c < size; c++) {
    const label = String.fromCharCode(65 + (c < 26 ? c : c - 26));
    header += label.padStart(colWidth);
  }
  lines.push(header);
  lines.push("");
  for (let r = 0; r < size; r++) {
    const rowNum = (size - r).toString().padStart(colWidth);
    let row = rowNum + " ";
    for (let c = 0; c < size; c++) {
      const cell = board[r][c];
      let char: string;
      if (cell === EMPTY) {
        char = isStarPoint(r, c, size) ? "+" : ".";
      } else if (cell === BLACK) {
        char = "B";
      } else {
        char = "W";
      }
      row += char.padStart(colWidth);
    }
    row += " " + rowNum;
    lines.push(row);
  }
  lines.push("");
  lines.push(header);
  return lines.join("\n");
}

function isStarPoint(r: number, c: number, size: number): boolean {
  if (size === 9) return ([2, 4, 6].includes(r) && [2, 4, 6].includes(c));
  if (size === 13) return ([3, 6, 9].includes(r) && [3, 6, 9].includes(c));
  if (size === 19) { const s = [3, 9, 15]; return s.includes(r) && s.includes(c); }
  return false;
}

function renderStatus(state: GameState): string {
  const turnName = state.currentPlayer === BLACK ? "Black" : "White";
  const turnSymbol = state.currentPlayer === BLACK ? "B" : "W";
  let s = "Turn: " + turnSymbol + " " + turnName;
  s += "  |  Captures - Black: " + state.captures[BLACK] + " White: " + state.captures[WHITE];
  if (state.consecutivePasses > 0) s += "  |  Passes: " + state.consecutivePasses + "/2";
  return s;
}

// 5. CLI Input Parsing

function parseCoord(input: string, size: number): [number, number] | null {
  const trimmed = input.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z])(\d+)$/);
  if (!match) return null;
  const col = match[1]!.charCodeAt(0) - 65;
  const rowNum = parseInt(match[2]!, 10);
  const row = size - rowNum;
  if (row < 0 || row >= size || col < 0 || col >= size) return null;
  return [row, col];
}

// 6. Main Game Loop

function showHelp(): void {
  console.log("Commands:");
  console.log("  <col><row>   Place a stone, e.g. A1, D4, K10");
  console.log("  pass         Pass your turn");
  console.log("  resign       Resign the game");
  console.log("  help         Show this help");
  console.log("  quit         Exit");
}

function createInitialState(size: number = 19): GameState {
  return {
    size,
    board: createBoard(size),
    currentPlayer: BLACK,
    captures: { [BLACK]: 0, [WHITE]: 0 },
    history: [],
    consecutivePasses: 0,
    gameOver: false,
  };
}

function printUI(state: GameState): void {
  console.log(renderBoard(state));
  console.log("");
  console.log(renderStatus(state));
  console.log("");
}

function countScore(state: GameState): { blackScore: number; whiteScore: number } {
  const { board, size, captures } = state;
  const territory = { [BLACK]: 0, [WHITE]: 0 };
  const visited = new Set<number>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY && !visited.has(r * size + c)) {
        const borders = new Set<Cell>();
        const stack: [number, number][] = [[r, c]];
        const regionVisited = new Set<number>();
        while (stack.length > 0) {
          const [cr, cc] = stack.pop()!;
          const key = cr * size + cc;
          if (regionVisited.has(key)) continue;
          regionVisited.add(key);
          visited.add(key);
          for (const [nr, nc] of getNeighbors(cr, cc, size)) {
            if (board[nr][nc] === EMPTY) {
              if (!regionVisited.has(nr * size + nc)) stack.push([nr, nc]);
            } else {
              borders.add(board[nr][nc]);
            }
          }
        }
        if (borders.size === 1) {
          const owner = [...borders][0]!;
          territory[owner] += regionVisited.size;
        }
      }
    }
  }
  return {
    blackScore: territory[BLACK] + captures[BLACK],
    whiteScore: territory[WHITE] + captures[WHITE] + 6.5,
  };
}

function showResult(state: GameState): void {
  const { blackScore, whiteScore } = countScore(state);
  console.log("");
  console.log("Final Score - Black: " + blackScore + ", White: " + whiteScore);
  if (blackScore > whiteScore) console.log("Black wins!");
  else if (whiteScore > blackScore) console.log("White wins!");
  else console.log("Draw!");
}

// 7. Entry Point

import * as readline from "readline";
import { createRandomBot, createGreedyBot, setBotDeps } from "./bots.ts";
import type { Bot } from "./bots.ts";

// Wire up bot dependencies
setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor);

async function main(): Promise<void> {
  console.log("=== ANCIENT GO ===\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let state: GameState | null = null;
  let awaitingSize = true;
  let bot: Bot | null = null;
  let humanColor: typeof BLACK | typeof WHITE = BLACK;
  let botColor: typeof BLACK | typeof WHITE = WHITE;
  let awaitingAiSetup = false;
  let waitingForAiColor = false;
  let waitingForAiDifficulty = false;

  // Ask for board size first
  rl.question("Board size? (9/13/19) [19]: ", (answer) => {
    const n = parseInt(answer.trim(), 10);
    const size = [9, 13, 19].includes(n) ? n : 19;
    state = createInitialState(size);
    awaitingSize = false;
    // Ask if playing against AI
    awaitingAiSetup = true;
    rl.question("Play against AI? (y/n) [n]: ", (aiAnswer) => {
      const wantsAi = aiAnswer.trim().toLowerCase() === "y";
      if (!wantsAi) {
        showHelp();
        printUI(state);
        return;
      }
      // Ask difficulty
      awaitingAiDifficulty = true;
      rl.question("Choose difficulty (1=Random, 2=Greedy) [2]: ", (diffAnswer) => {
        const diff = diffAnswer.trim();
        if (diff === "1") {
          bot = createRandomBot();
        } else {
          bot = createGreedyBot();
        }
        awaitingAiDifficulty = false;
        // Ask color
        waitingForAiColor = true;
        rl.question("Your color? (B/black or W/white) [B]: ", (colorAnswer) => {
          const c = colorAnswer.trim().toLowerCase();
          if (c === "w" || c === "white") {
            humanColor = WHITE;
            botColor = BLACK;
          } else {
            humanColor = BLACK;
            botColor = WHITE;
          }
          waitingForAiColor = false;
          awaitingAiSetup = false;
          showHelp();
          printUI(state);
          // If bot goes first (human picked White), trigger bot move
          if (state && bot && state.currentPlayer === botColor) {
            triggerBotMove(state, bot, botColor, humanColor, rl);
          }
        });
      });
    });
  });

  function triggerBotMove(s: GameState, b: Bot, bColor: typeof BLACK | typeof WHITE, hColor: typeof BLACK | typeof WHITE, rli: readline.Interface): void {
    console.log("  [AI] Thinking...");
    const move = b.selectMove(s, bColor);
    if (move === null) {
      console.log("  [AI] passes.");
      pass(s);
      if (s.gameOver) { printUI(s); showResult(s); rli.close(); process.exit(0); }
      printUI(s);
      // If still bot's turn after pass (shouldn't normally happen in 2-player alternating), recurse
      if (!s.gameOver && s.currentPlayer === bColor) {
        setTimeout(() => triggerBotMove(s, b, bColor, hColor, rli), 100);
      }
      return;
    }
    const ok = placeStone(s, move.r, move.c);
    if (ok) {
      const rowLabel = s.size - move.r;
      const colLabel = String.fromCharCode(65 + move.c);
      console.log("  [AI] plays " + colLabel + rowLabel + ".");
    }
    printUI(s);
    if (s.gameOver) { showResult(s); rli.close(); process.exit(0); }
  }

  rl.on("line", (line: string) => {
    if (awaitingSize || awaitingAiSetup || awaitingAiDifficulty || waitingForAiColor) return;
    if (!state) return;

    const cmd = line.trim().toLowerCase();

    if (cmd === "quit" || cmd === "exit") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }
    if (cmd === "help") {
      showHelp();
      printUI(state);
      return;
    }
    if (cmd === "pass") {
      pass(state);
      if (state.gameOver) { printUI(state); showResult(state); rl.close(); process.exit(0); }
      printUI(state);
      // Bot's turn?
      if (bot && state.currentPlayer === botColor) {
        setTimeout(() => triggerBotMove(state, bot, botColor, humanColor, rl), 100);
      }
      return;
    }
    if (cmd === "resign") {
      if (bot) {
        console.log("  [RESIGN] Human resigns. AI wins!");
        showResult(state);
        rl.close();
        process.exit(0);
      } else {
        resign(state);
        showResult(state);
        rl.close();
        process.exit(0);
      }
      return;
    }

    // Only accept input on human's turn
    if (bot && state.currentPlayer !== humanColor) {
      console.log("  [X] It's the AI's turn. Wait...");
      printUI(state);
      return;
    }

    const coord = parseCoord(line, state.size);
    if (!coord) {
      console.log("  [X] Invalid: \"" + line + "\". Type help for commands.");
      printUI(state);
      return;
    }
    placeStone(state, coord[0], coord[1]);
    if (state.gameOver) { printUI(state); showResult(state); rl.close(); process.exit(0); }
    printUI(state);

    // Bot's turn?
    if (bot && state.currentPlayer === botColor) {
      setTimeout(() => triggerBotMove(state, bot, botColor, humanColor, rl), 100);
    }
  });
}

main().catch(console.error);
