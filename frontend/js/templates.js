// ============================================================
//  HOUSE ARCHITECT — Template System
//  Generates smart 2D floor-plan layouts from template configs
// ============================================================

(function () {
  'use strict';

  // ── Template defaults per style ──────────────────────────
  const TEMPLATE_DEFAULTS = {
    minimalist: {
      label: 'Minimalist',
      icon: 'fas fa-square',
      accent: '#c8c8c8',
      bg: 'linear-gradient(135deg,#f5f5f5 30%,#e0e0e0 100%)',
      description: 'Clean lines, open spaces, minimal walls. Large living areas and a simple, functional layout.',
      defaults: {
        width: 18, depth: 14, floors: 1, floorHeight: 3.0, roofType: 'flat',
        living: 1, bedroom: 2, bathroom: 1, kitchen: 1, dining: 0,
        office: 0, garage: 0, balcony: 1, stairs: false
      },
      roomSizing: {
        living: { w: 8, d: 6 }, bedroom: { w: 4, d: 4.5 },
        bathroom: { w: 2.5, d: 3 }, kitchen: { w: 5, d: 4 },
        dining: { w: 4, d: 4 }, office: { w: 3.5, d: 3 },
        garage: { w: 5.5, d: 6 }, balcony: { w: 4, d: 2 },
        stairs: { w: 3, d: 3 }
      }
    },
    luxury: {
      label: 'Luxury',
      icon: 'fas fa-gem',
      accent: '#c9a84c',
      bg: 'linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 60%,#c9a84c 100%)',
      description: 'Grand rooms, master suites, formal dining. Opulent proportions with premium circulation spaces.',
      defaults: {
        width: 28, depth: 22, floors: 2, floorHeight: 3.2, roofType: 'hip',
        living: 1, bedroom: 4, bathroom: 3, kitchen: 1, dining: 1,
        office: 1, garage: 1, balcony: 2, stairs: true
      },
      roomSizing: {
        living: { w: 9, d: 7 }, bedroom: { w: 5.5, d: 5 },
        bathroom: { w: 3.5, d: 3.5 }, kitchen: { w: 6, d: 5 },
        dining: { w: 6, d: 5 }, office: { w: 5, d: 4.5 },
        garage: { w: 7, d: 7 }, balcony: { w: 5, d: 2.5 },
        stairs: { w: 3.5, d: 3.5 }
      }
    },
    traditional: {
      label: 'Traditional',
      icon: 'fas fa-home',
      accent: '#c8a87a',
      bg: 'linear-gradient(135deg,#6b3a2a 0%,#9c6644 50%,#c8a87a 100%)',
      description: 'Warm, symmetrical layout with classic room proportions. Family-centric with a cosy, lived-in feel.',
      defaults: {
        width: 22, depth: 16, floors: 2, floorHeight: 2.8, roofType: 'pitched',
        living: 1, bedroom: 3, bathroom: 2, kitchen: 1, dining: 1,
        office: 0, garage: 1, balcony: 1, stairs: true
      },
      roomSizing: {
        living: { w: 7, d: 6 }, bedroom: { w: 4.5, d: 4.5 },
        bathroom: { w: 3, d: 3 }, kitchen: { w: 5, d: 4.5 },
        dining: { w: 5, d: 4.5 }, office: { w: 4, d: 3.5 },
        garage: { w: 6, d: 6 }, balcony: { w: 4, d: 2 },
        stairs: { w: 3, d: 3 }
      }
    }
  };

  let selectedTemplateStyle = 'minimalist';

  // ── Open modal ───────────────────────────────────────────
  function openTemplateModal() {
    const modal = document.getElementById('templateModal');
    if (!modal) return;
    modal.classList.add('active');
    selectTemplateStyle(selectedTemplateStyle, false);
  }

  // ── Close modal ──────────────────────────────────────────
  function closeTemplateModal() {
    const modal = document.getElementById('templateModal');
    if (modal) modal.classList.remove('active');
  }

  // ── Select a style tab ───────────────────────────────────
  function selectTemplateStyle(style, populate) {
    selectedTemplateStyle = style;
    const tmpl = TEMPLATE_DEFAULTS[style];
    if (!tmpl) return;

    document.querySelectorAll('.tmpl-style-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.style === style);
    });

    const descCard = document.getElementById('tmplStyleDesc');
    if (descCard) {
      descCard.style.background = tmpl.bg;
      descCard.style.setProperty('--tmpl-accent', tmpl.accent);
      descCard.querySelector('.tmpl-desc-title').textContent = tmpl.label;
      descCard.querySelector('.tmpl-desc-body').textContent = tmpl.description;
    }

    populateTemplateForm(style);
  }

  // ── Populate form with style defaults ───────────────────
  function populateTemplateForm(style) {
    const tmpl = TEMPLATE_DEFAULTS[style];
    const d = tmpl.defaults;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };

    setVal('tmplWidth', d.width);
    setVal('tmplDepth', d.depth);
    setVal('tmplFloors', d.floors);
    setVal('tmplFloorHeight', d.floorHeight);
    setVal('tmplRoofType', d.roofType);
    setVal('tmplLiving', d.living);
    setVal('tmplBedroom', d.bedroom);
    setVal('tmplBathroom', d.bathroom);
    setVal('tmplKitchen', d.kitchen);
    setVal('tmplDining', d.dining);
    setVal('tmplOffice', d.office);
    setVal('tmplGarage', d.garage);
    setVal('tmplBalcony', d.balcony);
    setChk('tmplStairs', d.stairs);

    updateTemplatePreview();
  }

  // ── Live preview stats ───────────────────────────────────
  function updateTemplatePreview() {
    const g  = id => parseInt(document.getElementById(id)?.value  || 0) || 0;
    const gf = id => parseFloat(document.getElementById(id)?.value || 0) || 0;
    const gc = id => document.getElementById(id)?.checked;

    const houseW = gf('tmplWidth'), houseD = gf('tmplDepth'), floors = g('tmplFloors');
    const stairsOn = gc('tmplStairs');

    // Exact count that will be generated
    const totalRooms =
      g('tmplLiving') + g('tmplBedroom') + g('tmplBathroom') +
      g('tmplKitchen') + g('tmplDining') + g('tmplOffice') +
      g('tmplGarage') + g('tmplBalcony') +
      (stairsOn && floors > 1 ? (floors - 1) * 2 : 0);

    const area     = Math.round(houseW * houseD * floors * 0.78);
    const totalArea = houseW * houseD * floors;
    const coverage = totalArea > 0 ? Math.min(98, Math.round((area / totalArea) * 100)) : 0;
    const cost     = Math.round(area * 1800 / 1000);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('tmplPrevRooms',    totalRooms);
    set('tmplPrevArea',     area + ' m²');
    set('tmplPrevCoverage', coverage + '%');
    set('tmplPrevCost',     '$' + cost + 'k');
    set('tmplPrevFloors',   floors);
  }

  // ── Core layout engine ───────────────────────────────────
  function generateTemplate() {
    const g  = id => parseInt(document.getElementById(id)?.value  || 0) || 0;
    const gf = id => parseFloat(document.getElementById(id)?.value || 0) || 0;
    const gc = id => document.getElementById(id)?.checked;

    const style    = selectedTemplateStyle;
    const tmpl     = TEMPLATE_DEFAULTS[style];
    const sizing   = tmpl.roomSizing;

    const houseW   = Math.max(8, gf('tmplWidth'));
    const houseD   = Math.max(8, gf('tmplDepth'));
    const numFloors = Math.max(1, Math.min(5, g('tmplFloors')));
    const floorH   = Math.max(2.0, gf('tmplFloorHeight'));
    const roofType = document.getElementById('tmplRoofType')?.value || 'pitched';

    const counts = {
      living:   g('tmplLiving'),
      bedroom:  g('tmplBedroom'),
      bathroom: g('tmplBathroom'),
      kitchen:  g('tmplKitchen'),
      dining:   g('tmplDining'),
      office:   g('tmplOffice'),
      garage:   g('tmplGarage'),
      balcony:  g('tmplBalcony'),
      stairs:   gc('tmplStairs') ? 1 : 0
    };

    if (typeof window.projectData === 'undefined') {
      if (typeof window.showToast === 'function') window.showToast('No project loaded', 'error');
      return;
    }
    if (!confirm('This will replace all rooms in the current project. Continue?')) return;

    // Update house dimensions
    window.projectData.totalWidth  = houseW;
    window.projectData.totalDepth  = houseD;
    window.projectData.style       = style;
    window.projectData.specifications = window.projectData.specifications || {};
    window.projectData.specifications.roofType = roofType;

    // Sync dimension UI inputs
    const setUI = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    setUI('totalWidth',  houseW);
    setUI('totalDepth',  houseD);
    setUI('numFloors',   numFloors);
    setUI('floorHeight', floorH);
    setUI('roofType',    roofType);

    // Rebuild floors array
    window.projectData.floors = [];
    const floorNames = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];
    for (let i = 0; i < numFloors; i++) {
      window.projectData.floors.push({
        level: i + 1,
        name: floorNames[i] || ('Floor ' + (i + 1)),
        height: floorH,
        rooms: []
      });
    }

    // Distribute rooms to floors then run zone packer
    var floorRoomDefs = buildFloorDistribution(style, counts, sizing, houseW, houseD, numFloors, floorH);
    var allDropped = [];
    floorRoomDefs.forEach(function(roomList, fi) {
      var result = smartLayout(roomList, houseW, houseD, floorH);
      window.projectData.floors[fi].rooms = result.placed;
      if (result.dropped.length > 0) {
        result.dropped.forEach(function(r) { allDropped.push(r.name + ' (Floor ' + (fi+1) + ')'); });
      }
    });

    // Apply style
    if (typeof window.setStyle === 'function') window.setStyle(style, false);

    // Reset to ground floor
    window.activeFloorIdx = 0;

    // Refresh all UI
    if (typeof window.updateFloorTabs  === 'function') window.updateFloorTabs();
    if (typeof window.renderRooms      === 'function') window.renderRooms();
    if (typeof window.updateInfoPanel  === 'function') window.updateInfoPanel();
    if (typeof window.drawFloorPlan    === 'function') window.drawFloorPlan();
    if (typeof window.markUnsaved      === 'function') window.markUnsaved();

    closeTemplateModal();

    var total = window.projectData.floors.reduce(function(s,f){return s+f.rooms.length;},0);
    if (typeof window.showToast === 'function') {
      window.showToast(tmpl.label + ' template applied! ' + total + ' rooms placed.', 'success');
    }

    // Alert about any rooms that couldn't fit within the house boundary
    if (allDropped.length > 0) {
      setTimeout(function() {
        var msg = 'The following ' + allDropped.length + ' room(s) could not fit within the ' +
                  houseW + 'm \u00d7 ' + houseD + 'm boundary and were not placed:\n\n' +
                  allDropped.map(function(n){ return '\u2022 ' + n; }).join('\n') +
                  '\n\nTo include them, increase the house Width or Depth and regenerate.';
        alert(msg);
      }, 300);
    }
  }

  // ── Distribute rooms across floors ───────────────────────
  // ── Distribute rooms across floors ───────────────────────
  function buildFloorDistribution(style, counts, sizing, houseW, houseD, numFloors, floorH) {
    var floorDefs = [];
    for (var i = 0; i < numFloors; i++) floorDefs.push([]);

    // Minimum sizes per type (absolute floor, never go below)
    var MIN = {
      living: {w:3.5, d:3.5}, kitchen:  {w:2.5, d:2.5}, dining:   {w:2.5, d:2.5},
      bedroom:{w:3.0, d:3.0}, bathroom: {w:1.8, d:1.8}, office:   {w:2.5, d:2.5},
      garage: {w:3.0, d:4.0}, balcony:  {w:2.0, d:1.2}, staircase:{w:2.0, d:2.0}
    };

    // Preferred sizes from template, clamped to house
    function sz(type) {
      var s = sizing[type] || {w:3,d:3};
      var mn = MIN[type] || {w:2,d:2};
      var w = Math.max(mn.w, Math.min(s.w, houseW * 0.6));
      var d = Math.max(mn.d, Math.min(s.d, houseD * 0.6));
      return { w: Math.round(w*10)/10, d: Math.round(d*10)/10 };
    }

    function addRoom(fi, type, name) {
      var s = sz(type);
      floorDefs[Math.min(fi, numFloors-1)].push({
        type:type, name:name, width:s.w, depth:s.d, height:floorH
      });
    }

    // Ground floor — public zone
    for (var i=0;i<counts.living;  i++) addRoom(0,'living',  i===0?'Living Room' :'Living Room '+(i+1));
    for (var i=0;i<counts.kitchen; i++) addRoom(0,'kitchen', i===0?'Kitchen'      :'Kitchen '+(i+1));
    for (var i=0;i<counts.dining;  i++) addRoom(0,'dining',  i===0?'Dining Room'  :'Dining Room '+(i+1));
    for (var i=0;i<counts.garage;  i++) addRoom(0,'garage',  i===0?'Garage'       :'Garage '+(i+1));
    // Office on ground (single floor) or floor 1
    for (var i=0;i<counts.office;  i++) addRoom(numFloors===1?0:1,'office', i===0?'Office':'Office '+(i+1));

    // Bedrooms — ground if single floor, spread upper floors
    for (var i=0;i<counts.bedroom; i++) {
      var fi = numFloors===1 ? 0 : Math.max(1, Math.min(numFloors-1, Math.floor(i*(numFloors-1)/Math.max(1,counts.bedroom-1))+1));
      addRoom(fi,'bedroom', i===0?'Master Bedroom':'Bedroom '+(i+1));
    }
    // Bathrooms — spread one per floor
    for (var i=0;i<counts.bathroom;i++) {
      var fi = numFloors===1 ? 0 : Math.min(numFloors-1, i);
      addRoom(fi,'bathroom', counts.bathroom===1?'Bathroom':'Bathroom '+(i+1));
    }
    // Balconies
    for (var i=0;i<counts.balcony; i++) addRoom(i%numFloors,'balcony', counts.balcony===1?'Balcony':'Balcony '+(i+1));
    // Stairs
    if (counts.stairs && numFloors>1) {
      for (var fi=0;fi<numFloors-1;fi++) addRoom(fi,'staircase','Staircase');
      for (var fi=1;fi<numFloors;  fi++) addRoom(fi,'staircase','Landing');
    }

    return floorDefs;
  }

  // ── Strict no-overlap grid packer ────────────────────────
  // Rooms are placed in rows left-to-right, zone by zone.
  // Any room whose row would exceed the floor boundary D is DROPPED.
  // Returns { placed: [...], dropped: [...] }
  function smartLayout(rooms, W, D, floorH) {
    var G = 0.3;
    var PUBLIC_TYPES  = {living:1, kitchen:1, dining:1, garage:1};
    var PRIVATE_TYPES = {bedroom:1, bathroom:1, office:1, staircase:1};

    var publicRooms  = rooms.filter(function(r){return  PUBLIC_TYPES[r.type];});
    var privateRooms = rooms.filter(function(r){return PRIVATE_TYPES[r.type];});
    var floatRooms   = rooms.filter(function(r){return !PUBLIC_TYPES[r.type] && !PRIVATE_TYPES[r.type];});

    function byArea(a,b){return (b.width*b.depth)-(a.width*a.depth);}
    publicRooms.sort(byArea);
    privateRooms.sort(byArea);

    function packRows(roomList, zStart) {
      var placed = [], dropped = [];
      var curX = 0, curZ = zStart, rowH = 0;
      for (var i = 0; i < roomList.length; i++) {
        var r  = roomList[i];
        var rw = Math.min(r.width, W);
        var rd = r.depth;
        if (curX + rw > W + 0.001) { curZ += rowH + G; curX = 0; rowH = 0; }
        if (curZ + rd > D + 0.001) { dropped.push(r); continue; }
        placed.push({
          name: r.name, type: r.type,
          x: Math.round(curX*10)/10, z: Math.round(curZ*10)/10,
          width: Math.round(rw*10)/10, depth: Math.round(rd*10)/10,
          height: floorH, doors: [], windows: []
        });
        curX += rw + G;
        rowH = Math.max(rowH, rd);
      }
      return { placed: placed, dropped: dropped, bottom: curZ + rowH };
    }

    var pubRes   = packRows(publicRooms,  0);
    var privRes  = packRows(privateRooms, pubRes.bottom  > 0 ? pubRes.bottom  + G : 0);
    var floatRes = packRows(floatRooms,   privRes.bottom > 0 ? privRes.bottom + G : 0);

    return {
      placed:  [].concat(pubRes.placed,  privRes.placed,  floatRes.placed),
      dropped: [].concat(pubRes.dropped, privRes.dropped, floatRes.dropped)
    };
  }

  function buildModalHTML() {
    var tabs = Object.entries(TEMPLATE_DEFAULTS).map(function(entry) {
      var key = entry[0], t = entry[1];
      return '<button class="tmpl-style-tab" data-style="' + key + '" onclick="window._tmpl.selectStyle(\'' + key + '\')">' +
             '<i class="' + t.icon + '"></i> ' + t.label + '</button>';
    }).join('');

    return '\
<div class="tmpl-modal-backdrop" id="templateModal" onclick="if(event.target===this)window._tmpl.close()">\
  <div class="tmpl-modal">\
    <div class="tmpl-modal-header">\
      <div class="tmpl-header-left">\
        <i class="fas fa-layer-group"></i>\
        <span>House Templates</span>\
        <span class="tmpl-badge">Smart Layout</span>\
      </div>\
      <button class="tmpl-close-btn" onclick="window._tmpl.close()"><i class="fas fa-times"></i></button>\
    </div>\
    <div class="tmpl-modal-body">\
      <div class="tmpl-left-col">\
        <div class="tmpl-style-tabs">' + tabs + '</div>\
        <div class="tmpl-style-desc-card" id="tmplStyleDesc">\
          <div class="tmpl-desc-title">Minimalist</div>\
          <div class="tmpl-desc-body">Loading\u2026</div>\
        </div>\
        <div class="tmpl-preview-box">\
          <div class="tmpl-preview-title"><i class="fas fa-chart-pie"></i> Preview</div>\
          <div class="tmpl-preview-grid">\
            <div class="tmpl-prev-stat"><span id="tmplPrevRooms">0</span><small>Rooms</small></div>\
            <div class="tmpl-prev-stat"><span id="tmplPrevArea">0 m\u00b2</span><small>Room Area</small></div>\
            <div class="tmpl-prev-stat"><span id="tmplPrevCoverage">0%</span><small>Coverage</small></div>\
            <div class="tmpl-prev-stat"><span id="tmplPrevCost">$0k</span><small>Est. Cost</small></div>\
            <div class="tmpl-prev-stat"><span id="tmplPrevFloors">1</span><small>Floors</small></div>\
          </div>\
        </div>\
      </div>\
      <div class="tmpl-right-col">\
        <div class="tmpl-section">\
          <div class="tmpl-section-label"><i class="fas fa-ruler-combined"></i> House Dimensions</div>\
          <div class="tmpl-row-3">\
            <div class="tmpl-field"><label>Width (m)</label><input type="number" id="tmplWidth" min="8" max="80" step="1" value="18" oninput="window._tmpl.preview()"></div>\
            <div class="tmpl-field"><label>Depth (m)</label><input type="number" id="tmplDepth" min="8" max="60" step="1" value="14" oninput="window._tmpl.preview()"></div>\
            <div class="tmpl-field"><label>Floors</label><input type="number" id="tmplFloors" min="1" max="5" step="1" value="1" oninput="window._tmpl.preview()"></div>\
          </div>\
          <div class="tmpl-row-2">\
            <div class="tmpl-field"><label>Floor Height (m)</label><input type="number" id="tmplFloorHeight" min="2.0" max="6.0" step="0.1" value="3.0" oninput="window._tmpl.preview()"></div>\
            <div class="tmpl-field"><label>Roof Type</label>\
              <select id="tmplRoofType" onchange="window._tmpl.preview()">\
                <option value="pitched">Pitched Gable</option>\
                <option value="hip">Hip Roof</option>\
                <option value="flat">Flat Roof</option>\
                <option value="gambrel">Gambrel / Barn</option>\
                <option value="shed">Shed / Mono-pitch</option>\
                <option value="mansard">Mansard</option>\
              </select>\
            </div>\
          </div>\
        </div>\
        <div class="tmpl-section">\
          <div class="tmpl-section-label"><i class="fas fa-th"></i> Room Count</div>\
          <div class="tmpl-room-grid">\
            <div class="tmpl-room-field"><div class="tmpl-room-icon living-icon"><i class="fas fa-couch"></i></div><label>Living Rooms</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplLiving\',-1)">\u2212</button><input type="number" id="tmplLiving" min="0" max="4" value="1" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplLiving\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon bedroom-icon"><i class="fas fa-bed"></i></div><label>Bedrooms</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplBedroom\',-1)">\u2212</button><input type="number" id="tmplBedroom" min="0" max="10" value="2" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplBedroom\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon bathroom-icon"><i class="fas fa-bath"></i></div><label>Bathrooms</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplBathroom\',-1)">\u2212</button><input type="number" id="tmplBathroom" min="0" max="8" value="1" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplBathroom\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon kitchen-icon"><i class="fas fa-utensils"></i></div><label>Kitchens</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplKitchen\',-1)">\u2212</button><input type="number" id="tmplKitchen" min="0" max="3" value="1" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplKitchen\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon dining-icon"><i class="fas fa-chair"></i></div><label>Dining Rooms</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplDining\',-1)">\u2212</button><input type="number" id="tmplDining" min="0" max="3" value="0" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplDining\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon office-icon"><i class="fas fa-briefcase"></i></div><label>Offices / Studies</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplOffice\',-1)">\u2212</button><input type="number" id="tmplOffice" min="0" max="4" value="0" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplOffice\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon garage-icon"><i class="fas fa-car"></i></div><label>Garages</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplGarage\',-1)">\u2212</button><input type="number" id="tmplGarage" min="0" max="3" value="0" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplGarage\',1)">+</button></div></div>\
            <div class="tmpl-room-field"><div class="tmpl-room-icon balcony-icon"><i class="fas fa-door-open"></i></div><label>Balconies</label><div class="tmpl-stepper"><button type="button" onclick="window._tmpl.step(\'tmplBalcony\',-1)">\u2212</button><input type="number" id="tmplBalcony" min="0" max="6" value="1" oninput="window._tmpl.preview()"><button type="button" onclick="window._tmpl.step(\'tmplBalcony\',1)">+</button></div></div>\
          </div>\
        </div>\
        <div class="tmpl-section">\
          <div class="tmpl-section-label"><i class="fas fa-sliders-h"></i> Extras</div>\
          <div class="tmpl-extras-row">\
            <label class="tmpl-toggle-field">\
              <input type="checkbox" id="tmplStairs" onchange="window._tmpl.preview()">\
              <span class="tmpl-toggle-slider"></span>\
              <span class="tmpl-toggle-label"><i class="fas fa-level-up-alt"></i> Include Stairs</span>\
              <small>Adds staircase + landing rooms per floor</small>\
            </label>\
          </div>\
        </div>\
      </div>\
    </div>\
    <div class="tmpl-modal-footer">\
      <button class="tmpl-btn-cancel" onclick="window._tmpl.close()">Cancel</button>\
      <button class="tmpl-btn-generate" onclick="window._tmpl.generate()"><i class="fas fa-magic"></i> Generate Floor Plan</button>\
    </div>\
  </div>\
</div>';
  }

  // ── Stepper helper ───────────────────────────────────────
  function step(id, delta) {
    var el = document.getElementById(id);
    if (!el) return;
    var min = parseInt(el.min || 0), max = parseInt(el.max || 99);
    el.value = Math.max(min, Math.min(max, (parseInt(el.value) || 0) + delta));
    updateTemplatePreview();
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    document.body.insertAdjacentHTML('beforeend', buildModalHTML());
    window._tmpl = {
      open:        openTemplateModal,
      close:       closeTemplateModal,
      selectStyle: function(s) { selectTemplateStyle(s); },
      preview:     updateTemplatePreview,
      generate:    generateTemplate,
      step:        step
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();