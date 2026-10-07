---
title: "Marches aléatoires renforcées : modélisation de fourmis"
short: "Marches renforcées"
order: 4
summary: "Un marcheur qui préfère les chemins déjà empruntés : les simulations d'un projet de recherche de Master 1, à rejouer et à modifier en Python dans le navigateur."
status: "Démo jouable"
stack: ["Python", "R", "Processus stochastiques", "Simulation", "Pyodide"]
code: "https://github.com/KilianCO/marches_aleatoires_renforcees"
demo:
  type: marches
  # Expérience affichée à l'ouverture de la page (voir marches/experiences.py)
  experience: "grille_additive"
---

## Le projet

Une marche aléatoire avance d'un pas au hasard, sans mémoire : c'est la « marche de l'ivrogne ». Une marche **renforcée** se souvient. Chaque fois qu'elle emprunte un chemin, elle augmente la probabilité de le reprendre, comme une fourmi qui dépose des phéromones derrière elle. Elle perd du même coup la propriété de Markov : pour prévoir son prochain pas, il faut connaître tout son passé.

Ce projet de Master 1 de mathématiques appliquées (Université Claude-Bernard Lyon 1, 2022), mené avec Clément Contamin, simule ces marches sur une grille et étudie leur comportement. Le [rapport complet](https://github.com/KilianCO/marches_aleatoires_renforcees/blob/main/Projet-2.pdf) et le script R d'origine sont dans le dépôt.

## Le modèle

Chaque arête de la grille porte un poids, égal à 1 au départ. La probabilité d'emprunter une arête est son poids divisé par la somme des poids des arêtes voisines. Après chaque passage, le poids devient :

**poids ← β × poids + α**

Avec α = 0 et β = 1, rien ne change : c'est la marche aléatoire simple. Le terme α ajoute, le terme β multiplie.

## Ce que montrent les simulations

Le menu de la démo reprend les figures du rapport ; tous les réglages sont modifiables.

- **Le renforcement comprime la trajectoire.** Plus α est grand, moins la marche explore, plus elle met de temps à atteindre le bord et moins elle s'éloigne de son point de départ.
- **Le renforcement multiplicatif s'emballe.** Dès β = 1,15 environ, la marche finit souvent enfermée dans un aller-retour entre deux sommets, avec un poids qui dépasse toute grandeur représentable.
- **Interdire le demi-tour fait explorer davantage.** Un marcheur qui ne peut pas revenir immédiatement sur son dernier pas subit moins le renforcement.
- **Des zones, pas des routes.** On attendait des chemins préférentiels, comme les pistes de fourmis. On observe plutôt des zones d'agrégation.
- **Plusieurs colonies se partagent le terrain.** Quand un passage renforce l'arête pour sa colonie et l'affaiblit pour les autres, des territoires apparaissent, séparés par des fronts.

## Du script R au module Python

Le travail d'origine est un script R de 3 000 lignes, où chaque variante (une ou deux dimensions, retour interdit, arrêt au bord, une, deux ou trois populations) est une fonction écrite séparément. Il est conservé tel quel dans le dépôt.

La version Python le remplace par une seule fonction, `simuler`, dont les variantes sont des paramètres, et par un catalogue qui décrit chaque expérience du rapport. Elle tient en moins de mille lignes, est couverte par des tests, et accepte un nombre quelconque de colonies, là où le script s'arrêtait à trois.

## Comment la démo fonctionne

Ce n'est pas une réécriture en JavaScript : le module Python du dépôt est exécuté **tel quel dans votre navigateur**, grâce à Pyodide, un interpréteur Python compilé en WebAssembly. Aucun serveur ne calcule quoi que ce soit. Le premier chargement télécharge une dizaine de mégaoctets.

Sous la figure, le code Python de l'expérience est affiché et modifiable : vous pouvez changer un paramètre, ou écrire votre propre expérience et la tracer.

## Limites

Les tailles par défaut sont réduites par rapport au rapport, pour que chaque simulation reste rapide dans un navigateur. Les conclusions sont empiriques : elles reposent sur des simulations, pas sur des démonstrations.
