"""Makes the profile pictures this site hosts (anon/pfp/) from the Anons NFT
archive (../Anons, see its README.txt).

Every picture becomes a 320px square WebP, anon/pfp/<collection>/<id>.webp, and
anon/pfp/collections.json lists each collection, its ids and any it lacks; the
gallery (anon/runtime/gallery.js) reads it.

The originals are square already, so they are only scaled: OG Anons are 1080px
drawings (PNG, five as WebP), Anon Army 560px renders (WebP). 120 of Anon
Army's 1,740 were never revealed in the public record and have no picture.

    ../RektGang/.venv/bin/python -I anon/make_pfps.py [../Anons]

Any Python with Pillow does. Existing pictures are kept; delete one (or a
collection's folder) to remake it.
"""
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

SIZE = 320
HERE = Path(__file__).resolve().parent
OUT = HERE / 'pfp'

# slug, name, tab label, archive folder, first id, last id
COLLECTIONS = [
    ('army', 'Anon Army', 'Anon Army', 'Anon Army S2', 1, 1740),
    ('og', 'OG Anon', 'OG Anons', 'OG Anons', 1, 580),
]


def source(folder, id_):
    return next((f for f in (folder / f'{id_}.png', folder / f'{id_}.webp') if f.exists()), None)


def convert(job):
    src, dst = job
    if dst.exists():
        return
    with Image.open(src) as im:
        if im.width != im.height:
            raise ValueError(f'{src} is not square: {im.size}')
        im = im.convert('RGBA')
        flat = Image.new('RGB', im.size, (0, 0, 0))
        flat.paste(im, mask=im.getchannel('A'))
        tmp = dst.with_suffix('.tmp')
        flat.resize((SIZE, SIZE), Image.LANCZOS).save(tmp, 'WEBP', quality=82, method=6)
        os.replace(tmp, dst)


def main(archive):
    jobs, manifest = [], []
    for slug, name, label, folder, first, last in COLLECTIONS:
        (OUT / slug).mkdir(parents=True, exist_ok=True)
        missing = []
        for id_ in range(first, last + 1):
            src = source(archive / folder / 'images', id_)
            if src:
                jobs.append((src, OUT / slug / f'{id_}.webp'))
            else:
                missing.append(id_)
        manifest.append({'slug': slug, 'name': name, 'label': label, 'first': first, 'last': last, 'missing': missing})
        print(f'{slug}: {first}-{last}, {len(missing)} missing', flush=True)

    with ProcessPoolExecutor() as pool:
        for i, _ in enumerate(pool.map(convert, jobs, chunksize=16), 1):
            if i % 500 == 0:
                print(f'{i}/{len(jobs)}', flush=True)

    # One collection to a line: Anon Army's missing ids are many.
    lines = ',\n'.join(f'  {json.dumps(c)}' for c in manifest)
    (OUT / 'collections.json').write_text(f'[\n{lines}\n]\n')
    print(f'{len(jobs)} pictures in {OUT}')


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else HERE.parent.parent / 'Anons').resolve())
