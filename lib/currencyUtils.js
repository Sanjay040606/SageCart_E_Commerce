/**
 * Currency Conversion Configuration
 * Exchange Rate: 1 USD = 83 INR (Indian Rupees)
 * This can be updated based on current market rates
 */

export const CURRENCY_CONFIG = {
  USD_TO_INR_RATE: 94,
  CURRENCY_SYMBOL: '₹',
  CURRENCY_NAME: 'INR'
};

/**
 * Convert USD amount to INR
 * @param {number} usdAmount - Amount in USD
 * @returns {number} Amount in INR
 */
export const convertUSDToINR = (usdAmount) => {
  return Math.round(usdAmount * CURRENCY_CONFIG.USD_TO_INR_RATE);
};

/**
 * Convert INR amount to USD
 * @param {number} inrAmount - Amount in INR
 * @returns {number} Amount in USD
 */
export const convertINRToUSD = (inrAmount) => {
  return (inrAmount / CURRENCY_CONFIG.USD_TO_INR_RATE).toFixed(2);
};

/**
 * Format price with currency symbol
 * @param {number} amount - Amount to format
 * @param {string} symbol - Currency symbol (optional)
 * @returns {string} Formatted price with symbol
 */
export const formatPrice = (amount, symbol = CURRENCY_CONFIG.CURRENCY_SYMBOL) => {
  // Enforce Indian number format grouping (1,00,000)
  const formatted = Number(amount).toLocaleString('en-IN');
  return `${symbol}${formatted}`;
};
