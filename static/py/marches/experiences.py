"""
Les expériences du rapport, rejouables.

`EXPERIENCES` est le catalogue : chaque entrée reprend une figure ou une
étude du rapport (Projet-2.pdf) avec ses réglages. `executer` en lance
une et retourne un résultat simple (listes et dictionnaires), prêt à
être tracé ou converti en JSON.

Trois natures d'expérience :

    "ligne"        une marche à une dimension, position en fonction du
                   temps ;
    "trajectoire"  une ou plusieurs marches sur la grille ;
    "courbe"       une mesure moyennée sur plusieurs marches, en fonction
                   d'un paramètre que l'on fait varier.

Les tailles par défaut sont réduites par rapport au rapport pour rester
rapides dans un navigateur ; tous les réglages peuvent être surchargés.

Comme simulation.py, ce module n'utilise que la bibliothèque standard.
"""

from .simulation import Parametres, Resultat, simuler, simuler_1d


def _pas(debut: float, fin: float, increment: float) -> list:
    """Valeurs de `debut` à `fin` incluse, par pas de `increment`."""
    nombre = int(round((fin - debut) / increment))

    return [round(debut + k * increment, 6) for k in range(nombre + 1)]


EXPERIENCES = {
    # ---------------------------------------------------- une dimension
    "ligne_simple": {
        "titre": "1D · marche aléatoire simple",
        "figure": "2.1",
        "nature": "ligne",
        "description": "Sans renforcement, la marche oublie d'où elle vient : elle parcourt toute la ligne et rebondit sur les bords.",
        "parametres": {"taille": 200, "pas": 50_000, "alpha": 0.0, "beta": 1.0},
    },
    "ligne_additive": {
        "titre": "1D · renforcement additif",
        "figure": "2.2",
        "nature": "ligne",
        "description": "Chaque passage ajoute alpha au poids de l'arête. La marche s'attarde dans une région, sans y rester enfermée.",
        "parametres": {"taille": 200, "pas": 50_000, "alpha": 0.1, "beta": 1.0},
    },
    "ligne_multiplicative": {
        "titre": "1D · renforcement multiplicatif",
        "figure": "2.2",
        "nature": "ligne",
        "description": "Chaque passage multiplie le poids par beta. Le renforcement devient exponentiel : la marche finit bloquée dans un aller-retour. Le rapport l'observe dès beta = 1,005, une fois sur quatre environ.",
        "parametres": {"taille": 200, "pas": 50_000, "alpha": 0.0, "beta": 1.01},
    },

    # ---------------------------------------------------- un marcheur sur la grille
    "grille_simple": {
        "titre": "2D · marche aléatoire simple",
        "figure": "2.3.3",
        "nature": "trajectoire",
        "description": "La référence sans renforcement : une exploration large, sans zone privilégiée.",
        "parametres": {"taille": 200, "pas": 30_000, "alpha": 0.0, "beta": 1.0},
    },
    "grille_additive": {
        "titre": "2D · renforcement additif",
        "figure": "2.3.1",
        "nature": "trajectoire",
        "description": "Avec alpha = 1, la trajectoire se replie sur elle-même et forme des zones d'agrégation.",
        "parametres": {"taille": 200, "pas": 30_000, "alpha": 1.0, "beta": 1.0},
    },
    "grille_multiplicative": {
        "titre": "2D · renforcement multiplicatif",
        "figure": "2.3.2",
        "nature": "trajectoire",
        "description": "Dès beta = 1,15 le renforcement s'emballe ; avec 1,2 la marche finit presque toujours enfermée sur quelques arêtes, et s'arrête quand un poids dépasse toute grandeur représentable.",
        "parametres": {"taille": 200, "pas": 50_000, "alpha": 0.0, "beta": 1.2},
    },
    "retour_interdit": {
        "titre": "2D · retour interdit",
        "figure": "2.4 et 2.7",
        "nature": "trajectoire",
        "description": "Le marcheur ne peut pas revenir immédiatement sur son dernier pas. Il est poussé à explorer et subit moins le renforcement.",
        "parametres": {"taille": 200, "pas": 30_000, "alpha": 1.0, "beta": 1.0, "retour_interdit": True},
    },
    "arret_au_bord": {
        "titre": "2D · arrêt au bord",
        "figure": "2.5",
        "nature": "trajectoire",
        "description": "La marche s'arrête dès qu'elle touche un bord : on lit directement le temps qu'elle met à sortir.",
        "parametres": {"taille": 200, "pas": 50_000, "alpha": 1.0, "beta": 1.0, "arret_au_bord": True},
    },

    # ---------------------------------------------------- populations
    "une_population": {
        "titre": "Populations · une colonie",
        "figure": "4.1",
        "nature": "trajectoire",
        "description": "Dix marcheurs partent tour à tour du centre et héritent des poids laissés par les précédents.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "individus": 10},
    },
    "deux_populations_pas": {
        "titre": "Populations · deux colonies, pas à pas",
        "figure": "4.2.1",
        "nature": "trajectoire",
        "description": "Un passage renforce l'arête pour sa colonie et l'affaiblit pour l'autre (delta = 0,8). Les deux colonies avancent en même temps et s'évitent.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "delta": 0.8, "populations": 2, "individus": 6, "ordre": "pas"},
    },
    "deux_populations_individu": {
        "titre": "Populations · deux colonies, individu par individu",
        "figure": "4.2.2",
        "nature": "trajectoire",
        "description": "Les marcheurs se succèdent en alternant les colonies : chacun trouve la grille marquée par tous les précédents.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "delta": 0.8, "populations": 2, "individus": 6, "ordre": "individu"},
    },
    "deux_populations_population": {
        "titre": "Populations · deux colonies, l'une après l'autre",
        "figure": "4.2.3",
        "nature": "trajectoire",
        "description": "La première colonie s'installe librement ; la seconde doit composer avec un terrain déjà occupé.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "delta": 0.8, "populations": 2, "individus": 6, "ordre": "population"},
    },
    "trois_populations": {
        "titre": "Populations · trois colonies, pas à pas",
        "figure": "4.3.1",
        "nature": "trajectoire",
        "description": "Même principe à trois colonies : chacune finit par privilégier une partie de la grille.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "delta": 0.8, "populations": 3, "individus": 5, "ordre": "pas"},
    },
    "territoires_deux": {
        "titre": "Territoires · deux colonies, départs séparés",
        "figure": "4.4.1",
        "nature": "trajectoire",
        "description": "Deux colonies partent de deux points distincts : un front se forme entre leurs territoires.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "delta": 0.8, "populations": 2, "individus": 6, "ordre": "population", "departs": [[54, 54], [96, 96]]},
    },
    "territoires_trois": {
        "titre": "Territoires · trois colonies, départs séparés",
        "figure": "4.4.2",
        "nature": "trajectoire",
        "description": "Trois colonies disposées en triangle. Une colonie coincée peut « fuir » à travers le territoire d'une autre jusqu'à une zone vierge.",
        "parametres": {"taille": 150, "pas": 4_000, "alpha": 1.0, "beta": 1.0, "delta": 0.8, "populations": 3, "individus": 5, "ordre": "population", "departs": [[60, 60], [90, 60], [60, 90]]},
    },

    # ---------------------------------------------------- statistiques
    "temps_bord": {
        "titre": "Statistiques · temps pour toucher le bord",
        "figure": "3.1",
        "nature": "courbe",
        "description": "Plus le renforcement est fort, plus la marche met de temps à atteindre le bord. Au-delà d'un seuil, elle ne l'atteint plus dans le temps imparti.",
        "parametres": {"taille": 60, "pas": 6_000, "beta": 1.0, "arret_au_bord": True},
        "variable": "alpha",
        "valeurs": _pas(0, 5, 0.5),
        "mesure": "temps_bord",
        "repetitions": 20,
        "series": [
            {"nom": "Marche renforcée", "parametres": {}},
            {"nom": "Retour interdit", "parametres": {"retour_interdit": True}},
        ],
    },
    "distance_finale": {
        "titre": "Statistiques · distance au départ",
        "figure": "3.3",
        "nature": "courbe",
        "description": "Distance moyenne au point de départ à la fin de la marche : le renforcement comprime la trajectoire.",
        "parametres": {"taille": 200, "pas": 4_000, "beta": 1.0},
        "variable": "alpha",
        "valeurs": _pas(0, 5, 0.5),
        "mesure": "distance_finale",
        "repetitions": 20,
        "series": [
            {"nom": "Marche renforcée", "parametres": {}},
            {"nom": "Retour interdit", "parametres": {"retour_interdit": True}},
        ],
    },
    "distance_max": {
        "titre": "Statistiques · distance maximale",
        "figure": "3.4",
        "nature": "courbe",
        "description": "Distance la plus grande atteinte pendant la marche, en fonction du renforcement.",
        "parametres": {"taille": 200, "pas": 4_000, "beta": 1.0},
        "variable": "alpha",
        "valeurs": _pas(0, 5, 0.5),
        "mesure": "distance_max",
        "repetitions": 20,
        "series": [
            {"nom": "Marche renforcée", "parametres": {}},
            {"nom": "Retour interdit", "parametres": {"retour_interdit": True}},
        ],
    },
    "sommets_visites": {
        "titre": "Statistiques · sommets visités selon la durée",
        "figure": "3.7",
        "nature": "courbe",
        "description": "Nombre de sommets différents visités quand la marche s'allonge : l'interdiction du retour fait explorer davantage.",
        "parametres": {"taille": 200, "alpha": 1.0, "beta": 1.0},
        "variable": "pas",
        "valeurs": [500, 1_000, 2_000, 3_000, 4_000, 6_000, 8_000],
        "mesure": "sommets_visites",
        "repetitions": 15,
        "series": [
            {"nom": "Sans renforcement", "parametres": {"alpha": 0.0}},
            {"nom": "Marche renforcée", "parametres": {}},
            {"nom": "Retour interdit", "parametres": {"retour_interdit": True}},
        ],
    },
    "sommets_selon_alpha": {
        "titre": "Statistiques · sommets visités selon le renforcement",
        "figure": "3.7",
        "nature": "courbe",
        "description": "À durée fixée, plus alpha est grand, moins la marche découvre de sommets.",
        "parametres": {"taille": 200, "pas": 4_000, "beta": 1.0},
        "variable": "alpha",
        "valeurs": _pas(0, 5, 0.5),
        "mesure": "sommets_visites",
        "repetitions": 20,
        "series": [
            {"nom": "Marche renforcée", "parametres": {}},
            {"nom": "Retour interdit", "parametres": {"retour_interdit": True}},
        ],
    },
}


MESURES = {
    "temps_bord": "Pas avant de toucher le bord",
    "distance_finale": "Distance finale au départ",
    "distance_max": "Distance maximale au départ",
    "sommets_visites": "Sommets visités",
    "proportion_visitee": "Part de la grille visitée",
}


def mesurer(mesure: str, parametres: Parametres) -> float:
    """Lance une marche et retourne la mesure demandée."""
    if mesure not in MESURES:
        raise ValueError(f"Mesure inconnue : {mesure}")

    resultat = simuler(parametres)
    marche = resultat.marches[0]

    if mesure == "temps_bord":
        return float(marche.pas_effectues)

    if mesure == "distance_finale":
        return marche.distance_finale

    if mesure == "distance_max":
        return marche.distance_max

    if mesure == "sommets_visites":
        return float(resultat.sommets_visites())

    return resultat.proportion_visitee()


def balayer(
    variable: str,
    valeurs: list,
    mesure: str,
    repetitions: int = 20,
    graine: int | None = None,
    progres=None,
    **parametres,
) -> dict:
    """
    Fait varier un paramètre et moyenne une mesure sur plusieurs marches.

        balayer("alpha", [0, 1, 2], "distance_max", taille=200, pas=4000)

    Retourne les valeurs, la moyenne et l'écart-type de la mesure pour
    chacune. Pour "temps_bord", `atteint` donne la part des marches qui
    ont réellement touché le bord.

    `progres`, s'il est fourni, est appelé après chaque valeur avec la
    fraction du travail accomplie.
    """
    if repetitions < 1:
        raise ValueError("repetitions doit valoir au moins 1.")

    moyennes, ecarts, atteint = [], [], []

    for rang, valeur in enumerate(valeurs):
        mesures = []
        arrets = 0

        for repetition in range(repetitions):
            reglages = dict(parametres)
            reglages[variable] = valeur
            reglages["trajectoires"] = False

            if graine is not None:
                reglages["graine"] = graine + 1_000 * rang + repetition

            p = Parametres(**reglages)

            if mesure == "temps_bord":
                marche = simuler(p).marches[0]
                mesures.append(float(marche.pas_effectues))
                arrets += marche.arret == "bord"
            else:
                mesures.append(mesurer(mesure, p))

        moyenne = sum(mesures) / repetitions
        variance = sum((m - moyenne) ** 2 for m in mesures) / repetitions

        moyennes.append(moyenne)
        ecarts.append(variance ** 0.5)
        atteint.append(arrets / repetitions)

        if progres is not None:
            progres((rang + 1) / len(valeurs))

    resultat = {
        "variable": variable,
        "valeurs": list(valeurs),
        "mesure": mesure,
        "moyennes": moyennes,
        "ecarts_types": ecarts,
        "repetitions": repetitions,
    }

    if mesure == "temps_bord":
        resultat["atteint"] = atteint

    return resultat


def catalogue() -> list:
    """Liste des expériences, pour construire un menu."""
    return [
        {
            "id": identifiant,
            "titre": experience["titre"],
            "figure": experience["figure"],
            "nature": experience["nature"],
            "description": experience["description"],
            "parametres": dict(experience["parametres"]),
            "variable": experience.get("variable"),
            "valeurs": experience.get("valeurs"),
            "mesure": experience.get("mesure"),
            "repetitions": experience.get("repetitions"),
            "series": [s["nom"] for s in experience.get("series", [])],
        }
        for identifiant, experience in EXPERIENCES.items()
    ]


def executer(
    identifiant: str,
    surcharges: dict | None = None,
    repetitions: int | None = None,
    graine: int | None = None,
    progres=None,
) -> dict:
    """
    Lance une expérience du catalogue.

    `surcharges` remplace certains réglages de l'expérience, par exemple
    {"alpha": 2, "taille": 100}.
    """
    if identifiant not in EXPERIENCES:
        raise ValueError(f"Expérience inconnue : {identifiant}")

    experience = EXPERIENCES[identifiant]
    reglages = {**experience["parametres"], **(surcharges or {})}
    nature = experience["nature"]

    base = {
        "id": identifiant,
        "titre": experience["titre"],
        "nature": nature,
        "parametres": reglages,
    }

    if nature == "ligne":
        sortie = simuler_1d(
            taille=reglages["taille"],
            pas=reglages["pas"],
            alpha=reglages["alpha"],
            beta=reglages["beta"],
            graine=graine,
        )

        return {**base, **sortie}

    if nature == "trajectoire":
        resultat = simuler(Parametres(**reglages, graine=graine))

        return {**base, **decrire(resultat), "parametres": reglages}

    n = repetitions if repetitions is not None else experience["repetitions"]
    series = experience["series"]
    courbes = []

    for rang, serie in enumerate(series):
        def avancement(fraction, rang=rang):
            if progres is not None:
                progres((rang + fraction) / len(series))

        courbe = balayer(
            experience["variable"],
            experience["valeurs"],
            experience["mesure"],
            repetitions=n,
            graine=None if graine is None else graine + 100_000 * rang,
            progres=avancement,
            **{**reglages, **serie["parametres"]},
        )

        courbes.append({"nom": serie["nom"], **courbe})

    return {
        **base,
        "variable": experience["variable"],
        "mesure": experience["mesure"],
        "libelle_mesure": MESURES[experience["mesure"]],
        "repetitions": n,
        "series": courbes,
    }


def decrire(resultat: Resultat) -> dict:
    """Convertit le résultat d'une simulation en listes et dictionnaires."""
    p = resultat.parametres

    return {
        "nature": "trajectoire",
        "parametres": {
            "taille": p.taille,
            "pas": p.pas,
            "alpha": p.alpha,
            "beta": p.beta,
            "gamma": p.gamma,
            "delta": p.delta,
            "retour_interdit": p.retour_interdit,
            "arret_au_bord": p.arret_au_bord,
            "populations": p.populations,
            "individus": p.individus,
            "ordre": p.ordre,
        },
        "departs": [list(depart) for depart in p.points_de_depart()],
        "marches": [
            {
                "population": marche.population,
                "individu": marche.individu,
                "x": marche.x,
                "y": marche.y,
                "pas": marche.pas_effectues,
                "arret": marche.arret,
                "distance_max": marche.distance_max,
                "distance_finale": marche.distance_finale,
            }
            for marche in resultat.marches
        ],
        "sommets_visites": resultat.sommets_visites(),
        "proportion_visitee": resultat.proportion_visitee(),
        "visites_par_population": [
            resultat.sommets_visites(population)
            for population in range(p.populations)
        ],
    }


def normaliser(objet) -> dict:
    """
    Met sous une forme traçable ce que retourne `simuler`, `simuler_1d`,
    `balayer` (ou une liste de `balayer`) ou `executer`.

    Sert à la démo du site, où le visiteur peut écrire son propre code.
    """
    if isinstance(objet, Resultat):
        return decrire(objet)

    if isinstance(objet, dict):
        if "nature" in objet:
            return objet

        if "positions" in objet:
            return {"nature": "ligne", "parametres": {}, **objet}

        if "moyennes" in objet:
            objet = [objet]

    if isinstance(objet, (list, tuple)) and objet and all(
        isinstance(courbe, dict) and "moyennes" in courbe for courbe in objet
    ):
        return {
            "nature": "courbe",
            "parametres": {},
            "variable": objet[0]["variable"],
            "mesure": objet[0]["mesure"],
            "libelle_mesure": MESURES.get(objet[0]["mesure"], objet[0]["mesure"]),
            "repetitions": objet[0]["repetitions"],
            "series": [
                {"nom": courbe.get("nom", f"Série {rang + 1}"), **courbe}
                for rang, courbe in enumerate(objet)
            ],
        }

    raise TypeError(
        "sortie doit venir de simuler, simuler_1d, balayer ou executer."
    )

