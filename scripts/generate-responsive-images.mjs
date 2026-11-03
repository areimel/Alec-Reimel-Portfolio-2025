// Rebuild responsive portfolio images and their metadata: node scripts/generate-responsive-images.mjs
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = 'public/images';
const output = `${root}/optimized`;
const manifest = {};
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (source !== output) await walk(source);
      continue;
    }
    if (!/\.(?:jpe?g|png|webp)$/i.test(entry.name)) continue;
    const metadata = await sharp(source).metadata();
    const widths = [...new Set([480, 960, 1440].map((width) => Math.min(width, metadata.width)))];
    const relative = path.relative(root, source);
    const variants = [];
    for (const width of widths) {
      const destination = path.join(output, relative.replace(/\.[^.]+$/, `-${width}.webp`));
      await mkdir(path.dirname(destination), { recursive: true });
      const result = await sharp(source)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(destination);
      variants.push({ src: `/${destination.replace(/^public\//, '')}`, width: result.width, height: result.height });
    }
    manifest[`/${source.replace(/^public\//, '')}`] = variants;
  }
}
await walk(root);
await mkdir('src/generated', { recursive: true });
await writeFile('src/generated/responsive-images.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated responsive variants for ${Object.keys(manifest).length} images.`);
