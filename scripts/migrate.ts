#!/usr/bin/env npx tsx
/**
 * Database migration runner for Hardwave Studios.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts             — apply all pending migrations
 *   npx tsx scripts/migrate.ts --status    — show applied/pending status
 *   npx tsx scripts/migrate.ts --dry-run   — print SQL without executing
 *
 * Reads credentials from .env.local at the repo root (or process.env).
 * Tracks applied migrations in the `schema_migrations` table.
 *
 * Migration files: migrations/*.sql  (sorted lexicographically → use 001_, 002_ prefixes)
 */

import fs from 'fs';
import path from 'path';
import { createConnection } from 'mysql2/promise';

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host:     process.env.DATABASE_HOST     || 'localhost',
  port:     parseInt(process.env.DATABASE_PORT || '3306'),
  user:     process.env.DATABASE_USER!,
  password: process.env.DATABASE_PASSWORD!,
  database: process.env.DATABASE_NAME!,
  multipleStatements: true,   // needed to run full .sql files in one shot
};

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

const RESET   = '\x1b[0m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const CYAN    = '\x1b[36m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';

function log(msg: string)     { process.stdout.write(msg + '\n'); }
function info(msg: string)    { log(`${CYAN}▶ ${msg}${RESET}`); }
function success(msg: string) { log(`${GREEN}✓ ${msg}${RESET}`); }
function warn(msg: string)    { log(`${YELLOW}⚠ ${msg}${RESET}`); }
function die(msg: string): never  { log(`${RED}✗ ${msg}${RESET}`); process.exit(1); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const statusOnly = args.includes('--status');
  const dryRun     = args.includes('--dry-run');

  if (!DB_CONFIG.user || !DB_CONFIG.password || !DB_CONFIG.database) {
    die('Missing DATABASE_USER, DATABASE_PASSWORD, or DATABASE_NAME in .env.local');
  }

  const conn = await createConnection(DB_CONFIG).catch((err) => {
    die(`Cannot connect to database: ${err.message}`);
  });

  try {
    // ── Ensure tracking table exists ─────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Load applied migrations ──────────────────────────────────────────────
    const [rows] = await conn.execute<any[]>(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const applied = new Set<string>(rows.map((r: any) => r.filename));

    // ── Discover migration files ─────────────────────────────────────────────
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      die(`migrations/ directory not found at ${MIGRATIONS_DIR}`);
    }
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();  // lexicographic — 001_ < 002_ < ... reliably

    if (files.length === 0) {
      warn('No .sql files found in migrations/');
      return;
    }

    // ── Status mode ──────────────────────────────────────────────────────────
    if (statusOnly) {
      log('');
      log(`${BOLD}Migration status${RESET}`);
      log('─'.repeat(50));
      for (const f of files) {
        const done = applied.has(f);
        log(`  ${done ? `${GREEN}✓ applied${RESET}` : `${YELLOW}○ pending${RESET}`}   ${done ? DIM : ''}${f}${RESET}`);
      }
      const pending = files.filter(f => !applied.has(f));
      log('');
      log(`  ${GREEN}${applied.size} applied${RESET}   ${pending.length > 0 ? YELLOW : GREEN}${pending.length} pending${RESET}`);
      log('');
      return;
    }

    // ── Apply pending migrations ─────────────────────────────────────────────
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      success('All migrations already applied — nothing to do.');
      return;
    }

    log('');
    log(`${BOLD}Applying ${pending.length} pending migration(s)${RESET}`);
    log('─'.repeat(50));

    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8').trim();

      if (dryRun) {
        log(`\n${YELLOW}[dry-run] ${filename}${RESET}`);
        log(`${DIM}${sql.slice(0, 200)}${sql.length > 200 ? '...' : ''}${RESET}`);
        continue;
      }

      info(`Applying ${filename} ...`);
      try {
        await conn.query(sql);
        await conn.execute(
          'INSERT INTO schema_migrations (filename) VALUES (?)',
          [filename]
        );
        success(`${filename}`);
      } catch (err: any) {
        die(`Failed on ${filename}: ${err.message}`);
      }
    }

    if (!dryRun) {
      log('');
      success(`${pending.length} migration(s) applied successfully.`);
    }
    log('');

  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
