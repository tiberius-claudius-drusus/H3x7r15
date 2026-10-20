# Origine du code

Ce dépôt est un **travail dérivé** de Hextris :

- Projet amont : https://github.com/Hextris/hextris
- Auteurs : Logan Engstrom, Garrett Finucane et les contributeurs de Hextris. « Copyright (C) 2018 Logan Engstrom » (`README.md` de l'amont).
- Licence amont : GNU General Public License, version 3 **ou (à votre choix) toute version ultérieure** (`LICENSE.md` de l'amont, repris dans `LICENSE.txt` ; la mention « ou ultérieure » figure dans le `README.md` de l'amont, aucun fichier source n'a d'en-tête).
- Version de référence du portage : commit amont `3f4847dc8fd7dab3d1c87e6324b9159d92fbd396` (2022-02-08).

Tout fichier de ce dépôt qui reprend ou adapte du code amont doit porter en tête la mention :

```
H3x7r15 — portage de Hextris
Copyright (C) 2014-2018 Logan Engstrom et les contributeurs de Hextris
Copyright (C) 2026 Drusus (Gens Claudia)
Ce programme est un logiciel libre ; vous pouvez le redistribuer et/ou le modifier selon les termes de la
Licence Publique Générale GNU, version 3 ou (à votre choix) toute version ultérieure.
```

L'application doit offrir un lien vers ses sources depuis son interface (exigence de la GPL) : « À propos ».

Licence **GPL-3.0-or-later**, celle de l'amont.

## Ce qui n'est pas repris de l'amont

Sans licence individuelle vérifiable dans le dépôt amont, ou sans utilité, ces éléments ne sont **pas** repris :

- le nom et le logo « Hextris », les images (`images/`), icônes et images de partage : **redessinés** (icônes et logo propres à ce portage) ;
- les polices (Lovelo, Exo 2, Quattrocento Sans, Font Awesome) : polices du système ;
- les bibliothèques jQuery, Hammer.js, keypress, js-cookie, sweet-alert, rrssb et jsonfn : remplacées par du JavaScript natif ;
- le suivi d'audience (Google Analytics), l'envoi du score à un serveur à la fin de la partie et le chargement de `a.js` depuis un site externe : **supprimés** ; l'application ne contacte aucun serveur.

## Données de test

`test/fixtures/trace-*.json` : parties du code amont enregistrées avec une graine fixe par `tools/reference-upstream.mjs` (valeurs numériques seulement : score, nombre de blocs, horloge, état). Ce sont des **résultats d'exécution** du code amont ; ils ne contiennent pas de code. Même licence que l'amont.
