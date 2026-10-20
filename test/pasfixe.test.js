/*
 * H3x7r15 — pas fixe : la simulation ne dépend pas de la fréquence de l'écran (audit de Claudius, M1).
 * Licence : GPL-3.0-or-later (voir LICENSE.txt).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PasFixe } from '../src/pasfixe.js';
import { GenerateurVagues } from '../src/wavegen.js';
import { HextrisGame } from '../src/game.js';
import { PROFILS } from '../src/config.js';
import { mulberry32 } from '../src/rng.js';

test('à 60 Hz : une étape par image (au bruit près)', () => {
  const p = new PasFixe();
  let total = 0;
  for (let i = 0; i < 600; i++) total += p.avancer(1);
  assert.equal(total, 600);
});

test('à 120 et 144 Hz : une étape toutes les deux ou trois images, jamais plus de 60 par seconde', () => {
  for (const hz of [90, 120, 144, 240]) {
    const p = new PasFixe();
    let total = 0;
    for (let i = 0; i < hz * 10; i++) total += p.avancer(60 / hz);
    assert.ok(Math.abs(total - 600) <= 1, `${hz} Hz : ${total} étapes en 10 s`);
  }
});

test('un gel de l\'onglet est borné : au plus 3 étapes d\'un coup', () => {
  const p = new PasFixe();
  assert.equal(p.avancer(500), 3);
  assert.equal(p.avancer(0), 0);
  p.remettre();
  assert.equal(p.avancer(0.4), 0);
});

/** Difficulté après `secondes` de jeu, avec la boucle de l'application simulée à `hz` (générateur seul, hasard fixe). */
function difficulte(profil, hz, secondes) {
  const jeu = { ct: 0, reglages: PROFILS[profil], rng: mulberry32(7), blocs: 0, ajouterBloc() { this.blocs++; } };
  const v = new GenerateurVagues(jeu);
  const p = new PasFixe();
  for (let image = 0; image < secondes * hz; image++) {
    for (let i = p.avancer(60 / hz); i > 0; i--) { v.mettreAJour(); jeu.ct += 1; }
  }
  return { difficulte: v.difficulte, blocs: jeu.blocs, prochain: v.prochain };
}

test('même difficulté après 3 minutes à 60, 90, 120 et 144 Hz, pour les deux profils', () => {
  for (const profil of ['mobile', 'ordinateur']) {
    const ref = difficulte(profil, 60, 180);
    for (const hz of [90, 120, 144]) {
      const d = difficulte(profil, hz, 180);
      assert.ok(Math.abs(d.difficulte - ref.difficulte) < 0.02, `${profil} ${hz} Hz : ${d.difficulte} contre ${ref.difficulte} à 60 Hz`);
      assert.ok(Math.abs(d.blocs - ref.blocs) <= 2, `${profil} ${hz} Hz : ${d.blocs} blocs contre ${ref.blocs}`);
    }
  }
});

test('sans pas fixe, l\'écart que l\'audit a mesuré existe bien (garde-fou du test)', () => {
  // un appel par image avec dt = 60/hz, comme l'ancienne boucle : la difficulté monte plus vite à 144 Hz
  const jeu = { ct: 0, reglages: PROFILS.ordinateur, rng: mulberry32(7), ajouterBloc() {} };
  const v = new GenerateurVagues(jeu);
  for (let i = 0; i < 180 * 144; i++) { v.mettreAJour(); jeu.ct += 60 / 144; }
  assert.ok(v.difficulte > difficulte('ordinateur', 60, 180).difficulte + 3);
});

test('durée réelle d\'une partie : une étape = 1/60 s, même avec l\'accélération', () => {
  const j = new HextrisGame({ graine: 3 });
  j.demarrer();
  for (let i = 0; i < 600; i++) j.image(4);       // dix secondes réelles, flèche du bas enfoncée
  assert.equal(j.pas, 600);
  assert.equal(j.ct, 4 * (600 - 15));              // l'horloge du jeu a avancé quatre fois plus vite (moins les 15 images de grâce)
  const k = new HextrisGame({ graine: 99 });
  k.importer(JSON.parse(JSON.stringify(j.exporter())));
  assert.equal(k.pas, 600, 'le compteur survit à la sauvegarde');
});
