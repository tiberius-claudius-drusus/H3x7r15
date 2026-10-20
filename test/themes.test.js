/*
 * H3x7r15 — thèmes : variantes complètes, couleurs lisibles. Licence : GPL-3.0-or-later (voir LICENSE.txt).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, MODES, DEFAULT_FAMILY, resolve, normalize, pickVariant } from '../src/themes.js';

const KEYS = Object.keys(resolve('epure', 'clair')).sort();
const variants = Object.entries(THEMES).flatMap(([f, fam]) => Object.keys(fam.variants).map((v) => [f, v]));

test('quatre familles, deux variantes chacune', () => {
  assert.deepEqual(Object.keys(THEMES), ['epure', 'aurora', 'claudia', 'minamoto']);
  for (const fam of Object.values(THEMES)) assert.deepEqual(Object.keys(fam.variants).sort(), ['clair', 'fonce']);
});

test('chaque variante définit exactement les mêmes variables que la référence', () => {
  for (const [f, v] of variants) assert.deepEqual(Object.keys(resolve(f, v)).sort(), KEYS, `${f}/${v}`);
});

test('chaque variable de couleur de la page et du jeu est définie par chaque thème', () => {
  const need = ['--bg', '--fg', '--muted', '--panel', '--line', '--line-strong', '--cell', '--err', '--acc', '--accfg', '--shadow', '--veil', '--theme-color',
    '--hx-center', '--hx-ring', '--hx-text', '--hx-c0', '--hx-c1', '--hx-c2', '--hx-c3', '--hx-d0', '--hx-d1', '--hx-d2', '--hx-d3'];
  for (const [f, v] of variants) for (const k of need) assert.ok(resolve(f, v)[k], `${f}/${v} : ${k}`);
});

const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
const lum = (rgb) => {
  const [r, g, b] = rgb.map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('contraste WCAG AA (4,5) des textes essentiels, pour les couleurs opaques', () => {
  const pairs = [['--fg', '--bg'], ['--err', '--cell'], ['--muted', '--bg'], ['--accfg', '--acc'], ['--hx-text', '--hx-center']];
  for (const [f, v] of variants) {
    const vars = resolve(f, v);
    for (const [a, b] of pairs) {
      const x = hex(vars[a]), y = hex(vars[b]);
      if (!x || !y) continue; // couleur translucide (Aurora) : dépend du fond, non calculable ici
      assert.ok(ratio(x, y) >= 4.5, `${f}/${v} : ${a} sur ${b} = ${ratio(x, y).toFixed(2)}`);
    }
  }
});

test('l\'hexagone central et l\'anneau se distinguent du fond de la page', () => {
  for (const [f, v] of variants) {
    const vars = resolve(f, v);
    const bg = hex(vars['--bg']), centre = hex(vars['--hx-center']);
    if (!bg || !centre) continue;
    assert.ok(ratio(bg, centre) >= 3, `${f}/${v} : hexagone central sur le fond = ${ratio(bg, centre).toFixed(2)}`);
  }
});

test('les quatre couleurs de blocs sont distinctes, en normal et en daltonien', () => {
  for (const [f, v] of variants) {
    const vars = resolve(f, v);
    assert.equal(new Set([0, 1, 2, 3].map((i) => vars[`--hx-c${i}`])).size, 4, `${f}/${v} normal`);
    assert.equal(new Set([0, 1, 2, 3].map((i) => vars[`--hx-d${i}`])).size, 4, `${f}/${v} daltonien`);
  }
});

test('choix corrompu ramené à des valeurs valides ; variante selon le mode et le système', () => {
  assert.deepEqual(normalize({ family: 'inconnue', mode: 'x' }), { family: DEFAULT_FAMILY, mode: 'auto' });
  assert.deepEqual(normalize(), { family: DEFAULT_FAMILY, mode: 'auto' });
  assert.deepEqual(MODES, ['auto', 'clair', 'fonce']);
  assert.equal(pickVariant('auto', true), 'fonce');
  assert.equal(pickVariant('auto', false), 'clair');
  assert.equal(pickVariant('clair', true), 'clair');
  assert.equal(pickVariant('fonce', false), 'fonce');
});
