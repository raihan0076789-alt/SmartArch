// interior.js — Interior 3D Visualization Engine (Style-Aware)
// Reads projectData from architect.js and renders a furnished interior scene

(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────
    let scene, camera, renderer, animId;
    let groups = { furniture: [], roof: [], walls: [], labels: [] };
    let layers = { furniture: true, roof: false, walls: true, labels: true };
    let interiorSubView = 'interior';
    let currentStyle = 'modern';

    // ── Style themes ──────────────────────────────────────────
    const STYLE_THEMES = {
        modern: {
            bg: 0x0d1117, fog: 0x0d1117, fogDensity: 0.014,
            wallColor: 0x2a3550, interiorWall: 0xd5dce8,
            floorColor: 0x3a4a6b, ceilColor: 0xf0f4f8,
            groundColor: 0x1a2535, ambientInt: 0.45, sunInt: 1.0,
            sunColor: 0xffffff, accentLight: null,
            furnitureTint: 1.0, exposure: 1.0,
            wallRough: 0.65, wallMetal: 0.08,
        },
        minimalist: {
            bg: 0xf0f2f5, fog: 0xf0f2f5, fogDensity: 0.005,
            wallColor: 0xfafafa, interiorWall: 0xf5f5f5,
            floorColor: 0xe0e0e0, ceilColor: 0xffffff,
            groundColor: 0xe0e4ea, ambientInt: 0.75, sunInt: 0.9,
            sunColor: 0xfff8f0, accentLight: null,
            furnitureTint: 1.0, exposure: 1.15,
            wallRough: 0.9, wallMetal: 0.0,
        },
        traditional: {
            bg: 0x1a120a, fog: 0x1a120a, fogDensity: 0.012,
            wallColor: 0xc8997a, interiorWall: 0xeadcc8,
            floorColor: 0x8b6f47, ceilColor: 0xf5ecd8,
            groundColor: 0x2d3a20, ambientInt: 0.5, sunInt: 0.85,
            sunColor: 0xffe4b5, accentLight: 0xff9944,
            furnitureTint: 1.0, exposure: 0.95,
            wallRough: 0.9, wallMetal: 0.0,
        },
        luxury: {
            bg: 0x060608, fog: 0x060608, fogDensity: 0.018,
            wallColor: 0x1a1a20, interiorWall: 0x0d0d14,
            floorColor: 0xb8a070, ceilColor: 0x1a1a20,
            groundColor: 0x111118, ambientInt: 0.35, sunInt: 0.6,
            sunColor: 0xffd080, accentLight: 0xffd700,
            furnitureTint: 1.0, exposure: 0.85,
            wallRough: 0.35, wallMetal: 0.3,
        },
    };

    // ── Colour palette per room type ─────────────────────────
    const TYPE_COLOR = {
        living:    { hex: 0x7c6fe0, css: '#7c6fe0', floor: 0x8b6b3d },
        bedroom:   { hex: 0x47b89c, css: '#47b89c', floor: 0xc4a882 },
        bathroom:  { hex: 0xe06f6f, css: '#e06f6f', floor: 0xf0f0f0 },
        kitchen:   { hex: 0xe0a847, css: '#e0a847', floor: 0xc8c0b0 },
        dining:    { hex: 0x9c6fe0, css: '#9c6fe0', floor: 0xe8e0d0 },
        office:    { hex: 0x6fa8e0, css: '#6fa8e0', floor: 0x8b8070 },
        garage:    { hex: 0x8a8070, css: '#8a8070', floor: 0x707070 },
        staircase: { hex: 0xff9632, css: '#ff9632', floor: 0xc8a870 },
        other:     { hex: 0xaaaaaa, css: '#aaaaaa', floor: 0x999999 },
        balcony:   { hex: 0x64c8ff, css: '#64c8ff', floor: 0xb0c8d8 },
        hallway:   { hex: 0xc8a96e, css: '#c8a96e', floor: 0xc8a07a },
    };
    const WALL_H = 2.7;
    const WT = 0.14; // wall thickness

    // ── Material helpers ──────────────────────────────────────
    function mat(color, rough = 0.75, metal = 0.04) {
        return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide });
    }
    function glassM(color = 0x88ccee, opacity = 0.35) {
        return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.05, metalness: 0.1 });
    }
    function styleMat(baseColor, rough, metal) {
        const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;
        return mat(baseColor, rough !== undefined ? rough : T.wallRough, metal !== undefined ? metal : T.wallMetal);
    }

    function addMesh(geo, material, x, y, z, rx = 0, ry = 0, grp = null) {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);
        if (grp) groups[grp].push(m);
        return m;
    }

    function box(w, h, d, color, x, y, z, rough = 0.75, grp = null, ry = 0) {
        return addMesh(new THREE.BoxGeometry(w, h, d), mat(color, rough), x, y, z, 0, ry, grp);
    }
    function cyl(rt, rb, h, seg, color, x, y, z, grp = null) {
        return addMesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, 0.8), x, y, z, 0, 0, grp);
    }

    // ── Camera orbit state (kept outside so it persists) ─────
    let theta = 0.6, phi = 0.5, radius = 30;
    let targetTheta = 0.6, targetPhi = 0.5, targetRadius = 30;
    let isDragging = false, prevX = 0, prevY = 0;
    let lookTarget = new THREE.Vector3(0, 1.5, 0);
    let lookCurrent = new THREE.Vector3(0, 1.5, 0);
    let currentFocusRoom = null;

    // ── Main entry point ─────────────────────────────────────
    window.initInteriorView = function (projectData) {
        if (!projectData || typeof THREE === 'undefined') return;

        // Apply style from projectData
        currentStyle = projectData.style || 'modern';
        const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;

        const container = document.getElementById('interiorContainer');
        const canvas = document.getElementById('interiorCanvas');

        // Kill previous renderer
        if (animId) cancelAnimationFrame(animId);
        if (renderer) { renderer.dispose(); }

        // Reset groups
        groups = { furniture: [], roof: [], walls: [], labels: [] };

        // Re-read layer checkboxes
        layers.furniture = document.getElementById('layerFurniture')?.checked !== false;
        layers.roof      = document.getElementById('layerRoof')?.checked === true;
        layers.walls     = document.getElementById('layerWalls')?.checked !== false;
        layers.labels    = document.getElementById('layerLabels')?.checked !== false;

        const W = (container.clientWidth  > 10 ? container.clientWidth  : container.parentElement?.clientWidth  || 800);
        const H = (container.clientHeight > 10 ? container.clientHeight : container.parentElement?.clientHeight || 600);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(T.bg);
        scene.fog = new THREE.FogExp2(T.fog, T.fogDensity);

        camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = T.exposure || 1.0;

        buildScene(projectData);
        setupInteriorMouseControls(canvas);

        // Reset roof visibility
        layers.roof = false;
        if (groups.roof) groups.roof.forEach(m => m.visible = false);

        // Camera reset — multi-floor aware
        const _floors = projectData.floors || [];
        let _totalH = 0;
        _floors.forEach(f => { _totalH += f.height || WALL_H; });
        // Pick a look-at Y that sits at mid-height of the first floor with rooms
        let _camY = Math.min(1.5, _totalH * 0.3);
        let _camX = 0, _camZ = 0;
        const _allR = _floors.flatMap(f => f.rooms || []);
        if (_allR.length > 0) {
            const _ox = -(projectData.totalWidth || 20) / 2;
            const _oz = -(projectData.totalDepth || 15) / 2;
            _allR.forEach(r => { _camX += _ox + r.x + r.width / 2; _camZ += _oz + r.z + r.depth / 2; });
            _camX /= _allR.length; _camZ /= _allR.length;
        }
        const _maxDim = Math.max(projectData.totalWidth || 20, projectData.totalDepth || 15);
        targetPhi    = 0.52;
        targetTheta  = 0.6;
        targetRadius = Math.max(_maxDim * 0.9, 18);
        radius       = targetRadius;
        lookTarget.set(_camX, 1.5, _camZ);
        lookCurrent.set(_camX, 1.5, _camZ);

        updateCameraPosition();
        animate();

        // Expose refs for wireframe + first-person from architect.js
        window._interiorScene = scene;
        window._interiorCamera = camera;
        window._interiorRenderer = renderer;

        // apply visibility from layer state
        Object.keys(groups).forEach(k => groups[k].forEach(m => m.visible = layers[k]));
    };

    // ── Build scene from projectData (multi-floor aware) ─────
    function buildScene(pd) {
        const HW = pd.totalWidth  || 20;
        const HD = pd.totalDepth  || 15;
        const ox = -HW / 2, oz = -HD / 2;
        const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;
        const floors = pd.floors || [{ rooms: [], height: WALL_H }];

        // Compute total height for camera framing
        let totalH = 0;
        floors.forEach(f => { totalH += f.height || WALL_H; });

        // Camera look-at: centroid of all rooms so single/small rooms are always visible
        const _allRooms = floors.flatMap(f => f.rooms || []);
        let _lookX = 0, _lookZ = 0;
        if (_allRooms.length > 0) {
            _allRooms.forEach(r => { _lookX += ox + r.x + r.width / 2; _lookZ += oz + r.z + r.depth / 2; });
            _lookX /= _allRooms.length; _lookZ /= _allRooms.length;
        }
        lookTarget.set(_lookX, 1.5, _lookZ);
        lookCurrent.set(_lookX, 1.5, _lookZ);
        targetRadius = Math.max(HW, HD) * 1.1 + 5;
        radius = targetRadius;

        // ── Style-driven lights ──
        scene.add(new THREE.AmbientLight(0xffffff, T.ambientInt));
        const sun = new THREE.DirectionalLight(T.sunColor, T.sunInt);
        sun.position.set(25, totalH * 3 + 25, 20); sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const sc = Math.max(HW, HD) + 20;
        ['left','right','top','bottom'].forEach((s,i) => sun.shadow.camera[s] = [-sc,sc,sc,-sc][i]);
        sun.shadow.bias = -0.001;
        scene.add(sun);
        const fill = new THREE.DirectionalLight(currentStyle === 'luxury' ? 0x334466 : 0x8899cc, 0.25);
        fill.position.set(-15, totalH + 10, -10); scene.add(fill);

        // ── Ground ──
        const groundMat = mat(T.groundColor, 0.95, 0);
        addMesh(new THREE.PlaneGeometry(120, 120), groundMat, 0, -0.06, 0, -Math.PI / 2);
        if (currentStyle === 'modern' || currentStyle === 'minimalist') {
            const gridC = currentStyle === 'modern' ? 0x112233 : 0xcccccc;
            const grid = new THREE.GridHelper(80, 80, gridC, gridC);
            grid.material.opacity = 0.25; grid.material.transparent = true;
            grid.position.y = -0.04; scene.add(grid);
        }

        // Foundation slab
        const slabColor = currentStyle === 'luxury' ? 0x1a1a1a : 0x555555;
        box(HW + 0.4, 0.22, HD + 0.4, slabColor, 0, 0.11, 0, 0.9, 'walls');

        // ── Wall materials ──
        const wMat  = mat(T.wallColor,  T.wallRough, T.wallMetal);
        const wMatI = mat(T.interiorWall, T.wallRough * 1.05, 0);
        const slabMat = mat(slabColor, 0.7, 0);
        const voidMat = mat(0x050508, 1, 0);

        function wall(w, h, d, x, y, z, inner = false, grp = 'walls') {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), inner ? wMatI : wMat);
            m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
            scene.add(m); if (grp) groups[grp].push(m);
        }

        // ── Per-floor construction ──────────────────────────────
        let baseY = 0.22; // start above foundation slab
        floors.forEach((floor, floorIdx) => {
            const rooms = floor.rooms || [];
            const floorH = floor.height || WALL_H;
            const wy = baseY + floorH / 2;

            // Inter-floor concrete slab (from floor 2 upward)
            if (floorIdx > 0) {
                box(HW + 0.1, 0.2, HD + 0.1, slabColor, 0, baseY - 0.1, 0, 0.8, 'walls');
            }

            // Accent light per-floor
            if (T.accentLight) {
                const acc = new THREE.PointLight(T.accentLight, currentStyle === 'luxury' ? 0.5 : 0.3, 18);
                acc.position.set(0, baseY + floorH - 0.5, 0); scene.add(acc);
            }

            // Per-room ceiling lights
            rooms.forEach(room => {
                if (room.type === 'staircase') return; // open vertical shaft, no ceiling light
                const cx = ox + room.x + room.width / 2;
                const cz = oz + room.z + room.depth / 2;
                const rh = room.height || floorH;
                const lightColor = currentStyle === 'luxury' ? 0xffd080 : currentStyle === 'traditional' ? 0xffe4a0 : 0xffffff;
                const lightInt = currentStyle === 'minimalist' ? 0.7 : 0.55;
                const pl = new THREE.PointLight(lightColor, lightInt, Math.max(room.width, room.depth) * 1.8, 2);
                pl.position.set(cx, baseY + rh - 0.35, cz);
                pl.userData.baseIntensity = lightInt;
                scene.add(pl);
            });

            // Room floors (skip staircase — furnishStaircase draws its own treads)
            const floorRough = currentStyle === 'luxury' ? 0.25 : currentStyle === 'minimalist' ? 0.6 : 0.75;
            const floorMetal = currentStyle === 'luxury' ? 0.3 : 0;
            rooms.forEach(room => {
                if (room.type === 'staircase') return; // staircase draws its own geometry
                const cx = ox + room.x + room.width / 2;
                const cz = oz + room.z + room.depth / 2;
                let fc = (TYPE_COLOR[room.type] || TYPE_COLOR.other).floor;
                if (currentStyle === 'minimalist') fc = room.type === 'bathroom' ? 0xf5f5f5 : 0xe8e8e8;
                else if (currentStyle === 'luxury') fc = room.type === 'bathroom' ? 0xd4c9b0 : 0xb8a878;
                else if (currentStyle === 'traditional') fc = room.type === 'bathroom' ? 0xe0d8c8 : 0x9b7a50;
                addMesh(new THREE.BoxGeometry(room.width - WT, 0.05, room.depth - WT),
                    mat(fc, floorRough, floorMetal), cx, baseY + 0.03, cz, 0, 0, 'walls');
            });

            // Exterior walls — cut openings where balconies touch boundary
            buildExteriorWalls(rooms, HW, HD, ox, oz, wy, floorH, baseY, wMat, wMatI);

            // Interior partition walls
            buildInteriorWalls(rooms, HW, HD, ox, oz, wy, floorH);

            // Ceiling slab for this floor (shown as thin layer, hidden toggle for interior view)
            const ceilColor = T.ceilColor;
            const ceilMesh = new THREE.Mesh(
                new THREE.BoxGeometry(HW + 0.2, 0.08, HD + 0.2),
                mat(ceilColor, 0.9, 0)
            );
            ceilMesh.position.set(0, baseY + floorH + 0.04, 0);
            scene.add(ceilMesh);
            groups.roof.push(ceilMesh);

            // ── User-placed windows for this floor ──
            const floorHasUserWindows = rooms.some(r => (r.windows || []).length > 0);
            if (floorHasUserWindows) {
                // Render only user-placed windows
                rooms.forEach(room => {
                    (room.windows || []).forEach(win => {
                        addInteriorWindow3D(room, win, ox, oz, baseY, floorH, voidMat);
                    });
                });
            } else {
                // Fall back to auto-generated windows
                buildWindows(rooms, HW, HD, ox, oz, baseY, floorH);
            }

            // ── User-placed doors for this floor ──
            rooms.forEach(room => {
                (room.doors || []).forEach(door => {
                    addInteriorDoor3D(room, door, ox, oz, baseY, floorH, voidMat);
                });
            });

            // Furniture and labels (only on ground floor for interior perf; all floors for dollhouse/exterior)
            rooms.forEach(room => buildRoomFurniture(room, ox, oz, baseY));
            rooms.forEach(room => buildLabel(room, ox, oz, baseY + floorH * 0.52));

            // Floor index label for multi-floor buildings
            if (floors.length > 1) {
                buildFloorBadge(floor, floorIdx, HW, HD, baseY, floorH);
            }

            baseY += floorH;
        });

        // ── Roof (sits on top of all floors) ──
        buildRoof(pd, HW, HD, ox, oz, baseY);

        // ── Trees/landscape ──
        if (currentStyle !== 'minimalist') {
            [[-HW / 2 - 4, -HD / 2 - 3], [HW / 2 + 3, -HD / 2 - 2],
             [-HW / 2 - 3, HD / 2 + 2],  [HW / 2 + 4, HD / 2 + 3],
             [0, -HD / 2 - 5]].forEach(([x, z]) => buildTree(x, z));
        }
    }

    // ── Render a user-placed window in the interior 3D scene ─
    function addInteriorWindow3D(room, win, ox, oz, baseY, floorH, voidMat) {
        const winH = 1.1, winW = win.width || 1.0, wallT = WT + 0.06;
        const winY = baseY + floorH * 0.55, pos = win.pos ?? 0.5;
        const wall = win.wall, isHoriz = wall === 'top' || wall === 'bottom';
        let wx, wz;
        switch (wall) {
            case 'top':    wx = ox + room.x + pos * room.width; wz = oz + room.z; break;
            case 'bottom': wx = ox + room.x + pos * room.width; wz = oz + room.z + room.depth; break;
            case 'left':   wx = ox + room.x; wz = oz + room.z + pos * room.depth; break;
            case 'right':  wx = ox + room.x + room.width; wz = oz + room.z + pos * room.depth; break;
            default: return;
        }
        // Dark void backing
        const vW = isHoriz ? winW : wallT, vD = isHoriz ? wallT : winW;
        const voidM = new THREE.Mesh(new THREE.BoxGeometry(vW, winH, vD), voidMat);
        voidM.position.set(wx, winY, wz); scene.add(voidM); groups.walls.push(voidM);

        // Frame bars
        const frameC = currentStyle === 'luxury' ? 0x998800 : currentStyle === 'traditional' ? 0x8b4513 : 0x333355;
        const fMat = mat(frameC, 0.5, 0.15);
        const fW = isHoriz ? winW + 0.12 : wallT + 0.05, fD = isHoriz ? wallT + 0.05 : winW + 0.12;
        // top/bottom rails
        [-1, 1].forEach(s => {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.07, fD), fMat);
            bar.position.set(wx, winY + s * (winH / 2 + 0.035), wz);
            scene.add(bar); groups.walls.push(bar);
        });
        // side stiles
        [-1, 1].forEach(s => {
            const upW = isHoriz ? 0.07 : fW, upD = isHoriz ? fD : 0.07;
            const up = new THREE.Mesh(new THREE.BoxGeometry(upW, winH, upD), fMat);
            up.position.set(wx + (isHoriz ? s * (winW / 2 + 0.035) : 0), winY, wz + (isHoriz ? 0 : s * (winW / 2 + 0.035)));
            scene.add(up); groups.walls.push(up);
        });
        // Glass panes
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x88eeff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
        const gW = isHoriz ? winW - 0.08 : wallT * 0.4, gD = isHoriz ? wallT * 0.4 : winW - 0.08;
        [-0.5, 0.5].forEach(offset => {
            const g = new THREE.Mesh(new THREE.BoxGeometry(gW, winH / 2 - 0.04, gD), glassMat);
            g.position.set(wx, winY + offset * (winH / 2 - 0.02), wz);
            scene.add(g); groups.walls.push(g);
        });
    }

    // ── Render a user-placed door in the interior 3D scene ───
    function addInteriorDoor3D(room, door, ox, oz, baseY, floorH, voidMat) {
        const doorH = 2.1, doorW = door.width || 0.9, wallT = WT + 0.06;
        const pos = door.pos ?? 0.5;
        const wall = door.wall, isHoriz = wall === 'top' || wall === 'bottom';
        let dx, dz;
        switch (wall) {
            case 'top':    dx = ox + room.x + pos * room.width; dz = oz + room.z; break;
            case 'bottom': dx = ox + room.x + pos * room.width; dz = oz + room.z + room.depth; break;
            case 'left':   dx = ox + room.x; dz = oz + room.z + pos * room.depth; break;
            case 'right':  dx = ox + room.x + room.width; dz = oz + room.z + pos * room.depth; break;
            default: return;
        }
        // Dark void opening
        const vW = isHoriz ? doorW : wallT, vD = isHoriz ? wallT : doorW;
        const vm = new THREE.Mesh(new THREE.BoxGeometry(vW, doorH, vD), voidMat);
        vm.position.set(dx, baseY + doorH / 2, dz); scene.add(vm); groups.walls.push(vm);

        // Frame
        const frameC = currentStyle === 'luxury' ? 0xaa8800 : currentStyle === 'traditional' ? 0x8b4513 : 0x333344;
        const fMat = mat(frameC, 0.5, 0.2);
        const fW = isHoriz ? doorW + 0.16 : wallT + 0.06, fD = isHoriz ? wallT + 0.06 : doorW + 0.16;
        const topBar = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.1, fD), fMat);
        topBar.position.set(dx, baseY + doorH + 0.05, dz); scene.add(topBar); groups.walls.push(topBar);
        [-1, 1].forEach(s => {
            const upW = isHoriz ? 0.09 : fW, upD = isHoriz ? fD : 0.09;
            const up = new THREE.Mesh(new THREE.BoxGeometry(upW, doorH, upD), fMat);
            up.position.set(dx + (isHoriz ? s * (doorW / 2 + 0.045) : 0), baseY + doorH / 2, dz + (isHoriz ? 0 : s * (doorW / 2 + 0.045)));
            scene.add(up); groups.walls.push(up);
        });
        // Door panel (slightly ajar)
        const doorC = currentStyle === 'traditional' ? 0x5c3317 : currentStyle === 'luxury' ? 0x0d0d1a : 0x1a2040;
        const dMat = mat(doorC, 0.6, 0);
        const panelW = isHoriz ? doorW - 0.05 : 0.06, panelD = isHoriz ? 0.06 : doorW - 0.05;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, doorH - 0.06, panelD), dMat);
        const pivot = new THREE.Object3D();
        pivot.position.set(dx + (isHoriz ? -(doorW / 2 - 0.03) : 0), baseY + doorH / 2, dz + (isHoriz ? 0 : -(doorW / 2 - 0.03)));
        panel.position.set(isHoriz ? doorW / 2 - 0.03 : 0, 0, isHoriz ? 0 : doorW / 2 - 0.03);
        pivot.rotation.y = isHoriz ? -0.42 : 0.42;
        pivot.add(panel); scene.add(pivot); groups.walls.push(pivot);
    }

    // ── Floor badge for multi-floor buildings ─────────────────
    function buildFloorBadge(floor, floorIdx, HW, HD, baseY, floorH) {
        const c = document.createElement('canvas');
        c.width = 200; c.height = 48;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(20,30,60,0.82)';
        ctx.fillRect(0, 0, 200, 48);
        ctx.fillStyle = '#7ec8e3';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(floor.name || `Floor ${floorIdx + 1}`, 100, 24);
        const tex = new THREE.CanvasTexture(c);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sp.scale.set(2.0, 0.48, 1);
        sp.position.set(-HW / 2 - 1.2, baseY + floorH / 2, -HD / 2);
        scene.add(sp); groups.labels.push(sp);
    }

    // ── Interior partition walls (simple grid between rooms) ──
    // ── Exterior walls with balcony openings ─────────────────
    function buildExteriorWalls(rooms, HW, HD, ox, oz, wy, floorH, baseY, wMat, wMatI) {
        const THRESH = 0.35;
        const balconies = rooms.filter(r => r.type === 'balcony');

        // Helper: build wall segments along X axis skipping balcony spans
        function segsX(skipRanges) {
            const sorted = skipRanges.slice().sort((a,b) => a.from - b.from);
            const segs = []; let cur = ox;
            sorted.forEach(({from, to}) => { if (from > cur + 0.01) segs.push({from: cur, to: from}); cur = Math.max(cur, to); });
            if (cur < ox + HW - 0.01) segs.push({from: cur, to: ox + HW});
            return segs;
        }
        function segsZ(skipRanges) {
            const sorted = skipRanges.slice().sort((a,b) => a.from - b.from);
            const segs = []; let cur = oz;
            sorted.forEach(({from, to}) => { if (from > cur + 0.01) segs.push({from: cur, to: from}); cur = Math.max(cur, to); });
            if (cur < oz + HD - 0.01) segs.push({from: cur, to: oz + HD});
            return segs;
        }

        // Collect balcony spans per boundary edge
        const skipFront = [], skipBack = [], skipLeft = [], skipRight = [];
        balconies.forEach(r => {
            if (r.z < THRESH)               skipFront.push({from: ox + r.x,         to: ox + r.x + r.width});
            if (r.z + r.depth > HD - THRESH) skipBack.push ({from: ox + r.x,         to: ox + r.x + r.width});
            if (r.x < THRESH)               skipLeft.push ({from: oz + r.z,         to: oz + r.z + r.depth});
            if (r.x + r.width > HW - THRESH) skipRight.push({from: oz + r.z,         to: oz + r.z + r.depth});
        });

        const addWallSeg = (w, h, d, x, y, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wMat);
            m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
            scene.add(m); groups.walls.push(m);
        };

        // Front wall (z = oz)
        segsX(skipFront).forEach(({from, to}) => {
            const w = to - from, cx = (from + to) / 2;
            addWallSeg(w + WT, floorH, WT, cx, wy, oz);
        });
        // Back wall (z = oz + HD)
        segsX(skipBack).forEach(({from, to}) => {
            const w = to - from, cx = (from + to) / 2;
            addWallSeg(w + WT, floorH, WT, cx, wy, oz + HD);
        });
        // Left wall (x = ox)
        segsZ(skipLeft).forEach(({from, to}) => {
            const d = to - from, cz = (from + to) / 2;
            addWallSeg(WT, floorH, d + WT, ox, wy, cz);
        });
        // Right wall (x = ox + HW)
        segsZ(skipRight).forEach(({from, to}) => {
            const d = to - from, cz = (from + to) / 2;
            addWallSeg(WT, floorH, d + WT, ox + HW, wy, cz);
        });

        // ── For each balcony: glass balustrade + slab + brackets ──────
        const railColor = currentStyle === 'luxury' ? 0xc9a84c :
                          currentStyle === 'traditional' ? 0x5c3d1e :
                          currentStyle === 'minimalist'  ? 0x999999 : 0x607080;
        const metalMat = new THREE.MeshStandardMaterial({color: railColor, roughness: 0.35, metalness: 0.55});
        const glassMat = new THREE.MeshStandardMaterial({color: 0x88ccee, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide});
        const slabMat  = new THREE.MeshStandardMaterial({color: 0xb8bcc4, roughness: 0.88});
        const bracketMat = new THREE.MeshStandardMaterial({color: 0x555566, roughness: 0.7});

        balconies.forEach(r => {
            const rcx = ox + r.x + r.width / 2;
            const rcz = oz + r.z + r.depth / 2;
            const flY  = baseY;
            const openFront = r.z < THRESH;
            const openBack  = r.z + r.depth > HD - THRESH;
            const openLeft  = r.x < THRESH;
            const openRight = r.x + r.width > HW - THRESH;

            // Balcony slab
            const slab = new THREE.Mesh(new THREE.BoxGeometry(r.width + WT, 0.14, r.depth + WT), slabMat);
            slab.position.set(rcx, flY + 0.09, rcz);
            slab.castShadow = true; slab.receiveShadow = true;
            scene.add(slab); groups.walls.push(slab);

            const railH = 1.05;

            function addRail(isH, cx2, cz2, len) {
                // Bottom bar
                const bMesh = new THREE.Mesh(new THREE.BoxGeometry(isH ? len : WT * 0.5, 0.06, isH ? WT * 0.5 : len), metalMat);
                bMesh.position.set(cx2, flY + 0.08, cz2); scene.add(bMesh); groups.walls.push(bMesh);
                // Top handrail
                const tMesh = new THREE.Mesh(new THREE.BoxGeometry(isH ? len + 0.04 : 0.1, 0.08, isH ? 0.1 : len + 0.04), metalMat);
                tMesh.position.set(cx2, flY + railH + 0.04, cz2); scene.add(tMesh); groups.walls.push(tMesh);
                // Glass panel
                const gMesh = new THREE.Mesh(new THREE.BoxGeometry(isH ? len - 0.06 : 0.05, railH - 0.1, isH ? 0.05 : len - 0.06), glassMat);
                gMesh.position.set(cx2, flY + railH / 2 + 0.05, cz2); scene.add(gMesh); groups.walls.push(gMesh);
                // Corner posts
                [-0.5, 0.5].forEach(s => {
                    const px = isH ? cx2 + s * (len - 0.06) : cx2;
                    const pz = isH ? cz2 : cz2 + s * (len - 0.06);
                    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, railH, 0.07), metalMat);
                    post.position.set(px, flY + railH / 2, pz); post.castShadow = true;
                    scene.add(post); groups.walls.push(post);
                });
            }

            // Slab edge fascia + balustrade on each open side
            if (openFront) {
                addRail(true, rcx, oz + r.z + WT * 0.5, r.width - 0.04);
                const f = new THREE.Mesh(new THREE.BoxGeometry(r.width + WT, 0.13, WT + 0.04), slabMat);
                f.position.set(rcx, flY + 0.14, oz + r.z - WT * 0.5); scene.add(f); groups.walls.push(f);
            }
            if (openBack) {
                addRail(true, rcx, oz + r.z + r.depth - WT * 0.5, r.width - 0.04);
                const f = new THREE.Mesh(new THREE.BoxGeometry(r.width + WT, 0.13, WT + 0.04), slabMat);
                f.position.set(rcx, flY + 0.14, oz + r.z + r.depth + WT * 0.5); scene.add(f); groups.walls.push(f);
            }
            if (openLeft) {
                addRail(false, ox + r.x + WT * 0.5, rcz, r.depth - 0.04);
                const f = new THREE.Mesh(new THREE.BoxGeometry(WT + 0.04, 0.13, r.depth + WT), slabMat);
                f.position.set(ox + r.x - WT * 0.5, flY + 0.14, rcz); scene.add(f); groups.walls.push(f);
            }
            if (openRight) {
                addRail(false, ox + r.x + r.width - WT * 0.5, rcz, r.depth - 0.04);
                const f = new THREE.Mesh(new THREE.BoxGeometry(WT + 0.04, 0.13, r.depth + WT), slabMat);
                f.position.set(ox + r.x + r.width + WT * 0.5, flY + 0.14, rcz); scene.add(f); groups.walls.push(f);
            }

            // Structural brackets under slab (visible from exterior)
            const bracketCount = Math.max(2, Math.floor(Math.max(r.width, r.depth) / 2.2));
            for (let bi = 0; bi < bracketCount; bi++) {
                const t = (bi + 0.5) / bracketCount;
                const brk = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        (openFront || openBack) ? 0.12 : r.width * 0.82,
                        0.10,
                        (openFront || openBack) ? r.depth * 0.82 : 0.12
                    ), bracketMat
                );
                brk.position.set(
                    (openFront || openBack) ? ox + r.x + t * r.width : rcx,
                    flY + 0.03,
                    (openFront || openBack) ? rcz : oz + r.z + t * r.depth
                );
                brk.castShadow = true; scene.add(brk); groups.walls.push(brk);
            }
        });

        // Full walls on sides with NO balcony
        if (skipFront.length === 0) addWallSeg(HW + WT * 2, floorH, WT, 0, wy, oz);
        if (skipBack.length  === 0) addWallSeg(HW + WT * 2, floorH, WT, 0, wy, oz + HD);
        if (skipLeft.length  === 0) addWallSeg(WT, floorH, HD + WT * 2, ox, wy, 0);
        if (skipRight.length === 0) addWallSeg(WT, floorH, HD + WT * 2, ox + HW, wy, 0);
    }

    function buildInteriorWalls(rooms, HW, HD, ox, oz, wy, floorH) {
        const wallH = floorH || WALL_H;
        const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;
        const iwColor = T.interiorWall;
        const iwRough = T.wallRough;
        const edges = new Set();

        // Build a set of staircase room boundaries to skip
        const staircaseEdges = new Set();
        rooms.filter(r => r.type === 'staircase').forEach(r => {
            // Mark all four edges of the staircase room as open
            staircaseEdges.add(`v:${(r.x + r.width).toFixed(2)}`);
            staircaseEdges.add(`h:${(r.z + r.depth).toFixed(2)}`);
        });

        rooms.forEach(r => {
            if (r.type === 'staircase') return; // don't generate walls FROM staircase rooms
            const rx = r.x + r.width;
            if (rx < HW) edges.add(`v:${rx.toFixed(2)}:${r.z.toFixed(2)}:${(r.z + r.depth).toFixed(2)}`);
            const rz = r.z + r.depth;
            if (rz < HD) edges.add(`h:${rz.toFixed(2)}:${r.x.toFixed(2)}:${(r.x + r.width).toFixed(2)}`);
        });

        edges.forEach(key => {
            const parts = key.split(':');
            if (parts[0] === 'v') {
                const x = parseFloat(parts[1]);
                const z1 = parseFloat(parts[2]), z2 = parseFloat(parts[3]);
                const cz = oz + (z1 + z2) / 2, len = z2 - z1;
                const m = new THREE.Mesh(new THREE.BoxGeometry(WT, wallH, len),
                    new THREE.MeshStandardMaterial({ color: iwColor, roughness: iwRough, side: THREE.DoubleSide }));
                m.position.set(ox + x, wy, cz); m.castShadow = true; scene.add(m); groups.walls.push(m);
            } else {
                const z = parseFloat(parts[1]);
                const x1 = parseFloat(parts[2]), x2 = parseFloat(parts[3]);
                const cx = ox + (x1 + x2) / 2, len = x2 - x1;
                const m = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, WT),
                    new THREE.MeshStandardMaterial({ color: iwColor, roughness: iwRough, side: THREE.DoubleSide }));
                m.position.set(cx, wy, oz + z); m.castShadow = true; scene.add(m); groups.walls.push(m);
            }
        });
    }

    // ── Auto-windows (used when no user-placed windows exist) ──
    function buildWindows(rooms, HW, HD, ox, oz, baseY, floorH) {
        const by = (baseY !== undefined) ? baseY : 0.22;
        const fH = (floorH !== undefined) ? floorH : WALL_H;
        const wy2 = by + fH * 0.62;
        rooms.forEach(room => {
            if (room.type === 'balcony') return; // balcony has open wall — no auto-window
            const cx = ox + room.x + room.width / 2;
            const cz = oz + room.z + room.depth / 2;
            // Front face window
            if (room.z < 1) {
                addWindow(cx, wy2, oz + room.z, 0, Math.min(room.width * 0.45, 1.6), 1.1);
            }
            // Back face window
            if (room.z + room.depth > HD - 1) {
                addWindow(cx, wy2, oz + room.z + room.depth, 0, Math.min(room.width * 0.35, 1.2), 0.9);
            }
            // Left face window
            if (room.x < 1) {
                addWindow(ox + room.x, wy2, cz, Math.PI / 2, Math.min(room.depth * 0.35, 1.1), 0.9);
            }
            // Right face window
            if (room.x + room.width > HW - 1) {
                addWindow(ox + room.x + room.width, wy2, cz, Math.PI / 2, Math.min(room.depth * 0.35, 1.1), 0.9);
            }
        });
    }

    function addWindow(x, y, z, ry, w, h) {
        const g = new THREE.Group();
        g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), glassM()), {}));
        // frame bars
        [[w + 0.06, 0.05, 0.05, 0, h / 2, 0], [w + 0.06, 0.05, 0.05, 0, -h / 2, 0],
         [0.05, h, 0.05, w / 2, 0, 0], [0.05, h, 0.05, -w / 2, 0, 0]].forEach(([fw, fh, fd, fx, fy, fz]) => {
            const fm = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), mat(0xffffff, 0.5));
            fm.position.set(fx, fy, fz);
            g.add(fm);
        });
        g.position.set(x, y, z);
        g.rotation.y = ry;
        scene.add(g);
    }

    // ── Roof (base = total accumulated floor height) ─────────
    function buildRoof(pd, HW, HD, ox, oz, totalBaseY) {
        const roofType = pd.specifications?.roofType || 'pitched';
        // Use totalBaseY if provided (multi-floor), else fall back to single-floor calc
        const base = (totalBaseY !== undefined) ? totalBaseY : ((pd.floors?.[0]?.height || WALL_H) + 0.22);
        const overhang = 0.8;
        const rW = HW / 2 + overhang, rD = HD / 2 + overhang;

        const roofColorMap = { modern: 0x2a3550, minimalist: 0xbbbbc8, traditional: 0x7b3f00, luxury: 0x111122 };
        const ridgeColorMap = { modern: 0x1a2236, minimalist: 0x999999, traditional: 0x3a1e08, luxury: 0x0a0a14 };
        const roofColor = roofColorMap[currentStyle] || 0x7a4a2a;
        const ridgeColor = ridgeColorMap[currentStyle] || 0x3a1e08;

        if (roofType === 'flat') {
            box(HW + overhang * 2, 0.22, HD + overhang * 2, roofColor, 0, base + 0.11, 0, 0.85, 'roof');
        } else {
            const peak = roofType === 'gambrel' ? 5.5 : roofType === 'hip' ? 4.0 : 3.8;
            const rv = new Float32Array([
                -rW, base, -rD,  rW, base, -rD,
                 rW, base,  rD, -rW, base,  rD,
                -rW, base + peak, 0,  rW, base + peak, 0,
            ]);
            const ri = [0,1,5, 0,5,4, 2,3,4, 2,4,5, 0,4,3, 1,5,2, 0,3,2, 0,2,1];
            const roofGeo = new THREE.BufferGeometry();
            roofGeo.setAttribute('position', new THREE.BufferAttribute(rv, 3));
            roofGeo.setIndex(ri);
            roofGeo.computeVertexNormals();
            const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: currentStyle === 'luxury' ? 0.4 : 0.85, metalness: currentStyle === 'modern' ? 0.15 : 0, side: THREE.DoubleSide });
            const rm = new THREE.Mesh(roofGeo, roofMat);
            rm.castShadow = true;
            scene.add(rm);
            groups.roof.push(rm);

            // Ridge
            box(HW + overhang * 2, 0.12, 0.12, ridgeColor, 0, base + peak, 0, 0.9, 'roof');

            // Chimney (traditional only)
            if (currentStyle === 'traditional') {
                box(0.75, 2.2, 0.75, 0x8a7a6a, ox + HW * 0.25, base + peak * 0.5 + 1.1, oz + HD * 0.3, 0.9, 'roof');
                box(1.05, 0.12, 1.05, 0x5a4a3a, ox + HW * 0.25, base + peak * 0.5 + 2.3, oz + HD * 0.3, 0.9, 'roof');
            }
        }
    }

    // ── Furniture ────────────────────────────────────────────
    function buildRoomFurniture(room, ox, oz, baseY) {
        const cx = ox + room.x + room.width / 2;
        const cz = oz + room.z + room.depth / 2;
        const fl = (baseY !== undefined ? baseY : 0.22) + 0.05; // floor Y offset per floor
        const rw = room.width, rd = room.depth;

        // dispatch by type
        const fn = {
            living:    furnishLiving,
            kitchen:   furnishKitchen,
            dining:    furnishDining,
            bedroom:   furnishBedroom,
            bathroom:  furnishBathroom,
            office:    furnishOffice,
            staircase: furnishStaircase,
            garage:    furnishGarage,
            balcony:   furnishBalcony,
            hallway:   furnishHallway,
        }[room.type];

        if (fn) fn(cx, cz, fl, rw, rd, room, baseY);
        else furnishDefault(cx, cz, fl, rw, rd);
    }

    // ── Staircase geometry ────────────────────────────────────
    function furnishStaircase(cx, cz, fl, rw, rd, room, baseY) {
        const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;
        const floorH = room.height || WALL_H;
        const baseFloorY = baseY !== undefined ? baseY : 0.22;

        // Step dimensions fitted to the room
        const stepCount = Math.max(8, Math.ceil(floorH / 0.175));
        const stepH     = floorH / stepCount;
        const stepD     = Math.min(rd / stepCount, 0.3);   // depth per step, capped
        const stairW    = Math.min(rw - 0.2, 1.4);         // width inside room
        const totalDepth = stepD * stepCount;

        // Style-aware materials
        const stepColor = currentStyle === 'luxury'       ? 0xd4b896 :
                          currentStyle === 'traditional'  ? 0x9b6f3d :
                          currentStyle === 'minimalist'   ? 0xdcdcdc : 0x7a8fa6;
        const riserColor = currentStyle === 'luxury'      ? 0xfafafa :
                           currentStyle === 'traditional' ? 0xeadcc8 :
                           currentStyle === 'minimalist'  ? 0xffffff : 0xd0d8e4;
        const railColor  = currentStyle === 'luxury'      ? 0xc9a84c :
                           currentStyle === 'traditional' ? 0x5c2f0a :
                           currentStyle === 'minimalist'  ? 0x888888 : 0x4a6fa5;
        const postColor  = railColor;

        const stepMat  = mat(stepColor,  currentStyle === 'luxury' ? 0.3 : 0.7, currentStyle === 'luxury' ? 0.3 : 0);
        const riserMat = mat(riserColor, 0.85, 0);
        const railMat  = mat(railColor,  0.4, currentStyle === 'luxury' ? 0.6 : 0.15);
        const postMat  = mat(postColor,  0.4, currentStyle === 'luxury' ? 0.6 : 0.1);

        // Origin: stairs run from cz - totalDepth/2 → cz + totalDepth/2, rising in Y
        const startX = cx - stairW / 2;
        const startZ = cz - totalDepth / 2;

        // ── Steps (tread + riser per step) ──
        for (let i = 0; i < stepCount; i++) {
            const stepY    = baseFloorY + i * stepH;
            const stepZpos = startZ + i * stepD + stepD / 2;

            // Tread (horizontal surface)
            const tread = new THREE.Mesh(
                new THREE.BoxGeometry(stairW, stepH * 0.18, stepD + 0.02),
                stepMat
            );
            tread.position.set(cx, stepY + stepH - stepH * 0.09, stepZpos);
            tread.castShadow = true; tread.receiveShadow = true;
            scene.add(tread); groups.furniture.push(tread);

            // Riser (vertical face)
            const riser = new THREE.Mesh(
                new THREE.BoxGeometry(stairW, stepH, 0.04),
                riserMat
            );
            riser.position.set(cx, stepY + stepH / 2, startZ + i * stepD);
            riser.castShadow = true; riser.receiveShadow = true;
            scene.add(riser); groups.furniture.push(riser);

            // Stringer (solid side support block under step)
            const stringer = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, stepH, stepD),
                stepMat
            );
            [startX - 0.03, startX + stairW + 0.03].forEach(sx => {
                const s = stringer.clone();
                s.position.set(sx, stepY + stepH / 2, stepZpos);
                s.castShadow = true; s.receiveShadow = true;
                scene.add(s); groups.furniture.push(s);
            });
        }

        // ── Under-stair solid wedge (stringer board) ──
        const wedgeH   = floorH * 0.5;
        const wedgeGeo = new THREE.BoxGeometry(stairW, 0.06, totalDepth);
        const wedge    = new THREE.Mesh(wedgeGeo, stepMat);
        wedge.position.set(cx, baseFloorY + wedgeH * 0.35, cz);
        wedge.rotation.x = -Math.atan2(floorH, totalDepth);
        wedge.castShadow = true; wedge.receiveShadow = true;
        scene.add(wedge); groups.furniture.push(wedge);

        // ── Balusters (vertical posts) ──
        const balSpacing = Math.max(2, Math.round(stepCount / 8));
        for (let i = 0; i <= stepCount; i += balSpacing) {
            const balY     = baseFloorY + i * stepH;
            const balZpos  = startZ + i * stepD;
            const balH     = 0.9;

            [startX - 0.03, startX + stairW + 0.03].forEach(bx => {
                const post = new THREE.Mesh(
                    new THREE.BoxGeometry(0.05, balH, 0.05),
                    postMat
                );
                post.position.set(bx, balY + balH / 2, balZpos);
                post.castShadow = true;
                scene.add(post); groups.furniture.push(post);
            });
        }

        // ── Handrail (angled rod along both sides) ──
        const railLen   = Math.sqrt(totalDepth * totalDepth + floorH * floorH);
        const railAngle = Math.atan2(floorH, totalDepth);
        const railY     = baseFloorY + floorH / 2 + 0.9;
        const railZ     = cz;

        [startX - 0.03, startX + stairW + 0.03].forEach(rx => {
            // Main handrail bar
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.06, railLen),
                railMat
            );
            rail.position.set(rx, railY, railZ);
            rail.rotation.x = railAngle;
            rail.castShadow = true;
            scene.add(rail); groups.furniture.push(rail);

            // Decorative end cap at top
            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                railMat
            );
            cap.position.set(rx, baseFloorY + floorH + 0.9, startZ + totalDepth);
            scene.add(cap); groups.furniture.push(cap);
        });

        // ── Top landing platform ──
        const landing = new THREE.Mesh(
            new THREE.BoxGeometry(stairW, 0.12, Math.min(rd * 0.2, 0.8)),
            stepMat
        );
        landing.position.set(cx, baseFloorY + floorH + 0.06, startZ + totalDepth + Math.min(rd * 0.1, 0.4));
        landing.castShadow = true; landing.receiveShadow = true;
        scene.add(landing); groups.furniture.push(landing);

        // ── Newel post at bottom ──
        const newelBot = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 1.05, 0.12),
            postMat
        );
        newelBot.position.set(cx - stairW / 2 - 0.06, baseFloorY + 0.525, startZ - 0.06);
        newelBot.castShadow = true;
        scene.add(newelBot); groups.furniture.push(newelBot);

        // Newel ball/cap
        const newelCap = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.18, 0.18),
            railMat
        );
        newelCap.position.set(cx - stairW / 2 - 0.06, baseFloorY + 1.14, startZ - 0.06);
        scene.add(newelCap); groups.furniture.push(newelCap);
    }

    function furnishLiving(cx, cz, fl, rw, rd) {
        // Rug
        addMesh(new THREE.BoxGeometry(Math.min(rw * 0.65, 3.2), 0.02, Math.min(rd * 0.5, 2.2)),
            mat(0x8b3a3a, 0.95), cx - rw * 0.05, fl + 0.01, cz + rd * 0.05, 0, 0, 'furniture');
        // Sofa body
        box(Math.min(rw * 0.55, 2.8), 0.5, 0.85, 0x3d5a80, cx - rw * 0.05, fl + 0.25, cz + rd * 0.28, 0.85, 'furniture');
        // Sofa back
        box(Math.min(rw * 0.55, 2.8), 0.45, 0.15, 0x3d5a80, cx - rw * 0.05, fl + 0.7, cz + rd * 0.28 + 0.38, 0.85, 'furniture');
        // Sofa arm left/right
        [-1, 1].forEach(s => box(0.15, 0.5, 0.85, 0x2d4a70, cx - rw * 0.05 + s * Math.min(rw * 0.275, 1.4), fl + 0.25, cz + rd * 0.28, 0.85, 'furniture'));
        // Cushions
        [-0.6, 0, 0.6].forEach(dx => box(0.6, 0.12, 0.5, 0xf5e6c8, cx - rw * 0.05 + dx * Math.min(rw * 0.18, 0.7), fl + 0.58, cz + rd * 0.22, 0.8, 'furniture'));
        // Coffee table
        const ctW = Math.min(rw * 0.35, 1.2), ctD = Math.min(rd * 0.2, 0.7);
        box(ctW, 0.05, ctD, 0xaaccdd, cx - rw * 0.05, fl + 0.37, cz, 0.1, 'furniture');
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([lx,lz]) =>
            box(0.05, 0.37, 0.05, 0xb0b0b0, cx - rw * 0.05 + lx * ctW * 0.42, fl + 0.18, cz + lz * ctD * 0.42, 0.5, 'furniture'));
        // TV unit
        box(Math.min(rw * 0.5, 2.0), 0.45, 0.38, 0x2a1a0a, cx - rw * 0.05, fl + 0.22, cz - rd * 0.38, 0.7, 'furniture');
        box(Math.min(rw * 0.45, 1.7), 0.82, 0.04, 0x111111, cx - rw * 0.05, fl + 0.82, cz - rd * 0.38 - 0.02, 0.05, 'furniture');
        // Plant
        cyl(0.1, 0.13, 0.28, 8, 0x7a6040, cx + rw * 0.38, fl + 0.14, cz - rd * 0.35, 'furniture');
        cyl(0.22, 0.06, 0.45, 8, 0x2d5a1b, cx + rw * 0.38, fl + 0.47, cz - rd * 0.35, 'furniture');
        cyl(0.30, 0.12, 0.35, 9, 0x3a7a22, cx + rw * 0.38, fl + 0.75, cz - rd * 0.35, 'furniture');
        // Floor lamp
        cyl(0.035, 0.035, 1.6, 6, 0xb0b0b0, cx + rw * 0.38, fl + 0.8, cz + rd * 0.08, 'furniture');
        cyl(0.22, 0.18, 0.25, 12, 0xfffde0, cx + rw * 0.38, fl + 1.72, cz + rd * 0.08, 'furniture');
    }

    function furnishKitchen(cx, cz, fl, rw, rd) {
        // Counter along back wall
        box(rw - 0.4, 0.88, 0.6, 0x5c3d1e, cx, fl + 0.44, cz - rd / 2 + 0.32, 0.7, 'furniture');
        box(rw - 0.35, 0.04, 0.65, 0xe8e4dc, cx, fl + 0.9, cz - rd / 2 + 0.32, 0.15, 'furniture');
        // Counter along side wall
        box(0.6, 0.88, rd * 0.55, 0x5c3d1e, cx + rw / 2 - 0.32, fl + 0.44, cz - rd * 0.1, 0.7, 'furniture');
        box(0.65, 0.04, rd * 0.55, 0xe8e4dc, cx + rw / 2 - 0.32, fl + 0.9, cz - rd * 0.1, 0.15, 'furniture');
        // Island
        const iW = Math.min(rw * 0.38, 1.4), iD = Math.min(rd * 0.28, 0.8);
        box(iW, 0.88, iD, 0x7a5535, cx - rw * 0.1, fl + 0.44, cz + rd * 0.18, 0.7, 'furniture');
        box(iW + 0.1, 0.04, iD + 0.1, 0xe8e4dc, cx - rw * 0.1, fl + 0.9, cz + rd * 0.18, 0.15, 'furniture');
        // Stools
        [-0.35, 0.35].forEach(dx => {
            cyl(0.04, 0.04, 0.62, 6, 0xb0b0b0, cx - rw * 0.1 + dx, fl + 0.31, cz + rd * 0.18 + iD * 0.7, 'furniture');
            box(0.33, 0.05, 0.33, 0x9b7048, cx - rw * 0.1 + dx, fl + 0.64, cz + rd * 0.18 + iD * 0.7, 0.75, 'furniture');
        });
        // Fridge
        box(0.7, 1.75, 0.65, 0xdedede, cx + rw / 2 - 0.38, fl + 0.87, cz + rd / 2 - 0.37, 0.3, 'furniture');
        // Hanging pendant over island
        cyl(0.035, 0.035, 0.7, 6, 0xb0b0b0, cx - rw * 0.1, WALL_H - 0.35, cz + rd * 0.18, 'furniture');
        cyl(0.18, 0.14, 0.18, 10, 0xfffde0, cx - rw * 0.1, WALL_H - 0.78, cz + rd * 0.18, 'furniture');
        // Upper cabinets (decorative boxes near ceiling)
        box(rw - 0.4, 0.55, 0.38, 0x6b4520, cx, WALL_H - 0.32, cz - rd / 2 + 0.21, 0.7, 'furniture');
    }

    function furnishDining(cx, cz, fl, rw, rd) {
        const tW = Math.min(rw * 0.52, 2.2), tD = Math.min(rd * 0.45, 1.1);
        // Table top & legs
        box(tW, 0.06, tD, 0x9b7048, cx, fl + 0.76, cz, 0.55, 'furniture');
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([lx,lz]) =>
            box(0.07, 0.76, 0.07, 0x5c3d1e, cx + lx * tW * 0.43, fl + 0.38, cz + lz * tD * 0.43, 0.7, 'furniture'));
        // Chairs around table
        const chairs = [
            [cx - tW * 0.7, cz, 0], [cx + tW * 0.7, cz, Math.PI],
            [cx, cz - tD * 0.85, Math.PI / 2], [cx, cz + tD * 0.85, -Math.PI / 2],
        ];
        chairs.forEach(([x, z, ry]) => {
            box(0.44, 0.05, 0.44, 0x7a5535, x, fl + 0.44, z, 0.7, 'furniture', ry);
            box(0.44, 0.48, 0.05, 0x7a5535, x, fl + 0.7, z + (ry === 0 ? -0.2 : ry === Math.PI ? 0.2 : 0), 0.7, 'furniture', ry);
            [[-0.17,-0.17],[0.17,-0.17],[-0.17,0.17],[0.17,0.17]].forEach(([lx,lz]) =>
                box(0.04, 0.44, 0.04, 0x5c3d1e, x + lx, fl + 0.22, z + lz, 0.7, 'furniture'));
        });
        // Sideboard
        box(Math.min(rw * 0.4, 1.5), 0.82, 0.38, 0x3a2010, cx + rw * 0.35, fl + 0.41, cz - rd / 2 + 0.22, 0.8, 'furniture');
        // Chandelier
        cyl(0.035, 0.035, 0.9, 6, 0xb0b0b0, cx, WALL_H - 0.45, cz, 'furniture');
        [-0.35, 0.35, 0, 0].forEach((dx, i) => {
            const dz = i < 2 ? 0 : (i === 2 ? -0.35 : 0.35);
            cyl(0.055, 0.045, 0.11, 8, 0xfffce0, cx + dx, WALL_H - 1.0, cz + dz, 'furniture');
        });
        // Vase on table
        cyl(0.08, 0.06, 0.28, 10, 0x7a9080, cx + tW * 0.15, fl + 0.9, cz - tD * 0.12, 'furniture');
    }

    function furnishBedroom(cx, cz, fl, rw, rd) {
        const bW = Math.min(rw * 0.55, 1.95);
        // Bed base
        box(bW, 0.22, Math.min(rd * 0.5, 2.1), 0x3a2010, cx - rw * 0.08, fl + 0.11, cz - rd * 0.08, 0.8, 'furniture');
        // Mattress
        box(bW - 0.06, 0.26, Math.min(rd * 0.48, 1.95), 0xeeeae2, cx - rw * 0.08, fl + 0.36, cz - rd * 0.08, 0.85, 'furniture');
        // Pillows
        [-bW * 0.24, bW * 0.24].forEach(dx =>
            box(bW * 0.42, 0.1, 0.42, 0xf5f0e8, cx - rw * 0.08 + dx, fl + 0.52, cz - rd * 0.08 - Math.min(rd * 0.22, 0.72), 0.9, 'furniture'));
        // Duvet
        box(bW - 0.07, 0.1, Math.min(rd * 0.32, 1.2), 0xe8ddd0, cx - rw * 0.08, fl + 0.53, cz - rd * 0.08 + Math.min(rd * 0.08, 0.25), 0.85, 'furniture');
        // Headboard
        box(bW + 0.08, 0.62, 0.1, 0x3a2010, cx - rw * 0.08, fl + 0.53, cz - rd * 0.08 - Math.min(rd * 0.25, 0.88), 0.65, 'furniture');
        // Nightstands
        const nsOff = bW / 2 + 0.32;
        [-nsOff, nsOff].forEach(dx => {
            box(0.48, 0.52, 0.38, 0x5c3d1e, cx - rw * 0.08 + dx, fl + 0.26, cz - rd * 0.08 - Math.min(rd * 0.18, 0.6), 0.75, 'furniture');
            cyl(0.07, 0.06, 0.28, 8, 0xfffde0, cx - rw * 0.08 + dx, fl + 0.66, cz - rd * 0.08 - Math.min(rd * 0.18, 0.6), 'furniture');
        });
        // Wardrobe
        box(Math.min(rw * 0.45, 1.8), 2.1, 0.55, 0x2a1508, cx + rw * 0.3, fl + 1.05, cz + rd * 0.35, 0.75, 'furniture');
        // Plant
        cyl(0.12, 0.15, 0.3, 8, 0x6b5030, cx - rw * 0.38, fl + 0.15, cz + rd * 0.38, 'furniture');
        cyl(0.26, 0.07, 0.55, 9, 0x255c17, cx - rw * 0.38, fl + 0.57, cz + rd * 0.38, 'furniture');
        cyl(0.36, 0.15, 0.42, 9, 0x31762e, cx - rw * 0.38, fl + 0.97, cz + rd * 0.38, 'furniture');
        // Rug
        addMesh(new THREE.BoxGeometry(Math.min(rw * 0.5, 2.1), 0.02, Math.min(rd * 0.38, 1.6)),
            mat(0x5c7a6e, 0.95), cx - rw * 0.08, fl + 0.01, cz - rd * 0.08 + Math.min(rd * 0.18, 0.55), 0, 0, 'furniture');
    }

    function furnishBathroom(cx, cz, fl, rw, rd) {
        // Bathtub
        box(Math.min(rw * 0.55, 1.65), 0.5, Math.min(rd * 0.45, 0.78), 0xfafafa, cx - rw * 0.1, fl + 0.25, cz - rd * 0.2, 0.15, 'furniture');
        // Water in tub
        box(Math.min(rw * 0.52, 1.58), 0.07, Math.min(rd * 0.41, 0.72), 0xc8e8f0, cx - rw * 0.1, fl + 0.42, cz - rd * 0.2, 0.05, 'furniture');
        // Toilet
        box(0.44, 0.42, 0.58, 0xfafafa, cx + rw * 0.22, fl + 0.21, cz + rd * 0.28, 0.15, 'furniture');
        box(0.44, 0.08, 0.52, 0xfafafa, cx + rw * 0.22, fl + 0.46, cz + rd * 0.28 - 0.04, 0.15, 'furniture');
        // Sink
        box(0.52, 0.14, 0.38, 0xfafafa, cx + rw * 0.22, fl + 0.82, cz - rd * 0.3, 0.15, 'furniture');
        box(0.52, 0.82, 0.07, 0xfafafa, cx + rw * 0.22, fl + 0.41, cz - rd * 0.3 + 0.18, 0.2, 'furniture');
        // Faucet
        box(0.04, 0.14, 0.04, 0xcccccc, cx + rw * 0.22, fl + 0.99, cz - rd * 0.3 - 0.02, 0.4, 'furniture');
        box(0.14, 0.025, 0.025, 0xcccccc, cx + rw * 0.22, fl + 1.1, cz - rd * 0.3 - 0.02, 0.4, 'furniture');
        // Towel rack
        box(0.58, 0.035, 0.035, 0xbbbbbb, cx - rw * 0.2, fl + 1.28, cz - rd * 0.4, 0.35, 'furniture');
        [-0.24, 0.24].forEach(dx =>
            box(0.08, 0.28, 0.035, 0xbbbbbb, cx - rw * 0.2 + dx, fl + 1.14, cz - rd * 0.4, 0.35, 'furniture'));
        // Towel
        box(0.52, 0.045, 0.055, 0xff9966, cx - rw * 0.2, fl + 1.31, cz - rd * 0.4, 0.85, 'furniture');
    }

    function furnishOffice(cx, cz, fl, rw, rd) {
        // Desk
        const dW = Math.min(rw * 0.65, 1.8);
        box(dW, 0.04, Math.min(rd * 0.32, 0.8), 0x8b7048, cx - rw * 0.05, fl + 0.74, cz + rd * 0.1, 0.5, 'furniture');
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([lx,lz]) =>
            box(0.05, 0.74, 0.05, 0x111111, cx - rw * 0.05 + lx * dW * 0.45, fl + 0.37, cz + rd * 0.1 + lz * Math.min(rd * 0.16, 0.38), 0.5, 'furniture'));
        // Monitors
        [-0.38, 0.38].forEach(dx => {
            box(0.72, 0.44, 0.04, 0x111111, cx - rw * 0.05 + dx, fl + 1.14, cz + rd * 0.1 - 0.26, 0.1, 'furniture');
            box(0.08, 0.04, 0.1, 0x111111, cx - rw * 0.05 + dx, fl + 0.78, cz + rd * 0.1 - 0.26, 0.5, 'furniture');
        });
        // Keyboard
        box(0.55, 0.02, 0.2, 0x333333, cx - rw * 0.05, fl + 0.76, cz + rd * 0.1 - 0.12, 0.1, 'furniture');
        // Chair
        box(0.52, 0.055, 0.52, 0x111111, cx - rw * 0.05, fl + 0.5, cz + rd * 0.32, 0.8, 'furniture');
        box(0.52, 0.5, 0.055, 0x111111, cx - rw * 0.05, fl + 0.78, cz + rd * 0.32 + 0.28, 0.8, 'furniture');
        cyl(0.05, 0.06, 0.5, 6, 0xb0b0b0, cx - rw * 0.05, fl + 0.25, cz + rd * 0.32, 'furniture');
        // Bookshelf
        box(0.28, Math.min(rd * 0.35, 1.75), 0.85, 0x3a2010, cx + rw * 0.38, fl + Math.min(rd * 0.175, 0.87), cz - rd * 0.35, 0.8, 'furniture');
        [0.25, 0.6, 0.95, 1.3].forEach(y =>
            box(0.04, 0.02, 0.82, 0x8b6b3d, cx + rw * 0.38, fl + y, cz - rd * 0.35, 0.6, 'furniture'));
        // Books on shelf
        [[0.12, 0x3355aa],[0.42, 0xaa3333],[0.72, 0x338833],[1.05, 0x886633]].forEach(([y, c]) =>
            box(0.04, 0.2, 0.2, c, cx + rw * 0.39, fl + y + 0.1, cz - rd * 0.35, 0.85, 'furniture'));
        // Desk plant
        cyl(0.08, 0.1, 0.15, 8, 0x7a5030, cx + rw * 0.22, fl + 0.82, cz + rd * 0.12, 'furniture');
        cyl(0.13, 0.04, 0.22, 8, 0x2d7a1b, cx + rw * 0.22, fl + 0.97, cz + rd * 0.12, 'furniture');
    }

    // ── Garage GLB car loader (self-contained, no external CDN needed) ──
    function _loadGLTFLoader(cb) {
        if (THREE.GLTFLoader) { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
        s.onload = cb;
        s.onerror = () => { console.warn('GLTFLoader CDN failed'); cb(); };
        document.head.appendChild(s);
    }

    function furnishGarage(cx, cz, fl, rw, rd) {
        // ── Concrete floor overlay ─────────────────────────────────────
        box(rw - 0.1, 0.01, rd - 0.1, 0x606060, cx, fl + 0.005, cz, 0.95, 'furniture');

        // ── Garage Door — centered on wall, visible both sides ─────────
        const gdW = Math.min(rw * 0.72, 3.6);
        const gdH = Math.min(2.2, WALL_H * 0.78);
        const panelCount = 4;
        const panelH = gdH / panelCount;
        const doorZ = cz - rd / 2 + 0.03;

        for (let i = 0; i < panelCount; i++) {
            const py = fl + panelH * 0.5 + panelH * i;
            box(gdW, panelH - 0.03, 0.20, 0xd0cfc8, cx, py, doorZ - 0.05, 0.4, 'furniture');
            box(gdW - 0.05, 0.03, 0.11, 0xb0afaa, cx, py + panelH / 2 - 0.015, doorZ - 0.055, 0.3, 'furniture');
            [-1, 0, 1].forEach(k => {
                const sx = cx + k * (gdW * 0.32);
                if (Math.abs(k * gdW * 0.32) < gdW * 0.48)
                    box(0.04, panelH - 0.05, 0.115, 0xb8b7b0, sx, py, doorZ - 0.06, 0.35, 'furniture');
            });
        }
        box(gdW * 0.22, 0.05, 0.06, 0x888880, cx, fl + panelH * 0.5, doorZ - 0.1, 0.2, 'furniture');
        box(0.10, gdH + 0.08, 0.18, 0x505050, cx - gdW / 2 - 0.05, fl + gdH / 2, doorZ - 0.05, 0.6, 'furniture');
        box(0.10, gdH + 0.08, 0.18, 0x505050, cx + gdW / 2 + 0.05, fl + gdH / 2, doorZ - 0.05, 0.6, 'furniture');
        box(gdW + 0.22, 0.10, 0.18, 0x505050, cx, fl + gdH + 0.03, doorZ - 0.05, 0.6, 'furniture');

        // ── Door opener motor ──────────────────────────────────────────
        box(0.32, 0.22, 0.90,     0x444444, cx, WALL_H - 0.13, cz - rd * 0.22, 0.5, 'furniture');
        box(0.08, 0.08, rd * 0.5, 0x666666, cx, WALL_H - 0.07, cz - rd * 0.05, 0.4, 'furniture');

        // ── BMW M3 GLB car ─────────────────────────────────────────────
        const carX = cx, carZ = cz, carFloorY = fl + 0.01;

        function _fallbackCar() {
            box(1.82, 0.50, 4.0,  0x2a4a7f, carX, fl + 0.38, carZ, 0.3, 'furniture');
            box(1.52, 0.38, 1.95, 0x2a4a7f, carX, fl + 0.88, carZ - 0.28, 0.35, 'furniture');
            box(1.48, 0.34, 0.06, 0x111a2e, carX, fl + 0.88, carZ - 1.25, 0.05, 'furniture');
            box(1.48, 0.28, 0.06, 0x111a2e, carX, fl + 0.85, carZ + 0.70, 0.05, 'furniture');
            box(1.72, 0.20, 0.12, 0x222222, carX, fl + 0.22, carZ - 2.07, 0.4, 'furniture');
            box(1.72, 0.20, 0.12, 0x222222, carX, fl + 0.22, carZ + 2.07, 0.4, 'furniture');
            [-0.72, 0.72].forEach(dx => {
                box(0.30, 0.13, 0.06, 0xfffde0, carX + dx, fl + 0.42, carZ - 2.04, 0.05, 'furniture');
                box(0.30, 0.13, 0.06, 0xcc2200, carX + dx, fl + 0.42, carZ + 2.04, 0.15, 'furniture');
            });
            [[-0.96,-1.32],[0.96,-1.32],[-0.96,1.32],[0.96,1.32]].forEach(([wx, wz]) => {
                cyl(0.30, 0.30, 0.20, 16, 0x111111, carX + wx, fl + 0.30, carZ + wz, 'furniture');
                cyl(0.17, 0.17, 0.22, 10, 0x888888, carX + wx, fl + 0.30, carZ + wz, 'furniture');
            });
        }

        function _placeGLBCar() {
            if (!THREE.GLTFLoader) { _fallbackCar(); return; }
            try {
                const loader = new THREE.GLTFLoader();
                // Resolve path relative to the HTML page location
                const modelPath = (window.location.pathname.includes('project-viewer') ? '' : '') + 'models/bmw_m3.glb';
                loader.load(
                    modelPath,
                    function (gltf) {
                        const car = gltf.scene;
                        // Normalize to 4.4m length
                        const bb = new THREE.Box3().setFromObject(car);
                        const sz = new THREE.Vector3();
                        bb.getSize(sz);
                        const longest = Math.max(sz.x, sz.z);
                        if (longest === 0) { _fallbackCar(); return; }
                        const sc = 4.4 / longest;
                        car.scale.setScalar(sc);
                        // Floor-sit: lift so bottom = carFloorY
                        const bb2 = new THREE.Box3().setFromObject(car);
                        car.position.set(carX, carFloorY - bb2.min.y, carZ);
                        car.rotation.y = Math.PI; // nose toward door
                        car.traverse(c => {
                            if (c.isMesh) {
                                c.castShadow = true;
                                c.receiveShadow = true;
                                if (c.material) c.material.needsUpdate = true;
                            }
                        });
                        scene.add(car);
                        groups.furniture.push(car);
                    },
                    undefined,
                    function (e) { console.warn('BMW GLB failed:', e); _fallbackCar(); }
                );
            } catch (e) { console.warn('GLTFLoader error:', e); _fallbackCar(); }
        }

        _loadGLTFLoader(_placeGLBCar);

        // ── Wall shelving (RIGHT wall) ─────────────────────────────────
        const shelfAnchorX = cx + rw / 2 - 0.22;
        const shelfH = Math.min(WALL_H - 0.3, 2.1);
        const shelfD = Math.min(rd * 0.32, 1.3);
        box(0.06, shelfH, shelfD, 0x5c3d1e, shelfAnchorX, fl + shelfH / 2, cz - rd * 0.06, 0.8, 'furniture');
        [0.38, 0.82, 1.28, 1.72].forEach(sy => {
            if (sy < shelfH - 0.1)
                box(0.40, 0.04, shelfD - 0.04, 0x7a5535, shelfAnchorX - 0.17, fl + sy, cz - rd * 0.06, 0.6, 'furniture');
        });
        [-0.18, 0, 0.18].forEach((dz, i) =>
            cyl(0.07, 0.065, 0.18, 10, [0xcc4422, 0x336699, 0x449933][i],
                shelfAnchorX - 0.17, fl + 0.47, cz - rd * 0.06 + dz * (shelfD * 0.55), 'furniture'));
        box(0.36, 0.14, 0.20, 0xcc3300, shelfAnchorX - 0.17, fl + 1.43, cz - rd * 0.06, 0.5, 'furniture');

        // ── Workbench (LEFT wall) ──────────────────────────────────────
        const wbDepth = 0.60, wbLen = Math.min(rw * 0.36, 1.5);
        const wbCX = cx - rw / 2 + 0.06 + wbLen / 2;
        const wbCZ = cz + rd * 0.28;
        box(wbLen, 0.05, wbDepth, 0x6b4520, wbCX, fl + 0.88, wbCZ, 0.55, 'furniture');
        [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz]) =>
            box(0.06, 0.88, 0.06, 0x4a3010,
                wbCX + sx * (wbLen/2 - 0.06), fl + 0.44,
                wbCZ + sz * (wbDepth/2 - 0.06), 0.7, 'furniture'));
        box(wbLen, 0.95, 0.04, 0xd4b896, wbCX, fl + 1.42, wbCZ - wbDepth/2 + 0.02, 0.6, 'furniture');
        box(0.04, 0.28, 0.05, 0x333333, wbCX - wbLen*0.25, fl + 1.48, wbCZ - wbDepth/2 + 0.01, 0.3, 'furniture');
        box(0.17, 0.04, 0.05, 0x888800, wbCX + wbLen*0.1,  fl + 1.52, wbCZ - wbDepth/2 + 0.01, 0.3, 'furniture');
        box(0.22, 0.14, 0.18, 0x555555, wbCX + wbLen*0.32, fl + 0.97, wbCZ, 0.3, 'furniture');
        box(0.22, 0.18, 0.26, 0x8b6b3d, wbCX - wbLen*0.25, fl + 0.99, wbCZ, 0.6, 'furniture');

        // ── Fluorescent lights ─────────────────────────────────────────
        [cz - rd * 0.26, cz + rd * 0.12].forEach(lz => {
            box(0.12, 0.06, 1.2,  0xfffffaFF, cx, WALL_H - 0.03, lz, 0.05, 'furniture');
            box(0.10, 0.03, 1.18, 0xfffff0,   cx, WALL_H - 0.07, lz, 0.02, 'furniture');
        });

        // ── Floor oil stain ────────────────────────────────────────────
        box(0.7, 0.003, 0.5, 0x3a3a3a, cx - rw * 0.04, fl + 0.008, cz + rd * 0.1, 0.98, 'furniture');

        // ── Bins (front-left corner) ───────────────────────────────────
        const binX = cx - rw / 2 + 0.30, binZ = cz - rd / 2 + 0.35;
        cyl(0.18, 0.15, 0.55, 10, 0x226622, binX,        fl + 0.275, binZ, 'furniture');
        cyl(0.19, 0.19, 0.03, 10, 0x1a4a1a, binX,        fl + 0.565, binZ, 'furniture');
        cyl(0.18, 0.15, 0.55, 10, 0x1a44aa, binX + 0.45, fl + 0.275, binZ, 'furniture');
        cyl(0.19, 0.19, 0.03, 10, 0x112288, binX + 0.45, fl + 0.565, binZ, 'furniture');

        // ── Fire extinguisher (right-rear corner) ─────────────────────
        cyl(0.055, 0.05, 0.48, 10, 0xcc1100, cx + rw/2 - 0.18, fl + 0.84, cz + rd/2 - 0.18, 'furniture');
        cyl(0.030, 0.03, 0.08,  8, 0x888888, cx + rw/2 - 0.18, fl + 1.10, cz + rd/2 - 0.18, 'furniture');
    }

    function furnishBalcony(cx, cz, fl, rw, rd) {
        // ── Outdoor tile floor ────────────────────────────────────────
        const tileColor = currentStyle === 'luxury'      ? 0xd4c9b0 :
                          currentStyle === 'traditional' ? 0xc8b88a :
                          currentStyle === 'minimalist'  ? 0xe8e8e8 : 0xb0b8c8;
        box(rw - 0.05, 0.02, rd - 0.05, tileColor, cx, fl + 0.01, cz, 0.9, 'furniture');

        // Tile grout lines
        const tileSize = 0.6;
        for (let tx = -Math.floor(rw / tileSize / 2); tx <= Math.floor(rw / tileSize / 2); tx++) {
            box(0.015, 0.025, rd - 0.06, 0x888888, cx + tx * tileSize, fl + 0.018, cz, 0.3, 'furniture');
        }
        for (let tz = -Math.floor(rd / tileSize / 2); tz <= Math.floor(rd / tileSize / 2); tz++) {
            box(rw - 0.06, 0.025, 0.015, 0x888888, cx, fl + 0.018, cz + tz * tileSize, 0.3, 'furniture');
        }

        // ── Glass/metal railing — front edge ─────────────────────────
        const railingColor = currentStyle === 'luxury'      ? 0xc9a84c :
                             currentStyle === 'traditional' ? 0x5c3d1e :
                             currentStyle === 'minimalist'  ? 0x999999 : 0x607080;
        const railH  = 1.05;
        const frontZ = cz - rd / 2 + 0.08;

        // Bottom rail
        box(rw - 0.1, 0.06, 0.06, railingColor, cx, fl + 0.03, frontZ, 0.9, 'furniture');
        // Top handrail
        box(rw - 0.08, 0.08, 0.10, railingColor, cx, fl + railH, frontZ, 0.85, 'furniture');
        // Corner posts
        [-1, 1].forEach(side => {
            box(0.07, railH, 0.07, railingColor, cx + side * (rw / 2 - 0.1), fl + railH / 2, frontZ, 0.9, 'furniture');
        });
        // Balusters / glass panels
        const bCount = Math.max(3, Math.floor((rw - 0.2) / 0.48));
        const panelW = (rw - 0.2) / bCount - 0.02;
        for (let i = 1; i < bCount; i++) {
            const bx = cx - (rw / 2 - 0.1) + i * ((rw - 0.2) / bCount) - panelW / 2;
            if (currentStyle === 'modern' || currentStyle === 'minimalist') {
                // Frameless glass panel
                box(panelW, railH - 0.14, 0.02,
                    0x88ccff, bx,
                    fl + (railH - 0.14) / 2 + 0.06, frontZ, 0.28, 'furniture');
            } else {
                box(0.05, railH - 0.14, 0.05, railingColor,
                    cx - (rw / 2 - 0.1) + i * ((rw - 0.2) / bCount),
                    fl + railH / 2, frontZ, 0.8, 'furniture');
            }
        }

        // ── Side railings (left + right) ──────────────────────────────
        [-1, 1].forEach(side => {
            const sx = cx + side * (rw / 2 - 0.06);
            box(0.06, railH, rd - 0.16, railingColor, sx, fl + railH / 2, cz + 0.04, 0.85, 'furniture');
            box(0.10, 0.08, rd - 0.14, railingColor, sx, fl + railH, cz + 0.04, 0.85, 'furniture');
        });

        // ── Bistro table + 2 chairs ───────────────────────────────────
        if (rw >= 3.0 && rd >= 2.0) {
            const tX = cx + rw * 0.12, tZ = cz + rd * 0.18;
            // Tabletop
            cyl(0.44, 0.44, 0.04, 16, 0xd4aa70, tX, fl + 0.74, tZ, 'furniture');
            // Pedestal
            cyl(0.04, 0.04, 0.72, 8, 0x888888, tX, fl + 0.36, tZ, 'furniture');
            // Base disc
            cyl(0.26, 0.26, 0.04, 10, 0x707070, tX, fl + 0.02, tZ, 'furniture');

            // Chairs — ±0.82 gives clear gap from table edge (radius 0.44)
            [[-0.82, -1], [0.82, 1]].forEach(([dx, sign]) => {
                const chX = tX + dx;
                box(0.40, 0.04, 0.38, 0x8b5c2a, chX, fl + 0.46, tZ, 0.8, 'furniture');
                box(0.38, 0.40, 0.04, 0x8b5c2a, chX, fl + 0.68, tZ + sign * 0.19, 0.8, 'furniture');
                [[-0.15, -0.15],[-0.15, 0.15],[0.15, -0.15],[0.15, 0.15]].forEach(([lx, lz]) =>
                    box(0.04, 0.46, 0.04, 0x6b4520, chX + lx, fl + 0.23, tZ + lz, 0.85, 'furniture'));
            });
        }

        // ── Large terracotta floor planter (back-left corner) ─────────
        const pX = cx - rw / 2 + 0.35, pZ = cz + rd / 2 - 0.35;
        cyl(0.20, 0.24, 0.36, 12, 0xc87941, pX, fl + 0.18, pZ, 'furniture');
        cyl(0.18, 0.16, 0.07, 12, 0x5a3a10, pX, fl + 0.375, pZ, 'furniture');
        [[0.22, 0.24, 0], [0.18, 0.20, 0.28], [0.13, 0.14, 0.50], [0.08, 0.09, 0.68]].forEach(([r1, r2, h]) =>
            cyl(r1, r2, 0.16, 9, h < 0.4 ? 0x2d7a1a : 0x3a9a22, pX, fl + 0.44 + h, pZ, 'furniture'));

        // ── Tall potted plant (back-right corner) ─────────────────────
        const p2X = cx + rw / 2 - 0.35, p2Z = cz + rd / 2 - 0.35;
        cyl(0.14, 0.18, 0.30, 10, 0xb06030, p2X, fl + 0.15, p2Z, 'furniture');
        cyl(0.12, 0.10, 0.06, 10, 0x4a3010, p2X, fl + 0.33, p2Z, 'furniture');
        cyl(0.04, 0.05, 0.90, 8,  0x6b8c3a, p2X, fl + 0.78, p2Z, 'furniture');
        [0, 0.63, 1.26, 1.88, 2.51].forEach((angle, i) => {
            const lx = Math.sin(angle) * 0.38, lz = Math.cos(angle) * 0.38;
            box(0.06, 0.04, 0.42, 0x3a8822, p2X + lx * 0.5, fl + 1.22 - i * 0.04, p2Z + lz * 0.5, 0.7, 'furniture');
        });

        // ── Small succulent near rear wall ────────────────────────────
        const s1X = cx + rw * 0.32, s1Z = cz + rd / 2 - 0.14;
        cyl(0.09, 0.11, 0.14, 8, 0xa05a28, s1X, fl + 0.07, s1Z, 'furniture');
        cyl(0.08, 0.07, 0.03, 8, 0x3a2a10, s1X, fl + 0.15, s1Z, 'furniture');
        [0, 1.05, 2.09, 3.14, 4.19, 5.24].forEach(angle => {
            const lx = Math.sin(angle) * 0.07, lz = Math.cos(angle) * 0.07;
            box(0.05, 0.07, 0.05, 0x5aaa40, s1X + lx, fl + 0.19, s1Z + lz, 0.6, 'furniture');
        });

        // ── Hanging vines (modern / luxury only) ─────────────────────
        if (currentStyle === 'modern' || currentStyle === 'luxury') {
            [cx - rw * 0.18, cx, cx + rw * 0.18].forEach((vx, vi) => {
                const vz = cz - rd * 0.15;
                cyl(0.012, 0.012, 0.55 + vi * 0.08, 6, 0x2d6e1a, vx, fl + WALL_H - 0.30 - vi * 0.04, vz, 'furniture');
                [0.15, 0.32, 0.50].forEach((drop, li) => {
                    box(0.10, 0.06, 0.10, 0x3a8822,
                        vx + (li % 2 === 0 ? 0.06 : -0.06),
                        fl + WALL_H - 0.18 - drop - vi * 0.04, vz, 0.6, 'furniture');
                });
            });
        }

        // ── Flower box on front railing ───────────────────────────────
        if (rw >= 4.0) {
            const fbZ = cz - rd / 2 + 0.12;
            const fbW = Math.min(rw * 0.45, 1.8);
            box(fbW, 0.18, 0.18, 0x6b4520, cx, fl + 0.12, fbZ, 0.7, 'furniture');
            box(fbW - 0.04, 0.05, 0.14, 0x3a2a10, cx, fl + 0.225, fbZ, 0.9, 'furniture');
            const flowerColors = [0xff4466, 0xff8c00, 0xffdd00, 0xff69b4, 0xcc44ff];
            const flowerCount  = Math.floor(fbW / 0.28);
            for (let fi = 0; fi < flowerCount; fi++) {
                const fx = cx - fbW / 2 + 0.18 + fi * (fbW - 0.18) / Math.max(flowerCount - 1, 1);
                box(0.02, 0.22, 0.02, 0x3a7a1a, fx, fl + 0.36, fbZ, 0.6, 'furniture');
                cyl(0.07, 0.07, 0.04, 8, flowerColors[fi % flowerColors.length], fx, fl + 0.50, fbZ, 'furniture');
            }
        }

        // ── Outdoor wall lantern ──────────────────────────────────────
        const lnZ = cz + rd / 2 - 0.10;
        box(0.08, 0.26, 0.08, 0x444444, cx - rw * 0.28, fl + WALL_H - 0.50, lnZ, 0.8, 'furniture');
        cyl(0.065, 0.065, 0.15, 8, 0xfffde0, cx - rw * 0.28, fl + WALL_H - 0.28, lnZ, 'furniture');

        // ── Traditional drying pole ───────────────────────────────────
        if (currentStyle === 'traditional') {
            box(rw * 0.58, 0.03, 0.03, 0x8b5c2a, cx, fl + WALL_H - 0.65, cz - rd * 0.05, 0.8, 'furniture');
            [[-0.34, 0xcc4444], [0, 0xdddddd], [0.34, 0x4466aa]].forEach(([dx, col]) =>
                box(0.26, 0.40, 0.02, col, cx + dx * rw * 0.5,
                    fl + WALL_H - 0.87, cz - rd * 0.05, 0.85, 'furniture'));
        }

        // ── Pergola overhead beams (modern/luxury) ────────────────────
        if ((currentStyle === 'modern' || currentStyle === 'luxury') && rw >= 3.5) {
            const beamCol = currentStyle === 'luxury' ? 0x5c3d1e : 0x555566;
            [cx - rw * 0.2, cx, cx + rw * 0.2].forEach(bx => {
                box(0.07, 0.09, rd * 0.88, beamCol, bx, fl + WALL_H - 0.06, cz, 0.75, 'furniture');
            });
        }
    }
        
   function furnishHallway(cx, cz, fl, rw, rd) {
        const isLong = rw >= rd;

        // ── Wooden floor overlay ───────────────────────────────────────
        box(rw - 0.05, 0.018, rd - 0.05, 0xc8a07a, cx, fl + 0.009, cz, 0.85, 'furniture');
        const plankDir = isLong ? rw : rd;
        const plankCount = Math.floor(plankDir / 0.18);
        for (let i = 1; i < plankCount; i++) {
            const t = -plankDir / 2 + i * 0.18;
            if (isLong) box(0.006, 0.002, rd - 0.1, 0x9a6a3a, cx + t, fl + 0.02, cz, 0.4, 'furniture');
            else        box(rw - 0.1, 0.002, 0.006, 0x9a6a3a, cx, fl + 0.02, cz + t, 0.4, 'furniture');
        }

        // ── Skirting boards (kept fully inside boundary) ───────────────
        const skH = 0.12, skD = 0.025, skCol = 0xf5f0e8;
        if (isLong) {
            box(rw - 0.1, skH, skD, skCol, cx, fl + skH/2, cz - rd/2 + skD/2 + 0.02, 0.9, 'furniture');
            box(rw - 0.1, skH, skD, skCol, cx, fl + skH/2, cz + rd/2 - skD/2 - 0.02, 0.9, 'furniture');
        } else {
            box(skD, skH, rd - 0.1, skCol, cx - rw/2 + skD/2 + 0.02, fl + skH/2, cz, 0.9, 'furniture');
            box(skD, skH, rd - 0.1, skCol, cx + rw/2 - skD/2 - 0.02, fl + skH/2, cz, 0.9, 'furniture');
        }

        // ── Wall art frames (hung on wall, kept inside room) ───────────
        // Art hangs flat against interior wall face — offset inward so frame stays inside
        const artThick = 0.05;   // frame depth
        const artH = 0.42, artWid = Math.min((isLong ? rw : rd) * 0.22, 0.55);
        const artCount = Math.max(1, Math.floor((isLong ? rw : rd) / 2.4));
        const artSpan  = (isLong ? rw : rd) * 0.72;
        const wallY    = fl + 1.45;
        const artColors = [0x8b5e3c, 0x4a7c6f, 0x7a5c8a, 0xb5844a, 0x4a6b8a];

        for (let i = 0; i < artCount; i++) {
            const t = artCount === 1 ? 0 : -artSpan/2 + i * (artSpan / Math.max(1, artCount - 1));

            // Place art on the LONG walls, fully inside the room
            if (isLong) {
                // Art on front wall (z-negative side), fully inside
                const artX = cx + t;
                const artZ_front = cz - rd/2 + artThick/2 + 0.04; // inset from wall
                const artZ_back  = cz + rd/2 - artThick/2 - 0.04;
                // Canvas
                box(artWid, artH, artThick, artColors[i % artColors.length], artX, wallY, artZ_front, 0.9, 'furniture');
                // Frame border (slightly larger, same depth so stays inside)
                box(artWid + 0.06, artH + 0.06, artThick + 0.01, 0x3a2510, artX, wallY, artZ_front, 0.85, 'furniture');
                // Spotlight
                const sl = new THREE.PointLight(0xffcc66, 0.8, 1.5);
                sl.position.set(artX, wallY + 0.8, artZ_front + 0.3);
                scene.add(sl);
                // Also mirror on back wall if room is wide enough
                if (rd > 2.5) {
                    box(artWid, artH, artThick, artColors[(i+2) % artColors.length], artX, wallY, artZ_back, 0.9, 'furniture');
                    box(artWid + 0.06, artH + 0.06, artThick + 0.01, 0x3a2510, artX, wallY, artZ_back, 0.85, 'furniture');
                    const sl2 = new THREE.PointLight(0xffcc66, 0.8, 1.5);   
                    sl2.position.set(artX, wallY + 0.8, artZ_back - 0.3);
                    scene.add(sl2);
                }
            } else {
                // Art on left/right walls for portrait-oriented hallway
                const artZ = cz + t;
                const artX_left  = cx - rw/2 + artThick/2 + 0.04;
                const artX_right = cx + rw/2 - artThick/2 - 0.04;
                box(artThick, artH, artWid, artColors[i % artColors.length], artX_left, wallY, artZ, 0.9, 'furniture');
                box(artThick + 0.01, artH + 0.06, artWid + 0.06, 0x3a2510, artX_left, wallY, artZ, 0.85, 'furniture');
                const sl = new THREE.PointLight(0xffcc66, 0.8, 1.5);
                sl.position.set(artX_left + 0.3, wallY + 0.8, artZ);
                scene.add(sl);
                if (rw > 2.5) {
                    box(artThick, artH, artWid, artColors[(i+2) % artColors.length], artX_right, wallY, artZ, 0.9, 'furniture');
                    box(artThick + 0.01, artH + 0.06, artWid + 0.06, 0x3a2510, artX_right, wallY, artZ, 0.85, 'furniture');
                    const sl2 = new THREE.PointLight(0xffcc66, 0.8, 1.5);
                    sl2.position.set(artX_right - 0.3, wallY + 0.8, artZ);
                    scene.add(sl2);
                }
            }
        }

        // ── Pendant ceiling light ──────────────────────────────────────
        cyl(0.04, 0.05, 0.04, 8, 0x888888, cx, fl + 2.55, cz, 'furniture');
        cyl(0.005, 0.005, 0.4,  8, 0x999999, cx, fl + 2.35, cz, 'furniture');
        cyl(0.14, 0.06, 0.22, 12, 0xf5f0e8, cx, fl + 2.14, cz, 'furniture');
        const pendLight = new THREE.PointLight(0xffe8b0, 1.1, Math.max(rw, rd) * 1.4);
        pendLight.position.set(cx, fl + 2.0, cz);
        scene.add(pendLight);

        // ── Potted plants — clamped strictly inside boundary ───────────
        const margin = 0.35; // keep plants this far from walls
        const plantPositions = [];
        if (isLong) {
            const plantCount = Math.max(1, Math.floor(rw / 2.8));
            const span = rw - margin * 2;
            for (let i = 0; i < plantCount; i++) {
                const px = cx - span/2 + (plantCount === 1 ? span/2 : i * span / (plantCount - 1));
                const pzOff = Math.min(rd/2 - margin, rd * 0.32);
                plantPositions.push([px, cz + pzOff]);
                plantPositions.push([px, cz - pzOff]);
            }
        } else {
            const plantCount = Math.max(1, Math.floor(rd / 2.8));
            const span = rd - margin * 2;
            for (let i = 0; i < plantCount; i++) {
                const pz = cz - span/2 + (plantCount === 1 ? span/2 : i * span / (plantCount - 1));
                const pxOff = Math.min(rw/2 - margin, rw * 0.32);
                plantPositions.push([cx + pxOff, pz]);
                plantPositions.push([cx - pxOff, pz]);
            }
        }
        plantPositions.forEach(([px, pz]) => {
            cyl(0.13, 0.16, 0.28, 10, 0x7a5030, px, fl + 0.14, pz, 'furniture');
            cyl(0.12, 0.12, 0.04, 10, 0x3a2010, px, fl + 0.30, pz, 'furniture');
            cyl(0.025, 0.025, 0.55, 6, 0x2d6e1b, px, fl + 0.58, pz, 'furniture');
            cyl(0.22, 0.04, 0.28, 8, 0x2a7a1a, px, fl + 0.90, pz, 'furniture');
            cyl(0.16, 0.03, 0.20, 8, 0x33922a, px, fl + 1.08, pz, 'furniture');
        });

        // ── Vertical garden (on short end wall, fully inside) ─────────
        const vgThick = 0.09;
        const vgW = isLong ? Math.min(rw * 0.45, 1.6) : vgThick;
        const vgD = isLong ? vgThick : Math.min(rd * 0.45, 1.6);
        const vgH = Math.min(1.8, Math.min(rw, rd) * 0.9);
        // Place on the far short wall, inset so it stays inside
        const vgX = isLong ? cx + rw/2 - vgThick/2 - 0.05 : cx;
        const vgZ = isLong ? cz : cz + rd/2 - vgThick/2 - 0.05;
        const vgY = fl + vgH / 2 + 0.15;
        box(vgW + 0.06, vgH + 0.08, vgD + 0.06, 0x2a1a08, vgX, vgY, vgZ, 0.9, 'furniture');
        const vgRows = Math.max(3, Math.floor(vgH / 0.28));
        for (let r = 0; r < vgRows; r++) {
            const gy = fl + 0.2 + r * (vgH / vgRows);
            box(vgW, 0.22, vgD, r % 2 === 0 ? 0x2a7a1a : 0x1e5c14, vgX, gy, vgZ, 0.9, 'furniture');
        }
        [0.2, 0.55, 0.85].forEach((frac, fi) => {
            const fy = fl + 0.2 + frac * vgH;
            box(isLong ? vgW * 0.3 : vgThick + 0.02, 0.06, isLong ? vgThick + 0.02 : vgD * 0.3,
                [0xffcc00, 0xff6644, 0xffffff][fi], vgX, fy, vgZ, 0.9, 'furniture');
        });
        const gardenLight = new THREE.PointLight(0x88cc66, 0.4, 1.8);
        gardenLight.position.set(vgX, vgY + 0.5, vgZ);
        scene.add(gardenLight);
    }
    
    // ── Labels (canvas sprites) ──────────────────────────────
    function buildLabel(room, ox, oz, labelY) {
        const col = (TYPE_COLOR[room.type] || TYPE_COLOR.other).css;
        const c = document.createElement('canvas');
        c.width = 320; c.height = 72;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(10,10,20,0.78)';
        if (ctx.roundRect) { ctx.roundRect(4, 4, 312, 64, 10); ctx.fill(); }
        else { ctx.fillRect(4, 4, 312, 64); }
        ctx.fillStyle = col;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.name, 160, 30);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '14px monospace';
        ctx.fillText(`${room.width}m × ${room.depth}m`, 160, 52);

        const tex = new THREE.CanvasTexture(c);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sp.scale.set(2.5, 0.56, 1);
        const ly = labelY !== undefined ? labelY : WALL_H * 0.52;
        sp.position.set(ox + room.x + room.width / 2, ly, oz + room.z + room.depth / 2);
        scene.add(sp);
        groups.labels.push(sp);
    }

    // ── Trees ────────────────────────────────────────────────
    function buildTree(x, z) {
        box(0.28, 2.2, 0.28, 0x3a2510, x, 1.1, z, 0.95);
        cyl(1.1, 0.08, 1.5, 7, 0x2a5c2a, x, 2.9, z);
        cyl(0.85, 0.05, 1.1, 7, 0x338833, x, 3.8, z);
    }

    // ── Camera controls ──────────────────────────────────────
    function setupInteriorMouseControls(canvas) {
        canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
        canvas.addEventListener('mouseup', () => isDragging = false);
        canvas.addEventListener('mouseleave', () => isDragging = false);
        canvas.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - prevX, dy = e.clientY - prevY;
            targetTheta -= dx * 0.005;
            targetPhi = Math.max(0.08, Math.min(1.45, targetPhi - dy * 0.005));
            prevX = e.clientX; prevY = e.clientY;
        });
        canvas.addEventListener('wheel', e => {
            targetRadius = Math.max(3, Math.min(60, targetRadius + e.deltaY * 0.04));
            e.preventDefault();
        }, { passive: false });

        // Touch
        canvas.addEventListener('touchstart', e => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; });
        canvas.addEventListener('touchend', () => isDragging = false);
        canvas.addEventListener('touchmove', e => {
            if (!isDragging) return;
            const dx = e.touches[0].clientX - prevX, dy = e.touches[0].clientY - prevY;
            targetTheta -= dx * 0.005;
            targetPhi = Math.max(0.08, Math.min(1.45, targetPhi - dy * 0.005));
            prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
            e.preventDefault();
        }, { passive: false });
    }

    function updateCameraPosition() {
        // ── FP mode: orbit suppressed, FP controller owns camera ──
        if (window._fpMode) return;

        theta  += (targetTheta  - theta)  * 0.07;
        phi    += (targetPhi    - phi)    * 0.07;
        radius += (targetRadius - radius) * 0.07;
        lookCurrent.lerp(lookTarget, 0.07);

        camera.position.set(
            lookCurrent.x + radius * Math.sin(theta) * Math.cos(phi),
            lookCurrent.y + radius * Math.sin(phi),
            lookCurrent.z + radius * Math.cos(theta) * Math.cos(phi)
        );
        camera.lookAt(lookCurrent);
    }

    // ── Animate ──────────────────────────────────────────────
    function animate() {
        animId = requestAnimationFrame(animate);
        updateCameraPosition();

        // Subtle point light flicker
        scene.children.forEach((c, i) => {
            if (c.isPointLight && c.userData.baseIntensity !== undefined) {
                c.intensity = c.userData.baseIntensity + Math.sin(Date.now() * 0.0008 * (1 + i * 0.2) + i) * 0.04;
            }
        });

        renderer.render(scene, camera);

        // Resize check
        const cont = document.getElementById('interiorContainer');
        if (cont && renderer) {
            const w = cont.clientWidth, h = cont.clientHeight;
            if (renderer.domElement.width !== w * devicePixelRatio) {
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            }
        }
    }

    // ── Public API called from architect.html ─────────────────
    window.setInteriorCam = function (mode) {
        if (mode === 'top')   { targetPhi = 1.45; targetRadius = 35; }
        else if (mode === 'front') { targetTheta = 0; targetPhi = 0.38; targetRadius = 30; }
        else if (mode === 'side')  { targetTheta = Math.PI / 2; targetPhi = 0.38; targetRadius = 30; }
        else { /* free – do nothing special */ }
    };

    window.toggleInteriorLayer = function (name, visible) {
        layers[name] = visible;
        if (groups[name]) groups[name].forEach(m => m.visible = visible);
    };

    window._setInteriorSubView = function (v) {
        interiorSubView = v;

        if (v === 'interior') {
            layers.roof = false;
            if (groups.roof) groups.roof.forEach(m => m.visible = false);
            const lr = document.getElementById('layerRoof'); if (lr) lr.checked = false;
            targetPhi = 0.5; targetRadius = 28;
            lookTarget.set(0, 1.5, 0);
        } else if (v === 'dollhouse') {
            layers.roof = false;
            if (groups.roof) groups.roof.forEach(m => m.visible = false);
            const lr = document.getElementById('layerRoof'); if (lr) lr.checked = false;
            targetPhi = 1.3; targetRadius = 38;
        } else if (v === 'exterior') {
            layers.roof = true;
            if (groups.roof) groups.roof.forEach(m => m.visible = true);
            const lr = document.getElementById('layerRoof'); if (lr) lr.checked = true;
            targetPhi = 0.42; targetRadius = 36;
        } else if (v === '3dmodel') {
            // Full exterior model view — open top respects checkbox
            const openTop = document.getElementById('openTopMode')?.checked !== false;
            layers.roof = !openTop;
            if (groups.roof) groups.roof.forEach(m => m.visible = !openTop);
            const lr = document.getElementById('layerRoof'); if (lr) lr.checked = !openTop;
            // Pull-back isometric-ish angle (like the old 3D model view)
            const pd = window.projectData;
            if (pd) {
                const dist = Math.max(pd.totalWidth, pd.totalDepth) * 1.4;
                targetRadius = dist + (pd.floors?.length || 1) * (pd.floors?.[0]?.height || 2.7);
            }
            targetPhi = 0.65;
            targetTheta = 0.7;
            lookTarget.set(0, ((window.projectData?.floors?.length || 1) * (window.projectData?.floors?.[0]?.height || 2.7)) / 2, 0);
        }
        // Expose refs for wireframe and first-person
        window._interiorScene = scene;
        window._interiorCamera = camera;
        window._interiorRenderer = renderer;
    };

    // Keep old name for backward compat
    window.setInteriorSubView = window._setInteriorSubView;

    // Focus camera on a specific room (called from room click in sidebar)
    window.focusInteriorRoom = function (room, ox, oz) {
        if (!room) return;
        currentFocusRoom = room;
        const cx = ox + room.x + room.width / 2;
        const cz = oz + room.z + room.depth / 2;
        lookTarget.set(cx, 1.5, cz);
        targetRadius = Math.max(6, (room.width + room.depth) * 0.9);
        targetPhi = 0.42;

        // Update room info overlay
        const col = (TYPE_COLOR[room.type] || TYPE_COLOR.other).css;
        const nameEl = document.getElementById('iriName');
        const subEl  = document.getElementById('iriSub');
        const statsEl = document.getElementById('iriStats');
        if (nameEl) { nameEl.textContent = room.name; nameEl.style.color = col; }
        if (subEl)  subEl.textContent = (room.type || 'room').toUpperCase() + ' · ' + (room.width * room.depth).toFixed(0) + ' m²';
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="iri-stat"><span>Dimensions</span><span>${room.width}m × ${room.depth}m</span></div>
                <div class="iri-stat"><span>Ceiling</span><span>${room.height || 2.7}m</span></div>
                <div class="iri-stat"><span>Area</span><span>${(room.width * room.depth).toFixed(1)} m²</span></div>
            `;
        }
    };

})();