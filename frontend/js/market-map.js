/**
 * market-map.js — Global Real Estate Market Map Plugin v2
 * Fixes: CDN reliability, Leaflet init timing, filter button bindings,
 *        map container height, stats/results loading without map dependency.
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   GLOBAL CITY DATASET  (USD per m², real-world data)
   tier: A=best afford. → D=premium/least affordable
   ═══════════════════════════════════════════════════════ */
/**
 * market-map.js — Global Real Estate Market Map v3
 * Upgrades: 90 cities, 6 new data fields, Construction Cost Calculator,
 *           Architecture Market Suitability Score, Climate Risk Layer
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   DATASET SCHEMA (per city):
   priceM2        – USD per m² (land/property)
   yoyGrowth      – Year-on-year price growth %
   rentYield      – Gross rental yield %
   proximity      – 1=city centre … 5=remote
   electricity    – grid reliability
   transport      – public transport availability
   schools        – quality schools nearby
   type           – apartment | villa | condo
   tier           – A=best afford. → D=premium
   constructIdx   – Construction cost index 1(cheap)–10(expensive)
   permitEase     – Permit/regulation ease 1(hard)–5(easy)
   safetyIdx      – Safety/crime index 0–100 (100=safest)
   climateRisk    – low | medium | high | extreme
   airQuality     – good | moderate | poor | hazardous
   architectPer100k – registered architects per 100k population
   ═══════════════════════════════════════════════════════ */
const MM_CITIES = [
  // ── INDIA (20 cities) ───────────────────────────────
  { id:1,  city:'Mumbai',        country:'India',        flag:'🇮🇳', lat:19.076,  lng:72.877,  priceM2:4200,  yoyGrowth:8.2,  rentYield:3.1, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:5, permitEase:2, safetyIdx:52, climateRisk:'high',    airQuality:'poor',     architectPer100k:8  },
  { id:2,  city:'Delhi',         country:'India',        flag:'🇮🇳', lat:28.704,  lng:77.102,  priceM2:3100,  yoyGrowth:6.5,  rentYield:3.8, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:5, permitEase:2, safetyIdx:48, climateRisk:'medium',  airQuality:'hazardous',architectPer100k:9  },
  { id:3,  city:'Bengaluru',     country:'India',        flag:'🇮🇳', lat:12.972,  lng:77.594,  priceM2:2800,  yoyGrowth:11.4, rentYield:4.2, proximity:3, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:58, climateRisk:'low',     airQuality:'moderate', architectPer100k:12 },
  { id:4,  city:'Hyderabad',     country:'India',        flag:'🇮🇳', lat:17.385,  lng:78.486,  priceM2:2200,  yoyGrowth:9.8,  rentYield:4.8, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:60, climateRisk:'medium',  airQuality:'moderate', architectPer100k:10 },
  { id:5,  city:'Chennai',       country:'India',        flag:'🇮🇳', lat:13.083,  lng:80.270,  priceM2:1950,  yoyGrowth:7.1,  rentYield:4.5, proximity:4, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:4, permitEase:3, safetyIdx:62, climateRisk:'high',    airQuality:'moderate', architectPer100k:11 },
  { id:6,  city:'Pune',          country:'India',        flag:'🇮🇳', lat:18.520,  lng:73.856,  priceM2:1800,  yoyGrowth:8.9,  rentYield:5.1, proximity:5, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:65, climateRisk:'medium',  airQuality:'moderate', architectPer100k:10 },
  { id:7,  city:'Ahmedabad',     country:'India',        flag:'🇮🇳', lat:23.022,  lng:72.571,  priceM2:1400,  yoyGrowth:7.4,  rentYield:5.4, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:3, safetyIdx:64, climateRisk:'medium',  airQuality:'poor',     architectPer100k:8  },
  { id:41, city:'Kochi',         country:'India',        flag:'🇮🇳', lat:9.931,   lng:76.267,  priceM2:1600,  yoyGrowth:7.8,  rentYield:5.2, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:70, climateRisk:'high',    airQuality:'good',     architectPer100k:14 },
  { id:42, city:'Jaipur',        country:'India',        flag:'🇮🇳', lat:26.912,  lng:75.787,  priceM2:1200,  yoyGrowth:6.9,  rentYield:5.6, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:3, safetyIdx:66, climateRisk:'medium',  airQuality:'poor',     architectPer100k:7  },
  { id:43, city:'Kolkata',       country:'India',        flag:'🇮🇳', lat:22.572,  lng:88.363,  priceM2:1500,  yoyGrowth:5.8,  rentYield:4.9, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:4, permitEase:2, safetyIdx:54, climateRisk:'high',    airQuality:'poor',     architectPer100k:9  },
  { id:44, city:'Coimbatore',    country:'India',        flag:'🇮🇳', lat:11.017,  lng:76.955,  priceM2:1100,  yoyGrowth:8.1,  rentYield:5.8, proximity:5, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:4, safetyIdx:72, climateRisk:'low',     airQuality:'good',     architectPer100k:9  },
  { id:45, city:'Chandigarh',    country:'India',        flag:'🇮🇳', lat:30.733,  lng:76.779,  priceM2:1700,  yoyGrowth:6.2,  rentYield:4.7, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:4, safetyIdx:74, climateRisk:'low',     airQuality:'moderate', architectPer100k:11 },
  { id:46, city:'Surat',         country:'India',        flag:'🇮🇳', lat:21.170,  lng:72.831,  priceM2:1050,  yoyGrowth:7.6,  rentYield:6.0, proximity:4, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:3, safetyIdx:68, climateRisk:'high',    airQuality:'moderate', architectPer100k:6  },
  { id:47, city:'Nagpur',        country:'India',        flag:'🇮🇳', lat:21.145,  lng:79.088,  priceM2:900,   yoyGrowth:7.2,  rentYield:6.2, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:3, safetyIdx:67, climateRisk:'medium',  airQuality:'moderate', architectPer100k:6  },
  { id:48, city:'Indore',        country:'India',        flag:'🇮🇳', lat:22.719,  lng:75.857,  priceM2:950,   yoyGrowth:8.5,  rentYield:6.4, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:3, safetyIdx:66, climateRisk:'medium',  airQuality:'moderate', architectPer100k:6  },
  { id:49, city:'Lucknow',       country:'India',        flag:'🇮🇳', lat:26.846,  lng:80.946,  priceM2:850,   yoyGrowth:6.8,  rentYield:5.9, proximity:4, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:57, climateRisk:'medium',  airQuality:'hazardous',architectPer100k:5  },
  { id:50, city:'Visakhapatnam', country:'India',        flag:'🇮🇳', lat:17.686,  lng:83.218,  priceM2:1050,  yoyGrowth:9.2,  rentYield:5.7, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:3, safetyIdx:68, climateRisk:'high',    airQuality:'good',     architectPer100k:6  },
  { id:51, city:'Bhopal',        country:'India',        flag:'🇮🇳', lat:23.259,  lng:77.412,  priceM2:780,   yoyGrowth:6.5,  rentYield:5.8, proximity:5, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:2, permitEase:3, safetyIdx:63, climateRisk:'medium',  airQuality:'moderate', architectPer100k:5  },
  { id:52, city:'Thiruvananthapuram',country:'India',    flag:'🇮🇳', lat:8.524,   lng:76.936,  priceM2:1300,  yoyGrowth:6.0,  rentYield:5.1, proximity:4, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:73, climateRisk:'high',    airQuality:'good',     architectPer100k:13 },
  { id:53, city:'Bhubaneswar',   country:'India',        flag:'🇮🇳', lat:20.296,  lng:85.824,  priceM2:800,   yoyGrowth:8.8,  rentYield:6.3, proximity:5, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:3, permitEase:4, safetyIdx:70, climateRisk:'high',    airQuality:'moderate', architectPer100k:5  },
  // ── ASIA ────────────────────────────────────────────
  { id:8,  city:'Tokyo',         country:'Japan',        flag:'🇯🇵', lat:35.680,  lng:139.691, priceM2:12500, yoyGrowth:3.2,  rentYield:2.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:8, permitEase:4, safetyIdx:88, climateRisk:'high',    airQuality:'good',     architectPer100k:38 },
  { id:54, city:'Osaka',         country:'Japan',        flag:'🇯🇵', lat:34.693,  lng:135.502, priceM2:8200,  yoyGrowth:4.1,  rentYield:3.4, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:8, permitEase:4, safetyIdx:90, climateRisk:'medium',  airQuality:'good',     architectPer100k:35 },
  { id:9,  city:'Singapore',     country:'Singapore',    flag:'🇸🇬', lat:1.352,   lng:103.819, priceM2:21000, yoyGrowth:2.1,  rentYield:2.3, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:9, permitEase:5, safetyIdx:95, climateRisk:'medium',  airQuality:'moderate', architectPer100k:42 },
  { id:10, city:'Bangkok',       country:'Thailand',     flag:'🇹🇭', lat:13.756,  lng:100.502, priceM2:3800,  yoyGrowth:4.5,  rentYield:5.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'condo',     tier:'B', constructIdx:4, permitEase:3, safetyIdx:60, climateRisk:'high',    airQuality:'poor',     architectPer100k:16 },
  { id:11, city:'Ho Chi Minh',   country:'Vietnam',      flag:'🇻🇳', lat:10.823,  lng:106.630, priceM2:2400,  yoyGrowth:7.8,  rentYield:5.8, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:3, permitEase:2, safetyIdx:62, climateRisk:'high',    airQuality:'poor',     architectPer100k:10 },
  { id:55, city:'Hanoi',         country:'Vietnam',      flag:'🇻🇳', lat:21.028,  lng:105.834, priceM2:1900,  yoyGrowth:6.5,  rentYield:5.2, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:65, climateRisk:'high',    airQuality:'poor',     architectPer100k:8  },
  { id:12, city:'Kuala Lumpur',  country:'Malaysia',     flag:'🇲🇾', lat:3.140,   lng:101.687, priceM2:3200,  yoyGrowth:3.9,  rentYield:4.6, proximity:2, electricity:true,  transport:true,  schools:true, type:'condo',     tier:'B', constructIdx:4, permitEase:3, safetyIdx:65, climateRisk:'medium',  airQuality:'moderate', architectPer100k:14 },
  { id:13, city:'Jakarta',       country:'Indonesia',    flag:'🇮🇩', lat:-6.200,  lng:106.816, priceM2:1900,  yoyGrowth:5.2,  rentYield:5.9, proximity:3, electricity:true,  transport:false, schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:52, climateRisk:'extreme', airQuality:'poor',     architectPer100k:7  },
  { id:56, city:'Manila',        country:'Philippines',  flag:'🇵🇭', lat:14.599,  lng:120.984, priceM2:2100,  yoyGrowth:6.1,  rentYield:6.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'condo',     tier:'B', constructIdx:3, permitEase:2, safetyIdx:44, climateRisk:'extreme', airQuality:'poor',     architectPer100k:8  },
  { id:57, city:'Taipei',        country:'Taiwan',       flag:'🇹🇼', lat:25.033,  lng:121.565, priceM2:11000, yoyGrowth:2.8,  rentYield:1.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:7, permitEase:4, safetyIdx:84, climateRisk:'high',    airQuality:'moderate', architectPer100k:28 },
  { id:14, city:'Dubai',         country:'UAE',          flag:'🇦🇪', lat:25.204,  lng:55.270,  priceM2:5200,  yoyGrowth:14.2, rentYield:6.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'C', constructIdx:7, permitEase:4, safetyIdx:88, climateRisk:'medium',  airQuality:'moderate', architectPer100k:22 },
  { id:58, city:'Abu Dhabi',     country:'UAE',          flag:'🇦🇪', lat:24.453,  lng:54.377,  priceM2:4100,  yoyGrowth:10.5, rentYield:6.1, proximity:2, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'C', constructIdx:7, permitEase:4, safetyIdx:90, climateRisk:'medium',  airQuality:'moderate', architectPer100k:20 },
  { id:59, city:'Doha',          country:'Qatar',        flag:'🇶🇦', lat:25.286,  lng:51.531,  priceM2:4800,  yoyGrowth:5.2,  rentYield:5.4, proximity:2, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'C', constructIdx:8, permitEase:3, safetyIdx:92, climateRisk:'medium',  airQuality:'moderate', architectPer100k:18 },
  { id:15, city:'Seoul',         country:'South Korea',  flag:'🇰🇷', lat:37.566,  lng:126.978, priceM2:9800,  yoyGrowth:1.8,  rentYield:2.5, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:7, permitEase:4, safetyIdx:86, climateRisk:'low',     airQuality:'moderate', architectPer100k:32 },
  { id:16, city:'Shanghai',      country:'China',        flag:'🇨🇳', lat:31.230,  lng:121.473, priceM2:10200, yoyGrowth:-1.2, rentYield:2.1, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:6, permitEase:2, safetyIdx:74, climateRisk:'medium',  airQuality:'poor',     architectPer100k:20 },
  { id:60, city:'Beijing',       country:'China',        flag:'🇨🇳', lat:39.904,  lng:116.407, priceM2:9500,  yoyGrowth:-0.8, rentYield:1.9, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:6, permitEase:2, safetyIdx:72, climateRisk:'medium',  airQuality:'poor',     architectPer100k:18 },
  { id:17, city:'Colombo',       country:'Sri Lanka',    flag:'🇱🇰', lat:6.927,   lng:79.861,  priceM2:900,   yoyGrowth:4.2,  rentYield:6.1, proximity:4, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:3, safetyIdx:62, climateRisk:'high',    airQuality:'moderate', architectPer100k:5  },
  { id:61, city:'Dhaka',         country:'Bangladesh',   flag:'🇧🇩', lat:23.811,  lng:90.413,  priceM2:750,   yoyGrowth:8.0,  rentYield:7.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:2, permitEase:2, safetyIdx:40, climateRisk:'extreme', airQuality:'hazardous',architectPer100k:3  },
  { id:18, city:'Riyadh',        country:'Saudi Arabia', flag:'🇸🇦', lat:24.688,  lng:46.722,  priceM2:3000,  yoyGrowth:6.1,  rentYield:5.5, proximity:2, electricity:true,  transport:false, schools:true, type:'villa',     tier:'B', constructIdx:6, permitEase:3, safetyIdx:78, climateRisk:'medium',  airQuality:'moderate', architectPer100k:12 },
  { id:62, city:'Istanbul',      country:'Turkey',       flag:'🇹🇷', lat:41.015,  lng:28.979,  priceM2:2800,  yoyGrowth:18.0, rentYield:5.8, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:4, permitEase:3, safetyIdx:55, climateRisk:'high',    airQuality:'moderate', architectPer100k:20 },
  { id:63, city:'Tel Aviv',      country:'Israel',       flag:'🇮🇱', lat:32.087,  lng:34.787,  priceM2:12000, yoyGrowth:-2.5, rentYield:2.2, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:9, permitEase:3, safetyIdx:65, climateRisk:'medium',  airQuality:'good',     architectPer100k:30 },
  { id:64, city:'Muscat',        country:'Oman',         flag:'🇴🇲', lat:23.614,  lng:58.593,  priceM2:2200,  yoyGrowth:4.8,  rentYield:6.0, proximity:3, electricity:true,  transport:false, schools:true, type:'villa',     tier:'B', constructIdx:5, permitEase:4, safetyIdx:85, climateRisk:'medium',  airQuality:'moderate', architectPer100k:8  },
  // ── EUROPE ──────────────────────────────────────────
  { id:19, city:'London',        country:'UK',           flag:'🇬🇧', lat:51.507,  lng:-0.127,  priceM2:18000, yoyGrowth:0.8,  rentYield:3.1, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:9, permitEase:3, safetyIdx:72, climateRisk:'low',     airQuality:'moderate', architectPer100k:50 },
  { id:20, city:'Paris',         country:'France',       flag:'🇫🇷', lat:48.856,  lng:2.352,   priceM2:13500, yoyGrowth:-2.1, rentYield:2.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:8, permitEase:3, safetyIdx:68, climateRisk:'low',     airQuality:'moderate', architectPer100k:45 },
  { id:21, city:'Berlin',        country:'Germany',      flag:'🇩🇪', lat:52.521,  lng:13.405,  priceM2:7200,  yoyGrowth:-5.1, rentYield:2.9, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:8, permitEase:3, safetyIdx:78, climateRisk:'low',     airQuality:'good',     architectPer100k:42 },
  { id:65, city:'Rome',          country:'Italy',        flag:'🇮🇹', lat:41.902,  lng:12.496,  priceM2:5800,  yoyGrowth:3.8,  rentYield:3.5, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:7, permitEase:2, safetyIdx:65, climateRisk:'medium',  airQuality:'moderate', architectPer100k:55 },
  { id:66, city:'Milan',         country:'Italy',        flag:'🇮🇹', lat:45.465,  lng:9.187,   priceM2:8200,  yoyGrowth:5.5,  rentYield:3.2, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:8, permitEase:2, safetyIdx:66, climateRisk:'low',     airQuality:'moderate', architectPer100k:60 },
  { id:67, city:'Amsterdam',     country:'Netherlands',  flag:'🇳🇱', lat:52.370,  lng:4.895,   priceM2:9500,  yoyGrowth:1.2,  rentYield:3.4, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:8, permitEase:3, safetyIdx:82, climateRisk:'high',    airQuality:'good',     architectPer100k:40 },
  { id:68, city:'Vienna',        country:'Austria',      flag:'🇦🇹', lat:48.208,  lng:16.373,  priceM2:7800,  yoyGrowth:-2.8, rentYield:2.6, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:8, permitEase:4, safetyIdx:90, climateRisk:'low',     airQuality:'good',     architectPer100k:38 },
  { id:69, city:'Zurich',        country:'Switzerland',  flag:'🇨🇭', lat:47.376,  lng:8.541,   priceM2:19000, yoyGrowth:0.5,  rentYield:2.1, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:10,permitEase:3, safetyIdx:92, climateRisk:'low',     airQuality:'good',     architectPer100k:48 },
  { id:70, city:'Stockholm',     country:'Sweden',       flag:'🇸🇪', lat:59.334,  lng:18.063,  priceM2:8500,  yoyGrowth:-4.2, rentYield:2.5, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:8, permitEase:4, safetyIdx:84, climateRisk:'low',     airQuality:'good',     architectPer100k:44 },
  { id:71, city:'Prague',        country:'Czech Republic',flag:'🇨🇿',lat:50.075,  lng:14.437,  priceM2:5200,  yoyGrowth:-3.1, rentYield:3.8, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:6, permitEase:3, safetyIdx:82, climateRisk:'low',     airQuality:'moderate', architectPer100k:28 },
  { id:72, city:'Athens',        country:'Greece',       flag:'🇬🇷', lat:37.984,  lng:23.728,  priceM2:3200,  yoyGrowth:11.2, rentYield:4.8, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:5, permitEase:2, safetyIdx:68, climateRisk:'medium',  airQuality:'moderate', architectPer100k:35 },
  { id:22, city:'Lisbon',        country:'Portugal',     flag:'🇵🇹', lat:38.716,  lng:-9.142,  priceM2:6800,  yoyGrowth:8.4,  rentYield:4.1, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:6, permitEase:3, safetyIdx:78, climateRisk:'medium',  airQuality:'good',     architectPer100k:32 },
  { id:23, city:'Madrid',        country:'Spain',        flag:'🇪🇸', lat:40.416,  lng:-3.703,  priceM2:5400,  yoyGrowth:6.2,  rentYield:3.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:6, permitEase:3, safetyIdx:74, climateRisk:'medium',  airQuality:'moderate', architectPer100k:30 },
  { id:24, city:'Warsaw',        country:'Poland',       flag:'🇵🇱', lat:52.229,  lng:21.012,  priceM2:3800,  yoyGrowth:5.1,  rentYield:5.0, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:5, permitEase:3, safetyIdx:76, climateRisk:'low',     airQuality:'moderate', architectPer100k:20 },
  { id:25, city:'Budapest',      country:'Hungary',      flag:'🇭🇺', lat:47.498,  lng:19.040,  priceM2:3200,  yoyGrowth:4.8,  rentYield:5.3, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:5, permitEase:3, safetyIdx:74, climateRisk:'low',     airQuality:'moderate', architectPer100k:22 },
  { id:73, city:'Bucharest',     country:'Romania',      flag:'🇷🇴', lat:44.426,  lng:26.103,  priceM2:2100,  yoyGrowth:7.4,  rentYield:6.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:4, permitEase:2, safetyIdx:66, climateRisk:'medium',  airQuality:'moderate', architectPer100k:15 },
  // ── AMERICAS ────────────────────────────────────────
  { id:26, city:'New York',      country:'USA',          flag:'🇺🇸', lat:40.712,  lng:-74.006, priceM2:20000, yoyGrowth:1.2,  rentYield:3.2, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'D', constructIdx:9, permitEase:3, safetyIdx:55, climateRisk:'medium',  airQuality:'good',     architectPer100k:52 },
  { id:74, city:'Los Angeles',   country:'USA',          flag:'🇺🇸', lat:34.052,  lng:-118.244,priceM2:12000, yoyGrowth:2.5,  rentYield:3.0, proximity:1, electricity:true,  transport:false, schools:true, type:'villa',     tier:'D', constructIdx:9, permitEase:2, safetyIdx:50, climateRisk:'high',    airQuality:'moderate', architectPer100k:48 },
  { id:75, city:'Chicago',       country:'USA',          flag:'🇺🇸', lat:41.878,  lng:-87.630, priceM2:6200,  yoyGrowth:2.8,  rentYield:4.5, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:8, permitEase:3, safetyIdx:42, climateRisk:'medium',  airQuality:'good',     architectPer100k:44 },
  { id:27, city:'Miami',         country:'USA',          flag:'🇺🇸', lat:25.774,  lng:-80.190, priceM2:8500,  yoyGrowth:5.8,  rentYield:4.1, proximity:1, electricity:true,  transport:false, schools:true, type:'condo',     tier:'C', constructIdx:8, permitEase:3, safetyIdx:48, climateRisk:'extreme', airQuality:'good',     architectPer100k:36 },
  { id:28, city:'Austin',        country:'USA',          flag:'🇺🇸', lat:30.267,  lng:-97.743, priceM2:5200,  yoyGrowth:2.1,  rentYield:4.4, proximity:2, electricity:true,  transport:false, schools:true, type:'villa',     tier:'C', constructIdx:7, permitEase:3, safetyIdx:58, climateRisk:'medium',  airQuality:'good',     architectPer100k:32 },
  { id:29, city:'Toronto',       country:'Canada',       flag:'🇨🇦', lat:43.653,  lng:-79.383, priceM2:10200, yoyGrowth:-3.2, rentYield:3.0, proximity:1, electricity:true,  transport:true,  schools:true, type:'condo',     tier:'D', constructIdx:8, permitEase:4, safetyIdx:78, climateRisk:'low',     airQuality:'good',     architectPer100k:40 },
  { id:76, city:'Vancouver',     country:'Canada',       flag:'🇨🇦', lat:49.283,  lng:-123.121,priceM2:13500, yoyGrowth:-2.8, rentYield:2.6, proximity:1, electricity:true,  transport:true,  schools:true, type:'condo',     tier:'D', constructIdx:8, permitEase:4, safetyIdx:74, climateRisk:'medium',  airQuality:'good',     architectPer100k:38 },
  { id:30, city:'Mexico City',   country:'Mexico',       flag:'🇲🇽', lat:19.432,  lng:-99.133, priceM2:2400,  yoyGrowth:9.1,  rentYield:6.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:4, permitEase:2, safetyIdx:38, climateRisk:'medium',  airQuality:'poor',     architectPer100k:14 },
  { id:77, city:'Lima',          country:'Peru',         flag:'🇵🇪', lat:-12.046, lng:-77.043, priceM2:1800,  yoyGrowth:5.5,  rentYield:6.8, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:38, climateRisk:'medium',  airQuality:'moderate', architectPer100k:8  },
  { id:78, city:'Santiago',      country:'Chile',        flag:'🇨🇱', lat:-33.459, lng:-70.648, priceM2:3200,  yoyGrowth:2.8,  rentYield:4.8, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'B', constructIdx:5, permitEase:4, safetyIdx:55, climateRisk:'high',    airQuality:'moderate', architectPer100k:16 },
  { id:31, city:'São Paulo',     country:'Brazil',       flag:'🇧🇷', lat:-23.550, lng:-46.633, priceM2:2200,  yoyGrowth:7.4,  rentYield:5.8, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:4, permitEase:2, safetyIdx:35, climateRisk:'medium',  airQuality:'moderate', architectPer100k:18 },
  { id:32, city:'Buenos Aires',  country:'Argentina',    flag:'🇦🇷', lat:-34.603, lng:-58.381, priceM2:1100,  yoyGrowth:15.0, rentYield:7.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:42, climateRisk:'medium',  airQuality:'good',     architectPer100k:22 },
  { id:33, city:'Bogotá',        country:'Colombia',     flag:'🇨🇴', lat:4.711,   lng:-74.072, priceM2:1400,  yoyGrowth:6.8,  rentYield:6.5, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:38, climateRisk:'medium',  airQuality:'moderate', architectPer100k:10 },
  // ── AFRICA ──────────────────────────────────────────
  { id:79, city:'Johannesburg',  country:'South Africa', flag:'🇿🇦', lat:-26.204, lng:28.047,  priceM2:1400,  yoyGrowth:3.8,  rentYield:8.2, proximity:2, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:28, climateRisk:'medium',  airQuality:'moderate', architectPer100k:8  },
  { id:36, city:'Cape Town',     country:'South Africa', flag:'🇿🇦', lat:-33.924, lng:18.424,  priceM2:1800,  yoyGrowth:5.5,  rentYield:7.1, proximity:3, electricity:true,  transport:false, schools:true, type:'villa',     tier:'A', constructIdx:4, permitEase:3, safetyIdx:35, climateRisk:'medium',  airQuality:'good',     architectPer100k:10 },
  { id:37, city:'Nairobi',       country:'Kenya',        flag:'🇰🇪', lat:-1.286,  lng:36.818,  priceM2:1200,  yoyGrowth:4.1,  rentYield:7.8, proximity:4, electricity:true,  transport:false, schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:32, climateRisk:'medium',  airQuality:'moderate', architectPer100k:3  },
  { id:80, city:'Accra',         country:'Ghana',        flag:'🇬🇭', lat:5.614,   lng:-0.205,  priceM2:900,   yoyGrowth:6.5,  rentYield:8.8, proximity:4, electricity:true,  transport:false, schools:true, type:'apartment', tier:'A', constructIdx:2, permitEase:2, safetyIdx:55, climateRisk:'medium',  airQuality:'moderate', architectPer100k:2  },
  { id:81, city:'Addis Ababa',   country:'Ethiopia',     flag:'🇪🇹', lat:9.032,   lng:38.740,  priceM2:600,   yoyGrowth:9.5,  rentYield:9.2, proximity:4, electricity:true,  transport:false, schools:true, type:'apartment', tier:'A', constructIdx:2, permitEase:2, safetyIdx:52, climateRisk:'medium',  airQuality:'moderate', architectPer100k:1  },
  { id:82, city:'Dar es Salaam', country:'Tanzania',     flag:'🇹🇿', lat:-6.792,  lng:39.208,  priceM2:700,   yoyGrowth:7.1,  rentYield:9.5, proximity:4, electricity:true,  transport:false, schools:true, type:'apartment', tier:'A', constructIdx:2, permitEase:2, safetyIdx:48, climateRisk:'high',    airQuality:'good',     architectPer100k:1  },
  { id:38, city:'Cairo',         country:'Egypt',        flag:'🇪🇬', lat:30.044,  lng:31.236,  priceM2:800,   yoyGrowth:22.0, rentYield:9.2, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:2, safetyIdx:48, climateRisk:'medium',  airQuality:'poor',     architectPer100k:6  },
  { id:39, city:'Casablanca',    country:'Morocco',      flag:'🇲🇦', lat:33.589,  lng:-7.614,  priceM2:1100,  yoyGrowth:5.2,  rentYield:6.8, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:3, safetyIdx:55, climateRisk:'medium',  airQuality:'moderate', architectPer100k:5  },
  { id:40, city:'Lagos',         country:'Nigeria',      flag:'🇳🇬', lat:6.524,   lng:3.379,   priceM2:900,   yoyGrowth:8.9,  rentYield:8.5, proximity:3, electricity:false, transport:false, schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:1, safetyIdx:25, climateRisk:'high',    airQuality:'poor',     architectPer100k:2  },
  // ── OCEANIA ─────────────────────────────────────────
  { id:34, city:'Sydney',        country:'Australia',    flag:'🇦🇺', lat:-33.868, lng:151.209, priceM2:11500, yoyGrowth:7.2,  rentYield:3.5, proximity:1, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'D', constructIdx:8, permitEase:4, safetyIdx:82, climateRisk:'high',    airQuality:'good',     architectPer100k:44 },
  { id:35, city:'Melbourne',     country:'Australia',    flag:'🇦🇺', lat:-37.813, lng:144.962, priceM2:8800,  yoyGrowth:4.1,  rentYield:3.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'C', constructIdx:8, permitEase:4, safetyIdx:84, climateRisk:'medium',  airQuality:'good',     architectPer100k:42 },
  { id:83, city:'Auckland',      country:'New Zealand',  flag:'🇳🇿', lat:-36.848, lng:174.763, priceM2:9200,  yoyGrowth:-5.8, rentYield:3.2, proximity:1, electricity:true,  transport:true,  schools:true, type:'villa',     tier:'D', constructIdx:8, permitEase:4, safetyIdx:86, climateRisk:'medium',  airQuality:'good',     architectPer100k:40 },
  // ── RUSSIA / C. ASIA ────────────────────────────────
  { id:84, city:'Moscow',        country:'Russia',       flag:'🇷🇺', lat:55.751,  lng:37.617,  priceM2:4200,  yoyGrowth:12.0, rentYield:4.8, proximity:1, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'C', constructIdx:5, permitEase:2, safetyIdx:48, climateRisk:'low',     airQuality:'moderate', architectPer100k:16 },
  { id:85, city:'Dubai Silicon Oasis', country:'UAE',    flag:'🇦🇪', lat:25.127,  lng:55.380,  priceM2:3200,  yoyGrowth:11.5, rentYield:7.4, proximity:3, electricity:true,  transport:true,  schools:true, type:'condo',     tier:'B', constructIdx:6, permitEase:4, safetyIdx:90, climateRisk:'medium',  airQuality:'moderate', architectPer100k:18 },
  // ── ADDITIONAL HIGH-VALUE ────────────────────────────
  { id:86, city:'Medellín',      country:'Colombia',     flag:'🇨🇴', lat:6.244,   lng:-75.581, priceM2:900,   yoyGrowth:8.2,  rentYield:7.8, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:2, permitEase:3, safetyIdx:42, climateRisk:'medium',  airQuality:'good',     architectPer100k:8  },
  { id:87, city:'Tbilisi',       country:'Georgia',      flag:'🇬🇪', lat:41.694,  lng:44.834,  priceM2:1400,  yoyGrowth:14.5, rentYield:8.2, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:3, permitEase:4, safetyIdx:72, climateRisk:'medium',  airQuality:'good',     architectPer100k:8  },
  { id:88, city:'Bali (Denpasar)',country:'Indonesia',   flag:'🇮🇩', lat:-8.409,  lng:115.188, priceM2:1600,  yoyGrowth:9.8,  rentYield:8.5, proximity:4, electricity:true,  transport:false, schools:true, type:'villa',     tier:'A', constructIdx:2, permitEase:2, safetyIdx:62, climateRisk:'high',    airQuality:'good',     architectPer100k:5  },
  { id:89, city:'Phuket',        country:'Thailand',     flag:'🇹🇭', lat:7.878,   lng:98.398,  priceM2:2800,  yoyGrowth:8.5,  rentYield:7.2, proximity:4, electricity:true,  transport:false, schools:true, type:'villa',     tier:'B', constructIdx:3, permitEase:2, safetyIdx:65, climateRisk:'high',    airQuality:'good',     architectPer100k:8  },
  { id:90, city:'Almaty',        country:'Kazakhstan',   flag:'🇰🇿', lat:43.238,  lng:76.945,  priceM2:1800,  yoyGrowth:11.0, rentYield:7.0, proximity:3, electricity:true,  transport:true,  schools:true, type:'apartment', tier:'A', constructIdx:4, permitEase:3, safetyIdx:60, climateRisk:'medium',  airQuality:'moderate', architectPer100k:6  },
];

/* ═══════════════════════════════════════════════════════
   PLUGIN STATE
   ═══════════════════════════════════════════════════════ */
const MM = {
  map: null,
  markersLayer: null,
  heatLayer: null,
  infraLayer: null,
  initialized: false,
  leafletReady: false,
  filters: {
    maxPriceM2: 25000,
    types: [],
    electricity: false,
    transport: false,
    schools: false,
    proximityMax: 5,
    minYield: 0,
    tier: [],
    activeLayer: 'markers',
    continent: '',
    climateRisk: [],
    minSafetyIdx: 0,
    minPermitEase: 0,
  },
  currency: 'USD',          // 'USD' or 'INR'
  INR_RATE: 83,              // 1 USD = 83 INR (update periodically)
  searchTimeout: null,
  currentCities: [...MM_CITIES],
  showIndiaData: true,       // toggle India 10k+ dataset
  clientProjects: [],        // populated from dashboard state
  activeProjectId: null,     // project whose budget is being matched
  savedCities: {},           // { cityId: projectId } persisted to localStorage
};

/* ═══════════════════════════════════════════════════════
   STEP 1 — Load Leaflet from cdnjs (reliable)
   ═══════════════════════════════════════════════════════ */
function mmLoadLeaflet() {
  return new Promise(function (resolve) {
    if (window.L && window.L.map) { MM.leafletReady = true; resolve(true); return; }

    var LEAFLET_CSS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    var LEAFLET_JS   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    var HEAT_JS      = 'https://cdnjs.cloudflare.com/ajax/libs/Leaflet.heat/0.2.0/leaflet-heat.js';
    var CLUSTER_CSS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css';
    var CLUSTER_CSS2 = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css';
    var CLUSTER_JS   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js';

    // Load CSS files immediately
    [LEAFLET_CSS, CLUSTER_CSS, CLUSTER_CSS2].forEach(function(href) {
      var el = document.createElement('link');
      el.rel = 'stylesheet'; el.href = href;
      document.head.appendChild(el);
    });

    function loadScript(src, cb) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = cb;
      s.onerror = cb; // continue even if one fails
      document.head.appendChild(s);
    }

    loadScript(LEAFLET_JS, function() {
      // Load Heat and Cluster in parallel
      var loaded = 0;
      function done() { if (++loaded === 2) { MM.leafletReady = true; resolve(true); } }
      loadScript(HEAT_JS,    done);
      loadScript(CLUSTER_JS, done);
    });
  });
}

/* ═══════════════════════════════════════════════════════
   STEP 2 — Build the Leaflet map (after CSS paint settle)
   ═══════════════════════════════════════════════════════ */
function mmBuildMap() {
  if (MM.map) return;

  var container = document.getElementById('mm-leaflet-map');
  if (!container) { console.error('[MarketMap] Map container not found'); return; }

  // Guarantee a measurable height so Leaflet doesn't initialise at 0px
  if (container.offsetHeight < 10) {
    container.style.height = (window.innerHeight - 64) + 'px';
  }

  var L = window.L;
  MM.map = L.map('mm-leaflet-map', {
    center: [20, 10],
    zoom: 2,
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,
  });

  // Use basemap system if available, else fallback to dark CartoDB
  var bm = (window.MM_BASEMAPS && window.MM_BASEMAPS['dark']) || null;
  var tileUrl  = bm ? bm.url  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  var tileOpts = bm ? bm.opts : { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains:'abcd', maxZoom:19 };
  window.MM_BASE_TILE_LAYER = L.tileLayer(tileUrl, tileOpts);
  window.MM_BASE_TILE_LAYER.addTo(MM.map);

  // Use MarkerClusterGroup if available for performance with 10k+ points
  if (window.L.markerClusterGroup) {
    MM.markersLayer = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        var size  = count > 500 ? 46 : count > 100 ? 38 : count > 10 ? 32 : 26;
        var bg    = count > 500 ? '#ef4444' : count > 100 ? '#f59e0b' : count > 10 ? '#00d4c8' : '#10b981';
        return L.divIcon({
          html: '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+bg+';' +
                'border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;' +
                'font-size:'+(size > 38 ? 13 : 11)+'px;font-weight:800;color:#fff;font-family:Outfit,sans-serif;' +
                'box-shadow:0 3px 10px rgba(0,0,0,0.4);">'+count+'</div>',
          className: '',
          iconSize: [size, size],
          iconAnchor: [size/2, size/2]
        });
      }
    });
    MM.markersLayer.addTo(MM.map);
    MM.usingClusters = true;
  } else {
    MM.markersLayer = L.layerGroup().addTo(MM.map);
    MM.usingClusters = false;
  }

  MM.infraLayer   = L.layerGroup();
  MM.climateLayer = L.layerGroup();

  // Merge India high-density dataset
  if (window.MM_INDIA_POINTS && window.MM_INDIA_POINTS.length) {
    var existing = MM_CITIES.filter(function(c){ return c.isIndiaPoint; });
    if (!existing.length) {
      window.MM_INDIA_POINTS.forEach(function(p){ MM_CITIES.push(p); });
    }
    MM.currentCities = [...MM_CITIES];
    console.log('[MarketMap] Total dataset: ' + MM_CITIES.length + ' locations');
  }

  // Invalidate after first tile paint
  setTimeout(function () { if (MM.map) MM.map.invalidateSize(); }, 250);
}

/* ═══════════════════════════════════════════════════════
   MAIN INIT — called every time the view opens
   ═══════════════════════════════════════════════════════ */
async function mmInit() {
  // Load saved cities from localStorage
  try {
    var saved = localStorage.getItem('mm_saved_cities');
    if (saved) MM.savedCities = JSON.parse(saved);
  } catch(e) {}

  // Load client projects from dashboard state if available
  await mmLoadClientProjects();

  // Always run data immediately — no map dependency
  mmApplyFilters();

  if (MM.initialized) {
    if (MM.map) setTimeout(function () { MM.map.invalidateSize(); }, 100);
    return;
  }

  var loading = document.getElementById('mm-loading');
  if (loading) loading.style.display = 'flex';

  try {
    var ok = await mmLoadLeaflet();
    if (ok) {
      mmBuildMap();
      mmRenderMarkers(MM.currentCities);
      mmRenderHeat(MM.currentCities);
    }
  } catch (e) {
    console.error('[MarketMap] Init error:', e);
  } finally {
    if (loading) loading.style.display = 'none';
  }

  mmBindFilters();
  mmBindCurrencyToggle();
  mmBindSearch();
  MM.initialized = true;
}

/* ═══════════════════════════════════════════════════════
   UPGRADE: CURRENCY HELPERS
   ═══════════════════════════════════════════════════════ */
function mmToDisplay(usdVal) {
  if (MM.currency === 'INR') return usdVal * MM.INR_RATE;
  return usdVal;
}
function mmFormatPrice(usdVal) {
  var v = mmToDisplay(usdVal);
  if (MM.currency === 'INR') {
    if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
    if (v >= 100000)   return '₹' + (v / 100000).toFixed(1) + 'L';
    return '₹' + Math.round(v).toLocaleString('en-IN');
  }
  return '$' + Math.round(v).toLocaleString();
}
function mmPriceUnit() {
  return MM.currency === 'INR' ? '/m² (₹)' : '/m²';
}
function mmSliderMax() {
  return MM.currency === 'INR' ? 2075000 : 25000; // 25000 USD * 83
}
function mmSliderToUSD(val) {
  return MM.currency === 'INR' ? Math.round(val / MM.INR_RATE) : val;
}
function mmUSDToSlider(usd) {
  return MM.currency === 'INR' ? Math.round(usd * MM.INR_RATE) : usd;
}

/* ═══════════════════════════════════════════════════════
   AFFORDABILITY SCORE (0–100)
   ═══════════════════════════════════════════════════════ */
function mmAffordScore(c) {
  var priceScore = Math.max(0, 100 - (c.priceM2 / 250));
  var yieldScore = Math.min(c.rentYield * 8, 100);
  var proxScore  = (6 - c.proximity) * 12;
  var infraScore = (c.electricity ? 15 : 0) + (c.transport ? 10 : 0) + (c.schools ? 5 : 0);
  return Math.round((priceScore * 0.45) + (yieldScore * 0.25) + (proxScore * 0.15) + (infraScore * 0.15));
}

/* ═══════════════════════════════════════════════════════
   ARCHITECTURE MARKET SUITABILITY SCORE (0–100)
   Weighted: architectDensity, permitEase, safety, constructCost, infra
   ═══════════════════════════════════════════════════════ */
function mmArchScore(c) {
  var archScore    = Math.min((c.architectPer100k || 0) * 1.5, 35);   // 0–35
  var permitScore  = ((c.permitEase || 1) / 5) * 25;                   // 0–25
  var safetyScore  = ((c.safetyIdx  || 0) / 100) * 20;                 // 0–20
  var costScore    = Math.max(0, (10 - (c.constructIdx || 5)) / 10) * 10; // 0–10 (cheaper=better)
  var infraScore   = ((c.electricity ? 5 : 0) + (c.transport ? 5 : 0)); // 0–10
  return Math.round(archScore + permitScore + safetyScore + costScore + infraScore);
}

/* ═══════════════════════════════════════════════════════
   FILTER APPLICATION  (runs immediately, no map needed)
   ═══════════════════════════════════════════════════════ */
function mmApplyFilters() {
  var f = MM.filters;
  // Continent → country mapping
  var continentMap = {
    'india':    ['India'],
    'asia':     ['Japan','Singapore','Thailand','Vietnam','Malaysia','Indonesia','Philippines','Taiwan','South Korea','China','Sri Lanka','Bangladesh','UAE','Saudi Arabia','Turkey','Israel','Oman','Qatar','Kazakhstan'],
    'europe':   ['UK','France','Germany','Italy','Netherlands','Austria','Switzerland','Sweden','Czech Republic','Greece','Portugal','Spain','Poland','Hungary','Romania'],
    'americas': ['USA','Canada','Mexico','Peru','Chile','Brazil','Argentina','Colombia'],
    'africa':   ['South Africa','Kenya','Ghana','Ethiopia','Tanzania','Egypt','Morocco','Nigeria'],
    'oceania':  ['Australia','New Zealand'],
  };
  var allowedCountries = f.continent ? (continentMap[f.continent] || []) : null;

  var cities = MM_CITIES.filter(function (c) {
    // Skip India micro-points if toggle is off
    if (c.isIndiaPoint && !MM.showIndiaData) return false;
    if (c.priceM2      > f.maxPriceM2)   return false;
    if (f.electricity  && !c.electricity) return false;
    if (f.transport    && !c.transport)   return false;
    if (f.schools      && !c.schools)     return false;
    if (c.proximity    > f.proximityMax)  return false;
    if (c.rentYield    < f.minYield)      return false;
    if (f.types.length && !f.types.includes(c.type)) return false;
    if (f.tier.length  && !f.tier.includes(c.tier))  return false;
    if (allowedCountries && !allowedCountries.includes(c.country)) return false;
    if (f.climateRisk.length && !f.climateRisk.includes(c.climateRisk)) return false;
    if (f.minSafetyIdx > 0 && (c.safetyIdx || 0) < f.minSafetyIdx) return false;
    if (f.minPermitEase > 0 && (c.permitEase || 0) < f.minPermitEase) return false;
    return true;
  });
  cities.sort(function (a, b) { return mmAffordScore(b) - mmAffordScore(a); });
  MM.currentCities = cities;

  mmRenderResults(cities);
  mmUpdateStats(cities);

  if (MM.map && MM.markersLayer) {
    mmRenderMarkers(cities);
    mmRenderHeat(cities);
  }
}

/* ═══════════════════════════════════════════════════════
   STATS BAR
   ═══════════════════════════════════════════════════════ */
function mmUpdateStats(cities) {
  function set(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  if (!cities.length) {
    set('mm-stat-locations','0'); set('mm-stat-avg-price','—');
    set('mm-stat-avg-yield','—'); set('mm-stat-top-score','—');
    return;
  }
  var avgPrice = Math.round(cities.reduce(function (a, c) { return a + c.priceM2; }, 0) / cities.length);
  var avgYield = (cities.reduce(function (a, c) { return a + c.rentYield; }, 0) / cities.length).toFixed(1);
  var avgArch = Math.round(cities.reduce(function(a,c){return a+mmArchScore(c);},0)/cities.length);
  set('mm-stat-locations', cities.length);
  set('mm-stat-avg-price', mmFormatPrice(avgPrice));
  set('mm-stat-avg-yield', avgYield + '%');
  set('mm-stat-top-score', mmAffordScore(cities[0]));
  set('mm-stat-arch-score', avgArch);
  // Update stat pill subtitle to reflect currency
  var sub = document.querySelector('#mm-stat-avg-price + .pill-sub');
  var pillSubs = document.querySelectorAll('.mm-stat-pill .pill-sub');
  pillSubs.forEach(function(el) {
    if (el.textContent === 'Avg $/m²' || el.textContent === 'Avg ₹/m²') {
      el.textContent = MM.currency === 'INR' ? 'Avg ₹/m²' : 'Avg $/m²';
    }
  });
}

/* ═══════════════════════════════════════════════════════
   RESULT CARDS  (sidebar — no map dependency)
   ═══════════════════════════════════════════════════════ */
function mmRenderResults(cities) {
  var container = document.getElementById('mm-results-list');
  var countEl   = document.getElementById('mm-results-count');
  if (!container) return;
  if (countEl) countEl.textContent = cities.length;

  if (!cities.length) {
    container.innerHTML = '<div class="mm-empty"><i class="fas fa-search-location"></i>No locations match your filters.<br>Try relaxing some criteria.</div>';
    return;
  }

  var scoreClass = { A:'score-a', B:'score-b', C:'score-c', D:'score-d' };
  container.innerHTML = cities.slice(0, 20).map(function (c, i) {
    var score = mmAffordScore(c);
    return '<div class="mm-result-card" id="mm-rc-' + c.id + '" onclick="mmFocusCity(' + c.id + ')">' +
      '<div class="mm-result-score ' + (scoreClass[c.tier] || 'score-c') + '">#' + (i + 1) + '</div>' +
      '<div class="mm-result-info">' +
        '<div class="mm-result-city">' + c.flag + ' ' + c.city + '</div>' +
        '<div class="mm-result-country">' + c.country + ' &middot; Score ' + score + '</div>' +
      '</div>' +
      '<div><div class="mm-result-price">' + mmFormatPrice(c.priceM2) + '</div>' +
      '<div class="mm-result-per">per m&sup2;</div></div>' +
    '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   MAP MARKERS
   ═══════════════════════════════════════════════════════ */
function mmRenderMarkers(cities) {
  if (!MM.map || !MM.markersLayer || !window.L) return;
  var L = window.L;

  // Clear existing markers properly
  if (MM.usingClusters && MM.markersLayer.clearLayers) {
    MM.markersLayer.clearLayers();
  } else if (MM.markersLayer.clearLayers) {
    MM.markersLayer.clearLayers();
  }

  // Cap render: at world zoom show named cities only; zoom ≥ 5 show India micro-points too
  var zoom = MM.map.getZoom ? MM.map.getZoom() : 2;
  var MAX_MARKERS = 800; // hard cap for non-cluster fallback

  // Separate named cities from India micro-points
  var namedCities = cities.filter(function(c) { return !c.isIndiaPoint; });
  var indiaPoints = cities.filter(function(c) { return c.isIndiaPoint; });

  // At low zoom, limit India points to avoid the blob
  var pointsToRender;
  if (MM.usingClusters) {
    // Clusters handle thousands fine
    pointsToRender = cities;
  } else {
    // No clustering: cap to avoid freeze
    pointsToRender = namedCities.concat(indiaPoints.slice(0, Math.max(0, MAX_MARKERS - namedCities.length)));
  }

  var markers = [];

  pointsToRender.forEach(function(c) {
    var score = mmAffordScore(c);

    // India micro-points: tiny coloured dot, no flag emoji (much faster)
    if (c.isIndiaPoint) {
      var dotCol = c.tier === 'A' ? '#10b981' : c.tier === 'B' ? '#00d4c8' : c.tier === 'C' ? '#f59e0b' : '#ef4444';
      var dotIcon = L.circleMarker([c.lat, c.lng], {
        radius: 5,
        fillColor: dotCol,
        color: 'rgba(0,0,0,0.3)',
        weight: 0.5,
        fillOpacity: 0.82,
        pane: 'markerPane'
      });
      dotIcon.bindPopup(
        '<div class="mm-popup" style="min-width:200px">' +
        '<div class="mm-popup-head">' +
        '<div class="mm-popup-flag">🇮🇳</div>' +
        '<div class="mm-popup-city" style="font-size:0.82rem">' + c.city.split(' · ')[0] + '</div>' +
        '<div class="mm-popup-country">' + (c.state || 'India') + ' · ₹' + Math.round(c.priceM2 * MM.INR_RATE).toLocaleString('en-IN') + '/m²</div>' +
        '</div>' +
        '<div class="mm-popup-body">' +
        '<div class="mm-popup-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Price/m²</div><div class="mm-popup-kv-val">' + mmFormatPrice(c.priceM2) + '</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Yield</div><div class="mm-popup-kv-val">' + c.rentYield.toFixed(1) + '%</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">YoY Growth</div><div class="mm-popup-kv-val" style="color:#10b981">+' + c.yoyGrowth.toFixed(1) + '%</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Safety</div><div class="mm-popup-kv-val">' + c.safetyIdx + '/100</div></div>' +
        '</div></div></div>',
        { maxWidth: 240, className: 'mm-popup-wrapper', closeButton: true }
      );
      markers.push(dotIcon);
      return;
    }

    // Named city: full flag marker (existing behaviour)
    var size = Math.min(30 + Math.round(score / 8), 44);
    var icon = L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -(size + 4)],
      html: '<div class="mm-marker-icon mm-marker-' + c.tier + '" style="width:' + size + 'px;height:' + size + 'px;"><div class="mm-marker-inner">' + c.flag + '</div></div>',
    });
    var m = L.marker([c.lat, c.lng], { icon: icon });
    m.bindPopup(mmBuildPopup(c, score, 0), { maxWidth: 300, minWidth: 280, className: 'mm-popup-wrapper', closeButton: true });
    m.on('click', function() { mmHighlightResult(c.id); });
    markers.push(m);
  });

  // Add all markers at once (cluster group handles performance)
  if (MM.usingClusters && MM.markersLayer.addLayers) {
    MM.markersLayer.addLayers(markers);
  } else {
    markers.forEach(function(m) { m.addTo(MM.markersLayer); });
  }
}

/* ═══════════════════════════════════════════════════════
   HEATMAP
   ═══════════════════════════════════════════════════════ */
function mmRenderHeat(cities) {
  if (!MM.map || !window.L || !window.L.heatLayer) return;
  if (MM.heatLayer) MM.map.removeLayer(MM.heatLayer);
  if (!cities.length) return;
  var maxP = Math.max.apply(null, cities.map(function (c) { return c.priceM2; }));
  MM.heatLayer = window.L.heatLayer(
    cities.map(function (c) { return [c.lat, c.lng, c.priceM2 / maxP]; }),
    { radius:35, blur:25, maxZoom:6, max:1.0, gradient:{ 0.2:'#10b981', 0.5:'#f59e0b', 0.8:'#ef4444', 1.0:'#8b5cf6' } }
  );
  if (MM.filters.activeLayer === 'heat') MM.heatLayer.addTo(MM.map);
}

/* ═══════════════════════════════════════════════════════
   POPUP BUILDER
   ═══════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   POPUP BADGE HELPERS
   ═══════════════════════════════════════════════════════ */
function mmClimateRiskBadge(risk) {
  var cfg = {
    low:     { cls:'tag-green',  icon:'fa-shield-alt',    label:'Low Climate Risk' },
    medium:  { cls:'tag-amber',  icon:'fa-exclamation-triangle', label:'Medium Risk' },
    high:    { cls:'tag-red',    icon:'fa-bolt',          label:'High Climate Risk' },
    extreme: { cls:'tag-red',    icon:'fa-skull-crossbones', label:'Extreme Risk' },
  };
  var c = cfg[risk] || cfg.medium;
  return '<span class="mm-popup-tag ' + c.cls + '"><i class="fas ' + c.icon + '"></i> ' + c.label + '</span>';
}
function mmAirQualityBadge(aq) {
  var cfg = {
    good:      { cls:'tag-green',  label:'Air: Good' },
    moderate:  { cls:'tag-amber',  label:'Air: Moderate' },
    poor:      { cls:'tag-red',    label:'Air: Poor' },
    hazardous: { cls:'tag-red',    label:'Air: Hazardous' },
  };
  var c = cfg[aq] || cfg.moderate;
  return '<span class="mm-popup-tag ' + c.cls + '"><i class="fas fa-wind"></i> ' + c.label + '</span>';
}

function mmBuildPopup(c, score, rank) {
  var tC = { A:'#10b981', B:'#00d4c8', C:'#f59e0b', D:'#ef4444' };
  var tL = { A:'Highly Affordable', B:'Affordable', C:'Moderate', D:'Premium' };
  var col = tC[c.tier] || '#94a3b8';
  var pBuy = mmFormatPrice(c.priceM2 * 120);
  var prox = ['','City Centre','Inner City','Suburbs','Outskirts','Remote'][c.proximity] || '—';
  var yC = c.yoyGrowth >= 0 ? '#10b981' : '#ef4444';
  var yS = c.yoyGrowth >= 0 ? '+' : '';
  var tags =
    (c.electricity ? '<span class="mm-popup-tag tag-cyan"><i class="fas fa-bolt"></i> Electricity</span>' : '<span class="mm-popup-tag tag-red"><i class="fas fa-bolt-slash"></i> No Grid</span>') +
    (c.transport   ? '<span class="mm-popup-tag tag-green"><i class="fas fa-train"></i> Transport</span>'  : '<span class="mm-popup-tag tag-amber"><i class="fas fa-car"></i> Car Needed</span>') +
    (c.schools     ? '<span class="mm-popup-tag tag-violet"><i class="fas fa-school"></i> Schools</span>' : '');

  // ── Budget Fit row ──────────────────────────────────────────────────────────
  var budgetFitHtml = '';
  var proj = MM.clientProjects.find(function(p) { return p._id === MM.activeProjectId; });
  if (proj && proj.budget && (proj.budget.min || proj.budget.max)) {
    // Estimate required budget: priceM2 * landSizeSqm (land + ~construction overhead at 1.8x)
    var landSqm = 0;
    if (proj.landSize && proj.landSize.value) {
      var lv = proj.landSize.value;
      var lu = proj.landSize.unit || 'sqft';
      if (lu === 'sqft')  landSqm = lv * 0.0929;
      else if (lu === 'sqm')   landSqm = lv;
      else if (lu === 'cents') landSqm = lv * 40.47;
      else if (lu === 'acres') landSqm = lv * 4047;
    }
    if (!landSqm) landSqm = 150; // default fallback 150 sqm
    var estCostUSD = c.priceM2 * landSqm * 1.8;
    // Convert project budget to USD for comparison (budget is in INR)
    var projMaxUSD = proj.budget.max ? proj.budget.max / MM.INR_RATE : null;
    var projMinUSD = proj.budget.min ? proj.budget.min / MM.INR_RATE : null;
    var fitClass, fitIcon, fitTitle, fitSub;
    if (projMaxUSD && estCostUSD <= projMaxUSD) {
      fitClass = 'fit-yes'; fitIcon = 'fa-check-circle';
      fitTitle = 'Budget Fit — Feasible';
      fitSub = 'Est. ' + mmFormatPrice(estCostUSD) + ' vs your ' + mmFormatPrice(projMaxUSD * MM.INR_RATE / (MM.currency==='INR'?1:MM.INR_RATE)) + ' max';
    } else if (projMaxUSD && estCostUSD <= projMaxUSD * 1.35) {
      fitClass = 'fit-tight'; fitIcon = 'fa-exclamation-circle';
      fitTitle = 'Budget Fit — Tight';
      fitSub = 'Est. ' + mmFormatPrice(estCostUSD) + ' — slightly above your budget';
    } else {
      fitClass = 'fit-no'; fitIcon = 'fa-times-circle';
      fitTitle = 'Over Budget';
      fitSub = projMaxUSD ? ('Est. ' + mmFormatPrice(estCostUSD) + ' exceeds your max') : 'Set a max budget to compare';
    }
    budgetFitHtml = '<div class="mm-budget-fit-row ' + fitClass + '">' +
      '<i class="fas ' + fitIcon + '"></i>' +
      '<div class="mm-budget-fit-text"><strong>' + fitTitle + '</strong><span>' + fitSub + '</span></div>' +
      '</div>';
  }

  // ── Save to Project button ──────────────────────────────────────────────────
  var isSaved = MM.savedCities[c.id];
  var saveLabel = isSaved ? '<i class="fas fa-bookmark"></i> Saved' : '<i class="far fa-bookmark"></i> Save';
  var saveClass = isSaved ? 'mm-save-btn saved' : 'mm-save-btn';
  var saveClick = isSaved ? '' : 'onclick="mmSaveCity(' + c.id + ')"'

  return '<div class="mm-popup">' +
    '<div class="mm-popup-head">' +
      '<div class="mm-popup-flag">' + c.flag + '</div>' +
      '<div class="mm-popup-city">#' + rank + ' ' + c.city + '</div>' +
      '<div class="mm-popup-country">' + c.country + '</div>' +
      '<div class="mm-popup-score-badge" style="background:' + col + '22;color:' + col + ';border:1px solid ' + col + '44;">' + tL[c.tier] + '</div>' +
    '</div>' +
    '<div class="mm-popup-body">' +
      '<div class="mm-popup-price-row"><span class="mm-popup-price-main">' + mmFormatPrice(c.priceM2) + '</span><span class="mm-popup-price-unit">' + mmPriceUnit() + '</span></div>' +
      budgetFitHtml +
      '<div class="mm-popup-grid">' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Afford. Score</div><div class="mm-popup-kv-val" style="color:' + col + '">' + score + '/100</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Arch. Score</div><div class="mm-popup-kv-val" style="color:#8b5cf6">' + mmArchScore(c) + '/100</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">YoY Growth</div><div class="mm-popup-kv-val" style="color:' + yC + '">' + yS + c.yoyGrowth + '%</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Rent Yield</div><div class="mm-popup-kv-val">' + c.rentYield + '%</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Location</div><div class="mm-popup-kv-val">' + prox + '</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">120m\u00b2 Est.</div><div class="mm-popup-kv-val">' + pBuy + '</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Build Cost</div><div class="mm-popup-kv-val">' + ['','★','★★','★★★','★★★★','★★★★★','★★★★★★','★★★★★★★','★★★★★★★★','★★★★★★★★★','★★★★★★★★★★'][(11-(c.constructIdx||5))] + '</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Permit Ease</div><div class="mm-popup-kv-val">' + (c.permitEase||0) + '/5</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Safety</div><div class="mm-popup-kv-val">' + (c.safetyIdx||0) + '/100</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Arch/100k</div><div class="mm-popup-kv-val">' + (c.architectPer100k||0) + '</div></div>' +
      '</div>' +
      '<div class="mm-popup-badges">' +
        mmClimateRiskBadge(c.climateRisk) +
        mmAirQualityBadge(c.airQuality) +
      '</div>' +
      '<div class="mm-popup-infra">' + tags + '</div>' +
      '<div class="mm-popup-actions">' +
        '<button class="mm-popup-cta" onclick="mmFlyTo(' + c.lat + ',' + c.lng + ',10)"><i class="fas fa-map-marker-alt"></i> Explore</button>' +
        '<button class="' + saveClass + '" id="mm-save-' + c.id + '" ' + saveClick + '>' + saveLabel + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ═══════════════════════════════════════════════════════
   CLIMATE RISK LAYER
   ═══════════════════════════════════════════════════════ */
function mmRenderClimateLayer(cities) {
  if (!MM.map || !window.L) return;
  var L = window.L;
  if (!MM.climateLayer) MM.climateLayer = L.layerGroup();
  MM.climateLayer.clearLayers();
  MM.climateLayer.addTo(MM.map);

  var riskColor = { low:'#10b981', medium:'#f59e0b', high:'#ef4444', extreme:'#8b5cf6' };
  var riskSize  = { low:24, medium:28, high:34, extreme:40 };

  cities.forEach(function(c) {
    var col  = riskColor[c.climateRisk] || '#94a3b8';
    var sz   = riskSize[c.climateRisk]  || 28;
    var icon = L.divIcon({
      className: '',
      iconSize:  [sz, sz],
      iconAnchor:[sz/2, sz/2],
      popupAnchor:[0, -(sz/2 + 4)],
      html: '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;' +
            'background:' + col + '33;border:2.5px solid ' + col + ';' +
            'display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 0 12px ' + col + '55;cursor:pointer;">' +
            '<span style="font-size:' + Math.round(sz*0.45) + 'px">' + c.flag + '</span></div>'
    });
    var rLabel = { low:'🟢 Low', medium:'🟡 Medium', high:'🔴 High', extreme:'🟣 Extreme' };
    L.marker([c.lat, c.lng], { icon: icon })
      .addTo(MM.climateLayer)
      .bindPopup(
        '<div class="mm-popup" style="min-width:220px">' +
        '<div class="mm-popup-head"><div class="mm-popup-flag">' + c.flag + '</div>' +
        '<div class="mm-popup-city">' + c.city + '</div>' +
        '<div class="mm-popup-country">' + c.country + '</div></div>' +
        '<div class="mm-popup-body">' +
        '<div style="margin-bottom:0.6rem"><span style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Climate Risk</span>' +
        '<div style="font-size:1.1rem;font-weight:800;color:' + col + ';margin-top:2px">' + (rLabel[c.climateRisk]||'Unknown') + '</div></div>' +
        '<div class="mm-popup-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Safety</div><div class="mm-popup-kv-val">' + (c.safetyIdx||0) + '/100</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Air Quality</div><div class="mm-popup-kv-val" style="text-transform:capitalize">' + (c.airQuality||'—') + '</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Permit Ease</div><div class="mm-popup-kv-val">' + (c.permitEase||0) + '/5</div></div>' +
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Arch Score</div><div class="mm-popup-kv-val" style="color:#8b5cf6">' + mmArchScore(c) + '/100</div></div>' +
        '</div></div></div>',
        { maxWidth:260, className:'mm-popup-wrapper', closeButton:true }
      );
  });
}

/* ═══════════════════════════════════════════════════════
   ARCH SCORE MARKERS (colour = arch market quality)
   ═══════════════════════════════════════════════════════ */
function mmRenderArchMarkers(cities) {
  if (!MM.map || !MM.markersLayer || !window.L) return;
  var L = window.L;
  MM.markersLayer.clearLayers();

  cities.forEach(function(c, idx) {
    var as = mmArchScore(c);
    var col = as >= 70 ? '#10b981' : as >= 45 ? '#00d4c8' : as >= 25 ? '#f59e0b' : '#ef4444';
    var sz  = Math.min(24 + Math.round(as / 8), 44);
    var icon = L.divIcon({
      className: '',
      iconSize:  [sz, sz],
      iconAnchor:[sz/2, sz],
      popupAnchor:[0, -(sz+4)],
      html: '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50% 50% 50% 4px;' +
            'transform:rotate(-45deg);background:linear-gradient(135deg,' + col + ',' + col + 'aa);' +
            'border:2px solid ' + col + '88;box-shadow:0 4px 12px ' + col + '44;' +
            'display:flex;align-items:center;justify-content:center;">' +
            '<span style="transform:rotate(45deg);font-size:' + Math.round(sz*0.38) + 'px">' + c.flag + '</span></div>'
    });
    var archPopup = mmBuildPopup(c, mmAffordScore(c), idx+1);
    L.marker([c.lat, c.lng], { icon: icon })
      .addTo(MM.markersLayer)
      .bindPopup(archPopup, { maxWidth:300, minWidth:280, className:'mm-popup-wrapper', closeButton:true })
      .on('click', function(){ mmHighlightResult(c.id); });
  });
}

/* ═══════════════════════════════════════════════════════
   INTERACTION HELPERS
   ═══════════════════════════════════════════════════════ */
function mmFlyTo(lat, lng, zoom) {
  if (!MM.map) return;
  MM.map.flyTo([lat, lng], zoom || 10, { duration: 1.2, easeLinearity: 0.5 });
}

function mmFocusCity(id) {
  var c = MM_CITIES.find(function (x) { return x.id === id; });
  if (!c) return;
  mmHighlightResult(id);
  if (!MM.map) return;
  MM.map.flyTo([c.lat, c.lng], 8, { duration: 1.0 });
  MM.markersLayer.eachLayer(function (layer) {
    if (!layer.getLatLng) return;
    var ll = layer.getLatLng();
    if (Math.abs(ll.lat - c.lat) < 0.01 && Math.abs(ll.lng - c.lng) < 0.01) layer.openPopup();
  });
}

function mmHighlightResult(id) {
  document.querySelectorAll('.mm-result-card').forEach(function (el) { el.style.background = ''; });
  var el = document.getElementById('mm-rc-' + id);
  if (el) { el.style.background = 'rgba(0,212,200,0.06)'; el.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
}

/* ═══════════════════════════════════════════════════════
   FILTER BINDINGS (called once on first open)
   ═══════════════════════════════════════════════════════ */
function mmBindFilters() {
  function slider(id, valId, transform, key) {
    var s = document.getElementById(id), v = document.getElementById(valId);
    if (!s) return;
    s.addEventListener('input', function () {
      var displayVal = transform(+s.value); // transform may update MM.filters[key] for special cases
      if (key !== 'maxPriceM2') MM.filters[key] = +s.value; // price handled inside transform
      if (v) v.textContent = displayVal;
    });
  }
  var proxLbls = ['','City Centre','Inner City','Suburbs','Outskirts','All'];
  slider('mm-price-slider','mm-price-val', function(n){ MM.filters.maxPriceM2 = mmSliderToUSD(n); return mmFormatPrice(mmSliderToUSD(n)); }, 'maxPriceM2');
  slider('mm-yield-slider','mm-yield-val', function(n){ return n.toFixed(1)+'%'; },       'minYield');
  slider('mm-prox-slider', 'mm-prox-val',  function(n){ return proxLbls[n]||'All'; },     'proximityMax');

  ['electricity','transport','schools'].forEach(function (key) {
    var el = document.getElementById('mm-toggle-' + key);
    if (el) el.addEventListener('change', function () { MM.filters[key] = el.checked; });
  });

  document.querySelectorAll('.mm-chip[data-type]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      chip.classList.toggle('active');
      var t = chip.dataset.type;
      MM.filters.types = MM.filters.types.includes(t)
        ? MM.filters.types.filter(function(x){return x!==t;})
        : MM.filters.types.concat(t);
    });
  });

  document.querySelectorAll('.mm-chip[data-tier]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      chip.classList.toggle('active');
      var t = chip.dataset.tier;
      MM.filters.tier = MM.filters.tier.includes(t)
        ? MM.filters.tier.filter(function(x){return x!==t;})
        : MM.filters.tier.concat(t);
    });
  });

  var ab = document.getElementById('mm-apply-btn');
  if (ab) ab.addEventListener('click', mmApplyFilters);

  var rb = document.getElementById('mm-reset-btn');
  if (rb) rb.addEventListener('click', mmResetFilters);

  // Continent selector
  var cs = document.getElementById('mm-continent-select');
  if (cs) cs.addEventListener('change', function() { MM.filters.continent = cs.value; });

  // Safety index slider
  var ss = document.getElementById('mm-safety-slider');
  var sv = document.getElementById('mm-safety-val');
  if (ss) ss.addEventListener('input', function() {
    MM.filters.minSafetyIdx = +ss.value;
    if (sv) sv.textContent = ss.value;
  });

  // Permit ease slider
  var ps2 = document.getElementById('mm-permit-slider');
  var pv2 = document.getElementById('mm-permit-val');
  if (ps2) ps2.addEventListener('input', function() {
    MM.filters.minPermitEase = +ps2.value;
    if (pv2) pv2.textContent = ['Any','1','2','3','4','5'][+ps2.value] || ps2.value;
  });

  // Climate risk chips
  document.querySelectorAll('.mm-chip[data-climate]').forEach(function(chip) {
    chip.addEventListener('click', function() {
      chip.classList.toggle('active');
      var r = chip.dataset.climate;
      MM.filters.climateRisk = MM.filters.climateRisk.includes(r)
        ? MM.filters.climateRisk.filter(function(x){return x!==r;})
        : MM.filters.climateRisk.concat(r);
    });
  });

  // Construction Cost Calculator
  var calcBtn = document.getElementById('mm-calc-btn');
  if (calcBtn) calcBtn.addEventListener('click', mmRunCalculator);

  document.querySelectorAll('.mm-layer-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mm-layer-btn').forEach(function (b){ b.classList.remove('active'); });
      btn.classList.add('active');
      MM.filters.activeLayer = btn.dataset.layer;
      mmSwitchLayer(btn.dataset.layer);
    });
  });

  // India data toggle
  var indiaToggle = document.getElementById('mm-india-toggle');
  if (indiaToggle) {
    indiaToggle.checked = MM.showIndiaData;
    indiaToggle.addEventListener('change', function() {
      MM.showIndiaData = indiaToggle.checked;
      mmApplyFilters();
    });
  }
}

/* ═══════════════════════════════════════════════════════
   LAYER SWITCHER
   ═══════════════════════════════════════════════════════ */
function mmSwitchLayer(layer) {
  if (!MM.map) return;
  // Hide all layers first
  if (MM.heatLayer)    MM.map.removeLayer(MM.heatLayer);
  if (MM.infraLayer)   MM.map.removeLayer(MM.infraLayer);
  if (MM.climateLayer) MM.map.removeLayer(MM.climateLayer);
  // Clear markers but keep cluster group attached
  if (MM.markersLayer && MM.markersLayer.clearLayers) MM.markersLayer.clearLayers();

  if (layer === 'markers') {
    if (MM.markersLayer && !MM.map.hasLayer(MM.markersLayer)) MM.markersLayer.addTo(MM.map);
    mmRenderMarkers(MM.currentCities);
  } else if (layer === 'heat') {
    if (MM.markersLayer) MM.map.removeLayer(MM.markersLayer);
    mmRenderHeat(MM.currentCities);
    if (MM.heatLayer) MM.heatLayer.addTo(MM.map);
  } else if (layer === 'infra') {
    mmLoadInfraLayer();
  } else if (layer === 'climate') {
    if (MM.markersLayer && !MM.map.hasLayer(MM.markersLayer)) MM.markersLayer.addTo(MM.map);
    mmRenderClimateLayer(MM.currentCities);
  } else if (layer === 'arch') {
    if (MM.markersLayer && !MM.map.hasLayer(MM.markersLayer)) MM.markersLayer.addTo(MM.map);
    mmRenderArchMarkers(MM.currentCities);
  }
}

/* ═══════════════════════════════════════════════════════
   RESET
   ═══════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   CONSTRUCTION COST CALCULATOR
   ═══════════════════════════════════════════════════════ */
function mmRunCalculator() {
  var areaInput  = document.getElementById('mm-calc-area');
  var typeInput  = document.getElementById('mm-calc-type');
  var resultDiv  = document.getElementById('mm-calc-result');
  if (!areaInput || !resultDiv) return;

  var areaSqm = parseFloat(areaInput.value);
  var bldType = typeInput ? typeInput.value : 'standard';
  if (isNaN(areaSqm) || areaSqm < 10) {
    resultDiv.innerHTML = '<span style="color:#f87171">Please enter a valid area (min 10 m²).</span>';
    resultDiv.style.display = 'block';
    return;
  }

  // Quality multipliers
  var qualMul = { budget:0.65, standard:1.0, premium:1.5, luxury:2.2 };
  var qm = qualMul[bldType] || 1.0;

  // Filter to currently shown cities only
  var cities = MM.currentCities.slice(0, 8);
  if (!cities.length) { resultDiv.innerHTML = '<span style="color:#94a3b8">Apply filters first to select cities.</span>'; resultDiv.style.display='block'; return; }

  var rows = cities.map(function(c) {
    // constructIdx 1=cheap($200/m²) to 10=expensive($2500/m²) construction cost
    var baseCostPerSqm = 200 + (c.constructIdx || 5) * 230;
    var totalCostUSD   = areaSqm * baseCostPerSqm * qm;
    var landCostUSD    = c.priceM2 * areaSqm;
    var grandTotalUSD  = totalCostUSD + landCostUSD;
    var archFeeUSD     = grandTotalUSD * 0.08; // 8% typical arch fee
    var as = mmArchScore(c);
    var aCol = as >= 70 ? '#10b981' : as >= 45 ? '#00d4c8' : '#f59e0b';
    return '<tr>' +
      '<td style="padding:0.45rem 0.5rem;font-weight:700;color:#f1f5f9;white-space:nowrap">' + c.flag + ' ' + c.city + '</td>' +
      '<td style="padding:0.45rem 0.5rem;color:#00d4c8;font-weight:700">' + mmFormatPrice(totalCostUSD) + '</td>' +
      '<td style="padding:0.45rem 0.5rem;color:#94a3b8">' + mmFormatPrice(landCostUSD) + '</td>' +
      '<td style="padding:0.45rem 0.5rem;color:#a78bfa">' + mmFormatPrice(archFeeUSD) + '</td>' +
      '<td style="padding:0.45rem 0.5rem;color:#f1f5f9;font-weight:800">' + mmFormatPrice(grandTotalUSD) + '</td>' +
      '<td style="padding:0.45rem 0.5rem;color:' + aCol + ';font-weight:700">' + as + '/100</td>' +
      '</tr>';
  }).join('');

  resultDiv.innerHTML =
    '<div style="font-size:0.7rem;color:#64748b;margin-bottom:0.5rem">Est. for <strong style="color:#f1f5f9">' + areaSqm + 'm²</strong> · ' +
    '<strong style="color:#f1f5f9;text-transform:capitalize">' + bldType + '</strong> quality · currency: <strong style="color:#f1f5f9">' + MM.currency + '</strong></div>' +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.72rem">' +
    '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">' +
    '<th style="padding:0.35rem 0.5rem;color:#64748b;text-align:left;font-weight:600">City</th>' +
    '<th style="padding:0.35rem 0.5rem;color:#64748b;text-align:left;font-weight:600">Build</th>' +
    '<th style="padding:0.35rem 0.5rem;color:#64748b;text-align:left;font-weight:600">Land</th>' +
    '<th style="padding:0.35rem 0.5rem;color:#64748b;text-align:left;font-weight:600">Arch Fee</th>' +
    '<th style="padding:0.35rem 0.5rem;color:#64748b;text-align:left;font-weight:600">Total</th>' +
    '<th style="padding:0.35rem 0.5rem;color:#64748b;text-align:left;font-weight:600">Arch★</th>' +
    '</thead><tbody>' + rows + '</tbody></table></div>';
  resultDiv.style.display = 'block';
}

function mmResetFilters() {
  Object.assign(MM.filters, { maxPriceM2:25000, minYield:0, proximityMax:5, electricity:false, transport:false, schools:false, types:[], tier:[], continent:'', climateRisk:[], minSafetyIdx:0, minPermitEase:0 });
  MM.activeProjectId = null;
  var sliderMax = mmSliderMax();
  var ps=document.getElementById('mm-price-slider'); if(ps){ ps.max=sliderMax; ps.value=mmUSDToSlider(25000); }
  var pv=document.getElementById('mm-price-val');    if(pv)pv.textContent=mmFormatPrice(25000);
  var ys=document.getElementById('mm-yield-slider'); if(ys)ys.value=0;
  var yv=document.getElementById('mm-yield-val');    if(yv)yv.textContent='0.0%';
  var xs=document.getElementById('mm-prox-slider');  if(xs)xs.value=5;
  var xv=document.getElementById('mm-prox-val');     if(xv)xv.textContent='All';
  var ss=document.getElementById('mm-safety-slider'); if(ss)ss.value=0;
  var sv=document.getElementById('mm-safety-val');    if(sv)sv.textContent='0';
  var ps2=document.getElementById('mm-permit-slider'); if(ps2)ps2.value=0;
  var pv2=document.getElementById('mm-permit-val');    if(pv2)pv2.textContent='Any';
  var cs=document.getElementById('mm-continent-select'); if(cs)cs.value='';
  var cr=document.getElementById('mm-calc-result'); if(cr)cr.style.display='none';
  ['electricity','transport','schools'].forEach(function(k){ var e=document.getElementById('mm-toggle-'+k); if(e)e.checked=false; });
  document.querySelectorAll('.mm-chip').forEach(function(c){ c.classList.remove('active'); });
  mmRenderProjectPills();
  mmApplyFilters();
}

/* ═══════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════ */
function mmBindSearch() {
  var input   = document.getElementById('mm-search-input');
  var results = document.getElementById('mm-search-results');
  if (!input || !results) return;

  input.addEventListener('input', function () {
    clearTimeout(MM.searchTimeout);
    var q = input.value.trim();
    if (q.length < 2) { results.style.display='none'; return; }

    var local = MM_CITIES.filter(function(c){
      return c.city.toLowerCase().includes(q.toLowerCase()) || c.country.toLowerCase().includes(q.toLowerCase());
    }).slice(0,5);

    var html = local.map(function(c){
      return '<div class="mm-search-result-item" onclick="mmFocusCity('+c.id+');document.getElementById(\'mm-search-results\').style.display=\'none\';document.getElementById(\'mm-search-input\').value=\''+c.city+'\'">' +
        '<i class="fas fa-map-marker-alt"></i>'+c.flag+' '+c.city+', '+c.country+'</div>';
    }).join('');

    if (html) { results.innerHTML=html; results.style.display='block'; }

    MM.searchTimeout = setTimeout(function(){
      fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q)+'&limit=4')
        .then(function(r){return r.json();})
        .then(function(data){
          var extra = data.filter(function(r){
            var n=r.display_name.split(',')[0].toLowerCase();
            return !local.find(function(c){return c.city.toLowerCase()===n;});
          }).map(function(r){
            var la=parseFloat(r.lat),lo=parseFloat(r.lon),lbl=r.display_name.split(',').slice(0,2).join(',');
            return '<div class="mm-search-result-item" onclick="mmFlyTo('+la+','+lo+',10);document.getElementById(\'mm-search-results\').style.display=\'none\'">'+
              '<i class="fas fa-globe"></i>'+lbl+'</div>';
          }).join('');
          if(extra){results.innerHTML=html+extra;results.style.display='block';}
        }).catch(function(){});
    }, 400);
  });

  document.addEventListener('click', function(e){
    if(!results.contains(e.target)&&e.target!==input) results.style.display='none';
  });
}

/* ═══════════════════════════════════════════════════════
   INFRA LAYER (Overpass API)
   ═══════════════════════════════════════════════════════ */
async function mmLoadInfraLayer() {
  if (!MM.map || !window.L) return;

  // Show zoom hint if zoomed out too far
  var hint = document.getElementById('mm-infra-hint');
  if (MM.map.getZoom() < 9) {
    if (hint) { hint.classList.add('visible'); setTimeout(function(){ hint.classList.remove('visible'); }, 3500); }
    return;
  }
  if (hint) hint.classList.remove('visible');

  var L = window.L;
  if (!MM.infraLayer) MM.infraLayer = L.layerGroup();
  MM.infraLayer.clearLayers();
  MM.infraLayer.addTo(MM.map);

  var b = MM.map.getBounds();
  var bb = b.getSouth()+','+b.getWest()+','+b.getNorth()+','+b.getEast();
  var q = '[out:json][timeout:10];(node["power"="tower"]('+bb+');node["amenity"="school"]('+bb+');node["amenity"="hospital"]('+bb+');node["public_transport"="station"]('+bb+'););out body 60;';
  try {
    var res  = await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q});
    var data = await res.json();
    var icons={tower:{i:'⚡',l:'Power Tower'},school:{i:'🏫',l:'School'},hospital:{i:'🏥',l:'Hospital'},station:{i:'🚉',l:'Transit'}};
    (data.elements||[]).forEach(function(el){
      var pt = el.tags.power==='tower'?'tower':el.tags.amenity==='school'?'school':el.tags.amenity==='hospital'?'hospital':el.tags.public_transport==='station'?'station':null;
      if(!pt||!el.lat||!el.lon) return;
      var cfg=icons[pt];
      L.marker([el.lat,el.lon],{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div style="font-size:14px;line-height:22px;text-align:center">'+cfg.i+'</div>'})})
        .addTo(MM.infraLayer)
        .bindPopup('<div class="mm-infra-popup"><h4>'+(el.tags.name||cfg.l)+'</h4><p>'+cfg.l+'</p></div>',{className:'mm-popup-wrapper'});
    });
    if (!(data.elements||[]).length) mmToast('No infrastructure data found in this area.');
  } catch(e){ mmToast('Infrastructure data unavailable.'); }
}

/* ═══════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════ */
function mmToast(msg) {
  var t=document.createElement('div'); t.textContent=msg;
  Object.assign(t.style,{position:'fixed',bottom:'1.5rem',left:'50%',transform:'translateX(-50%)',
    background:'rgba(13,20,36,0.95)',color:'#94a3b8',padding:'0.65rem 1.2rem',borderRadius:'10px',
    fontSize:'0.78rem',zIndex:'99999',border:'1px solid rgba(255,255,255,0.08)',fontFamily:'Outfit,sans-serif',
    boxShadow:'0 8px 30px rgba(0,0,0,0.5)',backdropFilter:'blur(12px)'});
  document.body.appendChild(t);
  setTimeout(function(){t.remove();},3500);
}

/* ═══════════════════════════════════════════════════════
   UPGRADE: Load client projects from API (same auth as dashboard)
   ═══════════════════════════════════════════════════════ */
async function mmLoadClientProjects() {
  try {
    var token = localStorage.getItem('client_token');
    if (!token) return;
    var API = (window.CLIENT_API || 'http://localhost:5000/api');
    var r = await fetch(API + '/client/projects', {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    var d = await r.json();
    if (!d.success || !d.data.length) return;
    MM.clientProjects = d.data;
    mmRenderProjectPills();
  } catch(e) { /* silently ignore — market map works without this */ }
}

function mmRenderProjectPills() {
  var section = document.getElementById('mm-my-projects-section');
  var container = document.getElementById('mm-project-pills');
  if (!section || !container || !MM.clientProjects.length) return;
  section.style.display = '';

  // Project type → property type mapping for filter auto-apply
  var typeMap = { residential:'villa', commercial:'apartment', interior:'apartment', renovation:'apartment', landscape:'villa', other:'' };

  container.innerHTML = MM.clientProjects.slice(0, 4).map(function(p) {
    var budgetStr = '';
    if (p.budget && (p.budget.min || p.budget.max)) {
      var fmt = function(n) { return n >= 10000000 ? '₹'+(n/10000000).toFixed(1)+'Cr' : n >= 100000 ? '₹'+(n/100000).toFixed(0)+'L' : '₹'+n.toLocaleString('en-IN'); };
      budgetStr = (p.budget.min ? fmt(p.budget.min) : '') + (p.budget.max ? '–'+fmt(p.budget.max) : '');
    }
    var isActive = MM.activeProjectId === p._id;
    return '<div class="mm-project-pill' + (isActive ? ' active' : '') + '" onclick="mmActivateProject(\'' + p._id + '\')">'
      + '<i class="fas fa-folder"></i>'
      + '<span style="overflow:hidden;text-overflow:ellipsis;min-width:0">' + (p.title || 'Untitled') + '</span>'
      + (budgetStr ? '<span class="mm-project-pill-budget">' + budgetStr + '</span>' : '')
      + '</div>';
  }).join('');
}

function mmActivateProject(projectId) {
  if (MM.activeProjectId === projectId) {
    // Toggle off
    MM.activeProjectId = null;
    mmRenderProjectPills();
    mmApplyFilters();
    return;
  }
  MM.activeProjectId = projectId;
  mmRenderProjectPills();

  // Auto-apply filters based on project
  var proj = MM.clientProjects.find(function(p) { return p._id === projectId; });
  if (!proj) return;

  var typeMap = { residential:['villa','apartment'], commercial:['apartment','condo'], interior:['apartment','condo'], renovation:['villa','apartment'], landscape:['villa'], other:[] };
  var mappedTypes = typeMap[proj.projectType] || [];

  // Set budget-based price filter (convert INR max budget to $/m² estimate)
  // Rough heuristic: if client has a land size, use budget/landSqm to estimate $/m²
  if (proj.budget && proj.budget.max) {
    var landSqm = 150;
    if (proj.landSize && proj.landSize.value) {
      var lu = proj.landSize.unit || 'sqft';
      if (lu === 'sqft')  landSqm = proj.landSize.value * 0.0929;
      else if (lu === 'sqm')   landSqm = proj.landSize.value;
      else if (lu === 'cents') landSqm = proj.landSize.value * 40.47;
      else if (lu === 'acres') landSqm = proj.landSize.value * 4047;
    }
    // budget max in INR ÷ rate ÷ landSqm ÷ 1.8 overhead = estimated affordable $/m²
    var affordablePerM2 = Math.round((proj.budget.max / MM.INR_RATE) / landSqm / 1.8);
    // Clamp sensibly
    affordablePerM2 = Math.max(500, Math.min(25000, affordablePerM2));
    MM.filters.maxPriceM2 = affordablePerM2;
    var slider = document.getElementById('mm-price-slider');
    var sliderVal = document.getElementById('mm-price-val');
    if (slider) slider.value = mmUSDToSlider(affordablePerM2);
    if (sliderVal) sliderVal.textContent = mmFormatPrice(affordablePerM2);
  }

  if (mappedTypes.length) {
    MM.filters.types = mappedTypes;
    // Visually activate the chips
    document.querySelectorAll('.mm-chip[data-type]').forEach(function(chip) {
      chip.classList.toggle('active', mappedTypes.includes(chip.dataset.type));
    });
  }

  mmApplyFilters();
  mmToast('Filters matched to "' + (proj.title || 'project') + '"');
}

/* ═══════════════════════════════════════════════════════
   UPGRADE: Currency toggle binding
   ═══════════════════════════════════════════════════════ */
function mmBindCurrencyToggle() {
  document.querySelectorAll('.mm-currency-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (MM.currency === btn.dataset.currency) return;
      MM.currency = btn.dataset.currency;
      document.querySelectorAll('.mm-currency-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // Update price slider range & label to match currency
      var slider = document.getElementById('mm-price-slider');
      var sliderVal = document.getElementById('mm-price-val');
      var newMax = mmSliderMax();
      if (slider) {
        var currentUSD = mmSliderToUSD(parseFloat(slider.value));
        slider.max = newMax;
        slider.value = mmUSDToSlider(currentUSD);
      }
      if (sliderVal) sliderVal.textContent = mmFormatPrice(MM.filters.maxPriceM2);

      // Re-render everything with new currency
      mmApplyFilters();
      if (MM.map && MM.markersLayer) {
        mmRenderMarkers(MM.currentCities);
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════
   UPGRADE: Save city to project
   ═══════════════════════════════════════════════════════ */
function mmSaveCity(cityId) {
  var projectId = MM.activeProjectId;
  MM.savedCities[cityId] = projectId || 'standalone';
  try { localStorage.setItem('mm_saved_cities', JSON.stringify(MM.savedCities)); } catch(e) {}

  // Update the save button in the currently open popup
  var btn = document.getElementById('mm-save-' + cityId);
  if (btn) {
    btn.classList.add('saved');
    btn.innerHTML = '<i class="fas fa-bookmark"></i> Saved';
    btn.onclick = null;
  }

  var city = MM_CITIES.find(function(c) { return c.id === cityId; });
  var proj = MM.clientProjects.find(function(p) { return p._id === projectId; });
  var msg = city ? (city.flag + ' ' + city.city + ' saved') : 'City saved';
  if (proj) msg += ' to "' + proj.title + '"';
  mmToast(msg);
}

/* ═══════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════ */
window.mmInit          = mmInit;
window.mmFlyTo         = mmFlyTo;
window.mmFocusCity     = mmFocusCity;
window.mmSaveCity      = mmSaveCity;
window.mmActivateProject = mmActivateProject;
window.MM              = MM;