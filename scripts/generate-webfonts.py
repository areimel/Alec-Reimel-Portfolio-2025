"""Generate missing WOFF2 fonts, preserving original TTF files and font metadata.

Run from the repository root with an isolated tool environment (no runtime dependency):
  python3 -m venv /tmp/portfolio-font-tools
  /tmp/portfolio-font-tools/bin/pip install 'fonttools[woff]==4.62.1' 'brotli==1.2.0'
  /tmp/portfolio-font-tools/bin/python scripts/generate-webfonts.py

Existing WOFF2 files are retained. No glyph subsetting or name/license table changes.
"""

from pathlib import Path
from fontTools.ttLib import TTFont

for source in sorted(Path('public/fonts').glob('*.ttf')):
    destination = source.with_suffix('.woff2')
    if destination.exists():
        continue
    with TTFont(source, recalcTimestamp=False) as font:
        font.flavor = 'woff2'
        font.save(destination)
    print(f'{source.name}: {source.stat().st_size} → {destination.stat().st_size} bytes')
