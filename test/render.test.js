/*
 * H3x7r15 — dessin : géométrie de base et passage sur une partie complète avec un contexte factice.
 * Licence : GPL-3.0-or-later (voir LICENSE.txt).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HextrisGame } from '../src/game.js';
import { Vue, tournerPoint, polygone, sommetsAnneau } from '../src/render.js';

function ctxFactice() {
  const appels = [];
  const props = {};
  const ctx = new Proxy({}, {
    get: (_, nom) => (nom in props ? props[nom] : (...a) => { appels.push([nom, ...a]); }),
    set: (_, nom, v) => { props[nom] = v; return true; },
  });
  return { ctx, appels };
}

test('rotation d\'un point', () => {
  const p = tournerPoint(1, 0, 90);
  assert.ok(Math.abs(p.x) < 1e-12 && Math.abs(p.y - 1) < 1e-12);
});

test('un hexagone a six côtés (sept points avec la fermeture)', () => {
  const { ctx, appels } = ctxFactice();
  polygone(ctx, 100, 100, 6, 50, 30, '#000');
  assert.equal(appels.filter((a) => a[0] === 'lineTo').length, 6);
});

test('l\'anneau a douze points', () => {
  assert.equal(sommetsAnneau(100).length, 12);
});

test('dessine toute une partie de référence sans erreur, texte du score compris', () => {
  const t = JSON.parse(fs.readFileSync(new URL('./fixtures/trace-mobile-2.json', import.meta.url), 'utf8'));
  const { ctx, appels } = ctxFactice();
  const jeu = new HextrisGame({ profil: 'mobile', graine: t.graine });
  const vue = new Vue({ getContext: () => ctx }, jeu);
  jeu.surEvenement = (type, d) => vue.surEvenement(type, d);
  vue.redimensionner(400, 700, 2);
  jeu.demarrer();
  assert.equal(vue.echelle, (400 / 800) * 1.4);
  for (let f = 0; f < t.actions.length; f++) {
    const [dt, rot] = t.actions[f];
    if (rot) jeu.tourner(rot);
    jeu.image(dt);
    vue.dessiner(dt);
  }
  assert.ok(appels.some((a) => a[0] === 'fillText'), 'le score est écrit');
  assert.ok(appels.some((a) => a[0] === 'stroke'), 'le minuteur de combo est tracé');
});
