/**
 * Exploration Prompts: prompt builders for page classification and app analysis.
 */

/**
 * Build prompt for classifying a single page.
 * @param {object} params
 * @param {string} params.url - The current page URL.
 * @param {object} params.pageStructure - Structured elements extracted from the page.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildPageClassificationPrompt({ url, pageStructure }) {
  const systemPrompt = `You are a web application analyst. Given the URL and the structured elements of a web page, classify it and analyze its purpose.

You MUST respond with valid JSON matching this schema:
{
  "classification": "login|registration|dashboard|catalog|product_detail|cart|checkout|search|profile|settings|error|home|other",
  "purpose": "Brief description of what this page does",
  "pageName": "A concise PascalCase name for this page (e.g., LoginPage, DashboardPage, ProductCatalogPage)",
  "keyElements": [
    { "name": "descriptive name", "type": "button|link|input|select|form|heading", "selector": "best CSS selector or locator strategy" }
  ],
  "formFields": [
    { "name": "field name", "type": "text|email|password|select|checkbox|radio|textarea", "purpose": "what this field is for" }
  ],
  "navigationLinks": [
    { "text": "link text", "href": "url", "likelyDestination": "page classification guess" }
  ],
  "userActions": [
    "List of meaningful user actions possible on this page (e.g., 'fill login form', 'click submit', 'add to cart')"
  ]
}`;

  const userPrompt = `Analyze this web page:

**URL:** ${url}

**Page Structure:**
${JSON.stringify(pageStructure, null, 2)}

Classify this page and identify all interactive elements, form fields, navigation links, and possible user actions.`;

  return { systemPrompt, userPrompt };
}

/**
 * Build prompt for analyzing the complete app from all visited pages.
 * @param {object} params
 * @param {Array} params.visitedPages - Array of page data with classifications.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildAppAnalysisPrompt({ visitedPages }) {
  const systemPrompt = `You are a QA architect analyzing a web application to identify its purpose and user flows.

Given a list of all discovered pages with their classifications and elements, you must:
1. Identify the application's name and purpose
2. Discover all meaningful user flows (sequences of pages/actions a user would take)
3. Prioritize flows by importance (critical paths first)

You MUST respond with valid JSON matching this schema:
{
  "appName": "Name of the application",
  "appDescription": "What this application does",
  "baseUrl": "The base URL of the application",
  "userFlows": [
    {
      "name": "Flow name (e.g., 'Login Flow', 'Purchase Flow')",
      "description": "What this flow tests",
      "priority": "critical|high|medium|low",
      "steps": [
        {
          "order": 1,
          "pageClassification": "login",
          "pageName": "LoginPage",
          "url": "https://...",
          "actions": ["fill email", "fill password", "click login button"],
          "assertions": ["should navigate to dashboard", "should show user name"]
        }
      ]
    }
  ],
  "pageRelationships": [
    { "from": "LoginPage", "to": "DashboardPage", "trigger": "successful login" }
  ]
}

Focus on realistic end-to-end user journeys. Each flow should represent a complete, testable scenario.`;

  // Build a summary of all pages for the prompt
  const pageSummaries = visitedPages.map((p, i) => {
    return `Page ${i + 1}: ${p.url}
  Classification: ${p.classification || 'unknown'}
  Purpose: ${p.purpose || 'unknown'}
  Title: ${p.title || 'N/A'}
  Key Elements: ${JSON.stringify(p.keyElements || [], null, 2)}
  Navigation Links: ${JSON.stringify(p.navigationLinks || [], null, 2)}
  User Actions: ${JSON.stringify(p.userActions || [], null, 2)}
  Form Fields: ${JSON.stringify(p.formFields || [], null, 2)}`;
  }).join('\n\n');

  const userPrompt = `Analyze this web application and identify all user flows:

**Total Pages Discovered:** ${visitedPages.length}

${pageSummaries}

Identify the app, its purpose, and all meaningful user flows with step-by-step actions and expected assertions.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildPageClassificationPrompt, buildAppAnalysisPrompt };
