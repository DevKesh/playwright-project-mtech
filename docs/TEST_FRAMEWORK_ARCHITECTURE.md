# Playwright Test Framework Architecture

## Folder Structure

```text
framework/
  fixtures/
    app.fixture.js          # Shared test fixture (page objects + scenario data)
  pages/
    AuthPage.js             # Auth page object (register/login)
    ProductsPage.js         # Products/cart page object
  data/
    authAndCart.data.js     # Baseline scenario test data
  utils/
    userFactory.js          # Unique user/email generators
    steps.js                # Common step logger

tests/
  flows/
    auth/
      register.spec.js      # 5 positive + 5 negative register/login validations
      register-login-flow.spec.js
  smoke/
    basic-ui.spec.js
    example.spec.js

docs/
  TEST_FRAMEWORK_ARCHITECTURE.md
  USER_FLOW_TEST_REQUEST.md
  FLOW_BIFURCATION_MAP.md
```

## Design Principles

- Keep locators and UI actions in `framework/pages` only.
- Keep static test data in `framework/data`.
- Keep helper logic in `framework/utils`.
- Keep test files flow-centric under `tests/flows/<domain>`.
- Keep lightweight health checks under `tests/smoke`.
- Use shared fixture `framework/fixtures/app.fixture.js` to avoid repeated imports/instantiation.

## How To Add a New User Flow

1. Fill `docs/USER_FLOW_TEST_REQUEST.md` (lean flow card format).
2. Pick domain/folder using `docs/FLOW_BIFURCATION_MAP.md`.
3. Create or extend page object methods in `framework/pages`.
4. Add reusable data in `framework/data`.
5. Add a new spec in `tests/flows/<domain>/<flow-name>.spec.js`.
4. Use fixture imports:

```js
const { test, expect } = require('../../../framework/fixtures/app.fixture');
```

6. Group steps with `test.step(...)` and assert at each business checkpoint.

## Run Commands

- Full suite: `npm test`
- Headed: `npm run test:headed`
- Auth flows only: `npm run test:auth`
- Smoke only: `npm run test:smoke`
- Open report: `npm run report`
