/*
 * H3x7r15 — portage de Hextris : session (préférences, scores, sauvegarde, parties)
 * Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * Remplace `js/save-state.js` de l'amont (copie profonde jQuery + JSONfn dans `localStorage`) par une sauvegarde en JSON
 * simple et validée : une sauvegarde illisible est mise de côté, jamais exécutée (JSONfn réévaluait des fonctions).
 * Le stockage du navigateur peut manquer ou lever une exception (navigation privée) : la session fonctionne alors sans
 * mémoire.
 */
import { HextrisGame, ETAT } from './game.js';
import { mulberry32 } from './rng.js';
import { THEMES, DEFAULT_FAMILY, normalize as normalizeTheme } from './themes.js';
import { normalizeStats, addGame, addStart, emptyStats, bestScore } from './stats.js';
import { CODES } from './lang/index.js';

export const PROFIL_CHOIX = Object.freeze(['auto', 'mobile', 'ordinateur']);

export const DEFAULT_PREFERENCES = Object.freeze({
  themeFamily: DEFAULT_FAMILY,    // voir src/themes.js
  themeMode: 'auto',              // 'auto' (suit le système), 'clair' ou 'fonce'
  lang: 'auto',                   // 'auto' (langue du navigateur) ou un code de src/lang/index.js
  colorblind: false,              // palette de l'amont pour le daltonisme (violet, jaune, bleu, orange)
  profil: 'auto',                 // 'auto' (écran tactile ou non), 'mobile' ou 'ordinateur' (réglages de jeu)
  speedUpKey: true,               // la flèche du bas accélère la chute (comme l'amont)
  invertControls: false,          // inverse gauche et droite (toucher et clavier) : par défaut droite = sens horaire
});

const KEY_SAVE = 'h3x7r15:savefile';
const KEY_BAD = 'h3x7r15:savefile.illisible';
const KEY_DATA = 'h3x7r15:data';
const KEY_PREFS = 'h3x7r15:prefs';

/** Graine neuve : l'aléa du navigateur si possible. */
function graineAleatoire() {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0];
  } catch { return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0; }
}

export class Session {
  /**
   * @param {{storage?: {getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void}|null,
   *          coarsePointer?: boolean, seed?: () => number, jour?: () => string}} [options]
   */
  constructor({ storage = null, coarsePointer = false, seed = graineAleatoire, jour = jourLocal } = {}) {
    this._storage = storage;
    this._listeners = new Map();
    this._coarse = coarsePointer;
    this._seed = seed;
    this._jour = jour;
    this.game = null;
    this.preferences = { ...DEFAULT_PREFERENCES, ...this._read(KEY_PREFS) };
    const theme = normalizeTheme({ family: this.preferences.themeFamily, mode: this.preferences.themeMode });
    this.preferences.themeFamily = theme.family;
    this.preferences.themeMode = theme.mode;
    if (this.preferences.lang !== 'auto' && !CODES.includes(this.preferences.lang)) this.preferences.lang = 'auto';
    if (!PROFIL_CHOIX.includes(this.preferences.profil)) this.preferences.profil = 'auto';
    this.preferences.colorblind = this.preferences.colorblind === true;
    this.preferences.speedUpKey = this.preferences.speedUpKey !== false;
    this.preferences.invertControls = this.preferences.invertControls === true;
    this.stats = normalizeStats(this._read(KEY_DATA).stats);
  }

  // --- stockage ---

  _read(key) {
    try {
      const raw = this._storage?.getItem(key);
      const v = raw ? JSON.parse(raw) : null;
      return v && typeof v === 'object' ? v : {};
    } catch { return {}; }
  }

  _write(key, value) {
    try { this._storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  _remove(key) {
    try { this._storage?.removeItem(key); } catch { /* sans mémoire */ }
  }

  // --- événements ---

  on(name, fn) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(fn);
    return () => this._listeners.get(name).delete(fn);
  }

  _emit(name, ...args) {
    for (const fn of this._listeners.get(name) ?? []) fn(...args);
  }

  // --- préférences ---

  setPreference(name, value) {
    if (!(name in DEFAULT_PREFERENCES)) throw new Error('Préférence inconnue : ' + name);
    if (name === 'themeFamily' && !THEMES[value]) return;
    if (name === 'profil' && !PROFIL_CHOIX.includes(value)) return;
    this.preferences[name] = value;
    this._write(KEY_PREFS, this.preferences);
    this._emit('preference-changed', name, value);
  }

  /** Réglages de jeu effectifs : le choix de l'utilisateur, sinon selon l'écran. */
  profilEffectif() {
    const p = this.preferences.profil;
    return p === 'auto' ? (this._coarse ? 'mobile' : 'ordinateur') : p;
  }

  // --- parties ---

  _nouvelleInstance(profil, graine) {
    const jeu = new HextrisGame({ profil, rng: mulberry32(graine), surEvenement: (t, d) => this._surEvenement(t, d) });
    return jeu;
  }

  _surEvenement(type, donnees) {
    this._emit('game-event', type, donnees);
    if (type === 'fin') this._terminer(donnees.score);
    else if (type === 'sauvegarde') this.saveGame();
  }

  /** Nouvelle partie (efface la sauvegarde précédente). */
  newGame() {
    const profil = this.profilEffectif();
    this.game = this._nouvelleInstance(profil, this._seed());
    this.game.demarrer();
    this._remove(KEY_SAVE);
    this.stats = addStart(this.stats, profil);
    this._saveData();
    this._emit('game-changed');
    return this.game;
  }

  _terminer(score) {
    const g = this.game;
    // durée réelle : une étape = 1/60 s, quelle que soit l'accélération (`ct` cumule dt x accélération : audit de Claudius, F2)
    const { stats, record } = addGame(this.stats, { d: this._jour(), s: score, t: Math.round(g.pas / 60), p: g.profil });
    this.stats = stats;
    this._saveData();
    this._remove(KEY_SAVE);
    this._emit('game-over', { score, record });
  }

  _saveData() { this._write(KEY_DATA, { stats: this.stats }); }

  /** Meilleur score du profil de la partie en cours, sinon du profil que prendrait une nouvelle partie ; null s'il n'y en a pas. */
  bestScore() {
    return bestScore(this.stats.games, this.game ? this.game.profil : this.profilEffectif());
  }

  /** Efface les statistiques (confirmation faite par l'interface). */
  resetStats() {
    this.stats = emptyStats();
    this._saveData();
    this._emit('stats-changed');
  }

  // --- sauvegarde de la partie ---

  /** Écrit la partie en cours (pas une partie finie). */
  saveGame() {
    const g = this.game;
    if (!g || g.etat === ETAT.FINI || g.etat === ETAT.PRET) return false;
    return this._write(KEY_SAVE, g.exporter());
  }

  /** Résumé de la sauvegarde (sans la charger) : { score } ou null. */
  savedInfo() {
    const s = this._read(KEY_SAVE);
    return Number.isInteger(s?.score) && s.v === 1 ? { score: s.score } : null;
  }

  /** Charge la sauvegarde, en pause. Une sauvegarde illisible est mise de côté ; renvoie false. */
  resume() {
    const brut = this._read(KEY_SAVE);
    if (!brut || !brut.v) return false;
    try {
      const jeu = this._nouvelleInstance(brut.profil === 'mobile' ? 'mobile' : 'ordinateur', 1);
      jeu.importer(brut);
      if (jeu.etat === ETAT.JEU) jeu.etat = ETAT.PAUSE;
      this.game = jeu;
      this._emit('game-changed');
      return true;
    } catch {
      this._write(KEY_BAD, brut);
      this._remove(KEY_SAVE);
      return false;
    }
  }
}

/** Date locale 'AAAA-MM-JJ'. */
export function jourLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
