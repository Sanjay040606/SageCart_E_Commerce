export const GAME_PROMO_CODES = {
  SAVE10: { type: 'percent', value: 10, label: '10% off', weight: 5 }, // Rare - 5%
  SAVE2: { type: 'percent', value: 2, label: '2% off', weight: 25 }, // 25% - common
  SAVE1: { type: 'percent', value: 1, label: '1% off', weight: 30 }, // 30% - most common discounts
  FREESHIP: { type: 'shipping', value: 100, label: 'Free Shipping', weight: 40 } // 40% - most common
}

export const getWeightedReward = () => {
  const totalWeight = Object.values(GAME_PROMO_CODES).reduce((sum, reward) => sum + (reward.weight || 0), 0)
  let random = Math.random() * totalWeight
  
  for (const [key, reward] of Object.entries(GAME_PROMO_CODES)) {
    random -= (reward.weight || 0)
    if (random <= 0) {
      return { key, ...reward }
    }
  }
  
  // Fallback to free shipping
  return { key: 'FREESHIP', ...GAME_PROMO_CODES.FREESHIP }
}

export const normalizePromoCode = (value = '') => value.trim().toUpperCase()

export const getGamePromo = (code = '') => {
  const normalizedCode = normalizePromoCode(code)
  if (!normalizedCode) return null

  const baseCode = normalizedCode.split('-')[0]
  return GAME_PROMO_CODES[baseCode] || null
}

export const isGamePromo = (code = '') => Boolean(getGamePromo(code))

export const getUnusedUserGameCoupon = (user, code = '') => {
  const normalizedCode = normalizePromoCode(code)
  if (!normalizedCode || !user?.gameCoupons?.length) return null

  return user.gameCoupons.find((coupon) => coupon.code === normalizedCode && !coupon.usedAt) || null
}
