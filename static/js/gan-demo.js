// Démo GAN audio → vidéo. Le modèle tourne sur un Space Hugging Face (Gradio) ;
// cette page lui envoie le fichier audio et affiche la vidéo renvoyée.
// Pour l'activer : renseigner demo.space dans content/projets/gan-audio-video.md.
const root = document.querySelector(".demo.a2v");
const space = root.dataset.space;
const endpoint = root.dataset.endpoint || "/predict";
const maxSeconds = Number(root.dataset.maxSeconds || 15);
const MAX_BYTES = 10 * 1024 * 1024;

const drop = document.getElementById("a2v-drop");
const input = document.getElementById("a2v-file");
const audio = document.getElementById("a2v-audio");
const runBtn = document.getElementById("a2v-run");
const statusEl = document.getElementById("a2v-status");
const video = document.getElementById("a2v-video");

let file = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

if (!space) {
  setStatus("La génération en ligne arrive bientôt : le modèle est en cours de déploiement. Vous pouvez déjà écouter votre fichier ici.");
}

async function durationOf(f) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buf = await ctx.decodeAudioData(await f.arrayBuffer());
    return buf.duration;
  } finally {
    ctx.close();
  }
}

async function accept(f) {
  file = null;
  runBtn.disabled = true;
  video.hidden = true;
  if (!f) return;
  if (!f.type.startsWith("audio/")) return setStatus("Ce fichier n'est pas un fichier audio. Choisissez un WAV, MP3 ou OGG.", true);
  if (f.size > MAX_BYTES) return setStatus("Ce fichier dépasse 10 Mo. Choisissez un extrait plus court.", true);
  let seconds;
  try { seconds = await durationOf(f); } catch {
    return setStatus("Ce fichier audio n'a pas pu être lu. Essayez un autre format.", true);
  }
  if (seconds > maxSeconds) {
    return setStatus(`Cet extrait dure ${Math.round(seconds)} secondes. Choisissez un extrait de ${maxSeconds} secondes maximum.`, true);
  }
  file = f;
  audio.src = URL.createObjectURL(f);
  audio.hidden = false;
  runBtn.disabled = !space;
  setStatus(space ? `« ${f.name} » est prêt (${seconds.toFixed(1)} s).` : statusEl.textContent);
}

input.addEventListener("change", () => accept(input.files[0]));
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("is-over")));
drop.addEventListener("drop", (e) => { e.preventDefault(); accept(e.dataTransfer.files[0]); });

runBtn.addEventListener("click", async () => {
  if (!file || !space) return;
  runBtn.disabled = true;
  video.hidden = true;
  setStatus("Connexion au serveur. S'il était en veille, le réveil peut prendre jusqu'à une minute…");
  try {
    const { Client, handle_file } = await import("https://cdn.jsdelivr.net/npm/@gradio/client@1/dist/index.min.js");
    const app = await Client.connect(space);
    setStatus("Génération de la vidéo…");
    const result = await app.predict(endpoint, [handle_file(file)]);
    const out = result.data[0];
    video.src = typeof out === "string" ? out : out.url ?? out.video?.url;
    video.hidden = false;
    setStatus("Vidéo générée.");
  } catch (err) {
    console.error(err);
    setStatus("La génération a échoué. Réessayez dans un instant ; si le problème persiste, le serveur est peut-être en maintenance.", true);
  } finally {
    runBtn.disabled = false;
  }
});
