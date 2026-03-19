function createOrdersFlow({ page, expect }) {
  const normalizeOrderId = (value) => {
    const normalized = (value || '').replace(/[|\s]/g, '').trim();
    const matched = normalized.match(/[a-z0-9]{24,}/i);
    return matched ? matched[0].toUpperCase() : normalized.toUpperCase();
  };

  const verifyOrderInList = async (orderId) => {
    const orderRow = page.locator('tbody tr').filter({ hasText: orderId }).first();
    await expect(orderRow).toBeVisible();
    return orderRow;
  };

  const verifyExactOrderIdInOrdersPage = async (expectedOrderId) => {
    const expectedNormalized = normalizeOrderId(expectedOrderId);
    const orderRow = await verifyOrderInList(expectedOrderId);

    const rowIdCell = orderRow.locator('th[scope="row"], td').first();
    const rowRawId = ((await rowIdCell.textContent()) || '').trim();
    const rowNormalized = normalizeOrderId(rowRawId);

    await expect(rowNormalized).toBe(expectedNormalized);
    return rowNormalized;
  };

  const openOrderDetails = async (orderId) => {
    const orderRow = await verifyOrderInList(orderId);
    const viewButton = orderRow.getByRole('button', { name: /view/i }).first();
    await viewButton.click();
  };

  const verifyProductInOrderDetails = async (productName) => {
    await expect(page.locator('text=/order details|product ordered|items/i').first()).toBeVisible();
    await expect(page.locator('text=' + productName).first()).toBeVisible();
  };

  return {
    normalizeOrderId,
    verifyOrderInList,
    verifyExactOrderIdInOrdersPage,
    openOrderDetails,
    verifyProductInOrderDetails,
  };
}

module.exports = { createOrdersFlow };
