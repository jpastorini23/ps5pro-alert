// Single place for everything you might want to change.
//
// Only first-party retailers are watched — Target, Sony's own store and
// Best Buy. No marketplaces, no eBay, no resellers, so every alert is a
// legitimate seller at retail price, and every channel either ships to a
// US address or can be picked up in San Francisco.

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

  // Don't re-alert the same offer more often than this. Kept short because
  // Target's stock oscillates in sub-minute windows: repeated alerts are the
  // signal that inventory is actively cycling and worth sitting on the page for.
  alertCooldownMinutes: Number(process.env.ALERT_COOLDOWN_MIN ?? 10),

  // If a source has not answered successfully for this long, send one
  // health warning so the monitor can never go dark without you knowing.
  healthWarnAfterHours: Number(process.env.HEALTH_WARN_HOURS ?? 8),
  healthRepeatHours: 24,
};
