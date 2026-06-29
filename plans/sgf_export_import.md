# Plan: SGF Export / Import

## Context

Go games are commonly saved in **Smart Game Format (.sgf)** — the universal interchange format used by Sabaki, Lizzie, OGS, AI Review, and every Go tool. Adding SGF support lets users save games, share them, review with external tools, and load past games back into the app.

## Current State

- The engine tracks a full `history: string[]` of board keys and `captures` — enough to reconstruct every move.
- No SGF serialization exists.
- Web UI has no file download or upload path.
- CLI has no file I/O commands.

## File Changes

| File | Change |
|---|---|
| `src/sgf.ts` | **New** — SGF serialize/deserialize functions |
| `src/engine.ts` | Add `moveCount` increment in `placeStone()` + expose `lastMove` & `moveCount` (done already) |
| `src/script.ts` | Add `export` / `import` CLI commands |
| `src/web/app.ts` | Add Download SGF button + file upload handler |
| `src/web/index.html` | No change needed (app.ts generates DOM) |
| `src/web/style.css` | Minimal: style for the export/import buttons |
| `src/__tests__/unit/sgf.test.ts` | **New** — 15+ unit tests |
| `src/__tests__/adversarial/edge-cases.test.ts` | Add 2-3 edge case tests |
| `src/__tests__/integration/cross-module.test.ts` | Add 1 SGF round-trip test |

## 1. SGF Format Primer

A minimal SGF file looks like this:

```
(;GM[1]FF[4]SZ[9]KM[6.5]PB[Player]PW[Bot]RE[B+3.5]
;B[ee];W[dd];B[ff];W[ce];B[ec]W[];B[ge])
```

Key rules:
- **Header**: `(;GM[1]FF[4]SZ[size]KM[komi]RE[result]PB[...]PW[...])`
- **Moves**: `B[colrow]` or `W[colrow]` — lowercase letters, `aa` = top-left, `ss` = bottom-right for 19x19
- **Pass**: `B[]` or `W[]` — empty brackets
- **Coordinate mapping**: column = `charCodeAt(c) - 97`, row = `charCodeAt(r) - 97` (our `board[r][c]` layout matches exactly: r=0 is top row, c=0 is left column)
- **No letter skipping**: SGF FF4 uses `a` through `s` for 19x19 (19 letters), does NOT skip `i`
- **Result**: `B+R` / `W+R` (resign), `B+{n}` / `W+{n}` (score), `0` (draw)

## 2. Export: GameState → SGF String

```
function exportSGF(state: GameState, meta?: SGFMeta): string
```

**Input**: The current `GameState` (which has `history`, `board`, `captures`, `moveCount`) + optional metadata (player names, date, etc.)

**Algorithm**:
1. Replay moves from the initial state using `history` to reconstruct the move sequence:
   - For each move in the game, store the coordinate or pass
   - The `history` array stores board keys. Compare consecutive board keys to determine what was played.
   - Alternative simpler approach: **record moves as they happen** (store `{r, c} | null` for each move) in a new `moves` array on GameState.
   
   **Recommended approach**: Add a `moves` array to GameState that records each move. This avoids expensive diffing of board keys and is unambiguous.

2. Build SGF string:
   - Start with header node: `(;GM[1]FF[4]SZ[size]KM[6.5]RE[...]PB[...]PW[...]`
   - For each recorded move: `B[ab]` or `W[ab]` where `ab` = column letter + row letter
   - Passes: `B[]` or `W[]`
   - Close: `)`

3. Compute result string for RE:
   - If game ended by resignation: `B+R` or `W+R`
   - If game ended by score: `B+{diff}` or `W+{diff}` e.g. `B+3.5`
   - If still in progress: omit RE or use empty

### Move Recording

Add to GameState in `engine.ts`:

```typescript
interface MoveRecord {
  color: typeof BLACK | typeof WHITE
  r: number | null  // null = pass
  c: number | null
}
```

Add `moves: MoveRecord[]` to `GameState`:
- `placeStone()`: push `{ color: currentPlayer, r, c }` before flipping turn
- `pass()`: push `{ color: currentPlayer, r: null, c: null }`
- `createInitialState()`: init as `[]`

### Coordinate Conversion

```typescript
function toSgfCoord(r: number, c: number): string {
  return String.fromCharCode(97 + c) + String.fromCharCode(97 + r)
}

function fromSgfCoord(s: string): [number, number] {
  return [s.charCodeAt(1) - 97, s.charCodeAt(0) - 97]  // [row, col]
}
```

## 3. Import: SGF String → GameState

```
function importSGF(sgf: string): GameState
```

**Algorithm**:
1. Parse the SGF using a basic tokenizer (no need for a full parser — Go SGFs are linear):
   - Split into property/value pairs: `KEY[value]`
   - Extract `SZ`, `KM`, `RE`, `PB`, `PW`, `HA` (handicap)
   - Extract move sequence: `B[...]` and `W[...]` preserving order
   
2. Build `GameState`:
   - Create initial state with parsed size
   - Apply `AB[..][..]` / `AW[..][..]` for handicap/setup stones
   - Replay each move from the parsed sequence

3. **Validation**: Skip moves that are illegal (invalid coord, occupied, suicide, ko) — return a partial state with a warning.

### Parser Notes

SGF can technically have branching (`(;...)(;...)`) but Go game SGFs are almost always linear. For v1, support linear SGF only and error on branches.

```typescript
function parseSGF(sgf: string): SGFGame {
  // Extract properties by regex: /(\w+)\[([^\]]*)\]/g
  // Collect in order, separate root properties from move sequence
}
```

## 4. SGFMeta Interface

```typescript
interface SGFMeta {
  playerBlack?: string
  playerWhite?: string
  date?: string      // YYYY-MM-DD
  eventName?: string
  komi?: number
  result?: string    // optional if game not over
}
```

## 5. CLI Integration (script.ts)

Add three new commands to the existing handler:

| Command | Action |
|---|---|
| `export [filename]` | Export game to `filename.sgf` (default: `game-{timestamp}.sgf`) |
| `import <filename>` | Load SGF file, replace current game state |
| `sgf` | Print raw SGF to stdout (useful for copy-paste) |

Example flow:
```
> export mygame
  [OK] Exported to mygame.sgf

> import mygame.sgf
  [OK] Loaded game from mygame.sgf (31 moves)
```

Implementation uses `Bun.write()` and `Bun.file()` for file I/O.

## 6. Web UI Integration (app.ts)

**Export:**
- Add "Download SGF" button in the side panel
- On click: generate SGF string → create a Blob → trigger download via temporary `<a>` element
- File name: `ancient-go-{timestamp}.sgf`

**Import:**
- Add "Import SGF" button that opens a file picker (`<input type="file" accept=".sgf">`)
- On file selected: read text → parse → rebuild game state → re-render board
- If parsing fails, show error toast/message

**Auto-save (stretch):**
- Store SGF to `localStorage` after every move
- On page load, prompt: "Restore last game?"

## 7. Test Plan

### Unit Tests (sgf.test.ts, ~15 tests)

| Test | What it verifies |
|---|---|
| `exportSGF with empty 9x9` | Produces valid header, no moves |
| `exportSGF with one move` | Correct `B[ee]` for center of 9x9 |
| `exportSGF with captures` | SGF has correct coordinates |
| `exportSGF with passes` | Contains `B[]` and `W[]` entries |
| `exportSGF with resign` | RE property shows `B+R` or `W+R` |
| `exportSGF with default meta` | Uses sensible defaults for PB/PW |
| `exportSGF with custom meta` | All metadata fields correct |
| `importSGF basic 9x9` | Round-trip: export → import → same board |
| `importSGF with 19x19` | Correct size and coordinates |
| `importSGF with handicap` | AB stones placed correctly |
| `importSGF with komi` | KM parsed and applied |
| `importSGF invalid SGF` | Returns null / throws descriptive error |
| `importSGF non-Go SGF` | Returns null (not GM[1]) |
| `importSGF with passes` | Consecutive pass count correct |
| `toSgfCoord` | `a` = row 0 col 0, `s` = row 18 col 18 |
| `fromSgfCoord` | Round-trip identity |

### Integration Tests

| Test | What it verifies |
|---|---|
| Play 30 moves, export, import → board matches | Full pipeline |
| Export after captures → coordinates correct | Capture tracking |

### Adversarial / Edge Cases

| Test | What it verifies |
|---|---|
| Very long game (300+ moves) | No stack overflow |
| SGF with backslash / special chars | Proper escaping |
| Import empty/whitespace string | Graceful failure |
| Import SGF with missing SZ | Default to 19 |

## 8. SGF Meta Property Reference (for implementation)

| Property | Meaning | Example |
|---|---|---|
| `GM` | Game type (1=Go) | `GM[1]` |
| `FF` | File format version | `FF[4]` |
| `SZ` | Board size | `SZ[19]` |
| `KM` | Komi | `KM[6.5]` |
| `HA` | Handicap stones | `HA[2]` |
| `RE` | Result | `RE[B+R]`, `RE[W+12.5]`, `RE[0]` |
| `PB` | Black player | `PB[Human]` |
| `PW` | White player | `PW[MCTS Bot]` |
| `DT` | Date | `DT[2026-06-29]` |
| `AB` | Add black stone (setup) | `AB[cd][ef]` |
| `AW` | Add white stone (setup) | `AW[gh]` |
| `B` | Black move | `B[ee]` or `B[]` for pass |
| `W` | White move | `W[dd]` or `W[]` for pass |
| `C` | Comment | `C[White captures 3 stones]` |

## 9. Build Order

1. **Add `moves` array to `GameState`** — record moves in `placeStone()` and `pass()`, init in `createInitialState()`, include in `copyState()`
2. **Create `src/sgf.ts`** — `exportSGF()`, `importSGF()`, `toSgfCoord()`, `fromSgfCoord()`
3. **Unit tests for coordinate conversion** — verify `toSgfCoord` ↔ `fromSgfCoord` round-trip
4. **Unit tests for export** — empty board, 1 move, captures, passes, resign, meta
5. **Unit tests for import** — basic 9x9, 19x19, handicap, passes, komi, invalid input
6. **CLI commands** — `export`, `import`, `sgf` in `script.ts`
7. **Web UI buttons** — Download SGF + Import SGF in `app.ts`
8. **Integration test** — full round-trip pipeline
9. **Edge case tests** — long games, special chars, missing properties
10. **Manual QA** — export a game, open in Sabaki / OGS upload; download from OGS, import

## 10. Future Enhancements (v2)

- SGF branching support (variations)
- Comments on moves (C property)
- Game tree navigation in Web UI (step forward/back)
- OGS API integration (upload/share directly)
- PGN-style annotation
