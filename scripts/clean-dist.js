#!/usr/bin/env node

/**
 * Clean dist directory while preserving UI bundle
 * The UI bundle is built separately and should not be deleted during regular builds
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const TSCONFIG_BUILDINFO = path.join(__dirname, '../tsconfig.tsbuildinfo');

// Directories to preserve (from UI build)
const PRESERVE = new Set(['ui']);

function cleanDist() {
  // Remove tsconfig.tsbuildinfo
  if (fs.existsSync(TSCONFIG_BUILDINFO)) {
    fs.unlinkSync(TSCONFIG_BUILDINFO);
  }

  // If dist doesn't exist, nothing to clean
  if (!fs.existsSync(DIST_DIR)) {
    return;
  }

  const entries = fs.readdirSync(DIST_DIR, { withFileTypes: true });

  for (const entry of entries) {
    // Skip preserved directories
    if (PRESERVE.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(DIST_DIR, entry.name);

    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

cleanDist();
