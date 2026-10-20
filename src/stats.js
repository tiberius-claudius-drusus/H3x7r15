/*
 * H3x7r15 — statistiques des parties terminées
 * Copyright (C) 2026 Drusus (Gens Claudia). Licence : GPL-3.0-or-later (voir LICENSE.txt).
 *
 * Fonctions pures sur une liste de parties { d: date 'AAAA-MM-JJ', s: score, t: durée en secondes, p: profil }.
 * Gardées dans le stockage du navigateur (voir session.js) ; les 500 dernières seulement. Les profils « mobile » (tactile)
 * et « ordinateur » ont des réglages de jeu différents : records, moyennes et classements sont donc séparés par profil
 * (décision de l'Auctor, audit de Claudius D2). Dans l'amont, les scores sont seulement les trois meilleurs, sans date ni
 * durée ; les statistiques sont une addition de ce portage.
 */

export const MAX_GAMES = 500;
export const PROFILS = ['mobile', 'ordinateur'];

export const emptyStats = () => ({ started: { mobile: 0, ordinateur: 0 }, games: [] });

const validGame = (g) => g && typeof g === 'object' && typeof g.d === 'string' && Number.isInteger(g.s) && g.s >= 0
  && Number.isFinite(g.t) && g.t >= 0 && PROFILS.includes(g.p);

const parProfil = (games, profil) => games.filter((g) => g.p === profil);

/**
 * Statistiques valides à partir d'un contenu éventuellement corrompu (stockage du navigateur). `started` était un nombre
 * avant la séparation par profil : on le remplace par le nombre de parties terminées de chaque profil.
 */
export function normalizeStats(raw) {
  const games = Array.isArray(raw?.games) ? raw.games.filter(validGame).map((g) => ({ d: g.d, s: g.s, t: g.t, p: g.p })).slice(-MAX_GAMES) : [];
  const started = {};
  for (const p of PROFILS) {
    const n = raw?.started && typeof raw.started === 'object' ? raw.started[p] : undefined;
    started[p] = Math.max(Number.isInteger(n) && n >= 0 ? n : 0, parProfil(games, p).length);
  }
  return { started, games };
}

/** Une partie commencée de plus pour ce profil (renvoie de nouvelles statistiques). */
export function addStart(stats, profil) {
  if (!PROFILS.includes(profil)) throw new Error('Profil invalide');
  return { ...stats, started: { ...stats.started, [profil]: stats.started[profil] + 1 } };
}

/** Ajoute une partie terminée ; `record` : meilleur score de **son profil** (le premier score non nul compte aussi). */
export function addGame(stats, game) {
  if (!validGame(game)) throw new Error('Partie invalide');
  const best = bestScore(stats.games, game.p);
  const games = [...stats.games, { d: game.d, s: game.s, t: game.t, p: game.p }].slice(-MAX_GAMES);
  const started = { ...stats.started };
  started[game.p] = Math.max(started[game.p], parProfil(games, game.p).length);
  return { stats: { started, games }, record: game.s > 0 && (best === null || game.s > best) };
}

/** Meilleur score, ou null s'il n'y a pas de partie. Avec `profil`, seulement ce profil. */
export function bestScore(games, profil) {
  let best = null;
  for (const g of profil ? parProfil(games, profil) : games) if (best === null || g.s > best) best = g.s;
  return best;
}

/** Parties jouées, meilleur score, score moyen, durée moyenne. */
export function summarize(games) {
  const n = games.length;
  return {
    played: n,
    best: bestScore(games),
    avg: n ? games.reduce((a, g) => a + g.s, 0) / n : null,
    avgTime: n ? games.reduce((a, g) => a + g.t, 0) / n : null,
  };
}

/** Les n meilleures parties, la meilleure en premier (à égalité, la plus récente). */
export function top(games, n = 5) {
  return games.map((g, i) => ({ ...g, i })).sort((a, b) => b.s - a.s || b.i - a.i).slice(0, n).map(({ i, ...g }) => g);
}

/** Les n dernières parties, la plus récente en premier. */
export const recent = (games, n = 10) => games.slice(-n).reverse();

/** Les parties d'un profil. */
export const gamesOf = parProfil;
