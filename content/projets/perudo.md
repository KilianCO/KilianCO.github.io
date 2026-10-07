---
title: "Des bots qui bluffent au Perudo"
short: "Bots Perudo"
order: 3
summary: "Un jeu de dés et de bluff, où l'information est cachée : six bots programmés et un réseau de neurones, à affronter ou à regarder jouer."
status: "Démo jouable"
stack: ["Python", "Probabilités", "Apprentissage par renforcement", "PyTorch", "ONNX"]
code: "https://github.com/KilianCO/Perudo"
demo:
  type: perudo
  # Fichier ONNX exporté depuis le dépôt du projet et servi par le site
  model_url: "/models/perudo.onnx"
  model_version: "v1"
---

## Le jeu

Chaque joueur lance ses dés en secret. À tour de rôle, on annonce un pari sur l'ensemble des dés de la table, par exemple « au moins trois dés de valeur 4 », ou on met en doute le pari précédent en disant *dudo*. Les dés sont alors révélés, et celui qui s'est trompé perd un dé. Les as comptent pour toutes les valeurs. Le dernier joueur à qui il reste des dés gagne.

La démo se joue en duel, cinq dés chacun. Choisissez « Vous » pour le joueur du bas et affrontez un bot ; ou mettez un bot de chaque côté et regardez la partie, dés visibles.

## Pourquoi ce jeu

Au Puissance 4, tout le monde voit le plateau : la bonne décision se calcule. Au Perudo, on ne voit que ses propres dés. Il faut raisonner en probabilités, et tenir compte de ce que les paris de l'adversaire révèlent de sa main. C'est la même famille de problèmes que le poker, et les méthodes qui marchent à information complète n'y suffisent plus.

## Les joueurs

- **Quatre bots à règle simple** (Aléatoire, Observateur, Statistique, Prudent) : les premiers écrits pour ce projet, conservés avec leurs défauts comme points de comparaison. Le bot Statistique, par exemple, oublie que les as sont des jokers.
- **Deux bots probabilistes** : ils calculent la probabilité exacte de chaque pari (loi binomiale, as compris) et n'annoncent que des paris très probables. L'un choisit le plus audacieux, l'autre le plus discret. Ils ne bluffent pas.
- **Un réseau de neurones** entraîné par renforcement sur 40 000 duels, contre lui-même et contre les autres bots. Il voit ses dés et tous les paris de la manche, y compris ceux de l'adversaire.

## Le classement

Tous les joueurs se sont affrontés deux à deux, 2 000 duels par confrontation, chacun ouvrant la moitié des parties. 200 points d'écart au classement Elo correspondent à environ 76 % de victoires attendues.

| Rang | Joueur | Méthode | Elo |
|---|---|---|---|
| 1 | Probabiliste audacieux | calcul exact | 1836 |
| 2 | Probabiliste discret | calcul exact | 1833 |
| 3 | **Réseau de neurones** | apprentissage | 1804 |
| 4 | Prudent | règle simple | 1657 |
| 5 | Statistique | règle simple | 1390 |
| 6 | Observateur | règle simple | 1378 |
| 7 | Aléatoire | hasard | 603 |

## Ce que le classement ne dit pas

En confrontation directe, le réseau **bat les deux bots probabilistes** : 60 % de victoires contre l'audacieux, 56 % contre le discret. Il a appris à tirer parti d'adversaires qui ne bluffent jamais.

S'il n'est que troisième, c'est qu'il perd encore un quart de ses duels contre les bots les plus faibles (24 % contre l'Observateur, 29 % contre le Statistique), que les probabilistes écrasent à plus de 96 %. Il les a très peu rencontrés pendant son entraînement, et leurs paris inhabituels le déroutent : un modèle appris est bon là où il s'est entraîné.

Autre résultat : aucun style n'est le meilleur dans l'absolu. Le probabiliste discret bat l'audacieux (57 %), alors que l'audacieux fait mieux contre presque tous les autres.

## Comment la démo fonctionne

Le moteur du jeu et les bots sont réécrits en JavaScript ; le réseau est exporté au format ONNX et exécuté dans votre navigateur. Aucun serveur n'intervient. Pour que les deux versions ne divergent pas, 400 situations générées par le code Python sont rejouées dans le navigateur : les bots y prennent exactement les mêmes décisions.

## Limites et suite

Le réseau joue toujours le même coup dans la même situation : un adversaire attentif peut l'exploiter, ce qui est une vraie faiblesse dans un jeu de bluff. La méthode de référence pour ces jeux, la minimisation du regret (CFR), celle des IA de poker, apprend au contraire à mélanger ses coups : c'est la suite envisagée, avec un entraînement face à des adversaires plus variés.

Les règles suivent une variante où un pari peut baisser la quantité s'il monte la valeur ; les résultats ne se transposent pas tels quels au Perudo classique.
