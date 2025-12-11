import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');

/**
 * @param {string} p
 * @returns {string}
 */
const normalizeSource = (p) => {
  if (p.startsWith('file://')) {
    try {
      p = fileURLToPath(p);
    } catch {
      p = p.replace(/^file:\/\//, '');
    }
  }
  return path.isAbsolute(p) ? path.relative(root, p) : path.normalize(p);
};

/**
 * @param {string} file
 */
const normalizeMap = (file) => {
  const content = fs.readFileSync(file, 'utf8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed = JSON.parse(content);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const map = /** @type {{ sources: string[]; sourceRoot: string }} */ (parsed);
  map.sources = map.sources.map(normalizeSource);
  map.sourceRoot = '';
  fs.writeFileSync(file, JSON.stringify(map));
  console.log(`✅ ${path.relative(root, file)}`);
};

/**
 * @param {string} dir
 */
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    /** @type {string} */
    const name = e.name;
    const full = path.join(dir, name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && name.endsWith('.map')) normalizeMap(full);
  }
};

if (fs.existsSync(dist)) walk(dist);
else console.warn(`⚠️ dist not found: ${dist}`);
