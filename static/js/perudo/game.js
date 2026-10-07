// Règles et moteur du duel de Perudo. Même logique que perudo/rules.py et
// perudo/game.py dans le dépôt du projet.
//
// Un pari { quantity, value } annonce « au moins quantity dés de valeur value
// sur la table ». Les as (1) comptent pour toutes les valeurs.
export const DUDO = "dudo";
export const FACES = 6;
export const ACE = 1;

/** Numéro d'une action : 0 pour le dudo, 1 à 60 pour les paris (quantité puis valeur). */
export const actionIndex = (action) =>
  action === DUDO ? 0 : 1 + (action.quantity - 1) * FACES + (action.value - 1);

export const indexAction = (index) =>
  index === 0 ? DUDO : { quantity: Math.floor((index - 1) / FACES) + 1, value: ((index - 1) % FACES) + 1 };

export const sameBid = (a, b) => a !== DUDO && b !== DUDO && a.quantity === b.quantity && a.value === b.value;

/**
 * Le pari est-il permis après `last` ? `used` contient les numéros des paris
 * déjà annoncés dans la manche : un pari ne peut pas être répété.
 */
export function isValidBid(bid, last, totalDice, used = new Set()) {
  if (bid.value < 1 || bid.value > FACES) return false;
  if (bid.quantity < 1 || bid.quantity > totalDice) return false;
  if (used.has(actionIndex(bid))) return false;
  if (!last) return true;
  // Quitter les as : au moins le double plus un.
  if (last.value === ACE && bid.value > ACE && bid.quantity < 2 * last.quantity + 1) return false;
  // Sans monter la quantité, il faut monter la valeur (ou passer aux as).
  if (bid.quantity <= last.quantity && (bid.value === last.value || (bid.value > ACE && bid.value <= last.value))) return false;
  // Passer aux as : au moins la moitié.
  if (bid.value === ACE && last.value > ACE && 2 * bid.quantity < last.quantity) return false;
  return true;
}

/** Tous les paris permis, par quantité puis valeur croissantes. */
export function legalBids(last, totalDice, used = new Set()) {
  const bids = [];
  for (let quantity = 1; quantity <= totalDice; quantity++)
    for (let value = 1; value <= FACES; value++) {
      const bid = { quantity, value };
      if (isValidBid(bid, last, totalDice, used)) bids.push(bid);
    }
  return bids;
}

const rollDie = () => 1 + Math.floor(Math.random() * FACES);

/** Ce que voit un joueur : ses dés, le nombre de dés de chacun, les paris de la manche. */
export class View {
  constructor(game, player) {
    this.player = player;
    this.dice = game.dice[player].slice();
    this.diceCounts = game.diceCounts.slice();
    this.lastBid = game.lastBid;
    this.history = game.history.slice();
    this.legal = game.legalActions();
  }
  get totalDice() { return this.diceCounts[0] + this.diceCounts[1]; }
  get hiddenDice() { return this.totalDice - this.dice.length; }
  /** Ses propres dés qui comptent pour la valeur, as compris. */
  countOwn(value) { return this.dice.filter((d) => d === value || d === ACE).length; }
  isLegal(action) {
    return this.legal.some((a) => (a === DUDO || action === DUDO ? a === action : sameBid(a, action)));
  }
}

/** Duel : deux joueurs, jusqu'à ce que l'un n'ait plus de dés. */
export class Game {
  constructor(dice = 5, firstPlayer = Math.floor(Math.random() * 2)) {
    this.diceCounts = [dice, dice];
    this.dice = [[], []];
    this.round = 0;
    this.winner = null;
    this.starter = firstPlayer;
    this.startRound();
  }
  get totalDice() { return this.diceCounts[0] + this.diceCounts[1]; }
  get isOver() { return this.winner !== null; }

  startRound() {
    this.round++;
    this.dice = this.diceCounts.map((n) => Array.from({ length: n }, rollDie).sort((a, b) => a - b));
    this.current = this.starter;
    this.lastBid = null;
    this.lastBidder = null;
    this.history = [];
    this.used = new Set();
  }

  /** Dés de la table qui comptent pour la valeur. */
  count(value) {
    return this.dice.flat().filter((d) => d === value || d === ACE).length;
  }

  legalActions() {
    if (this.isOver) return [];
    const bids = legalBids(this.lastBid, this.totalDice, this.used);
    return this.lastBid ? [DUDO, ...bids] : bids;
  }

  view() { return new View(this, this.current); }

  /** Joue l'action du joueur courant. Renvoie l'issue de la manche après un dudo, sinon null. */
  step(action) {
    if (this.isOver) throw new Error("La partie est terminée.");
    if (action === DUDO) {
      if (!this.lastBid) throw new Error("Dudo impossible : aucun pari à mettre en doute.");
      return this.resolveDudo();
    }
    if (!isValidBid(action, this.lastBid, this.totalDice, this.used)) {
      throw new Error(`Pari interdit : ${action.quantity} × ${action.value}`);
    }
    this.history.push({ player: this.current, bid: action });
    this.used.add(actionIndex(action));
    this.lastBid = action;
    this.lastBidder = this.current;
    this.current = 1 - this.current;
    return null;
  }

  resolveDudo() {
    const caller = this.current, bidder = this.lastBidder, bid = this.lastBid;
    const count = this.count(bid.value);
    const loser = count >= bid.quantity ? caller : bidder;
    const result = { caller, bidder, bid, count, loser, dice: this.dice.map((d) => d.slice()), bidWasTrue: count >= bid.quantity };
    this.diceCounts[loser]--;
    result.eliminated = this.diceCounts[loser] === 0;
    if (result.eliminated) {
      this.winner = 1 - loser;
    } else {
      this.starter = loser;
      this.startRound();
    }
    return result;
  }
}
