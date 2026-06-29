# Plan: MCTS AI Bot (Level 4)

## Context
The GoGame currently has three AI bots:
- **Level 1 — Random**: Picks a random valid move. Trivial.
- **Level 2 — Greedy**: Captures at-risk groups, defends own, center-biased fallback. Weak.
- **Level 3 — Heuristic**: Scores each move by capture value, influence, atari, connection, edge penalty, star points, center bias. Decent but no lookahead.

Adding **Monte Carlo Tree Search (MCTS)** gives the bot genuine lookahead — it simulates random playouts from promising branches and converges on strong moves. This is the standard approach for strong Go AIs (AlphaGo used MCTS + neural nets; we skip the neural net and use random rollouts).

## File Structure

```
src/
  bots.ts              ← add createMCTSBot() export
  engine.ts            ← add getLegalMoves(), copyState() helpers
  __tests__/
    unit/
      mcts-bot.test.ts ← unit tests for MCTS internals
    adversarial/
      edge-cases.test.ts ← add MCTS timeout/edge tests
```

## How MCTS Works (4 Steps per Iteration)

```
          Selection              Expansion           Simulation         Backpropagation
              │                      │                    │                    │
    ┌─────────▼──────────┐    ┌──────▼──────┐    ┌───────▼───────┐    ┌────────▼────────┐
    │ Traverse tree from │    │ Add a new   │    │ Play random   │    │ Update visit    │
    │ root using UCB1   │───→│ child node  │───→│ moves until   │───→│ counts & wins   │
    │ until leaf node   │    │ for the     │    │ game ends     │    │ up the tree     │
    │                   │    │ chosen move │    │ (playout)     │    │                 │
    └───────────────────┘    └─────────────┘    ┌───────────────┐    └──────────────────┘
                                                │ 300+ rollouts │
                                                │ per move       │
                                                └───────────────┘
```

After N iterations (controlled by time budget), pick the most-visited child.

## Implementation Details

### 1. engine.ts — Helper Exports

Add to `engine.ts` to support cloning state for simulation:

```ts
export function copyState(state: GameState): GameState {
  return {
    size: state.size,
    board: cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    captures: { ...state.captures },
    history: [...state.history],
    consecutivePasses: state.consecutivePasses,
    gameOver: state.gameOver,
    moveCount: state.moveCount,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
  }
}
```

Also export `getLegalMoves`:

```ts
export function getLegalMoves(state: GameState, color: Cell): [number, number][] {
  const moves: [number, number][] = []
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.board[r][c] !== EMPTY) continue
      const result = isValidMoveForColor(state, r, c, color)
      if (result.valid) moves.push([r, c])
    }
  }
  return moves
}
```

### 2. bots.ts — Node Class and MCTS Bot

#### MCTSNode

```ts
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
```

#### Core Functions

| Function | Purpose |
|---|---|
| `selectChild(node)` | UCB1 selection: argmax `wins/visits + C * sqrt(log(parent.visits)/visits)` with C=1.4 |
| `expand(node, state)` | Pick one untried move, create child node, apply move to state copy |
| `rollout(state)` | Play random legal moves until game ends, return winner (BLACK/WHITE) or null (draw) |
| `backpropagate(node, winner)` | Walk up to root, increment visits, increment wins if winner matches node's perspective |
| `bestChild(node)` | After budget exhausted, pick child with highest visit count |

#### UCB1 Formula

```
UCB1 = (wins / visits) + C * sqrt(ln(parentVisits) / visits)
```

Where C = 1.4.

#### Rollout Policy

Random playout with small heuristic bias:
- Fill own atari if possible (liberty == 1)
- Capture enemy atari if possible
- Otherwise random legal move
- Pass only if no legal moves remain
- Two consecutive passes = game over

#### Time Budget

| Board Size | Iterations / Time |
|---|---|
| 9×9 | 2000 iterations or 1.5s |
| 13×13 | 800 iterations or 2.5s |
| 19×19 | 200 iterations or 4s |

Track wall-clock time with `performance.now()`. Stop between iterations.

#### createMCTSBot()

```ts
export function createMCTSBot(): Bot {
  return {
    name: "MCTS",
    selectMove(state, botColor) {
      // 1. If only one legal move, return immediately
      // 2. Create root node
      // 3. Loop: select → expand → rollout → backpropagate until budget
      // 4. Return best child's move
    }
  }
}
```

### 3. Integration

- **bots.ts**: Export `createMCTSBot`
- **Web UI (`app.ts`)**: Add `4` entry to `BOT_FACTORIES` and `<select>` options
- **CLI (`script.ts`)**: Add option 4 to difficulty prompt
- **Tests**: New `mcts-bot.test.ts` file

### 4. Test Plan

| Test | What it verifies |
|---|---|
| `selectChild returns child with best UCB1` | Correct selection in simple tree |
| `expand adds one child node` | Child count increments |
| `rollout returns valid winner` | Winner is BLACK, WHITE, or null |
| `backpropagate updates all ancestors` | Visits increment up the tree |
| `bestChild picks most-visited` | Correct tie-breaking |
| `createMCTSBot returns valid move` | Move on empty intersection |
| `createMCTSBot passes when no moves` | Returns null |
| `MCTS vs Random (9x9)` | MCTS wins (smoke) |
| `MCTS vs Greedy (9x9)` | MCTS wins (smoke) |

### 5. Edge Cases

- No legal moves → return null
- Time runs out during rollout → stop and backpropagate
- Only one legal move → skip tree search
- Game over during rollout → score via countScore()
- Large board → restrict rollouts near existing stones

### 6. Build Order

1. Export `copyState()` and `getLegalMoves()` from `engine.ts`
2. Implement MCTS core in `bots.ts`
3. Implement `createMCTSBot()` with time budget
4. Write `mcts-bot.test.ts` unit tests
5. Add edge-case tests
6. Wire into Web UI (level 4)
7. Wire into CLI (difficulty 4)
8. Run all tests — verify all pass
9. Play a 9×9 game to confirm MCTS beats Heuristic

### 7. Expected Strength (9×9)

| Bot | Est. Strength |
|---|---|
| Random | 20k |
| Greedy | 15k |
| Heuristic | 10k |
| **MCTS (2k rollouts)** | **5k-3k** |

### 8. Future Enhancements (v2+)

- RAVE — share playout results between similar moves
- Virtual loss + parallel search
- Domain-specific rollouts (pattern based)
- Opening book
- Progressive widening on 19×19
- Neural network policy head (very high effort)
