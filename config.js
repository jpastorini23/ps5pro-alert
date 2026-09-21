// Single place for everything you might want to change.

export const CONFIG = {
  // Alert only at or below this price. PS5 Pro MSRP is $899.99;
  // 950 leaves room for tax-inclusive displays but blocks scalper listings.
  maxPrice: Number(process.env.MAX_PRICE ?? 950),

  // Target stores checked for in-store pickup, nearest to downtown SF first.
  targetStores: [
    { id: '2766', name: 'SF Central', address: '789 Mission St' },
    { id: '2768', name: 'SF West',    address: '1690 Folsom St' },
    { id: '3264', name: 'SF Stonestown', address: '3251 20th Ave' },
  ],

  zip: '94103',
  lat: 37.7749,
  lon: -122.4194,

  // Don't re-alert the same offer more often than this.
  alertCooldownMinutes: Number(process.env.ALERT_COOLDOWN_MIN ?? 30),

  // If a source has not answered successfully for this long, send one
  // health warning so the monitor can never go dark without you knowing.
  healthWarnAfterHours: Number(process.env.HEALTH_WARN_HOURS ?? 8),
  healthRepeatHours: 24,
};
