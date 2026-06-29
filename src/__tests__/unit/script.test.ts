/**
 * Unit tests for src/script.ts — CLI command processing
 */
import { describe, it, expect } from "bun:test"
import { processCommand, executeBotMove } from "../../script.ts"
import { createInitialState, BLACK, WHITE, placeStone } from "../../engine.ts"
import { createGreedyBot } from "../../bots.ts"

describe("processCommand", () => {
  it("returns error messages when state is null", () => {
    const result = processCommand(null, "anything", null, BLACK, WHITE)
    expect(result.state).toBeNull()
    expect(result.messages).toContain("  [X] No game in progress.")
    expect(result.shouldExit).toBe(false)
    expect(result.gameOver).toBe(false)
  })

  it("handles quit command", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "quit", null, BLACK, WHITE)
    expect(result.messages).toContain("Goodbye!")
    expect(result.shouldExit).toBe(true)
  })

  it("handles exit command", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "exit", null, BLACK, WHITE)
    expect(result.shouldExit).toBe(true)
  })

  it("handles help command", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "help", null, BLACK, WHITE)
    expect(result.messages).toContain("help")
    expect(result.shouldExit).toBe(false)
  })

  it("handles pass command", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "pass", null, BLACK, WHITE)
    expect(result.shouldExit).toBe(false)
  })

  it("handles resign command without bot", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "resign", null, BLACK, WHITE)
    expect(result.gameOver).toBe(true)
    expect(result.shouldExit).toBe(true)
  })

  it("handles resign command with bot", () => {
    const state = createInitialState(9)
    const bot = createGreedyBot()
    const result = processCommand(state, "resign", bot, BLACK, WHITE)
    expect(result.gameOver).toBe(true)
    expect(result.shouldExit).toBe(true)
    expect(result.messages).toContain("  [RESIGN] Human resigns. AI wins!")
  })

  it("handles undo command", () => {
    const state = createInitialState(9)
    placeStone(state, 3, 3) // Black plays
    placeStone(state, 4, 4) // White plays
    expect(state.undoPointer).toBe(2)
    const result = processCommand(state, "undo", null, BLACK, WHITE)
    expect(result.messages).toContain("  [UNDO] Undid last move.")
    expect(state.undoPointer).toBe(1)
  })

  it("handles undo with nothing to undo", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "undo", null, BLACK, WHITE)
    expect(result.messages).toContain("  [X] Nothing to undo.")
  })

  it("handles redo command", () => {
    const state = createInitialState(9)
    placeStone(state, 3, 3)
    placeStone(state, 4, 4)
    // Undo first
    processCommand(state, "undo", null, BLACK, WHITE)
    expect(state.undoPointer).toBe(1)
    // Then redo
    const result = processCommand(state, "redo", null, BLACK, WHITE)
    expect(result.messages).toContain("  [REDO] Redid last move.")
    expect(state.undoPointer).toBe(2)
  })

  it("handles redo with nothing to redo", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "redo", null, BLACK, WHITE)
    expect(result.messages).toContain("  [X] Nothing to redo.")
  })

  it("handles valid coordinate moves", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "D4", null, BLACK, WHITE)
    expect(result.state).not.toBeNull()
    if (result.state) {
      expect(result.state.board[5][3]).toBe(BLACK)
    }
  })

  it("handles invalid coordinates", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "Z99", null, BLACK, WHITE)
    expect(result.messages[0]).toContain("Invalid")
  })

  it("rejects moves when it is the AI's turn", () => {
    const state = createInitialState(9)
    // After Black plays, currentPlayer flips to WHITE
    placeStone(state, 3, 3) // now currentPlayer = WHITE
    const bot = createGreedyBot()
    // humanColor = BLACK, currentPlayer = WHITE → AI's turn
    const result = processCommand(state, "D4", bot, BLACK, WHITE)
    expect(result.messages[0]).toContain("It's the AI's turn")
  })

  it("triggers aiShouldMove after human move vs AI", () => {
    const state = createInitialState(9)
    const bot = createGreedyBot()
    // Set human as WHITE. currentPlayer = BLACK (AI's color).
    // After AI plays (via our setup), it'll be WHITE's turn (human's turn).
    // So place a stone for AI first:
    placeStone(state, 3, 3) // Black (AI) plays → currentPlayer = WHITE (human)
    // Now it's human's (WHITE) turn
    const result = processCommand(state, "D4", bot, WHITE, BLACK)
    // After human plays (D4), currentPlayer = BLACK (AI), so aiShouldMove should be true
    expect(result.aiShouldMove).toBe(true)
  })

  it("handles SGF export string", () => {
    const state = createInitialState(9)
    placeStone(state, 3, 3)
    const result = processCommand(state, "sgf", null, BLACK, WHITE)
    expect(result.messages[0]).toContain("GM[1]")
  })

  it("handles pass triggering game end (two consecutive passes)", () => {
    const state = createInitialState(9)
    // First pass by Black
    processCommand(state, "pass", null, BLACK, WHITE)
    expect(state.consecutivePasses).toBe(1)
    // Second pass by White — game over
    const result = processCommand(state, "pass", null, BLACK, WHITE)
    expect(result.gameOver).toBe(true)
    expect(result.shouldExit).toBe(true)
  })

  it("handles export command", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "export mygame", null, BLACK, WHITE)
    expect(result.messages[0]).toContain("mygame.sgf")
  })

  it("handles import command", () => {
    const state = createInitialState(9)
    const result = processCommand(state, "import test.sgf", null, BLACK, WHITE)
    expect(result.messages[0]).toContain("[IMPORT]")
  })

  it("undo twice when playing vs AI and it's AI's turn", () => {
    const state = createInitialState(9)
    const bot = createGreedyBot()

    // Black plays, White plays — now it's Black's turn (human)
    placeStone(state, 3, 3) // Black
    placeStone(state, 4, 4) // White
    expect(state.currentPlayer).toBe(BLACK)
    expect(state.undoPointer).toBe(2)

    // Now it's human's turn — normal undo
    const result = processCommand(state, "undo", bot, BLACK, WHITE)
    expect(result.messages[0]).toContain("[UNDO]")
    expect(state.undoPointer).toBe(1)
  })
})

describe("executeBotMove", () => {
  it("bot places a stone on its turn", () => {
    const state = createInitialState(9)
    const bot = createGreedyBot()
    const messages = executeBotMove(state, bot, BLACK)
    expect(messages[0]).toBe("  [AI] Thinking...")
    // Should have placed a stone
    const hasBlackStone = state.board.some(row => row.some(cell => cell === BLACK))
    expect(hasBlackStone).toBe(true)
  })

  it("bot plays a move", () => {
    const state = createInitialState(9)
    const bot = createGreedyBot()
    const messages = executeBotMove(state, bot, WHITE)
    expect(messages[0]).toBe("  [AI] Thinking...")
    expect(state.moves.length).toBe(1)
  })
})
