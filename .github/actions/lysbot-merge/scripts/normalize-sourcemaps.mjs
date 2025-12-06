import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');

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

const normalizeMap = (file) => {
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  map.sources = map.sources.map(normalizeSource);
  map.sourceRoot = '';
  fs.writeFileSync(file, JSON.stringify(map));
  console.log(`✅ ${path.relative(root, file)}`);
};

const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && e.name.endsWith('.map')) normalizeMap(full);
  }
};

if (fs.existsSync(dist)) walk(dist);
else console.warn(`⚠️ dist not found: ${dist}`);
