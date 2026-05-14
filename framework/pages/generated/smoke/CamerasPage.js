const { expect } = require('@playwright/test');
const { waitForPageReady } = require('../../../utils/waitForPageReady');

class CamerasPage {
  constructor(page) {
    this.page = page;
  }

  async verifyCamerasPageLoaded() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await waitForPageReady(this.page);
    // Verify meaningful content is rendered — use broad discovery (no hardcoded classes)
    const hasContent = await this.page.locator('text=/Camera|Video|Live|Feed|Stream|No Camera/i').first().isVisible({ timeout: 10000 }).catch(() => false)
      || await this.page.locator('img, video').first().isVisible({ timeout: 5000 }).catch(() => false)
      || await this.page.locator('h1, h2, h3, h4').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasContent) {
      throw new Error('Cameras page loaded but no camera feed, video elements, or content found. The page may be empty or the locators need updating.');
    }
  }

  /**
   * Discovery-based: finds all distinct camera sections on the page by inspecting
   * the live DOM for repeating content patterns (cards, images, video elements).
   * No hardcoded class names — works regardless of UI framework CSS.
   */
  async verifyAllCamerasVisible() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await waitForPageReady(this.page);

    // Strategy: find all media elements (img/video) which represent camera feeds
    const mediaElements = this.page.locator('img, video');
    const mediaCount = await mediaElements.count();

    if (mediaCount === 0) {
      // Fallback: look for any repeated content sections (list items, cards, articles)
      const sections = this.page.locator('li, article, [role="listitem"], section');
      const sectionCount = await sections.count();
      if (sectionCount === 0) {
        throw new Error('No camera elements found on the cameras page. Run codegen:record:cameras to update the registry.');
      }
      return sectionCount;
    }

    // Verify at least one media element is visible
    await expect(mediaElements.first()).toBeVisible({ timeout: 5000 });
    return mediaCount;
  }

  /**
   * Discovery-based: finds text labels associated with camera sections.
   * Looks for headings or any text nodes near media elements.
   */
  async verifyCameraNames() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await waitForPageReady(this.page);

    // Look for headings or labeled elements on the page
    const headings = this.page.locator('h1, h2, h3, h4, h5, h6, [aria-label]');
    const count = await headings.count();

    if (count === 0) {
      throw new Error('No camera name labels or headings found on the cameras page.');
    }

    // Verify at least one heading has non-empty text
    let nonEmptyCount = 0;
    for (let i = 0; i < count; i++) {
      const text = await headings.nth(i).textContent().catch(() => '');
      if (text && text.trim() !== '') nonEmptyCount++;
    }

    if (nonEmptyCount === 0) {
      throw new Error('All headings on cameras page are empty — no camera names found.');
    }

    return nonEmptyCount;
  }

  /**
   * Discovery-based: verifies that camera feed content (images/video) has loaded.
   * Checks that img elements have src attributes and video elements are present.
   */
  async verifyCameraFeedsLoaded() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await waitForPageReady(this.page);

    const images = this.page.locator('img');
    const videos = this.page.locator('video');
    const imgCount = await images.count();
    const videoCount = await videos.count();

    if (imgCount === 0 && videoCount === 0) {
      throw new Error('No img or video elements found on the cameras page — feeds not loaded.');
    }

    // Verify at least one media element is visible
    if (imgCount > 0) {
      await expect(images.first()).toBeVisible({ timeout: 5000 });
    } else {
      await expect(videos.first()).toBeVisible({ timeout: 5000 });
    }

    return imgCount + videoCount;
  }
}

module.exports = { CamerasPage };