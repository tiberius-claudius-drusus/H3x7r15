/*
 * H3x7r15 — modèle : règles de base, sauvegarde et reprise. Licence : GPL-3.0-or-later (voir LICENSE.txt).
 * (Le rejeu image par image contre le code d'origine est dans amont.test.js.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HextrisGame, ETAT } from '../src/game.js';

function jouer(jeu, images, dt = 1) {
  for (let i = 0; i < images; i++) {
    if (i % 7 === 0) jeu.tourner(i % 14 === 0 ? 1 : -1);
    jeu.image(dt);
  }
}

const etatUtile = (j) => JSON.stringify({ ...j.exporter(), rng: null });

/** Un bloc déjà posé dans une voie, pour fabriquer une situation à la main. */
function bloc(voie, rang, couleur, extra = {}) {
  return { settled: 1, height: 20, fallingLane: 0, checked: 0, angle: 0, angularVelocity: 0, targetAngle: 0, color: couleur, deleted: 0,
    removed: 0, tint: 0, opacity: 1, initializing: 0, ict: 0, iter: 1, attachedLane: voie, distFromHex: 75.34 + 20 * rang, ...extra };
}

test('une partie neuve est à l\'accueil et ne bouge pas', () => {
  const j = new HextrisGame({ graine: 5 });
  assert.equal(j.etat, ETAT.PRET);
  j.image(1);
  assert.equal(j.ct, 0);
});

test('images de grâce au départ : rien ne bouge pendant 15 images', () => {
  const j = new HextrisGame({ graine: 5 });
  j.demarrer();
  for (let i = 0; i < 15; i++) j.image(1);
  assert.equal(j.ct, 0);
  j.image(1);
  assert.equal(j.ct, 1);
});

test('la pause fige la partie ; reprendre la relance', () => {
  const j = new HextrisGame({ graine: 5 });
  j.demarrer();
  jouer(j, 40);
  j.pause();
  assert.equal(j.etat, ETAT.PAUSE);
  const avant = etatUtile(j);
  jouer(j, 40);
  assert.equal(etatUtile(j), avant);
  j.reprendre();
  assert.equal(j.etat, ETAT.JEU);
});

test('la rotation ne se fait ni en pause ni à la fin', () => {
  const j = new HextrisGame({ graine: 5 });
  j.demarrer();
  j.tourner(1);
  assert.equal(j.position, 1);
  j.pause();
  j.tourner(1);
  assert.equal(j.position, 1);
  j.reprendre();
  j.tourner(-3);
  assert.equal(j.position, 4);         // repli dans 0..5
});

test('sens de rotation : pas +1 = anti-horaire à l\'écran, pas -1 = horaire (gauche = anti-horaire, droite = horaire par défaut)', () => {
  const j = new HextrisGame({ graine: 5 });
  j.demarrer();
  j.voies[0].push(bloc(0, 0, 0));
  // position à l'écran d'un bloc d'angle a (comme le dessin) : x = sin a, y = -cos a (y vers le bas)
  const pos = (a) => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)];
  const produit = (a, b) => a[0] * b[1] - a[1] * b[0];     // < 0 : anti-horaire à l'écran, > 0 : horaire
  const avant = j.voies[0][0].targetAngle;
  j.tourner(1);
  assert.ok(produit(pos(avant), pos(j.voies[0][0].targetAngle)) < 0, 'pas +1 : anti-horaire');
  j.tourner(-2);
  assert.ok(produit(pos(avant), pos(j.voies[0][0].targetAngle)) > 0, 'pas -1 : horaire');
});

test('trois blocs de même couleur contigus s\'effacent et rapportent n² points', () => {
  const points = [];
  const j = new HextrisGame({ graine: 5, surEvenement: (t, d) => { if (t === 'points') points.push(d.points); } });
  j.demarrer();
  j.delai = 0;
  for (let i = 0; i < 3; i++) j.voies[0].push(bloc(0, i, 0, { checked: i === 2 ? 1 : 0 }));
  j.image(1);
  assert.deepEqual(points, [9]);
  assert.equal(j.score, 9);
  assert.ok(j.voies[0].every((b) => b.deleted > 0));
  for (let i = 0; i < 30; i++) j.image(1);
  assert.equal(j.voies[0].length, 0, 'les blocs effacés quittent la pile après leur fondu');
});

test('deux blocs seulement ne s\'effacent pas', () => {
  const j = new HextrisGame({ graine: 5 });
  j.demarrer();
  j.delai = 0;
  for (let i = 0; i < 2; i++) j.voies[1].push(bloc(1, i, 2, { checked: i === 1 ? 1 : 0 }));
  j.image(1);
  assert.equal(j.score, 0);
});

test('des regroupements enchaînés vite augmentent le multiplicateur', () => {
  const textes = [];
  const j = new HextrisGame({ graine: 5, surEvenement: (t, d) => { if (t === 'combo') textes.push(d.multiplicateur); } });
  j.demarrer();
  j.delai = 0;
  for (let i = 0; i < 3; i++) j.voies[0].push(bloc(0, i, 0, { checked: i === 2 ? 1 : 0 }));
  j.image(1);
  for (let i = 0; i < 3; i++) j.voies[2].push(bloc(2, i, 1, { checked: i === 2 ? 1 : 0 }));
  j.image(1);
  assert.deepEqual(textes, [2]);
  assert.equal(j.score, 9 + 18, 'le second regroupement vaut 3² x 2');
});

test('une voie trop remplie met fin à la partie', () => {
  const j = new HextrisGame({ graine: 5, profil: 'mobile' });
  j.demarrer();
  j.delai = 0;
  for (let i = 0; i < 8; i++) j.voies[3].push(bloc(3, i, i % 2));     // 7 lignes en mobile : la huitième déborde
  let fin = null;
  j.surEvenement = (t, d) => { if (t === 'fin') fin = d; };
  j.image(1);
  assert.equal(j.etat, ETAT.FINI);
  assert.deepEqual(fin, { score: 0 });
});

test('sauvegarde puis reprise : la suite de la partie est identique', () => {
  const a = new HextrisGame({ graine: 11 });
  a.demarrer();
  jouer(a, 900);
  const copie = JSON.parse(JSON.stringify(a.exporter()));
  const b = new HextrisGame({ graine: 999 });       // autre graine : l'état du hasard vient de la sauvegarde
  b.importer(copie);
  assert.equal(etatUtile(b), etatUtile(a));
  jouer(a, 900);
  jouer(b, 900);
  assert.equal(etatUtile(b), etatUtile(a));
  assert.equal(b.score, a.score);
  assert.deepEqual(b.rng.etat(), a.rng.etat());
});

test('une sauvegarde invalide est refusée et laisse la partie intacte', () => {
  const j = new HextrisGame({ graine: 3 });
  j.demarrer();
  jouer(j, 300);
  const avant = etatUtile(j);
  const bonne = j.exporter();
  const mauvaises = [
    null, {}, { ...bonne, v: 2 }, { ...bonne, profil: 'mobile' }, { ...bonne, voies: [] }, { ...bonne, score: 'x' },
    { ...bonne, etat: 'zzz' }, { ...bonne, vagues: { ...bonne.vagues, motif: 'inconnu' } },
    { ...bonne, chute: [{ color: 9 }] },
  ];
  for (const m of mauvaises) assert.throws(() => j.importer(m));
  assert.equal(etatUtile(j), avant);
});
