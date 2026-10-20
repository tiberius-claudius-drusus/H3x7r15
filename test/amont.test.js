/*
 * H3x7r15 — le modèle rejoue les parties enregistrées sur le code ORIGINAL de Hextris
 * (traces produites par `tools/reference-upstream.mjs`, voir `test/fixtures/trace-*.json`).
 * Même graine, mêmes durées d'image, mêmes rotations : score, nombre de blocs et horloge doivent être identiques
 * image par image, jusqu'à la fin de partie.
 * Copyright (C) 2026 Drusus (Gens Claudia) — GPL-3.0-or-later.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HextrisGame, ETAT } from '../src/game.js';

const dossier = new URL('./fixtures/', import.meta.url);
const traces = fs.readdirSync(dossier).filter((f) => /^trace-.*\.json$/.test(f));

test('des traces de référence sont présentes', () => assert.ok(traces.length >= 4));

for (const fichier of traces) {
  test(`rejoue ${fichier} à l'identique`, () => {
    const t = JSON.parse(fs.readFileSync(new URL(fichier, dossier), 'utf8'));
    const profil = t.profil === 'mobile' ? 'mobile' : 'ordinateur';
    // la graine de l'outil de référence est celle du hasard de la partie
    const jeu = new HextrisGame({ profil, graine: t.graine });
    jeu.demarrer();
    let vuFin = false;
    for (let f = 0; f < t.actions.length; f++) {
      const [dt, rot] = t.actions[f];
      if (rot) jeu.tourner(rot);
      jeu.image(dt);
      const attendu = t.trace[f];
      const hex = jeu.voies.reduce((n, v) => n + v.length, 0);
      const obtenu = [jeu.score, hex, jeu.chute.length, jeu.ct, jeu.etat === ETAT.FINI ? 2 : 1];
      assert.deepEqual(obtenu, attendu, `${fichier} : écart à l'image ${f}`);
      if (jeu.etat === ETAT.FINI) vuFin = true;
    }
    assert.ok(vuFin, 'la trace doit aller jusqu\'à la fin de partie');
  });
}
