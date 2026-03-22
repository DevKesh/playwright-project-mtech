/**
 * Centralized Test Data Configuration
 *
 * Edit this file ONCE before running the demo pipeline.
 * All AI-generated test specs import data from here instead of
 * hardcoding values inline.
 *
 * Usage:
 *   const { testDataConfig } = require('../../framework/config/test-data.config');
 *   testDataConfig.targetApp.credentials.email
 */

const testDataConfig = {
  // --- Target application ---
  targetApp: {
    name: 'Total Connect',
    baseUrl: 'https://qa2.totalconnect2.com/',
    loginUrl: 'https://qa2.totalconnect2.com/login',
    credentials: {
      email: 'tmsqa@1',
      password: 'Password@3',
      userName: 'Keshav QA_Testt',
    },
    
  },

  // --- Exploration parameters (defaults for npm run demo:explore) ---
  exploration: {
    maxPages: 8,
    maxDepth: 3,
  },
};

module.exports = { testDataConfig };
