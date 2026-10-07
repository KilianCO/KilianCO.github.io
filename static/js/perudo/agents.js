// Adversaires du Perudo. Chaque agent expose :
//   async choose(view) -> { action, scores }
// `scores` (facultatif) associe à des numéros d'action la préférence de l'agent.
// Mêmes raisonnements que perudo/bots.py dans le dépôt du projet.
import { ACE, DUDO, FACES, actionIndex, indexAction } from "./game.js";

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const bidsOf = (view) => view.legal.filter((a) => a !== DUDO);

/** Le pari voulu s'il est permis ; sinon dudo ; sinon un pari permis au hasard. */
function orDudo(view, bid) {
  if (view.isLegal(bid)) return bid;
  if (view.isLegal(DUDO)) return DUDO;
  return pick(view.legal);
}

export class RandomAgent {
  get label() { return "joue au hasard, et dit dudo trois fois sur dix"; }
  async choose(view) {
    if (view.isLegal(DUDO) && Math.random() < 0.3) return { action: DUDO };
    const bids = bidsOf(view);
    return { action: bids.length ? pick(bids) : DUDO };
  }
}

/** Compare le pari au nombre de dés attendu, en oubliant que les as sont des jokers. */
export class StatisticalAgent {
  get label() { return "compare le pari à une estimation simple, qui oublie les as"; }
  async choose(view) {
    const expected = (value) => view.dice.filter((d) => d === value).length + view.hiddenDice / 6;
    if (!view.lastBid) {
      let best = 1;
      for (let v = 2; v <= FACES; v++) if (expected(v) > expected(best)) best = v;
      return { action: orDudo(view, { quantity: Math.max(1, Math.floor(expected(best))), value: best }) };
    }
    if (expected(view.lastBid.value) < view.lastBid.quantity) return { action: DUDO };
    return { action: orDudo(view, { quantity: view.lastBid.quantity + 1, value: view.lastBid.value }) };
  }
}

/** Surenchérit de un sur la même valeur, et ne doute que très tard. */
export class ConservativeAgent {
  get label() { return "surenchérit de un sur la même valeur, et ne doute que très tard"; }
  async choose(view) {
    if (!view.lastBid) {
      let best = null;
      for (const value of [...new Set(view.dice)].sort((a, b) => a - b))
        if (best === null || view.countOwn(value) > view.countOwn(best)) best = value;
      return { action: orDudo(view, { quantity: view.countOwn(best), value: best }) };
    }
    const expected = view.countOwn(view.lastBid.value) + view.hiddenDice / 6;
    if (expected / view.lastBid.quantity < 0.4) return { action: DUDO };
    return { action: orDudo(view, { quantity: view.lastBid.quantity + 1, value: view.lastBid.value }) };
  }
}

/** Doute de tout pari de plus de trois dés, sinon mise sur l'une de ses valeurs. */
export class ObservingAgent {
  get label() { return "doute de tout pari de plus de trois dés"; }
  async choose(view) {
    const last = view.lastBid;
    if (last && last.quantity > 3 && last.value !== ACE) return { action: DUDO };
    const value = pick(view.dice);
    return { action: orDudo(view, { quantity: view.countOwn(value) + 1, value }) };
  }
}

function binomial(n, k) {
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

/** Probabilité qu'au moins `needed` dés sur `dice` comptent, chacun avec la probabilité p. */
export function atLeast(dice, needed, p) {
  if (needed <= 0) return 1;
  if (needed > dice) return 0;
  let total = 0;
  for (let k = needed; k <= dice; k++) total += binomial(dice, k) * p ** k * (1 - p) ** (dice - k);
  return total;
}

/** Probabilité exacte que le pari soit vrai, sachant ses propres dés. */
export function bidProbability(view, bid) {
  const p = bid.value === ACE ? 1 / 6 : 2 / 6; // la valeur ou un as
  return atLeast(view.hiddenDice, bid.quantity - view.countOwn(bid.value), p);
}

/**
 * Joue d'après la probabilité exacte de chaque pari, sans bluffer.
 * style "bold" : le pari sûr le plus audacieux ; "low" : le plus petit pari sûr.
 */
export class ProbabilisticAgent {
  constructor(style = "bold", confidence = 0.9) {
    this.style = style;
    this.confidence = confidence;
  }
  get label() {
    return this.style === "bold"
      ? "calcule la probabilité exacte de chaque pari et annonce le plus audacieux des paris sûrs"
      : "calcule la probabilité exacte de chaque pari et annonce le plus petit des paris sûrs";
  }
  async choose(view) {
    const bids = bidsOf(view);
    if (!bids.length) return { action: DUDO };
    const probability = bids.map((bid) => bidProbability(view, bid));
    const scores = {};
    bids.forEach((bid, i) => (scores[actionIndex(bid)] = probability[i]));

    let chosen = -1;
    for (let i = 0; i < bids.length; i++) {
      if (probability[i] < this.confidence) continue;
      if (chosen === -1) { chosen = i; if (this.style === "low") break; continue; }
      // style audacieux : plus grande quantité, puis plus grande probabilité
      if (bids[i].quantity > bids[chosen].quantity ||
          (bids[i].quantity === bids[chosen].quantity && probability[i] > probability[chosen])) chosen = i;
    }
    if (chosen === -1) {
      chosen = 0;
      for (let i = 1; i < bids.length; i++) if (probability[i] > probability[chosen]) chosen = i;
    }
    if (view.lastBid) {
      const dudoSucceeds = 1 - bidProbability(view, view.lastBid);
      scores[0] = dudoSucceeds;
      if (dudoSucceeds > probability[chosen]) return { action: DUDO, scores };
    }
    return { action: bids[chosen], scores };
  }
}

// ---------- Réseau entraîné ----------
export const MAX_DICE = 5;
export const N_BIDS = 2 * MAX_DICE * FACES;      // 60
export const N_ACTIONS = 1 + N_BIDS;             // 61
export const OBS_SIZE = FACES + 2 + N_ACTIONS + 2 * N_BIDS; // 189

/** Vecteur d'entrée du réseau : même encodage que perudo/rl/encoding.py. */
export function encode(view) {
  const state = new Float32Array(OBS_SIZE);
  for (const die of view.dice) state[die - 1] += 1 / MAX_DICE;
  state[FACES] = view.diceCounts[view.player] / MAX_DICE;
  state[FACES + 1] = view.diceCounts[1 - view.player] / MAX_DICE;
  const last = FACES + 2, mine = last + N_ACTIONS, theirs = mine + N_BIDS;
  state[last + (view.lastBid ? actionIndex(view.lastBid) : 0)] = 1;
  for (const { player, bid } of view.history)
    state[(player === view.player ? mine : theirs) + actionIndex(bid) - 1] = 1;
  return state;
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
 * Réseau entraîné, exécuté dans le navigateur avec ONNX Runtime Web.
 *   entrée  float32 [1, 189] ; sortie float32 [1, 61] (0 : dudo, 1 à 60 : paris).
 * Les actions interdites sont écartées avant de choisir la meilleure.
 */
export class OnnxAgent {
  constructor(modelUrl, version = "") {
    this.modelUrl = modelUrl;
    this.version = version;
    this.session = null;
  }
  get label() {
    return `réseau de neurones entraîné${this.version ? " " + this.version : ""}, exécuté dans votre navigateur`;
  }
  async load() {
    this.ort = await loadOrt();
    this.session = await this.ort.InferenceSession.create(this.modelUrl, { executionProviders: ["wasm"] });
    return this;
  }
  async values(view) {
    const input = new this.ort.Tensor("float32", encode(view), [1, OBS_SIZE]);
    const out = await this.session.run({ [this.session.inputNames[0]]: input });
    return Array.from(out[this.session.outputNames[0]].data);
  }
  async choose(view) {
    const values = await this.values(view);
    const scores = {};
    let best = -1;
    for (const action of view.legal) {
      const index = actionIndex(action);
      scores[index] = values[index];
      if (best === -1 || values[index] > values[best]) best = index;
    }
    return { action: indexAction(best), scores };
  }
}
