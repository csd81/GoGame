// src/engine.ts
var EMPTY = 0;
var BLACK = 1;
var WHITE = 2;
function createBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}
function cloneBoard(board) {
  return board.map((row) => [...row]);
}
function boardKey(board) {
  return board.map((row) => row.join("")).join("|");
}
function getNeighbors(r, c, size) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const result = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size)
      result.push([nr, nc]);
  }
  return result;
}
function findGroup(board, r, c) {
  const color = board[r][c];
  if (color === EMPTY)
    return [];
  const size = board.length;
  const visited = new Set;
  const group = [];
  const stack = [[r, c]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop();
    const key = cr * size + cc;
    if (visited.has(key))
      continue;
    visited.add(key);
    group.push([cr, cc]);
    for (const [nr, nc] of getNeighbors(cr, cc, size)) {
      if (!visited.has(nr * size + nc) && board[nr][nc] === color)
        stack.push([nr, nc]);
    }
  }
  return group;
}
function countLiberties(board, group) {
  const size = board.length;
  const liberties = new Set;
  for (const [r, c] of group) {
    for (const [nr, nc] of getNeighbors(r, c, size)) {
      if (board[nr][nc] === EMPTY)
        liberties.add(nr * size + nc);
    }
  }
  return liberties.size;
}
function isStarPoint(r, c, size) {
  if (size === 9)
    return [2, 4, 6].includes(r) && [2, 4, 6].includes(c);
  if (size === 13)
    return [3, 6, 9].includes(r) && [3, 6, 9].includes(c);
  if (size === 19) {
    const s = [3, 9, 15];
    return s.includes(r) && s.includes(c);
  }
  return false;
}
function tryPlaceStone(board, r, c, color) {
  const size = board.length;
  if (board[r][c] !== EMPTY) {
    return { valid: false, reason: "Intersection is not empty." };
  }
  const newBoard = cloneBoard(board);
  newBoard[r][c] = color;
  let totalCaptured = 0;
  const opponent = color === BLACK ? WHITE : BLACK;
  for (const [nr, nc] of getNeighbors(r, c, size)) {
    if (newBoard[nr][nc] === opponent) {
      const enemyGroup = findGroup(newBoard, nr, nc);
      if (countLiberties(newBoard, enemyGroup) === 0) {
        for (const [cr, cc] of enemyGroup)
          newBoard[cr][cc] = EMPTY;
        totalCaptured += enemyGroup.length;
      }
    }
  }
  const ownGroup = findGroup(newBoard, r, c);
  if (countLiberties(newBoard, ownGroup) === 0) {
    return { valid: false, reason: "Suicide is not allowed." };
  }
  return { valid: true, newBoard, captured: totalCaptured };
}
function checkKo(newBoard, history) {
  const key = boardKey(newBoard);
  return history.length >= 2 && key === history[history.length - 2];
}
function isValidMove(state, r, c) {
  if (state.gameOver)
    return { valid: false, reason: "Game is over." };
  const result = tryPlaceStone(state.board, r, c, state.currentPlayer);
  if (!result.valid || !result.newBoard)
    return result;
  if (checkKo(result.newBoard, state.history))
    return { valid: false, reason: "Ko rule - cannot repeat previous position." };
  return result;
}
function isValidMoveForColor(state, r, c, color) {
  if (state.gameOver)
    return { valid: false, reason: "Game is over." };
  const result = tryPlaceStone(state.board, r, c, color);
  if (!result.valid || !result.newBoard)
    return result;
  if (checkKo(result.newBoard, state.history))
    return { valid: false, reason: "Ko rule - cannot repeat previous position." };
  return result;
}
function placeStone(state, r, c) {
  const result = isValidMove(state, r, c);
  if (!result.valid || !result.newBoard)
    return false;
  state.board = result.newBoard;
  state.history.push(boardKey(state.board));
  state.captures[state.currentPlayer] += result.captured;
  state.consecutivePasses = 0;
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK;
  state.moveCount++;
  state.lastMove = { r, c };
  return true;
}
function pass(state) {
  state.consecutivePasses++;
  state.history.push(boardKey(state.board));
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK;
  if (state.consecutivePasses >= 2)
    state.gameOver = true;
  state.moveCount++;
  state.lastMove = null;
}
function resign(state) {
  state.gameOver = true;
}
function createInitialState(size = 19) {
  return {
    size,
    board: createBoard(size),
    currentPlayer: BLACK,
    captures: { [BLACK]: 0, [WHITE]: 0 },
    history: [],
    consecutivePasses: 0,
    gameOver: false,
    moveCount: 0,
    lastMove: null
  };
}
function countScore(state) {
  const { board, size, captures } = state;
  const territory = { [BLACK]: 0, [WHITE]: 0 };
  const visited = new Set;
  for (let r = 0;r < size; r++) {
    for (let c = 0;c < size; c++) {
      if (board[r][c] === EMPTY && !visited.has(r * size + c)) {
        const borders = new Set;
        const stack = [[r, c]];
        const regionVisited = new Set;
        while (stack.length > 0) {
          const [cr, cc] = stack.pop();
          const key = cr * size + cc;
          if (regionVisited.has(key))
            continue;
          regionVisited.add(key);
          visited.add(key);
          for (const [nr, nc] of getNeighbors(cr, cc, size)) {
            if (board[nr][nc] === EMPTY) {
              if (!regionVisited.has(nr * size + nc))
                stack.push([nr, nc]);
            } else {
              borders.add(board[nr][nc]);
            }
          }
        }
        if (borders.size === 1) {
          const owner = [...borders][0];
          territory[owner] += regionVisited.size;
        }
      }
    }
  }
  return {
    blackScore: territory[BLACK] + captures[BLACK],
    whiteScore: territory[WHITE] + captures[WHITE] + 6.5
  };
}

// src/bots.ts
var getNeighborsRef;
var findGroupRef;
var countLibertiesRef;
var isValidMoveRef;
function setBotDeps(getNeighbors2, findGroup2, countLiberties2, isValidMove2) {
  getNeighborsRef = getNeighbors2;
  findGroupRef = findGroup2;
  countLibertiesRef = countLiberties2;
  isValidMoveRef = isValidMove2;
}
function createRandomBot() {
  return {
    name: "Random",
    selectMove(state, botColor) {
      const { size, board } = state;
      const empty = [];
      for (let r = 0;r < size; r++) {
        for (let c = 0;c < size; c++) {
          if (board[r][c] === EMPTY)
            empty.push([r, c]);
        }
      }
      if (empty.length === 0)
        return null;
      const start = Math.floor(Math.random() * empty.length);
      for (let i = 0;i < empty.length; i++) {
        const idx = (start + i) % empty.length;
        const [r, c] = empty[idx];
        const result = isValidMoveRef(state, r, c, botColor);
        if (result.valid)
          return { r, c };
      }
      return null;
    }
  };
}
function createGreedyBot() {
  return {
    name: "Greedy",
    selectMove(state, botColor) {
      const { size, board } = state;
      const opponent = botColor === BLACK ? WHITE : BLACK;
      for (let r = 0;r < size; r++) {
        for (let c = 0;c < size; c++) {
          if (board[r][c] === opponent) {
            const group = findGroupRef(board, r, c);
            if (countLibertiesRef(board, group) === 1) {
              for (const [gr, gc] of group) {
                for (const [nr, nc] of getNeighborsRef(gr, gc, size)) {
                  if (board[nr][nc] === EMPTY) {
                    const result = isValidMoveRef(state, nr, nc, botColor);
                    if (result.valid)
                      return { r: nr, c: nc };
                  }
                }
              }
            }
          }
        }
      }
      for (let r = 0;r < size; r++) {
        for (let c = 0;c < size; c++) {
          if (board[r][c] === botColor) {
            const group = findGroupRef(board, r, c);
            if (countLibertiesRef(board, group) === 1) {
              for (const [gr, gc] of group) {
                for (const [nr, nc] of getNeighborsRef(gr, gc, size)) {
                  if (board[nr][nc] === EMPTY) {
                    const result = isValidMoveRef(state, nr, nc, botColor);
                    if (result.valid)
                      return { r: nr, c: nc };
                  }
                }
              }
            }
          }
        }
      }
      const center = (size - 1) / 2;
      const candidates = [];
      for (let r = 0;r < size; r++) {
        for (let c = 0;c < size; c++) {
          if (board[r][c] === EMPTY) {
            const result = isValidMoveRef(state, r, c, botColor);
            if (result.valid) {
              const dist = Math.abs(r - center) + Math.abs(c - center);
              candidates.push({ r, c, score: dist + Math.random() * 3 });
            }
          }
        }
      }
      if (candidates.length === 0)
        return null;
      candidates.sort((a, b) => a.score - b.score);
      return { r: candidates[0].r, c: candidates[0].c };
    }
  };
}
var INFLUENCE_RADIUS = 5;
var CAPTURE_WEIGHT = 25;
var ATARI_WEIGHT = 15;
var DEFENSE_WEIGHT = 12;
var INFLUENCE_DELTA_WEIGHT = 2;
var CONNECTION_WEIGHT = 4;
var EDGE_PENALTY_1 = -4;
var EDGE_PENALTY_2 = -2;
var STAR_POINT_BONUS = 3;
var CENTER_BIAS_WEIGHT = 1;
function buildInfluenceMap(board, size) {
  const map = Array.from({ length: size }, () => Array(size).fill(0));
  const radius = INFLUENCE_RADIUS;
  for (let r = 0;r < size; r++) {
    for (let c = 0;c < size; c++) {
      if (board[r][c] === EMPTY)
        continue;
      const sign = board[r][c] === BLACK ? 1 : -1;
      for (let dr = -radius;dr <= radius; dr++) {
        for (let dc = -radius;dc <= radius; dc++) {
          if (dr === 0 && dc === 0)
            continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size)
            continue;
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          map[nr][nc] += sign * (radius - dist) / radius;
        }
      }
    }
  }
  return map;
}
function getInfluenceAround(influence, r, c, size, radius) {
  let sum = 0;
  for (let dr = -radius;dr <= radius; dr++) {
    for (let dc = -radius;dc <= radius; dc++) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        sum += influence[nr][nc];
      }
    }
  }
  return sum;
}
function edgePenalty(r, c, size) {
  const minDist = Math.min(r, c, size - 1 - r, size - 1 - c);
  if (minDist === 0)
    return EDGE_PENALTY_1;
  if (minDist === 1)
    return EDGE_PENALTY_2;
  return 0;
}
function centerBias(r, c, size) {
  const center = (size - 1) / 2;
  const maxDist = center;
  const dist = Math.abs(r - center) + Math.abs(c - center);
  return CENTER_BIAS_WEIGHT * (1 - dist / (maxDist * 2));
}
function isEarlyGame(state) {
  let stones = 0;
  for (let r = 0;r < state.size; r++)
    for (let c = 0;c < state.size; c++)
      if (state.board[r][c] !== EMPTY)
        stones++;
  return stones < 40;
}
function hasGroupAtari(board, color) {
  const size = board.length;
  for (let r = 0;r < size; r++) {
    for (let c = 0;c < size; c++) {
      if (board[r][c] === color) {
        const group = findGroupRef(board, r, c);
        if (countLibertiesRef(board, group) === 1)
          return true;
      }
    }
  }
  return false;
}
function countFriendlyNeighbors(board, r, c, color, size) {
  let count = 0;
  for (const [nr, nc] of getNeighborsRef(r, c, size)) {
    if (board[nr][nc] === color)
      count++;
  }
  return count;
}
function getLegalMoves(state, color) {
  const moves = [];
  for (let r = 0;r < state.size; r++) {
    for (let c = 0;c < state.size; c++) {
      if (state.board[r][c] !== EMPTY)
        continue;
      const result = isValidMoveRef(state, r, c, color);
      if (result.valid)
        moves.push([r, c]);
    }
  }
  return moves;
}
function scoreMove(state, r, c, color) {
  const { size } = state;
  const opponent = color === BLACK ? WHITE : BLACK;
  const result = isValidMoveRef(state, r, c, color);
  if (!result.valid || !result.newBoard)
    return -Infinity;
  const newBoard = result.newBoard;
  const captured = result.captured;
  let score = 0;
  score += captured * CAPTURE_WEIGHT;
  if (hasGroupAtari(newBoard, opponent)) {
    score += ATARI_WEIGHT;
  }
  if (hasGroupAtari(state.board, color) && !hasGroupAtari(newBoard, color)) {
    score += DEFENSE_WEIGHT;
  }
  score += countFriendlyNeighbors(newBoard, r, c, color, size) * CONNECTION_WEIGHT;
  const influenceBefore = buildInfluenceMap(state.board, size);
  const influenceAfter = buildInfluenceMap(newBoard, size);
  const deltaBefore = getInfluenceAround(influenceBefore, r, c, size, 3);
  const deltaAfter = getInfluenceAround(influenceAfter, r, c, size, 3);
  const sign = color === BLACK ? 1 : -1;
  score += (deltaAfter - deltaBefore) * sign * INFLUENCE_DELTA_WEIGHT;
  score += edgePenalty(r, c, size);
  if (isStarPoint(r, c, size) && isEarlyGame(state)) {
    score += STAR_POINT_BONUS;
  }
  score += centerBias(r, c, size);
  return score;
}
function createHeuristicBot() {
  return {
    name: "Heuristic",
    selectMove(state, botColor) {
      const moves = getLegalMoves(state, botColor);
      if (moves.length === 0)
        return null;
      let bestMove = moves[0];
      let bestScore = -Infinity;
      for (const [r, c] of moves) {
        const score = scoreMove(state, r, c, botColor);
        if (score > bestScore) {
          bestScore = score;
          bestMove = [r, c];
        }
      }
      return { r: bestMove[0], c: bestMove[1] };
    }
  };
}

// src/web/app.ts
setBotDeps(getNeighbors, findGroup, countLiberties, isValidMoveForColor);
var BOT_FACTORIES = {
  1: createRandomBot,
  2: createGreedyBot,
  3: createHeuristicBot
};
var S = {
  game: createInitialState(9),
  bot: null,
  playerColor: BLACK,
  size: 9,
  level: 3,
  busy: false
};
var $board;
var $status;
var $overlay;
var $modalTitle;
var $modalScores;
var grid = [];
var $sizeSelect;
var $levelSelect;
var $colorSelect;
function stoneSymbol(color) {
  return color === BLACK ? "●" : "○";
}
function getActiveBot() {
  if (S.bot === null)
    return null;
  return S.game.currentPlayer === S.playerColor ? null : S.bot;
}
function isStarPoint2(r, c, size) {
  if (size === 9)
    return [2, 4, 6].includes(r) && [2, 4, 6].includes(c);
  if (size === 13)
    return [3, 6, 9].includes(r) && [3, 6, 9].includes(c);
  if (size === 19) {
    const s = [3, 9, 15];
    return s.includes(r) && s.includes(c);
  }
  return false;
}
function buildGrid(size) {
  $board.innerHTML = "";
  $board.style.gridTemplateColumns = "repeat(" + size + ", var(--cell-size))";
  grid = [];
  for (let r = 0;r < size; r++) {
    const row = [];
    for (let c = 0;c < size; c++) {
      const cell = document.createElement("div");
      cell.className = "intersection";
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      if (r === 0)
        cell.classList.add("edge-top");
      if (r === size - 1)
        cell.classList.add("edge-bottom");
      if (c === 0)
        cell.classList.add("edge-left");
      if (c === size - 1)
        cell.classList.add("edge-right");
      if (isStarPoint2(r, c, size)) {
        cell.classList.add("star-point");
        const dot = document.createElement("div");
        dot.className = "star-dot";
        cell.appendChild(dot);
      }
      const ghost = document.createElement("div");
      ghost.className = "ghost " + (S.playerColor === BLACK ? "black" : "white");
      cell.appendChild(ghost);
      cell.addEventListener("click", () => onCellClick(r, c));
      $board.appendChild(cell);
      row.push(cell);
    }
    grid.push(row);
  }
}
function renderStones() {
  const { board, size, lastMove } = S.game;
  for (let r = 0;r < size; r++) {
    for (let c = 0;c < size; c++) {
      const cell = grid[r][c];
      if (!cell)
        continue;
      const existing = cell.querySelector(".stone");
      if (existing)
        existing.remove();
      const val = board[r][c];
      if (val === EMPTY)
        continue;
      const stone = document.createElement("div");
      stone.className = "stone " + (val === BLACK ? "black" : "white");
      if (lastMove && lastMove.r === r && lastMove.c === c) {
        stone.classList.add("last-move");
      }
      cell.appendChild(stone);
    }
  }
}
function updateGhostColor() {
  const cls = S.playerColor === BLACK ? "black" : "white";
  for (let r = 0;r < S.size; r++) {
    for (let c = 0;c < S.size; c++) {
      const ghost = grid[r]?.[c]?.querySelector(".ghost");
      if (ghost)
        ghost.className = "ghost " + cls;
    }
  }
}
function renderStatus() {
  const { game } = S;
  const cur = game.currentPlayer;
  const curSymbol = stoneSymbol(cur);
  const curName = cur === BLACK ? "Black" : "White";
  const bSymbol = stoneSymbol(BLACK);
  const wSymbol = stoneSymbol(WHITE);
  const isBot = getActiveBot() !== null;
  let html = "";
  html += '<div class="turn-label">' + (isBot ? "AI thinking..." : "Your turn") + " — " + curSymbol + " " + curName + "</div>";
  html += '<div class="captures">Captures  ' + bSymbol + " " + game.captures[BLACK] + "  " + wSymbol + " " + game.captures[WHITE] + "</div>";
  if (game.consecutivePasses > 0) {
    html += '<div class="captures">Passes ' + game.consecutivePasses + "/2</div>";
  }
  if (game.lastMove) {
    const col = String.fromCharCode(65 + game.lastMove.c);
    const row = game.size - game.lastMove.r;
    html += '<div class="last-move">Last: ' + col + row + "</div>";
  } else if (game.moveCount > 0) {
    html += '<div class="last-move">Last: pass</div>';
  }
  $status.innerHTML = html;
}
function showGameOver() {
  const score = countScore(S.game);
  const bSymbol = stoneSymbol(BLACK);
  const wSymbol = stoneSymbol(WHITE);
  $modalTitle.textContent = "Game Over!";
  $modalScores.innerHTML = '<div class="score-line">' + bSymbol + " Black: " + score.blackScore + "</div>" + '<div class="score-line">' + wSymbol + " White: " + score.whiteScore + "</div>" + "<p>" + (score.blackScore > score.whiteScore ? bSymbol + " Black wins!" : score.whiteScore > score.blackScore ? wSymbol + " White wins!" : "Draw!") + "</p>";
  $overlay.classList.add("active");
}
function render() {
  renderStones();
  renderStatus();
}
function onCellClick(r, c) {
  if (S.game.gameOver || S.busy)
    return;
  if (getActiveBot() !== null)
    return;
  const ok = placeStone(S.game, r, c);
  if (!ok) {
    $board.classList.remove("shake");
    $board.offsetWidth;
    $board.classList.add("shake");
    return;
  }
  render();
  if (S.game.gameOver) {
    showGameOver();
    return;
  }
  scheduleBotMove();
}
function scheduleBotMove() {
  const bot = getActiveBot();
  if (!bot)
    return;
  S.busy = true;
  renderStatus();
  setTimeout(() => {
    if (S.game.gameOver) {
      S.busy = false;
      return;
    }
    const move = bot.selectMove(S.game, S.game.currentPlayer);
    if (move === null) {
      pass(S.game);
    } else {
      placeStone(S.game, move.r, move.c);
    }
    S.busy = false;
    render();
    if (S.game.gameOver) {
      showGameOver();
      return;
    }
    scheduleBotMove();
  }, 300);
}
function doPass() {
  if (S.game.gameOver || S.busy)
    return;
  if (getActiveBot() !== null)
    return;
  pass(S.game);
  render();
  if (S.game.gameOver) {
    showGameOver();
    return;
  }
  scheduleBotMove();
}
function doResign() {
  if (S.game.gameOver || S.busy)
    return;
  if (getActiveBot() !== null)
    return;
  resign(S.game);
  render();
  showGameOver();
}
function newGame() {
  S.game = createInitialState(S.size);
  S.bot = BOT_FACTORIES[S.level]?.() ?? null;
  S.playerColor = parseInt($colorSelect.value);
  S.busy = false;
  $overlay.classList.remove("active");
  if (grid.length !== S.size) {
    buildGrid(S.size);
  } else {
    for (let r = 0;r < S.size; r++) {
      for (let c = 0;c < S.size; c++) {
        const stone = grid[r][c]?.querySelector(".stone");
        if (stone)
          stone.remove();
      }
    }
  }
  updateGhostColor();
  render();
  setTimeout(() => scheduleBotMove(), 200);
}
function setupTestDOM() {
  const $app = document.getElementById("app");
  if (!$app)
    return;
  $app.innerHTML = [
    '<div id="side-panel">',
    "  <h1>Ancient Go</h1>",
    '  <div class="control-group">',
    '    <label for="size-select">Board Size</label>',
    '    <select id="size-select">',
    '      <option value="9">9 x 9</option>',
    '      <option value="13">13 x 13</option>',
    '      <option value="19">19 x 19</option>',
    "    </select>",
    "  </div>",
    '  <div class="control-group">',
    '    <label for="level-select">AI Level</label>',
    '    <select id="level-select">',
    '      <option value="1">1 Random</option>',
    '      <option value="2">2 Greedy</option>',
    '      <option value="3">3 Heuristic</option>',
    "    </select>",
    "  </div>",
    '  <div class="control-group">',
    '    <label for="color-select">Play as</label>',
    '    <select id="color-select">',
    '      <option value="1">Black</option>',
    '      <option value="2">White</option>',
    "    </select>",
    "  </div>",
    '  <div class="control-group">',
    '    <button id="new-game-btn">New Game</button>',
    "  </div>",
    '  <div class="control-group">',
    '    <button id="pass-btn">Pass (P)</button>',
    '    <button id="resign-btn">Resign (R)</button>',
    "  </div>",
    '  <div id="status"></div>',
    "</div>",
    '<div id="board-wrapper">',
    '  <div id="board"></div>',
    "</div>",
    '<div id="game-over-overlay">',
    '  <div id="game-over-modal">',
    '    <h2 id="modal-title"></h2>',
    '    <div id="modal-scores"></div>',
    `    <button onclick="this.parentElement.parentElement.classList.remove('active')">Close</button>`,
    "  </div>",
    "</div>"
  ].join(`
`);
  $board = document.getElementById("board");
  $status = document.getElementById("status");
  $overlay = document.getElementById("game-over-overlay");
  $modalTitle = document.getElementById("modal-title");
  $modalScores = document.getElementById("modal-scores");
  $sizeSelect = document.getElementById("size-select");
  $levelSelect = document.getElementById("level-select");
  $colorSelect = document.getElementById("color-select");
  $sizeSelect.value = "9";
  $levelSelect.value = "3";
  $colorSelect.value = "1";
}
function teardownTestDOM() {
  const $app = document.getElementById("app");
  if ($app)
    $app.innerHTML = "";
  S.game = createInitialState(9);
  S.bot = null;
  S.playerColor = BLACK;
  S.size = 9;
  S.level = 3;
  S.busy = false;
  grid = [];
}
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    setupTestDOM();
    const params = new URLSearchParams(location.search);
    S.size = parseInt(params.get("size") ?? "9") || 9;
    S.level = parseInt(params.get("level") ?? "3") || 3;
    S.playerColor = parseInt(params.get("color") ?? String(BLACK)) === WHITE ? WHITE : BLACK;
    $sizeSelect.value = String(S.size);
    $levelSelect.value = String(S.level);
    $colorSelect.value = String(S.playerColor);
    document.getElementById("pass-btn").addEventListener("click", doPass);
    document.getElementById("resign-btn").addEventListener("click", doResign);
    document.getElementById("new-game-btn").addEventListener("click", newGame);
    $sizeSelect.addEventListener("change", () => {
      S.size = parseInt($sizeSelect.value);
      newGame();
    });
    $levelSelect.addEventListener("change", () => {
      S.level = parseInt($levelSelect.value);
      S.bot = BOT_FACTORIES[S.level]?.() ?? null;
      newGame();
    });
    $colorSelect.addEventListener("change", () => newGame());
    document.addEventListener("keydown", (e) => {
      if (e.key === "p" || e.key === "P")
        doPass();
      if (e.key === "r" || e.key === "R")
        doResign();
      if (e.key === "n" || e.key === "N")
        newGame();
    });
    buildGrid(S.size);
    S.bot = BOT_FACTORIES[S.level]?.() ?? null;
    updateGhostColor();
    render();
    if (S.bot && S.playerColor !== BLACK) {
      setTimeout(() => scheduleBotMove(), 300);
    }
  });
}
export {
  updateGhostColor,
  teardownTestDOM,
  stoneSymbol,
  showGameOver,
  setupTestDOM,
  scheduleBotMove,
  renderStones,
  renderStatus,
  render,
  onCellClick,
  newGame,
  isStarPoint2 as isStarPoint,
  grid,
  getActiveBot,
  doResign,
  doPass,
  buildGrid,
  S,
  BOT_FACTORIES,
  $status,
  $sizeSelect,
  $overlay,
  $modalTitle,
  $modalScores,
  $levelSelect,
  $colorSelect,
  $board
};
