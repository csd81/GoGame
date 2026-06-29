// Ancient Go - Entry Point
import * as readline from "readline"
import type { GameState, Cell } from "./engine.ts"
import { BLACK, WHITE, createInitialState, pass, placeStone, resign, countScore, undo, redo, canUndo, canRedo, undoMultiple } from "./engine.ts"
import { renderBoard, renderStatus, printUI, showHelp, showResult, parseCoord } from "./render.ts"
import { createRandomBot, createGreedyBot, createHeuristicBot, createMCTSBot, setBotDeps } from "./bots.ts"
import type { Bot } from "./bots.ts"
import { getNeighbors, findGroup, countLiberties, isValidMoveForColor } from "./engine.ts"
import { exportSGF, importSGF, formatSGF } from "./sgf.ts"

// Wire up bot dependencies
setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor)

/**
 * Command processing result
 */
export interface CommandResult {
  state: GameState | null
  messages: string[]
  gameOver: boolean
  shouldExit: boolean
  aiShouldMove: boolean
}

/**
 * Process a single command string against the game state.
 * Pure logic — no I/O, no process.exit, no readline.
 */
export function processCommand(
  state: GameState | null,
  command: string,
  bot: Bot | null,
  humanColor: Cell,
  botColor: Cell,
): CommandResult {
  const messages: string[] = []
  let resultState = state
  let gameOver = false
  let shouldExit = false
  let aiShouldMove = false

  if (!resultState) {
    return { state: null, messages: ["  [X] No game in progress."], gameOver: false, shouldExit: false, aiShouldMove: false }
  }

  const cmd = command.trim().toLowerCase()

  if (cmd === "quit" || cmd === "exit") {
    messages.push("Goodbye!")
    return { state: resultState, messages, gameOver: false, shouldExit: true, aiShouldMove: false }
  }

  if (cmd === "help") {
    messages.push("help")
    return { state: resultState, messages, gameOver: false, shouldExit: false, aiShouldMove: false }
  }

  if (cmd === "undo" || cmd === "u") {
    if (bot && resultState.currentPlayer !== humanColor) {
      const undone = undoMultiple(resultState, 2)
      if (undone > 0) {
        messages.push("  [UNDO] Undid " + undone + " move(s).")
      } else {
        messages.push("  [X] Nothing to undo.")
      }
    } else if (canUndo(resultState)) {
      undo(resultState)
      messages.push("  [UNDO] Undid last move.")
    } else {
      messages.push("  [X] Nothing to undo.")
    }
    return { state: resultState, messages, gameOver, shouldExit: false, aiShouldMove: false }
  }

  if (cmd === "redo" || cmd === "r") {
    if (canRedo(resultState)) {
      redo(resultState)
      messages.push("  [REDO] Redid last move.")
      if (bot && resultState.currentPlayer === botColor) aiShouldMove = true
    } else {
      messages.push("  [X] Nothing to redo.")
    }
    return { state: resultState, messages, gameOver, shouldExit: false, aiShouldMove }
  }

  if (cmd === "sgf") {
    const sgfStr = formatSGF(exportSGF(resultState, {
      playerBlack: humanColor === BLACK ? "Human" : "AI",
      playerWhite: humanColor === WHITE ? "Human" : "AI",
    }))
    messages.push(sgfStr)
    return { state: resultState, messages, gameOver, shouldExit: false, aiShouldMove: false }
  }

  if (cmd.startsWith("export")) {
    const parts = cmd.split(/\s+/)
    const filename = parts[1] ? parts[1] + (parts[1].endsWith(".sgf") ? "" : ".sgf") : "game-export.sgf"
    messages.push("  [EXPORT] ready: " + filename)
    return { state: resultState, messages, gameOver, shouldExit: false, aiShouldMove: false }
  }

  if (cmd.startsWith("import ")) {
    messages.push("  [IMPORT] deferred (file I/O)")
    return { state: resultState, messages, gameOver, shouldExit: false, aiShouldMove: false }
  }

  if (cmd === "pass") {
    pass(resultState)
    if (resultState.gameOver) {
      gameOver = true
      shouldExit = true
    } else if (bot && resultState.currentPlayer === botColor) {
      aiShouldMove = true
    }
    return { state: resultState, messages, gameOver, shouldExit, aiShouldMove }
  }

  if (cmd === "resign") {
    if (bot) {
      messages.push("  [RESIGN] Human resigns. AI wins!")
    } else {
      resign(resultState)
    }
    return { state: resultState, messages, gameOver: true, shouldExit: true, aiShouldMove: false }
  }

  // AI turn check
  if (bot && resultState.currentPlayer !== humanColor) {
    messages.push("  [X] It's the AI's turn. Wait...")
    return { state: resultState, messages, gameOver: false, shouldExit: false, aiShouldMove: false }
  }

  // Coordinate move
  const coord = parseCoord(command, resultState.size)
  if (!coord) {
    messages.push('  [X] Invalid: "' + command + '". Type help for commands.')
    return { state: resultState, messages, gameOver: false, shouldExit: false, aiShouldMove: false }
  }

  placeStone(resultState, coord[0], coord[1])
  if (resultState.gameOver) {
    gameOver = true
    shouldExit = true
  } else if (bot && resultState.currentPlayer === botColor) {
    aiShouldMove = true
  }

  return { state: resultState, messages, gameOver, shouldExit, aiShouldMove }
}

/**
 * Execute a bot move. Returns messages to display.
 */
export function executeBotMove(state: GameState, bot: Bot, botColor: Cell): string[] {
  const messages: string[] = []
  messages.push("  [AI] Thinking...")
  const move = bot.selectMove(state, botColor)
  if (move === null) {
    messages.push("  [AI] passes.")
    pass(state)
    return messages
  }
  const ok = placeStone(state, move.r, move.c)
  if (ok) {
    const rowLabel = state.size - move.r
    messages.push("  [AI] plays " + String.fromCharCode(65 + move.c) + rowLabel + ".")
  }
  return messages
}

async function main(): Promise<void> {
  console.log("=== ANCIENT GO ===\n")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  let state: GameState | null = null
  let awaitingSize = true
  let bot: Bot | null = null
  let humanColor: typeof BLACK | typeof WHITE = BLACK
  let botColor: typeof BLACK | typeof WHITE = WHITE
  let awaitingAiSetup = false
  let waitingForAiColor = false
  let waitingForAiDifficulty = false

  rl.question("Board size? (9/13/19) [19]: ", (answer) => {
    const n = parseInt(answer.trim(), 10)
    const size = [9, 13, 19].includes(n) ? n : 19
    state = createInitialState(size)
    awaitingSize = false
    awaitingAiSetup = true
    rl.question("Play against AI? (y/n) [n]: ", (aiAnswer) => {
      const wantsAi = aiAnswer.trim().toLowerCase() === "y"
      if (!wantsAi) {
        showHelp()
        printUI(state)
        return
      }
      awaitingAiDifficulty = true
      rl.question("Choose difficulty (1=Random, 2=Greedy, 3=Heuristic, 4=MCTS) [3]: ", (diffAnswer) => {
        const diff = diffAnswer.trim()
        if (diff === "1") bot = createRandomBot()
        else if (diff === "2") bot = createGreedyBot()
        else if (diff === "4") bot = createMCTSBot()
        else bot = createHeuristicBot()
        awaitingAiDifficulty = false
        waitingForAiColor = true
        rl.question("Your color? (B/black or W/white) [B]: ", (colorAnswer) => {
          const c = colorAnswer.trim().toLowerCase()
          humanColor = (c === "w" || c === "white") ? WHITE : BLACK
          botColor = humanColor === BLACK ? WHITE : BLACK
          waitingForAiColor = false
          awaitingAiSetup = false
          showHelp()
          printUI(state)
          if (state && bot && state.currentPlayer === botColor) {
            triggerBotMove(state, bot, botColor, rl)
          }
        })
      })
    })
  })

  function triggerBotMove(s: GameState, b: Bot, bColor: typeof BLACK | typeof WHITE, rli: readline.Interface): void {
    const botMessages = executeBotMove(s, b, bColor)
    for (const msg of botMessages) console.log(msg)
    printUI(s)
    if (s.gameOver) { showResult(s); rli.close(); process.exit(0) }
    if (!s.gameOver && s.currentPlayer === bColor) setTimeout(() => triggerBotMove(s, b, bColor, rli), 100)
  }

  function handleCommandOutput(result: CommandResult, rawLine: string): void {
    const cmd = rawLine.trim().toLowerCase()
    if (cmd === "help") {
      showHelp()
      printUI(state)
      return
    }
    if (cmd === "sgf") {
      return
    }
    if (cmd.startsWith("export")) {
      const parts = cmd.split(/\s+/)
      const filename = parts[1] ? parts[1] + (parts[1].endsWith(".sgf") ? "" : ".sgf") : "game-" + Date.now() + ".sgf"
      const sgfStr = exportSGF(state!, {
        playerBlack: humanColor === BLACK ? "Human" : "AI",
        playerWhite: humanColor === WHITE ? "Human" : "AI",
      })
      try {
        Bun.write(filename, sgfStr)
        console.log("  [OK] Exported to " + filename)
      } catch {
        console.log("  [X] Failed to write " + filename)
      }
      return
    }
    if (cmd.startsWith("import ")) {
      const filename = cmd.slice(7).trim()
      importGame(filename).then(success => {
        if (!success) return
        printUI(state)
      })
      return
    }
    if (result.shouldExit) {
      if (result.gameOver) {
        printUI(state)
        showResult(state)
      }
      rl.close()
      process.exit(0)
    }
    if (cmd !== "help" && !cmd.startsWith("export") && !cmd.startsWith("import") && cmd !== "sgf") {
      printUI(state)
    }
    if (result.aiShouldMove) {
      setTimeout(() => triggerBotMove(state!, bot!, botColor, rl), 100)
    }
  }

  async function importGame(filename: string): Promise<boolean> {
    try {
      const content = Bun.file(filename)
      const text = await content.text()
      const importResult = importSGF(text)
      if (!importResult) {
        console.log("  [X] Invalid SGF file or not a Go game.")
        return false
      }
      state = importResult.state
      console.log("  [OK] Loaded game from " + filename + " (" + state.moves.length + " moves)")
      if (importResult.warnings.length > 0) {
        for (const w of importResult.warnings) console.log("  [W] " + w)
      }
      return true
    } catch {
      console.log("  [X] Could not read " + filename)
      return false
    }
  }

  rl.on("line", async (line: string) => {
    if (awaitingSize || awaitingAiSetup || awaitingAiDifficulty || waitingForAiColor) return
    if (!state) return

    const result = processCommand(state, line.trim(), bot, humanColor, botColor)
    for (const msg of result.messages) console.log(msg)
    handleCommandOutput(result, line.trim())
  })

}

main().catch(console.error)
