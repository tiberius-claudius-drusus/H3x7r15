[English](README.md) · **Français**

# H3x7r15

**H3x7r15** (« Hextris » en l33t) est un portage JavaScript de **Hextris** sous forme d'application web progressive (PWA), jouable sur mobile et sur ordinateur.

> Portage conçu, écrit et testé par **Drusus**, agent de la Gens Claudia, sous la supervision de l'Auctor. Voir « Crédits » ci-dessous.
**Jouer : <https://tiberius-claudius-drusus.github.io/H3x7r15/>** (installable sur mobile et sur ordinateur, fonctionne hors ligne).

## Origine et licence

H3x7r15 est un portage de [Hextris](https://github.com/Hextris/hextris) (Copyright © 2018 Logan Engstrom et les contributeurs de Hextris), publié sous la **Licence Publique Générale GNU, version 3 ou ultérieure**.
Le portage est distribué sous la même licence : voir `LICENSE.txt`. Détail de l'origine (commit amont, mention à conserver en tête de chaque fichier dérivé) : `NOTICE.md`.

Ni le nom « Hextris », ni son logo, ses polices ou ses images ne sont repris. Les règles, la forme du plateau et les motifs de génération des blocs sont ceux de l'original, et le portage **rejoue les parties de l'original coup pour coup** : les tests font tourner le code d'origine avec une graine fixe et vérifient que le portage donne le même score, les mêmes blocs et la même fin de partie, image par image (`test/amont.test.js`, `tools/reference-upstream.mjs`).

## Crédits

**Drusus est l'auteur de ce portage.** Drusus est un *Legatus* de la Gens Claudia, c'est-à-dire un agent d'intelligence artificielle qui travaille sur sa propre machine, avec sa propre mémoire, pour un opérateur humain.

- le modèle du jeu, séparé du dessin et testable sans navigateur (`src/game.js`, `src/wavegen.js`), portage du code amont ;
- le dessin sur canvas, les commandes tactiles et clavier, l'accueil et le bandeau de partie calqués sur 5ud0ku et 1-5731N ;
- les thèmes, la partie enregistrée, les statistiques, l'application installable et son fonctionnement hors ligne ;
- les tests unitaires.

Autres contributions : **l'Auctor** a supervisé le projet ; **Claudius**, Primus inter Pares de la Gens Claudia, audite et publiera ce dépôt sur GitHub ; **Logan Engstrom, Garrett Finucane et les contributeurs de Hextris**, dont le jeu est l'origine de ce portage. Voir `NOTICE.md`.

## But du jeu

Empêchez les blocs de sortir de l'hexagone gris. Les blocs tombent vers le centre depuis les six côtés : faites tourner l'hexagone pour choisir où ils se posent. Trois blocs de même couleur ou plus qui se touchent disparaissent ; les regroupements enchaînés vite multiplient le score.

## Développement

Aucune étape de construction : les modules sont des modules ES natifs.

```
npm test          # tests unitaires, dont le rejeu des parties enregistrées sur le code d'origine
node tools/reference-upstream.mjs <dossier d'un Hextris>   # régénère les traces de référence (non livré)
```

## Licence

Licence Publique Générale GNU, version 3 ou ultérieure. Voir `LICENSE.txt`.
