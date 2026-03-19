# Flow Bifurcation Map

Use this map to decide where each new scenario belongs.

## Domain To Folder Mapping
- `auth` -> `tests/flows/auth/`
- `cart` -> `tests/flows/cart/`
- `checkout` -> `tests/flows/checkout/`
- `orders` -> `tests/flows/orders/`
- `profile` -> `tests/flows/profile/`
- `admin` -> `tests/flows/admin/`
- `other` -> `tests/flows/other/`

## Naming Convention
- Spec file: `<flow-name>.spec.js`
- Test titles:
- `P1, P2...` for positive cases
- `N1, N2...` for negative cases

Example:
- `tests/flows/cart/add-items.spec.js`
- `P1 - user adds one item to cart`
- `N1 - add to cart blocked for out-of-stock item`

## Minimal Request To Start Automation
Provide only:
1. Domain
2. 3-6 journey steps
3. Positive/negative count
4. 3-5 critical assertions
5. Data sample

Everything else can be inferred and automated.

## Execution Defaults
- Browser: Chrome
- Mode: headed
- Reporting: Playwright HTML report
- Step visibility: use `test.step(...)` in all generated tests

## Runtime Dynamic Inputs (Cart Flow)
Use environment variables to select the product at runtime.

- `PW_ITEM_NAME`: exact product name
- `PW_ITEM_TEXT`: partial text to match inside card
- `PW_ITEM_CANDIDATES`: comma-separated fallback names
- `PW_ITEM_ATTR_NAME` and `PW_ITEM_ATTR_VALUE`: attribute-based selection
- `PW_CART_ITEM_JSON`: full JSON override

PowerShell examples:

```powershell
$env:PW_ITEM_NAME='ZARA COAT 3'; npx playwright test tests/flows/cart/add-zara-coat.spec.js; Remove-Item Env:PW_ITEM_NAME
```

```powershell
$env:PW_CART_ITEM_JSON='{"text":"ADIDAS","candidates":["ADIDAS ORIGINAL"]}'; npx playwright test tests/flows/cart/add-zara-coat.spec.js; Remove-Item Env:PW_CART_ITEM_JSON
```

## User Journey flow for adding to cart

1. Login with the working username and password
2. On carts page select Zara Coat 4's add to cart button and add to cart
3. Validate the other options for the Zara Coat 4 like price etc
4. Assert that the item was successfully added to cart after clicking on Cart option in the same page and check if quantity of items added is equal to number shown on cart icon

