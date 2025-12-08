#!/usr/bin/env node

/**
 * Verify UI bundle size is under 1MB gzipped
 * React + shadcn/ui dashboard typically ranges 600-900KB
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const UI_DIR = path.join(__dirname, '../dist/ui');
const MAX_SIZE = 1024 * 1024; // 1MB

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function walkDir(dir) {
  let totalSize = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += walkDir(filePath);
    } else {
      totalSize += getGzipSize(filePath);
    }
  }

  return totalSize;
}

if (!fs.existsSync(UI_DIR)) {
  console.log('[!] dist/ui not found. Run bun run ui:build first.');
  process.exit(1);
}

const totalSize = walkDir(UI_DIR);
const sizeKB = (totalSize / 1024).toFixed(1);

if (totalSize > MAX_SIZE) {
  console.log(`[X] Bundle too large: ${sizeKB}KB gzipped (max: 1024KB)`);
  process.exit(1);
} else {
  console.log(`[OK] Bundle size: ${sizeKB}KB gzipped`);
}
