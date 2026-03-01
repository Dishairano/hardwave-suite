#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function usage() {
  // eslint-disable-next-line no-console
  console.log(`
Generate a Tauri updater manifest (latest.json).

Usage:
  node scripts/generate-latest-json.mjs --in <release-files-dir> --base-url <base-url> [--out latest.json] [--notes "..."]

Examples:
  node scripts/generate-latest-json.mjs --in release-files --base-url https://hardwavestudios.com/api/download-file --out hardwave-suite-latest.json
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function ensureTrailingUrlSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function isoUtcSecondsNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const inDir = args.in;
  const baseUrl = args['base-url'];
  const outFile = args.out || 'latest.json';
  const notes = args.notes || 'Bug fixes and improvements';

  if (!inDir || !baseUrl) {
    usage();
    process.exit(2);
  }

  const cfgPath = new URL('../src-tauri/tauri.conf.json', import.meta.url);
  const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8'));
  const version = cfg?.version;
  if (!version) {
    throw new Error('Could not read app version from src-tauri/tauri.conf.json');
  }

  const files = (await fs.readdir(inDir)).sort();
  const pick = (predicate) => files.find(predicate) || '';

  const winFile = pick((f) => f.toLowerCase().endsWith('-setup.exe'));
  const macFile = pick((f) => f.toLowerCase().endsWith('.app.tar.gz'));
  const linuxFile = pick((f) => f.toLowerCase().endsWith('.appimage'));

  const missingFiles = [
    ['WIN_FILE', winFile],
    ['MAC_FILE', macFile],
    ['LINUX_FILE', linuxFile],
  ].filter(([, v]) => !v).map(([k]) => k);

  if (missingFiles.length) {
    throw new Error(`Missing required artifacts in ${inDir}: ${missingFiles.join(', ')}`);
  }

  const readSig = async (file) => {
    const sigPath = path.join(inDir, `${file}.sig`);
    const sig = await fs.readFile(sigPath, 'utf8');
    return sig.replace(/[\r\n]+/g, '');
  };

  const [winSig, macSig, linuxSig] = await Promise.all([
    readSig(winFile),
    readSig(macFile),
    readSig(linuxFile),
  ]);

  const base = ensureTrailingUrlSlash(baseUrl);
  const urlFor = (file) => `${base}${encodeURIComponent(file)}`;

  const manifest = {
    version,
    notes,
    pub_date: isoUtcSecondsNow(),
    platforms: {
      'windows-x86_64': { signature: winSig, url: urlFor(winFile) },
      'darwin-aarch64': { signature: macSig, url: urlFor(macFile) },
      'linux-x86_64': { signature: linuxSig, url: urlFor(linuxFile) },
    },
  };

  await fs.writeFile(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outFile} for v${version}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exit(1);
});

