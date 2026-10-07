---
title: "Des bots qui bluffent au Perudo"
short: "Bots Perudo"
order: 3
summary: "Un jeu de dés menteur en ligne de commande, des bots aux stratégies différentes et des tournois pour les départager."
status: "Code disponible"
stack: ["Python", "Probabilités", "Simulation", "PyTorch"]
code: "https://github.com/KilianCO/perudo"
---

## Le projet

Le Perudo est un jeu de dés à information cachée : chaque joueur ne voit que ses propres dés et doit parier sur le total de la table, ou accuser le joueur précédent de bluffer. Contrairement au Puissance 4, la bonne décision ne se lit pas sur un plateau : elle dépend de probabilités et de ce que les annonces adverses laissent deviner.

## Ce que contient le dépôt

- **Le jeu** en ligne de commande, pour un nombre quelconque de joueurs et de dés.
- **Quatre bots** aux stratégies différentes : aléatoire, statistique, prudent et observateur.
- **Des tournois** qui font s'affronter les bots sur de nombreuses parties et enregistrent les résultats.
- **Un environnement d'entraînement**, première étape vers un agent appris par renforcement.

Le moteur de jeu part du projet public [RuairiD/perudo](https://github.com/RuairiD/perudo) ; les bots, les tournois et l'environnement d'entraînement sont mes ajouts.

## Et ensuite

Une démo jouable dans le navigateur est prévue, sur le même principe que le Puissance 4 : affronter les bots directement sur cette page.
