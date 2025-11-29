#!/usr/bin/env node
'use strict';

/**
 * Test Environment Isolation
 *
 * Provides isolated ~/.ccs/ directory for tests to prevent
 * interference with the user's actual CCS configuration.
 *
 * Usage:
 *   const { createTestEnvironment } = require('../fixtures/test-environment');
 *
 *   describe('my tests', () => {
 *     let testEnv;
 *
 *     before(() => {
 *       testEnv = createTestEnvironment();
 *     });
 *
 *     after(() => {
 *       testEnv.cleanup();
 *     });
 *
 *     it('test something', () => {
 *       // Tests run with CCS_HOME pointing to temp directory
 *       // Your test code here
 *     });
 *   });
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Create an isolated test environment
 * Sets CCS_HOME to a temporary directory and provides cleanup
 *
 * @returns {object} Test environment with paths and cleanup function
 */
function createTestEnvironment() {
  // Create unique temp directory for this test run
  const tempBase = path.join(os.tmpdir(), 'ccs-test');
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const testHome = path.join(tempBase, uniqueId);
  const testCcsDir = path.join(testHome, '.ccs');

  // Create directories
  fs.mkdirSync(testCcsDir, { recursive: true });

  // Store original environment
  const originalHome = process.env.HOME;
  const originalCcsHome = process.env.CCS_HOME;
  const originalUserProfile = process.env.USERPROFILE;

  // Set test environment - use CCS_HOME for isolation
  process.env.CCS_HOME = testHome;

  // Return environment object
  return {
    /** Path to the test home directory (like ~) */
    testHome,

    /** Path to the test .ccs directory (like ~/.ccs) */
    ccsDir: testCcsDir,

    /** Original HOME value for reference */
    originalHome,

    /**
     * Get a path within the test CCS directory
     * @param {...string} parts - Path segments
     * @returns {string} Full path
     */
    getCcsPath(...parts) {
      return path.join(testCcsDir, ...parts);
    },

    /**
     * Create a file in the test CCS directory
     * @param {string} relativePath - Path relative to .ccs/
     * @param {string|object} content - File content (objects are JSON stringified)
     */
    createFile(relativePath, content) {
      const fullPath = path.join(testCcsDir, relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
      fs.writeFileSync(fullPath, data);
    },

    /**
     * Read a file from the test CCS directory
     * @param {string} relativePath - Path relative to .ccs/
     * @param {boolean} [asJson=false] - Parse as JSON
     * @returns {string|object} File content
     */
    readFile(relativePath, asJson = false) {
      const fullPath = path.join(testCcsDir, relativePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      return asJson ? JSON.parse(content) : content;
    },

    /**
     * Check if a file exists in the test CCS directory
     * @param {string} relativePath - Path relative to .ccs/
     * @returns {boolean}
     */
    fileExists(relativePath) {
      return fs.existsSync(path.join(testCcsDir, relativePath));
    },

    /**
     * Clean up the test environment and restore original settings
     */
    cleanup() {
      // Restore original environment
      if (originalCcsHome !== undefined) {
        process.env.CCS_HOME = originalCcsHome;
      } else {
        delete process.env.CCS_HOME;
      }

      // Clean up temp directory
      try {
        fs.rmSync(testHome, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
        console.warn(`[test-environment] Cleanup warning: ${err.message}`);
      }
    }
  };
}

/**
 * Get the CCS home directory (respects CCS_HOME env var)
 * This should be used instead of os.homedir() for CCS paths
 *
 * @returns {string} Home directory path
 */
function getCcsHome() {
  return process.env.CCS_HOME || os.homedir();
}

/**
 * Get the CCS directory path
 *
 * @returns {string} Path to .ccs directory
 */
function getCcsDir() {
  return path.join(getCcsHome(), '.ccs');
}

module.exports = {
  createTestEnvironment,
  getCcsHome,
  getCcsDir
};
