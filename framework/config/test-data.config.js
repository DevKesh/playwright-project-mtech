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
    name: 'Total Connect 2.0 Home Security System',
    baseUrl: 'https://qa2.totalconnect2.com/',
    loginUrl: 'https://qa2.totalconnect2.com/login',
    credentials: {
      email: 'tmsqa@1',
      password: 'Password@3',
      userName: 'Keshav QA_Testt',
    },

    /**
     * APP STRUCTURE (for reference during exploration):
     * 
     * Main Pages:
     *   1. Login page (entry point, requires email/password)
     *   2. Dashboard/Home (security status overview)
     *   3. Security Panel (with 3 tabs: Partitions, Sensors, Cameras)
     *   4. Devices (thermostat, locks, smart switches - expandable list)
     *   5. Activity Log (historical events, paginated)
     *   6. Scenes (automation workflows/triggers)
     * 
     * Special Behaviors:
     *   - Security Notifications popup (appears after login, dismissible)
     *   - Dynamic device list (0-10+ items, may expand to show detail modals)
     *   - Pagination on activity log
     *   - Tab navigation in security panel
     *   - Modal dialogs for device details
     * 
     * Critical Workflows to Test:
     *   1. Login flow with credential validation
     *   2. Device control (on/off, temperature adjustment)
     *   3. Scene creation/execution
     *   4. Activity log filtering and pagination
     *   5. Security arm/disarm flow
     */
  },

  // --- Exploration parameters (defaults for npm run demo:explore) ---
  exploration: {
    maxPages: 12,  // Increased from 8 to capture: login + dashboard + security(3 tabs) + devices(+modals) + activity + scenes
    maxDepth: 4,   // Increased from 3 to handle: nested tabs in security panel + device detail modals + pagination links
    
    /**
     * EXPLORATION STRATEGY:
     * 
     * maxPages: 12 covers approximately:
     *   - Login page (1)
     *   - Dashboard (1)
     *   - Security Panel main + 3 tabs = 1-3 pages
     *   - Devices page + device detail modals = 3-4 pages
     *   - Activity Log + pagination variations = 2 pages
     *   - Scenes page (1)
     *   - Buffer for dynamic pages (1-2)
     *   Total: ~12 unique page captures
     * 
     * maxDepth: 4 allows:
     *   - Level 0: Login URL (start)
     *   - Level 1: Dashboard navigation from login
     *   - Level 2: Main section links (Security, Devices, Activity, Scenes)
     *   - Level 3: Subsection links (Partitions, Sensors, Cameras tabs; device modals)
     *   - Level 4: Pagination links, modal expand/collapse states
     * 
     * Run: npm run demo:explore:login
     * This will auto-login and explore all authenticated pages
     */
  },
};

module.exports = { testDataConfig };
