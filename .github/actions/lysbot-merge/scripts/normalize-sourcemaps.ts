import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');

const normalizeSource = (p: string): string => {
  if (p.startsWith('file://')) {
    try {
      p = fileURLToPath(p);
    } catch {
      p = p.replace(/^file:\/\//, '');
    }
  }
  return path.isAbsolute(p) ? path.relative(root, p) : path.normalize(p);
};

type SourceMapLike = {
  sources: string[];
  sourceRoot?: string;
};

const normalizeMap = (file: string): void => {
  const content = fs.readFileSync(file, 'utf8');

  // JSON.parse の any を直接受けないで、その場で型アサーション
  const map = JSON.parse(content) as SourceMapLike;

  map.sources = map.sources.map(normalizeSource);
  map.sourceRoot = '';
  fs.writeFileSync(file, JSON.stringify(map));
  console.log(`✅ ${path.relative(root, file)}`);
};

const walk = (dir: string): void => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.name;
    const full = path.join(dir, name);
    if (e.isDirectory()) {
      walk(full);
    } else if (e.isFile() && name.endsWith('.map')) {
      normalizeMap(full);
    }
  }
};

if (fs.existsSync(dist)) {
  walk(dist);
} else {
  console.warn(`⚠️ dist not found: ${dist}`);
}
