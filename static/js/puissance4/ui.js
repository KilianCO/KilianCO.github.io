import { Board, ROWS, COLS, other } from "./game.js";
import { MinimaxAgent, MonteCarloAgent, OnnxAgent } from "./agents.js";

const root = document.querySelector(".demo.c4");
const boardEl = document.getElementById("c4-board");
const scoresEl = document.getElementById("c4-scores");
const statusEl = document.getElementById("c4-status");
const agentEl = document.getElementById("c4-agent");
const helpEl = document.getElementById("c4-help");
const yellowEl = document.getElementById("c4-yellow");
const redEl = document.getElementById("c4-red");
const firstEl = document.getElementById("c4-first");
const newBtn = document.getElementById("c4-new");

const YELLOW = 1, RED = 2;
const COLOR = { [YELLOW]: "Les jaunes", [RED]: "Les rouges" };
const HUMAN = "human";

// Adversaires proposés : [valeur, libellé du menu, fabrique].
// Le modèle entraîné s'ajoute en tête de liste une fois chargé.
const AGENTS = [
  ["1", "Minimax facile", () => new MinimaxAgent(1, 0.35)],
  ["4", "Minimax moyen", () => new MinimaxAgent(4)],
  ["6", "Minimax difficile", () => new MinimaxAgent(6)],
  ["mc1000", "Monte-Carlo (1 000 simulations)", () => new MonteCarloAgent(1000)],
  ["mc10000", "Monte-Carlo (10 000 simulations)", () => new MonteCarloAgent(10000)],
];

let board, turn = YELLOW, busy = false, over = false, focusCol = 3;
let players = { [YELLOW]: null, [RED]: null }; // null = joueur humain
let gameId = 0;                                 // change à chaque nouvelle partie

// ---------- Construction du plateau ----------
const cols = [];
for (let c = 0; c < COLS; c++) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "c4-col";
  btn.setAttribute("aria-label", `Colonne ${c + 1}`);
  btn.tabIndex = c === focusCol ? 0 : -1;
  for (let r = 0; r < ROWS; r++) {
    const cell = document.createElement("span");
    cell.className = "cell";
    cell.innerHTML = '<span class="disc"></span>';
    btn.appendChild(cell);
  }
  btn.addEventListener("click", () => humanPlay(c));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      moveFocus(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  boardEl.appendChild(btn);
  cols.push(btn);
  scoresEl.appendChild(document.createElement("span"));
}

function moveFocus(delta) {
  focusCol = (focusCol + delta + COLS) % COLS;
  cols.forEach((b, i) => (b.tabIndex = i === focusCol ? 0 : -1));
  cols[focusCol].focus();
}

const discAt = (r, c) => cols[c].children[r].firstChild;
const isSpectator = () => players[YELLOW] !== null && players[RED] !== null;

function render(lastRow = -1, lastCol = -1) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const d = discAt(r, c);
      const v = board.cells[r * COLS + c];
      d.className = "disc" + (v === 1 ? " is-y" : v === 2 ? " is-r" : "");
      if (r === lastRow && c === lastCol) {
        void d.offsetWidth; // relance l'animation
        d.classList.add("drop-in");
      }
    }
  const humanTurn = !over && !busy && players[turn] === null;
  cols.forEach((b, c) => (b.disabled = !humanTurn || !board.canPlay(c)));
}

function showScores(scores, player = RED) {
  const spans = scoresEl.children;
  scoresEl.classList.toggle("is-y", player === YELLOW);
  if (!scores) { for (const s of spans) s.style.height = "0"; return; }
  const vals = scores.filter((v) => v !== null);
  const min = Math.min(...vals), max = Math.max(...vals);
  scores.forEach((v, c) => {
    const h = v === null ? 0 : max === min ? 50 : 12 + 88 * ((v - min) / (max - min));
    spans[c].style.height = `${h}%`;
  });
  scoresEl.setAttribute("title", "Préférence de l'IA pour chaque colonne lors de son dernier coup");
}

function setStatus(text) { statusEl.textContent = text; }

function finish(player) {
  over = true;
  const line = board.winningLine(player);
  if (isSpectator()) setStatus(`${COLOR[player]} gagnent.`);
  else setStatus(players[player] === null ? "Vous avez gagné. Bien joué !" : "L'IA a gagné. Une revanche ?");
  render();
  if (line) line.forEach((i) => discAt(Math.floor(i / COLS), i % COLS).classList.add("is-win"));
}

/** Affiche le coup et renvoie true si la partie est finie. */
function afterMove(player, row, col) {
  render(row, col);
  if (board.winningLine(player)) { finish(player); return true; }
  if (board.isFull()) { over = true; setStatus("Match nul : le plateau est plein."); render(); return true; }
  return false;
}

function nextTurn() {
  if (over) return;
  if (players[turn] !== null) aiPlay(turn);
  else { setStatus(board.moves ? "À vous de jouer." : "Vous jouez les jaunes. Choisissez une colonne."); render(); }
}

async function aiPlay(player) {
  const id = gameId;
  const spectator = isSpectator();
  busy = true; render();
  setStatus(spectator ? `${COLOR[player]} réfléchissent…` : "L'IA réfléchit…");
  await new Promise((r) => setTimeout(r, spectator ? 550 : 350)); // laisse le temps de voir le coup précédent
  if (id !== gameId) return;

  // Entre deux IA, le premier coup de chacune est tiré au hasard :
  // sans cela, deux adversaires déterministes rejoueraient toujours la même partie.
  let col, scores = null;
  if (spectator && board.moves < 2) {
    const valid = board.validMoves();
    col = valid[Math.floor(Math.random() * valid.length)];
  } else {
    ({ col, scores } = await players[player].choose(board, player));
    if (id !== gameId) return; // une nouvelle partie a commencé pendant la réflexion
  }

  const row = board.play(col, player);
  busy = false;
  showScores(scores, player);
  if (afterMove(player, row, col)) return;
  turn = other(player);
  nextTurn();
}

function humanPlay(col) {
  if (!board || busy || over || players[turn] !== null || !board.canPlay(col)) return;
  focusCol = col;
  const player = turn;
  const row = board.play(col, player);
  if (afterMove(player, row, col)) return;
  turn = other(player);
  nextTurn();
}

function makeAgent(value) {
  const entry = AGENTS.find(([v]) => v === value) ?? AGENTS.find(([v]) => v === "4");
  return entry[2]();
}

function newGame() {
  gameId++;
  board = new Board();
  over = false; busy = false;
  players = {
    [YELLOW]: yellowEl.value === HUMAN ? null : makeAgent(yellowEl.value),
    [RED]: makeAgent(redEl.value),
  };
  turn = Number(firstEl.value);
  if (isSpectator()) {
    agentEl.textContent = `Jaunes : ${players[YELLOW].label}. Rouges : ${players[RED].label}.`;
    helpEl.textContent = "Deux IA s'affrontent. Le premier coup de chacune est tiré au hasard, pour que les parties ne se répètent pas.";
  } else {
    agentEl.textContent = `Adversaire actuel : ${players[RED].label}.`;
    helpEl.textContent = "Cliquez sur une colonne, ou utilisez les flèches gauche et droite puis Entrée.";
  }
  showScores(null);
  render();
  nextTurn();
}

function fillMenus() {
  const keep = { yellow: yellowEl.value || HUMAN, red: redEl.value || "4" };
  yellowEl.replaceChildren(new Option("Vous", HUMAN), ...AGENTS.map(([v, text]) => new Option(text, v)));
  redEl.replaceChildren(...AGENTS.map(([v, text]) => new Option(text, v)));
  yellowEl.value = keep.yellow;
  redEl.value = keep.red;
}

fillMenus();
newBtn.addEventListener("click", newGame);
for (const el of [yellowEl, redEl, firstEl]) el.addEventListener("change", newGame);

// ---------- Chargement du modèle, s'il est configuré ----------
const modelUrl = root.dataset.modelUrl;
if (modelUrl) {
  agentEl.textContent = "Chargement du modèle…";
  new OnnxAgent(modelUrl, root.dataset.modelVersion).load()
    .then((model) => {
      AGENTS.unshift(["model", "IA entraînée (DQN)", () => model]);
      fillMenus();
      redEl.value = "model";
      newGame();
    })
    .catch((err) => {
      console.error(err);
      newGame();
      agentEl.textContent = "Le modèle n'a pas pu être chargé : vous jouez contre un adversaire minimax.";
    });
} else {
  newGame();
}
