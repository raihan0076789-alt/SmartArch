/**
 * market-map-osm.js  v3 — Unified OSM + Leaflet view system
 *
 * KEY DESIGN:
 *  - ONE shared search bar (#mm-search-input in sidebar) — works for BOTH modes
 *  - Toggle swaps only the tile layer on the SAME MM.map Leaflet instance
 *  - ALL layers (Pins, Heat, Climate, Arch, Infra) work identically in OSM mode
 *  - OSM mode adds: Google Maps-style card pins, slide-in property panel, plot estimator
 *  - No second map, no duplicate search bar
 *
 * Depends on: market-map-patch.js, market-map.js
 */
'use strict';

/* ── STATE ─────────────────────────────────────────────────────────────── */
var OSM_VIEW = {
  active:       false,
  selectedCity: null,
  panelOpen:    false,
};

var _INR = function() { return window.MM ? window.MM.INR_RATE : 83; };

/* ── PRICE HELPERS ─────────────────────────────────────────────────────── */
function osmPricePerSqft(c) {
  return Math.round((c.priceM2 || 0) * _INR() / 10.764);
}
function osmFmtINR(v) {
  if (v >= 10000000) return '\u20B9' + (v/10000000).toFixed(2) + ' Cr';
  if (v >= 100000)   return '\u20B9' + (v/100000).toFixed(1) + ' L';
  if (v >= 1000)     return '\u20B9' + (v/1000).toFixed(1) + 'K';
  return '\u20B9' + Math.round(v);
}

/* ── TOGGLE ────────────────────────────────────────────────────────────── */
window.mmToggleOSMView = function() {
  OSM_VIEW.active = !OSM_VIEW.active;
  var badge    = document.getElementById('osm-mode-badge');
  var toggleEl = document.getElementById('osm-toggle-input');
  var wrap     = document.querySelector('.mm-map-wrap');

  if (OSM_VIEW.active) {
    osmSwapTile('osm');
    osmReRenderPins();
    if (badge)    { badge.textContent = 'OSM'; badge.className = 'osm-mode-badge osm-badge-osm'; }
    if (toggleEl) toggleEl.checked = true;
    if (wrap)     wrap.classList.add('osm-active');
  } else {
    osmSwapTile('dark');
    osmReRenderPins();
    if (badge)    { badge.textContent = 'Dark'; badge.className = 'osm-mode-badge osm-badge-dark'; }
    if (toggleEl) toggleEl.checked = false;
    if (wrap)     wrap.classList.remove('osm-active');
    window.osmClosePanel();
  }

  var thumbDark = document.querySelector('.osm-thumb-dark');
  var thumbOSM  = document.querySelector('.osm-thumb-osm');
  if (thumbDark && thumbOSM) {
    thumbDark.style.display = OSM_VIEW.active ? 'none' : '';
    thumbOSM.style.display  = OSM_VIEW.active ? ''     : 'none';
  }
};

function osmSwapTile(mode) {
  if (!window.MM || !window.MM.map || !window.L) return;
  if (window.MM_BASE_TILE_LAYER) window.MM.map.removeLayer(window.MM_BASE_TILE_LAYER);
  var bm = (window.MM_BASEMAPS && window.MM_BASEMAPS[mode]);
  var url, opts;
  if (mode === 'osm') {
    url  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    opts = { attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', subdomains:'abc', maxZoom:19 };
  } else {
    url  = bm ? bm.url  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    opts = bm ? bm.opts : { attribution:'&copy; OpenStreetMap &copy; CARTO', subdomains:'abcd', maxZoom:19 };
  }
  window.MM_BASE_TILE_LAYER = window.L.tileLayer(url, opts);
  window.MM_BASE_TILE_LAYER.addTo(window.MM.map);
  if (window.MM_BASE_TILE_LAYER.bringToBack) window.MM_BASE_TILE_LAYER.bringToBack();

  /* Sync view-picker highlight */
  var viewId = (mode === 'osm') ? 'osm' : 'dark';
  document.querySelectorAll('.mm-view-btn').forEach(function(b){ b.classList.remove('active'); });
  var vb = document.querySelector('.mm-view-btn[data-view="'+viewId+'"]');
  if (vb) vb.classList.add('active');
  var lbl = document.getElementById('mm-active-view-label');
  if (lbl) lbl.textContent = mode === 'osm' ? 'OSM' : 'Dark';
}

/* Re-render the current active layer with the correct pin style */
function osmReRenderPins() {
  if (!window.MM) return;
  var layer = (window.MM.filters && window.MM.filters.activeLayer) || 'markers';
  if (layer !== 'markers') {
    /* Non-marker layers look fine on both tiles — just invalidate */
    if (window.MM.map) window.MM.map.invalidateSize();
    return;
  }
  osmRenderMarkers(window.MM.currentCities || []);
}

/* ── MARKER RENDERING (unified for both modes) ─────────────────────────── */
function osmRenderMarkers(cities) {
  if (!window.MM || !window.MM.markersLayer || !window.L) return;
  var L = window.L;
  var isOSM = OSM_VIEW.active;

  if (window.MM.markersLayer.clearLayers) window.MM.markersLayer.clearLayers();

  var markers = [];

  cities.forEach(function(c) {
    var score     = typeof mmAffordScore === 'function' ? mmAffordScore(c) : 50;
    var col       = c.tier==='A'?'#22c55e': c.tier==='B'?'#0ea5e9': c.tier==='C'?'#f59e0b':'#ef4444';
    var sqftPrice = osmPricePerSqft(c);
    var priceLbl  = sqftPrice >= 1000 ? (sqftPrice/1000).toFixed(1)+'K' : String(sqftPrice);

    if (c.isIndiaPoint) {
      var dot;
      if (isOSM) {
        dot = L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className:'',
            iconSize:[52,20], iconAnchor:[26,20],
            html:'<div style="background:'+col+';color:#fff;font-size:8.5px;font-weight:800;'+
                 'padding:2px 5px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.7);'+
                 'white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,0.2);font-family:Outfit,sans-serif;">'+
                 '\u20B9'+priceLbl+'/sqft</div>'
          })
        });
      } else {
        dot = L.circleMarker([c.lat, c.lng], {
          radius:5, fillColor:col,
          color:'rgba(0,0,0,0.3)', weight:0.5, fillOpacity:0.82
        });
      }
      dot.bindPopup(osmMiniPopup(c), {maxWidth:240, className:'mm-popup-wrapper', closeButton:true});
      dot.on('click', function(e) {
        if (L.DomEvent) L.DomEvent.stopPropagation(e);
        osmOpenPanel(c);
      });
      markers.push(dot);
      return;
    }

    /* Named city */
    var m;
    if (isOSM) {
      m = L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className:'',
          iconSize:[62,72], iconAnchor:[31,70], popupAnchor:[0,-72],
          html: osmPinHTML(c, col, priceLbl)
        })
      });
      m.on('click', function(e) {
        if (L.DomEvent) L.DomEvent.stopPropagation(e);
        osmOpenPanel(c);
        if (window.MM && window.MM.map) window.MM.map.panTo([c.lat, c.lng]);
        if (typeof mmHighlightResult === 'function') mmHighlightResult(c.id);
      });
    } else {
      var sz = Math.min(30 + Math.round(score/8), 44);
      m = L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className:'',
          iconSize:[sz,sz], iconAnchor:[sz/2,sz], popupAnchor:[0,-(sz+4)],
          html:'<div class="mm-marker-icon mm-marker-'+c.tier+'" style="width:'+sz+'px;height:'+sz+'px;">'+
               '<div class="mm-marker-inner">'+c.flag+'</div></div>'
        })
      });
      var popup = typeof mmBuildPopup === 'function' ? mmBuildPopup(c, score, 0) : osmMiniPopup(c);
      m.bindPopup(popup, {maxWidth:300, minWidth:280, className:'mm-popup-wrapper', closeButton:true});
      m.on('click', function() { if (typeof mmHighlightResult === 'function') mmHighlightResult(c.id); });
    }
    markers.push(m);
  });

  if (window.MM.usingClusters && window.MM.markersLayer.addLayers) {
    window.MM.markersLayer.addLayers(markers);
  } else {
    markers.forEach(function(mk){ mk.addTo(window.MM.markersLayer); });
  }
}

function osmMiniPopup(c) {
  return '<div class="mm-popup" style="min-width:190px">'+
    '<div class="mm-popup-head">'+
      '<div class="mm-popup-flag">'+c.flag+'</div>'+
      '<div class="mm-popup-city" style="font-size:.8rem">'+c.city.split(' \u00B7 ')[0]+'</div>'+
      '<div class="mm-popup-country">'+(c.state||c.country)+' \u00B7 '+osmFmtINR(Math.round(c.priceM2*_INR()))+'/m\u00B2</div>'+
    '</div>'+
    '<div class="mm-popup-body">'+
      '<div class="mm-popup-grid" style="grid-template-columns:1fr 1fr">'+
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">\u20B9/sqft</div><div class="mm-popup-kv-val">'+osmPricePerSqft(c).toLocaleString('en-IN')+'</div></div>'+
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Yield</div><div class="mm-popup-kv-val">'+c.rentYield.toFixed(1)+'%</div></div>'+
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Growth</div><div class="mm-popup-kv-val" style="color:#10b981">+'+c.yoyGrowth.toFixed(1)+'%</div></div>'+
        '<div class="mm-popup-kv"><div class="mm-popup-kv-label">Safety</div><div class="mm-popup-kv-val">'+c.safetyIdx+'/100</div></div>'+
      '</div>'+
    '</div></div>';
}

function osmPinHTML(c, col, priceLbl) {
  return '<div class="osm-pin-wrap">'+
    '<div class="osm-pin-card" style="border-color:'+col+'">'+
      '<span class="osm-pin-flag">'+c.flag+'</span>'+
      '<div class="osm-pin-info">'+
        '<div class="osm-pin-city">'+c.city+'</div>'+
        '<div class="osm-pin-price" style="color:'+col+'">\u20B9'+priceLbl+'/sqft</div>'+
      '</div>'+
    '</div>'+
    '<div class="osm-pin-tail" style="border-top-color:'+col+'"></div>'+
  '</div>';
}

/* ── PATCH mmRenderMarkers so OSM mode intercepts it ───────────────────── */
/* We wait for mmRenderMarkers to exist, then wrap it */
(function patchRender() {
  function tryPatch() {
    if (typeof mmRenderMarkers !== 'function') { setTimeout(tryPatch, 80); return; }
    var _orig = mmRenderMarkers;
    /* Replace via the module's own reference by reassigning the window property */
    window._mm_orig_renderMarkers = _orig;
  }
  tryPatch();
})();

/* Patch mmApplyFilters so OSM re-renders with card pins after every filter change */
(function patchApply() {
  function tryPatch() {
    if (typeof mmApplyFilters !== 'function') { setTimeout(tryPatch, 80); return; }
    var _orig = mmApplyFilters;
    window.mmApplyFilters = function() {
      _orig.apply(this, arguments);
      if (OSM_VIEW.active && window.MM && window.MM.currentCities) {
        setTimeout(function() { osmRenderMarkers(window.MM.currentCities); }, 30);
      }
    };
  }
  tryPatch();
})();

/* Patch mmSwitchLayer so OSM re-renders pins after layer switch */
(function patchLayer() {
  function tryPatch() {
    if (typeof mmSwitchLayer !== 'function') { setTimeout(tryPatch, 80); return; }
    var _orig = mmSwitchLayer;
    window.mmSwitchLayer = function(layer) {
      _orig.apply(this, arguments);
      if (OSM_VIEW.active && layer === 'markers' && window.MM && window.MM.currentCities) {
        setTimeout(function() { osmRenderMarkers(window.MM.currentCities); }, 30);
      }
    };
  }
  tryPatch();
})();

/* ── UNIFIED SEARCH EXTENSION ──────────────────────────────────────────── */
/* The sidebar #mm-search-input already handles both modes.
   We extend it: when OSM is active and a city result is clicked,
   also open the property panel. */
function osmExtendSearch() {
  var results = document.getElementById('mm-search-results');
  if (!results || results._osmPatched) return;
  results._osmPatched = true;

  results.addEventListener('click', function(e) {
    if (!OSM_VIEW.active) return;
    var item = e.target.closest('.mm-search-result-item');
    if (!item) return;
    var onclick = item.getAttribute('onclick') || '';
    var m = onclick.match(/mmFocusCity\((\d+)\)/);
    if (m) {
      var city = (window.MM_CITIES || []).find(function(c){ return c.id === parseInt(m[1]); });
      if (city) { setTimeout(function(){ osmOpenPanel(city); }, 350); }
    }
  }, true);
}

/* ── PROPERTY PANEL ────────────────────────────────────────────────────── */
function osmOpenPanel(city) {
  OSM_VIEW.selectedCity = city;
  var panel = document.getElementById('osm-panel');
  if (!panel) return;

  var inrM2     = Math.round(city.priceM2 * _INR());
  var sqftPrice = osmPricePerSqft(city);
  var col       = {A:'#22c55e',B:'#0ea5e9',C:'#f59e0b',D:'#ef4444'}[city.tier] || '#94a3b8';
  var tierLbl   = {A:'Best Value',B:'Affordable',C:'Moderate',D:'Premium'}[city.tier] || '';
  var yoyCol    = city.yoyGrowth >= 0 ? '#22c55e' : '#ef4444';
  var afScore   = typeof mmAffordScore === 'function' ? mmAffordScore(city)  : '—';
  var archSc    = typeof mmArchScore   === 'function' ? mmArchScore(city)    : '—';

  var plotRows = [600,1200,2400,4800].map(function(sqft) {
    var sqm  = sqft * 0.0929;
    var land = Math.round(city.priceM2 * sqm * _INR());
    var cons = Math.round((city.constructIdx||5) * 800 * sqm * 1.2 * _INR() / 10);
    return '<tr class="osm-tr">'+
      '<td class="osm-td"><b>'+sqft.toLocaleString('en-IN')+'</b> sqft<br><span class="osm-td-sub">'+Math.round(sqm)+' m\u00B2</span></td>'+
      '<td class="osm-td">'+osmFmtINR(land)+'</td>'+
      '<td class="osm-td">'+osmFmtINR(cons)+'</td>'+
      '<td class="osm-td osm-td-total">'+osmFmtINR(land+cons)+'</td>'+
    '</tr>';
  }).join('');

  var tagCls = {low:'green',medium:'amber',high:'amber',extreme:'red'};
  var airCls = {good:'green',moderate:'amber',poor:'amber',hazardous:'red'};
  var tags = [
    city.electricity ? '<span class="osm-tag osm-tag-green">\u26A1 Grid</span>'      : '<span class="osm-tag osm-tag-red">\u26A1 No Grid</span>',
    city.transport   ? '<span class="osm-tag osm-tag-blue">\uD83D\uDE8C Transit</span>': '<span class="osm-tag osm-tag-gray">\uD83D\uDE97 Car Only</span>',
    city.schools     ? '<span class="osm-tag osm-tag-purple">\uD83C\uDFEB Schools</span>' : '',
    '<span class="osm-tag osm-tag-'+(tagCls[city.climateRisk]||'gray')+'">\uD83C\uDF21 '+(city.climateRisk||'').charAt(0).toUpperCase()+(city.climateRisk||'').slice(1)+' Risk</span>',
    '<span class="osm-tag osm-tag-'+(airCls[city.airQuality]||'gray')+'">\uD83D\uDCA8 '+(city.airQuality||'').charAt(0).toUpperCase()+(city.airQuality||'').slice(1)+' Air</span>',
  ].filter(Boolean).join('');

  function bar(pct, c2) { return '<div class="osm-bar-wrap"><div class="osm-bar" style="width:'+Math.min(100,pct)+'%;background:'+c2+'"></div></div>'; }

  panel.innerHTML =
    '<div class="osm-panel-header">'+
      '<span class="osm-panel-flag">'+city.flag+'</span>'+
      '<div class="osm-panel-title-wrap">'+
        '<div class="osm-panel-city">'+city.city+'</div>'+
        '<div class="osm-panel-country">'+city.country+(city.state?' \u00B7 '+city.state:'')+'</div>'+
      '</div>'+
      '<span class="osm-panel-tier" style="background:'+col+'1a;color:'+col+';border:1px solid '+col+'44">'+tierLbl+'</span>'+
      '<button class="osm-panel-close" onclick="osmClosePanel()">✕</button>'+
    '</div>'+
    '<div class="osm-price-hero">'+
      '<div class="osm-price-block"><div class="osm-price-big" style="color:'+col+'">\u20B9'+sqftPrice.toLocaleString('en-IN')+'</div><div class="osm-price-lbl">per sqft</div></div>'+
      '<div class="osm-price-sep"></div>'+
      '<div class="osm-price-block"><div class="osm-price-big">'+osmFmtINR(inrM2)+'</div><div class="osm-price-lbl">per m\u00B2</div></div>'+
      '<div class="osm-price-sep"></div>'+
      '<div class="osm-price-block"><div class="osm-price-big" style="color:'+yoyCol+'">'+(city.yoyGrowth>=0?'+':'')+city.yoyGrowth.toFixed(1)+'%</div><div class="osm-price-lbl">YoY Growth</div></div>'+
    '</div>'+
    '<div class="osm-scores-row">'+
      '<div class="osm-score-pill"><span class="osm-score-num" style="color:'+col+'">'+afScore+'</span><span class="osm-score-lbl">Afford</span></div>'+
      '<div class="osm-score-pill"><span class="osm-score-num" style="color:#a78bfa">'+archSc+'</span><span class="osm-score-lbl">Arch</span></div>'+
      '<div class="osm-score-pill"><span class="osm-score-num">'+city.rentYield.toFixed(1)+'%</span><span class="osm-score-lbl">Yield</span></div>'+
      '<div class="osm-score-pill"><span class="osm-score-num">'+city.safetyIdx+'</span><span class="osm-score-lbl">Safety</span></div>'+
    '</div>'+
    '<div class="osm-section">'+
      '<div class="osm-section-hd">\uD83D\uDCCF Plot Value Estimator</div>'+
      '<div class="osm-table-wrap"><table class="osm-table"><thead><tr>'+
        '<th class="osm-th">Size</th><th class="osm-th">Land</th><th class="osm-th">Build</th><th class="osm-th">Total</th>'+
      '</tr></thead><tbody>'+plotRows+'</tbody></table></div>'+
      '<div class="osm-calc-row">'+
        '<input id="osm-sqft-input" class="osm-calc-input" type="number" placeholder="Custom sqft\u2026" min="100" max="500000">'+
        '<button class="osm-calc-btn" onclick="osmCalcCustom()">Calc</button>'+
      '</div>'+
      '<div id="osm-calc-result" style="display:none" class="osm-calc-result"></div>'+
    '</div>'+
    '<div class="osm-section">'+
      '<div class="osm-section-hd">\uD83D\uDCCA Market Metrics</div>'+
      '<div class="osm-metrics-grid">'+
        '<div class="osm-metric"><div class="osm-metric-lbl">Rental Yield</div><div class="osm-metric-val">'+city.rentYield.toFixed(1)+'%</div>'+bar(city.rentYield/12*100,'#0ea5e9')+'</div>'+
        '<div class="osm-metric"><div class="osm-metric-lbl">Safety</div><div class="osm-metric-val">'+city.safetyIdx+'/100</div>'+bar(city.safetyIdx,'#22c55e')+'</div>'+
        '<div class="osm-metric"><div class="osm-metric-lbl">Permit Ease</div><div class="osm-metric-val">'+(city.permitEase||0)+'/5</div>'+bar((city.permitEase||0)/5*100,'#a78bfa')+'</div>'+
        '<div class="osm-metric"><div class="osm-metric-lbl">Arch/100k</div><div class="osm-metric-val">'+(city.architectPer100k||0)+'</div>'+bar((city.architectPer100k||0)/60*100,'#f59e0b')+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="osm-section"><div class="osm-section-hd">\uD83C\uDFD7 Infrastructure</div><div class="osm-tags-wrap">'+tags+'</div></div>'+
    '<div class="osm-actions">'+
      '<button class="osm-act-btn osm-act-primary" onclick="osmZoomToCity()">\uD83D\uDD0D Zoom In</button>'+
      '<button class="osm-act-btn osm-act-secondary" onclick="osmOpenOSM()">\uD83D\uDDFA OSM Map</button>'+
    '</div>';

  panel.classList.add('open');
  OSM_VIEW.panelOpen = true;
}

window.osmClosePanel = function() {
  var p = document.getElementById('osm-panel');
  if (p) p.classList.remove('open');
  OSM_VIEW.selectedCity = null;
  OSM_VIEW.panelOpen = false;
};

window.osmCalcCustom = function() {
  var inp = document.getElementById('osm-sqft-input');
  var res = document.getElementById('osm-calc-result');
  if (!inp || !res || !OSM_VIEW.selectedCity) return;
  var sqft = parseFloat(inp.value);
  if (isNaN(sqft) || sqft < 10) { res.textContent = 'Enter a valid sqft value.'; res.style.display='block'; return; }
  var c    = OSM_VIEW.selectedCity;
  var sqm  = sqft * 0.0929;
  var land = Math.round(c.priceM2 * sqm * _INR());
  var cons = Math.round((c.constructIdx||5) * 800 * sqm * 1.2 * _INR() / 10);
  res.innerHTML = '<strong>'+sqft.toLocaleString('en-IN')+' sqft</strong> in '+c.city+'<br>'+
    'Land: <b>'+osmFmtINR(land)+'</b> \u00B7 Build: <b>'+osmFmtINR(cons)+'</b><br>'+
    '<span style="color:#0ea5e9;font-weight:800;font-size:14px">Total \u2248 '+osmFmtINR(land+cons)+'</span>';
  res.style.display = 'block';
};

window.osmZoomToCity = function() {
  if (!OSM_VIEW.selectedCity || !window.MM || !window.MM.map) return;
  window.MM.map.flyTo([OSM_VIEW.selectedCity.lat, OSM_VIEW.selectedCity.lng], 14, {duration:1.4});
};
window.osmOpenOSM = function() {
  if (!OSM_VIEW.selectedCity) return;
  var c = OSM_VIEW.selectedCity;
  window.open('https://www.openstreetmap.org/#map=14/'+c.lat+'/'+c.lng, '_blank');
};

/* Hook map click to close panel */
(function hookMapClick() {
  function tryHook() {
    if (!window.MM || !window.MM.map) { setTimeout(tryHook, 200); return; }
    window.MM.map.on('click', function() { if (OSM_VIEW.panelOpen) window.osmClosePanel(); });
  }
  tryHook();
})();

/* ── INJECT UI ─────────────────────────────────────────────────────────── */
(function osmInjectUI() {
  osmInjectCSS();

  function inject() {
    /* 1. Topbar toggle */
    var topbar = document.querySelector('.mm-map-topbar');
    if (topbar && !document.getElementById('osm-toggle-wrap')) {
      var tw = document.createElement('div');
      tw.id = 'osm-toggle-wrap';
      tw.className = 'osm-toggle-wrap';
      tw.innerHTML =
        '<span id="osm-mode-badge" class="osm-mode-badge osm-badge-dark">Dark</span>'+
        '<label class="osm-toggle-label" title="Toggle OSM street map view">'+
          '<input type="checkbox" id="osm-toggle-input" onchange="mmToggleOSMView()">'+
          '<span class="osm-toggle-track">'+
            '<span class="osm-toggle-thumb">'+
              '<span class="osm-thumb-icon osm-thumb-dark">\uD83C\uDF19</span>'+
              '<span class="osm-thumb-icon osm-thumb-osm" style="display:none">\uD83D\uDDFA</span>'+
            '</span>'+
          '</span>'+
          '<span class="osm-toggle-text">OSM</span>'+
        '</label>';
      topbar.appendChild(tw);
    }

    /* 2. Property panel */
    var mapWrap = document.getElementById('mm-map-wrap') || document.querySelector('.mm-map-wrap');
    if (mapWrap && !document.getElementById('osm-panel')) {
      var panel = document.createElement('div');
      panel.id = 'osm-panel'; panel.className = 'osm-panel';
      mapWrap.appendChild(panel);
    }

    /* 3. Legend */
    if (mapWrap && !document.getElementById('osm-legend')) {
      var leg = document.createElement('div');
      leg.id = 'osm-legend'; leg.className = 'osm-legend';
      leg.innerHTML =
        '<div class="osm-legend-title">\u20B9/sqft \u00B7 Plot Value</div>'+
        '<div class="osm-legend-items">'+
          '<span class="osm-leg-dot" style="background:#22c55e"></span><span class="osm-leg-lbl">Best (A)</span>'+
          '<span class="osm-leg-dot" style="background:#0ea5e9"></span><span class="osm-leg-lbl">Afford (B)</span>'+
          '<span class="osm-leg-dot" style="background:#f59e0b"></span><span class="osm-leg-lbl">Mid (C)</span>'+
          '<span class="osm-leg-dot" style="background:#ef4444"></span><span class="osm-leg-lbl">Premium (D)</span>'+
        '</div>';
      mapWrap.appendChild(leg);
    }

    /* 4. Extend shared search to open panel in OSM mode */
    osmExtendSearch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();

/* ── CSS ───────────────────────────────────────────────────────────────── */
function osmInjectCSS() {
  if (document.getElementById('osm-styles')) return;
  var s = document.createElement('style');
  s.id = 'osm-styles';
  s.textContent = [
'.osm-pin-wrap{display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.26));transition:transform .15s}',
'.osm-pin-wrap:hover{transform:scale(1.08) translateY(-3px)}',
'.osm-pin-card{background:#fff;border:2.5px solid #22c55e;border-radius:10px;padding:4px 8px;display:flex;align-items:center;gap:5px;min-width:52px;box-shadow:0 2px 10px rgba(0,0,0,0.16);white-space:nowrap}',
'.osm-pin-flag{font-size:13px;line-height:1}',
'.osm-pin-city{font-size:9.5px;font-weight:700;color:#1e293b;line-height:1.15}',
'.osm-pin-price{font-size:9px;font-weight:800;line-height:1.1}',
'.osm-pin-tail{width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #22c55e;margin-top:-1px}',
'.osm-panel{position:absolute;top:0;right:0;width:360px;height:100%;background:#fff;z-index:9100;box-shadow:-6px 0 28px rgba(0,0,0,0.14);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.34,1.2,.64,1);overflow-y:auto;font-family:Outfit,system-ui,sans-serif;scrollbar-width:thin;scrollbar-color:#e2e8f0 transparent}',
'.osm-panel.open{transform:translateX(0)}',
'.osm-panel-header{display:flex;align-items:flex-start;gap:9px;padding:14px 14px 10px;border-bottom:1px solid #f1f5f9;position:sticky;top:0;background:#fff;z-index:10}',
'.osm-panel-flag{font-size:26px;line-height:1;flex-shrink:0}',
'.osm-panel-city{font-size:16px;font-weight:800;color:#0f172a;line-height:1.1}',
'.osm-panel-country{font-size:11px;color:#64748b;margin-top:2px}',
'.osm-panel-title-wrap{flex:1;min-width:0}',
'.osm-panel-tier{font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0;margin-top:2px;white-space:nowrap}',
'.osm-panel-close{background:#f1f5f9;border:none;border-radius:50%;width:25px;height:25px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;color:#64748b;flex-shrink:0;transition:background .15s}',
'.osm-panel-close:hover{background:#e2e8f0;color:#0f172a}',
'.osm-price-hero{display:flex;align-items:center;padding:13px 14px;background:linear-gradient(135deg,#f8faff,#f0f9ff);border-bottom:1px solid #e2e8f0}',
'.osm-price-block{flex:1;text-align:center}',
'.osm-price-big{font-size:18px;font-weight:900;color:#0f172a;line-height:1}',
'.osm-price-lbl{font-size:9px;color:#94a3b8;margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}',
'.osm-price-sep{width:1px;height:34px;background:#e2e8f0;flex-shrink:0}',
'.osm-scores-row{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #f1f5f9}',
'.osm-score-pill{display:flex;flex-direction:column;align-items:center;padding:9px 4px;border-right:1px solid #f1f5f9}',
'.osm-score-pill:last-child{border-right:none}',
'.osm-score-num{font-size:14px;font-weight:800;color:#0f172a;line-height:1}',
'.osm-score-lbl{font-size:8.5px;color:#94a3b8;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;text-align:center}',
'.osm-section{padding:12px 14px;border-bottom:1px solid #f1f5f9}',
'.osm-section-hd{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#64748b;margin-bottom:8px}',
'.osm-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px}',
'.osm-table{width:100%;border-collapse:collapse;font-size:11.5px}',
'.osm-th{background:#f8fafc;padding:6px 9px;text-align:left;font-weight:700;color:#475569;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e2e8f0}',
'.osm-td{padding:7px 9px;color:#334155;border-bottom:1px solid #f1f5f9;font-weight:500}',
'.osm-tr:last-child .osm-td{border-bottom:none}',
'.osm-tr:hover .osm-td{background:#f8fafc}',
'.osm-td-total{font-weight:800;color:#0f172a}',
'.osm-td-sub{font-size:9px;color:#94a3b8}',
'.osm-calc-row{display:flex;gap:7px}',
'.osm-calc-input{flex:1;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 9px;font-size:12.5px;font-family:Outfit,sans-serif;color:#0f172a;outline:none;transition:border-color .15s}',
'.osm-calc-input:focus{border-color:#0ea5e9}',
'.osm-calc-btn{background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;transition:background .15s;white-space:nowrap}',
'.osm-calc-btn:hover{background:#0284c7}',
'.osm-calc-result{margin-top:7px;padding:9px 11px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:11.5px;color:#0369a1;line-height:1.6}',
'.osm-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
'.osm-metric-lbl{font-size:9px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}',
'.osm-metric-val{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:3px}',
'.osm-bar-wrap{height:4px;background:#f1f5f9;border-radius:3px;overflow:hidden}',
'.osm-bar{height:100%;border-radius:3px;transition:width .6s ease}',
'.osm-tags-wrap{display:flex;flex-wrap:wrap;gap:5px}',
'.osm-tag{font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px}',
'.osm-tag-green{background:#dcfce7;color:#15803d}',
'.osm-tag-blue{background:#dbeafe;color:#1d4ed8}',
'.osm-tag-red{background:#fee2e2;color:#dc2626}',
'.osm-tag-amber{background:#fef3c7;color:#d97706}',
'.osm-tag-purple{background:#ede9fe;color:#7c3aed}',
'.osm-tag-gray{background:#f1f5f9;color:#64748b}',
'.osm-actions{padding:12px 14px;display:flex;gap:7px}',
'.osm-act-btn{flex:1;padding:9px;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;border:none;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s}',
'.osm-act-primary{background:#0ea5e9;color:#fff}',
'.osm-act-primary:hover{background:#0284c7}',
'.osm-act-secondary{background:#f1f5f9;color:#334155}',
'.osm-act-secondary:hover{background:#e2e8f0}',
'.osm-legend{position:absolute;bottom:36px;left:10px;z-index:8000;background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);border-radius:10px;padding:7px 11px;box-shadow:0 2px 10px rgba(0,0,0,0.12);display:none;font-family:Outfit,sans-serif;pointer-events:none}',
'.osm-legend-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:5px}',
'.osm-legend-items{display:flex;flex-wrap:wrap;gap:5px 9px;align-items:center}',
'.osm-leg-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex-shrink:0}',
'.osm-leg-lbl{font-size:10px;color:#334155;font-weight:500}',
'.osm-active .osm-legend{display:block!important}',
'.osm-toggle-wrap{display:flex;align-items:center;gap:7px;background:rgba(6,10,18,0.88);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:5px 10px;flex-shrink:0}',
'.osm-mode-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;letter-spacing:.02em;border:1px solid transparent}',
'.osm-badge-dark{background:rgba(0,212,200,0.1);color:#00d4c8;border-color:rgba(0,212,200,0.25)}',
'.osm-badge-osm{background:rgba(14,165,233,0.15);color:#38bdf8;border-color:rgba(56,189,248,0.35)}',
'.osm-toggle-label{display:flex;align-items:center;gap:6px;cursor:pointer}',
'.osm-toggle-label input{display:none}',
'.osm-toggle-track{width:40px;height:21px;border-radius:11px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);position:relative;transition:background .2s}',
'.osm-toggle-label input:checked + .osm-toggle-track{background:rgba(14,165,233,0.35);border-color:rgba(14,165,233,0.5)}',
'.osm-toggle-thumb{position:absolute;width:17px;height:17px;border-radius:50%;background:#fff;top:1px;left:1px;transition:transform .22s cubic-bezier(.34,1.56,.64,1);display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 5px rgba(0,0,0,0.3)}',
'.osm-toggle-label input:checked + .osm-toggle-track .osm-toggle-thumb{transform:translateX(19px)}',
'.osm-toggle-text{font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.04em}',
'.osm-toggle-label input:checked ~ .osm-toggle-text{color:#38bdf8}',
'@media(max-width:640px){.osm-panel{width:100%;height:68%;top:auto;bottom:0;transform:translateY(100%);border-radius:16px 16px 0 0}.osm-panel.open{transform:translateY(0)}}'
  ].join('\n');
  document.head.appendChild(s);
}