function createCartFlow({ page, productsPage, expect }) {
  const getProductCardByName = (productName) => {
    return page.locator('.card-body').filter({ has: page.locator('b').filter({ hasText: productName }) }).first();
  };

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const getProductCardByText = (productText) => {
    return page.locator('.card-body').filter({ hasText: new RegExp(escapeRegex(productText), 'i') }).first();
  };

  const getProductCardByAttribute = (attributeName, attributeValue) => {
    return page
      .locator('.card-body')
      .filter({ has: page.locator(`[${attributeName}="${attributeValue}"]`) })
      .first();
  };

  const getCardDisplayName = async (productCard) => {
    return (await productCard.locator('b').first().textContent())?.trim() || 'Unknown Product';
  };

  const resolveProductCard = async (itemRequest) => {
    if (!itemRequest) {
      throw new Error('No cart item request provided. Pass runtime data or fallback cartSelection values.');
    }

    if (itemRequest.attr?.name && itemRequest.attr?.value) {
      const attrCard = getProductCardByAttribute(itemRequest.attr.name, itemRequest.attr.value);
      if ((await attrCard.count()) > 0) {
        return {
          productCard: attrCard,
          productName: await getCardDisplayName(attrCard),
          matchedBy: `attr:${itemRequest.attr.name}`,
        };
      }
    }

    if (itemRequest.name) {
      const nameCard = getProductCardByName(itemRequest.name);
      if ((await nameCard.count()) > 0) {
        return {
          productCard: nameCard,
          productName: await getCardDisplayName(nameCard),
          matchedBy: 'name',
        };
      }
    }

    if (itemRequest.text) {
      const textCard = getProductCardByText(itemRequest.text);
      if ((await textCard.count()) > 0) {
        return {
          productCard: textCard,
          productName: await getCardDisplayName(textCard),
          matchedBy: 'text',
        };
      }
    }

    for (const candidate of itemRequest.candidates || []) {
      const candidateCard = getProductCardByName(candidate);
      if ((await candidateCard.count()) > 0) {
        return {
          productCard: candidateCard,
          productName: await getCardDisplayName(candidateCard),
          matchedBy: 'candidates',
        };
      }
    }

    throw new Error('Unable to resolve product card from runtime request.');
  };

  const resolveAvailableProductName = async (candidates) => {
    for (const candidate of candidates) {
      const count = await getProductCardByName(candidate).count();
      if (count > 0) {
        return candidate;
      }
    }
    throw new Error(`None of the candidate products are available: ${candidates.join(', ')}`);
  };

  const addSingleProductAndValidateBasics = async (productName) => {
    const productCard = getProductCardByName(productName);
    await expect(productCard).toBeVisible();

    // Validate that the card has price-like text before adding to cart.
    await expect(productCard.locator('text=/\\d+/').first()).toBeVisible();

    await productCard.getByRole('button', { name: /add to cart/i }).click();
    await expect(productsPage.toastMessage).toContainText('Product Added To Cart');
  };

  const openCartAndVerifyItem = async (productName) => {
    await productsPage.cartButton.click();
    await expect(page).toHaveURL(/.*\/cart/);
    await expect(page.locator('.cartSection h3').filter({ hasText: productName })).toBeVisible();
  };

  const verifyCartBadgeCount = async (expectedCount) => {
    await expect(productsPage.cartButton).toContainText(String(expectedCount));
  };

  return {
    getProductCardByName,
    getProductCardByText,
    getProductCardByAttribute,
    getCardDisplayName,
    resolveProductCard,
    resolveAvailableProductName,
    addSingleProductAndValidateBasics,
    openCartAndVerifyItem,
    verifyCartBadgeCount,
  };
}

module.exports = { createCartFlow };
