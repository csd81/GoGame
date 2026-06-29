# Ancient Go - Project Scaffolding Plan

This document outlines the architecture, data structures, and UI layout for building a modern implementation of the ancient game of Go (Baduk/Weiqi).

The project is built in **two phases**:
1. **Phase 1 — CLI / ASCII Board** (terminal-based): Implement core game logic, board rendering as text in the console, and move input via coordinates. This allows fast iteration on the hardest part (rules engine).
2. **Phase 2 — Web UI** (HTML/CSS/JS): Layer a rich visual interface on top of the same game logic engine.

## 1. Tech Stack & Project Structure
For maximum performance and styling flexibility without unnecessary overhead, the project will use **Vanilla HTML, CSS, and JavaScript**.

### Phase 1 — CLI / ASCII (terminal)
**File Structure:**
- `script.js`: Entire game engine + CLI interface. Renders board as text, reads moves from stdin (e.g. `A3`, `K10`).

### Phase 2 — Web UI (browser)
**File Structure:**
- `index.html`: The main markup structure and UI layout.
- `style.css`: All aesthetic rules (wood textures, 3D stones, layout grids).
- `script.js`: Game logic reused from Phase 1, with DOM event bindings replacing stdin.

## 1b. Phase 1 Build Order (CLI / ASCII Board)

1. **Constants & State Setup** — `boardSize`, `board[][]`, `currentPlayer`, `captures[]`, `history[]`.
2. **Board Rendering (ASCII)** — Function that prints an N×N grid with letters/numbers. Empty intersections show `+`, Black shows `●`/`X`, White shows `○`/`O`. Edge labels for coordinates.
3. **Adjacency & Group Finding** — `getNeighbors(r,c)` and `findGroup(r,c)` using flood fill.
4. **Liberty Counting** — `countLiberties(group)`.
5. **Capture Logic** — After placing a stone, check adjacent enemy groups; remove any with 0 liberties.
6. **Move Validation** — Suicide rule (own group can't have 0 liberties after captures) and Ko rule (new board != state from 2 turns ago).
7. **Move Loop** — Read input like `A3`, `pass`, `resign`. Re-render board after each move.
8. **Pass & Resign** — Two consecutive passes end the game. Resignation ends immediately.
9. **Scoring** — Simple territory counting (optional for first iteration).

## 2. UI Layout Architecture (HTML/CSS — Phase 2)
The app will use a modern, dark-themed wrapper with a visually striking, warm wooden board.

### Main Sections
1. **Header**: Title and subtitle.
2. **Left Panel (Controls & Status)**:
   - **Turn Indicator**: Visual display showing if it is Black or White's turn.
   - **Controls**: Dropdown for board size (9x9, 13x13, 19x19), and buttons for "Pass", "Resign", and "New Game".
   - **Captures Box**: Live tally of stones captured by each player.
3. **Right Panel (The Board)**:
   - A container with a realistic wooden background and 3D shadow effects.
   - The interactive board grid.

## 3. Board Rendering Strategy (The Tricky Part)
In Go, stones are placed on **intersections**, not inside squares (like Chess). To achieve this elegantly in HTML/CSS:

- We will generate an $N \times N$ grid of `div` elements (e.g., $19 \times 19$).
- Each `div` represents a clickable **intersection**.
- **Grid Lines**: Instead of an image, we will use CSS `::before` and `::after` pseudo-elements on each intersection to draw the horizontal and vertical lines.
- **Edge Cases**: We will apply specific CSS classes (`.edge-top`, `.edge-left`, etc.) to the outer intersections so their lines don't bleed off the board.
- **Stones**: When placed, a `.stone` div will be injected into the intersection div, absolutely positioned with a 3D drop shadow and radial gradient to look realistic.

## 4. Game State & Data Structures (JavaScript)
The state needs to track the board, history, and turn data.

```javascript
// 1. Constants
const EMPTY = 0, BLACK = 1, WHITE = 2;

// 2. Global State
let boardSize = 19;
let board = []; // 2D array [row][col] storing 0, 1, or 2
let currentPlayer = BLACK;
let captures = { [BLACK]: 0, [WHITE]: 0 };
let history = []; // Array of past board states for the Ko rule
```

## 5. Core Logic Systems to Implement
To make the game fully functional, we will need to implement the following logical modules:

1. **Adjacency Check**: A helper function to find the up/down/left/right neighbors of any coordinate.
2. **Group Finding (Flood Fill)**: An algorithm to find all connected stones of the same color (a "group").
3. **Liberty Counting**: A function that takes a group and counts how many adjacent empty intersections it has. If liberties === 0, the group is captured.
4. **Move Validation Sequence**:
   - Check if the intersection is empty.
   - Place the stone temporarily.
   - Check adjacent enemy groups. If any have 0 liberties, remove them and add to captures.
   - Check the placed stone's group. If it has 0 liberties (and no enemies were captured), the move is an invalid **Suicide** and is rejected.
   - Compare the new board state to `history[history.length - 2]` (the state before the previous turn). If they match, the move violates the **Ko Rule** and is rejected.
5. **Turn Management**: If a move is valid, commit it to `history`, swap the `currentPlayer`, and re-render the UI.
