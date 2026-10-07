---
title: "Une IA qui joue au Puissance 4"
short: "IA Puissance 4"
order: 1
summary: "Un agent entraîné par apprentissage par renforcement, à affronter dans le navigateur ou à regarder jouer contre d'autres IA."
status: "Démo jouable"
stack: ["Python", "Apprentissage par renforcement", "PyTorch", "Monte-Carlo (MCTS)", "ONNX", "GitHub Actions"]
code: "https://github.com/KilianCO/puissance-4"
demo:
  type: connect4
  # Fichier ONNX exporté depuis le dépôt du projet et servi par le site
  model_url: "/models/puissance4.onnx"
  model_version: "v2"
---

## Le projet

Le Puissance 4 est un bon terrain pour l'apprentissage par renforcement : des règles simples, un espace d'états immense (environ 4,5 × 10¹² positions) et une récompense qui n'arrive qu'en fin de partie. Personne ne montre les bons coups à l'agent : il joue, gagne ou perd, et en déduit ce qui fonctionne.

## Jouer, ou regarder jouer

Les menus « Jaunes » et « Rouges » choisissent les deux joueurs. Laissez « Vous » pour les jaunes et affrontez l'IA de votre choix ; ou choisissez une IA de chaque côté et regardez-les s'affronter. Entre deux IA, le premier coup de chacune est tiré au hasard, pour que les parties ne se répètent pas.

Trois façons très différentes de jouer sont proposées.

- **L'IA entraînée** est un réseau de neurones. Elle ne calcule aucun coup à l'avance : elle regarde le plateau et répond en une seule passe, comme une intuition.
- **Les minimax** sont programmés à la main, sans apprentissage. Ils explorent tous les coups possibles 1, 4 ou 6 coups à l'avance et jugent les positions avec une formule fixe.
- **Le Monte-Carlo** ne sait rien et n'a rien appris. Pour juger un coup, il termine la partie au hasard des milliers de fois et compte les victoires, en concentrant ses essais sur les coups prometteurs.

Sous le plateau, les barres montrent la préférence du dernier joueur pour chaque colonne.

## Comment l'IA a appris

Le modèle est un Deep Q-Network : pour chaque colonne, il estime le résultat de la partie s'il y joue.

- **Trois tentatives.** Un premier agent mémorisait les positions une à une dans un tableau : impossible de généraliser sur un espace aussi grand. Un premier réseau de neurones ne battait un adversaire élémentaire que dans 4 % des parties. Le modèle actuel est la troisième version.
- **Un réseau convolutif** : un alignement est le même motif où qu'il soit sur le plateau, et une convolution le reconnaît partout après l'avoir appris une fois.
- **Des adversaires variés** : la moitié des 40 000 parties d'entraînement est jouée contre lui-même, le reste contre des minimax, un joueur qui ne fait que parer les menaces immédiates et un joueur aléatoire.
- **Apprendre des deux côtés** : chaque coup, le sien comme celui de l'adversaire, sert d'exemple. Quand un minimax lui inflige une combinaison, il la retient.

## Ce qu'elle vaut

Mesures faites sans aucune part de hasard dans le jeu de l'IA, sur 200 parties par adversaire, la moitié en commençant.

| Adversaire | Plateau vide | 4 premiers coups au hasard |
|---|---|---|
| Aléatoire | 100 % | 100 % |
| Tactique (gagne ou bloque à un coup) | 98,5 % | 95 % |
| Minimax facile | 99,5 % | 96 % |
| Minimax moyen | 88 % | 58 % |
| Minimax difficile | 65,5 % | 45,5 % |

*Part de victoires de l'IA.*

La deuxième colonne est la plus honnête. En partant du plateau vide, l'IA et le minimax rejouent souvent les mêmes parties, que l'IA a rencontrées pendant son entraînement. Avec quelques coups aléatoires au départ, elle doit jouer des positions nouvelles, comme face à un humain : elle reste au-dessus du minimax moyen et fait jeu égal avec le difficile.

Sa limite est là : elle ne calcule pas. Elle perd encore 5 % des parties contre un adversaire qui se contente de parer les menaces, et une longue combinaison peut la surprendre.

## Le classement

Tous les joueurs se sont affrontés deux à deux : 40 parties par confrontation, la moitié dans chaque position, quatre premiers coups au hasard. Le classement Elo résume ces 1 800 parties : 200 points d'écart correspondent à environ 76 % de score attendu pour le mieux classé.

| Rang | Joueur | Méthode | Elo |
|---|---|---|---|
| 1 | Monte-Carlo, 10 000 simulations | recherche | 1856 |
| 2 | **IA entraînée (DQN V2)** | apprentissage | 1832 |
| 3 | Minimax moyen | recherche | 1809 |
| 4 | Minimax difficile | recherche | 1806 |
| 5 | Monte-Carlo, 1 000 simulations | recherche | 1717 |
| 6 | Minimax à 2 coups d'avance | recherche | 1685 |
| 7 | Minimax facile | recherche | 1297 |
| 8 | Tactique | règle simple | 1280 |
| 9 | Premier réseau (DQN V1) | apprentissage | 917 |
| 10 | Aléatoire | hasard | 801 |

Les quatre premiers se tiennent en 50 points : à 40 parties par confrontation, cet écart n'est pas significatif. Ce que le tableau montre vraiment, c'est qu'un réseau qui répond en une seule passe, sans calculer, joue dans la même catégorie qu'un minimax qui anticipe 6 coups ou qu'une recherche qui simule 10 000 parties par coup. Et que le premier réseau entraîné était à peine au-dessus du hasard.

## Comment la démo fonctionne

Le modèle est exporté au format ONNX et exécuté **directement dans votre navigateur** avec ONNX Runtime Web. Aucun serveur, aucun coût d'hébergement, aucune latence réseau : chaque coup est calculé sur votre machine. Le fichier pèse environ 1 Mo.

Si le modèle ne peut pas être chargé, la page bascule sur le minimax.

## De l'entraînement à cette page

1. **Entraînement** en local sur GPU. Toutes les 2 000 parties, le modèle est évalué et le meilleur est conservé.
2. **Évaluation** sur un banc commun : chaque version affronte les mêmes adversaires, dans les deux positions.
3. **Export** au format ONNX, avec vérification automatique que le fichier exporté calcule la même chose que le modèle entraîné.
4. **Publication** : le fichier rejoint le dépôt du site ; GitHub Actions lance les tests, reconstruit le site et le déploie.

## Et ensuite

Réunir les deux briques déjà présentes : remplacer les parties aléatoires du Monte-Carlo par l'avis du réseau, pour que l'IA calcule en s'appuyant sur ce qu'elle a appris. C'est le principe d'AlphaZero. Et automatiser l'évaluation, pour qu'un modèle moins bon que le précédent ne puisse pas être mis en ligne.
