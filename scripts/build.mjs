// Builds the static site into dist/: copies src/, product images and writes catalog.json + config.js.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const ITEMS = path.join(ROOT, 'items');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const toPosix = (p) => p.split(path.sep).join('/');
const slugify = (s) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const humanize = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function loadConfig() {
  const config = await readJson(path.join(ROOT, 'site.config.json'));
  // Environment variables (e.g. set in Vercel project settings) override the JSON file.
  if (process.env.WHATSAPP_NUMBER) config.whatsappNumber = process.env.WHATSAPP_NUMBER;
  if (process.env.STORE_NAME) config.storeName = process.env.STORE_NAME;
  if (process.env.DISPLAY_PHONE) config.displayPhone = process.env.DISPLAY_PHONE;
  config.whatsappNumber = String(config.whatsappNumber || '').replace(/\D/g, '');
  if (config.whatsappNumber && config.whatsappNumber.length < 8) {
    throw new Error('A valid whatsappNumber (with country code, e.g. 919876543210) is required in site.config.json or WHATSAPP_NUMBER.');
  }
  return config;
}

// Adds any image dropped into items/<Folder>/ that is not yet listed in data/products.json.
async function discoverNewImages(catalog) {
  const listed = new Set(catalog.products.map((p) => p.image));
  const ids = new Set(catalog.products.map((p) => p.id));
  const dirs = (await fs.readdir(ITEMS, { withFileTypes: true })).filter((d) => d.isDirectory());
  const inventory = await Promise.all(dirs.map(async (dir) => ({
    dir,
    files: (await fs.readdir(path.join(ITEMS, dir.name))).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).sort(),
  })));
  const added = [];

  for (const { dir, files } of inventory) {
    let category = catalog.categories.find((c) => c.folder === dir.name);
    if (!category) {
      category = { id: slugify(dir.name), name: humanize(dir.name), folder: dir.name, blurb: '' };
      catalog.categories.push(category);
    }
    let n = 1;
    for (const file of files) {
      const rel = `items/${dir.name}/${file}`;
      if (listed.has(rel)) continue;
      while (ids.has(`${category.id}-${n}`)) n++;
      const id = `${category.id}-${n}`;
      ids.add(id);
      const product = { id, name: category.name.replace(/s$/, ''), category: category.id, price: null, priceNote: '', description: '', image: rel };
      catalog.products.push(product);
      added.push(rel);
    }
  }
  if (added.length) {
    console.warn(`\n[build] ${added.length} new image(s) not in data/products.json were added with "Price on request":`);
    added.forEach((a) => console.warn(`  - ${a}`));
    console.warn('[build] Add them to data/products.json to set a name and price.\n');
  }
}

async function main() {
  const config = await loadConfig();
  const catalog = await readJson(path.join(ROOT, 'data', 'products.json'));
  await discoverNewImages(catalog);

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.cp(SRC, DIST, { recursive: true });
  await fs.mkdir(path.join(DIST, 'images'), { recursive: true });

  const seen = new Set();
  for (const p of catalog.products) {
    if (p.hidden) continue;
    if (!/^[a-z0-9-]+$/.test(p.id) || seen.has(p.id)) throw new Error(`Invalid or duplicate product id: "${p.id}"`);
    seen.add(p.id);
  }

  const products = (await Promise.all(catalog.products.filter((p) => !p.hidden).map(async (p) => {
    const src = path.resolve(ROOT, p.image);
    if (!src.startsWith(ITEMS + path.sep)) throw new Error(`Image for "${p.id}" must live under items/`);
    try {
      await fs.access(src);
    } catch {
      console.warn(`[build] Skipping "${p.id}": image not found (${p.image})`);
      return null;
    }
    const fileName = `${p.id}${path.extname(src).toLowerCase()}`;
    await fs.copyFile(src, path.join(DIST, 'images', fileName));
    const publicProduct = Object.fromEntries(Object.entries(p).filter(([key]) => key !== 'price' && key !== 'priceNote'));
    return { ...publicProduct, image: `images/${fileName}` };
  }))).filter(Boolean);

  const categories = catalog.categories
    .filter((c) => products.some((p) => p.category === c.id))
    .map(({ folder, ...c }) => c);

  await fs.writeFile(path.join(DIST, 'catalog.json'), JSON.stringify({ categories, products }));
  const safeJson = JSON.stringify(config).replaceAll('<', String.raw`\u003c`);
  await fs.writeFile(path.join(DIST, 'config.js'), `window.SITE_CONFIG = ${safeJson};\n`);

  console.log(`[build] ${products.length} products in ${categories.length} categories -> ${toPosix(path.relative(ROOT, DIST))}/`);
  if (config.whatsappNumber) console.log(`[build] WhatsApp orders go to +${config.whatsappNumber}`);
  else console.warn('[build] WhatsApp ordering is disabled until a number is set in site.config.json or WHATSAPP_NUMBER.');
}

try {
  await main();
} catch (err) {
  console.error(`[build] ${err.message}`);
  process.exitCode = 1;
}
