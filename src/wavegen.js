/*
 * H3x7r15 — portage de Hextris : générateur de vagues
 * Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
 * Copyright (C) 2026 Drusus (Gens Claudia)
 * Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
 * Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
 *
 * Portage de `js/wavegen.js` (amont 3f4847d), au tirage près : l'ordre et le nombre des appels au hasard sont ceux de
 * l'amont, de sorte qu'une même graine donne la même partie (vérifié contre le code d'origine, `test/amont.test.js`).
 * Particularités de l'amont conservées volontairement (une « correction » changerait la difficulté du jeu) :
 *  - `randInt(min, max)` vaut `floor(hasard * max + min)` : `randInt(1, 4)` donne 1 à 4, pas 1 à 3 ;
 *  - les motifs « double » et « croisé » tirent leur voie parmi les 4 premières seulement (`colors.length`, pas 6) ;
 *  - `last` ne change jamais : la difficulté croît donc comme le carré du temps ;
 *  - le motif « spirale » consomme un tirage à chaque image, même quand il ne génère rien.
 */
import { NB_COULEURS, NB_VOIES } from './config.js';

export const MOTIFS = Object.freeze(['aleatoire', 'double', 'croise', 'spirale', 'cercle', 'demi-cercle']);

export class GenerateurVagues {
  /**
   * @param jeu  la partie (donne `ct`, `reglages`, `rng`, `ajouterBloc`)
   */
  constructor(jeu) {
    this.jeu = jeu;
    this.dernier = 0;           // lastGen
    this.last = 0;              // last (ne bouge jamais, voir plus haut)
    this.prochain = 2700;       // nextGen
    this.ct = 0;
    this.difficulte = 1;        // difficulty
    this.dt = 0;
    this.motif = 'aleatoire';   // currentFunction
  }

  entier(min, max) {          // randInt
    return Math.floor((this.jeu.rng() * max) + min);
  }

  /** Appelé à chaque image de jeu (`waveGen.update`). */
  mettreAJour() {
    this._appliquer();
    this.dt = this.jeu.reglages.facteurTemps * this.jeu.ct;
    this._calculerDifficulte();
    if ((this.dt - this.dernier) * this.jeu.reglages.modCreation > this.prochain) {
      if (this.prochain > 600) {
        this.prochain -= 11 * (this.prochain / 1300) * this.jeu.reglages.modCreation;
      }
    }
  }

  _appliquer() {
    switch (this.motif) {
      case 'aleatoire': return this._aleatoire();
      case 'double': return this._double();
      case 'croise': return this._croise();
      case 'spirale': return this._spirale();
      case 'cercle': return this._cercle();
      case 'demi-cercle': return this._demiCercle();
      default: throw new Error('motif inconnu : ' + this.motif);
    }
  }

  _calculerDifficulte() {
    if (this.difficulte < 35) {
      let increment;
      const m = this.jeu.reglages.modVitesse;
      if (this.difficulte < 8) increment = (this.dt - this.last) / 5166667 * m;
      else if (this.difficulte < 15) increment = (this.dt - this.last) / 72333333 * m;
      else increment = (this.dt - this.last) / 90000000 * m;
      this.difficulte += increment * (1 / 2);
    }
  }

  _aleatoire() {
    if (this.dt - this.dernier > this.prochain) {
      this.ct++;
      this.dernier = this.dt;
      const voie = this.entier(0, NB_VOIES);
      this.jeu.ajouterBloc(voie, this.entier(0, NB_COULEURS), 1.6 + (this.difficulte / 15) * 3);
      const lim = 5;
      if (this.ct > lim) {
        const suivant = this.entier(0, 3 + 21);
        if (suivant > 15) { this.ct = 0; this.motif = 'double'; }
        else if (suivant > 10) { this.ct = 0; this.motif = 'croise'; }
        else if (suivant > 7) { this.ct = 0; this.motif = 'spirale'; }
        else if (suivant > 4) { this.ct = 0; this.motif = 'cercle'; }
        else if (suivant > 1) { this.ct = 0; this.motif = 'demi-cercle'; }
      }
    }
  }

  _cercle() {
    if (this.dt - this.dernier > this.prochain + 500) {
      let nbCouleurs = this.entier(1, 4);
      if (nbCouleurs === 3) nbCouleurs = this.entier(1, 4);
      const liste = [];
      for (let i = 0; i < nbCouleurs; i++) {
        const q = this.entier(0, NB_COULEURS);
        if (liste.includes(q)) { i--; continue; }
        liste.push(q);
      }
      for (let i = 0; i < NB_VOIES; i++) {
        this.jeu.ajouterBloc(i, liste[i % nbCouleurs], 1.5 + (this.difficulte / 15) * 3);
      }
      this.ct += 15;
      this.dernier = this.dt;
      this._changerMotif(1);
    }
  }

  _demiCercle() {
    if (this.dt - this.dernier > (this.prochain + 500) / 2) {
      const nbCouleurs = this.entier(1, 3);
      const c = this.entier(0, NB_COULEURS);
      let liste = [c, c, c];
      if (nbCouleurs === 2) liste = [c, this.entier(0, NB_COULEURS), c];
      const d = this.entier(0, 6);
      for (let i = 0; i < 3; i++) {
        this.jeu.ajouterBloc((d + i) % 6, liste[i], 1.5 + (this.difficulte / 15) * 3);
      }
      this.ct += 8;
      this.dernier = this.dt;
      this._changerMotif();
    }
  }

  _croise() {
    if (this.dt - this.dernier > this.prochain) {
      const ri = this.entier(0, NB_COULEURS);
      const i = this.entier(0, NB_COULEURS);     // sic : 4 voies sur 6, comme l'amont
      this.jeu.ajouterBloc(i, ri, 0.6 + (this.difficulte / 15) * 3);
      this.jeu.ajouterBloc((i + 3) % NB_VOIES, ri, 0.6 + (this.difficulte / 15) * 3);
      this.ct += 1.5;
      this.dernier = this.dt;
      this._changerMotif();
    }
  }

  _spirale() {
    const sens = this.entier(0, 2);              // tiré à chaque image, même sans génération
    if (this.dt - this.dernier > this.prochain * (2 / 3)) {
      if (sens) this.jeu.ajouterBloc(5 - (this.ct % NB_VOIES), this.entier(0, NB_COULEURS), 1.5 + (this.difficulte / 15) * (3 / 2));
      else this.jeu.ajouterBloc(this.ct % NB_VOIES, this.entier(0, NB_COULEURS), 1.5 + (this.difficulte / 15) * (3 / 2));
      this.ct += 1;
      this.dernier = this.dt;
      this._changerMotif();
    }
  }

  _double() {
    if (this.dt - this.dernier > this.prochain) {
      const i = this.entier(0, NB_COULEURS);     // sic : 4 voies sur 6
      this.jeu.ajouterBloc(i, this.entier(0, NB_COULEURS), 1.5 + (this.difficulte / 15) * 3);
      this.jeu.ajouterBloc((i + 1) % NB_VOIES, this.entier(0, NB_COULEURS), 1.5 + (this.difficulte / 15) * 3);
      this.ct += 2;
      this.dernier = this.dt;
      this._changerMotif();
    }
  }

  _revenirAuHasard() {
    this.ct = 0;
    this.motif = 'aleatoire';
  }

  /** `shouldChangePattern` : après un motif, retour au hasard ou nouveau motif. */
  _changerMotif(x) {
    if (x) {
      const q = this.entier(0, 4);
      this.ct = 0;
      switch (q) {
        case 0: this.motif = 'double'; break;
        case 1: this.motif = 'spirale'; break;
        case 2: this.motif = 'croise'; break;
        default: break;                           // 3 : on reste sur le motif en cours (cercle)
      }
    } else if (this.ct > 8) {
      if (this.entier(0, 2) === 0) { this._revenirAuHasard(); return 1; }
    }
    return 0;
  }

  /** État sérialisable (sauvegarde de la partie). */
  exporter() {
    const { dernier, last, prochain, ct, difficulte, dt, motif } = this;
    return { dernier, last, prochain, ct, difficulte, dt, motif };
  }

  importer(e) {
    if (!MOTIFS.includes(e.motif)) throw new Error('motif inconnu : ' + e.motif);
    Object.assign(this, { dernier: e.dernier, last: e.last, prochain: e.prochain, ct: e.ct, difficulte: e.difficulte, dt: e.dt, motif: e.motif });
  }
}
