# Better CLI Display Plan

## Overview
Upgrade the ASCII terminal UI from plain `B`/`W`/`.`/`+` to a rich visual display with Unicode stones, ANSI colors, last-move markers, and an improved status line. All changes stay in `src/render.ts` and `src/engine.ts`.

## Current State
- `renderBoard()` prints `B` for black, `W` for white, `.` for empty, `+` for star points
- `renderStatus()` shows turn, captures, passes -- plain text
- No color, no last-move indicator, no visual flair

## 1. Visual Improvements

### 1a. Unicode Stones
Replace B/W with proper stone characters:

| Current | New | Description |
|---|---|---|
| B | filled circle U+25CF | Black stone |
| W | empty circle U+25CB | White stone |
| . | middle dot U+00B7 | Empty intersection |
| + | star U+2727 or cross | Star point |

On terminals without Unicode (Windows cmd.exe), fall back to ASCII B/W/./+.

### 1b. ANSI Color Support

| Element | Color | ANSI Code |
|---|---|---|
| Black stones | White on dark gray bg | ESC[97;40m |
| White stones | Black on light bg | ESC[30;47m |
| Star points | Dim yellow | ESC[33;2m |
| Empty intersections | Dim gray | ESC[90m |
| Column headers | Cyan | ESC[36m |
| Row numbers | Cyan | ESC[36m |
| Last move marker | Red underline | ESC[31;4m |
| Status separator | Dim | ESC[2m |
| Reset | -- | ESC[0m |

Auto-detect: check process.stdout.isTTY and platform. Support NO_COLOR env var.

### 1c. Last-Move Marker
- Track `lastMove: { r: number; c: number } | null` in GameState
- When rendering, highlight the last-placed stone with brackets: `[B]` or `[W]` (or `[●]`/`[○]` in unicode mode)
- In color mode, add red underline to the last move
- In non-color mode, use square brackets around the stone

### 1d. Status Line Improvements

Current: `Turn: B Black  |  Captures - Black: 0 White: 0`

Target: `Turn 17 -- B Black  |  Captures B 3 W 1  |  Passes 1/2  |  Last: D4`

Additional info to add:
- **Move number** (count of stones placed + passes)
- **Live score estimate** (using countScore mid-game)
- **Last move** coordinate display

## 2. Implementation Details

### 2a. GameState Changes (engine.ts)
Add to the GameState interface:
```
export interface GameState {
  // ... existing fields ...
  moveCount: number
  lastMove: { r: number; c: number } | null
}
```

Updates needed:
- `createInitialState()`: initialize `moveCount: 0, lastMove: null`
- `placeStone()`: increment `moveCount`, set `lastMove = { r, c }`
- `pass()`: increment `moveCount`, set `lastMove = null`

### 2b. Color/Unicode Detection (render.ts)
```
export function hasColorSupport(): boolean {
  if (process.env.NO_COLOR) return false
  if (!process.stdout.isTTY) return false
  return true
}

export function hasUnicodeSupport(): boolean {
  if (process.platform === "win32" && !process.env.WT_SESSION) return false
  return true
}
```

These functions are auto-called by renderBoard/renderStatus but can be overridden with optional parameters in tests.

### 2c. renderBoard Changes
- Accept optional `opts: { color?: boolean; unicode?: boolean }` parameter (auto-detected if omitted)
- Replace B/W with unicode equivalents when unicode=true
- Add ANSI codes when color=true
- Highlight last move with brackets/color
- Star points render as `+` in ASCII mode, unicode char in unicode mode

### 2d. renderStatus Changes
- Prepend move number: `Turn 17 -- ...`
- Use unicode stone symbols in status line when available
- Show last move coordinate: `Last: D4` or `Last: pass` if last move was a pass
- Show live score estimate

## 3. File Changes

| File | Change |
|---|---|
| `src/engine.ts` | Add `lastMove`, `moveCount` to GameState; update placeStone(), pass(), createInitialState() |
| `src/render.ts` | Add hasColorSupport(), hasUnicodeSupport(); update renderBoard() signature and body; update renderStatus() |
| `src/__tests__/unit/render.test.ts` | Update 5-8 existing tests, add 3-5 new tests for new features |
| `src/__tests__/adversarial/edge-cases.test.ts` | Add 1-2 tests for fallback behavior |

## 4. Build Order

1. **engine.ts updates** -- Add lastMove, moveCount; update placeStone(), pass(), createInitialState()
2. **Auto-detection helpers** -- hasColorSupport(), hasUnicodeSupport() in render.ts
3. **renderBoard with unicode+color** -- Rewrite renderBoard to handle all rendering modes
4. **renderStatus improvements** -- Add move count, last move, live score
5. **Tests** -- Update render.test.ts to cover new features
6. **Edge case tests** -- Add fallback tests
7. **Run all tests** -- Verify everything passes (target 95+)

## 5. Test Plan

### Updated tests in render.test.ts (5-8 new/updated)
- renderBoard with unicode fallback (no TTY) still produces clean ASCII output
- renderBoard with explicit opts={unicode:true} shows unicode chars
- renderBoard with last move shows bracket marker around stone
- renderStatus includes move count
- renderStatus includes last move coordinate after placeStone
- renderStatus shows "Last: pass" after a pass
- hasColorSupport() returns false when NO_COLOR set
- hasUnicodeSupport() returns value based on platform detection

### Edge case tests (edge-cases.test.ts, 1-2 new)
- renderBoard at game over with last move still works
- Fallback mode (no TTY) produces clean ASCII output with no ANSI codes

## 6. Before / After

### Before (current 19x19):
```
      A  B  C  D  E  F  G  H  I  J  K  L  M  N  O  P  Q  R  S

 19   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  19
 ...
Turn: B Black  |  Captures - Black: 0 White: 0
```

### After (no color, no unicode):
```
   A B C D E F G H I J K L M N O P Q R S

19  . . . . . . . . . . . . . . . . . . .  19
 ...
Turn 37 - B Black  |  Captures B 3 W 1  |  Last: K10
```

### After (full color + unicode mode):
Same layout, but with actual unicode stone chars and terminal colors.
