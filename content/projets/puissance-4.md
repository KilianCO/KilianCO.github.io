---
title: "Une IA qui joue au Puissance 4"
short: "IA Puissance 4"
order: 1
summary: "Un agent entraîné par apprentissage par renforcement, jouable directement dans le navigateur."
status: "Démo jouable"
stack: ["Python", "Apprentissage par renforcement", "PyTorch", "ONNX", "GitHub Actions"]
code: "https://github.com/KilianCO/puissance-4"
demo:
  type: connect4
  # Quand le modèle est exporté : chemin du fichier ONNX (servi par le site ou une GitHub Release)
  model_url: ""
  model_version: ""
---

<!-- À compléter avec les détails réels de ton entraînement (algorithme, nombre de parties, résultats). -->

## Le projet

Le Puissance 4 est un bon terrain pour l'apprentissage par renforcement : des règles simples, un espace d'états immense (environ 4,5 × 10¹² positions) et une récompense qui n'arrive qu'en fin de partie. L'agent apprend en jouant contre lui-même, sans aucune règle stratégique codée à la main.

## Comment la démo fonctionne

Le modèle est exporté au format ONNX et exécuté **directement dans votre navigateur** avec ONNX Runtime Web. Aucun serveur, aucun coût d'hébergement, aucune latence réseau : chaque coup est calculé sur votre machine.

En attendant la mise en ligne du modèle entraîné, la démo utilise un adversaire de référence (minimax avec élagage alpha-bêta). C'est aussi la baseline contre laquelle le modèle est évalué avant chaque déploiement.

## Chaîne de déploiement

1. **Entraînement** en local, suivi des métriques d'entraînement.
2. **Export** du réseau de politique au format ONNX.
3. **Évaluation automatique** dans GitHub Actions : le modèle affronte le minimax sur une série de parties ; s'il passe sous le taux de victoire minimal, le déploiement est bloqué.
4. **Versionnement** du modèle comme artefact d'une GitHub Release.
5. **Publication** : le site est reconstruit et pointe vers la nouvelle version du modèle.
