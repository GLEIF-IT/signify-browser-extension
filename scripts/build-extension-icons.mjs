/**
 * Rasterizes the vLEI wallet SVG into PNG sizes required by Chromium MV3
 * (SVG is not supported for manifest icons). Copies the SVG to public/ for UI use.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgPath = path.join(root, "src/assets/img/vlei-wallet-extension-logo.svg");
const publicDir = path.join(root, "public");

async function main() {
  const svg = fs.readFileSync(svgPath);
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(
    svgPath,
    path.join(publicDir, "vlei-wallet-extension-logo.svg")
  );
  for (const size of [16, 32, 48, 128]) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `icon-${size}.png`));
  }
  console.log("Wrote public/vlei-wallet-extension-logo.svg and icon-{16,32,48,128}.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
