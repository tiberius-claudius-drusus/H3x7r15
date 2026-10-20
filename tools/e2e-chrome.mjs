#!/usr/bin/env node
/*
 * H3x7r15 — banc d'essai de bout en bout dans Chrome (sans interface, piloté par DevTools).
 * Copyright (C) 2026 Drusus (Gens Claudia). Licence : GPL-3.0-or-later (voir LICENSE.txt).
 * Structure reprise du banc de T-7r4V3x (même auteur).
 *
 * Ce que ne couvrent pas les tests unitaires (`npm test`) : l'interface réelle : toucher et clavier, boîtes de dialogue,
 * pause, sauvegarde et reprise, partage, victoire, meilleurs temps.
 *
 * Usage :  npm run e2e                      (ou : node tools/e2e-chrome.mjs [--shots dossier])
 * Chrome :  variable d'environnement CHROME, sinon les emplacements usuels (Windows, macOS, Linux).
 * Aucun fichier du dépôt n'est modifié ; profil Chrome temporaire supprimé à la fin. Code de sortie 1 si un contrôle échoue.
 *
 * Pièges (hérités de T-7r4V3x) :
 *  - l'application sauvegarde sa partie en quittant la page : poser un état de test en quittant d'abord l'application
 *    (`reloadWith`), jamais par `localStorage.setItem` suivi d'un `reload` ;
 *  - `Input.dispatch*Event` est asynchrone : laisser une courte pause avant de lire le DOM.
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > -1 ? path.resolve(process.argv[shotsArg + 1] ?? 'e2e-shots') : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean).find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('Chrome introuvable : définir la variable CHROME (chemin de l\'exécutable).');
  process.exit(2);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const DEBUG_PORT = await freePort();
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'h3x7r15-e2e-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=430,860',
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
function cleanup() {
  try { ws.close(); } catch { /* déjà fermé */ }
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  else chrome.kill();
  server.close();
  setTimeout(() => { try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* verrouillé : sans importance */ } process.exit(process.exitCode ?? 0); }, 800);
}

let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); if (targets.some((t) => t.type === 'page')) break; } catch { /* Chrome démarre */ }
  await sleep(200);
}
const page = targets?.find((t) => t.type === 'page');
if (!page) { console.error('Chrome n\'a pas démarré.'); process.exit(2); }
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
const cspErrors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Log.entryAdded' && /Content Security Policy|Refused to/.test(d.params.entry.text ?? '')) cspErrors.push(d.params.entry.text);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result.result.value;
};
const key = async (k, extra = {}) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k.length === 1 ? k : undefined, ...extra });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, ...extra });
  await sleep(60);
};
const shot = async (name) => {
  if (!SHOTS) return;
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64'));
};
const results = [];
const check = (name, ok, info = '') => { results.push([ok, name, info]); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` ${info}` : ''}`); };
const section = async (title, fn) => {
  console.log(`\n== ${title}`);
  try { await fn(); } catch (e) { check(`${title} : exception`, false, String(e.message).slice(0, 300)); }
};

const gotoPage = async (url) => {
  await send('Page.navigate', { url });
  for (let i = 0; i < 50; i++) { await sleep(150); try { if ((await ev('location.href')).startsWith(url.split('?')[0])) break; } catch { /* navigation en cours */ } }
  await sleep(250);
};
/** Recharge l'application avec un localStorage préparé : { clé: valeur JSON }. */
const reloadWith = async (store) => {
  await gotoPage(`${BASE}/sw.js`);
  await ev(`localStorage.clear(); ${Object.entries(store).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join(' ')}`);
  await gotoPage(`${BASE}/index.html`);
  await sleep(700);
};
const click = (sel, i = 0) => ev(`document.querySelectorAll(${JSON.stringify(sel)})[${i}].click()`);
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
const isOpen = (id) => ev(`document.getElementById(${JSON.stringify(id)}).open`);
await send('Runtime.enable');
// Langue du navigateur fixée au français : le banc ne dépend pas de la langue du système qui l'exécute.
{
  const ua = (await send('Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true })).result.result.value;
  await send('Emulation.setUserAgentOverride', { userAgent: ua, acceptLanguage: 'fr-FR,fr' });
}
await send('Page.enable');
await send('Log.enable');
const sauvegarde = () => ev(`JSON.parse(localStorage.getItem('h3x7r15:savefile') || 'null')`);
const vue = () => ev(`document.body.dataset.view`);
const pixel = (dx, dy) => ev(`(() => { const c = document.getElementById('canvas'); const d = window.devicePixelRatio || 1;
  const p = c.getContext('2d').getImageData(Math.round(c.width / 2 + ${dx} * d), Math.round(c.height / 2 + ${dy} * d), 1, 1).data; return [p[0], p[1], p[2], p[3]]; })()`);
const cliquerCanvas = async (fx, fy = 0.5) => {
  const r = await ev(`(() => { const b = document.getElementById('canvas').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  const x = r[0] + r[2] * fx, y = r[1] + r[3] * fy;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(120);
};
const pauseEtLire = async () => { await key('p'); await sleep(150); return sauvegarde(); };

await section('Accueil', async () => {
  await reloadWith({});
  check('au démarrage : la page d\'accueil, pas le jeu', await vue() === 'home' && await ev(`getComputedStyle(document.getElementById('stage')).display === 'none'`));
  check('titre et logo', await ev(`document.getElementById('home-title').textContent === 'H3x7r15' && document.querySelector('#logo svg') !== null`));
  check('sans partie : exactement Nouvelle partie, Options, Statistiques, Aide', await ev(`[...document.querySelectorAll('#home .homemenu button')].filter((b) => !b.hidden).map((b) => b.textContent).join('|')`) === 'Nouvelle partie|Options|Statistiques|Aide');
  const foot = await text('#h-ver');
  check('pied de page, 1re ligne : version, auteur, date', /^v\d+\.\d+\.\d+ - développé par Drusus - \d{4}-\d\d-\d\d$/.test(foot), foot);
  check('pied de page, 2e ligne : inspiration', /^Inspiré de Hextris, de Logan Engstrom/.test(await text('#h-inspired')));
  const lay = await ev(`(() => {
    const r = (el) => el.getBoundingClientRect();
    const btns = [...document.querySelectorAll('#home .homemenu button')].filter((b) => !b.hidden);
    const rects = btns.map(r);
    const logo = r(document.getElementById('logo')), h1 = r(document.getElementById('home-title'));
    return { iw: window.innerWidth, ih: window.innerHeight, n: btns.length, widths: rects.map((x) => Math.round(x.width)),
      centres: rects.map((x) => Math.round(x.left + x.width / 2)), gaps: rects.slice(1).map((x, i) => Math.round(x.top - rects[i].bottom)),
      h1Px: parseFloat(getComputedStyle(document.getElementById('home-title')).fontSize), logoH: Math.round(logo.height),
      logoCentre: Math.round(logo.left + logo.width / 2), h1Centre: Math.round(h1.left + h1.width / 2) };
  })()`);
  const c0 = lay.iw / 2;
  check('accueil calqué sur 5ud0ku : boutons de min(78vw, 300px), centrés, 12 px entre eux', lay.n === 4 && lay.widths.every((w) => w === Math.min(Math.round(lay.iw * 0.78), 300))
    && lay.centres.every((x) => Math.abs(x - c0) <= 2) && lay.gaps.every((g) => g === 12), JSON.stringify(lay));
  check('accueil : titre de 2,6 rem, logo et titre centrés, logo de 21 % de la hauteur', Math.abs(lay.h1Px - 41.6) < 0.2 && Math.abs(lay.logoCentre - c0) <= 2 && Math.abs(lay.h1Centre - c0) <= 2
    && Math.abs(lay.logoH - Math.min(200, Math.max(96, Math.round(lay.ih * 0.21)))) <= 2);
  check('aucun défilement sur la page d\'accueil', await ev(`document.documentElement.scrollHeight <= window.innerHeight + 2`));
  await shot('0-accueil');
});

await section('Nouvelle partie : dessin, rotation, pause', async () => {
  await reloadWith({});
  await click('#h-new');
  await sleep(700);
  check('le jeu remplace l\'accueil', await vue() === 'game' && await ev(`getComputedStyle(document.getElementById('home')).display === 'none'`));
  const taille = await ev(`(() => { const c = document.getElementById('canvas'); return [c.width, c.height, c.clientWidth, c.clientHeight]; })()`);
  check('le canvas a la taille de la zone de jeu', taille[2] > 200 && taille[3] > 200 && taille[0] >= taille[2], JSON.stringify(taille));
  check('l\'hexagone central est dessiné (pixel de la couleur du thème)', JSON.stringify((await pixel(0, 34)).slice(0, 3)) === '[44,62,80]', JSON.stringify(await pixel(0, 34)));
  check('l\'anneau gris est dessiné', await ev(`(() => { const c = document.getElementById('canvas'); const d = window.devicePixelRatio || 1;
    const p = c.getContext('2d').getImageData(Math.round(c.width / 2), Math.round(c.height / 2 - 100 * d), 1, 1).data; return p[3] > 0; })()`));
  check('score à 0 et meilleur score absent', await text('#score') === '0' && /Aucun record/.test(await text('#g-best')));
  check('aide affichée au début', await ev(`!document.getElementById('hint').hidden`));
  check('aucun défilement de la page en jeu', await ev(`document.documentElement.scrollHeight <= window.innerHeight + 2`));
  await shot('1-jeu');
  // rotation au clavier (une touche, puis pause pour lire la sauvegarde)
  await key('ArrowLeft'); await sleep(100);
  let s = await pauseEtLire();
  check('flèche gauche : rotation de +1', s?.rotationTotale === 1 && s?.position === 1, JSON.stringify([s?.rotationTotale, s?.position]));
  check('pause : le voile et le bouton Reprendre apparaissent, partie enregistrée en pause', await ev(`!document.getElementById('pause').hidden`) && s?.etat === 'pause');
  const ct1 = s.ct; await sleep(600); s = await sauvegarde();
  check('en pause, l\'horloge du jeu est figée', s.ct === ct1, `${ct1} / ${s.ct}`);
  await key('p'); await sleep(150);
  check('P reprend : le voile disparaît', await ev(`document.getElementById('pause').hidden`));
  await key('ArrowRight'); await sleep(120);
  await key('d'); await sleep(120);
  s = await pauseEtLire();
  check('flèche droite et D : rotation de -2 en tout, position repliée dans 0..5', s?.rotationTotale === -1 && s?.position === 5, JSON.stringify([s?.rotationTotale, s?.position]));
  await key('p'); await sleep(150);
  // toucher : gauche puis droite de l'écran
  await cliquerCanvas(0.2); await sleep(100);
  s = await pauseEtLire();
  check('toucher à gauche de l\'écran : +1', s?.rotationTotale === 0, String(s?.rotationTotale));
  await key('p'); await sleep(150);
  await cliquerCanvas(0.8); await sleep(100);
  s = await pauseEtLire();
  check('toucher à droite de l\'écran : -1', s?.rotationTotale === -1, String(s?.rotationTotale));
  await click('#b-resume'); await sleep(150);
  check('le bouton Reprendre relance la partie', await ev(`document.getElementById('pause').hidden`));
});

await section('Le jeu tourne : les blocs apparaissent, tombent et sont dessinés', async () => {
  await reloadWith({});
  await click('#h-new');
  await sleep(4200);
  const s = await pauseEtLire();
  check('au bout de quelques secondes, des blocs sont en jeu', (s?.chute?.length ?? 0) + (s?.voies?.flat().length ?? 0) > 0, JSON.stringify([s?.chute?.length, s?.ct]));
  check('l\'horloge a avancé', s?.ct > 100, String(s?.ct));
  check('la sauvegarde a la bonne forme', s?.v === 1 && s?.profil === 'ordinateur' && Array.isArray(s?.voies) && s.voies.length === 6, JSON.stringify([s?.v, s?.profil]));
  await shot('2-blocs');
});

await section('Sauvegarde et reprise', async () => {
  await reloadWith({});
  await click('#h-new');
  await sleep(1500);
  await key('ArrowLeft'); await sleep(100);
  const avant = await pauseEtLire();
  await gotoPage(`${BASE}/index.html`);
  await sleep(700);
  check('après rechargement : accueil avec le bouton Continuer', await vue() === 'home' && await ev(`!document.getElementById('h-continue').hidden`));
  await click('#h-continue');
  await sleep(500);
  check('Continuer : le jeu revient en pause, même position et même horloge', await vue() === 'game' && await ev(`!document.getElementById('pause').hidden`), '');
  const apres = await sauvegarde();
  check('la partie reprise est celle qui avait été laissée', apres?.rotationTotale === avant?.rotationTotale && Math.abs(apres.ct - avant.ct) < 1, JSON.stringify([avant?.ct, apres?.ct]));
  await click('#b-resume'); await sleep(400);
  await shot('3-reprise');
  // sauvegarde corrompue : mise de côté, plus de bouton Continuer
  await reloadWith({ 'h3x7r15:savefile': { v: 1, profil: 'ordinateur', score: 3, voies: 'x' } });
  check('sauvegarde illisible : le bouton Continuer est tout de même proposé (score lisible)…', await ev(`!document.getElementById('h-continue').hidden`));
  await ev(`window.alert = () => {}`);
  await click('#h-continue');
  await sleep(300);
  check('…puis elle est mise de côté et le bouton disparaît', await vue() === 'home' && await ev(`document.getElementById('h-continue').hidden && localStorage.getItem('h3x7r15:savefile') === null && localStorage.getItem('h3x7r15:savefile.illisible') !== null`));
});

await section('Fin de partie, statistiques, record', async () => {
  // une partie à un bloc du débordement : on la fabrique avec le modèle de l'application
  await reloadWith({});
  const save = await ev(`(async () => {
    const { HextrisGame } = await import('/src/game.js');
    const g = new HextrisGame({ profil: 'ordinateur', graine: 7 });
    g.demarrer(); g.delai = 0;
    for (let i = 0; i < 9; i++) g.voies[2].push({ settled: 1, height: 20, fallingLane: 0, checked: 0, angle: 0, angularVelocity: 0, targetAngle: 0, color: i % 2, deleted: 0,
      removed: 0, tint: 0, opacity: 1, initializing: 0, ict: 0, iter: 1, attachedLane: 2, distFromHex: 75.34 + 20 * i });
    g.score = 1234;
    g.pause();
    return g.exporter();
  })()`);
  await reloadWith({ 'h3x7r15:savefile': save });
  await click('#h-continue');
  await sleep(300);
  await click('#b-resume');
  await sleep(1500);
  check('la voie qui déborde met fin à la partie : boîte de fin avec le score', await isOpen('over') && /1234/.test(await text('#over-score')), await text('#over-score'));
  check('premier score : nouveau record', /record/i.test(await text('#over-record')));
  const data = await ev(`JSON.parse(localStorage.getItem('h3x7r15:data'))`);
  check('la partie est comptée dans les statistiques, la sauvegarde est effacée', data?.stats?.games?.length === 1 && data.stats.games[0].s === 1234 && await ev(`localStorage.getItem('h3x7r15:savefile') === null`));
  await shot('4-fin');
  await click('#over-close');
  check('Fermer ramène à l\'accueil, sans bouton Continuer', await vue() === 'home' && await ev(`document.getElementById('h-continue').hidden`));
  await click('#h-stats');
  check('statistiques : une partie, meilleur score 1234', await isOpen('stats') && /1234/.test(await text('#stats-body')) && /Parties terminées/.test(await text('#stats-body')));
  await shot('5-stats');
  await click('#stats-close');
  await click('#h-new'); await sleep(500);
  check('le meilleur score est affiché dans le bandeau', /1234/.test(await text('#g-best')), await text('#g-best'));
});

await section('Options : thème, daltonisme, langue', async () => {
  await reloadWith({});
  await click('#h-options');
  check('options ouvertes : langue, thème, apparence, réglages, daltonisme, accélération, inversion', await isOpen('options') && await ev(`document.querySelectorAll('#options-body .opt').length`) === 7);
  await ev(`(() => { const s = document.querySelectorAll('#options-body select')[1]; s.value = 'claudia'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(150);
  check('changer de famille de thème pose les variables', await ev(`document.documentElement.dataset.theme.startsWith('claudia')`));
  await ev(`(() => { const s = document.querySelectorAll('#options-body select')[2]; s.value = 'fonce'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(150);
  check('mode foncé : variante foncée, centre de l\'hexagone clair', await ev(`document.documentElement.dataset.theme === 'claudia-fonce' && getComputedStyle(document.documentElement).getPropertyValue('--hx-center').trim() === '#c9d1dc'`));
  await ev(`(() => { const b = document.querySelectorAll('#options-body input[type=checkbox]')[0]; b.checked = true; b.dispatchEvent(new Event('change')); })()`);
  await sleep(100);
  check('daltonisme mémorisé', await ev(`JSON.parse(localStorage.getItem('h3x7r15:prefs')).colorblind === true`));
  await ev(`(() => { const s = document.querySelectorAll('#options-body select')[0]; s.value = 'en'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(400);
  check('langue anglaise : boutons de l\'accueil traduits', await text('#h-new') === 'New game' && await ev(`document.documentElement.lang`) === 'en');
  await shot('6-options');
  await click('#options-close');
  // les préférences survivent au rechargement
  await gotoPage(`${BASE}/index.html`); await sleep(600);
  check('préférences conservées après rechargement', await ev(`document.documentElement.dataset.theme === 'claudia-fonce' && document.documentElement.lang === 'en'`));
});

await section('Commandes : droite = sens horaire, gauche = anti-horaire, et l\'option pour les inverser', async () => {
  await reloadWith({});
  await click('#h-new'); await sleep(500);
  await cliquerCanvas(0.8); await sleep(100);
  let s = await pauseEtLire();
  check('par défaut, toucher à droite : pas -1 du modèle (sens horaire)', s?.rotationTotale === -1, String(s?.rotationTotale));
  await key('p'); await sleep(150);
  await cliquerCanvas(0.2); await sleep(100); await cliquerCanvas(0.2); await sleep(100);
  s = await pauseEtLire();
  check('par défaut, toucher à gauche (deux fois) : pas +1 chacun (sens anti-horaire)', s?.rotationTotale === 1, String(s?.rotationTotale));
  await key('p'); await sleep(150);
  // active l'option depuis l'accueil
  await click('#b-menu'); await click('#m-home'); await sleep(200);
  await click('#h-options'); await sleep(150);
  await ev(`(() => { const b = document.querySelectorAll('#options-body input[type=checkbox]')[2]; b.checked = true; b.dispatchEvent(new Event('change')); })()`);
  await click('#options-close');
  check('l\'option est mémorisée', await ev(`JSON.parse(localStorage.getItem('h3x7r15:prefs')).invertControls === true`));
  await click('#h-new'); await sleep(500);
  await cliquerCanvas(0.2); await sleep(100);
  s = await pauseEtLire();
  check('commandes inversées, toucher à gauche : sens horaire (pas -1)', s?.rotationTotale === -1, String(s?.rotationTotale));
  await key('p'); await sleep(150);
  await cliquerCanvas(0.8); await sleep(100); await cliquerCanvas(0.8); await sleep(100);
  s = await pauseEtLire();
  check('commandes inversées, toucher à droite (deux fois) : sens anti-horaire (pas +1 chacun)', s?.rotationTotale === 1, String(s?.rotationTotale));
  await key('p'); await sleep(150);
  await key('ArrowLeft'); await sleep(100);
  s = await pauseEtLire();
  check('commandes inversées, flèche gauche : sens horaire aussi au clavier', s?.rotationTotale === 0, String(s?.rotationTotale));
});

await section('Mise en page sur trois tailles de téléphone', async () => {
  for (const [w, h] of [[430, 860], [390, 760], [360, 640]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await reloadWith({});
    check(`${w}×${h} : accueil sans défilement`, await ev(`document.documentElement.scrollHeight <= window.innerHeight + 2`));
    await click('#h-new'); await sleep(600);
    const m = await ev(`(() => { const c = document.getElementById('canvas').getBoundingClientRect(); const h = document.querySelector('header').getBoundingClientRect();
      return { scroll: document.documentElement.scrollHeight - window.innerHeight, canvasW: Math.round(c.width), canvasH: Math.round(c.height), headerBottom: Math.round(h.bottom), canvasTop: Math.round(c.top) }; })()`);
    check(`${w}×${h} : jeu sans défilement, canvas sous le bandeau`, m.scroll <= 2 && m.canvasTop >= m.headerBottom - 1 && m.canvasH > 300, JSON.stringify(m));
    // l'anneau gris tient dans le canvas : un pixel de l'anneau à gauche, un à droite
    check(`${w}×${h} : l'anneau est entièrement visible`, await ev(`(() => { const c = document.getElementById('canvas'); const ctx = c.getContext('2d'); const d = window.devicePixelRatio || 1;
      const sc = Math.min(c.clientWidth, c.clientHeight) / 800 * 1.4; const r = (7 * 20 * 2 / Math.sqrt(3) + 87) * sc;
      const y = Math.round(c.height / 2); const g = (x) => ctx.getImageData(Math.round(x), y, 1, 1).data[3];
      return r * 2 <= c.clientWidth + 1 || (g(c.width / 2 - (r - 3) * d) > 0 && g(c.width / 2 + (r - 3) * d) > 0); })()`));
    await shot(`7-${w}x${h}`);
  }
  await send('Emulation.clearDeviceMetricsOverride');
});

check('aucune violation de la politique de sécurité du contenu pendant tout le banc', cspErrors.length === 0, cspErrors.slice(0, 2).join(' | ').slice(0, 300));

const failed = results.filter((r) => !r[0]).length;
console.log(`
${failed} échec(s) sur ${results.length} contrôle(s)`);
process.exitCode = failed ? 1 : 0;
cleanup();
