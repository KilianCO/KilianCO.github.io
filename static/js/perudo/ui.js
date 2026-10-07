import { ACE, DUDO, Game, actionIndex, indexAction } from "./game.js";
import {
  ConservativeAgent, ObservingAgent, OnnxAgent, ProbabilisticAgent, RandomAgent, StatisticalAgent,
} from "./agents.js";

const root = document.querySelector(".demo.pd");
const $ = (id) => document.getElementById(id);
const bottomEl = $("pd-bottom"), topEl = $("pd-top"), newBtn = $("pd-new");
const bidEl = $("pd-bid"), historyEl = $("pd-history"), statusEl = $("pd-status");
const actionsEl = $("pd-actions"), choiceEl = $("pd-choice");
const betBtn = $("pd-bet"), dudoBtn = $("pd-dudo"), nextBtn = $("pd-next");
const agentEl = $("pd-agent"), helpEl = $("pd-help");
const nameEls = [$("pd-name-0"), $("pd-name-1")], diceEls = [$("pd-dice-0"), $("pd-dice-1")];

const BOTTOM = 0, TOP = 1, HUMAN = "human", DICE = 5;

// Adversaires proposés : [valeur, libellé du menu, fabrique].
// Le réseau entraîné s'ajoute en tête de liste une fois chargé.
const AGENTS = [
  ["prob-bold", "Probabiliste audacieux", () => new ProbabilisticAgent("bold")],
  ["prob-low", "Probabiliste discret", () => new ProbabilisticAgent("low")],
  ["conservative", "Prudent", () => new ConservativeAgent()],
  ["statistical", "Statistique", () => new StatisticalAgent()],
  ["observing", "Observateur", () => new ObservingAgent()],
  ["random", "Aléatoire", () => new RandomAgent()],
];

let game = null;
let players = [null, null];   // null = joueur humain
let reveal = null;            // issue de la manche en cours d'affichage
let busy = false;
let gameId = 0;               // change à chaque nouvelle partie

const isSpectator = () => players[BOTTOM] !== null;
const seatName = (seat) =>
  isSpectator() ? (seat === BOTTOM ? "Le joueur du bas" : "Le joueur du haut") : seat === BOTTOM ? "Vous" : "L'IA";
const bidText = (bid) => `${bid.quantity} × ${bid.value}`;
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

// ---------- Affichage ----------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function dieElement(value, { hidden = false, hit = false } = {}) {
  const die = document.createElement("span");
  die.className = "die" + (hidden ? " is-hidden" : "") + (hit ? " is-hit" : "");
  if (hidden) { die.textContent = "?"; die.setAttribute("aria-label", "dé caché"); return die; }
  die.setAttribute("aria-label", `dé de valeur ${value}`);
  for (let i = 0; i < 9; i++) {
    const pip = document.createElement("span");
    if (PIPS[value].includes(i)) pip.className = "pip";
    die.appendChild(pip);
  }
  return die;
}

function renderSeat(seat) {
  const count = game.diceCounts[seat];
  nameEls[seat].textContent = `${seatName(seat)} · ${plural(count, "dé")}`;
  // Pendant la révélation, on montre les dés de la manche qui vient de finir.
  const dice = reveal ? reveal.dice[seat] : game.dice[seat];
  const visible = reveal !== null || isSpectator() || seat === BOTTOM;
  const counts = (d) => reveal !== null && (d === reveal.bid.value || d === ACE);
  diceEls[seat].replaceChildren(...dice.map((d) => dieElement(d, { hidden: !visible, hit: counts(d) })));
}

function render() {
  renderSeat(TOP);
  renderSeat(BOTTOM);

  const last = reveal ? reveal.bid : game.lastBid;
  bidEl.textContent = last ? `Pari en cours : ${plural(last.quantity, "dé")} de valeur ${last.value}` : "Aucun pari pour l'instant";

  historyEl.replaceChildren(...game.history.slice(-8).map(({ player, bid }) => {
    const item = document.createElement("li");
    item.textContent = `${seatName(player)} : ${bidText(bid)}`;
    return item;
  }));

  const humanTurn = !reveal && !busy && !game.isOver && players[game.current] === null;
  actionsEl.hidden = isSpectator();
  nextBtn.hidden = !(reveal && !isSpectator());
  nextBtn.textContent = game.isOver ? "Nouvelle partie" : "Manche suivante";
  for (const el of [choiceEl, betBtn]) el.disabled = !humanTurn;
  dudoBtn.disabled = !humanTurn || !game.lastBid;
  choiceEl.closest("label").hidden = betBtn.hidden = dudoBtn.hidden = !nextBtn.hidden;

  if (humanTurn) {
    const bids = game.legalActions().filter((a) => a !== DUDO);
    choiceEl.replaceChildren(...bids.map((bid) =>
      new Option(`${plural(bid.quantity, "dé")} de valeur ${bid.value}`, actionIndex(bid))));
    betBtn.disabled = bids.length === 0;
  }
}

function setStatus(text) { statusEl.textContent = text; }

// ---------- Déroulement ----------
function nextTurn() {
  if (reveal || game.isOver) return;
  if (players[game.current] !== null) aiTurn(game.current);
  else {
    setStatus(game.lastBid ? "À vous : surenchérissez, ou dites dudo." : "À vous d'ouvrir la manche.");
    render();
  }
}

async function aiTurn(seat) {
  const id = gameId;
  busy = true; render();
  setStatus(`${seatName(seat)} réfléchit…`);
  await new Promise((r) => setTimeout(r, isSpectator() ? 800 : 650)); // laisse le temps de lire le pari précédent
  if (id !== gameId) return;
  const { action } = await players[seat].choose(game.view());
  if (id !== gameId) return; // une nouvelle partie a commencé pendant la réflexion
  busy = false;
  play(action);
}

function play(action) {
  const result = game.step(action);
  if (!result) { nextTurn(); return; }

  reveal = result;
  const truth = result.bidWasTrue ? "le pari tenait" : "le pari était faux";
  const verb = (seat) => (seatName(seat) === "Vous" ? "perdez" : "perd");
  const says = seatName(result.caller) === "Vous" ? "dites" : "dit";
  let text = `${seatName(result.caller)} ${says} dudo sur « ${bidText(result.bid)} ». ` +
    (result.bid.value === ACE
      ? `Il y avait ${result.count} as : ${truth}. `
      : `Il y avait ${plural(result.count, "dé")} de valeur ${result.bid.value}, as compris : ${truth}. `) +
    `${seatName(result.loser)} ${verb(result.loser)} un dé.`;
  if (game.isOver) {
    text += isSpectator() ? ` ${seatName(game.winner)} gagne la partie.`
      : game.winner === BOTTOM ? " Vous gagnez la partie. Bien joué !" : " L'IA gagne la partie. Une revanche ?";
  }
  setStatus(text);
  render();

  if (isSpectator() && !game.isOver) {
    const id = gameId;
    setTimeout(() => { if (id === gameId) nextRound(); }, 2800);
  }
}

function nextRound() {
  if (game.isOver) { newGame(); return; }
  reveal = null;
  nextTurn();
}

function makeAgent(value) {
  const entry = AGENTS.find(([v]) => v === value) ?? AGENTS[0];
  return entry[2]();
}

function newGame() {
  gameId++;
  game = new Game(DICE);
  reveal = null; busy = false;
  players = [bottomEl.value === HUMAN ? null : makeAgent(bottomEl.value), makeAgent(topEl.value)];
  if (isSpectator()) {
    agentEl.textContent = `En bas : ${players[BOTTOM].label}. En haut : ${players[TOP].label}.`;
    helpEl.textContent = "Deux IA s'affrontent, dés visibles. À chaque dudo, les dés qui comptent pour le pari sont surlignés.";
  } else {
    agentEl.textContent = `Adversaire actuel : ${players[TOP].label}.`;
    helpEl.textContent = "Un pari annonce un nombre de dés d'une valeur sur toute la table. Les as (1) comptent pour toutes les valeurs. Dudo met en doute le dernier pari : celui qui se trompe perd un dé.";
  }
  render();
  nextTurn();
}

function fillMenus() {
  const keep = { bottom: bottomEl.value || HUMAN, top: topEl.value || AGENTS[0][0] };
  bottomEl.replaceChildren(new Option("Vous", HUMAN), ...AGENTS.map(([v, text]) => new Option(text, v)));
  topEl.replaceChildren(...AGENTS.map(([v, text]) => new Option(text, v)));
  bottomEl.value = keep.bottom;
  topEl.value = keep.top;
}

const humanCanPlay = () => game && !reveal && !busy && !game.isOver && players[game.current] === null;
betBtn.addEventListener("click", () => { if (humanCanPlay()) play(indexAction(Number(choiceEl.value))); });
dudoBtn.addEventListener("click", () => { if (humanCanPlay() && game.lastBid) play(DUDO); });
nextBtn.addEventListener("click", nextRound);
newBtn.addEventListener("click", newGame);
for (const el of [bottomEl, topEl]) el.addEventListener("change", newGame);

fillMenus();

// ---------- Chargement du modèle, s'il est configuré ----------
const modelUrl = root.dataset.modelUrl;
if (modelUrl) {
  agentEl.textContent = "Chargement du modèle…";
  new OnnxAgent(modelUrl, root.dataset.modelVersion).load()
    .then((model) => {
      AGENTS.unshift(["model", "Réseau entraîné (DQN)", () => model]);
      fillMenus();
      topEl.value = "model";
      newGame();
    })
    .catch((err) => {
      console.error(err);
      newGame();
      agentEl.textContent = "Le modèle n'a pas pu être chargé : vous jouez contre le bot probabiliste.";
    });
} else {
  newGame();
}
