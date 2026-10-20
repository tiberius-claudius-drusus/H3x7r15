/*
 * H3x7r15 — portage de Hextris : réglages
 * Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * Portage de `js/initialization.js` (amont Hextris 3f4847d). L'amont a deux jeux de réglages, choisis d'après le
 * `userAgent` ; ici le choix est explicite (le modèle ne lit pas le navigateur). Toutes les longueurs sont en unités
 * logiques (échelle 1) : la vue les multiplie par l'échelle de l'écran.
 */

/** Réglages communs. `largeurHexagone` et `hauteurBloc` sont ceux de l'amont à l'échelle 1 (`baseHexWidth`, `baseBlockHeight`). */
const COMMUNS = {
  largeurHexagone: 87,
  hauteurBloc: 20,
  tempsCombo: 310,
};

export const PROFILS = Object.freeze({
  /** Écran tactile : voies plus courtes, blocs plus lents à apparaître. */
  mobile: Object.freeze({
    ...COMMUNS,
    distanceDepart: 227,        // startDist
    dureeCreation: 60,          // creationDt : images d'apparition d'un bloc avant qu'il ne tombe
    lignes: 7,                  // rows : un bloc de plus que cela dans une voie = perdu
    modVitesse: 0.73,           // speedModifier
    modCreation: 0.73,          // creationSpeedModifier
    facteurTemps: 14,           // ms par image dans le générateur de vagues (mobile : 14, ordinateur : 16,6667)
    echelleBase: 1.4,           // baseScale : grossissement du dessin (vue seulement)
  }),
  /** Ordinateur, clavier. */
  ordinateur: Object.freeze({
    ...COMMUNS,
    distanceDepart: 340,
    dureeCreation: 9,
    lignes: 8,
    modVitesse: 0.65,
    modCreation: 0.65,
    facteurTemps: 16.6667,
    echelleBase: 1,
  }),
});

/** Quatre couleurs, représentées par leur indice ; la vue choisit les teintes (thèmes, mode daltonien). */
export const NB_COULEURS = 4;
/** Six voies, un hexagone. */
export const NB_VOIES = 6;

/** Pas de la rotation animée de l'hexagone (`angularVelocityConst`). */
export const CONSTANTE_ANGULAIRE = 4;
