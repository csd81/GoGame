# Plan: Undo / Redo

## Context

The game now records every move via `GameState.moves: MoveRecord[]` (added for SGF). This makes undo/redo trivial — we can reconstruct any prior state by replaying moves from the beginning up to a given point.

## Current State

- `GameState.moves` already tracks `{ color, r, c }` for every placement and `{ color, r: null, c: null }` for passes
- `createInitialState(size)` produces a blank board
- `copyState(state)` deep-clones the game state
- No undo/redo mechanism exists

## Design

### 1. undoPointer Approach

Add a single new field to GameState:

```typescript
export interface GameState {
  // ... existing fields ...
  undoPointer: number  // index into moves[] — how many moves have been applied
}
```

`moves` is append-only and never truncated. `undoPointer` tells us which prefix of `moves` is "live" — moves beyond it are in the redo buffer.

- After a new move: `undoPointer` = `moves.length` (normal state)
- User undoes: `undoPointer--` → replay `moves[0..undoPointer]` from scratch
- User redoes: `undoPointer++` → replay `moves[0..undoPointer]` from scratch
- User makes a NEW move while undoPointer < moves.length: truncate `moves` at `undoPointer`, then append the new move

### 2. Functions to Add

#### engine.ts

```typescript
export function replayMoves(state: GameState, targetPointer: number): void
```
Resets the board to initial state, then replays `moves[0..targetPointer]`. Updates `undoPointer`, `currentPlayer`, `captures`, `consecutivePasses`, `gameOver`, `moveCount`, `lastMove`, `board`, `history`.

```typescript
export function undo(state: GameState): boolean
```
If `undoPointer > 0`, decrements `undoPointer` and calls `replayMoves`. Returns false if nothing to undo.

```typescript
export function redo(state: GameState): boolean
```
If `undoPointer < moves.length`, increments `undoPointer` and calls `replayMoves`. Returns false if nothing to redo.

```typescript
// Modified — truncate redo buffer on new move
export function placeStone(state: GameState, r: number, c: number): boolean
```
Before appending to `moves`: if `undoPointer < moves.length`, truncate `moves` to `undoPointer`. Then proceed as before.

```typescript
// Modified — truncate redo buffer on pass
export function pass(state: GameState): void
```
Same truncation logic before appending.

#### createInitialState

Initialize `undoPointer: 0`.

#### copyState

Copy `undoPointer`.

### 3. replayMoves Algorithm

```
function replayMoves(state, targetPointer):
  // Save the full moves list (don't mutate it)
  const fullMoves = [...state.moves]

  // Reset board and all state to initial
  state.board = createBoard(state.size)
  state.captures = { [BLACK]: 0, [WHITE]: 0 }
  state.history = [boardKey(state.board)]
  state.currentPlayer = BLACK
  state.consecutivePasses = 0
  state.gameOver = false
  state.moveCount = 0
  state.lastMove = null
  state.moves = []        // temporarily empty for replay

  for i = 0; i < targetPointer; i++:
    const m = fullMoves[i]
    if m.r === null → pass(state)
    else → placeStone(state, m.r, m.c)
    // If gameOver triggered during replay, stop

  // Restore the full moves list
  state.moves = fullMoves
  state.undoPointer = targetPointer
```

Key: during replay, `placeStone` and `pass` must NOT modify `moves` or `undoPointer` (they would append to the list and break things). The simplest approach: check `undoPointer` — if it tracks the same as `moves.length`, we're in "append" mode; otherwise we're in "replay" mode and should skip move recording.

**Alternative (cleaner)**: Have `replayMoves` set a flag or use `moves.length === undoPointer` test. Since `replayMoves` temporarily sets `moves = []`, `placeStone` and `pass` will append to that empty list (harmless), and then we restore `fullMoves` at the end. This actually works fine — no special-casing needed in `placeStone`/`pass`.

Let me reconsider. In `replayMoves`:
1. Save `fullMoves`
2. Set `state.moves = []`
3. Replay
4. Restore `state.moves = fullMoves`
5. Set `state.undoPointer = targetPointer`

During step 3, `placeStone` appends to the temp `moves` array and sets `undoPointer` to whatever — but we overwrite both in step 4-5. Clean and safe.

### 4. CLI Integration

Add two commands to `script.ts`:

| Command | Action |
|---|---|
| `undo` or `u` | Undo last move. If bot game, undo both human + bot move. |
| `redo` or `r` | Redo last undone move. |

Bot game undo: undo 2 moves (human's + bot's response) so the human gets back control at their turn. Show message: `[UNDO] Undid last move + bot response.`

### 5. Web UI Integration

- Add "Undo" and "Redo" buttons in the side panel
- Keyboard shortcuts: `Ctrl+Z` = undo, `Ctrl+Y` or `Ctrl+Shift+Z` = redo
- Bot game: undo 2 moves at a time
- Disable buttons visually when nothing to undo/redo

### 6. File Changes

| File | Change |
|---|---|
| `src/engine.ts` | Add `undoPointer` to `GameState`, `replayMoves()`, `undo()`, `redo()`; init + copy |
| `src/script.ts` | Add `undo`/`redo` commands; bot game undoes 2 moves |
| `src/render.ts` | Update help text |
| `src/web/app.ts` | Add undo/redo buttons + Ctrl+Z/Y keybindings; bot game undoes 2 moves |
| `src/__tests__/unit/engine.test.ts` | Add undo/redo unit tests |
| `src/__tests__/unit/sgf.test.ts` | Add 1 test: undoPointer in copyState for SGF round-trip |
| `src/__tests__/integration/cross-module.test.ts` | Add 1 undo+redo integration test |

### 7. Test Plan

| Test | What it verifies |
|---|---|
| `undo after 1 move restores empty board` | Board is empty, turn is Black |
| `undo after 2 moves restores 1-move state` | Board has only first stone |
| `undo when no moves returns false` | No crash, returns false |
| `redo after undo restores state` | Redo returns to pre-undo state |
| `redo when nothing undone returns false` | No crash, returns false |
| `new move after undo truncates redo buffer` | Redo list cleared on new move |
| `undoPointer in copyState is correct` | Round-trip through SGF preserves undoPointer |
| `two undos then two redos restores original` | Full round-trip |
| `undo on empty board does nothing` | Returns false, state unchanged |
| `pass then undo restores pre-pass state` | Current player correct, stone still there |
| `undo performance on 200-move game` | Completes in <100ms |

### 8. Build Order

1. Add `undoPointer` to `GameState` in `engine.ts`
2. Implement `replayMoves()` helper
3. Implement `undo()` and `redo()`
4. Modify `placeStone()` and `pass()` for redo truncation
5. Update `createInitialState()` and `copyState()`
6. Unit tests for undo/redo
7. CLI commands
8. Web UI buttons + keybindings
9. Run full test suite

### 9. Bot Game Undo Behavior

When playing against AI, one "turn" is human move + bot response. Undoing should undo both so the human can try a different move. CLI flow:

```
> undo
  [UNDO] Undid last move + bot response.
```

This is a policy choice. The engine's `undo()` only undoes one move at a time — the script/web layer is responsible for calling it twice when appropriate.
