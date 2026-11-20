// ViceFrame Studio — make.fun handoff for gta6-cover-art-01.
//
// Copies the finished entry (app/ + screenshots/) into the output directory
// and writes the dossier that describes it, using the vendored builder.
// Run:  MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });

let copiedFiles = 0;
let copiedBytes = 0;
for (const part of ['app', 'screenshots']) {
  cpSync(join(here, part), join(outDir, part), { recursive: true });
  for (const entry of readdirSync(join(outDir, part), { recursive: true })) {
    const full = join(outDir, part, entry as string);
    const st = statSync(full);
    if (st.isFile()) {
      copiedFiles += 1;
      copiedBytes += st.size;
    }
  }
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`ViceFrame Studio handed in to ${outDir}`);
console.log(`  copied ${copiedFiles} files (${copiedBytes} bytes) from app/ + screenshots/`);
console.log(`  dossier.json written (${dossier.byteLength} bytes)`);
