#!/usr/bin/env node
// Minimal static server for the remake. Serves the remake at / and the original
// install (default: the parent directory) at /original/, resolving file names
// case-insensitively the way Windows did ("dat\girlf1.bmp" -> dat/girlF1.BMP).
//
//   node tools/serve.mjs [--port 8080] [--original /path/to/BattlePets]

import { createServer } from 'node:http';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REMAKE_ROOT = resolve(here, '..');

function parseArgs(argv) {
  const args = { port: 8080, original: resolve(REMAKE_ROOT, '..') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') args.port = Number(argv[i + 1]);
    if (argv[i] === '--original') args.original = resolve(argv[i + 1]);
  }
  if (!Number.isInteger(args.port) || args.port <= 0) throw new Error('--port must be a positive integer');
  return args;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.bmp': 'image/bmp',
  '.wav': 'audio/wav',
  '.dat': 'text/plain; charset=latin1',
  '.exe': 'application/octet-stream',
  '.gam': 'text/plain; charset=latin1',
};

/** Resolve each path segment case-insensitively under root; null if missing or escaping. */
async function resolveInsensitive(root, relPath) {
  let current = root;
  for (const segment of relPath.split('/').filter(Boolean)) {
    if (segment === '..' || segment === '.') return null;
    let entries;
    try {
      entries = await readdir(current);
    } catch {
      return null;
    }
    const match = entries.find((e) => e === segment) ?? entries.find((e) => e.toLowerCase() === segment.toLowerCase());
    if (!match) return null;
    current = join(current, match);
  }
  return current.startsWith(root + sep) || current === root ? current : null;
}

async function serveFile(res, path) {
  const info = await stat(path).catch(() => null);
  const target = info?.isDirectory() ? join(path, 'index.html') : path;
  const body = await readFile(target).catch(() => null);
  if (!body) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  }).end(body);
}

function handler({ original }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname);
      const [root, rel] = path.startsWith('/original/')
        ? [original, path.slice('/original/'.length)]
        : [REMAKE_ROOT, path.slice(1)];
      const file = await resolveInsensitive(root, rel);
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      await serveFile(res, file);
    } catch (error) {
      process.stderr.write(`serve: ${req.url}: ${error.message}\n`);
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Server error');
    }
  };
}

const args = parseArgs(process.argv.slice(2));
createServer(handler(args)).listen(args.port, '127.0.0.1', () => {
  process.stdout.write(`BattlePets remake: http://localhost:${args.port}/  (original files: ${args.original})\n`);
});
