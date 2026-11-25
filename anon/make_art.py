"""Makes the Anon Army badge, logo and icons from the Anons symbol
(../Anons/logos/community-avatar.jpg, the @AnonsNFT avatar).

    ../RektGang/.venv/bin/python -I anon/make_art.py [../Anons]

Any Python with Pillow does.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ARCHIVE = Path(sys.argv[1] if len(sys.argv) > 1 else HERE.parent.parent / 'Anons').resolve()
IMG = HERE / 'public/anon/img'

# The symbol is black on white, with a soft shadow: its darkness is its
# opacity, and anything lighter than the shadow is clear.
avatar = Image.open(ARCHIVE / 'logos/community-avatar.jpg').convert('L')
alpha = avatar.point(lambda v: min(255, max(0, round((128 - v) * 255 / 100))))
alpha = alpha.crop(alpha.point(lambda v: 255 if v > 60 else 0).getbbox())


def symbol(size, colour):
    mask = ImageOps.contain(alpha, (size, size), Image.LANCZOS)
    out = Image.new('RGBA', mask.size, (*colour, 0))
    out.putalpha(mask)
    return out


def on_white(size, inner):
    out = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    face = symbol(inner, (0, 0, 0))
    out.alpha_composite(face, ((size - face.width) // 2, (size - face.height) // 2))
    return out.convert('RGB')


IMG.mkdir(parents=True, exist_ok=True)

# Sign-up's 192px logo slot, at 2x: the symbol in white (as on the Anons'
# hoodies, the screen being dark) in the top of the square, with room for the
# motto that webapp sets under it.
badge = Image.new('RGBA', (384, 384), (0, 0, 0, 0))
face = symbol(350, (255, 255, 255))
badge.alpha_composite(face, ((384 - face.width) // 2, 14))
badge.save(IMG / 'anon-army-badge.png', optimize=True)

# guild.json's logo: the avatar as it is.
shutil.copyfile(ARCHIVE / 'logos/community-avatar.jpg', IMG / 'anon-army-logo.jpg')
on_white(180, 146).save(IMG / 'apple-touch-icon.png', optimize=True)
on_white(32, 30).save(IMG / 'favicon-32x32.png', optimize=True)
on_white(48, 46).save(HERE / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
