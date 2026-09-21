// Single place for everything you might want to change.
//
// Only first-party retailers are watched — Target, Sony's own store and
// Best Buy. No marketplaces, no eBay, no resellers, so every alert is a
// legitimate seller at retail price, and every channel either ships to a
// US address or can be picked up in San Francisco.

export const CONFIG = {
  // Alert only at or below this price. MSRP is $899.99, and he only wants
  // it at or under list — anything above is a reseller or a markup.
  maxPrice: Number(process.env.MAX_PRICE ?? 900),


  // Everything is anchored on the hotel: 424 Clay St, Financial District.
  // Distances below are from that address.
  zip: '94111',
  lat: 37.7946,
  lon: -122.4006,

  // Target stores, addresses and distances from Target's own store API.
  // Near list is walk/short-ride from the hotel and is polled on every deep
  // cycle; the wider Bay Area list is polled less often.
  targetStoresNear: [
    { id: '2766', name: 'SF Central', address: '789 Mission St · 1.0 mi' },
    { id: '2768', name: 'SF West', address: '2675 Geary Blvd · 2.8 mi' },
  ],
  targetStoresWide: [
    { id: '2767', name: 'Oakland-Emeryville', address: '1555 40th St · 6.4 mi' },
    { id: '3264', name: 'SF Stonestown', address: '285 Winston Dr · 6.5 mi' },
    { id: '2829', name: 'Alameda', address: '2700 Fifth St · 6.6 mi' },
    { id: '1926', name: 'Albany', address: '1057 Eastshore Hwy · 7.8 mi' },
    { id: '3240', name: 'Marin City', address: '180 Donahue St · 8.0 mi' },
    { id: '3267', name: 'Berkeley Univ Ave', address: '1414 University Ave · 8.0 mi' },
    { id: '3353', name: 'Daly City Westlake', address: '100 Westlake Ctr · 8.2 mi' },
    { id: '3202', name: 'Berkeley Central', address: '2187 Shattuck Ave · 8.7 mi' },
    { id: '320', name: 'Colma', address: '5001 Junipero Serra Blvd · 9.3 mi' },
    { id: '1407', name: 'Daly City Serramonte', address: '133 Serramonte Ctr · 9.7 mi' },
    { id: '1507', name: 'Richmond', address: '4500 Macdonald Ave · 10.0 mi' },
    { id: '1054', name: 'Tanforan', address: '1150 El Camino Real · 11.2 mi' },
    { id: '2772', name: 'San Rafael', address: '125 Shoreline Pkwy · 11.9 mi' },
    { id: '737', name: 'Pinole', address: '1400 Fitzgerald Dr · 14.0 mi' },
  ],

  // Every Nth deep cycle also walks the wider Bay Area store list.
  wideEvery: 3,

  // Don't re-alert the same offer more often than this. Kept short because
  // Target's stock oscillates in sub-minute windows: repeated alerts are the
  // signal that inventory is actively cycling and worth sitting on the page for.
  alertCooldownMinutes: Number(process.env.ALERT_COOLDOWN_MIN ?? 10),

  // If a source has not answered successfully for this long, send one
  // health warning so the monitor can never go dark without you knowing.
  healthWarnAfterHours: Number(process.env.HEALTH_WARN_HOURS ?? 8),
  healthRepeatHours: 24,
};
