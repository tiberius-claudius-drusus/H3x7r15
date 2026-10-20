/*
 * H3x7r15 — session : préférences, sauvegarde, statistiques. Licence : GPL-3.0-or-later (voir LICENSE.txt).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session, DEFAULT_PREFERENCES } from '../src/session.js';

function stockage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m };
}

test('préférences par défaut : commandes non inversées', () => {
  const s = new Session({ storage: stockage() });
  assert.equal(s.preferences.invertControls, false);
  assert.equal(DEFAULT_PREFERENCES.invertControls, false);
});

test('inverser les commandes : mémorisé, relu, et toute valeur douteuse retombe sur faux', () => {
  const st = stockage();
  const a = new Session({ storage: st });
  const vus = [];
  a.on('preference-changed', (n, v) => vus.push([n, v]));
  a.setPreference('invertControls', true);
  assert.deepEqual(vus, [['invertControls', true]]);
  assert.equal(new Session({ storage: st }).preferences.invertControls, true);
  assert.equal(new Session({ storage: stockage({ 'h3x7r15:prefs': JSON.stringify({ invertControls: 'oui' }) }) }).preferences.invertControls, false);
});

test('préférence inconnue refusée ; profil de jeu selon l\'écran tactile sauf choix explicite', () => {
  const s = new Session({ storage: stockage(), coarsePointer: true });
  assert.throws(() => s.setPreference('nimporte', 1));
  assert.equal(s.profilEffectif(), 'mobile');
  s.setPreference('profil', 'ordinateur');
  assert.equal(s.profilEffectif(), 'ordinateur');
  assert.equal(new Session({ storage: stockage(), coarsePointer: false }).profilEffectif(), 'ordinateur');
});

test('nouvelle partie, sauvegarde, reprise en pause', () => {
  const st = stockage();
  const s = new Session({ storage: st, seed: () => 42 });
  s.newGame();
  for (let i = 0; i < 300; i++) s.game.image(1);
  assert.ok(s.saveGame());
  assert.equal(typeof s.savedInfo().score, 'number');
  const t = new Session({ storage: st });
  assert.ok(t.resume());
  assert.equal(t.game.etat, 'pause');
  assert.equal(t.game.ct, s.game.ct);
});

test('sauvegarde illisible : mise de côté, jamais exécutée', () => {
  const st = stockage({ 'h3x7r15:savefile': JSON.stringify({ v: 1, profil: 'ordinateur', score: 3, voies: 'x' }) });
  const s = new Session({ storage: st });
  assert.equal(s.resume(), false);
  assert.equal(st.getItem('h3x7r15:savefile'), null);
  assert.notEqual(st.getItem('h3x7r15:savefile.illisible'), null);
});

test('fin de partie : statistiques, record, sauvegarde effacée', () => {
  const st = stockage();
  const s = new Session({ storage: st, seed: () => 1, jour: () => '2026-10-20' });
  let fin = null;
  s.on('game-over', (d) => { fin = d; });
  s.newGame();
  s.game.delai = 0;
  for (let i = 0; i < 9; i++) s.game.voies[2].push({ settled: 1, height: 20, fallingLane: 0, checked: 0, angle: 0, angularVelocity: 0, targetAngle: 0,
    color: i % 2, deleted: 0, removed: 0, tint: 0, opacity: 1, initializing: 0, ict: 0, iter: 1, attachedLane: 2, distFromHex: 75.34 + 20 * i });
  s.game.score = 50;
  s.game.image(1);
  assert.deepEqual(fin, { score: 50, record: true });
  assert.equal(s.stats.games.length, 1);
  assert.equal(s.stats.games[0].d, '2026-10-20');
  assert.equal(st.getItem('h3x7r15:savefile'), null);
});
