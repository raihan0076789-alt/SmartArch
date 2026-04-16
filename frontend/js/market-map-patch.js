/* ═══════════════════════════════════════════════════════════════════════════
   PATCH: Basemap Multiview + 10k+ India Synthetic Data
   Injects into window namespace so market-map.js can reference it
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   BASEMAP DEFINITIONS — 6 tile providers
   ───────────────────────────────────────────────────────────────────────── */
window.MM_BASEMAPS = {
  dark: {
    id:    'dark',
    label: 'Dark',
    icon:  'fas fa-moon',
    desc:  'CartoDB Dark Matter',
    url:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19 },
    preview: '#0d1424',
    accent: '#00d4c8',
  },
  osm: {
    id:    'osm',
    label: 'OSM',
    icon:  'fas fa-map',
    desc:  'OpenStreetMap Standard',
    url:   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', subdomains: 'abc', maxZoom: 19 },
    preview: '#aad3df',
    accent: '#0078a8',
  },
  satellite: {
    id:    'satellite',
    label: 'Satellite',
    icon:  'fas fa-satellite',
    desc:  'ESRI World Imagery',
    url:   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { attribution: '&copy; Esri &mdash; Esri, i-cubed, USDA', maxZoom: 19 },
    preview: '#1a2233',
    accent: '#4ade80',
  },
  topo: {
    id:    'topo',
    label: 'Topo',
    icon:  'fas fa-mountain',
    desc:  'OpenTopoMap',
    url:   'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    opts: { attribution: '&copy; OpenTopoMap, &copy; OpenStreetMap', subdomains: 'abc', maxZoom: 17 },
    preview: '#e8f0d8',
    accent: '#5a7a3a',
  },
  cartovoyage: {
    id:    'cartovoyage',
    label: 'Voyager',
    icon:  'fas fa-compass',
    desc:  'CartoDB Voyager',
    url:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    opts: { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19 },
    preview: '#f5f0e8',
    accent: '#e06c2e',
  },
  stamen: {
    id:    'stamen',
    label: 'Watercolor',
    icon:  'fas fa-paint-brush',
    desc:  'Stadia Watercolor',
    url:   'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    opts: { attribution: '&copy; Stadia Maps, &copy; Stamen Design, &copy; OpenStreetMap', maxZoom: 16 },
    preview: '#c8d4e0',
    accent: '#9b59b6',
  },
};

window.MM_ACTIVE_BASEMAP = 'dark';
window.MM_BASE_TILE_LAYER = null;

/* Switch basemap tile layer */
window.mmSwitchBasemap = function(id) {
  var bm = window.MM_BASEMAPS[id];
  if (!bm || !window.MM || !window.MM.map) return;
  var L = window.L;

  if (window.MM_BASE_TILE_LAYER) {
    window.MM.map.removeLayer(window.MM_BASE_TILE_LAYER);
  }
  window.MM_BASE_TILE_LAYER = L.tileLayer(bm.url, bm.opts);
  // Insert tile layer below markers
  window.MM_BASE_TILE_LAYER.addTo(window.MM.map);
  if (window.MM_BASE_TILE_LAYER.bringToBack) window.MM_BASE_TILE_LAYER.bringToBack();

  window.MM_ACTIVE_BASEMAP = id;

  // Update UI
  document.querySelectorAll('.mm-view-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.querySelector('.mm-view-btn[data-view="' + id + '"]');
  if (btn) btn.classList.add('active');

  var lbl = document.getElementById('mm-active-view-label');
  if (lbl) lbl.textContent = bm.label;

  var picker = document.getElementById('mm-view-picker');
  if (picker) picker.classList.remove('open');
};

/* Toggle picker */
window.mmToggleViewPicker = function() {
  var picker = document.getElementById('mm-view-picker');
  if (!picker) return;
  var isOpen = picker.classList.toggle('open');
  if (isOpen) {
    // Close when clicking outside
    setTimeout(function() {
      function outsideClick(e) {
        var wrap = document.querySelector('.mm-view-toggle-wrap');
        if (wrap && !wrap.contains(e.target)) {
          picker.classList.remove('open');
          document.removeEventListener('click', outsideClick);
        }
      }
      document.addEventListener('click', outsideClick);
    }, 10);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   INDIA SYNTHETIC DATA — 10,000+ location data points
   Based on real district/city coordinates, realistic price bands per region
   ───────────────────────────────────────────────────────────────────────── */

(function generateIndiaData() {
  /* ── Seed generators ── */
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20240101);

  function rnd(lo, hi) { return lo + rand() * (hi - lo); }
  function rndInt(lo, hi) { return Math.floor(rnd(lo, hi + 1)); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function gauss(mean, std) {
    var u = 0, v = 0;
    while(u === 0) u = rand();
    while(v === 0) v = rand();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ── Indian state regions with bounding boxes and base prices (₹/sqft → $/m²) ── */
  var INDIA_REGIONS = [
    // [name, state, latMin, latMax, lngMin, lngMax, basePriceUSD, growthBase, yieldBase, tier]
    // Maharashtra
    ['Mumbai North',   'MH', 19.1, 19.35, 72.75, 72.95, 3800, 7.5,  3.0, 'C'],
    ['Mumbai South',   'MH', 18.85,19.1,  72.78, 72.98, 4500, 6.8,  2.8, 'D'],
    ['Mumbai Suburbs', 'MH', 19.0, 19.4,  72.80, 73.10, 2800, 8.2,  3.5, 'C'],
    ['Pune City',      'MH', 18.45,18.65, 73.80, 74.00, 1900, 9.5,  4.8, 'B'],
    ['Pune Outskirts', 'MH', 18.3, 18.55, 73.65, 74.20, 1200, 10.2, 5.5, 'A'],
    ['Nashik',         'MH', 19.9, 20.1,  73.7,  73.9,  850,  7.8,  5.9, 'A'],
    ['Aurangabad',     'MH', 19.8, 20.0,  75.2,  75.4,  700,  7.2,  6.2, 'A'],
    ['Nagpur',         'MH', 21.0, 21.3,  78.9,  79.2,  900,  7.4,  6.0, 'A'],
    ['Thane',          'MH', 19.1, 19.3,  72.95, 73.15, 2200, 8.5,  4.2, 'B'],
    ['Navi Mumbai',    'MH', 18.9, 19.1,  73.0,  73.2,  2500, 8.8,  4.0, 'B'],
    // Karnataka
    ['Bengaluru Core',       'KA', 12.9, 13.1,  77.5, 77.7,  3200, 11.0, 3.8, 'C'],
    ['Bengaluru East',       'KA', 12.9, 13.05, 77.6, 77.8,  2600, 11.5, 4.2, 'B'],
    ['Bengaluru North',      'KA', 13.0, 13.2,  77.5, 77.7,  2000, 12.0, 4.8, 'B'],
    ['Bengaluru South',      'KA', 12.8, 12.95, 77.5, 77.65, 2400, 10.8, 4.0, 'B'],
    ['Bengaluru Outskirts',  'KA', 12.6, 13.3,  77.3, 78.0,  1100, 13.0, 5.5, 'A'],
    ['Mysuru',               'KA', 12.2, 12.4,  76.6, 76.8,   900,  8.2,  5.8, 'A'],
    ['Mangaluru',            'KA', 12.8, 13.0,  74.8, 75.0,  1100,  7.5,  5.5, 'A'],
    ['Hubli-Dharwad',        'KA', 15.3, 15.5,  74.9, 75.2,   650,  6.8,  6.5, 'A'],
    // Tamil Nadu
    ['Chennai North',  'TN', 13.1, 13.25, 80.1, 80.3,  2000, 7.2,  4.2, 'B'],
    ['Chennai South',  'TN', 12.9, 13.1,  80.1, 80.3,  2200, 6.8,  4.0, 'B'],
    ['Chennai Suburbs','TN', 12.8, 13.3,  79.9, 80.5,  1400, 8.5,  4.8, 'A'],
    ['Coimbatore',     'TN', 10.9, 11.1,  76.9, 77.1,  1100, 8.2,  5.6, 'A'],
    ['Madurai',        'TN',  9.9, 10.1,  78.1, 78.3,   800, 6.5,  6.2, 'A'],
    ['Tiruchirappalli','TN', 10.7, 10.9,  78.6, 78.8,   700, 6.2,  6.5, 'A'],
    ['Salem',          'TN', 11.6, 11.8,  78.1, 78.3,   650, 7.0,  6.8, 'A'],
    ['Tirunelveli',    'TN',  8.7,  8.9,  77.6, 77.8,   550, 5.8,  7.0, 'A'],
    // Telangana / AP
    ['Hyderabad Core', 'TS', 17.3, 17.5,  78.4, 78.6,  2500, 9.5,  4.5, 'B'],
    ['HITEC City',     'TS', 17.4, 17.55, 78.3, 78.45, 3000, 10.2, 4.0, 'C'],
    ['Hyderabad ORR',  'TS', 17.2, 17.6,  78.2, 78.8,  1500, 12.0, 5.0, 'B'],
    ['Warangal',       'TS', 17.9, 18.1,  79.5, 79.7,   650, 7.5,  6.5, 'A'],
    ['Vijayawada',     'AP', 16.4, 16.6,  80.5, 80.7,   950, 8.0,  5.8, 'A'],
    ['Visakhapatnam',  'AP', 17.6, 17.8,  83.1, 83.3,  1100, 9.2,  5.5, 'A'],
    ['Tirupati',       'AP', 13.6, 13.8,  79.4, 79.6,   800, 7.8,  6.0, 'A'],
    // Delhi NCR
    ['Delhi Central',  'DL', 28.6, 28.75, 77.1, 77.3,  3500, 5.8,  3.5, 'C'],
    ['Delhi South',    'DL', 28.4, 28.6,  77.1, 77.3,  4000, 5.5,  3.2, 'C'],
    ['Noida',          'UP', 28.5, 28.65, 77.3, 77.5,  2000, 7.5,  4.5, 'B'],
    ['Greater Noida',  'UP', 28.4, 28.55, 77.4, 77.7,  1400, 8.5,  5.0, 'B'],
    ['Gurugram',       'HR', 28.4, 28.55, 76.9, 77.1,  3200, 6.2,  3.8, 'C'],
    ['Faridabad',      'HR', 28.3, 28.5,  77.2, 77.4,  1500, 6.8,  5.0, 'B'],
    ['Ghaziabad',      'UP', 28.6, 28.75, 77.3, 77.5,  1600, 7.2,  4.8, 'B'],
    ['Dwarka Sector',  'DL', 28.5, 28.6,  77.0, 77.1,  2800, 6.0,  3.8, 'C'],
    // Gujarat
    ['Ahmedabad Core', 'GJ', 23.0, 23.15, 72.5, 72.7,  1600, 7.2,  5.0, 'B'],
    ['Ahmedabad West', 'GJ', 23.0, 23.2,  72.4, 72.6,  1800, 7.5,  4.8, 'B'],
    ['Surat',          'GJ', 21.1, 21.3,  72.7, 72.9,  1100, 7.8,  5.8, 'A'],
    ['Vadodara',       'GJ', 22.2, 22.4,  73.1, 73.3,   950, 7.0,  5.9, 'A'],
    ['Rajkot',         'GJ', 22.2, 22.4,  70.7, 70.9,   800, 7.2,  6.2, 'A'],
    // Rajasthan
    ['Jaipur Pink City','RJ', 26.85,27.0, 75.75,75.9,  1400, 7.0,  5.2, 'B'],
    ['Jaipur Outskirts','RJ', 26.7, 27.1, 75.6, 76.0,  900,  8.2,  5.8, 'A'],
    ['Udaipur',         'RJ', 24.5, 24.7, 73.6, 73.8,  850,  6.5,  6.0, 'A'],
    ['Jodhpur',         'RJ', 26.2, 26.4, 73.0, 73.2,  700,  6.2,  6.5, 'A'],
    ['Jaisalmer',       'RJ', 26.8, 27.0, 70.8, 71.0,  500,  5.5,  7.0, 'A'],
    ['Kota',            'RJ', 25.1, 25.3, 75.8, 76.0,  550,  6.0,  7.0, 'A'],
    // West Bengal
    ['Kolkata Central', 'WB', 22.5, 22.65, 88.3, 88.45, 1600, 5.5,  4.8, 'B'],
    ['Kolkata North',   'WB', 22.6, 22.8,  88.3, 88.5,  1200, 5.8,  5.2, 'A'],
    ['Kolkata South',   'WB', 22.4, 22.6,  88.3, 88.5,  1800, 5.2,  4.5, 'B'],
    ['Salt Lake',       'WB', 22.55,22.65, 88.4, 88.5,  2000, 5.5,  4.5, 'B'],
    ['Howrah',          'WB', 22.5, 22.65, 88.2, 88.35, 900,  5.0,  5.8, 'A'],
    // Kerala
    ['Kochi',           'KL', 9.9,  10.05, 76.2, 76.4,  1700, 8.0,  5.0, 'B'],
    ['Thiruvananthapuram','KL', 8.45, 8.65, 76.9, 77.1, 1400, 6.2,  5.2, 'B'],
    ['Kozhikode',       'KL', 11.2, 11.4,  75.7, 75.9,  1000, 6.5,  5.5, 'A'],
    ['Thrissur',        'KL', 10.4, 10.6,  76.2, 76.4,  1100, 6.8,  5.3, 'A'],
    // Madhya Pradesh
    ['Bhopal',          'MP', 23.2, 23.4,  77.3, 77.5,  800,  6.8,  5.8, 'A'],
    ['Indore',          'MP', 22.7, 22.9,  75.8, 76.0,  1000, 8.5,  6.2, 'A'],
    ['Gwalior',         'MP', 26.1, 26.3,  78.1, 78.3,  650,  5.8,  6.5, 'A'],
    ['Jabalpur',        'MP', 23.1, 23.3,  79.9, 80.1,  550,  5.5,  6.8, 'A'],
    // Uttar Pradesh
    ['Lucknow',         'UP', 26.8, 27.0,  80.8, 81.1,  900,  7.0,  5.5, 'A'],
    ['Agra',            'UP', 27.1, 27.3,  78.0, 78.2,  650,  5.5,  6.5, 'A'],
    ['Varanasi',        'UP', 25.3, 25.5,  82.9, 83.1,  600,  5.2,  6.8, 'A'],
    ['Kanpur',          'UP', 26.4, 26.6,  80.3, 80.5,  650,  5.8,  6.5, 'A'],
    ['Prayagraj',       'UP', 25.4, 25.6,  81.8, 82.0,  550,  5.5,  7.0, 'A'],
    ['Meerut',          'UP', 28.9, 29.1,  77.7, 77.9,  700,  6.5,  6.2, 'A'],
    // Punjab / Haryana
    ['Chandigarh',      'CH', 30.7, 30.8,  76.7, 76.9,  1800, 6.2,  4.8, 'B'],
    ['Mohali',          'PB', 30.65,30.8,  76.7, 76.85, 1500, 7.0,  5.2, 'B'],
    ['Ludhiana',        'PB', 30.8, 31.0,  75.8, 76.0,  1000, 6.2,  5.8, 'A'],
    ['Amritsar',        'PB', 31.6, 31.8,  74.8, 75.0,   900, 5.8,  6.0, 'A'],
    ['Jalandhar',       'PB', 31.3, 31.5,  75.5, 75.7,   800, 5.5,  6.2, 'A'],
    // Odisha / Jharkhand / Chhattisgarh
    ['Bhubaneswar',     'OD', 20.2, 20.4,  85.7, 85.9,  850,  9.0,  6.0, 'A'],
    ['Cuttack',         'OD', 20.4, 20.6,  85.8, 86.0,  700,  7.5,  6.5, 'A'],
    ['Ranchi',          'JH', 23.3, 23.5,  85.3, 85.5,  650,  6.5,  6.5, 'A'],
    ['Raipur',          'CG', 21.2, 21.4,  81.6, 81.8,  600,  7.2,  6.8, 'A'],
    // Northeast / Himalayan
    ['Guwahati',        'AS', 26.1, 26.3,  91.7, 91.9,  600,  6.8,  6.5, 'A'],
    ['Shillong',        'ML', 25.5, 25.7,  91.8, 92.0,  700,  6.5,  6.2, 'A'],
    ['Dehradun',        'UK', 30.2, 30.4,  77.9, 78.1,  850,  7.5,  5.8, 'A'],
    ['Shimla',          'HP', 31.1, 31.3,  77.0, 77.2,  900,  6.2,  5.5, 'A'],
    // Goa
    ['Panaji',          'GA',  15.4, 15.6,  73.8, 74.0, 2500,  8.5,  5.5, 'B'],
    ['North Goa',       'GA',  15.5, 15.75, 73.7, 74.1, 3500, 10.0,  6.0, 'C'],
    ['South Goa',       'GA',  15.1, 15.4,  74.0, 74.2, 2800,  9.2,  5.8, 'B'],
  ];

  var propertyTypes = ['apartment', 'villa', 'plot', 'commercial', 'row_house', 'penthouse'];
  var climateRisks  = ['low', 'medium', 'high', 'extreme'];
  var airQualities  = ['good', 'moderate', 'poor', 'hazardous'];
  var microAreas    = ['Phase 1','Phase 2','Sector A','Sector B','Layout','Nagar','Colony','Extension','Township','Heights','Enclave','Gardens','Hills','Park','Residency'];

  var indiaPoints = [];
  var baseId = 10000;

  INDIA_REGIONS.forEach(function(reg) {
    var regionName = reg[0], state = reg[1];
    var latMin=reg[2], latMax=reg[3], lngMin=reg[4], lngMax=reg[5];
    var basePriceUSD=reg[6], growthBase=reg[7], yieldBase=reg[8], tier=reg[9];

    // Points per region: city cores get more density
    var count = basePriceUSD > 2000 ? rndInt(150,260) : basePriceUSD > 1000 ? rndInt(100,160) : rndInt(60,120);

    for (var i = 0; i < count; i++) {
      var lat = parseFloat(gauss((latMin+latMax)/2, (latMax-latMin)/4).toFixed(5));
      var lng = parseFloat(gauss((lngMin+lngMax)/2, (lngMax-lngMin)/4).toFixed(5));
      lat = Math.max(latMin, Math.min(latMax, lat));
      lng = Math.max(lngMin, Math.min(lngMax, lng));

      // Price variation: suburb/premium/budget micro clusters
      var priceMult = parseFloat(gauss(1.0, 0.25).toFixed(3));
      priceMult = Math.max(0.4, Math.min(2.2, priceMult));
      var priceM2 = Math.round(basePriceUSD * priceMult);

      var yoyGrowth  = parseFloat(gauss(growthBase, 2.2).toFixed(1));
      var rentYield  = parseFloat(gauss(yieldBase,  0.8).toFixed(1));
      var constructIdx = basePriceUSD > 2000 ? rndInt(4,7) : rndInt(2,5);
      var safetyIdx    = rndInt(40, 82);
      var architectPer100k = rndInt(4, 20);

      var pType = pick(propertyTypes);
      var climate = basePriceUSD > 1500 ? (rand() < 0.3 ? 'high' : 'medium') : pick(climateRisks);
      var air = priceM2 > 2000 ? (rand() < 0.4 ? 'poor' : 'moderate') : pick(airQualities);

      indiaPoints.push({
        id: baseId++,
        city: regionName + ' · ' + pick(microAreas),
        country: 'India',
        state: state,
        flag: '🇮🇳',
        lat: lat,
        lng: lng,
        priceM2: Math.max(200, priceM2),
        yoyGrowth: Math.max(-3, Math.min(35, yoyGrowth)),
        rentYield: Math.max(1.5, Math.min(12, rentYield)),
        proximity:     rndInt(1, 5),
        electricity:   rand() < 0.82,
        transport:     rand() < 0.65,
        schools:       rand() < 0.75,
        type:          pType,
        tier:          tier,
        constructIdx:  constructIdx,
        permitEase:    rndInt(1, 4),
        safetyIdx:     safetyIdx,
        climateRisk:   climate,
        airQuality:    air,
        architectPer100k: architectPer100k,
        isIndiaPoint:  true,  // flag for quick filtering
      });
    }
  });

  window.MM_INDIA_POINTS = indiaPoints;
  console.log('[MarketMap] India synthetic data: ' + indiaPoints.length + ' locations generated');
})();