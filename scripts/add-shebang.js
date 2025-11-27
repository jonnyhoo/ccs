#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Add shebang to dist/ccs.js and make executable
 * Run after: tsc
 */
function addShebang() {
  const ccsPath = path.join(__dirname, '../dist/ccs.js');

  if (!fs.existsSync(ccsPath)) {
    console.error('[X] dist/ccs.js not found. Run tsc first.');
    process.exit(1);
  }

  let content = fs.readFileSync(ccsPath, 'utf8');

  // Add shebang if missing
  if (!content.startsWith('#!/usr/bin/env node')) {
    content = '#!/usr/bin/env node\n' + content;
    fs.writeFileSync(ccsPath, content);
    console.log('[OK] Shebang added to dist/ccs.js');
  }

  // Make executable (Unix-like systems)
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(ccsPath, 0o755);
      console.log('[OK] dist/ccs.js is now executable');
    } catch (err) {
      console.warn('[!] Could not chmod dist/ccs.js:', err.message);
    }
  }
}

addShebang();