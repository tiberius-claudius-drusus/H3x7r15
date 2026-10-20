/*
 * H3x7r15 — portage de Hextris : générateur pseudo-aléatoire à graine
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * L'amont tire ses nombres de `Math.random()` : impossible de rejouer une partie. Ici le hasard est injectable et son état
 * est sauvegardable, ce qui permet les tests déterministes et la reprise exacte d'une partie.
 */

/** mulberry32 : 32 bits d'état, suffisant pour un jeu. Retourne une fonction `() => nombre dans [0, 1[`. */
export function mulberry32(graine) {
  let a = graine >>> 0;
  const alea = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  alea.etat = () => a;
  alea.fixer = (e) => { a = e >>> 0; };
  return alea;
}
