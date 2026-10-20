/*
 * H3x7r15 — outil de génération des traces de référence
 *
 * Fait tourner le code ORIGINAL de Hextris (copie de lecture seule, passée en argument) dans un bac à sable `vm`, avec
 * un navigateur factice (canvas, jQuery, localStorage muets) et un `Math.random` à graine, puis enregistre ce que fait la
 * partie image par image. Les traces (`test/fixtures/trace-*.json`) servent de référence aux tests du modèle `src/` :
 * même graine, mêmes actions, mêmes durées d'image => même partie (voir `test/amont.test.js`).
 *
 * Ce script n'est PAS livré avec l'application et ne sert qu'à régénérer les traces.
 * Usage : node tools/reference-upstream.mjs <dossier du Hextris amont> [dossier de sortie]
 * Copyright (C) 2026 Drusus (Gens Claudia). Le code amont exécuté ici est de Logan Engstrom et des contributeurs de
 * Hextris (GPL-3.0-or-later) ; seules des valeurs numériques en sortent.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from '../src/rng.js';

const amont = process.argv[2];
const sortie = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');
if (!amont) { console.error('Usage : node tools/reference-upstream.mjs <dossier amont> [sortie]'); process.exit(1); }

const FICHIERS = ['math', 'Hex', 'Block', 'Text', 'checking', 'comboTimer', 'wavegen', 'update', 'view', 'render', 'save-state', 'main'];

const PROFILS = {
  desktop: { platform: 'nonmobile', startDist: 340, creationDt: 9, rows: 8, speedModifier: 0.65, creationSpeedModifier: 0.65 },
  mobile: { platform: 'mobile', startDist: 227, creationDt: 60, rows: 7, speedModifier: 0.73, creationSpeedModifier: 0.73 },
};

function chainable() {
  const f = function () { return p; };
  const p = new Proxy(f, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : p), apply: () => p });
  return p;
}

function creerBac(graine) {
  const alea = mulberry32(graine);
  let horloge = 0;
  const DateFactice = { now: () => (horloge += 100) };
  const bac = {
    console, Math: Object.create(Math), Date: DateFactice, JSON, String, Number, Array, Object,
    navigator: { userAgent: 'Android' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => ({ getContext: () => chainable() }) },
    setTimeout: () => 0,
  };
  bac.Math.random = alea;
  bac.window = bac;
  bac.$ = Object.assign(() => chainable(), { get: () => {}, extend: (_a, _b, c) => c });
  bac.ctx = chainable();
  vm.createContext(bac);
  for (const f of FICHIERS) {
    // le ready() de main.js (lancé par initialization.js) n'est pas chargé : on prépare la partie à la main
    vm.runInContext(fs.readFileSync(path.join(amont, 'js', f + '.js'), 'utf8'), bac, { filename: f + '.js' });
  }
  vm.runInContext('exportSaveState = function () { return "{}"; }; gameOverDisplay = function () {};', bac);
  return bac;
}

/** Prépare la partie comme `init()` et `initialize()` d'origine, à l'échelle 1. */
function preparer(bac, profil) {
  const p = PROFILS[profil];
  vm.runInContext(`
    window.rush = 1; window.gdx = 0; window.gdy = 0; window.history = {}; window.score = 0; window.blocks = [];
    window.colors = ["#e74c3c", "#f1c40f", "#3498db", "#2ecc71"];
    window.angularVelocityConst = 4; window.importing = 0; window.highscores = [];
    window.hexagonBackgroundColor = 'rgb(236, 240, 241)'; window.hexColorsToTintedColors = {}; window.rgbColorsToTintedColors = {};
    window.op = 1; window.scoreOpacity = 1; window.textOpacity = 1;
    window.trueCanvas = { width: 800, height: 800 };
    window.settings = ${JSON.stringify({ ...p, os: 'other', baseScale: 1, scale: 1, prevScale: 1, baseHexWidth: 87, hexWidth: 87,
      baseBlockHeight: 20, blockHeight: 20, speedUpKeyHeld: false, comboTime: 310 })};
    window.gameState = 1;
    window.MainHex = new Hex(settings.hexWidth);
    MainHex.sideLength = settings.hexWidth;
    MainHex.y = -100;
    window.waveone = new waveGen(MainHex);
    MainHex.texts = [];
    MainHex.delay = 15;
  `, bac);
  return p;
}

/** Vue neutre de l'état, la même pour l'amont et pour le modèle : couleurs en indices. */
const LIRE = `(function () {
  var idx = function (c) { return colors.indexOf(c); };
  return {
    ct: MainHex.ct, score: score, position: MainHex.position, etat: gameState,
    difficulty: waveone.difficulty, nextGen: waveone.nextGen,
    lanes: MainHex.blocks.map(function (l) { return l.map(function (b) { return [idx(b.color), b.deleted]; }); }),
    chute: blocks.map(function (b) { return [b.fallingLane, idx(b.color), b.distFromHex, b.iter]; }),
  };
})()`;

/** Pilote simple : tourne vers la voie où le prochain bloc trouvera sa couleur, sinon la voie la moins remplie. */
function choisirRotation(vue, alea) {
  if (!vue.chute.length) return 0;
  const b = vue.chute.reduce((m, x) => (x[2] < m[2] ? x : m));
  let meilleur = 0, meilleurNote = -1;
  for (const pas of [0, 1, -1]) {
    const pos = (((vue.position + pas) % 6) + 6) % 6;
    const voie = (((6 - b[0] + pos) % 6) + 6) % 6;
    const lane = vue.lanes[voie].filter((x) => x[1] === 0);
    const dessus = lane.length ? lane[lane.length - 1][0] : -1;
    const note = (dessus === b[1] ? 100 : 0) + (10 - lane.length) + alea() * 0.5;
    if (note > meilleurNote) { meilleurNote = note; meilleur = pas; }
  }
  return meilleur;
}

function jouer({ profil, graine, images, actifJusqua }) {
  const bac = creerBac(graine);
  preparer(bac, profil);
  const pilote = mulberry32(graine ^ 0x5bd1e995);
  const DT = [1, 1, 1, 1, 0.9, 1.3, 2, 0.6];
  const actions = [];
  const trace = [];
  const etats = [];
  for (let f = 0; f < images; f++) {
    const vue = vm.runInContext(LIRE, bac);
    const dt = DT[Math.floor(pilote() * DT.length)];
    const rot = f % 9 === 0 && f < actifJusqua ? choisirRotation(vue, pilote) : 0;   // puis le pilote s'arrête : fin de partie
    actions.push([dt, rot]);
    // une image d'animLoop (état 1) : rotation éventuelle, rendu, mise à jour, test de fin
    bac.__dt = dt; bac.__rot = rot;
    vm.runInContext(`
      if (__rot) MainHex.rotate(__rot);
      render();
      if (gameState == 1 || gameState == 2) {
        if (!MainHex.delay) update(__dt); else MainHex.delay--;
      }
      if (gameState == 1 && checkGameOver()) gameState = 2;
    `, bac);
    const v = vm.runInContext(LIRE, bac);
    trace.push([v.score, v.lanes.reduce((n, l) => n + l.length, 0), v.chute.length, v.ct, v.etat]);
    if (f % 100 === 99 || v.etat === 2 && !etats.length) etats.push({ image: f, ...v });
    if (v.etat === 2 && f > 0 && trace.length > 1 && trace[trace.length - 2][4] === 2 && (f % 50 === 0)) break;
  }
  return { profil, graine, images: actions.length, actions, trace, etats };
}

fs.mkdirSync(sortie, { recursive: true });
for (const [profil, graine, images, actifJusqua] of [['desktop', 1, 12000, 3000], ['mobile', 2, 12000, 3000], ['desktop', 3, 12000, 5000], ['mobile', 4, 12000, 1500]]) {
  const t = jouer({ profil, graine, images, actifJusqua });
  const fichier = path.join(sortie, `trace-${profil}-${graine}.json`);
  fs.writeFileSync(fichier, JSON.stringify(t));
  const fin = t.trace[t.trace.length - 1];
  console.log(`${path.basename(fichier)} : ${t.images} images, score ${fin[0]}, état final ${fin[4]}`);
}
