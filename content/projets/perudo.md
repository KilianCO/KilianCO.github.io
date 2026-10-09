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
  model_version: "v2"
---

## Le jeu

Chaque joueur lance ses dés en secret. À tour de rôle, on annonce un pari sur l'ensemble des dés de la table, par exemple « au moins trois dés de valeur 4 », ou on met en doute le pari précédent en disant *dudo*. Les dés sont alors révélés, et celui qui s'est trompé perd un dé. Les as comptent pour toutes les valeurs. Le dernier joueur à qui il reste des dés gagne.

Un pari doit toujours être plus haut que le précédent : on monte la quantité, avec la valeur de son choix, ou on garde la quantité et on monte la valeur. La quantité ne baisse jamais, sauf en passant aux as, où la moitié suffit ; pour quitter les as, il faut le double plus un.

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
| 1 | Probabiliste audacieux | calcul exact | 1797 |
| 2 | **Réseau de neurones** | apprentissage | 1781 |
| 3 | Probabiliste discret | calcul exact | 1771 |
| 4 | Prudent | règle simple | 1721 |
| 5 | Observateur | règle simple | 1440 |
| 6 | Statistique | règle simple | 1382 |
| 7 | Aléatoire | hasard | 609 |

Les trois premiers se tiennent en 26 points : ils sont pratiquement à égalité.

## Ce que le classement ne dit pas

**Le réseau bat le bot qui le devance.** En confrontation directe, il gagne 54 % de ses duels contre le probabiliste audacieux, et fait jeu égal avec le discret.

**Il est le seul à dominer le Prudent** : 81 % de victoires, là où les deux probabilistes plafonnent à 57 % et 51 %. Le Prudent surenchérit obstinément sans presque jamais douter. Un calcul de probabilités qui n'écoute pas l'adversaire n'en tire rien ; le réseau, qui voit les paris adverses, a appris à le piéger.

**Sa faiblesse reste les adversaires qu'il a peu rencontrés.** Il ne gagne que 65 % de ses duels contre l'Observateur, que le probabiliste audacieux bat à 90 %. Ce bot ne représentait que 3 % de ses parties d'entraînement : un modèle appris est bon là où il s'est entraîné.

## Quand les règles changent le classement

Une première version du projet suivait une variante où l'on pouvait baisser la quantité d'un pari en montant sa valeur. Elle offrait presque toujours une échappatoire sans risque, et permettait même des manches sans fin. Le passage aux règles classiques a tout rebattu : le Prudent, que le calcul exact battait 84 fois sur 100, lui tient désormais tête. Une stratégie n'est bonne que pour un jeu donné.

## Comment la démo fonctionne

Le moteur du jeu et les bots sont réécrits en JavaScript ; le réseau est exporté au format ONNX et exécuté dans votre navigateur. Aucun serveur n'intervient. Pour que les deux versions ne divergent pas, 400 situations générées par le code Python sont rejouées dans le navigateur : les bots y prennent exactement les mêmes décisions.

## Limites et suite

Le réseau joue toujours le même coup dans la même situation : un adversaire attentif peut l'exploiter, ce qui est une vraie faiblesse dans un jeu de bluff. La méthode de référence pour ces jeux, la minimisation du regret (CFR), celle des IA de poker, apprend au contraire à mélanger ses coups : c'est la suite envisagée, avec un entraînement face à des adversaires plus variés.

Son entraînement a été arrêté à 40 000 duels alors qu'il progressait encore.
