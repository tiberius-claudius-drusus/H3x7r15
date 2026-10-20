/*
 * H3x7r15 — statistiques : records, moyennes et classements séparés par profil (audit de Claudius, D2).
 * Licence : GPL-3.0-or-later (voir LICENSE.txt).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStats, normalizeStats, addGame, addStart, bestScore, summarize, top, recent, gamesOf, MAX_GAMES } from '../src/stats.js';

const g = (s, p, d = '2026-10-20', t = 60) => ({ d, s, t, p });

test('un record par profil : un bon score tactile n\'est pas un record sur ordinateur', () => {
  let st = emptyStats();
  let r;
  ({ stats: st, record: r } = addGame(st, g(500, 'ordinateur')));
  assert.equal(r, true, 'premier score ordinateur');
  ({ stats: st, record: r } = addGame(st, g(100, 'mobile')));
  assert.equal(r, true, 'premier score tactile, même s\'il est inférieur au record ordinateur');
  ({ stats: st, record: r } = addGame(st, g(300, 'ordinateur')));
  assert.equal(r, false);
  ({ stats: st, record: r } = addGame(st, g(150, 'mobile')));
  assert.equal(r, true);
  assert.equal(bestScore(st.games, 'ordinateur'), 500);
  assert.equal(bestScore(st.games, 'mobile'), 150);
  assert.equal(bestScore(st.games), 500);
  assert.equal(bestScore([], 'mobile'), null);
});

test('un score nul n\'est jamais un record', () => {
  assert.equal(addGame(emptyStats(), g(0, 'mobile')).record, false);
});

test('parties commencées par profil', () => {
  let st = addStart(emptyStats(), 'mobile');
  st = addStart(st, 'mobile');
  st = addStart(st, 'ordinateur');
  assert.deepEqual(st.started, { mobile: 2, ordinateur: 1 });
  assert.throws(() => addStart(st, 'x'));
  const { stats } = addGame(st, g(10, 'mobile'));
  assert.deepEqual(stats.started, { mobile: 2, ordinateur: 1 }, 'terminer une partie ne change pas le nombre de parties commencées');
});

test('ancien format : `started` était un nombre ; on repart du nombre de parties terminées de chaque profil', () => {
  const st = normalizeStats({ started: 9, games: [g(1, 'mobile'), g(2, 'mobile'), g(3, 'ordinateur')] });
  assert.deepEqual(st.started, { mobile: 2, ordinateur: 1 });
  assert.equal(st.games.length, 3);
});

test('contenu corrompu : valeurs valides, parties invalides écartées', () => {
  assert.deepEqual(normalizeStats(null), emptyStats());
  assert.deepEqual(normalizeStats({ games: 'x', started: { mobile: -4 } }), emptyStats());
  const st = normalizeStats({ games: [g(5, 'mobile'), { d: 1 }, g(-3, 'mobile'), g(4, 'inconnu'), g(7, 'ordinateur')], started: { mobile: 6, ordinateur: 'x' } });
  assert.equal(st.games.length, 2);
  assert.deepEqual(st.started, { mobile: 6, ordinateur: 1 });
});

test('les 500 dernières parties seulement', () => {
  let st = emptyStats();
  for (let i = 0; i < MAX_GAMES + 20; i++) st = addGame(st, g(i, 'ordinateur')).stats;
  assert.equal(st.games.length, MAX_GAMES);
  assert.equal(st.games[0].s, 20);
});

test('résumé, classement et dernières parties d\'un profil', () => {
  const games = [g(10, 'mobile', 'a', 30), g(50, 'ordinateur'), g(30, 'mobile', 'b', 90), g(30, 'mobile', 'c', 10)];
  const m = gamesOf(games, 'mobile');
  assert.deepEqual(summarize(m), { played: 3, best: 30, avg: 70 / 3, avgTime: 130 / 3 });
  assert.deepEqual(top(m, 2).map((x) => x.d), ['c', 'b'], 'à égalité, la plus récente d\'abord');
  assert.deepEqual(recent(m, 2).map((x) => x.d), ['c', 'b']);
  assert.deepEqual(summarize([]), { played: 0, best: null, avg: null, avgTime: null });
});
