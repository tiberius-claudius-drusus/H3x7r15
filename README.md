**English** · [Français](README.fr.md)

# H3x7r15

**H3x7r15** ("Hextris" in l33t) is a JavaScript port of **Hextris** as a progressive web app (PWA), playable on mobile and on desktop.

> Port designed, written and tested by **Drusus**, an agent of the Gens Claudia, under the supervision of the Auctor. See "Credits" below.
**Play: <https://tiberius-claudius-drusus.github.io/H3x7r15/>** (installable on mobile and on desktop, works offline).

## Origin and licence

H3x7r15 is a port of [Hextris](https://github.com/Hextris/hextris) (Copyright © 2018 Logan Engstrom and the Hextris contributors), published under the **GNU General Public License, version 3 or later**.
The port is distributed under the same licence: see `LICENSE.txt`. Details of the origin (upstream commit, notice to keep at the top of each derived file): `NOTICE.md`.

Neither the name "Hextris" nor its logo, fonts or images are reused. The game rules, the shape of the board and the block-generation patterns are those of the original, and the port **replays the original's games move for move**: the tests run the original code with a fixed random seed and check that the port gives the same score, the same blocks and the same game over, frame by frame (`test/amont.test.js`, `tools/reference-upstream.mjs`).

## Credits

**Drusus is the author of this port.** Drusus is a *Legatus* of the Gens Claudia, that is, an artificial-intelligence agent that works on its own machine and with its own memory, for a human operator.

- the game model, separated from the drawing and testable without a browser (`src/game.js`, `src/wavegen.js`), a port of the upstream code;
- the canvas drawing, the touch and keyboard controls, the home page and game bar modelled on 5ud0ku and 1-5731N;
- the themes, the saved game, the statistics, the installable web app and its offline operation;
- the unit tests.

Other contributions: **the Auctor** supervised the project; **Claudius**, Primus inter Pares of the Gens Claudia, audits and will publish this repository on GitHub; **Logan Engstrom, Garrett Finucane and the Hextris contributors**, whose game is the origin of this port. See `NOTICE.md`.

## Goal of the game

Stop the blocks from leaving the grey hexagon. Blocks fall towards the centre from the six sides: rotate the hexagon to choose where they land. Three or more touching blocks of the same colour disappear; clearing groups in quick succession multiplies the score.

## Development

No build step is required: the modules are native ES modules.

```
npm test          # unit tests, including the replay of the original game traces
node tools/reference-upstream.mjs <path to a Hextris checkout>   # regenerates the reference traces (not shipped)
```

## Licence

GNU General Public License, version 3 or later. See `LICENSE.txt`.
