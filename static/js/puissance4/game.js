// Règles du Puissance 4. Plateau : tableau de 42 cases, ligne 0 en haut.
// 0 = vide, 1 = joueur 1 (jaune), 2 = joueur 2 (rouge).
export const ROWS = 6;
export const COLS = 7;

// Les 69 alignements de 4 cases possibles, calculés une fois.
export const WINDOWS = (() => {
  const w = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of dirs) {
        const cells = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
          cells.push(rr * COLS + cc);
        }
        if (cells.length === 4) w.push(cells);
      }
  return w;
})();

export class Board {
  constructor() {
    this.cells = new Int8Array(ROWS * COLS);
    this.heights = new Int8Array(COLS); // nombre de pions par colonne
    this.moves = 0;
  }
  clone() {
    const b = new Board();
    b.cells.set(this.cells); b.heights.set(this.heights); b.moves = this.moves;
    return b;
  }
  canPlay(col) { return this.heights[col] < ROWS; }
  validMoves() { const m = []; for (let c = 0; c < COLS; c++) if (this.canPlay(c)) m.push(c); return m; }
  /** Joue dans la colonne et renvoie la ligne atteinte. */
  play(col, player) {
    const row = ROWS - 1 - this.heights[col];
    this.cells[row * COLS + col] = player;
    this.heights[col]++; this.moves++;
    return row;
  }
  undo(col) {
    this.heights[col]--; this.moves--;
    const row = ROWS - 1 - this.heights[col];
    this.cells[row * COLS + col] = 0;
  }
  /** Renvoie les 4 cases gagnantes du joueur, ou null. */
  winningLine(player) {
    for (const w of WINDOWS)
      if (this.cells[w[0]] === player && this.cells[w[1]] === player &&
          this.cells[w[2]] === player && this.cells[w[3]] === player) return w;
    return null;
  }
  isFull() { return this.moves === ROWS * COLS; }
}

export const other = (p) => (p === 1 ? 2 : 1);
