#!/usr/bin/env python3
"""make-icons.py — génère les icônes de H3x7r15 (hexagone central entouré de piles de blocs, comme le logo).

Usage : python tools/make-icons.py   (depuis la racine du dépôt ; nécessite Pillow)
Écrit icon-180.png, icon-192.png, icon-512.png et icon-maskable-512.png (zone de sécurité de 80 %).
Licence : GPL-3.0-or-later (voir LICENSE.txt).
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

FOND = (245, 246, 248)
ANNEAU = (189, 195, 199)
CENTRE = (44, 62, 80)
COULEURS = [(231, 76, 60), (241, 196, 15), (52, 152, 219), (46, 204, 113)]
PILES = [[0, 2], [1, 1, 3], [2], [3, 0, 0], [1, 2], [0]]
E = 46 / 271.7                      # même proportion que le logo (src/logo.js)


def tourner(x, y, theta):
    r = math.radians(theta)
    return (math.cos(r) * x - math.sin(r) * y, math.sin(r) * x + math.cos(r) * y)


def hexagone(cx, cy, rayon, theta, k):
    pts = []
    x, y = tourner(0, rayon, theta)
    for _ in range(6):
        pts.append((cx + x * k, cy + y * k))
        x, y = tourner(x, y, 60)
    return pts


def dessiner(taille, marge):
    img = Image.new("RGB", (taille, taille), FOND)
    d = ImageDraw.Draw(img)
    k = taille * (1 - 2 * marge) / 100            # unités du logo (cadre de 100) -> pixels
    dec = taille * marge
    cx = cy = 50 * k + dec
    d.polygon(hexagone(cx - 0, cy - 0, 46, 30, k), fill=ANNEAU)
    r_centre = 87 * E
    h = 20 * E
    apotheme = r_centre / 2 * math.sqrt(3)
    for voie, pile in enumerate(PILES):
        angle = 90 - (30 + 60 * voie)
        for rang, couleur in enumerate(pile):
            dist = apotheme + h * rang
            larg = 2 * dist / math.sqrt(3)
            large = 2 * (dist + h) / math.sqrt(3)
            pts = [tourner(-larg / 2, h / 2, angle), tourner(larg / 2, h / 2, angle), tourner(large / 2, -h / 2, angle), tourner(-large / 2, -h / 2, angle)]
            bx = math.sin(math.radians(angle)) * (dist + h / 2)
            by = -math.cos(math.radians(angle)) * (dist + h / 2)
            d.polygon([(cx + (bx + p[0]) * k, cy + (by + p[1]) * k) for p in pts], fill=COULEURS[couleur], outline=ANNEAU)
    d.polygon(hexagone(cx, cy, r_centre, 30, k), fill=CENTRE)
    return img


def main():
    racine = Path(__file__).resolve().parent.parent
    for nom, taille, marge in (("icon-180.png", 180, 0.04), ("icon-192.png", 192, 0.04), ("icon-512.png", 512, 0.04), ("icon-maskable-512.png", 512, 0.14)):
        dessiner(taille, marge).save(racine / nom)
        print("écrit", nom)


if __name__ == "__main__":
    main()
