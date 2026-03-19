const { expect } = require('@playwright/test');

class ProductsPage {
  constructor(page) {
    this.page = page;
    this.productCards = page.locator('.card-body');
    this.cartButton = page.locator('button[routerlink*="cart"]');
    this.toastMessage = page.locator('#toast-container');
  }

  async addItemsFromSelection(cartSelection) {
    const items = cartSelection?.items || [];

    // Allow an empty object while scenario details are still being finalized.
    if (items.length === 0) {
      return { addedCount: 0 };
    }

    for (const item of items) {
      const productCard = this.productCards
        .filter({ has: this.page.locator('b').filter({ hasText: item.name }) })
        .first();

      const cardCount = await productCard.count();
      if (cardCount === 0) {
        throw new Error(`Requested product not found: ${item.name}`);
      }

      await productCard.getByRole('button', { name: /add to cart/i }).click();
      await expect(this.toastMessage).toContainText('Product Added To Cart');
    }

    return { addedCount: items.length };
  }

  async openCartAndVerifyItems(cartSelection) {
    const items = cartSelection?.items || [];
    if (items.length === 0) {
      return;
    }

    await this.cartButton.click();
    await expect(this.page).toHaveURL(/.*\/cart/);

    for (const item of items) {
      await expect(this.page.locator('.cartSection h3').filter({ hasText: item.name })).toBeVisible();
    }
  }
}

module.exports = { ProductsPage };
