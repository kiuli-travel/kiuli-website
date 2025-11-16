#!/usr/bin/env node

/**
 * Output Directory Helper Utility
 *
 * Provides functions for managing unique output directories for itinerary processing.
 * Supports both serverless (Vercel) and local environments with unique directories per itinerary.
 *
 * Usage:
 *   const { getOutputDir } = require('./utils/outputDir.cjs');
 *   const outputDir = getOutputDir('680dff493cf205005cf76e8f');
 */

const path = require('path');
const fs = require('fs');

// Check if running in serverless environment
const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * Get the unique output directory for an itinerary
 *
 * @param {string} itineraryId - The unique iTrvl itinerary identifier
 * @param {boolean} createIfMissing - Whether to create the directory if it doesn't exist (default: true)
 * @returns {string} - The absolute path to the output directory
 *
 * @example
 * // In serverless: /tmp/output/680dff493cf205005cf76e8f
 * // Locally: /path/to/project/output/680dff493cf205005cf76e8f
 * const outputDir = getOutputDir('680dff493cf205005cf76e8f');
 */
function getOutputDir(itineraryId, createIfMissing = true) {
  if (!itineraryId || typeof itineraryId !== 'string') {
    throw new Error('itineraryId is required and must be a string');
  }

  // Sanitize itineraryId to prevent path traversal
  const sanitizedId = itineraryId.replace(/[^a-zA-Z0-9-_]/g, '');
  if (sanitizedId !== itineraryId) {
    throw new Error(`Invalid itineraryId: contains illegal characters. Got: ${itineraryId}`);
  }

  // Determine base directory based on environment
  const baseDir = isVercel ? '/tmp' : process.cwd();

  // Construct unique directory path
  const outputDir = path.join(baseDir, 'output', sanitizedId);

  // Create directory if requested
  if (createIfMissing && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * Get a file path within the output directory
 *
 * @param {string} itineraryId - The unique iTrvl itinerary identifier
 * @param {string} filename - The filename to get the path for
 * @param {boolean} createDir - Whether to create the directory if it doesn't exist (default: true)
 * @returns {string} - The absolute path to the file
 *
 * @example
 * const rawItineraryPath = getOutputFilePath('680dff493cf205005cf76e8f', 'raw-itinerary.json');
 */
function getOutputFilePath(itineraryId, filename, createDir = true) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('filename is required and must be a string');
  }

  const outputDir = getOutputDir(itineraryId, createDir);
  return path.join(outputDir, filename);
}

/**
 * Clean up the output directory for an itinerary
 *
 * @param {string} itineraryId - The unique iTrvl itinerary identifier
 * @returns {boolean} - True if directory was deleted, false if it didn't exist
 *
 * @example
 * cleanOutputDir('680dff493cf205005cf76e8f');
 */
function cleanOutputDir(itineraryId) {
  const outputDir = getOutputDir(itineraryId, false);

  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
    return true;
  }

  return false;
}

/**
 * Check if an output directory exists for an itinerary
 *
 * @param {string} itineraryId - The unique iTrvl itinerary identifier
 * @returns {boolean} - True if the directory exists
 *
 * @example
 * if (outputDirExists('680dff493cf205005cf76e8f')) {
 *   console.log('Output directory already exists');
 * }
 */
function outputDirExists(itineraryId) {
  const outputDir = getOutputDir(itineraryId, false);
  return fs.existsSync(outputDir);
}

module.exports = {
  getOutputDir,
  getOutputFilePath,
  cleanOutputDir,
  outputDirExists,
  isVercel,
};
