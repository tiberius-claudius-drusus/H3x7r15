/*
 * H3x7r15 — portage de Hextris : dessin sur canvas
 * Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * Portage de `js/render.js`, `js/view.js` (dessin), `js/Block.js` (`draw`), `js/Hex.js` (`draw`, `shake`), `js/Text.js`
 * et `js/comboTimer.js` (amont 3f4847d). Même géométrie : à l'échelle 1, l'écran fait 800 unités dans sa plus petite
 * dimension. Le modèle (`game.js`) fait avancer ses animations lui-même ; cette vue ne tient que ce qui est purement
 * visuel : secousses d'écran, textes flottants, échelle du canvas.
 *
 * Différences voulues : pas de police imposée (polices du système), les couleurs viennent du thème (variables CSS lues
 * par l'application), le fond est celui de la page.
 */
import { NB_VOIES } from './config.js';

const RACINE3 = Math.sqrt(3);

export function tournerPoint(x, y, theta) {
  const r = theta * (Math.PI / 180);
  return { x: Math.cos(r) * x - Math.sin(r) * y, y: Math.sin(r) * x + Math.cos(r) * y };
}

/** `drawPolygon` : polygone régulier de rayon `rayon`, pivoté de `theta` degrés. */
export function polygone(ctx, x, y, cotes, rayon, theta, remplissage) {
  ctx.fillStyle = remplissage;
  ctx.beginPath();
  let c = tournerPoint(0, rayon, theta);
  ctx.moveTo(c.x + x, c.y + y);
  let ox = c.x, oy = c.y;
  for (let i = 0; i < cotes; i++) {
    c = tournerPoint(ox, oy, 360 / cotes);
    ctx.lineTo(c.x + x, c.y + y);
    ox = c.x; oy = c.y;
  }
  ctx.closePath();
  ctx.fill();
}

/** Sommets du contour en 12 points (coins et milieux de côtés) de l'anneau, dans l'ordre de `drawTimer`. */
export function sommetsAnneau(rayon) {
  const demi = rayon / 2;
  const h = rayon * (RACINE3 / 2);
  return [
    [(demi * 3) / 2, h / 2], [rayon, 0], [(demi * 3) / 2, -h / 2], [demi, -h], [0, -h], [-demi, -h],
    [-(demi * 3) / 2, -h / 2], [-rayon, 0], [-(demi * 3) / 2, h / 2], [-demi, h], [0, h], [demi, h],
  ].reverse();
}

/** Texte flottant (« + 9 », « x 2 ») : monte et s'efface (`Text`, `fadeUpAndOut`). */
class TexteFlottant {
  constructor(x, y, texte, couleur) {
    Object.assign(this, { x, y, texte, couleur, opacite: 1, vivant: 1 });
  }

  avancer(dt) {
    this.opacite -= dt * Math.pow(Math.pow(1 - this.opacite, 1 / 3) + 1, 3) / 100;
    this.vivant = this.opacite;
    this.y -= 3 * dt;
  }
}

export class Vue {
  /**
   * @param {HTMLCanvasElement|{getContext: Function}} canvas
   * @param {import('./game.js').HextrisGame} jeu
   */
  constructor(canvas, jeu) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.jeu = jeu;
    this.largeur = 800;
    this.hauteur = 800;
    this.dpr = 1;
    this.echelle = 1;
    this.secousses = [];
    this.textes = [];
    this.gdx = 0;
    this.gdy = 0;
    this.palette = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];
    this.couleurs = { centre: '#2c3e50', anneau: '#bdc3c7', texte: '#ecf0f1' };
  }

  /** Taille en pixels CSS ; recalcule l'échelle (`scaleCanvas`). */
  redimensionner(largeur, hauteur, dpr = 1) {
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.dpr = dpr;
    this.echelle = (Math.min(largeur, hauteur) / 800) * this.jeu.reglages.echelleBase;
    if ('width' in this.canvas) {
      this.canvas.width = Math.round(largeur * dpr);
      this.canvas.height = Math.round(hauteur * dpr);
    }
  }

  /** Teintes du thème : `palette` = 4 couleurs de blocs ; `couleurs` = centre, anneau, texte du score. */
  regler({ palette, centre, anneau, texte }) {
    if (palette) this.palette = palette;
    if (centre) this.couleurs.centre = centre;
    if (anneau) this.couleurs.anneau = anneau;
    if (texte) this.couleurs.texte = texte;
  }

  /** Événements du modèle -> effets visuels. */
  surEvenement(type, d) {
    const e = this.echelle;
    if (type === 'pose') this.secousses.push({ voie: d.voie, magnitude: 4.5 * this.dpr * e });
    else if (type === 'efface') this.secousses.push({ voie: d.voie, magnitude: 3 * this.dpr * e });
    else if (type === 'points') {
      this.textes.push(new TexteFlottant(this.largeur / 2, this.hauteur / 2, '+ ' + d.points, this.palette[d.couleur]));
    } else if (type === 'combo') {
      const c = this._centreDesBlocs(d.blocs);
      this.textes.push(new TexteFlottant(c.x, c.y, 'x ' + d.multiplicateur, '#fff'));
    }
  }

  /** `findCenterOfBlocks`. */
  _centreDesBlocs(blocs) {
    let dist = 0, ang = 0;
    for (const b of blocs) {
      dist += b.distFromHex * this.echelle;
      let a = b.angle;
      while (a < 0) a += 360;
      ang += a % 360;
    }
    dist /= blocs.length;
    ang /= blocs.length;
    return { x: this.largeur / 2 + Math.cos(ang * (Math.PI / 180)) * dist, y: this.hauteur / 2 + Math.sin(ang * (Math.PI / 180)) * dist };
  }

  _texte(x, y, taille, couleur, texte) {
    const ctx = this.ctx;
    ctx.save();
    taille *= this.echelle;
    ctx.font = `${taille}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = couleur;
    ctx.fillText(texte, x, y + taille / 2 - 9 * this.echelle);
    ctx.restore();
  }

  /** Secousses : `Hex.shake`. */
  _secouer(dt) {
    this.gdx = 0;
    this.gdy = 0;
    for (const s of this.secousses) {
      const angle = (30 + s.voie * 60) * (Math.PI / 180);
      this.gdx -= Math.cos(angle) * s.magnitude;
      this.gdy += Math.sin(angle) * s.magnitude;
      s.magnitude /= 2 * (dt + 0.5);
    }
    this.secousses = this.secousses.filter((s) => s.magnitude >= 1);
  }

  /** `Block.draw`, partie dessin. */
  _bloc(b) {
    const ctx = this.ctx;
    const e = this.echelle;
    const hauteur = b.height * e;
    const dist = b.distFromHex * e;
    const largeur = (2 * dist) / RACINE3;
    const large = (2 * (dist + hauteur)) / RACINE3;
    let rat = 1;
    if (b.initializing) rat = Math.min(1, (this.jeu.ct - b.ict) / this.jeu.reglages.dureeCreation);
    const p1 = tournerPoint((-largeur / 2) * rat, hauteur / 2, b.angle);
    const p2 = tournerPoint((largeur / 2) * rat, hauteur / 2, b.angle);
    const p3 = tournerPoint((large / 2) * rat, -hauteur / 2, b.angle);
    const p4 = tournerPoint((-large / 2) * rat, -hauteur / 2, b.angle);
    const bx = this.largeur / 2 + Math.sin(b.angle * (Math.PI / 180)) * (dist + hauteur / 2) + this.gdx;
    const by = this.hauteur / 2 - Math.cos(b.angle * (Math.PI / 180)) * (dist + hauteur / 2) + this.gdy;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(bx + p1.x, by + p1.y);
      ctx.lineTo(bx + p2.x, by + p2.y);
      ctx.lineTo(bx + p3.x, by + p3.y);
      ctx.lineTo(bx + p4.x, by + p4.y);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = b.deleted ? '#ffffff' : this.palette[b.color];
    ctx.globalAlpha = b.opacity;
    trace();
    if (b.tint) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = b.tint;
      trace();
    }
    ctx.globalAlpha = 1;
  }

  /** `drawTimer` : le temps qui reste à la série de regroupements, sur le contour de l'anneau. */
  _minuteurCombo() {
    const j = this.jeu;
    if (j.etat !== 'jeu' || !(j.ct - j.dernierCombo < j.tempsCombo)) return;
    const e = this.echelle;
    const rayon = j.reglages.lignes * j.reglages.hauteurBloc * e * (2 / RACINE3) + j.reglages.largeurHexagone * e;
    const sommets = sommetsAnneau(rayon);
    const cx = this.largeur / 2, cy = this.hauteur / 2;
    const cote = (debut, fin, fraction) => {
      debut = (debut + 1) % 12;
      fin = (fin + 1) % 12;
      const sx = cx + sommets[debut][0], sy = cy + sommets[debut][1];
      const ex = cx + sommets[fin][0], ey = cy + sommets[fin][1];
      return [[sx, sy], [(ex - sx) * fraction + sx, (ey - sy) * fraction + sy]];
    };
    const gauche = [], droite = [];
    const fait = j.ct - j.dernierCombo;
    for (let i = 0; i < 6; i++) {
      if (fait < j.tempsCombo * (5 - i) * (1 / 6)) {
        gauche.push(cote(i, i + 1, 1));
        droite.push(cote(12 - i, 11 - i, 1));
      } else {
        const f = 1 - (((fait * 6) / j.tempsCombo) % 1);
        gauche.push(cote(i, i + 1, f));
        droite.push(cote(12 - i, 11 - i, f));
        break;
      }
    }
    const ctx = this.ctx;
    ctx.strokeStyle = this.palette[j.derniereCouleur] ?? this.couleurs.anneau;
    ctx.lineWidth = 4 * e;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;
    for (const chemin of [droite, gauche]) {
      if (!chemin.length) continue;
      ctx.beginPath();
      ctx.moveTo(chemin[0][0][0], chemin[0][0][1]);
      ctx.lineTo(chemin[0][1][0], chemin[0][1][1]);
      for (let i = 1; i < chemin.length; i++) {
        ctx.moveTo(chemin[i][0][0], chemin[i][0][1]);
        ctx.lineTo(chemin[i][1][0], chemin[i][1][1]);
      }
      ctx.stroke();
    }
  }

  /** Une image. `dt` : durée de l'image en images de 1/60 s (pour les secousses et les textes). */
  dessiner(dt = 1) {
    const ctx = this.ctx;
    const j = this.jeu;
    const e = this.echelle;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.largeur, this.hauteur);
    this._secouer(dt);
    const cx = this.largeur / 2, cy = this.hauteur / 2;
    const r = j.reglages;
    polygone(ctx, cx, cy, NB_VOIES, r.lignes * r.hauteurBloc * e * (2 / RACINE3) + r.largeurHexagone * e, 30, this.couleurs.anneau);
    this._minuteurCombo();
    for (const voie of j.voies) for (const b of voie) this._bloc(b);
    for (const b of j.chute) this._bloc(b);
    polygone(ctx, cx + this.gdx, cy + this.gdy, NB_VOIES, r.largeurHexagone * e, j.angle, this.couleurs.centre);
    if (j.etat !== 'pret') {
      const chaine = String(j.score);
      const taille = { 6: 43, 7: 35, 8: 31, 9: 27 }[chaine.length] ?? (chaine.length > 9 ? 24 : 50);
      this._texte(cx + this.gdx, cy + this.gdy, taille, this.couleurs.texte, chaine);
    }
    this.textes = this.textes.filter((t) => {
      ctx.globalAlpha = Math.max(0, t.opacite);
      this._texte(t.x + this.gdx, t.y + this.gdy, 50, t.couleur, t.texte);
      ctx.globalAlpha = 1;
      t.avancer(dt);
      return t.vivant > 0;
    });
  }

  /** Efface les effets (nouvelle partie). */
  remettre() {
    this.secousses = [];
    this.textes = [];
    this.gdx = 0;
    this.gdy = 0;
  }
}
