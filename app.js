/*
 * H3x7r15 — portage PWA de Hextris : interface
 * Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * Toute la logique de jeu est dans src/ (modèle, vagues, session, dessin) ; ce fichier ne fait que relier les gestes
 * (toucher, clavier), la boucle d'animation et les boîtes de dialogue.
 */
import { Session, PROFIL_CHOIX } from './src/session.js';
import { ETAT } from './src/game.js';
import { Vue } from './src/render.js';
import { t, setDictionary, formatTime } from './src/strings.js';
import { LANGUAGES, pickLanguage, loadLanguage, directionOf } from './src/lang/index.js';
import { ICONS } from './src/icons.js';
import { THEMES, MODES, apply as applyTheme } from './src/themes.js';
import { summarize, top, recent, gamesOf, PROFILS } from './src/stats.js';
import { PasFixe } from './src/pasfixe.js';
import { VERSION, RELEASE_DATE } from './src/version.js';
import { logoSvg } from './src/logo.js';

const $ = (id) => document.getElementById(id);

function safeStorage() {
  try {
    const s = window.localStorage;
    s.setItem('h3x7r15:test', '1');
    s.removeItem('h3x7r15:test');
    return s;
  } catch { return null; }
}

const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
const session = new Session({ storage: safeStorage(), coarsePointer: coarse });
const canvas = $('canvas');
let vue = null;                 // dessin de la partie en cours
let view = 'home';              // 'home' (page d'accueil) ou 'game' (le jeu)
let rush = 1;                   // accélération de la chute (flèche du bas)
let dernierTemps = 0;
const pasFixe = new PasFixe();
let derniereAnnonce = 0;        // dernière annonce du score aux lecteurs d'écran (au plus une toutes les 5 s)
let derniereRotation = 0;
let dernierScore = -1;
let pauseAuto = false;

// --- textes et pictogrammes ---

function applyTexts() {
  document.title = t('app.title');
  $('b-menu').innerHTML = ICONS.menu;
  $('b-menu').setAttribute('aria-label', t('game.menu'));
  $('b-menu').title = t('game.menu');
  $('b-pause').setAttribute('aria-label', t('game.pause'));
  $('b-pause').title = t('game.pause');
  $('b-pause').innerHTML = ICONS.pause;
  $('b-resume').textContent = t('game.resume');
  $('pause-text').textContent = t('game.paused');
  $('h-new').textContent = t('home.new');
  $('h-continue').textContent = t('home.continue');
  $('h-options').textContent = t('home.options');
  $('h-stats').textContent = t('home.stats');
  $('h-help').textContent = t('home.help');
  $('h-ver').textContent = t('home.foot', { version: VERSION, date: RELEASE_DATE }).replace(/ - $/, '');
  $('h-inspired').textContent = t('foot.inspired', { name: 'Hextris' });
  $('menu-title').textContent = t('menu.title');
  $('m-resume').textContent = t('menu.resume');
  $('m-home').textContent = t('menu.home');
  $('m-restart').textContent = t('menu.restart');
  $('m-stats').textContent = t('menu.stats');
  $('m-options').textContent = t('menu.options');
  $('m-help').textContent = t('menu.help');
  $('m-about').textContent = t('menu.about');
  $('over-title').textContent = t('over.title');
  $('over-close').textContent = t('over.close');
  $('over-new').textContent = t('over.new');
  $('stats-title').textContent = t('stats.title');
  $('stats-reset').textContent = t('stats.reset');
  $('stats-close').textContent = t('dialog.close');
  $('options-title').textContent = t('options.title');
  $('options-close').textContent = t('dialog.close');
  $('help-title').textContent = t('help.title');
  for (let i = 1; i <= 4; i++) $(`help-${i}`).textContent = t(`help.${i}`);
  $('help-about').textContent = t('menu.about');
  $('help-close').textContent = t('dialog.close');
  $('about-title').textContent = t('about.title');
  $('about-text').textContent = t('about.text');
  $('about-version').textContent = t('about.version', { version: VERSION, date: RELEASE_DATE });
  $('about-code').textContent = t('about.code');
  $('about-licence').textContent = t('about.licence');
  $('about-close').textContent = t('dialog.close');
  renderBest();
}

// --- thème et palette ---

const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function applyPalette() {
  if (!vue) return;
  const css = getComputedStyle(document.documentElement);
  const v = (nom) => css.getPropertyValue(nom).trim();
  const pref = session.preferences.colorblind ? 'd' : 'c';
  vue.regler({
    palette: [0, 1, 2, 3].map((i) => v(`--hx-${pref}${i}`)),
    centre: v('--hx-center'), anneau: v('--hx-ring'), texte: v('--hx-text'),
  });
}

function applyPreferredTheme() {
  applyTheme({ family: session.preferences.themeFamily, mode: session.preferences.themeMode }, Boolean(darkQuery?.matches));
  applyPalette();
}

// --- le jeu ---

function nouvelleVue() {
  vue = new Vue(canvas, session.game);
  session.game.surEvenement = (type, d) => { vue.surEvenement(type, d); session._surEvenement(type, d); };
  applyPalette();
  dimensionner();
  dernierScore = -1;
  derniereRotation = 0;
}

function dimensionner() {
  if (!vue) return;
  const r = $('stage').getBoundingClientRect();
  if (r.width > 0 && r.height > 0) vue.redimensionner(Math.round(r.width), Math.round(r.height), window.devicePixelRatio || 1);
}

function renderBest() {
  const best = session.bestScore();     // meilleur score du profil de la partie (tactile et ordinateur séparés)
  $('g-best').textContent = best === null ? t('game.nobest') : t('game.best', { best });
}

function renderHud() {
  const g = session.game;
  if (!g) return;
  if (g.score !== dernierScore) {
    dernierScore = g.score;
    $('score').textContent = String(g.score);
  }
  const enPause = g.etat === ETAT.PAUSE;
  $('pause').hidden = !enPause;
  $('b-pause').innerHTML = enPause ? ICONS.play : ICONS.pause;
  $('b-pause').setAttribute('aria-label', t(enPause ? 'game.resume' : 'game.pause'));
}

/**
 * Boucle d'animation. La simulation fait toujours 60 étapes par seconde (`PasFixe`), quel que soit l'écran : sans cela,
 * la difficulté montait 34 à 46 % plus vite à 120-144 Hz (audit de Claudius, M1). Chaque étape dure 1 image, ou 4 avec
 * la flèche du bas (accélération). Le dessin suit l'écran.
 */
function boucle(maintenant) {
  requestAnimationFrame(boucle);
  if (view !== 'game' || !session.game || !vue) { dernierTemps = maintenant; pasFixe.remettre(); return; }
  const g = session.game;
  const pas = pasFixe.avancer((maintenant - dernierTemps) / 16.666);
  dernierTemps = maintenant;
  let dt = 0;
  for (let i = 0; i < pas; i++) {
    if (g.etat !== ETAT.JEU && g.etat !== ETAT.FINI) break;
    g.image(rush);
    dt += rush;
  }
  vue.dessiner(dt);
  renderHud();
}

/** Relance l'horloge de la boucle (reprise de la pause, retour sur la page) et lâche l'accélération. */
function repartir() {
  dernierTemps = performance.now();
  pasFixe.remettre();
  rush = 1;      // une flèche du bas relâchée hors de la page ne doit pas laisser l'accélération (audit F1)
}

/**
 * Sens de rotation pour la gauche et la droite (toucher et clavier). Par défaut, comme l'amont : gauche = sens
 * anti-horaire (pas +1 du modèle), droite = sens horaire (pas -1). L'option « inverser les commandes » les échange.
 */
const gauche = () => (session.preferences.invertControls ? -1 : 1);
const droite = () => (session.preferences.invertControls ? 1 : -1);

function tourner(pas) {
  const g = session.game;
  if (!g || view !== 'game' || g.etat !== ETAT.JEU) return;
  // l'amont limite la rotation à un pas toutes les 75 ms au clavier d'ordinateur
  const maintenant = performance.now();
  if (g.profil === 'ordinateur' && maintenant - derniereRotation < 75) return;
  derniereRotation = maintenant;
  g.tourner(pas);
}

function basculerPause() {
  const g = session.game;
  if (!g) return;
  if (g.etat === ETAT.JEU) { g.pause(); rush = 1; session.saveGame(); }
  else if (g.etat === ETAT.PAUSE) { g.reprendre(); pauseAuto = false; repartir(); }
  renderHud();
}

function afficherAide() {
  const g = session.game;
  const h = $('hint');
  h.textContent = t(g.profil === 'mobile' ? 'game.hint.touch' : 'game.hint.keys');
  h.hidden = false;
  h.classList.remove('off');
  clearTimeout(afficherAide.minuteur);
  afficherAide.minuteur = setTimeout(() => {
    h.classList.add('off');
    afficherAide.minuteur = setTimeout(() => { h.hidden = true; }, 700);
  }, 9000);
}

function demarrerPartie() {
  closeAll();
  session.newGame();
  nouvelleVue();
  showGame();
  afficherAide();
}

// --- accueil et navigation ---

function showHome() {
  closeAll();
  const g = session.game;
  if (view === 'game' && g?.etat === ETAT.JEU) { g.pause(); }
  session.saveGame();
  view = 'home';
  document.body.dataset.view = 'home';
  renderHome();
  $(continuable() ? 'h-continue' : 'h-new').focus({ preventScroll: true });
}

function showGame() {
  view = 'game';
  document.body.dataset.view = 'game';
  dimensionner();
  repartir();
  renderHud();
}

/** Partie en cours (en mémoire) ou sauvegardée : vrai s'il y a quelque chose à reprendre. */
function continuable() {
  const g = session.game;
  if (g && g.etat !== ETAT.FINI) return true;
  return g ? false : Boolean(session.savedInfo());
}

function renderHome() {
  const btn = $('h-continue');
  btn.hidden = !continuable();
  btn.textContent = t('home.continue');
}

function continueGame() {
  if (session.game && session.game.etat !== ETAT.FINI) { showGame(); return; }
  if (session.resume()) { nouvelleVue(); showGame(); return; }
  renderHome();                                   // la sauvegarde illisible a été mise de côté : plus de bouton « Continuer »
  window.alert(t('home.save.unreadable'));
}

// --- boîtes de dialogue ---

function open(id) { const d = $(id); if (!d.open) d.showModal(); }

function closeAll() { for (const d of document.querySelectorAll('dialog[open]')) d.close(); }

function mettreEnPauseSiJeu() {
  const g = session.game;
  if (view === 'game' && g?.etat === ETAT.JEU) { g.pause(); rush = 1; session.saveGame(); }
}

function ligne(...cellules) {
  const tr = document.createElement('tr');
  for (const [texte, balise = 'td'] of cellules) {
    const c = document.createElement(balise);
    c.textContent = texte;
    tr.append(c);
  }
  return tr;
}

function tableau(titreCle, entetes, lignes) {
  const frag = document.createDocumentFragment();
  const h = document.createElement('h3');
  h.textContent = t(titreCle);
  const table = document.createElement('table');
  table.append(ligne(...entetes.map((e) => [t(e), 'th'])), ...lignes.map((l) => ligne(...l.map((x) => [x]))));
  frag.append(h, table);
  return frag;
}

/** Statistiques séparées par profil de jeu (tactile et ordinateur n'ont pas les mêmes réglages : décision de l'Auctor). */
function renderStats() {
  const { games, started } = session.stats;
  const box = $('stats-body');
  box.replaceChildren();
  $('stats-reset').hidden = games.length === 0 && PROFILS.every((p) => started[p] === 0);
  if (!games.length) {
    const p = document.createElement('p');
    p.textContent = t('stats.none');
    box.append(p);
    return;
  }
  const fmt = (g) => [g.d, String(g.s), formatTime(g.t)];
  const entetes = ['stats.col.date', 'stats.col.score', 'stats.col.time'];
  for (const profil of PROFILS) {
    const jeux = gamesOf(games, profil);
    if (!jeux.length) continue;
    const titre = document.createElement('h3');
    titre.textContent = t(`profil.${profil}`);
    const s = summarize(jeux);
    const resume = document.createElement('table');
    const lignes = [
      [t('stats.played'), String(s.played)], [t('stats.started'), String(started[profil])], [t('stats.best'), String(s.best)],
      [t('stats.avg'), String(Math.round(s.avg))], [t('stats.avgtime'), formatTime(s.avgTime)],
    ];
    for (const [a, b] of lignes) resume.append(ligne([a], [b]));
    box.append(titre, resume);
    box.append(tableau('stats.top', entetes, top(jeux, 5).map(fmt)));
    box.append(tableau('stats.last', entetes, recent(jeux, 5).map(fmt)));
  }
}

function openOptions() {
  const body = $('options-body');
  body.replaceChildren();
  // la langue en premier : quelqu'un qui tombe sur une interface qu'il ne lit pas doit la trouver tout de suite
  body.append(
    selectRow('options.lang', [['auto', t('options.lang.auto')], ...LANGUAGES.map((l) => [l.code, l.name])], session.preferences.lang, (v) => session.setPreference('lang', v)),
    selectRow('options.theme', Object.entries(THEMES).map(([k, f]) => [k, f.label]), session.preferences.themeFamily, (v) => session.setPreference('themeFamily', v)),
    selectRow('options.mode', MODES.map((m) => [m, t(`mode.${m}`)]), session.preferences.themeMode, (v) => session.setPreference('themeMode', v)),
    selectRow('options.profil', PROFIL_CHOIX.map((p) => [p, t(`profil.${p}`)]), session.preferences.profil, (v) => session.setPreference('profil', v)),
    caseACocher('options.colorblind', 'colorblind'),
    caseACocher('options.speedup', 'speedUpKey'),
    caseACocher('options.invert', 'invertControls'),
  );
  open('options');
}

function caseACocher(cle, nom) {
  const label = document.createElement('label');
  label.className = 'opt';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = session.preferences[nom];
  box.addEventListener('change', () => session.setPreference(nom, box.checked));
  const span = document.createElement('span');
  span.textContent = t(cle);
  label.append(box, span);
  return label;
}

/** Ligne « libellé + liste déroulante » des options. */
function selectRow(labelKey, entries, current, onChange) {
  const row = document.createElement('label');
  row.className = 'opt';
  const span = document.createElement('span');
  span.textContent = t(labelKey);
  const sel = document.createElement('select');
  for (const [value, label] of entries) {
    const o = document.createElement('option');
    o.value = value; o.textContent = label; o.selected = value === current;
    sel.append(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  row.append(span, sel);
  return row;
}

function afficherFin({ score, record }) {
  $('over-score').textContent = t('over.score', { score });
  const best = session.bestScore();
  $('over-record').textContent = record ? t('over.record') : t('over.best', { best: best ?? 0 });
  renderBest();
  annoncer(`${t('over.title')}. ${t('over.score', { score })}`);
  // laisse voir la fin avant la boîte (l'amont attendait 150 ms) ; pas si on est déjà reparti vers l'accueil (audit F3)
  setTimeout(() => { if (view === 'game' && session.game?.etat === ETAT.FINI) open('over'); }, 600);
}

/** Annonce aux lecteurs d'écran (région `aria-live`). */
function annoncer(texte) {
  $('live').textContent = '';
  $('live').textContent = texte;
}

/** Le score est annoncé à chaque regroupement, au plus toutes les 5 secondes (audit F4). */
function surEvenementJeu(type) {
  if (type !== 'points') return;
  const maintenant = performance.now();
  if (maintenant - derniereAnnonce < 5000) return;
  derniereAnnonce = maintenant;
  annoncer(t('game.score', { score: session.game.score }));
}

// --- événements ---

function wire() {
  $('b-menu').addEventListener('click', () => { mettreEnPauseSiJeu(); $('m-resume').hidden = !session.game || session.game.etat === ETAT.FINI; open('menu'); });
  $('b-pause').addEventListener('click', basculerPause);
  $('b-resume').addEventListener('click', basculerPause);
  $('m-resume').addEventListener('click', () => $('menu').close());
  $('m-home').addEventListener('click', () => { $('menu').close(); showHome(); });
  $('m-restart').addEventListener('click', () => {
    $('menu').close();
    if (!session.game || session.game.etat === ETAT.FINI || window.confirm(t('confirm.restart'))) demarrerPartie();
  });
  $('m-stats').addEventListener('click', () => { $('menu').close(); renderStats(); open('stats'); });
  $('m-options').addEventListener('click', () => { $('menu').close(); openOptions(); });
  $('m-help').addEventListener('click', () => { $('menu').close(); open('help'); });
  $('m-about').addEventListener('click', () => { $('menu').close(); open('about'); });
  $('h-continue').addEventListener('click', continueGame);
  $('h-new').addEventListener('click', demarrerPartie);
  $('h-stats').addEventListener('click', () => { renderStats(); open('stats'); });
  $('h-options').addEventListener('click', openOptions);
  $('h-help').addEventListener('click', () => open('help'));
  $('help-about').addEventListener('click', () => { $('help').close(); open('about'); });
  $('stats-close').addEventListener('click', () => $('stats').close());
  $('stats-reset').addEventListener('click', () => {
    if (window.confirm(t('stats.reset.confirm'))) { session.resetStats(); renderStats(); renderBest(); }
  });
  $('over-close').addEventListener('click', () => { $('over').close(); showHome(); });
  $('over-new').addEventListener('click', demarrerPartie);
  $('options-close').addEventListener('click', () => $('options').close());
  $('help-close').addEventListener('click', () => $('help').close());
  $('about-close').addEventListener('click', () => $('about').close());
  // un dialogue ouvert pendant la partie la met en pause ; elle reprend par le bouton, pas toute seule
  for (const d of document.querySelectorAll('dialog')) d.addEventListener('close', () => { if (session.game?.etat === ETAT.PAUSE) renderHud(); });

  // gestes : gauche ou droite de l'écran, comme l'amont (x < moitié : tourner à gauche)
  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    tourner(ev.clientX - r.left < r.width / 2 ? gauche() : droite());
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (view !== 'game') return;
    switch (ev.key) {
      case 'ArrowLeft': case 'a': case 'A': ev.preventDefault(); tourner(gauche()); break;
      case 'ArrowRight': case 'd': case 'D': ev.preventDefault(); tourner(droite()); break;
      case 'ArrowDown': case 's': case 'S':
        ev.preventDefault();
        if (session.preferences.speedUpKey && !ev.repeat) rush = 4;
        break;
      case 'p': case 'P': case ' ': ev.preventDefault(); if (!ev.repeat) basculerPause(); break;
      default: break;
    }
  });
  document.addEventListener('keyup', (ev) => {
    if (['ArrowDown', 's', 'S'].includes(ev.key)) rush = 1;
  });

  session.on('preference-changed', async (name) => {
    if (name === 'themeFamily' || name === 'themeMode' || name === 'colorblind') applyPreferredTheme();
    if (name === 'lang') {
      await applyLanguage();
      applyTexts();
      if (view === 'home') renderHome();
      if ($('options').open) openOptions();
      if ($('stats').open) renderStats();
    }
  });
  session.on('game-over', afficherFin);
  session.on('game-event', surEvenementJeu);
  session.on('stats-changed', renderBest);
  darkQuery?.addEventListener?.('change', () => { if (session.preferences.themeMode === 'auto') applyPreferredTheme(); });

  // la partie se met en pause quand la page est cachée ou perd le focus (l'amont le faisait au `blur`)
  const autoPause = () => {
    const g = session.game;
    if (view === 'game' && g?.etat === ETAT.JEU) { g.pause(); pauseAuto = true; }
    rush = 1;      // la touche peut être relâchée hors de la page : l'accélération ne doit pas rester (audit F1)
    session.saveGame();
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoPause(); else repartir(); });
  window.addEventListener('blur', autoPause);
  window.addEventListener('pagehide', () => session.saveGame());
  window.addEventListener('resize', dimensionner);
  if ('ResizeObserver' in window) new ResizeObserver(dimensionner).observe($('stage'));
  // sauvegarde de sécurité toutes les 10 secondes (l'amont : à chaque bloc effacé et à la fermeture)
  setInterval(() => { if (session.game?.etat === ETAT.JEU) session.saveGame(); }, 10000);
}

// --- démarrage ---

/** Charge la langue choisie (ou celle du navigateur) et règle la langue et le sens d'écriture de la page. */
async function applyLanguage() {
  const pref = session.preferences.lang;
  const code = pref === 'auto' ? pickLanguage(navigator.languages ?? [navigator.language]) : pref;
  setDictionary(await loadLanguage(code));
  document.documentElement.lang = code;
  document.documentElement.dir = directionOf(code);
}

async function main() {
  await applyLanguage();
  $('logo').innerHTML = logoSvg();
  applyPreferredTheme();
  applyTexts();
  wire();
  showHome();
  requestAnimationFrame(boucle);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try { await navigator.serviceWorker.register('sw.js'); } catch { /* hors ligne non disponible */ }
  }
}

main();
