# Ancient Go - AI Opponent Plan

This document outlines the design and build order for adding a computer opponent to the CLI game.

## 1. Difficulty Levels

We will implement **three levels** of AI difficulty:

| Level | Name | Strategy | Est. Strength |
|---|---|---|---|
| 1 | Random | Picks a random legal intersection | Complete beginner |
| 2 | Greedy | Captures largest enemy group if possible, else plays atari | 20kyu |
| 3 | Heuristic | Territory + influence heuristic with minimax lookahead (1-2 ply) | 15-10kyu |

## 2. Architecture

### Bot Interface
A common interface that all AI levels implement:

```typescript
interface Bot {
  name: string;
  selectMove(state: GameState): { r: number; c: number } | null; // null = pass
}
```

### How it plugs into the game loop
- On the human's turn: read input as normal
- On the bot's turn: call `bot.selectMove(state)`, then automatically `placeStone`
- If it's the bot's turn again after a move, chain immediately (no input pause)

### Separation from game engine
The Bot interface takes a GameState (read-only, via a deep copy) and returns a coordinate.
It can be reused as-is in Phase 2 (Web UI) — just call the same function on bot turn.

## 3. Level 1 - Random Bot

Algorithm:
1. Collect all empty intersections on the board
2. Start from a random offset and wrap around (avoids O(n) shuffle)
3. For each, call `isValidMove(state, r, c)`
4. Return the first valid move found
5. If none found, pass

## 4. Level 2 - Greedy / Atari Bot

Priority-ordered strategy (evaluate in order, pick first that works):

1. **Capture**: Find enemy groups with exactly 1 liberty. Play on that liberty.
2. **Atari**: Find own groups with exactly 1 liberty. Add a stone to extend.
3. **Cut / connect**: Play adjacent to the most recent human move.
4. **Center bias**: Prefer moves near the center (influence).
5. **Fallback**: Random valid move.

For steps 1 and 2, the bot scans all stones on the board, finds groups, and checks
liberties. Uses existing `findGroup()` and `countLiberties()` functions.

## 5. Level 3 - Heuristic Bot (stretch goal)

Scoring heuristic for any board position:

- **Territory potential**: Flood-fill empty regions, weigh by surrounding stones
- **Influence map**: For each stone, spread influence decaying with distance
- **Capture value**: +5 per enemy stone that would be captured
- **Connection value**: +3 per friendly stone adjacent
- **Edge avoidance**: -1 for first line, -0.5 for second line (except openings)
- **Star point bonus**: +2 for playing on a star point early game

Use a 1-ply search: evaluate all legal moves, pick the highest-scoring one.
Optional 2-ply: for the top 5 candidate moves, simulate opponent's best response.

## 6. Build Order

1. **Bot interface & Random bot** - Bot interface + full random implementation
2. **CLI integration** - New game flow with AI prompts, game loop changes
3. **Greedy bot** - Capture/atari detection, center bias
4. **Test and iterate** - Play games, fix bugs
5. **Heuristic bot** - (stretch) territory influence evaluation

## 7. CLI Integration Details

### New game flow:
```
Board size? (9/13/19) [19]: 9
Play against AI? (y/n): y
Choose difficulty (1=Random, 2=Greedy) [2]: 2
Choose your color (B/black or W/white) [B]: B
```

### Bot thinking indicator:
When it's the bot's turn, show a brief message:
```
  [AI] Thinking...
```

### Commands update:
- Existing commands (pass, resign, help, quit) still work on human turns
- No new CLI commands needed

## 8. File Structure

All bot code goes into a new file:

```
script.ts      existing game engine (unchanged core)
bots.ts        new: Bot interface + all bot implementations
```

`script.ts` imports from `bots.ts` and uses the Bot interface.

## 9. Testing Strategy

- Run the random bot against itself to verify no crashes over many games
- Test capture scenarios with the greedy bot:
  - Place a stone with 1 liberty -> greedy bot should capture
  - Place an own group with 1 liberty -> greedy bot should atari-extend
- Verify bots never make illegal moves (validated via `isValidMove`)
- Test two consecutive passes -> game ends correctly
