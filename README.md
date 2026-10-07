# Site personnel de Kilian Collet

Portfolio statique : une page d'accueil (profil, parcours, expérience, stack, contact), une page par projet avec démo intégrée, et le CV en PDF.

- **Gratuit** : hébergé sur GitHub Pages, construit par GitHub Actions.
- **Sans framework JS** : un générateur Python de ~120 lignes (Jinja2 + Markdown), du HTML/CSS et du JavaScript natif.
- **Prêt pour le MLOps** : la démo Puissance 4 charge un modèle ONNX dans le navigateur, la démo GAN appelle une API hébergée sur Hugging Face Spaces.

## Structure

```
content/site.yaml           profil, parcours, expérience, stack, liens
content/projets/*.md        une page par projet (en-tête YAML + texte Markdown)
templates/                  mise en page (Jinja2)
static/                     CSS, JS, photo, CV, favicon (copiés tels quels)
static/js/puissance4/       moteur de jeu, agents (minimax, ONNX), interface
static/js/gan-demo.js       envoi de l'audio au Space Hugging Face
deploy/gan-space/           modèle de Space Gradio pour servir le GAN
tests/test_site.py          build + vérification des liens internes
.github/workflows/          build, tests et déploiement GitHub Pages
build.py                    le générateur
```

## Choix techniques

| Choix | Raison |
|---|---|
| Site statique, générateur Python maison | Quelques pages seulement : pas de framework à maintenir, un code lisible en dix minutes, des pages qui se chargent vite. |
| Contenu en YAML et Markdown | Ajouter un projet revient à ajouter un fichier ; la mise en page reste séparée du texte. |
| GitHub Pages + GitHub Actions | Hébergement gratuit, HTTPS inclus. Chaque push lance les tests puis publie ; un test en échec bloque la mise en ligne. |
| Modèle du Puissance 4 exécuté dans le navigateur | Le réseau (environ 1 Mo, format ONNX) tourne chez le visiteur avec ONNX Runtime Web : aucun serveur, aucun coût, aucune latence réseau. |
| Modèle du GAN servi par une API externe | Trop lourd pour un navigateur : la page appelle un Space Hugging Face. |
| Un dépôt par projet | Le site ne contient aucun code d'entraînement. Chaque projet exporte un artefact (fichier de modèle ou API) que sa page référence. |
| Repli automatique | Si le modèle ne se charge pas, la démo Puissance 4 retombe sur un adversaire minimax. |

Les tests construisent le site et vérifient que les pages existent, qu'aucun lien interne n'est cassé et que le fichier du modèle référencé est présent.

## Travailler en local

```bash
py -3.11 -m venv .venv && .venv\Scripts\activate    # Python 3.11 ; Linux/macOS : source .venv/bin/activate
pip install -r requirements.txt
python build.py --serve       # http://localhost:8000
pytest -q
```

## Mise en ligne (une seule fois)

1. Crée un dépôt public nommé **`KilianCO.github.io`** et pousse ce dossier sur la branche `main`.
2. Dans le dépôt : *Settings > Pages > Build and deployment > Source* : **GitHub Actions**.
3. Le site est publié sur `https://kilianco.github.io` en une à deux minutes. Chaque push le redéploie.

Si tu préfères un autre nom de dépôt (ex. `portfolio`), mets `base_path: "/portfolio"` et `url` en conséquence dans `content/site.yaml`.

Nom de domaine perso (optionnel, ~10 €/an) : ajoute un fichier `static/CNAME` contenant le domaine, puis configure le DNS chez ton registrar.

## Ajouter un projet

Crée `content/projets/mon-projet.md` :

```markdown
---
title: "Titre affiché"
order: 3
summary: "Une phrase."
status: "Code disponible"
stack: ["Python", "Prefect"]
code: "https://github.com/KilianCO/mon-projet"   # optionnel : sans ce champ, aucun lien vers le code
---

## Le projet
...
```

La page `/projets/mon-projet/` et la carte sur l'accueil sont générées automatiquement.

## Brancher le modèle Puissance 4

La démo tourne aujourd'hui contre un minimax alpha-bêta (aussi utile comme baseline d'évaluation). Pour passer au modèle entraîné :

1. **Exporter en ONNX** en respectant ce contrat :
   - entrée `float32 [1, 2, 6, 7]` : plan 0 = pions du joueur qui doit jouer, plan 1 = pions adverses, ligne 0 en haut ;
   - sortie `float32 [1, 7]` : un score (logit) par colonne.

   Avec PyTorch : `torch.onnx.export(reseau, entree_exemple, "puissance4.onnx")`
   (si ton encodage est différent, adapte `OnnxAgent.choose` dans `static/js/puissance4/agents.js`).
2. **Publier** le fichier : soit dans `static/models/puissance4.onnx` (simple), soit comme artefact d'une GitHub Release récupéré au build (étape déjà préparée, commentée, dans `.github/workflows/deploy.yml`).
3. **Configurer** dans `content/projets/puissance-4.md` :
   ```yaml
   demo:
     type: connect4
     model_url: "/models/puissance4.onnx"
     model_version: "v1"
   ```

Si le modèle ne se charge pas, la page retombe automatiquement sur le minimax. Pour aller plus loin côté MLOps : ajouter dans la CI un script qui fait jouer le modèle contre le minimax et bloque le déploiement sous un taux de victoire minimal.

## Brancher le GAN audio → vidéo

1. Crée un Space sur huggingface.co (SDK **Gradio**, matériel CPU gratuit).
2. Copie `deploy/gan-space/app.py` dedans, complète `generate()`, ajoute un `requirements.txt` (torch, gradio, imageio-ffmpeg…). Les poids peuvent vivre sur le Hugging Face Hub et être téléchargés au démarrage.
3. Dans `content/projets/gan-audio-video.md`, renseigne `space: "KilianCO/nom-du-space"`, puis change `status` en `"Démo jouable"`.

Le bouton « Générer la vidéo » s'active alors tout seul. Les Spaces gratuits se mettent en veille après inactivité : la page prévient l'utilisateur que le premier appel peut prendre une minute.

## Confidentialité

Le CV en PDF contient ton adresse et ton numéro de téléphone, et sera public. Le site lui-même n'affiche que l'e-mail, LinkedIn et GitHub. Envisage une version du CV sans adresse ni téléphone pour `static/cv/`.
