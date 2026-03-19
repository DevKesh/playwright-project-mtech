function toList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function safeParseJson(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    throw new Error('Invalid JSON provided in PW_CART_ITEM_JSON.');
  }
}

function buildCartItemRequest(scenarioData) {
  const jsonOverride = safeParseJson(process.env.PW_CART_ITEM_JSON);
  if (jsonOverride) {
    return jsonOverride;
  }

  const itemName = process.env.PW_ITEM_NAME;
  const itemText = process.env.PW_ITEM_TEXT;
  const candidateNames = toList(process.env.PW_ITEM_CANDIDATES);
  const attrName = process.env.PW_ITEM_ATTR_NAME;
  const attrValue = process.env.PW_ITEM_ATTR_VALUE;

  const fallbackFromData = (scenarioData?.cartSelection?.items || [])
    .map((item) => item.name)
    .filter(Boolean);

  const frameworkFallbackCandidates = ['ZARA COAT 4', "Zara Coat 4's", 'ZARA COAT 3'];

  const request = {
    name: itemName || null,
    text: itemText || null,
    candidates: [...candidateNames, ...fallbackFromData, ...frameworkFallbackCandidates],
    attr: attrName && attrValue ? { name: attrName, value: attrValue } : null,
  };

  return request;
}

module.exports = {
  buildCartItemRequest,
};
