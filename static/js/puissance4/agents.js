// Adversaires interchangeables. Chaque agent expose :
//   async choose(board, player) -> { col, scores: number[7] | null }
// Pour brancher le modèle entraîné, il suffit de renseigner model_url dans
// content/projets/puissance-4.md : l'OnnxAgent est alors utilisé.
import { COLS, WINDOWS, other } from "./game.js";

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
