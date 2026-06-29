# Level 3 — Heuristic AI Bot Plan

## Overview

Add a **Heuristic Bot** (~15-10kyu strength) to the existing GoGame AI suite. It evaluates every legal move using an influence map and territory heuristic, then picks the highest-scoring one. Includes an optional 1-ply lookahead variant that simulates the opponent's best response.

## 1. Files to Modify

| File | Change |
|---|---|
| `src/bots.ts` | Add `createHeuristicBot()` with full heuristic engine + `createHeuristicBot2Ply()` variant |
| `src/script.ts` | Update difficulty prompt to `(1=Random, 2=Greedy, 3=Heuristic) [2]` |
| `plans/ai_opponent_plan.md` | Mark Level 3 as implemented |

## 2. Files to Create (Tests)

| File | Tests |
|---|---|
| `src/__tests__/unit/heuristic-bot.test.ts` | New test file (10+ tests) |
| `src/__tests__/adversarial/edge-cases.test.ts` | 3-4 new edge case tests |
| `src/__tests__/integration/cross-module.test.ts` | 1-2 new pipeline tests |

## 3. Heuristic Algorithm

### 3a. Influence Map

A `number[][]` the same size as the board. For each stone, spread influence radiating outward, decaying linearly with distance:

```
Influence(color, dist) = sign(color) * (radius - dist) / radius
where radius = 5 (configurable)
```

Positive values = good for black. Negative values = good for white. Sum all stones' contributions at each intersection.

```
function buildInfluenceMap(board, size): number[][]
  Initialize map[size][size] all 0
  radius = 5
  For each (r, c) on board:
    if board[r][c] == EMPTY: continue
    sign = board[r][c] == BLACK ? 1 : -1
    For each (nr, nc) within Chebyshev distance radius:
      dist = max(|nr-r|, |nc-c|)
      if dist == 0: continue
      map[nr][nc] += sign * (radius - dist) / radius
  return map
```

### 3b. Move Scoring

Each candidate legal move gets a total score from weighted components. The bot enumerates all legal moves, scores each, and picks the maximum.

| Component | Weight | Description |
|---|---|---|
| **Capture** | +25/stone | Enemy stones captured by this move |
| **Atari** | +15 | Puts enemy group at 1 liberty |
| **Defense** | +12 | Saves own group from 1 liberty |
| **Influence Δ** | +2 | Change in sum influence around move (±5 neighborhood) |
| **Connection** | +4/adj | Per friendly stone adjacent after move |
| **Territory** | +3/cell | New territory claimed (run flood-fill on result board) |
| **Edge penalty** | -4/-2 | -4 for first line, -2 for second line |
| **Star point** | +3 | If on star point and total stones < 20 per side |
| **Center bias** | +1 | Small bonus toward center for flexibility |

```
function scoreMove(state, r, c, color): number
  Simulate placing stone at (r, c) for color
  Determine captures and new board state
  score = 0
  score += 25 * (number of enemy stones captured)
  score += isAtari(newBoard, enemy groups) ? 15 : 0
  score += savesOwnAtari(board, newBoard, color) ? 12 : 0
  score += 2 * sumInfluenceDelta(board, newBoard, r, c, radius=5)
  score += 4 * countAdjacentFriendlies(newBoard, r, c, color)
  score += 3 * countNewTerritory(newBoard, r, c, color)
  score += edgePenalty(r, c, size)  // -4 or -2 or 0
  score += isStarPoint(r, c, size) && earlyGame ? 3 : 0
  score += 1 * centerBias(r, c, size)
  return score
```

### 3c. Position Evaluation (for lookahead)

A single number representing how good a board position is for a given color. Used to compare board states without enumerating moves.

```
function evaluatePosition(state, color): number
  influence = buildInfluenceMap(state.board, state.size)
  score = 0
  // Sum influence on all intersections
  for each (r, c): score += influence[r][c]
  // Territory estimate
  territory = countApproxTerritory(state.board, state.size)
  score += territory * 2 * (color == BLACK ? 1 : -1)
  // Captures
  score += state.captures[color] * 25
  score -= state.captures[opponent(color)] * 25
  return score
```

### 3d. 1-Ply Lookahead (optional variant)

```
function createHeuristicBot2Ply(): Bot
  selectMove(state, color):
    candidates = findAllLegalMoves(state, color)
    scored = []
    for each move in candidates:
      baseScore = scoreMove(state, move.r, move.c, color)
      // Simulate this move
      newState = deepClone(state)
      placeStone(newState, move.r, move.c)
      // Find opponent's best response
      opponentBest = evaluatePosition(newState, opponent(color))
      // Also find opponent's best actual move
      oppCandidates = findAllLegalMoves(newState, opponent(color))
      if oppCandidates.length > 0:
        oppBestReply = max over oppCandidates of scoreMove(newState, om.r, om.c, opponent(color))
        adjustedScore = baseScore - oppBestReply * 0.3
      else:
        adjustedScore = baseScore
      scored.push({ move, score: adjustedScore })
    return scored sorted by score descending[0].move
```

## 4. Bot Interface (unchanged)

```typescript
interface Bot {
  name: string;
  selectMove(state: GameState, botColor: typeof BLACK | typeof WHITE): { r: number; c: number } | null;
}
```

The heuristic bot implements the same interface, so no changes to script.ts's consumption pattern are needed — only the difficulty prompt.

## 5. CLI Integration

Update difficulty prompt in `src/script.ts`:

```
Choose difficulty (1=Random, 2=Greedy, 3=Heuristic) [3]:
```

The bot creation logic becomes:
```typescript
const diff = diffAnswer.trim()
if (diff === "1") bot = createRandomBot()
else if (diff === "2") bot = createGreedyBot()
else bot = createHeuristicBot()
```

Default changes from `[2]` to `[3]` since Heuristic is the premium option.

## 6. Build Order

1. **Influence map** — Implement `buildInfluenceMap()` helper in `bots.ts`
2. **Position evaluation** — Implement `evaluatePosition()` using influence + territory + captures
3. **Move scoring** — Implement `scoreMove()` with all heuristic components
4. **`createHeuristicBot()`** — Enumerate legal moves, score each, pick best
5. **`createHeuristicBot2Ply()`** — 1-ply lookahead variant
6. **CLI integration** — Update difficulty prompt in `script.ts`
7. **Unit tests** — `heuristic-bot.test.ts`: influence symmetry, center preference, capture priority, edge penalty
8. **Integration tests** — Cross-module with render pipeline
9. **Adversarial tests** — Large board performance, full board returns null
10. **Run all tests** — Verify nothing breaks (aim for 90+ passing)

## 7. Test Plan

### Unit tests (src/__tests__/unit/heuristic-bot.test.ts)
- Default name is "Heuristic"
- Empty 9x9 board → selects center area (non-edge, roughly center)
- Captures take priority over non-capturing moves
- Edge penalty: corner/edge cells score lower than center on empty board
- Star point bonus: star point selected on empty 9x9
- `createHeuristicBot2Ply` returns a Bot with different name
- 1-ply and base heuristic may agree on obvious best move

### Integration tests (update cross-module.test.ts)
- Heuristic bot vs Greedy bot plays 20+ moves without error
- `printUI(state)` after heuristic bot move does not throw

### Adversarial tests (update edge-cases.test.ts)
- 1x1 board → returns null (no legal non-suicide moves)
- Fully occupied board → returns null
- 19x19 board → completes within 2000ms
