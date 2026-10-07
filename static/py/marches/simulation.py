"""
Marches aléatoires renforcées par arêtes, sur une grille.

Un marcheur se déplace d'un sommet à un voisin. Chaque arête orientée
porte un poids ; la probabilité de l'emprunter est son poids divisé par
la somme des poids des arêtes qui partent du même sommet. Après chaque
passage, le poids de l'arête empruntée est renforcé :

    poids <- beta * poids + alpha

Avec alpha = 0 et beta = 1, il n'y a aucun renforcement : c'est une
marche aléatoire simple.

Plusieurs populations peuvent partager la grille. Chacune a ses propres
poids ; un passage renforce l'arête pour sa population et l'affaiblit
pour les autres :

    poids <- max(0, delta * poids - gamma)

Ce module n'utilise que la bibliothèque standard : il s'exécute tel quel
dans un navigateur (Pyodide), ce que fait la démo du site.

Il remplace les fonctions MAR, MAR2d, MARri, MARstop, MARpop, MAR2pop et
MAR3pop du script R d'origine (code.r) par une seule fonction, `simuler`.
"""

import random
from dataclasses import dataclass, field


# Directions : indice -> déplacement (dx, dy).
GAUCHE, DROITE, HAUT, BAS = 0, 1, 2, 3
DEPLACEMENTS = ((-1, 0), (1, 0), (0, 1), (0, -1))
OPPOSEE = (DROITE, GAUCHE, BAS, HAUT)

# Au-delà, le poids n'a plus de sens numérique : la marche s'arrête.
POIDS_MAXIMAL = 1e300

ORDRES = ("pas", "individu", "population")


@dataclass
class Parametres:
    """
    Réglages d'une simulation.

    taille            côté de la grille (taille x taille sommets)
    pas               nombre de pas de chaque marcheur
    alpha, beta       renforcement additif et multiplicatif
    gamma, delta      affaiblissement additif et multiplicatif, appliqué
                      aux poids des autres populations
    retour_interdit   le marcheur ne peut pas revenir immédiatement sur
                      son dernier pas
    arret_au_bord     la marche s'arrête dès qu'elle touche un bord ;
                      sinon les bords sont réfléchissants
    populations       nombre de populations
    individus         nombre de marcheurs successifs par population
    ordre             "pas"        : un marcheur par population avance en
                                     même temps, dans un ordre tiré au
                                     hasard à chaque pas ;
                      "individu"   : les marcheurs avancent un par un, en
                                     alternant les populations ;
                      "population" : tous les marcheurs d'une population,
                                     puis ceux de la suivante
    departs           point de départ (x, y) de chaque population ; le
                      centre de la grille par défaut
    graine            graine du générateur aléatoire
    trajectoires      garder la suite des positions de chaque marcheur
    """

    taille: int = 200
    pas: int = 20_000
    alpha: float = 0.5
    beta: float = 1.0
    gamma: float = 0.0
    delta: float = 1.0
    retour_interdit: bool = False
    arret_au_bord: bool = False
    populations: int = 1
    individus: int = 1
    ordre: str = "individu"
    departs: list | None = None
    graine: int | None = None
    trajectoires: bool = True

    def verifier(self) -> None:
        if self.taille < 3:
            raise ValueError("taille doit valoir au moins 3.")

        if self.pas < 1:
            raise ValueError("pas doit valoir au moins 1.")

        if self.alpha < 0 or self.beta <= 0:
            raise ValueError("alpha doit être positif et beta strictement positif.")

        if self.gamma < 0 or self.delta < 0:
            raise ValueError("gamma et delta doivent être positifs.")

        if self.populations < 1 or self.individus < 1:
            raise ValueError("Il faut au moins une population et un individu.")

        if self.ordre not in ORDRES:
            raise ValueError(f"ordre doit valoir l'un de {ORDRES}.")

        for x, y in self.points_de_depart():
            if not (0 <= x < self.taille and 0 <= y < self.taille):
                raise ValueError(f"Le départ ({x}, {y}) est hors de la grille.")

    def points_de_depart(self) -> list:
        centre = (self.taille // 2, self.taille // 2)

        if self.departs is None:
            return [centre] * self.populations

        if len(self.departs) != self.populations:
            raise ValueError("Il faut un point de départ par population.")

        return [tuple(depart) for depart in self.departs]


@dataclass
class Marche:
    """Parcours d'un marcheur."""

    population: int
    individu: int
    depart: tuple
    x: list = field(default_factory=list)
    y: list = field(default_factory=list)

    pas_effectues: int = 0
    position: tuple = (0, 0)

    # None si la marche est allée au bout ; sinon "bord" ou "renforcement".
    arret: str | None = None

    # Distances euclidiennes au point de départ.
    distance_max: float = 0.0

    @property
    def distance_finale(self) -> float:
        return _distance(self.position, self.depart)


@dataclass
class Resultat:
    parametres: Parametres
    marches: list

    # Nombre de passages de chaque population à chaque sommet,
    # visites[population][x * taille + y].
    visites: list

    # Poids des arêtes de chaque population,
    # poids[population][4 * (x * taille + y) + direction].
    poids: list

    def sommets_visites(self, population: int | None = None) -> int:
        """Nombre de sommets visités au moins une fois."""
        if population is not None:
            return sum(1 for n in self.visites[population] if n)

        return sum(1 for counts in zip(*self.visites) if any(counts))

    def proportion_visitee(self, population: int | None = None) -> float:
        return self.sommets_visites(population) / self.parametres.taille ** 2

    def passages(self, population: int | None = None) -> list:
        """Grille [x][y] du nombre de passages."""
        taille = self.parametres.taille

        counts = (
            self.visites[population]
            if population is not None
            else [sum(c) for c in zip(*self.visites)]
        )

        return [counts[x * taille:(x + 1) * taille] for x in range(taille)]


def _distance(a: tuple, b: tuple) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def poids_initiaux(taille: int) -> list:
    """Poids 1 sur chaque arête, 0 sur celles qui sortiraient de la grille."""
    poids = [1.0] * (4 * taille * taille)

    for i in range(taille):
        poids[4 * (0 * taille + i) + GAUCHE] = 0.0
        poids[4 * ((taille - 1) * taille + i) + DROITE] = 0.0
        poids[4 * (i * taille + 0) + BAS] = 0.0
        poids[4 * (i * taille + taille - 1) + HAUT] = 0.0

    return poids


class _Marcheur:
    """Un marcheur en cours de simulation."""

    __slots__ = ("marche", "x", "y", "dernier", "actif")

    def __init__(self, marche: Marche, garder: bool):
        self.marche = marche
        self.x, self.y = marche.depart
        self.dernier = -1
        self.actif = True

        marche.position = marche.depart

        if garder:
            marche.x.append(self.x)
            marche.y.append(self.y)


def simuler(parametres: Parametres | None = None, **options) -> Resultat:
    """
    Lance une simulation.

        simuler(taille=200, pas=20_000, alpha=0.5)
        simuler(Parametres(populations=2, delta=0.8, ordre="pas"))
    """
    p = parametres if parametres is not None else Parametres(**options)

    if parametres is not None and options:
        raise TypeError("Donner soit des Parametres, soit des options.")

    p.verifier()

    rng = random.Random(p.graine)
    taille = p.taille
    departs = p.points_de_depart()

    poids = [poids_initiaux(taille) for _ in range(p.populations)]
    visites = [[0] * (taille * taille) for _ in range(p.populations)]
    marches = []

    alpha, beta, gamma, delta = p.alpha, p.beta, p.gamma, p.delta
    affaiblit = p.populations > 1 and (gamma != 0.0 or delta != 1.0)
    bord = taille - 1
    hasard = rng.random

    def nouveau(population: int, individu: int) -> _Marcheur:
        marche = Marche(population, individu, departs[population])
        marches.append(marche)

        marcheur = _Marcheur(marche, p.trajectoires)
        visites[population][marcheur.x * taille + marcheur.y] += 1

        if p.arret_au_bord and _au_bord(marcheur.x, marcheur.y, bord):
            marche.arret = "bord"
            marcheur.actif = False

        return marcheur

    def avancer(marcheur: _Marcheur) -> None:
        """Fait faire un pas au marcheur."""
        marche = marcheur.marche
        population = marche.population
        w = poids[population]
        base = 4 * (marcheur.x * taille + marcheur.y)

        a, b, c, d = w[base], w[base + 1], w[base + 2], w[base + 3]

        if p.retour_interdit and marcheur.dernier >= 0:
            interdit = OPPOSEE[marcheur.dernier]

            if interdit == GAUCHE:
                a = 0.0
            elif interdit == DROITE:
                b = 0.0
            elif interdit == HAUT:
                c = 0.0
            else:
                d = 0.0

        total = a + b + c + d

        if total <= 0.0:
            # Toutes les arêtes permises ont été affaiblies jusqu'à zéro :
            # le marcheur choisit au hasard parmi les voisins.
            direction = rng.choice([
                k for k in range(4)
                if 0 <= marcheur.x + DEPLACEMENTS[k][0] <= bord
                and 0 <= marcheur.y + DEPLACEMENTS[k][1] <= bord
            ])
        else:
            u = hasard() * total

            if u < a:
                direction = GAUCHE
            elif u < a + b:
                direction = DROITE
            elif u < a + b + c or d <= 0.0:
                direction = HAUT if c > 0.0 else (DROITE if b > 0.0 else GAUCHE)
            else:
                direction = BAS

        arete = base + direction

        w[arete] = beta * w[arete] + alpha

        if affaiblit:
            for autre in range(p.populations):
                if autre != population:
                    autres = poids[autre]
                    valeur = delta * autres[arete] - gamma
                    autres[arete] = valeur if valeur > 0.0 else 0.0

        dx, dy = DEPLACEMENTS[direction]
        marcheur.x += dx
        marcheur.y += dy
        marcheur.dernier = direction

        marche.pas_effectues += 1
        marche.position = (marcheur.x, marcheur.y)
        visites[population][marcheur.x * taille + marcheur.y] += 1

        if p.trajectoires:
            marche.x.append(marcheur.x)
            marche.y.append(marcheur.y)

        distance = _distance(marche.position, marche.depart)

        if distance > marche.distance_max:
            marche.distance_max = distance

        if w[arete] > POIDS_MAXIMAL:
            marche.arret = "renforcement"
            marcheur.actif = False
        elif p.arret_au_bord and _au_bord(marcheur.x, marcheur.y, bord):
            marche.arret = "bord"
            marcheur.actif = False

    def marcher_jusqu_au_bout(marcheur: _Marcheur) -> None:
        for _ in range(p.pas):
            if not marcheur.actif:
                break

            avancer(marcheur)

    if p.ordre == "population":
        for population in range(p.populations):
            for individu in range(p.individus):
                marcher_jusqu_au_bout(nouveau(population, individu))

    elif p.ordre == "individu":
        for individu in range(p.individus):
            for population in range(p.populations):
                marcher_jusqu_au_bout(nouveau(population, individu))

    else:
        for individu in range(p.individus):
            groupe = [
                nouveau(population, individu)
                for population in range(p.populations)
            ]

            for _ in range(p.pas):
                rng.shuffle(groupe)

                for marcheur in groupe:
                    if marcheur.actif:
                        avancer(marcheur)

    marches.sort(key=lambda marche: (marche.population, marche.individu))

    return Resultat(p, marches, visites, poids)


def _au_bord(x: int, y: int, bord: int) -> bool:
    return x == 0 or y == 0 or x == bord or y == bord


def simuler_1d(
    taille: int = 200,
    pas: int = 50_000,
    alpha: float = 0.0,
    beta: float = 1.0,
    depart: int | None = None,
    graine: int | None = None,
) -> dict:
    """
    Marche renforcée sur une ligne de `taille` sommets, bords
    réfléchissants. Retourne les positions successives et la raison de
    l'arrêt (None, ou "renforcement").
    """
    if taille < 3 or pas < 1:
        raise ValueError("taille doit valoir au moins 3 et pas au moins 1.")

    rng = random.Random(graine)

    # poids[2 * i] : aller vers le bas ; poids[2 * i + 1] : vers le haut.
    poids = [1.0] * (2 * taille)
    poids[0] = 0.0
    poids[2 * taille - 1] = 0.0

    position = taille // 2 if depart is None else depart
    positions = [position]
    arret = None

    for _ in range(pas):
        bas, haut = poids[2 * position], poids[2 * position + 1]

        monte = rng.random() * (bas + haut) >= bas
        arete = 2 * position + (1 if monte else 0)

        poids[arete] = beta * poids[arete] + alpha
        position += 1 if monte else -1
        positions.append(position)

        if poids[arete] > POIDS_MAXIMAL:
            arret = "renforcement"
            break

    return {"positions": positions, "arret": arret}
