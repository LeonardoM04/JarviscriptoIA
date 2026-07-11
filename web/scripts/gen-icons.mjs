// Gera os ícones PNG do PWA a partir de web/icon-src.svg.
// Uso pontual: `node scripts/gen-icons.mjs` (precisa do sharp instalado).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(dir, "..", "icon-src.svg"));
const outDir = path.join(dir, "..", "public");

const sizes = [
  { file: "pwa-192.png", size: 192 },
  { file: "pwa-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(path.join(outDir, file));
  console.log("gerado", file, size + "x" + size);
}
