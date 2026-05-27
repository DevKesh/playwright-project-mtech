# Export Clip Test — Walkthrough & Resolution

## Summary

The `tests/export-clip.spec.js` test automates exporting a camera clip from the DOMECB5 camera timeline on the Total Connect 2.0 QA site. It took extensive iteration to get working due to the complexity of interacting with a `<canvas>` element inside an iframe.

---

## Final Working Approach

### Test Flow

1. **Login** — Uses `createLoginSession()` (reusable utility in `framework/utils/login-session.js`)
2. **Navigate to Cameras** — Clicks the Cameras nav button
3. **Open DOMECB5 feed** — Clicks `#video-1621401` directly (not the link name)
4. **Wait for video** — Waits for `#video-popup-1621401` to be visible (60s timeout) + 5s buffer
5. **Click scrubber at two positions** — Positions (130, 47) and (226, 43) on `#scrubber-canvas`
6. **Click Trim** → **Save Clip** → **Done**
7. **Additional scrubber clicks** — Multiple positions to set up next clip region
8. **Double-click Trim** → **Wait for current export**

### Key Code

```javascript
const scrubber = frame.locator('#scrubber-canvas');
await scrubber.click({ position: { x: 130, y: 47 } });
await scrubber.click({ position: { x: 226, y: 43 } });
await frame.getByRole('button', { name: 'trim' }).click();
await frame.getByRole('button', { name: 'Save Clip' }).click();
await frame.getByRole('button', { name: 'Done' }).click();
```

---

## What Was Tried & Why It Failed

### 1. Dragging with `page.mouse` (multiple attempts)
- **Problem**: The `#scrubber-canvas` is inside an iframe (`#fenixPagetarget`). Using `page.mouse.move/down/up` with coordinates from `boundingBox()` suffered from **iframe coordinate translation issues** on LambdaTest. The mouse events didn't register correctly on the canvas.
- **Symptoms**: Orange bar would "snap back" to the start, drag wouldn't register, trim button never appeared.

### 2. Moving slider to zoom in/out
- **Problem**: Zooming in (`slider → right`) made the visible timeline too narrow (~40 min), leaving barely any recorded area visible. Zooming out (`slider → left`) showed the full day but made the canvas too compressed for precise interaction.
- **Result**: With slider left + wide drag, trim appeared but "SD card recording is missing" error occurred (selection covered gaps without recordings).

### 3. Using `.timeline-container canvas` locator
- **Problem**: Different locator than what codegen recorded. The actual element is `#scrubber-canvas`.

### 4. Using `frame.evaluate()` to dispatch events
- **Problem**: `frame` is a `FrameLocator` (not a `Frame`), so `frame.evaluate` is not a function. Switched to `scrubber.evaluate()` which worked syntactically but dispatched events didn't trigger the Angular canvas handlers properly.

### 5. Dispatching synthetic MouseEvents via evaluate
- **Problem**: The canvas uses Angular event bindings that don't respond to `dispatchEvent()` the same way as real browser mouse events routed through the DevTools protocol.

### 6. Various drag directions and distances
- Right drag: Moved into future (no recording) — black area
- Left drag too far: Covered gaps — "SD card missing" error
- Small drags: Not enough to trigger trim selection
- After `mouse.up()`: Canvas would reset/snap back

---

## Root Cause

The `#scrubber-canvas` is a `<canvas>` element (width=1214, height=66, rendered ~989×54) inside an iframe. It responds to **clicks at specific positions** to set trim boundaries. The trim button appears after clicking at positions where recorded footage exists (the grey/green area with blue event markers).

**What actually works**: Simple `.click({ position: { x, y } })` calls on the locator — Playwright handles the iframe coordinate mapping correctly for locator-based clicks. The `page.mouse` API has coordinate mapping issues with iframes on remote browsers (LambdaTest).

---

## Key Lessons

| Issue | Solution |
|-------|----------|
| `page.mouse` coordinates wrong in iframe | Use `locator.click({ position: {...} })` instead |
| Canvas drag doesn't register | Use multiple clicks at positions (codegen approach) |
| `frame.evaluate` not a function | `frame` is FrameLocator; use `locator.evaluate()` |
| Slider zoom causes issues | Don't change the slider — default zoom is fine |
| Orange bar snaps back | Avoid `page.mouse` drag; use position clicks |
| SD card missing error | Keep selection within recorded area (blue markers) |
| Trim button not appearing | Need to click at correct positions first |

---

## NPM Script Added

```json
"test:lambda:export-clip": "npm run clean:allure && cross-env EXECUTION_PLATFORM=lambda npx playwright test tests/export-clip.spec.js --project chrome && cross-env EXECUTION_PLATFORM=lambda node framework/utils/lambdatest-status.js"
```

Run with: `npm run test:lambda:export-clip`

---

## Files Changed

- `tests/export-clip.spec.js` — Complete rewrite of timeline interaction
- `package.json` — Added `test:lambda:export-clip` script
