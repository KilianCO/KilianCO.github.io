// Thème clair / sombre et animation du plateau d'accueil.
(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) { /* stockage indisponible */ }
    });
  }

  // Le plateau d'accueil rejoue la partie affichée en statique, pion par pion.
  const board = document.getElementById("hero-board");
  if (!board || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const discs = board.querySelectorAll(".disc");
  const at = (r, c) => discs[r * 7 + c];
  const order = [[5,0],[5,1],[4,1],[5,2],[5,3],[4,2],[3,2],[4,3],[3,3],[2,3]];
  const win = [[5,0],[4,1],[3,2],[2,3]];

  const colors = order.map(([r, c]) => (at(r, c).classList.contains("is-y") ? "is-y" : "is-r"));
  order.forEach(([r, c]) => at(r, c).classList.remove("is-y", "is-r"));

  order.forEach(([r, c], i) => {
    setTimeout(() => at(r, c).classList.add(colors[i], "dropped"), 500 + i * 260);
  });
  setTimeout(() => win.forEach(([r, c]) => at(r, c).classList.add("is-win")), 500 + order.length * 260 + 250);
})();
