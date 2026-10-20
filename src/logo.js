/*
 * H3x7r15 — logo : l'hexagone central entouré de piles de blocs, dessiné en SVG avec les couleurs du thème courant
 * (variables CSS). Géométrie de l'amont à l'échelle 1/6 : la même que celle du jeu.
 * Licence : GPL-3.0-or-later (voir LICENSE.txt).
 */
import { tournerPoint } from './render.js';

const TAILLE = 100;
const E = 46 / 271.7;                 // l'anneau du jeu (rayon 271,7 sur ordinateur) tient dans le cadre
const R_CENTRE = 87 * E;              // rayon de l'hexagone central
const H_BLOC = 20 * E;                // hauteur d'un bloc
const RACINE3 = Math.sqrt(3);

// piles : pour chaque voie (0 à 5), les couleurs de bas en haut
export const LOGO_PILES = [[0, 2], [1, 1, 3], [2], [3, 0, 0], [1, 2], [0]];

function polygone(cx, cy, rayon, theta) {
  const pts = [];
  let c = tournerPoint(0, rayon, theta);
  for (let i = 0; i < 6; i++) {
    pts.push(`${(cx + c.x).toFixed(2)},${(cy + c.y).toFixed(2)}`);
    c = tournerPoint(c.x, c.y, 60);
  }
  return pts.join(' ');
}

/** Marque SVG (chaîne) ; couleurs via les variables du thème, donc elle suit le thème et le mode clair ou foncé. */
export function logoSvg() {
  const cx = TAILLE / 2, cy = TAILLE / 2;
  const apotheme = (R_CENTRE / 2) * RACINE3;
  const parts = [`<polygon points="${polygone(cx, cy, 46, 30)}" fill="var(--hx-ring)"/>`];
  LOGO_PILES.forEach((pile, voie) => {
    const angle = 90 - (30 + 60 * voie);
    pile.forEach((couleur, rang) => {
      const dist = apotheme + H_BLOC * rang;
      const largeur = (2 * dist) / RACINE3;
      const large = (2 * (dist + H_BLOC)) / RACINE3;
      const p = [
        tournerPoint(-largeur / 2, H_BLOC / 2, angle), tournerPoint(largeur / 2, H_BLOC / 2, angle),
        tournerPoint(large / 2, -H_BLOC / 2, angle), tournerPoint(-large / 2, -H_BLOC / 2, angle),
      ];
      const bx = cx + Math.sin(angle * (Math.PI / 180)) * (dist + H_BLOC / 2);
      const by = cy - Math.cos(angle * (Math.PI / 180)) * (dist + H_BLOC / 2);
      parts.push(`<polygon points="${p.map((q) => `${(bx + q.x).toFixed(2)},${(by + q.y).toFixed(2)}`).join(' ')}" fill="var(--hx-c${couleur})" stroke="var(--hx-ring)" stroke-width="0.4"/>`);
    });
  });
  parts.push(`<polygon points="${polygone(cx, cy, R_CENTRE, 30)}" fill="var(--hx-center)"/>`);
  return `<svg viewBox="0 0 ${TAILLE} ${TAILLE}" role="img" aria-label="H3x7r15" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
