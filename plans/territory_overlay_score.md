# Territory Overlay / Live Score Estimation

## Context

The Go engine already computes territory via flood-fill scoring (`countScore()` in `engine.ts:300`), but it only returns aggregate scores (`{ blackScore, whiteScore }`). During a live game the user has no idea who's winning — they must mentally count territory. Every Go app (OGS, Sabaki, Lizzie) shows a live score estimate. Adding per-cell territory data and rendering it as translucent overlays on the web board gives players immediate visual feedback on the state of the game.

## Scope

- **Web UI**: territory overlays on the board + live score line in status
- **CLI**: live score line in `renderStatus()` (no ASCII territory map — too noisy)
- **Engine**: expose per-cell territory ownership

## Changes

### 1. Engine — `src/engine.ts`

Add a new export:

```typescript
/** Returns a 2D map of territory ownership: EMPTY for neutral, BLACK/WHITE for owned, or Cell for stone cells */
export function computeTerritoryMap(state: GameState): Cell[][]
```

This extracts the flood-fill logic from `countScore()` (lines 300–335) so the per-cell territory data is available. `countScore()` is refactored to call `computeTerritoryMap()` internally (no behavior change, just dedup).

Returns a `size x size` array where each cell is:
- `BLACK` / `WHITE` — that player's territory (empty cell only)
- `EMPTY` — neutral contested empty cell, or a stone cell (stones are not territory)

No new fields on `GameState` — this is a pure computed function.

### 2. Web UI — `src/web/app.ts`

**a) Territory overlay rendering** — add `renderTerritory()`:

After `renderStones()` in the main `render()` pipeline, call `computeTerritoryMap(S.game)`. For each cell owned by a player, add a colored overlay `div` to the intersection cell. Remove territory divs before re-rendering (same pattern as stone removal in `renderStones()`).

Overlay CSS classes: `.territory-black` (faint blue/black tint) and `.territory-white` (faint warm/white tint).

**b) Score line in status** — add to `renderStatus()`:

Format (after captures line):
```
Score: ● 32.5 | ○ 28.0 (B+4.5)
```
- Call `countScore(S.game)` to get scores
- Compute diff: `B+3.5`, `W+2.0`, or omit if equal
- Show regardless of game-over state (it's an estimate)

### 3. Web UI — `src/web/style.css`

Add territory overlay styles:

```css
.territory-black {
  background: rgba(40, 40, 180, 0.12);  /* faint blue tint */
}
.territory-white {
  background: rgba(200, 200, 200, 0.15);  /* faint warm tint */
}
```

Overlays sit below stones (z-index: 1) and above grid lines. The `.intersection` cell already uses `position: relative`, so a positioned child div works. Overlay opacity is kept low so board lines and stones remain clearly visible.

### 4. CLI — `src/render.ts`

Update `renderStatus()` to append the score line (same format as web, adapted for ANSI/ASCII):

```
Score: ● 32.5 | ○ 28.0 (B+4.5)
```

Use `countScore()` — already imported at line 1. Append with `C.dim` for muted appearance.

### 5. Tests — `src/__tests__/unit/engine.test.ts`

Add 3–4 tests for `computeTerritoryMap()`:
- **Empty board** — all cells are EMPTY
- **One stone** — adjacent territory ownership
- **Neutral territory** — region bordered by both colors stays EMPTY
- **Full capture** — territory correctly assigned after capture

## Files Modified

| File | Change |
|---|---|
| `src/engine.ts` | Add `computeTerritoryMap()`, refactor `countScore()` to use it |
| `src/web/app.ts` | Add `renderTerritory()`, extend `renderStatus()` with score line, call in `render()` |
| `src/web/style.css` | Add `.territory-black` / `.territory-white` styles |
| `src/render.ts` | Add score line to `renderStatus()` |
| `src/__tests__/unit/engine.test.ts` | Add territory map tests |

## Build Order

1. Extract `computeTerritoryMap()` in `engine.ts`, refactor `countScore()` to use it
2. Write unit tests for `computeTerritoryMap()`
3. Add territory overlay rendering in `app.ts` (`renderTerritory()`)
4. Add score line to web `renderStatus()`
5. Add score line to CLI `renderStatus()`
6. Add CSS styles for territory overlays
7. Run full test suite, verify web UI renders correctly

## Verification

1. `bun test` — all existing tests pass, new territory tests pass
2. `bun run build:web` — compiles without errors
3. Open web UI, play a few moves — territory overlays appear after each move
4. Play through a capture — territory updates correctly around captured area
5. Click pass twice — territory overlay still visible in game-over state, score line matches dialog
6. CLI: `bun start` — play a few moves, `score: B+...` appears in the status line
