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
    console.log("  [AI] Thinking...")
    const move = b.selectMove(s, bColor)
    if (move === null) {
      console.log("  [AI] passes.")
      pass(s)
      if (s.gameOver) { printUI(s); showResult(s); rli.close(); process.exit(0) }
      printUI(s)
      if (!s.gameOver && s.currentPlayer === bColor) setTimeout(() => triggerBotMove(s, b, bColor, rli), 100)
      return
    }
    const ok = placeStone(s, move.r, move.c)
    if (ok) {
      const rowLabel = s.size - move.r
      console.log("  [AI] plays " + String.fromCharCode(65 + move.c) + rowLabel + ".")
    }
    printUI(s)
    if (s.gameOver) { showResult(s); rli.close(); process.exit(0) }
  }
  
  rl.on("line", async (line: string) => {
    if (awaitingSize || awaitingAiSetup || awaitingAiDifficulty || waitingForAiColor) return
    if (!state) return
    const cmd = line.trim().toLowerCase()
    if (cmd === "quit" || cmd === "exit") { console.log("Goodbye!"); rl.close(); process.exit(0) }
    if (cmd === "help") { showHelp(); printUI(state); return }
    if (cmd === "undo" || cmd === "u") {
      if (bot && state.currentPlayer !== humanColor) {
        // It's the bot's turn — undo bot's last move + human's last move
        const undone = undoMultiple(state, 2)
        if (undone > 0) {
          console.log("  [UNDO] Undid " + undone + " move(s).")
          printUI(state)
        } else {
          console.log("  [X] Nothing to undo.")
        }
      } else if (canUndo(state)) {
        undo(state)
        console.log("  [UNDO] Undid last move.")
        printUI(state)
      } else {
        console.log("  [X] Nothing to undo.")
      }
      return
    }
    if (cmd === "redo" || cmd === "r") {
      if (canRedo(state)) {
        redo(state)
        console.log("  [REDO] Redid last move.")
        printUI(state)
        if (bot && state.currentPlayer === botColor) setTimeout(() => triggerBotMove(state, bot, botColor, rl), 100)
      } else {
        console.log("  [X] Nothing to redo.")
      }
      return
    }
    if (cmd === "sgf") {
      console.log(formatSGF(exportSGF(state, { playerBlack: humanColor === BLACK ? "Human" : "AI", playerWhite: humanColor === WHITE ? "Human" : "AI" })))
      return
    }
    if (cmd.startsWith("export")) {
      const parts2 = cmd.split(/\s+/)
      const filename = parts2[1] ? parts2[1] + (parts2[1].endsWith(".sgf") ? "" : ".sgf") : "game-" + Date.now() + ".sgf"
      const sgfStr = exportSGF(state, { playerBlack: humanColor === BLACK ? "Human" : "AI", playerWhite: humanColor === WHITE ? "Human" : "AI" })
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
      try {
        const content = Bun.file(filename)
        const text = await content.text()
        const result = importSGF(text)
        if (!result) {
          console.log("  [X] Invalid SGF file or not a Go game.")
          return
        }
        state = result.state
        console.log("  [OK] Loaded game from " + filename + " (" + state.moves.length + " moves)")
        if (result.warnings.length > 0) {
          for (const w of result.warnings) console.log("  [W] " + w)
        }
        printUI(state)
      } catch {
        console.log("  [X] Could not read " + filename)
      }
      return
    }
    if (cmd === "pass") {
      pass(state)
      if (state.gameOver) { printUI(state); showResult(state); rl.close(); process.exit(0) }
      printUI(state)
      if (bot && state.currentPlayer === botColor) setTimeout(() => triggerBotMove(state, bot, botColor, rl), 100)
      return
    }
    if (cmd === "resign") {
      if (bot) { console.log("  [RESIGN] Human resigns. AI wins!") }
      else { resign(state) }
      showResult(state); rl.close(); process.exit(0)
    }
    if (bot && state.currentPlayer !== humanColor) {
      console.log("  [X] It's the AI's turn. Wait...")
      printUI(state); return
    }
    const coord = parseCoord(line, state.size)
    if (!coord) { console.log("  [X] Invalid: \"" + line + "\". Type help for commands."); printUI(state); return }
    placeStone(state, coord[0], coord[1])
    if (state.gameOver) { printUI(state); showResult(state); rl.close(); process.exit(0) }
    printUI(state)
    if (bot && state.currentPlayer === botColor) setTimeout(() => triggerBotMove(state, bot, botColor, rl), 100)
  })
  
}

main().catch(console.error)

