/*
 * H3x7r15 — pas fixe de la simulation
 * Copyright (C) 2026 Drusus (Gens Claudia). Licence : GPL-3.0-or-later (voir LICENSE.txt).
 *
 * L'amont avance d'une étape par image affichée, avec une durée d'étape variable : sur un écran à 120 ou 144 Hz, certaines
 * règles qui comptent les appels (la difficulté ajoute un incrément à chaque appel) tournent plus vite que sur un écran à
 * 60 Hz. Audit de Claudius (M1) : la difficulté monte 34 à 46 % plus vite à 120-144 Hz. Ici la simulation fait toujours
 * 60 étapes par seconde, quel que soit l'écran ; l'affichage suit l'écran. À 60 Hz, c'est exactement le comportement de
 * l'amont (les parties de référence de `test/amont.test.js` sont enregistrées à pas constant).
 */

/** Réserve de temps non encore simulé, en images de 1/60 s. */
export class PasFixe {
  /** @param {number} [maxParImage] temps maximal pris en compte par image affichée (onglet en arrière-plan, gel) */
  constructor(maxParImage = 3) {
    this.max = maxParImage;
    this.reserve = 0;
  }

  /** Ajoute `ecoule` (images de 1/60 s, depuis l'image précédente) et renvoie le nombre d'étapes entières à simuler. */
  avancer(ecoule) {
    this.reserve += Math.min(this.max, Math.max(0, ecoule));
    let pas = 0;
    while (this.reserve >= 1) {
      this.reserve -= 1;
      pas++;
    }
    return pas;
  }

  remettre() {
    this.reserve = 0;
  }
}
