/**
 * UI Module Barrel Export
 *
 * Re-exports all UI components from modular files
 * @module utils/ui
 */

// Types and constants
export { COLORS, moduleCache, initialized, setInitialized } from './types';
export type {
  ChalkInstance,
  BoxenFunction,
  GradientStringInstance,
  OraModule,
  ListrClass,
} from './types';

// Initialization
export { initUI, useColors, isInteractive, isClaudeCodeContext } from './init';

// Colors
export { color, gradientText, bold, dim } from './colors';

// Status indicators
export { ok, fail, warn, info } from './indicators';

// Boxes
export { box, errorBox, infoBox, warnBox } from './boxes';

// Tables
export { table } from './tables';

// Text formatting
export { header, subheader, hr, sectionHeader } from './text';

// Spinner
export { spinner } from './spinner';

// Tasks

// Import all functions for the ui object
import { initUI, isInteractive, isClaudeCodeContext } from './init';
import { color, gradientText, bold, dim } from './colors';
import { ok, fail, warn, info } from './indicators';
import { box, errorBox, infoBox, warnBox } from './boxes';
import { table } from './tables';
import { header, subheader, hr, sectionHeader } from './text';
import { spinner } from './spinner';

// Unified UI object for convenient access
export const ui = {
  // Initialization
  init: initUI,
  isInteractive,
  isClaudeCodeContext,

  // Colors
  color,
  gradientText,
  bold,
  dim,

  // Status indicators (ASCII only)
  ok,
  fail,
  warn,
  info,

  // Containers
  box,
  errorBox,
  infoBox,
  warnBox,
  table,

  // Progress
  spinner,

  // Headers
  header,
  subheader,
  sectionHeader,
  hr,
} as const;

export default ui;
