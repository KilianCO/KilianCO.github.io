// Démo des marches aléatoires renforcées.
// Les calculs sont faits en Python (module « marches » du dépôt du projet),
// exécuté dans le navigateur par Pyodide, dans un Web Worker.
const root = document.querySelector(".demo.mar");
const $ = (id) => document.getElementById(id);
const choixEl = $("mar-experience"), descriptionEl = $("mar-description");
const reglagesEl = $("mar-reglages"), lancerBtn = $("mar-lancer"), rejouerBtn = $("mar-rejouer");
const carteEl = $("mar-carte"), carteLabel = carteEl.closest("label");
const canvas = $("mar-canvas"), ctx = canvas.getContext("2d");
const statutEl = $("mar-statut"), mesuresEl = $("mar-mesures"), legendeEl = $("mar-legende");
const codeEl = $("mar-code"), codeBtn = $("mar-executer"), erreurEl = $("mar-erreur");

const LIMITES = { taille: [5, 400], pas: [10, 100000], individus: [1, 30], populations: [1, 3], repetitions: [1, 60] };
const PAS_TOTAL_MAX = 600000;

// Réglages proposés selon la nature de l'expérience : [clé, libellé, type, pas de saisie].
const CHAMPS = {
  commun: [
    ["taille", "Taille de la grille", "nombre", 1],
    ["pas", "Nombre de pas", "nombre", 100],
    ["alpha", "Renforcement additif α", "nombre", 0.05],
    ["beta", "Renforcement multiplicatif β", "nombre", 0.005],
  ],
  trajectoire: [
    ["populations", "Colonies", "nombre", 1],
    ["individus", "Marcheurs par colonie", "nombre", 1],
    ["delta", "Affaiblissement δ", "nombre", 0.05],
    ["ordre", "Ordre de passage", "ordre"],
    ["retour_interdit", "Retour interdit", "case"],
    ["arret_au_bord", "Arrêt au bord", "case"],
  ],
  courbe: [["repetitions", "Marches par point", "nombre", 1]],
};
const ORDRES = [["pas", "pas à pas"], ["individu", "individu par individu"], ["population", "colonie par colonie"]];

// Dégradés repris des figures du rapport : le temps va du premier ton au dernier.
const DEGRADE_TEMPS = ["#d7263d", "#f2b705", "#3fa34d", "#5bc0eb", "#1b3b8b"];
const DEGRADES_COLONIES = [["#f6a04d", "#c81d25"], ["#9bd770", "#1b7a3a"], ["#5b8def", "#7b2cbf"]];

let worker = null, catalogue = [], experience = null;
let sortie = null, animation = 0, occupe = false;

// ---------- Couleurs ----------
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function nuance(degrade, t) {
  const position = Math.min(Math.max(t, 0), 1) * (degrade.length - 1);
  const i = Math.min(Math.floor(position), degrade.length - 2), f = position - i;
  const a = hex(degrade[i]), b = hex(degrade[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}
const theme = (nom) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim();

// ---------- Réglages ----------
function champ(cle, libelle, type, pasSaisie, valeur) {
  const label = document.createElement("label");
  if (type === "case") {
    label.className = "mar-case";
    label.innerHTML = `<input type="checkbox" data-cle="${cle}"> ${libelle}`;
    label.firstChild.checked = Boolean(valeur);
  } else if (type === "ordre") {
    label.textContent = libelle;
    const select = document.createElement("select");
    select.dataset.cle = cle;
    select.append(...ORDRES.map(([v, texte]) => new Option(texte, v)));
    select.value = valeur ?? "individu";
    label.append(select);
  } else {
    label.textContent = libelle;
    const input = document.createElement("input");
    Object.assign(input, { type: "number", step: pasSaisie, value: valeur, min: 0 });
    input.dataset.cle = cle;
    label.append(input);
  }
  return label;
}

function afficherReglages() {
  const p = experience.parametres;
  const defauts = { populations: 1, individus: 1, delta: 1, ordre: "individu", retour_interdit: false, arret_au_bord: false };
  const champs = [...CHAMPS.commun];
  if (experience.nature === "trajectoire") champs.push(...CHAMPS.trajectoire);
  if (experience.nature === "courbe") {
    champs.push(...CHAMPS.courbe);
    // Le paramètre que l'expérience fait varier n'est pas réglable.
    champs.splice(champs.findIndex(([cle]) => cle === experience.variable), 1);
  }
  reglagesEl.replaceChildren(...champs.map(([cle, libelle, type, pasSaisie]) =>
    champ(cle, libelle, type, pasSaisie, cle === "repetitions" ? experience.repetitions : p[cle] ?? defauts[cle])));
  const graine = champ("graine", "Graine aléatoire (vide : au hasard)", "nombre", 1, "");
  reglagesEl.append(graine);
  descriptionEl.textContent = `${experience.description} (Figure ${experience.figure} du rapport.)`;
  carteLabel.hidden = experience.nature !== "trajectoire";
  ecrireCode();
}

function lireReglages() {
  const surcharges = {}, extras = {};
  for (const el of reglagesEl.querySelectorAll("[data-cle]")) {
    const cle = el.dataset.cle;
    let valeur = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : el.value === "" ? null : Number(el.value);
    if (cle in LIMITES && valeur !== null) valeur = Math.round(Math.min(Math.max(valeur, LIMITES[cle][0]), LIMITES[cle][1]));
    if (cle === "graine" || cle === "repetitions") extras[cle] = valeur;
    else if (valeur !== null && !Number.isNaN(valeur)) surcharges[cle] = valeur;
  }
  // Les points de départ de l'expérience ne valent que pour son nombre de colonies et sa grille.
  const p = experience.parametres;
  if (p.departs && (surcharges.populations ?? 1) === p.populations) {
    const echelle = surcharges.taille / p.taille;
    surcharges.departs = p.departs.map(([x, y]) => [Math.round(x * echelle), Math.round(y * echelle)]);
  }
  if (experience.nature === "trajectoire") {
    const marcheurs = (surcharges.populations ?? 1) * (surcharges.individus ?? 1);
    if (surcharges.pas * marcheurs > PAS_TOTAL_MAX) surcharges.pas = Math.floor(PAS_TOTAL_MAX / marcheurs);
  }
  return { surcharges, repetitions: extras.repetitions ?? null, graine: extras.graine ?? null };
}

/** Le code Python équivalent aux réglages : le visiteur peut le modifier et l'exécuter. */
function ecrireCode() {
  const { surcharges, repetitions, graine } = lireReglages();
  const py = (v) => v === true ? "True" : v === false ? "False" : v === null ? "None" : JSON.stringify(v);
  const lignes = Object.entries(surcharges).map(([cle, v]) => `        "${cle}": ${py(v)},`);
  codeEl.value = [
    "from marches import executer, simuler, simuler_1d, balayer",
    "",
    "sortie = executer(",
    `    "${experience.id}",`,
    "    {", ...lignes, "    },",
    ...(experience.nature === "courbe" ? [`    repetitions=${py(repetitions)},`] : []),
    `    graine=${py(graine)},`,
    ...(experience.nature === "courbe" ? ["    progres=progres,"] : []),
    ")",
    "",
    "# Vous pouvez aussi écrire votre propre expérience, par exemple :",
    "# sortie = simuler(taille=120, pas=20000, alpha=2.0, retour_interdit=True)",
    '# sortie = balayer("alpha", [0, 1, 2, 4], "distance_max", taille=150, pas=3000)',
  ].join("\n");
}

// ---------- Tracés ----------
function preparer() {
  const cote = Math.min(canvas.parentElement.clientWidth, 640), dpr = window.devicePixelRatio || 1;
  canvas.style.width = canvas.style.height = `${cote}px`;
  canvas.width = canvas.height = Math.round(cote * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cote, cote);
  ctx.lineJoin = ctx.lineCap = "round";
  return cote;
}

function tracerTrajectoires(fractionDebut, fractionFin, cote) {
  const taille = sortie.parametres.taille, marge = 6, echelle = (cote - 2 * marge) / (taille - 1);
  const X = (x) => marge + x * echelle, Y = (y) => cote - marge - y * echelle;
  const colonies = sortie.parametres.populations > 1;
  ctx.lineWidth = Math.max(1, Math.min(2.2, echelle * 0.9));
  const TRANCHES = 60;
  for (const marche of sortie.marches) {
    const n = marche.x.length - 1;
    if (n < 1) continue;
    const degrade = colonies ? DEGRADES_COLONIES[marche.population % 3] : DEGRADE_TEMPS;
    const debut = Math.floor(fractionDebut * n), fin = Math.min(n, Math.ceil(fractionFin * n));
    for (let k = Math.floor((debut / n) * TRANCHES); k < TRANCHES; k++) {
      const a = Math.max(debut, Math.floor((k / TRANCHES) * n)), b = Math.min(fin, Math.floor(((k + 1) / TRANCHES) * n));
      if (a >= fin) break;
      if (b <= a) continue;
      ctx.strokeStyle = nuance(degrade, k / (TRANCHES - 1));
      ctx.beginPath();
      ctx.moveTo(X(marche.x[a]), Y(marche.y[a]));
      for (let i = a + 1; i <= b; i++) ctx.lineTo(X(marche.x[i]), Y(marche.y[i]));
      ctx.stroke();
    }
  }
  if (fractionFin >= 1) {
    // Points de départ, puis point d'arrivée de chaque marcheur.
    for (const marche of sortie.marches) {
      const n = marche.x.length - 1;
      ctx.fillStyle = colonies ? DEGRADES_COLONIES[marche.population % 3][1] : DEGRADE_TEMPS[4];
      ctx.beginPath(); ctx.arc(X(marche.x[n]), Y(marche.y[n]), 3, 0, 2 * Math.PI); ctx.fill();
    }
    sortie.departs.forEach(([x, y]) => {
      ctx.fillStyle = theme("--ink"); ctx.strokeStyle = theme("--surface"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });
  }
}

function cadre(cote) {
  ctx.strokeStyle = theme("--line"); ctx.lineWidth = 1;
  ctx.strokeRect(5.5, 5.5, cote - 11, cote - 11);
}

/** Carte des passages : plus un sommet a été visité, plus il est sombre. */
function tracerCarte(cote) {
  const taille = sortie.parametres.taille, marge = 6, pasCase = (cote - 2 * marge) / taille;
  const colonies = sortie.parametres.populations > 1;
  const comptes = sortie.marches.reduce((acc, marche) => {
    const grille = (acc[marche.population] ??= new Map());
    for (let i = 0; i < marche.x.length; i++) {
      const cle = marche.x[i] * taille + marche.y[i];
      grille.set(cle, (grille.get(cle) ?? 0) + 1);
    }
    return acc;
  }, {});
  for (const [population, grille] of Object.entries(comptes)) {
    const max = Math.log1p(Math.max(...grille.values()));
    const degrade = colonies ? DEGRADES_COLONIES[population % 3] : ["#5bc0eb", "#d7263d"];
    for (const [cle, compte] of grille) {
      const x = Math.floor(cle / taille), y = cle % taille, intensite = Math.log1p(compte) / max;
      ctx.globalAlpha = 0.25 + 0.75 * intensite;
      ctx.fillStyle = nuance(degrade, intensite);
      ctx.fillRect(marge + x * pasCase, cote - marge - (y + 1) * pasCase, Math.ceil(pasCase), Math.ceil(pasCase));
    }
  }
  ctx.globalAlpha = 1;
}

/** Repère gradué ; renvoie les fonctions de conversion données -> pixels. */
function repere(cote, xMin, xMax, yMin, yMax, titreX, titreY) {
  const g = 56, d = 14, h = 16, b = 44;
  if (yMax === yMin) yMax = yMin + 1;
  if (xMax === xMin) xMax = xMin + 1;
  const X = (x) => g + ((x - xMin) / (xMax - xMin)) * (cote - g - d);
  const Y = (y) => cote - b - ((y - yMin) / (yMax - yMin)) * (cote - b - h);
  const format = (v) => Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : Number(v.toFixed(Math.abs(v) < 10 ? 2 : 0)).toString();
  ctx.font = "12px system-ui, sans-serif"; ctx.fillStyle = theme("--muted"); ctx.strokeStyle = theme("--line"); ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = yMin + ((yMax - yMin) * i) / 5, x = xMin + ((xMax - xMin) * i) / 5;
    ctx.beginPath(); ctx.moveTo(g, Y(y)); ctx.lineTo(cote - d, Y(y)); ctx.stroke();
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(format(y), g - 6, Y(y));
    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(format(x), X(x), cote - b + 6);
  }
  ctx.fillStyle = theme("--ink");
  ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(titreX, (g + cote - d) / 2, cote - 4);
  ctx.save(); ctx.translate(12, (cote - b + h) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "middle"; ctx.fillText(titreY, 0, 0); ctx.restore();
  return { X, Y };
}

function tracerLigne(fraction, cote) {
  const positions = sortie.positions, n = positions.length - 1;
  const { X, Y } = repere(cote, 0, n, 0, sortie.parametres.taille ? sortie.parametres.taille - 1 : Math.max(...positions), "Temps (pas)", "Position");
  const fin = Math.floor(fraction * n), TRANCHES = 60;
  ctx.lineWidth = 1.2;
  for (let k = 0; k < TRANCHES; k++) {
    const a = Math.floor((k / TRANCHES) * n), b = Math.min(fin, Math.floor(((k + 1) / TRANCHES) * n));
    if (a >= fin) break;
    ctx.strokeStyle = nuance(DEGRADE_TEMPS, k / (TRANCHES - 1));
    ctx.beginPath(); ctx.moveTo(X(a), Y(positions[a]));
    for (let i = a + 1; i <= b; i++) ctx.lineTo(X(i), Y(positions[i]));
    ctx.stroke();
  }
}

/** Arrondit vers le haut à une valeur « ronde » (1, 2, 2,5 ou 5 fois une puissance de 10). */
function arrondiHaut(v) {
  if (v <= 0) return 1;
  const puissance = 10 ** Math.floor(Math.log10(v)), m = v / puissance;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * puissance;
}

const COULEURS_SERIES = ["#1b3b8b", "#d7263d", "#3fa34d", "#f2b705"];
function tracerCourbes(cote) {
  const series = sortie.series, xs = series[0].valeurs;
  const tout = series.flatMap((s) => s.moyennes);
  const { X, Y } = repere(cote, Math.min(...xs), Math.max(...xs), 0, arrondiHaut(Math.max(...tout) * 1.02), sortie.variable === "pas" ? "Nombre de pas" : sortie.variable, sortie.libelle_mesure);
  series.forEach((serie, rang) => {
    ctx.strokeStyle = ctx.fillStyle = COULEURS_SERIES[rang % 4]; ctx.lineWidth = 2.2;
    ctx.beginPath();
    serie.valeurs.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(serie.moyennes[i])) : ctx.moveTo(X(x), Y(serie.moyennes[i]))));
    ctx.stroke();
    serie.valeurs.forEach((x, i) => { ctx.beginPath(); ctx.arc(X(x), Y(serie.moyennes[i]), 3.2, 0, 2 * Math.PI); ctx.fill(); });
  });
}

// ---------- Légende et mesures ----------
function pastille(couleur, texte) {
  const item = document.createElement("li");
  item.innerHTML = `<span class="mar-pastille" style="background:${couleur}"></span>`;
  item.append(texte);
  return item;
}

function decrireSortie() {
  const nombre = (v) => Math.round(v).toLocaleString("fr-FR");
  const items = [], phrases = [];
  if (sortie.nature === "courbe") {
    sortie.series.forEach((s, rang) => items.push(pastille(COULEURS_SERIES[rang % 4], s.nom)));
    phrases.push(`Chaque point est la moyenne de ${sortie.repetitions} marches.`);
    const atteint = sortie.series[0].atteint;
    if (atteint) phrases.push(`Part des marches qui touchent le bord pour la plus grande valeur : ${sortie.series.map((s) => `${Math.round(100 * s.atteint.at(-1))} % (${s.nom.toLowerCase()})`).join(", ")}.`);
  } else if (sortie.nature === "ligne") {
    items.push(pastille(`linear-gradient(90deg, ${DEGRADE_TEMPS.join(",")})`, "du début à la fin de la marche"));
    phrases.push(`${nombre(sortie.positions.length - 1)} pas, ${new Set(sortie.positions).size} positions visitées.`);
    if (sortie.arret === "renforcement") phrases.push("La marche s'est arrêtée : un poids a dépassé la plus grande valeur représentable.");
  } else {
    const p = sortie.parametres, marches = sortie.marches;
    if (p.populations > 1) {
      for (let k = 0; k < p.populations; k++)
        items.push(pastille(`linear-gradient(90deg, ${DEGRADES_COLONIES[k].join(",")})`, `colonie ${"ABC"[k]} : ${nombre(sortie.visites_par_population[k])} sommets`));
    } else items.push(pastille(`linear-gradient(90deg, ${DEGRADE_TEMPS.join(",")})`, "du début à la fin de la marche"));
    phrases.push(`${nombre(sortie.sommets_visites)} sommets visités, soit ${(100 * sortie.proportion_visitee).toFixed(1).replace(".", ",")} % de la grille.`);
    if (marches.length === 1) {
      const m = marches[0];
      phrases.push(`${nombre(m.pas)} pas ; distance maximale au départ : ${m.distance_max.toFixed(1).replace(".", ",")}.`);
    } else phrases.push(`${marches.length} marcheurs ; distance maximale moyenne au départ : ${(marches.reduce((s, m) => s + m.distance_max, 0) / marches.length).toFixed(1).replace(".", ",")}.`);
    const bord = marches.filter((m) => m.arret === "bord").length, blocage = marches.filter((m) => m.arret === "renforcement").length;
    if (bord) phrases.push(marches.length === 1 ? `Bord touché au pas ${nombre(marches[0].pas)}.` : `${bord} marcheurs ont touché le bord.`);
    if (blocage) phrases.push("Marche arrêtée : un poids a dépassé la plus grande valeur représentable, le marcheur est enfermé.");
  }
  legendeEl.replaceChildren(...items);
  mesuresEl.textContent = phrases.join(" ");
}

// ---------- Affichage d'un résultat ----------
function afficher(animer = true) {
  cancelAnimationFrame(animation);
  if (!sortie) return;
  const cote = preparer();
  carteLabel.hidden = sortie.nature !== "trajectoire";
  rejouerBtn.disabled = sortie.nature === "courbe";
  decrireSortie();

  if (sortie.nature === "courbe") { tracerCourbes(cote); return; }
  if (sortie.nature === "trajectoire" && carteEl.checked) { cadre(cote); tracerCarte(cote); return; }

  const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duree = animer && !reduit ? 3200 : 0, depart = performance.now();
  let precedent = 0;
  if (sortie.nature === "trajectoire") cadre(cote);
  const image = (maintenant) => {
    const fraction = duree ? Math.min(1, (maintenant - depart) / duree) : 1;
    if (sortie.nature === "ligne") { preparer(); tracerLigne(fraction, cote); }
    else tracerTrajectoires(precedent, fraction, cote);
    precedent = fraction;
    if (fraction < 1) animation = requestAnimationFrame(image);
  };
  animation = requestAnimationFrame(image);
}

// ---------- Échanges avec Python ----------
function occuper(etat, texte) {
  occupe = etat;
  lancerBtn.disabled = codeBtn.disabled = etat;
  if (texte !== undefined) statutEl.textContent = texte;
}

function lancer() {
  if (occupe || !experience) return;
  erreurEl.textContent = "";
  occuper(true, "Calcul en cours…");
  worker.postMessage({ type: "executer", id: experience.id, ...lireReglages() });
}

function executerCode() {
  if (occupe) return;
  erreurEl.textContent = "";
  occuper(true, "Exécution du code…");
  worker.postMessage({ type: "code", source: codeEl.value });
}

function recevoir({ data }) {
  if (data.type === "pret") {
    catalogue = data.catalogue;
    const groupes = { ligne: "Une dimension", trajectoire: "Sur la grille", courbe: "Statistiques" };
    choixEl.replaceChildren(...Object.entries(groupes).map(([nature, titre]) => {
      const groupe = document.createElement("optgroup");
      groupe.label = titre;
      groupe.append(...catalogue.filter((e) => e.nature === nature).map((e) => new Option(e.titre.replace(/^.*? · /, "").replace(/^./, (c) => c.toUpperCase()), e.id)));
      return groupe;
    }));
    choixEl.value = root.dataset.experience || "grille_additive";
    choisir();
    occuper(false, "");
    lancer();
  } else if (data.type === "progres") {
    statutEl.textContent = `Calcul en cours… ${Math.round(100 * data.fraction)} %`;
  } else if (data.type === "resultat") {
    sortie = data.sortie;
    occuper(false, "");
    afficher();
  } else if (data.type === "erreur") {
    occuper(false, "");
    erreurEl.textContent = data.message;
    if (!catalogue.length) statutEl.textContent = "Python n'a pas pu être chargé dans ce navigateur.";
  }
}

function choisir() {
  experience = catalogue.find((e) => e.id === choixEl.value);
  afficherReglages();
}

choixEl.addEventListener("change", () => { choisir(); lancer(); });
reglagesEl.addEventListener("change", ecrireCode);
lancerBtn.addEventListener("click", lancer);
rejouerBtn.addEventListener("click", () => afficher(true));
carteEl.addEventListener("change", () => afficher(false));
codeBtn.addEventListener("click", executerCode);
window.addEventListener("resize", () => afficher(false));

occuper(true, "Chargement de Python dans le navigateur (une dizaine de mégaoctets la première fois)…");
try {
  worker = new Worker(root.dataset.worker);
  worker.onmessage = recevoir;
  worker.onerror = () => { occuper(true, "Python n'a pas pu être chargé dans ce navigateur."); };
  worker.postMessage({ type: "init", base: new URL(root.dataset.pyBase, location.href).href });
} catch (erreur) {
  statutEl.textContent = "Ce navigateur ne permet pas d'exécuter la simulation.";
}
