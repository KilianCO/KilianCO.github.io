---
title: "Un GAN qui transforme le son en vidéo"
short: "GAN audio → vidéo"
order: 2
summary: "Un réseau antagoniste génératif fait maison qui produit une vidéo à partir d'un extrait audio."
status: "Démo en préparation"
stack: ["Python", "PyTorch", "GAN", "Docker", "Hugging Face Spaces"]
demo:
  type: audio2video
  # Quand le modèle est en ligne : identifiant du Space Hugging Face, ex. "KilianCO/audio2video"
  space: ""
  endpoint: "/predict"
  max_seconds: 15
---

<!-- À compléter avec l'architecture réelle (générateur, discriminateur, features audio utilisées, données d'entraînement). -->

## Le projet

L'objectif : partir d'un signal audio et générer une séquence d'images cohérente avec lui. Le son est découpé en fenêtres, transformé en caractéristiques (spectrogramme), puis le générateur produit une image par fenêtre ; le discriminateur apprend à distinguer les vidéos générées des vraies.

Le code source de ce projet est privé : seule la démo est publique.

## Comment la démo fonctionnera

Un GAN vidéo est trop lourd pour tourner dans un navigateur. Le modèle sera donc servi par une petite API conteneurisée, hébergée gratuitement sur Hugging Face Spaces. Cette page envoie votre fichier audio à l'API et affiche la vidéo renvoyée.

L'hébergement gratuit met le serveur en veille après une période d'inactivité : la première génération peut prendre une minute le temps qu'il redémarre.

## Chaîne de déploiement

1. **Entraînement** en local, sauvegarde des poids à chaque checkpoint.
2. **Publication du modèle** sur le Hugging Face Hub, avec une carte de modèle et un numéro de version.
3. **Image Docker** de l'API d'inférence (Gradio), construite et testée dans GitHub Actions.
4. **Déploiement** de l'image sur un Space Hugging Face à chaque nouvelle version.
5. **Supervision** : temps de génération et erreurs suivis depuis les logs du Space.
