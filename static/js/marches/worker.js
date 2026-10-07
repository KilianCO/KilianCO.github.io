// Exécute le module Python « marches » dans le navigateur, avec Pyodide.
// Tourne dans un Web Worker : les calculs ne figent pas la page.
//
// Messages reçus :
//   { type: "init", base }                      charge Python et le module
//   { type: "executer", id, surcharges, repetitions, graine }
//   { type: "code", source }                    exécute du code libre
// Messages envoyés :
//   { type: "pret", catalogue } | { type: "progres", fraction }
//   { type: "resultat", sortie } | { type: "erreur", message }
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const FICHIERS = ["__init__.py", "simulation.py", "experiences.py"];

let pyodide = null;

async function init(base) {
  importScripts(PYODIDE + "pyodide.js");
  pyodide = await loadPyodide({ indexURL: PYODIDE });

  // Le module est le même fichier que dans le dépôt du projet.
  pyodide.FS.mkdirTree("/projet/marches");
  for (const fichier of FICHIERS) {
    const reponse = await fetch(base + fichier);
    if (!reponse.ok) throw new Error(`Module introuvable : ${fichier}`);
    pyodide.FS.writeFile("/projet/marches/" + fichier, await reponse.text());
  }

  pyodide.globals.set("signaler_progres", (fraction) => postMessage({ type: "progres", fraction }));
  pyodide.runPython(`
import json, sys
sys.path.insert(0, "/projet")
import marches
from marches import *

def _executer(identifiant, surcharges, repetitions, graine):
    sortie = marches.executer(
        identifiant,
        json.loads(surcharges),
        repetitions=repetitions,
        graine=graine,
        progres=signaler_progres,
    )
    return json.dumps(sortie)

def _code(source):
    espace = {"progres": signaler_progres}
    exec("from marches import *", espace)
    exec(source, espace)
    if "sortie" not in espace:
        raise NameError("Le code doit définir une variable « sortie ».")
    return json.dumps(marches.normaliser(espace["sortie"]))
`);
  return pyodide.runPython("json.dumps(marches.catalogue())");
}

/** Ne garde que la dernière ligne utile d'une erreur Python. */
function messageErreur(erreur) {
  const lignes = String(erreur && erreur.message ? erreur.message : erreur).trim().split("\n");
  return lignes[lignes.length - 1];
}

onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const catalogue = await init(data.base);
      postMessage({ type: "pret", catalogue: JSON.parse(catalogue) });
    } else if (data.type === "executer") {
      const json = pyodide.globals.get("_executer")(
        data.id, JSON.stringify(data.surcharges), data.repetitions ?? undefined, data.graine ?? undefined);
      postMessage({ type: "resultat", sortie: JSON.parse(json) });
    } else if (data.type === "code") {
      const json = pyodide.globals.get("_code")(data.source);
      postMessage({ type: "resultat", sortie: JSON.parse(json) });
    }
  } catch (erreur) {
    postMessage({ type: "erreur", message: messageErreur(erreur) });
  }
};
