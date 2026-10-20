/*
 * H3x7r15 — portage de Hextris : la partie (hexagone, blocs, regroupements, score, fin de partie)
 * Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * Portage de `js/Hex.js`, `js/Block.js`, `js/checking.js`, `js/update.js` et de la boucle de `js/main.js` (amont 3f4847d).
 * L'amont mélange modèle et dessin : l'animation d'un bloc (fondu, éclat, ressort de rotation) avance dans `draw()`, donc
 * une image dessinée = une étape d'animation. Ici ces étapes sont dans `animer()`, appelée au début de chaque `image(dt)`,
 * dans l'ordre exact de la boucle d'origine (dessin, puis mise à jour), car certaines règles en dépendent (un bloc ne tombe
 * qu'une fois son apparition finie ; un bloc supprimé ne quitte la pile qu'une fois son fondu terminé).
 * Le modèle ne dessine rien et ne lit ni le temps ni le navigateur : horloge = les `dt` qu'on lui donne (en images de
 * 1/60 s), hasard = `rng` injectable, échelle = 1 (la vue multiplie par l'échelle de l'écran).
 *
 * Différences voulues avec l'amont :
 *  - états : 'pret' (écran d'accueil), 'jeu', 'pause', 'fini' (amont : gameState 0, 1, -1, 2) ;
 *  - couleurs en indices 0 à 3 (la vue choisit les teintes) ;
 *  - aucune requête réseau à la fin de partie (l'amont envoie le score à une adresse IP) ;
 *  - les secousses d'écran et les textes flottants sont des événements pour la vue, pas des données du modèle.
 */
import { PROFILS, NB_VOIES, NB_COULEURS, CONSTANTE_ANGULAIRE } from './config.js';
import { GenerateurVagues } from './wavegen.js';
import { mulberry32 } from './rng.js';

export const ETAT = Object.freeze({ PRET: 'pret', JEU: 'jeu', PAUSE: 'pause', FINI: 'fini' });

/** Un bloc. Champs comme ceux de `Block` dans l'amont ; `distFromHex` est la distance au centre. */
function creerBloc(jeu, voieChute, couleur, iter, distance) {
  return {
    settled: 0,
    height: jeu.reglages.hauteurBloc,
    fallingLane: voieChute,
    checked: 0,
    angle: 90 - (30 + 60 * voieChute),
    angularVelocity: 0,
    targetAngle: 90 - (30 + 60 * voieChute),
    color: couleur,
    deleted: 0,
    removed: 0,
    tint: 0,
    opacity: 1,
    initializing: 1,
    ict: jeu.ct,
    iter,
    attachedLane: 0,
    distFromHex: distance || jeu.reglages.distanceDepart,
  };
}

/** Ressort de rotation de l'amont (même pas, même seuil) : fait tendre `angle` vers `targetAngle`. */
function ressort(o, dt) {
  if (o.angle > o.targetAngle) o.angularVelocity -= CONSTANTE_ANGULAIRE * dt;
  else if (o.angle < o.targetAngle) o.angularVelocity += CONSTANTE_ANGULAIRE * dt;
  if (Math.abs(o.angle - o.targetAngle + o.angularVelocity) <= Math.abs(o.angularVelocity)) {
    o.angle = o.targetAngle;
    o.angularVelocity = 0;
  } else {
    o.angle += o.angularVelocity;
  }
}

export class HextrisGame {
  /**
   * @param {object} [opt]
   * @param {'mobile'|'ordinateur'} [opt.profil]
   * @param {() => number} [opt.rng]  hasard dans [0, 1[ (défaut : mulberry32(graine))
   * @param {number} [opt.graine]
   * @param {(type: string, donnees?: object) => void} [opt.surEvenement]
   */
  constructor({ profil = 'ordinateur', rng, graine = 1, surEvenement } = {}) {
    this.profil = profil;
    this.reglages = { ...PROFILS[profil] };
    this.rng = rng || mulberry32(graine);
    this.surEvenement = surEvenement || (() => {});
    this._remettre();
  }

  _remettre() {
    const r = this.reglages;
    this.etat = ETAT.PRET;
    this.ct = 0;
    this.dt = 1;
    this.position = 0;
    this.voies = Array.from({ length: NB_VOIES }, () => []);
    this.chute = [];                 // blocs en train de tomber (`blocks` de l'amont)
    this.score = 0;
    this.delai = 15;                 // images de grâce au démarrage (`MainHex.delay`)
    this.tempsCombo = r.tempsCombo;  // `settings.comboTime`, qui varie en cours de partie
    this.dernierCombo = this.ct - this.tempsCombo;
    this.multiplicateur = undefined; // `comboMultiplier`, défini au premier regroupement
    this.derniereCouleur = -1;       // `lastColorScored`
    this.angle = 180 / NB_VOIES;     // angle de l'hexagone central (animation)
    this.targetAngle = this.angle;
    this.angularVelocity = 0;
    this.rotationTotale = 0;         // somme des pas de rotation, sans repli : pour la vue
    this.pas = 0;                    // nombre d'étapes simulées : durée réelle jouée = pas / 60 s (indépendante de l'accélération)
    this.vagues = new GenerateurVagues(this);
  }

  /** Nouvelle partie (clic sur « Jouer »). Les réglages et le hasard sont conservés. */
  demarrer() {
    this._remettre();
    this.etat = ETAT.JEU;
  }

  get enCours() { return this.etat === ETAT.JEU; }

  pause() { if (this.etat === ETAT.JEU) this.etat = ETAT.PAUSE; }

  reprendre() { if (this.etat === ETAT.PAUSE) this.etat = ETAT.JEU; }

  emettre(type, donnees) { this.surEvenement(type, donnees); }

  // --- blocs ---

  /** `addNewBlock` : un bloc apparaît sur la voie `voie` (il tombera vers le centre). */
  ajouterBloc(voie, couleur, iter) {
    iter *= this.reglages.modVitesse;
    this.chute.push(creerBloc(this, voie, couleur, iter));
  }

  /** `Hex.rotate` : pas > 0 = vers la gauche. Permis à l'accueil et en jeu, pas en pause ni à la fin. */
  tourner(pas) {
    if (!(this.etat === ETAT.JEU || this.etat === ETAT.PRET)) return;
    this.position += pas;
    this.rotationTotale += pas;
    while (this.position < 0) this.position += 6;
    this.position = this.position % NB_VOIES;
    for (const voie of this.voies) for (const b of voie) b.targetAngle -= pas * 60;
    this.targetAngle -= pas * 60;
  }

  /** `Hex.addBlock` : un bloc tombant touche la pile et s'y fixe. */
  _poser(bloc) {
    if (!(this.etat === ETAT.JEU || this.etat === ETAT.PRET)) return;
    bloc.settled = 1;
    bloc.tint = 0.6;
    let voie = NB_VOIES - bloc.fallingLane;
    this.emettre('pose', { voie: bloc.fallingLane });
    voie += this.position;
    voie = (voie + NB_VOIES) % NB_VOIES;
    bloc.distFromHex = this.reglages.largeurHexagone / 2 * Math.sqrt(3) + bloc.height * this.voies[voie].length;
    this.voies[voie].push(bloc);
    bloc.attachedLane = voie;
    bloc.checked = 1;
  }

  _rayon() { return (this.reglages.largeurHexagone / 2) * Math.sqrt(3); }

  /** `Hex.doesBlockCollide`. Avec `rang`, c'est un bloc déjà dans la pile (qui retombe après un effacement). */
  _collision(bloc, rang, pile) {
    if (bloc.settled) return;
    if (rang !== undefined) {
      if (rang <= 0) {
        if (bloc.distFromHex - bloc.iter * this.dt - this._rayon() <= 0) {
          bloc.distFromHex = this._rayon();
          bloc.settled = 1;
          bloc.checked = 1;
        } else {
          bloc.settled = 0;
          bloc.iter = 1.5 + (this.vagues.difficulte / 15) * 3;
        }
      } else {
        const dessous = pile[rang - 1];
        if (dessous.settled && bloc.distFromHex - bloc.iter * this.dt - dessous.distFromHex - dessous.height <= 0) {
          bloc.distFromHex = dessous.distFromHex + dessous.height;
          bloc.settled = 1;
          bloc.checked = 1;
        } else {
          bloc.settled = 0;
          bloc.iter = 1.5 + (this.vagues.difficulte / 15) * 3;
        }
      }
    } else {
      let voie = NB_VOIES - bloc.fallingLane;
      voie += this.position;
      voie = (voie + NB_VOIES) % NB_VOIES;
      const arr = this.voies[voie];
      if (arr.length > 0) {
        const haut = arr[arr.length - 1];
        if (bloc.distFromHex + bloc.iter * this.dt - haut.distFromHex - haut.height <= 0) {
          bloc.distFromHex = haut.distFromHex + haut.height;
          this._poser(bloc);
        }
      } else if (bloc.distFromHex + bloc.iter * this.dt - this._rayon() <= 0) {
        bloc.distFromHex = this._rayon();
        this._poser(bloc);
      }
    }
  }

  // --- regroupements ---

  /** `floodFill` : cases de même couleur reliées à (voie, rang), voisines par les côtés et par le dessus/dessous. */
  _remplir(voie, rang, liste) {
    if (this.voies[voie] === undefined || this.voies[voie][rang] === undefined) return;
    const couleur = this.voies[voie][rang].color;
    for (let x = -1; x < 2; x++) {
      for (let y = -1; y < 2; y++) {
        if (Math.abs(x) === Math.abs(y)) continue;
        const v = (voie + x + NB_VOIES) % NB_VOIES;
        const i = rang + y;
        if (this.voies[v] === undefined) continue;
        const b = this.voies[v][i];
        if (b !== undefined && b.color === couleur && !liste.some((c) => c[0] === v && c[1] === i) && b.deleted === 0) {
          liste.push([v, i]);
          this._remplir(v, i, liste);
        }
      }
    }
  }

  /** `consolidateBlocks` : trois blocs ou plus de même couleur qui se touchent disparaissent. */
  _consolider(voie, rang) {
    const liste = [[voie, rang]];
    this._remplir(voie, rang, liste);
    if (liste.length < 3) return;
    const effaces = [];
    for (const [v, i] of liste) {
      const b = this.voies[v][i];
      b.deleted = 1;
      effaces.push(b);
    }
    const maintenant = this.ct;
    if (maintenant - this.dernierCombo < this.tempsCombo) {
      this.tempsCombo = (1 / this.reglages.modCreation) * (this.vagues.prochain / 16.666667) * 3;
      this.multiplicateur += 1;
      this.dernierCombo = maintenant;
      this.emettre('combo', { multiplicateur: this.multiplicateur, blocs: effaces });
    } else {
      this.tempsCombo = 240;
      this.dernierCombo = maintenant;
      this.multiplicateur = 1;
    }
    const points = liste.length * liste.length * this.multiplicateur;
    this.derniereCouleur = effaces[0].color;
    this.score += points;
    this.emettre('points', { points, couleur: effaces[0].color, blocs: effaces });
  }

  /** `blockDestroyed` : chaque bloc effacé accélère le jeu. */
  _blocDetruit() {
    const v = this.vagues;
    const r = this.reglages;
    if (v.prochain > 1350) v.prochain -= 30 * r.modCreation;
    else if (v.prochain > 600) v.prochain -= 8 * r.modCreation;
    else v.prochain = 600;
    if (v.difficulte < 35) v.difficulte += 0.085 * r.modVitesse;
    else v.difficulte = 35;
  }

  /** `isInfringing` : une voie dépasse la hauteur permise. */
  _deborde() {
    for (const voie of this.voies) {
      let sous = 0;
      for (const b of voie) sous += b.deleted;
      if (voie.length - sous > this.reglages.lignes) return true;
    }
    return false;
  }

  // --- une image ---

  /** Animation d'un bloc (ce que fait `Block.draw` dans l'amont, sans dessiner). */
  _animerBloc(b) {
    // fondu d'un bloc effacé
    if (b.deleted) {
      if (b.opacity >= 0.925) {
        let v = b.attachedLane - this.position;
        v = NB_VOIES - v;
        while (v < 0) v += NB_VOIES;
        v %= NB_VOIES;
        this.emettre('efface', { voie: v });
      }
      b.opacity = b.opacity - 0.075 * this.dt;
      if (b.opacity <= 0) {
        b.opacity = 0;
        b.deleted = 2;
        this.emettre('sauvegarde');
      }
    }
    ressort(b, this.dt);
    if (b.initializing) {
      if (this.ct - b.ict >= this.reglages.dureeCreation) b.initializing = 0;
    }
    if (b.tint) {
      if (b.opacity < 1) {
        this.emettre('sauvegarde');
        b.iter = 2.25;
        b.tint = 0;
      }
      b.tint -= 0.02 * this.dt;
      if (b.tint < 0) b.tint = 0;
    }
  }

  /** Ce qu'un rendu fait avancer, dans l'ordre de l'amont : blocs de la pile, blocs en chute, hexagone. */
  animer() {
    for (const voie of this.voies) for (const b of voie) this._animerBloc(b);
    for (const b of this.chute) this._animerBloc(b);
    ressort(this, this.dt);
  }

  /** `update(dt)` : un pas de simulation. */
  _mettreAJour(dt) {
    this.dt = dt;
    if (this.etat === ETAT.JEU) this.vagues.mettreAJour();
    let plusBas;
    for (const b of this.chute) {
      this._collision(b);
      if (!b.settled) {
        if (!b.initializing) b.distFromHex -= b.iter * dt;
      } else if (!b.removed) {
        b.removed = 1;
      }
    }
    for (let i = 0; i < this.voies.length; i++) {
      for (let j = 0; j < this.voies[i].length; j++) {
        const b = this.voies[i][j];
        if (b.checked === 1) {
          this._consolider(b.attachedLane, this.voies[b.attachedLane].indexOf(b));
          b.checked = 0;
        }
      }
    }
    for (let i = 0; i < this.voies.length; i++) {
      plusBas = 99;
      for (let j = 0; j < this.voies[i].length; j++) {
        const b = this.voies[i][j];
        if (b.deleted === 2) {
          this.voies[i].splice(j, 1);
          this._blocDetruit();
          if (j < plusBas) plusBas = j;
          j--;
        }
      }
      if (plusBas < this.voies[i].length) {
        for (let j = plusBas; j < this.voies[i].length; j++) this.voies[i][j].settled = 0;
      }
    }
    for (let i = 0; i < this.voies.length; i++) {
      for (let j = 0; j < this.voies[i].length; j++) {
        const b = this.voies[i][j];
        this._collision(b, j, this.voies[i]);
        if (!this.voies[i][j].settled) this.voies[i][j].distFromHex -= b.iter * dt;
      }
    }
    for (let i = 0; i < this.chute.length; i++) {
      if (this.chute[i].removed === 1) {
        this.chute.splice(i, 1);
        i--;
      }
    }
    this.ct += dt;
  }

  /**
   * Une image de la boucle d'origine (`animLoop`, états jeu et fin) : animation, puis mise à jour (sauf pendant les
   * images de grâce du départ), puis test de fin de partie. `dt` est en images de 1/60 s (1 = 16,67 ms), déjà multiplié
   * par l'accélération éventuelle.
   */
  image(dt) {
    if (this.etat !== ETAT.JEU && this.etat !== ETAT.FINI) return;
    this.pas++;
    this.animer();
    if (!this.delai) this._mettreAJour(dt);
    else this.delai--;
    if (this.etat === ETAT.JEU && this._deborde()) {
      this.etat = ETAT.FINI;
      this.emettre('fin', { score: this.score });
    }
  }

  // --- sauvegarde ---

  /** État complet, en JSON simple (sauvegarde de la partie). Avec un `rng` de ce paquet, la reprise est exacte. */
  exporter() {
    const copie = (b) => ({ ...b });
    return {
      v: 1,
      profil: this.profil,
      etat: this.etat,
      ct: this.ct, dt: this.dt, delai: this.delai,
      position: this.position, rotationTotale: this.rotationTotale, pas: this.pas,
      voies: this.voies.map((v) => v.map(copie)),
      chute: this.chute.map(copie),
      score: this.score,
      tempsCombo: this.tempsCombo, dernierCombo: this.dernierCombo,
      multiplicateur: this.multiplicateur ?? null,
      derniereCouleur: this.derniereCouleur,
      angle: this.angle, targetAngle: this.targetAngle, angularVelocity: this.angularVelocity,
      vagues: this.vagues.exporter(),
      rng: typeof this.rng.etat === 'function' ? this.rng.etat() : null,
    };
  }

  /** Reprend une sauvegarde de `exporter()`. Lève une erreur si elle est invalide ; la partie reste alors inchangée. */
  importer(e) {
    const nombre = (x) => typeof x === 'number' && Number.isFinite(x);
    const bloc = (b) => {
      if (!b || typeof b !== 'object') throw new Error('bloc invalide');
      for (const k of ['settled', 'height', 'fallingLane', 'checked', 'angle', 'angularVelocity', 'targetAngle', 'color', 'deleted', 'removed',
        'tint', 'opacity', 'initializing', 'ict', 'iter', 'attachedLane', 'distFromHex']) {
        if (!nombre(b[k])) throw new Error('bloc invalide : ' + k);
      }
      if (!Number.isInteger(b.color) || b.color < 0 || b.color >= NB_COULEURS) throw new Error('couleur invalide');
      if (!Number.isInteger(b.fallingLane) || b.fallingLane < 0 || b.fallingLane >= NB_VOIES) throw new Error('voie invalide');
      if (!Number.isInteger(b.attachedLane) || b.attachedLane < 0 || b.attachedLane >= NB_VOIES) throw new Error('voie invalide');
      return { ...b };
    };
    if (!e || e.v !== 1 || e.profil !== this.profil) throw new Error('sauvegarde incompatible');
    if (!Array.isArray(e.voies) || e.voies.length !== NB_VOIES || !Array.isArray(e.chute)) throw new Error('sauvegarde invalide');
    for (const k of ['ct', 'dt', 'delai', 'position', 'rotationTotale', 'score', 'tempsCombo', 'dernierCombo', 'angle', 'targetAngle', 'angularVelocity']) {
      if (!nombre(e[k])) throw new Error('sauvegarde invalide : ' + k);
    }
    if (!Object.values(ETAT).includes(e.etat)) throw new Error('état invalide');
    const voies = e.voies.map((v) => {
      if (!Array.isArray(v) || v.length > 100) throw new Error('voie invalide');
      return v.map(bloc);
    });
    const chute = e.chute.map(bloc);
    if (chute.length > 500) throw new Error('trop de blocs');
    const vagues = new GenerateurVagues(this);
    vagues.importer(e.vagues);
    // tout est valide : on applique
    Object.assign(this, {
      etat: e.etat, ct: e.ct, dt: e.dt, delai: e.delai, position: e.position, rotationTotale: e.rotationTotale,
      pas: Number.isInteger(e.pas) && e.pas >= 0 ? e.pas : Math.round(e.ct),   // sauvegardes d'avant ce champ : ct approche la durée
      voies, chute, score: e.score, tempsCombo: e.tempsCombo, dernierCombo: e.dernierCombo,
      multiplicateur: e.multiplicateur ?? undefined, derniereCouleur: e.derniereCouleur,
      angle: e.angle, targetAngle: e.targetAngle, angularVelocity: e.angularVelocity, vagues,
    });
    if (typeof this.rng.fixer === 'function' && nombre(e.rng)) this.rng.fixer(e.rng);
  }
}
