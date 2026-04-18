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
  function selectTemplateStyle(style, populate = true) {
    selectedTemplateStyle = style;
    const tmpl = TEMPLATE_DEFAULTS[style];
    if (!tmpl) return;

    // Update tab active states
    document.querySelectorAll('.tmpl-style-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.style === style);
    });

    // Update style description card
    const descCard = document.getElementById('tmplStyleDesc');
    if (descCard) {
      descCard.style.background = tmpl.bg;
      descCard.style.setProperty('--tmpl-accent', tmpl.accent);
      descCard.querySelector('.tmpl-desc-title').textContent = tmpl.label;
      descCard.querySelector('.tmpl-desc-body').textContent = tmpl.description;
    }

    if (populate) populateTemplateForm(style);
    else {
      // On first open, always populate
      populateTemplateForm(style);
    }
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
    const g = id => parseInt(document.getElementById(id)?.value || 0) || 0;
    const gf = id => parseFloat(document.getElementById(id)?.value || 0) || 0;
    const gc = id => document.getElementById(id)?.checked;

    const style = selectedTemplateStyle;
    const tmpl = TEMPLATE_DEFAULTS[style];
    const sizing = tmpl.roomSizing;

    const rooms = [
      ...Array(g('tmplLiving')).fill({ type: 'living', ...sizing.living }),
      ...Array(g('tmplBedroom')).fill({ type: 'bedroom', ...sizing.bedroom }),
      ...Array(g('tmplBathroom')).fill({ type: 'bathroom', ...sizing.bathroom }),
      ...Array(g('tmplKitchen')).fill({ type: 'kitchen', ...sizing.kitchen }),
      ...Array(g('tmplDining')).fill({ type: 'dining', ...sizing.dining }),
      ...Array(g('tmplOffice')).fill({ type: 'office', ...sizing.office }),
      ...Array(g('tmplGarage')).fill({ type: 'garage', ...sizing.garage }),
      ...Array(g('tmplBalcony')).fill({ type: 'balcony', ...sizing.balcony }),
      ...(gc('tmplStairs') ? [{ type: 'staircase', ...sizing.stairs }] : [])
    ];

    const totalRooms = rooms.length;
    const area = rooms.reduce((s, r) => s + r.w * r.d, 0).toFixed(0);
    const houseW = gf('tmplWidth'), houseD = gf('tmplDepth'), floors = g('tmplFloors');
    const totalArea = houseW * houseD * floors;
    const coverage = totalArea > 0 ? Math.min(100, ((area / totalArea) * 100)).toFixed(0) : 0;
    const cost = (area * 1800 / 1000).toFixed(0);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('tmplPrevRooms', totalRooms);
    set('tmplPrevArea', area + ' m²');
    set('tmplPrevCoverage', coverage + '%');
    set('tmplPrevCost', '$' + cost + 'k');
    set('tmplPrevFloors', floors);
  }

  // ── Core layout engine ───────────────────────────────────
  function generateTemplate() {
    const g = id => parseInt(document.getElementById(id)?.value || 0) || 0;
    const gf = id => parseFloat(document.getElementById(id)?.value || 0) || 0;
    const gc = id => document.getElementById(id)?.checked;

    const style = selectedTemplateStyle;
    const tmpl = TEMPLATE_DEFAULTS[style];
    const sizing = tmpl.roomSizing;

    const houseW = Math.max(8, gf('tmplWidth'));
    const houseD = Math.max(8, gf('tmplDepth'));
    const numFloors = Math.max(1, Math.min(5, g('tmplFloors')));
    const floorH = Math.max(2.0, gf('tmplFloorHeight'));
    const roofType = document.getElementById('tmplRoofType')?.value || 'pitched';

    const counts = {
      living: g('tmplLiving'), bedroom: g('tmplBedroom'), bathroom: g('tmplBathroom'),
      kitchen: g('tmplKitchen'), dining: g('tmplDining'), office: g('tmplOffice'),
      garage: g('tmplGarage'), balcony: g('tmplBalcony'), stairs: gc('tmplStairs') ? 1 : 0
    };

    // Apply to projectData
    if (typeof window.projectData === 'undefined') { showToast?.('No project loaded', 'error'); return; }
    if (!confirm('This will replace all rooms in the current project. Continue?')) return;

    // Update house dimensions & floors
    window.projectData.totalWidth = houseW;
    window.projectData.totalDepth = houseD;
    window.projectData.style = style;
    window.projectData.specifications = window.projectData.specifications || {};
    window.projectData.specifications.roofType = roofType;

    // Sync UI
    const setUI = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    setUI('totalWidth', houseW);
    setUI('totalDepth', houseD);
    setUI('numFloors', numFloors);
    setUI('floorHeight', floorH);
    setUI('roofType', roofType);

    // Rebuild floors
    window.projectData.floors = [];
    const floorNames = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];
    for (let i = 0; i < numFloors; i++) {
      window.projectData.floors.push({ level: i + 1, name: floorNames[i] || `Floor ${i + 1}`, height: floorH, rooms: [] });
    }

    // Build room list per-floor
    const floorRoomDefs = buildFloorDistribution(style, counts, sizing, houseW, houseD, numFloors, floorH);

    // Run layout per floor
    floorRoomDefs.forEach((roomList, fi) => {
      window.projectData.floors[fi].rooms = smartLayout(roomList, houseW, houseD, floorH, style);
    });

    // Set style
    if (typeof window.setStyle === 'function') window.setStyle(style, false);

    // Sync floor idx
    window.activeFloorIdx = 0;

    // Refresh UI
    if (typeof window.updateFloorTabs === 'function') window.updateFloorTabs();
    if (typeof window.renderRooms === 'function') window.renderRooms();
    if (typeof window.updateInfoPanel === 'function') window.updateInfoPanel();
    if (typeof window.drawFloorPlan === 'function') window.drawFloorPlan();
    if (typeof window.markUnsaved === 'function') window.markUnsaved();

    closeTemplateModal();
    if (typeof window.showToast === 'function') window.showToast(`${tmpl.label} template applied! ${window.projectData.floors.reduce((s, f) => s + f.rooms.length, 0)} rooms generated.`, 'success');
  }

  // ── Distribute rooms across floors based on style ────────
  function buildFloorDistribution(style, counts, sizing, houseW, houseD, numFloors, floorH) {
    const floorDefs = Array.from({ length: numFloors }, () => []);

    const addRoom = (floorIdx, type, name, w, d) => {
      w = Math.min(w, houseW - 1);
      d = Math.min(d, houseD - 1);
      floorDefs[floorIdx].push({ type, name, width: w, depth: d, height: floorH });
    };

    const roomNames = {
      living: 'Living Room', bedroom: 'Bedroom', bathroom: 'Bathroom',
      kitchen: 'Kitchen', dining: 'Dining Room', office: 'Office',
      garage: 'Garage', balcony: 'Balcony', stairs: 'Stairs'
    };

    // Ground floor always: living, kitchen, dining, garage, balcony (partial)
    if (counts.living > 0) addRoom(0, 'living', roomNames.living, sizing.living.w, sizing.living.d);
    if (counts.kitchen > 0) addRoom(0, 'kitchen', roomNames.kitchen, sizing.kitchen.w, sizing.kitchen.d);
    if (counts.dining > 0) addRoom(0, 'dining', roomNames.dining, sizing.dining.w, sizing.dining.d);
    if (counts.garage > 0) addRoom(0, 'garage', roomNames.garage, sizing.garage.w, sizing.garage.d);

    // Distribute bathrooms
    const bathPerFloor = Math.max(1, Math.floor(counts.bathroom / numFloors));
    for (let i = 0; i < counts.bathroom; i++) {
      const fi = Math.min(numFloors - 1, Math.floor(i / bathPerFloor));
      addRoom(fi, 'bathroom', roomNames.bathroom, sizing.bathroom.w, sizing.bathroom.d);
    }

    // Distribute bedrooms — put first bedroom on ground if single floor, else upper floors
    const groundBeds = numFloors === 1 ? counts.bedroom : Math.max(0, Math.ceil(counts.bedroom * 0.2));
    for (let i = 0; i < groundBeds; i++) {
      addRoom(0, 'bedroom', i === 0 ? 'Master Bedroom' : `Bedroom ${i + 1}`, sizing.bedroom.w, sizing.bedroom.d);
    }
    const upperBeds = counts.bedroom - groundBeds;
    for (let i = 0; i < upperBeds; i++) {
      const fi = Math.min(numFloors - 1, Math.max(1, Math.floor(i * (numFloors - 1) / Math.max(1, upperBeds))));
      addRoom(fi, 'bedroom', i === 0 && groundBeds === 0 ? 'Master Bedroom' : `Bedroom ${groundBeds + i + 1}`, sizing.bedroom.w, sizing.bedroom.d);
    }

    // Office on ground or upper-1
    for (let i = 0; i < counts.office; i++) {
      addRoom(Math.min(numFloors - 1, 1), 'office', roomNames.office, sizing.office.w, sizing.office.d);
    }

    // Stairs on each floor except top
    if (counts.stairs) {
      for (let fi = 0; fi < numFloors - 1; fi++) {
        addRoom(fi, 'staircase', 'Staircase', sizing.stairs.w, sizing.stairs.d);
      }
      // Landing on upper floors
      for (let fi = 1; fi < numFloors; fi++) {
        addRoom(fi, 'staircase', 'Landing', sizing.stairs.w, sizing.stairs.d);
      }
    }

    // Balcony
    for (let i = 0; i < counts.balcony; i++) {
      const fi = Math.min(numFloors - 1, i === 0 ? 0 : 1);
      addRoom(fi, 'balcony', 'Balcony', sizing.balcony.w, sizing.balcony.d);
    }

    return floorDefs;
  }

  // ── Smart 2-D layout packer ──────────────────────────────
  function smartLayout(rooms, W, D, floorH, style) {
    if (rooms.length === 0) return [];

    const margin = 0.5;
    const placed = [];

    // Sort: large rooms first
    const sorted = [...rooms].sort((a, b) => (b.width * b.depth) - (a.width * a.depth));

    // Find next free position using a simple row-column packer
    function findPosition(w, d) {
      for (let z = margin; z + d <= D - margin + 0.01; z += 0.5) {
        for (let x = margin; x + w <= W - margin + 0.01; x += 0.5) {
          const ok = !placed.some(r =>
            x < r.x + r.width + margin * 0.5 &&
            x + w > r.x - margin * 0.5 &&
            z < r.z + r.depth + margin * 0.5 &&
            z + d > r.z - margin * 0.5
          );
          if (ok) return { x: snapN(x), z: snapN(z) };
        }
      }
      return null;
    }

    // Try to fit each room; scale down if needed
    sorted.forEach((room) => {
      let w = room.width, d = room.depth;
      let pos = null;

      for (let attempt = 0; attempt < 5 && !pos; attempt++) {
        pos = findPosition(w, d);
        if (!pos) {
          // Try rotating
          const tmp = w; w = d; d = tmp;
          pos = findPosition(w, d);
          if (!pos) { w *= 0.85; d *= 0.85; }
        }
      }

      if (!pos) {
        // Last resort: place with overlap at first free row-end
        w = Math.min(room.width, W - margin * 2);
        d = Math.min(room.depth, D - margin * 2);
        pos = { x: snapN(margin), z: snapN(placed.length * 1.5 % (D - d - margin) + margin) };
      }

      const r = {
        name: room.name,
        type: room.type,
        width: snapN(w),
        depth: snapN(d),
        x: Math.max(0, Math.min(W - w, pos.x)),
        z: Math.max(0, Math.min(D - d, pos.z)),
        height: floorH,
        doors: [],
        windows: []
      };
      placed.push(r);
    });

    return placed;
  }

  function snapN(v, g = 0.5) { return Math.round(v / g) * g; }

  // ── Build Modal HTML ─────────────────────────────────────
  function buildModalHTML() {
    const tabs = Object.entries(TEMPLATE_DEFAULTS).map(([key, t]) =>
      `<button class="tmpl-style-tab" data-style="${key}" onclick="window._tmpl.selectStyle('${key}')">
        <i class="${t.icon}"></i> ${t.label}
      </button>`
    ).join('');

    return `
<div class="tmpl-modal-backdrop" id="templateModal" onclick="if(event.target===this)window._tmpl.close()">
  <div class="tmpl-modal">

    <div class="tmpl-modal-header">
      <div class="tmpl-header-left">
        <i class="fas fa-layer-group"></i>
        <span>House Templates</span>
        <span class="tmpl-badge">Smart Layout</span>
      </div>
      <button class="tmpl-close-btn" onclick="window._tmpl.close()"><i class="fas fa-times"></i></button>
    </div>

    <div class="tmpl-modal-body">

      <!-- Left: style tabs + description -->
      <div class="tmpl-left-col">
        <div class="tmpl-style-tabs">${tabs}</div>
        <div class="tmpl-style-desc-card" id="tmplStyleDesc">
          <div class="tmpl-desc-title">Minimalist</div>
          <div class="tmpl-desc-body">Loading…</div>
        </div>

        <!-- Preview stats -->
        <div class="tmpl-preview-box">
          <div class="tmpl-preview-title"><i class="fas fa-chart-pie"></i> Preview</div>
          <div class="tmpl-preview-grid">
            <div class="tmpl-prev-stat"><span id="tmplPrevRooms">0</span><small>Rooms</small></div>
            <div class="tmpl-prev-stat"><span id="tmplPrevArea">0 m²</span><small>Room Area</small></div>
            <div class="tmpl-prev-stat"><span id="tmplPrevCoverage">0%</span><small>Coverage</small></div>
            <div class="tmpl-prev-stat"><span id="tmplPrevCost">$0k</span><small>Est. Cost</small></div>
            <div class="tmpl-prev-stat"><span id="tmplPrevFloors">1</span><small>Floors</small></div>
          </div>
        </div>
      </div>

      <!-- Right: config form -->
      <div class="tmpl-right-col">

        <div class="tmpl-section">
          <div class="tmpl-section-label"><i class="fas fa-ruler-combined"></i> House Dimensions</div>
          <div class="tmpl-row-3">
            <div class="tmpl-field">
              <label>Width (m)</label>
              <input type="number" id="tmplWidth" min="8" max="80" step="1" value="18" oninput="window._tmpl.preview()">
            </div>
            <div class="tmpl-field">
              <label>Depth (m)</label>
              <input type="number" id="tmplDepth" min="8" max="60" step="1" value="14" oninput="window._tmpl.preview()">
            </div>
            <div class="tmpl-field">
              <label>Floors</label>
              <input type="number" id="tmplFloors" min="1" max="5" step="1" value="1" oninput="window._tmpl.preview()">
            </div>
          </div>
          <div class="tmpl-row-2">
            <div class="tmpl-field">
              <label>Floor Height (m)</label>
              <input type="number" id="tmplFloorHeight" min="2.0" max="6.0" step="0.1" value="3.0" oninput="window._tmpl.preview()">
            </div>
            <div class="tmpl-field">
              <label>Roof Type</label>
              <select id="tmplRoofType" onchange="window._tmpl.preview()">
                <option value="pitched">Pitched Gable</option>
                <option value="hip">Hip Roof</option>
                <option value="flat">Flat Roof</option>
                <option value="gambrel">Gambrel / Barn</option>
                <option value="shed">Shed / Mono-pitch</option>
                <option value="mansard">Mansard</option>
              </select>
            </div>
          </div>
        </div>

        <div class="tmpl-section">
          <div class="tmpl-section-label"><i class="fas fa-th"></i> Room Count</div>
          <div class="tmpl-room-grid">
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon living-icon"><i class="fas fa-couch"></i></div>
              <label>Living Rooms</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplLiving',-1)">−</button>
                <input type="number" id="tmplLiving" min="0" max="4" value="1" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplLiving',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon bedroom-icon"><i class="fas fa-bed"></i></div>
              <label>Bedrooms</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplBedroom',-1)">−</button>
                <input type="number" id="tmplBedroom" min="0" max="10" value="2" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplBedroom',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon bathroom-icon"><i class="fas fa-bath"></i></div>
              <label>Bathrooms</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplBathroom',-1)">−</button>
                <input type="number" id="tmplBathroom" min="0" max="8" value="1" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplBathroom',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon kitchen-icon"><i class="fas fa-utensils"></i></div>
              <label>Kitchens</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplKitchen',-1)">−</button>
                <input type="number" id="tmplKitchen" min="0" max="3" value="1" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplKitchen',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon dining-icon"><i class="fas fa-chair"></i></div>
              <label>Dining Rooms</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplDining',-1)">−</button>
                <input type="number" id="tmplDining" min="0" max="3" value="0" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplDining',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon office-icon"><i class="fas fa-briefcase"></i></div>
              <label>Offices / Studies</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplOffice',-1)">−</button>
                <input type="number" id="tmplOffice" min="0" max="4" value="0" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplOffice',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon garage-icon"><i class="fas fa-car"></i></div>
              <label>Garages</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplGarage',-1)">−</button>
                <input type="number" id="tmplGarage" min="0" max="3" value="0" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplGarage',1)">+</button>
              </div>
            </div>
            <div class="tmpl-room-field">
              <div class="tmpl-room-icon balcony-icon"><i class="fas fa-door-open"></i></div>
              <label>Balconies</label>
              <div class="tmpl-stepper">
                <button type="button" onclick="window._tmpl.step('tmplBalcony',-1)">−</button>
                <input type="number" id="tmplBalcony" min="0" max="6" value="1" oninput="window._tmpl.preview()">
                <button type="button" onclick="window._tmpl.step('tmplBalcony',1)">+</button>
              </div>
            </div>
          </div>
        </div>

        <div class="tmpl-section">
          <div class="tmpl-section-label"><i class="fas fa-sliders-h"></i> Extras</div>
          <div class="tmpl-extras-row">
            <label class="tmpl-toggle-field">
              <input type="checkbox" id="tmplStairs" onchange="window._tmpl.preview()">
              <span class="tmpl-toggle-slider"></span>
              <span class="tmpl-toggle-label"><i class="fas fa-level-up-alt"></i> Include Stairs</span>
              <small>Adds staircase + landing rooms per floor</small>
            </label>
          </div>
        </div>

      </div>
    </div>

    <div class="tmpl-modal-footer">
      <button class="tmpl-btn-cancel" onclick="window._tmpl.close()">Cancel</button>
      <button class="tmpl-btn-generate" onclick="window._tmpl.generate()">
        <i class="fas fa-magic"></i> Generate Floor Plan
      </button>
    </div>
  </div>
</div>`;
  }

  // ── Stepper helper ───────────────────────────────────────
  function step(id, delta) {
    const el = document.getElementById(id);
    if (!el) return;
    const min = parseInt(el.min || 0), max = parseInt(el.max || 99);
    el.value = Math.max(min, Math.min(max, (parseInt(el.value) || 0) + delta));
    updateTemplatePreview();
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Inject modal
    document.body.insertAdjacentHTML('beforeend', buildModalHTML());

    // Expose API
    window._tmpl = {
      open: openTemplateModal,
      close: closeTemplateModal,
      selectStyle: (s) => selectTemplateStyle(s),
      preview: updateTemplatePreview,
      generate: generateTemplate,
      step: step
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();