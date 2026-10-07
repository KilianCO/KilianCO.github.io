// Adversaires interchangeables. Chaque agent expose :
//   async choose(board, player) -> { col, scores: number[7] | null }
// Pour brancher le modèle entraîné, il suffit de renseigner model_url dans
// content/projets/puissance-4.md : l'OnnxAgent est alors utilisé.
import { ROWS, COLS, WINDOWS, other } from "./game.js";

const WIN = 1_000_000;
const CENTER_FIRST = [3, 2, 4, 1, 5, 0, 6];

function evaluate(board, me) {
  const opp = other(me);
  let score = 0;
  for (let r = 0; r < 6; r++) if (board.cells[r * COLS + 3] === me) score += 3; // contrôle du centre
  for (const w of WINDOWS) {
    let m = 0, o = 0;
    for (const i of w) { const v = board.cells[i]; if (v === me) m++; else if (v === opp) o++; }
    if (m && o) continue;
    if (m === 3) score += 5; else if (m === 2) score += 2;
    else if (o === 3) score -= 4; else if (o === 2) score -= 1;
  }
  return score;
}

function negamax(board, depth, alpha, beta, player) {
  const opp = other(player);
  if (board.winningLine(opp)) return -WIN - depth; // l'adversaire vient de gagner
  if (board.isFull()) return 0;
  if (depth === 0) return evaluate(board, player);
  let best = -Infinity;
  for (const c of CENTER_FIRST) {
    if (!board.canPlay(c)) continue;
    board.play(c, player);
    const v = -negamax(board, depth - 1, -beta, -alpha, opp);
    board.undo(c);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Baseline : minimax avec élagage alpha-bêta. Sert aussi de référence pour évaluer le modèle. */
export class MinimaxAgent {
  constructor(depth = 4, randomness = 0) {
    this.depth = depth;
    this.randomness = randomness;
  }
  get label() {
    return `minimax alpha-bêta, ${this.depth} coup${this.depth > 1 ? "s" : ""} d'avance`;
  }
  async choose(board, player) {
    const b = board.clone();
    const scores = new Array(COLS).fill(null);
    for (const c of CENTER_FIRST) {
      if (!b.canPlay(c)) continue;
      b.play(c, player);
      scores[c] = -negamax(b, this.depth - 1, -Infinity, Infinity, other(player));
      b.undo(c);
    }
    const valid = board.validMoves();
    if (this.randomness && Math.random() < this.randomness) {
      return { col: valid[Math.floor(Math.random() * valid.length)], scores };
    }
    const best = Math.max(...valid.map((c) => scores[c]));
    const ties = valid.filter((c) => scores[c] === best);
    return { col: ties[Math.floor(Math.random() * ties.length)], scores };
  }
}

const ORT_VERSION = "1.20.1";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

function loadOrt() {
  if (window.ort) return Promise.resolve(window.ort);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ORT_BASE + "ort.min.js";
    s.onload = () => { window.ort.env.wasm.wasmPaths = ORT_BASE; resolve(window.ort); };
    s.onerror = () => reject(new Error("ONNX Runtime n'a pas pu être chargé"));
    document.head.appendChild(s);
  });
}

/**
 * Modèle entraîné exécuté dans le navigateur avec ONNX Runtime Web.
 * Contrat d'entrée/sortie attendu (à respecter lors de l'export) :
 *   entrée  float32 [1, 2, 6, 7] : plan 0 = pions du joueur qui doit jouer, plan 1 = pions adverses
 *   sortie  float32 [1, 7]       : un score (logit) par colonne
 * Les colonnes pleines sont masquées avant de choisir le meilleur coup.
 */
export class OnnxAgent {
  constructor(modelUrl, version = "") {
    this.modelUrl = modelUrl;
    this.version = version;
    this.session = null;
  }
  get label() {
    return `modèle entraîné${this.version ? " " + this.version : ""}, exécuté dans votre navigateur`;
  }
  async load() {
    const ort = await loadOrt();
    this.ort = ort;
    this.session = await ort.InferenceSession.create(this.modelUrl, { executionProviders: ["wasm"] });
    return this;
  }
  async choose(board, player) {
    const opp = other(player);
    const x = new Float32Array(2 * 42);
    for (let i = 0; i < 42; i++) {
      if (board.cells[i] === player) x[i] = 1;
      else if (board.cells[i] === opp) x[42 + i] = 1;
    }
    const input = new this.ort.Tensor("float32", x, [1, 2, 6, 7]);
    const out = await this.session.run({ [this.session.inputNames[0]]: input });
    const logits = Array.from(out[this.session.outputNames[0]].data);
    const valid = board.validMoves();
    const masked = logits.map((v, c) => (valid.includes(c) ? v : -Infinity));
    const max = Math.max(...masked);
    const exp = masked.map((v) => (v === -Infinity ? 0 : Math.exp(v - max)));
    const sum = exp.reduce((a, b) => a + b, 0);
    const probs = exp.map((v, c) => (valid.includes(c) ? v / sum : null));
    return { col: masked.indexOf(max), scores: probs };
  }
}

const UCT_EXPLORATION = 1.4;
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const ONGOING = 0, WON = 1, DRAWN = 2;

/** Le pion posé en (row, col) complète-t-il un alignement de quatre ? */
function wonAt(cells, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    for (const sign of [1, -1]) {
      for (let k = 1; k < 4; k++) {
        const r = row + sign * dr * k, c = col + sign * dc * k;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || cells[r * COLS + c] !== player) break;
        count++;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

/**
 * Recherche arborescente de Monte-Carlo pure : ni apprentissage, ni évaluation écrite à la main.
 * Chaque coup est estimé en jouant des parties aléatoires à partir de lui.
 * Même algorithme que P4/mcts.py dans le dépôt du projet.
 */
export class MonteCarloAgent {
  constructor(simulations = 1000) {
    this.simulations = simulations;
  }
  get label() {
    return `recherche de Monte-Carlo, ${this.simulations.toLocaleString("fr-FR")} parties simulées par coup`;
  }
  async choose(board, player) {
    const root = { parent: null, move: -1, children: [], untried: board.validMoves(), visits: 0, wins: 0, state: ONGOING };
    for (let i = 0; i < this.simulations; i++) {
      this.simulate(root, board.clone(), player);
      if (i % 2500 === 2499) await new Promise((r) => setTimeout(r, 0)); // laisse respirer l'affichage
    }
    const scores = new Array(COLS).fill(null);
    for (const child of root.children) scores[child.move] = child.visits / root.visits;
    const best = Math.max(...root.children.map((c) => c.visits));
    const ties = root.children.filter((c) => c.visits === best);
    return { col: ties[Math.floor(Math.random() * ties.length)].move, scores };
  }
  simulate(root, b, player) {
    let node = root, toMove = player;
    // 1. Sélection : descendre dans l'arbre en suivant la formule UCT.
    while (node.untried.length === 0 && node.children.length) {
      const logVisits = Math.log(node.visits);
      let best = null, bestValue = -Infinity;
      for (const child of node.children) {
        const value = child.wins / child.visits + UCT_EXPLORATION * Math.sqrt(logVisits / child.visits);
        if (value > bestValue) { bestValue = value; best = child; }
      }
      b.play(best.move, toMove);
      node = best; toMove = other(toMove);
    }
    // 2. Expansion : ajouter un coup pas encore essayé.
    if (node.untried.length) {
      const col = node.untried.splice(Math.floor(Math.random() * node.untried.length), 1)[0];
      const row = b.play(col, toMove);
      const state = wonAt(b.cells, row, col, toMove) ? WON : b.isFull() ? DRAWN : ONGOING;
      const child = { parent: node, move: col, children: [], untried: state === ONGOING ? b.validMoves() : [], visits: 0, wins: 0, state };
      node.children.push(child);
      node = child; toMove = other(toMove);
    }
    // 3. Simulation : finir la partie au hasard. Résultat pour le joueur qui vient de jouer.
    let result;
    if (node.state === WON) result = 1;
    else if (node.state === DRAWN) result = 0.5;
    else {
      const mover = other(toMove);
      result = 0.5;
      while (!b.isFull()) {
        const moves = b.validMoves();
        const col = moves[Math.floor(Math.random() * moves.length)];
        const row = b.play(col, toMove);
        if (wonAt(b.cells, row, col, toMove)) { result = toMove === mover ? 1 : 0; break; }
        toMove = other(toMove);
      }
    }
    // 4. Rétropropagation : le point de vue s'inverse à chaque étage.
    while (node) {
      node.visits++; node.wins += result;
      result = 1 - result;
      node = node.parent;
    }
  }
}
