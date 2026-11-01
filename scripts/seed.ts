// Deterministic seed for Shoply Admin.
// Creates data/shoply.seed.db (pristine snapshot), copies it to data/shoply.db,
// and generates product photos in public/products/.
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { mulberry32, pick, int } from './rng.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'data');
const SEED_DB = join(DATA, 'shoply.seed.db');
const LIVE_DB = join(DATA, 'shoply.db');
const IMG_DIR = join(ROOT, 'public', 'products');

const N_PRODUCTS = 5_000;
const N_ORDERS = 50_000;
const N_REVIEWS = 200_000;
const N_IMAGES = 48;
const BASE_DATE = Date.UTC(2026, 9, 31, 12, 0, 0); // 2026-10-31

const rand = mulberry32(20261031);

const CATEGORIES = ['Audio', 'Cameras', 'Computers', 'Gaming', 'Home', 'Kitchen', 'Outdoor', 'Phones', 'Smart Home', 'Sports', 'Wearables', 'Office'];
const BRANDS = ['Arcadia', 'Borealis', 'Cobalt', 'Driftwood', 'Ember', 'Fjord', 'Granite', 'Halcyon', 'Ironbark', 'Juniper', 'Kestrel', 'Lumen', 'Meridian', 'Nimbus', 'Onyx', 'Pinecrest', 'Quartz', 'Redwood', 'Sierra', 'Tidal', 'Umber', 'Vantage', 'Willow', 'Xenon', 'Yarrow', 'Zephyr', 'Atlas', 'Beacon', 'Cascade', 'Dune'];
const ADJ = ['Pro', 'Ultra', 'Mini', 'Max', 'Air', 'Lite', 'Plus', 'Studio', 'Go', 'Prime', 'Edge', 'One'];
const NOUNS: Record<string, string[]> = {
  Audio: ['Headphones', 'Earbuds', 'Speaker', 'Soundbar', 'Turntable', 'Amplifier'],
  Cameras: ['Mirrorless Camera', 'Action Cam', 'Lens 35mm', 'Tripod', 'Gimbal', 'Ring Light'],
  Computers: ['Laptop 14"', 'Laptop 16"', 'Mechanical Keyboard', 'Monitor 27"', 'Docking Station', 'Mouse'],
  Gaming: ['Controller', 'Headset', 'Gaming Chair', 'Capture Card', 'Arcade Stick', 'Racing Wheel'],
  Home: ['Air Purifier', 'Robot Vacuum', 'Desk Lamp', 'Humidifier', 'Fan', 'Heater'],
  Kitchen: ['Espresso Machine', 'Blender', 'Kettle', 'Air Fryer', 'Grinder', 'Toaster'],
  Outdoor: ['Tent', 'Backpack 40L', 'Headlamp', 'Water Filter', 'Camp Stove', 'Sleeping Bag'],
  Phones: ['Phone Case', 'Charger 65W', 'Power Bank', 'Screen Protector', 'MagSafe Stand', 'Cable 2m'],
  'Smart Home': ['Smart Plug', 'Doorbell', 'Thermostat', 'Hub', 'Light Strip', 'Sensor Kit'],
  Sports: ['Yoga Mat', 'Kettlebell', 'Jump Rope', 'Foam Roller', 'Bike Light', 'Water Bottle'],
  Wearables: ['Smartwatch', 'Fitness Band', 'Smart Ring', 'Watch Strap', 'Sleep Mask', 'Heart Monitor'],
  Office: ['Standing Desk', 'Office Chair', 'Webcam', 'Microphone', 'Desk Mat', 'Monitor Arm'],
};
const FIRST = ['Liam', 'Emma', 'Noah', 'Olivia', 'Ava', 'Elijah', 'Sofia', 'Lucas', 'Mia', 'Mateo', 'Amelia', 'Leo', 'Isla', 'Yusuf', 'Aya', 'Hiro', 'Chloé', 'Omar', 'Nadia', 'Jonas', 'Freya', 'Ravi', 'Zara', 'Diego', 'Ingrid', 'Kofi', 'Lea', 'Tomás', 'Maya', 'Ezra'];
const LAST = ['Smith', 'Garcia', 'Müller', 'Rossi', 'Dubois', 'Kowalski', 'Tanaka', 'Silva', 'Nguyen', 'Haddad', 'Johansson', 'Okafor', 'Novak', 'Petrov', 'Costa', 'Murphy', 'Schmidt', 'Benali', 'Lindqvist', 'Moreau'];
const CITIES = ['Lisbon', 'Berlin', 'Lyon', 'Milan', 'Madrid', 'Oslo', 'Krakow', 'Dublin', 'Rotterdam', 'Vienna', 'Casablanca', 'Porto', 'Gothenburg', 'Ghent', 'Seville'];
const STREETS = ['Market St', 'Harbour Rd', 'Elm Ave', 'Station Sq', 'Mill Lane', 'King St', 'Garden Way', 'Bridge St'];
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'delivered', 'delivered', 'cancelled', 'refunded'];
const CHANNELS = ['web', 'web', 'web', 'mobile', 'mobile', 'marketplace', 'pos'];
const WORDS = 'quality build battery sound value design comfortable shipping fast sturdy premium reliable setup easy app connection crisp bright quiet powerful compact elegant durable smooth responsive packaging support warranty price performance'.split(' ');
const REVIEW_TITLES = ['Exactly what I needed', 'Great value', 'Solid but pricey', 'Would buy again', 'Not bad at all', 'Disappointed', 'Exceeded expectations', 'Does the job', 'Five stars', 'Mixed feelings'];

function sentence(n: number): string {
  const w: string[] = [];
  for (let i = 0; i < n; i++) w.push(pick(rand, WORDS));
  const s = w.join(' ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}
function paragraph(sentences: number): string {
  const out: string[] = [];
  for (let i = 0; i < sentences; i++) out.push(sentence(int(rand, 8, 16)));
  return out.join(' ');
}

function seedDb() {
  mkdirSync(DATA, { recursive: true });
  for (const f of [SEED_DB, `${SEED_DB}-wal`, `${SEED_DB}-shm`]) if (existsSync(f)) rmSync(f);
  const db = new DatabaseSync(SEED_DB);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      name TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, permissions TEXT NOT NULL,
      avatar_color TEXT NOT NULL, region TEXT NOT NULL, theme TEXT NOT NULL
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY, sku TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL,
      category TEXT NOT NULL, brand TEXT NOT NULL, description TEXT NOT NULL, specs TEXT NOT NULL,
      tags TEXT NOT NULL, price_cents INTEGER NOT NULL, cost_cents INTEGER NOT NULL,
      stock INTEGER NOT NULL, reorder_level INTEGER NOT NULL, image INTEGER NOT NULL, images TEXT NOT NULL,
      rating REAL NOT NULL, review_count INTEGER NOT NULL, weight_g INTEGER NOT NULL,
      dimensions TEXT NOT NULL, seo_title TEXT NOT NULL, seo_description TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY, number TEXT NOT NULL, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL, shipping_address TEXT NOT NULL, billing_address TEXT NOT NULL,
      status TEXT NOT NULL, channel TEXT NOT NULL, currency TEXT NOT NULL, total_cents INTEGER NOT NULL,
      items TEXT NOT NULL, product_id INTEGER NOT NULL, notes TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, author TEXT NOT NULL, rating INTEGER NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, helpful INTEGER NOT NULL, verified INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const insUser = db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)');
  insUser.run(1, 'alice', 'password', 'Alice Martin', 'alice@shoply.test', 'admin',
    JSON.stringify({ revenue: true, refunds: true, exports: true, settings: true }), '#6d28d9', 'EU-West', 'light');
  insUser.run(2, 'bob', 'password', 'Bob Chen', 'bob@shoply.test', 'staff',
    JSON.stringify({ revenue: false, refunds: false, exports: false, settings: true }), '#0f766e', 'EU-North', 'light');

  db.exec('BEGIN');
  const insProduct = db.prepare('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const prices: number[] = [0];
  for (let id = 1; id <= N_PRODUCTS; id++) {
    const category = CATEGORIES[(id - 1) % CATEGORIES.length];
    const brand = pick(rand, BRANDS);
    const noun = pick(rand, NOUNS[category]);
    const name = `${brand} ${noun} ${pick(rand, ADJ)}${rand() < 0.3 ? ' ' + int(rand, 2, 9) : ''}`;
    const price = int(rand, 9, 1800) * 100 + pick(rand, [0, 49, 90, 99]);
    prices.push(price);
    const image = (id * 7) % N_IMAGES;
    const images = [image, (image + 5) % N_IMAGES, (image + 11) % N_IMAGES, (image + 17) % N_IMAGES];
    const specs: Record<string, string> = {};
    for (let i = 0; i < 12; i++) specs[`${pick(rand, WORDS)}_${i}`] = `${int(rand, 1, 999)} ${pick(rand, ['mm', 'g', 'W', 'h', 'dB', 'GB', 'mAh'])}`;
    const created = new Date(BASE_DATE - int(rand, 30, 900) * 86400_000).toISOString();
    insProduct.run(
      id, `SKU-${String(id).padStart(6, '0')}`, name, name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + id,
      category, brand, paragraph(int(rand, 2, 4)), JSON.stringify(specs),
      JSON.stringify([pick(rand, WORDS), pick(rand, WORDS), pick(rand, WORDS)]),
      price, Math.round(price * (0.4 + rand() * 0.3)), int(rand, 0, 400), int(rand, 5, 40),
      image, JSON.stringify(images), 0, 0, int(rand, 50, 9000),
      `${int(rand, 5, 80)} x ${int(rand, 5, 80)} x ${int(rand, 2, 40)} cm`,
      `${name} | Shoply`, paragraph(2), created, created,
    );
  }
  db.exec('COMMIT');

  db.exec('BEGIN');
  const insOrder = db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let id = 1; id <= N_ORDERS; id++) {
    const first = pick(rand, FIRST), last = pick(rand, LAST);
    const nItems = int(rand, 1, 4);
    const items: { productId: number; qty: number; unitPriceCents: number }[] = [];
    let total = 0;
    for (let i = 0; i < nItems; i++) {
      const productId = int(rand, 1, N_PRODUCTS);
      const qty = int(rand, 1, 3);
      items.push({ productId, qty, unitPriceCents: prices[productId] });
      total += qty * prices[productId];
    }
    // Skew towards recent dates so charts have a trend.
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 365);
    const created = new Date(BASE_DATE - daysAgo * 86400_000 - int(rand, 0, 86_399) * 1000).toISOString();
    const address = `${int(rand, 1, 240)} ${pick(rand, STREETS)}, ${pick(rand, CITIES)}`;
    insOrder.run(
      id, `SH-${String(100000 + id)}`, `${first} ${last}`,
      `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '') + `${id % 97}@mail.test`,
      `+351 9${int(rand, 10, 99)} ${int(rand, 100, 999)} ${int(rand, 100, 999)}`,
      address, rand() < 0.8 ? address : `${int(rand, 1, 240)} ${pick(rand, STREETS)}, ${pick(rand, CITIES)}`,
      pick(rand, STATUSES), pick(rand, CHANNELS), 'EUR', total, JSON.stringify(items), items[0].productId,
      rand() < 0.15 ? sentence(int(rand, 6, 14)) : '', created, created,
    );
  }
  db.exec('COMMIT');

  db.exec('BEGIN');
  const insReview = db.prepare('INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?,?)');
  for (let id = 1; id <= N_REVIEWS; id++) {
    const productId = int(rand, 1, N_PRODUCTS);
    const r = rand();
    const rating = r < 0.05 ? 1 : r < 0.12 ? 2 : r < 0.27 ? 3 : r < 0.6 ? 4 : 5;
    insReview.run(
      id, productId, `${pick(rand, FIRST)} ${pick(rand, LAST)[0]}.`, rating, pick(rand, REVIEW_TITLES),
      paragraph(int(rand, 2, 5)), int(rand, 0, 120), rand() < 0.7 ? 1 : 0,
      new Date(BASE_DATE - int(rand, 0, 700) * 86400_000).toISOString(),
    );
  }
  db.exec('COMMIT');
  // Temporary index so the denormalisation below is fast; the shipped schema has no secondary indexes.
  db.exec('CREATE INDEX tmp_reviews_product ON reviews(product_id)');
  db.exec(`
    UPDATE products SET
      rating = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE reviews.product_id = products.id), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE reviews.product_id = products.id);
  `);
  db.exec('DROP INDEX tmp_reviews_product');
  db.exec('VACUUM');
  db.close();
  copyFileSync(SEED_DB, LIVE_DB);
}

async function seedImages() {
  mkdirSync(IMG_DIR, { recursive: true });
  const W = 1600, H = 1600;
  for (let i = 0; i < N_IMAGES; i++) {
    const r = mulberry32(1000 + i);
    const hue = (i * 360) / N_IMAGES;
    const raw = Buffer.alloc(W * H * 3);
    const [r1, g1, b1] = hsl(hue, 0.55, 0.62), [r2, g2, b2] = hsl((hue + 40) % 360, 0.6, 0.38);
    const cx = W * (0.35 + r() * 0.3), cy = H * (0.35 + r() * 0.3), rad = W * (0.22 + r() * 0.1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = (x + y) / (W + H);
        let R = r1 + (r2 - r1) * t, G = g1 + (g2 - g1) * t, B = b1 + (b2 - b1) * t;
        const d = Math.hypot(x - cx, y - cy);
        if (d < rad) { const k = 1 - d / rad; R += 90 * k; G += 90 * k; B += 90 * k; }
        const n = (r() - 0.5) * 34; // sensor-like grain keeps the JPEGs realistically heavy
        const o = (y * W + x) * 3;
        raw[o] = clamp(R + n); raw[o + 1] = clamp(G + n); raw[o + 2] = clamp(B + n);
      }
    }
    await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toFile(join(IMG_DIR, `p${i}.jpg`));
  }
}

function clamp(v: number) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}

const t0 = performance.now();
seedDb();
console.log(`database seeded in ${((performance.now() - t0) / 1000).toFixed(1)}s → ${LIVE_DB}`);
if (!existsSync(join(IMG_DIR, `p${N_IMAGES - 1}.jpg`)) || process.argv.includes('--images')) {
  await seedImages();
  console.log(`generated ${N_IMAGES} product photos → ${IMG_DIR}`);
}
