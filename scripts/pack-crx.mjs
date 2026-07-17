import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crx3 from "crx3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const chromeDir = path.join(root, "dist", "chrome");
const crxPath = path.join(root, "dist", "vlei-wallet.crx");
const xmlPath = path.join(root, "dist", "update_manifest.xml");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const appVersion = pkg.version;
const crxURL =
  process.env.CRX_URL || "https://REPLACE_ME.invalid/vlei-wallet.crx";

const idOnly = process.argv.includes("--id-only");

function resolveKeyPath() {
  if (process.env.CRX_PRIVATE_KEY) {
    const tmp = path.join(os.tmpdir(), "crx-signing-key.pem");
    fs.writeFileSync(tmp, process.env.CRX_PRIVATE_KEY, { mode: 0o600 });
    return tmp;
  }
  if (process.env.CRX_KEY_PATH) return process.env.CRX_KEY_PATH;
  if (process.env.CI) {
    throw new Error(
      "No signing key provided. Set the CRX_PRIVATE_KEY secret (or CRX_KEY_PATH) " +
        "before packing in CI — see docs/INTERNAL_DISTRIBUTION.md."
    );
  }
  return path.join(root, "key.pem"); // crx3 creates it if missing (dev only)
}

function deriveIdentity(keyPath) {
  const priv = crypto.createPrivateKey(fs.readFileSync(keyPath));
  const der = crypto
    .createPublicKey(priv)
    .export({ type: "spki", format: "der" });
  const hash = crypto.createHash("sha256").update(der).digest("hex");
  const id = hash
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (c) => String.fromCharCode(parseInt(c, 16) + 97));
  return { id, manifestKey: der.toString("base64") };
}

async function main() {
  const keyPath = resolveKeyPath();

  // For --id-only we just need a key to exist; create one if asked to (dev).
  if (!fs.existsSync(keyPath)) {
    if (idOnly) {
      throw new Error(
        `No signing key found at ${keyPath}. Generate one first ` +
          `(see docs/INTERNAL_DISTRIBUTION.md) or run a full pack.`
      );
    }
  } else {
    const { id, manifestKey } = deriveIdentity(keyPath);
    console.log(`Extension ID:  ${id}`);
    console.log(`Manifest key:  ${manifestKey}`);
    if (idOnly) return;
  }

  if (!fs.existsSync(path.join(chromeDir, "manifest.json"))) {
    throw new Error(
      `${chromeDir} has no manifest.json — run "npm run build" before packing.`
    );
  }

  if (crxURL.includes("REPLACE_ME")) {
    console.warn(
      "WARNING: CRX_URL is unset; update_manifest.xml will contain a " +
        "placeholder codebase URL. Set CRX_URL for a real publish."
    );
  }

  await crx3([chromeDir], { keyPath, crxPath, xmlPath, crxURL, appVersion });

  const { id } = deriveIdentity(keyPath);
  console.log(`Packed ${path.relative(root, crxPath)} (v${appVersion}, id ${id})`);
  console.log(`Wrote  ${path.relative(root, xmlPath)} → codebase ${crxURL}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
