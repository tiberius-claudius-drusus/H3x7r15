/*
 * H3x7r15 — registre de thèmes
 * Copyright (C) 2026 Drusus (Gens Claudia). Licence : GPL-3.0-or-later (voir LICENSE.txt).
 *
 * Un THÈME est une famille (« Épuré », « Aurora »…) qui propose des VARIANTES (« clair », « foncé »). Chaque variante =
 * des variables CSS posées sur la page ; aucune couleur n'est écrite en dur dans l'interface. Une variante peut hériter
 * d'une autre (`base: 'clair'` dans la même famille, ou `base: 'epure/clair'`). Principe et familles repris de T-7r4V3x
 * (même auteur) : Épuré, Aurora, Gens Claudia (style de la tuile du portail), 源氏 Uji Minamoto.
 *
 * Variables : --bg --fg --muted --panel --line --line-strong --cell --err --acc --accfg --shadow --veil --theme-color,
 * celles du jeu : --hx-center (hexagone central) --hx-ring (anneau) --hx-text (score) --hx-c0..3 (couleurs des blocs)
 * --hx-d0..3 (couleurs du mode daltonien), et la forme : --btn-radius --board-radius --ui-font --h1-spacing --h2-spacing
 * --h2-transform --bg-image --bf.
 */
export const THEMES = {
  epure: {
    label: 'Épuré',
    variants: {
      clair: {
        label: 'Clair',
        vars: {
          '--bg': '#f5f6f8', '--fg': '#1c1f26', '--muted': '#5f6678', '--panel': '#ffffff', '--line': '#c4c9d4', '--line-strong': '#1c1f26',
          '--cell': '#ffffff',
          '--err': '#c62828', '--acc': '#2456b8', '--accfg': '#ffffff',
          '--shadow': '0 1px 3px rgba(0,0,0,.18)', '--veil': 'rgba(0,0,0,.45)', '--hx-center': '#2c3e50', '--hx-ring': '#bdc3c7', '--hx-text': '#ecf0f1',
          '--hx-c0': '#e74c3c', '--hx-c1': '#f1c40f', '--hx-c2': '#3498db', '--hx-c3': '#2ecc71',
          '--hx-d0': '#8e44ad', '--hx-d1': '#f1c40f', '--hx-d2': '#3498db', '--hx-d3': '#d35400', '--theme-color': '#f5f6f8',
          '--btn-radius': '10px', '--board-radius': '6px', '--ui-font': "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
          '--h1-spacing': '.04em', '--h2-spacing': 'normal', '--h2-transform': 'none', '--bg-image': 'none', '--bf': 'none', '--digit-font': 'inherit',
        },
      },
      fonce: {
        label: 'Foncé',
        base: 'clair',
        vars: {
          '--bg': '#16181d', '--fg': '#e6e8ee', '--muted': '#9aa1b3', '--panel': '#20232b', '--line': '#3a3f4d', '--line-strong': '#c9cedb',
          '--cell': '#1d2027',
          '--err': '#ff6b6b', '--acc': '#7fa6ff', '--accfg': '#10131a',
          '--shadow': '0 1px 3px rgba(0,0,0,.6)', '--hx-center': '#c9d1dc', '--hx-ring': '#3a4150', '--hx-text': '#16181d', '--theme-color': '#16181d',
        },
      },
    },
  },
  aurora: {
    label: 'Aurora',
    variants: {
      clair: {
        label: 'Clair',
        base: 'epure/clair',
        vars: {
          '--bg': '#e8edfb', '--fg': '#1b2142', '--muted': '#4f5a85', '--panel': 'rgba(255,255,255,.72)', '--line': 'rgba(120,130,190,.38)',
          '--line-strong': '#3b4690', '--cell': 'rgba(255,255,255,.74)',
 '--err': '#c62828',
          '--acc': '#4659e0', '--accfg': '#ffffff',
          '--shadow': '0 4px 18px rgba(80,90,170,.18)', '--veil': 'rgba(60,70,130,.35)', '--hx-center': '#2c3e50', '--hx-ring': '#bdc3c7', '--hx-text': '#ecf0f1', '--theme-color': '#e8edfb',
          '--btn-radius': '16px', '--board-radius': '12px', '--bg-image': 'linear-gradient(135deg,#d6e4ff 0%,#ece3ff 48%,#ffe3ee 100%)',
          '--bf': 'blur(14px) saturate(1.4)',
        },
      },
      fonce: {
        label: 'Foncé',
        base: 'epure/fonce',
        vars: {
          '--bg': '#17142b', '--fg': '#ece9ff', '--muted': '#a29cc9', '--panel': 'rgba(34,30,66,.84)', '--line': 'rgba(255,255,255,.17)',
          '--line-strong': '#b8bfff', '--cell': 'rgba(255,255,255,.09)',
 '--err': '#ff8080',
          '--acc': '#8f9cff', '--accfg': '#10131a',
          '--shadow': '0 4px 18px rgba(0,0,0,.35)', '--veil': 'rgba(5,3,20,.6)', '--hx-center': '#c9d1dc', '--hx-ring': '#3a4150', '--hx-text': '#16181d', '--theme-color': '#17142b',
          '--btn-radius': '16px', '--board-radius': '12px', '--bg-image': 'linear-gradient(135deg,#1a1840 0%,#2a1a4a 50%,#3a1a38 100%)',
          '--bf': 'blur(14px) saturate(1.3)',
        },
      },
    },
  },
  /*
   * Gens Claudia — style de la tuile « Gens Claudia » du portail Inter Gentes : fonds brun-or, filets bronze, Georgia,
   * titres en majuscules espacées. « Parchemin » en est la version claire.
   */
  claudia: {
    label: 'Gens Claudia',
    variants: {
      clair: {
        label: 'Parchemin',
        base: 'epure/clair',
        vars: {
          '--bg': '#f3ead7', '--fg': '#2a1d14', '--muted': '#6a5b46', '--panel': '#fbf5e6', '--line': '#c9b27c', '--line-strong': '#8a7040',
          '--cell': '#fbf5e6',
          '--err': '#a8322d', '--acc': '#7a5a1c', '--accfg': '#fff9ec',
          '--shadow': '0 1px 3px rgba(42,29,20,.35)', '--veil': 'rgba(42,29,20,.45)', '--hx-center': '#2c3e50', '--hx-ring': '#bdc3c7', '--hx-text': '#ecf0f1', '--theme-color': '#f3ead7',
          '--btn-radius': '3px', '--board-radius': '3px', '--ui-font': "Georgia,'Times New Roman',serif", '--digit-font': "'Times New Roman',Times,serif",
          '--h1-spacing': '.12em', '--h2-spacing': '.12em', '--h2-transform': 'uppercase',
        },
      },
      fonce: {
        label: 'Nuit de bronze',
        base: 'claudia/clair',
        vars: {
          '--bg': '#1e1810', '--bg-image': 'linear-gradient(160deg,#1e1810 0%,#2c2218 100%)', '--fg': '#e8d8a0', '--muted': '#b9a273',
          '--panel': '#2c2218', '--line': '#5c4a28', '--line-strong': '#a88a4c', '--cell': '#3a2d18',
 '--err': '#ff9078', '--acc': '#d8b45c', '--accfg': '#1e1810',
          '--shadow': '0 1px 3px rgba(0,0,0,.7)', '--veil': 'rgba(0,0,0,.6)', '--hx-center': '#c9d1dc', '--hx-ring': '#3a4150', '--hx-text': '#16181d', '--theme-color': '#1e1810',
        },
      },
    },
  },
  /*
   * Uji Minamoto — style de la tuile « Uji Minamoto » du portail : bleu nuit et indigo, Georgia.
   * « Washi » (papier japonais) en est la version claire.
   */
  minamoto: {
    label: '源氏',
    variants: {
      clair: {
        label: 'Washi',
        base: 'epure/clair',
        vars: {
          '--bg': '#eef1f6', '--fg': '#0c1424', '--muted': '#46557a', '--panel': '#ffffff', '--line': '#b8c4d8', '--line-strong': '#2a3a5c',
          '--cell': '#f7f9fc',
          '--err': '#b3261e', '--acc': '#2a3a5c', '--accfg': '#ffffff',
          '--shadow': '0 1px 3px rgba(12,20,36,.3)', '--veil': 'rgba(12,20,36,.45)', '--hx-center': '#2c3e50', '--hx-ring': '#bdc3c7', '--hx-text': '#ecf0f1', '--theme-color': '#eef1f6',
          '--btn-radius': '6px', '--board-radius': '6px', '--ui-font': "Georgia,'Times New Roman',serif", '--digit-font': "'Times New Roman',Times,serif", '--h1-spacing': '.04em',
        },
      },
      fonce: {
        label: 'Nuit indigo',
        base: 'minamoto/clair',
        vars: {
          '--bg': '#0d1018', '--bg-image': 'linear-gradient(160deg,#0d1018 0%,#141824 100%)', '--fg': '#b8d0f0', '--muted': '#7a98c4',
          '--panel': '#14203a', '--line': '#2a3a5c', '--line-strong': '#6a8ab8', '--cell': '#0f1730',
 '--err': '#ff8f8a', '--acc': '#6f9ad8', '--accfg': '#0d1018',
          '--shadow': '0 1px 3px rgba(0,0,0,.7)', '--veil': 'rgba(0,0,0,.6)', '--hx-center': '#c9d1dc', '--hx-ring': '#3a4150', '--hx-text': '#16181d', '--theme-color': '#0d1018',
        },
      },
    },
  },
};
export const DEFAULT_FAMILY = 'epure';
export const MODES = ['auto', 'clair', 'fonce'];
/** Variables CSS d'une variante, héritage `base` résolu (protégé contre les boucles). */
export function resolve(family, variant, seen = new Set()) {
  const fam = THEMES[family];
  const v = fam?.variants?.[variant];
  if (!v) return {};
  const key = `${family}/${variant}`;
  if (seen.has(key)) return { ...v.vars };
  seen.add(key);
  let base = {};
  if (v.base) {
    const [bf, bv] = v.base.includes('/') ? v.base.split('/') : [family, v.base];
    base = resolve(bf, bv, seen);
  }
  return { ...base, ...v.vars };
}
/** Choix valides à partir d'un choix éventuellement corrompu (stockage local). */
export function normalize({ family, mode } = {}) {
  return {
    family: THEMES[family] ? family : DEFAULT_FAMILY,
    mode: MODES.includes(mode) ? mode : 'auto',
  };
}
/** Variante (clair/foncé) effective pour un mode donné et la préférence du système. */
export function pickVariant(mode, prefersDark) {
  if (mode === 'clair' || mode === 'fonce') return mode;
  return prefersDark ? 'fonce' : 'clair';
}
/** Pose les variables sur l'élément racine et met à jour la couleur de la barre du navigateur. */
export function apply(choice, prefersDark, root = document.documentElement, doc = document) {
  const { family, mode } = normalize(choice);
  const variant = pickVariant(mode, prefersDark);
  const vars = resolve(family, variant);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = `${family}-${variant}`;
  for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
    if (vars['--theme-color']) meta.setAttribute('content', vars['--theme-color']);
  }
  return { family, variant };
}
