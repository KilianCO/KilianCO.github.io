import { Board, ROWS, COLS } from "./game.js";
import { MinimaxAgent, OnnxAgent } from "./agents.js";

const root = document.querySelector(".demo.c4");
const boardEl = document.getElementById("c4-board");
const scoresEl = document.getElementById("c4-scores");
const statusEl = document.getElementById("c4-status");
const agentEl = document.getElementById("c4-agent");
const levelEl = document.getElementById("c4-level");
const firstEl = document.getElementById("c4-first");
const newBtn = document.getElementById("c4-new");

const HUMAN = 1, AI = 2;
const LEVELS = { 1: [1, 0.35], 4: [4, 0], 6: [6, 0] }; // profondeur, part de coups aléatoires

let board, busy = false, over = false, focusCol = 3;
let model = null;      // OnnxAgent si un modèle est configuré et chargé
let agent = null;

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
  cols.forEach((b, c) => (b.disabled = over || busy || !board.canPlay(c)));
}

function showScores(scores) {
  const spans = scoresEl.children;
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
  setStatus(player === HUMAN ? "Vous avez gagné. Bien joué !" : "L'IA a gagné. Une revanche ?");
  render();
  if (line) line.forEach((i) => discAt(Math.floor(i / COLS), i % COLS).classList.add("is-win"));
}

function afterMove(player, row, col) {
  render(row, col);
  if (board.winningLine(player)) { finish(player); return true; }
  if (board.isFull()) { over = true; setStatus("Match nul : le plateau est plein."); render(); return true; }
  return false;
}

async function aiPlay() {
  busy = true; render();
  setStatus("L'IA réfléchit…");
  await new Promise((r) => setTimeout(r, 350)); // laisse le temps d'afficher le coup précédent
  const { col, scores } = await agent.choose(board, AI);
  const row = board.play(col, AI);
  busy = false;
  showScores(scores);
  if (!afterMove(AI, row, col)) setStatus("À vous de jouer.");
}

async function humanPlay(col) {
  if (busy || over || !board.canPlay(col)) return;
  focusCol = col;
  const row = board.play(col, HUMAN);
  if (afterMove(HUMAN, row, col)) return;
  await aiPlay();
}

function pickAgent() {
  if (model) return model;
  const [depth, rnd] = LEVELS[levelEl.value];
  return new MinimaxAgent(depth, rnd);
}

function newGame() {
  board = new Board();
  over = false; busy = false;
  agent = pickAgent();
  agentEl.textContent = `Adversaire actuel : ${agent.label}.`;
  showScores(null);
  render();
  if (firstEl.value === "ai") aiPlay();
  else setStatus("Vous jouez les jaunes. Choisissez une colonne.");
}

newBtn.addEventListener("click", newGame);
levelEl.addEventListener("change", newGame);
firstEl.addEventListener("change", newGame);

// ---------- Chargement du modèle, s'il est configuré ----------
const modelUrl = root.dataset.modelUrl;
if (modelUrl) {
  levelEl.closest("label").hidden = true;
  agentEl.textContent = "Chargement du modèle…";
  new OnnxAgent(modelUrl, root.dataset.modelVersion).load()
    .then((m) => { model = m; newGame(); })
    .catch((err) => {
      console.error(err);
      levelEl.closest("label").hidden = false;
      newGame();
      agentEl.textContent = "Le modèle n'a pas pu être chargé : vous jouez contre l'adversaire de référence (minimax).";
    });
} else {
  newGame();
}
