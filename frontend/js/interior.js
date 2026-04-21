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
        lift:      { hex: 0x56ccf2, css: '#56ccf2', floor: 0xc8b89a },
        other:     { hex: 0xaaaaaa, css: '#aaaaaa', floor: 0x999999 },
        balcony:   { hex: 0x64c8ff, css: '#64c8ff', floor: 0xb0c8d8 },
        hallway:   { hex: 0xc8a96e, css: '#c8a96e', floor: 0xc8a07a },
        entrance:  { hex: 0xd4a96e, css: '#d4a96e', floor: 0xc8b090 },
        swimming_pool: { hex: 0x00c8f0, css: '#00c8f0', floor: 0x1a9ec4 },
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
        // Stop any running lift animations from previous scene
        if (window._liftAnimCleanups) { window._liftAnimCleanups.forEach(fn => fn()); window._liftAnimCleanups = []; }
        window._poolMeshes = [];
        window._poolAnimRegistered = false;

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
                if (room.type === 'lift') return;       // lift has its own interior warm light
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
                if (room.type === 'lift') return;       // lift draws its own polished floor
                const cx = ox + room.x + room.width / 2;
                const cz = oz + room.z + room.depth / 2;
                let fc = (TYPE_COLOR[room.type] || TYPE_COLOR.other).floor;
                if (currentStyle === 'minimalist') fc = room.type === 'bathroom' ? 0xf5f5f5 : 0xe8e8e8;
                else if (currentStyle === 'luxury') fc = room.type === 'bathroom' ? 0xd4c9b0 : 0xb8a878;
                else if (currentStyle === 'traditional') fc = room.type === 'bathroom' ? 0xe0d8c8 : 0x9b7a50;
                addMesh(new THREE.BoxGeometry(room.width - WT, 0.05, room.depth - WT),
                    mat(fc, floorRough, floorMetal), cx, baseY + 0.03, cz, 0, 0, 'walls');
            });

           // Exterior walls — cut openings only when entrance actually touches the boundary (same as balcony)
            const roomsForWalls = rooms.map(r => {
                if (r.type !== 'entrance') return r;
                const THRESH = 0.35;
                const nearFront = r.z < THRESH;
                const nearBack  = HD - (r.z + r.depth) < THRESH;
                const nearLeft  = r.x < THRESH;
                const nearRight = HW - (r.x + r.width) < THRESH;
                if (!nearFront && !nearBack && !nearLeft && !nearRight) return null; // not near any wall — exclude
                const snapped = { ...r };
                if      (nearFront) snapped.z = 0;
                else if (nearBack)  snapped.z = HD - r.depth;
                else if (nearLeft)  snapped.x = 0;
                else                snapped.x = HW - r.width;
                return snapped;
            }).filter(Boolean);
            buildExteriorWalls(roomsForWalls, HW, HD, ox, oz, wy, floorH, baseY, wMat, wMatI);

            // Interior partition walls (use original room positions)
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
        const balconies = rooms.filter(r => r.type === 'balcony' || r.type === 'entrance');

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

        // Collect balcony/entrance spans per boundary edge
        const skipFront = [], skipBack = [], skipLeft = [], skipRight = [];
        balconies.forEach(r => {
           if (r.type === 'entrance') {
                // Entrance: only open wall when actually touching the boundary (same as balcony)
                if (r.z < THRESH)                skipFront.push({from: ox + r.x, to: ox + r.x + r.width});
                if (r.z + r.depth > HD - THRESH) skipBack.push ({from: ox + r.x, to: ox + r.x + r.width});
                if (r.x < THRESH)                skipLeft.push ({from: oz + r.z, to: oz + r.z + r.depth});
                if (r.x + r.width > HW - THRESH) skipRight.push({from: oz + r.z, to: oz + r.z + r.depth});
            } else {
                // Balcony: strict boundary-touch check
                if (r.z < THRESH)               skipFront.push({from: ox + r.x,         to: ox + r.x + r.width});
                if (r.z + r.depth > HD - THRESH) skipBack.push ({from: ox + r.x,         to: ox + r.x + r.width});
                if (r.x < THRESH)               skipLeft.push ({from: oz + r.z,         to: oz + r.z + r.depth});
                if (r.x + r.width > HW - THRESH) skipRight.push({from: oz + r.z,         to: oz + r.z + r.depth});
            }
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
        
        // ── For each entrance: fill the LEFT side wall with a glass facade ──
        const entranceGlassMat = new THREE.MeshStandardMaterial({
            color: 0x88ddf0, transparent: true, opacity: 0.28,
            roughness: 0.04, metalness: 0.15, side: THREE.DoubleSide
        });
        const entranceFrameColor = currentStyle === 'luxury' ? 0xaa8800 :
                                   currentStyle === 'traditional' ? 0x5c3317 : 0x222222;
        const entranceFrameMat = new THREE.MeshStandardMaterial({color: entranceFrameColor, roughness: 0.4, metalness: 0.3});
        balconies.filter(r => r.type === 'entrance').forEach(r => {
            // Glass goes on the left side wall of the entrance room (x = ox + r.x)
            const span = r.depth;
            const wallX = ox + r.x;                    // left edge of the entrance room
            const wallZ = oz + r.z + r.depth / 2;      // center along depth
            const panelH = floorH;

            // Full-height glass fill on left side wall
            const gFill = new THREE.Mesh(new THREE.BoxGeometry(WT + 0.02, panelH, span), entranceGlassMat);
            gFill.position.set(wallX, baseY + panelH / 2, wallZ);
            scene.add(gFill); groups.walls.push(gFill);

            // Vertical frame posts (front, center, back along depth)
            [-span / 2, 0, span / 2].forEach(offset => {
                const post = new THREE.Mesh(new THREE.BoxGeometry(
                    WT + 0.04, panelH, 0.06
                ), entranceFrameMat);
                post.position.set(wallX, baseY + panelH / 2, wallZ + offset);
                scene.add(post); groups.walls.push(post);
            });
            // Horizontal top rail
            const topRail = new THREE.Mesh(new THREE.BoxGeometry(
                WT + 0.04, 0.07, span + 0.06
            ), entranceFrameMat);
            topRail.position.set(wallX, baseY + panelH - 0.04, wallZ);
            scene.add(topRail); groups.walls.push(topRail);
        });
       
        

        // ── For each balcony: glass balustrade + slab + brackets ──────
        // ── For each balcony: glass balustrade + slab + brackets ──────
        const railColor = currentStyle === 'luxury' ? 0xc9a84c :
                          currentStyle === 'traditional' ? 0x5c3d1e :
                          currentStyle === 'minimalist'  ? 0x999999 : 0x607080;
        const metalMat = new THREE.MeshStandardMaterial({color: railColor, roughness: 0.35, metalness: 0.55});
        const glassMat = new THREE.MeshStandardMaterial({color: 0x88ccee, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide});
        const slabMat  = new THREE.MeshStandardMaterial({color: 0xb8bcc4, roughness: 0.88});
        const bracketMat = new THREE.MeshStandardMaterial({color: 0x555566, roughness: 0.7});

       balconies.forEach(r => {
            if (r.type === 'entrance') return; // Entrance has no balustrade/railing
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
            if (r.type === 'lift') return;       // lift uses glass panels, no solid walls
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
            if (room.type === 'balcony' || room.type === 'entrance') return;// balcony has open wall — no auto-window
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
            entrance:  furnishEntrance,
            lift:      furnishLift,
            swimming_pool: furnishSwimmingPool,
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

    // ── Glass Elevator / Lift ─────────────────────────────────
    function furnishLift(cx, cz, fl, rw, rd, room, baseY) {
        const floorH = room.height || WALL_H;
        const base   = baseY !== undefined ? baseY : 0.1;

        // ── Stainless steel frame (4 corner columns) ──────────
        const frameMat = mat(0xc0c8d8, 0.1, 0.85);
        const colH = floorH + 0.06;
        [[-rw/2 + 0.05,  -rd/2 + 0.05],
         [ rw/2 - 0.05,  -rd/2 + 0.05],
         [-rw/2 + 0.05,   rd/2 - 0.05],
         [ rw/2 - 0.05,   rd/2 - 0.05]
        ].forEach(([dx, dz]) => {
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.07, colH, 0.07), frameMat);
            col.position.set(cx + dx, base + colH / 2, cz + dz);
            col.castShadow = true;
            scene.add(col); groups.furniture.push(col);
        });

        // Horizontal rails top & bottom
        [[base + 0.04], [base + floorH - 0.04]].forEach(([ry]) => {
            const hRail = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.08, 0.05, 0.05), frameMat);
            hRail.position.set(cx, ry, cz - rd / 2 + 0.05);
            scene.add(hRail); groups.furniture.push(hRail);
            const hRail2 = hRail.clone();
            hRail2.position.set(cx, ry, cz + rd / 2 - 0.05);
            scene.add(hRail2); groups.furniture.push(hRail2);
            const vRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, rd - 0.08), frameMat);
            vRail.position.set(cx - rw / 2 + 0.05, ry, cz);
            scene.add(vRail); groups.furniture.push(vRail);
            const vRail2 = vRail.clone();
            vRail2.position.set(cx + rw / 2 - 0.05, ry, cz);
            scene.add(vRail2); groups.furniture.push(vRail2);
        });

        // ── Glass panels (3 sides — front is door) ────────────
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xaee4f8, transparent: true, opacity: 0.2,
            roughness: 0.0, metalness: 0.08,
            transmission: 0.88, side: THREE.DoubleSide,
        });
        // Left panel
        const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.03, floorH - 0.1, rd - 0.12), glassMat);
        leftPanel.position.set(cx - rw / 2 + 0.05, base + floorH / 2, cz);
        scene.add(leftPanel); groups.furniture.push(leftPanel);
        // Right panel
        const rightPanel = leftPanel.clone();
        rightPanel.position.set(cx + rw / 2 - 0.05, base + floorH / 2, cz);
        scene.add(rightPanel); groups.furniture.push(rightPanel);
        // Back wall (semi-mirror)
        const backMat = new THREE.MeshPhysicalMaterial({ color: 0x8ab8d8, roughness: 0.04, metalness: 0.55, transparent: true, opacity: 0.55 });
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.12, floorH - 0.1, 0.03), backMat);
        backPanel.position.set(cx, base + floorH / 2, cz + rd / 2 - 0.05);
        scene.add(backPanel); groups.furniture.push(backPanel);

        // ── Polished marble/wood floor ─────────────────────────
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xd4c4a8, roughness: 0.2, metalness: 0.1 });
        const liftFloor = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.12, 0.08, rd - 0.12), floorMat);
        liftFloor.position.set(cx, base + 0.04, cz);
        liftFloor.receiveShadow = true;
        scene.add(liftFloor); groups.furniture.push(liftFloor);

        // Floor veining (decorative strips)
        const veinMat = mat(0xb8a880, 0.3, 0.05);
        for (let vi = -1; vi <= 1; vi++) {
            const vein = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.14, 0.001, 0.03), veinMat);
            vein.position.set(cx, base + 0.085, cz + vi * (rd / 3.5));
            scene.add(vein); groups.furniture.push(vein);
        }

        // ── Polished ceiling ──────────────────────────────────
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.35, metalness: 0.4 });
        const ceilMesh = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.1, 0.05, rd - 0.1), ceilMat);
        ceilMesh.position.set(cx, base + floorH - 0.025, cz);
        scene.add(ceilMesh); groups.furniture.push(ceilMesh);

        // ── Warm ambient interior light ────────────────────────
        const warmLight = new THREE.PointLight(0xfff4d6, 1.5, rd * 4.5);
        warmLight.position.set(cx, base + floorH - 0.18, cz);
        scene.add(warmLight); groups.furniture.push(warmLight);

        // Ceiling LED strip (emissive bar)
        const ledMat = new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xfff8e8, emissiveIntensity: 1.2 });
        const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.6, 0.02, 0.06), ledMat);
        ledStrip.position.set(cx, base + floorH - 0.05, cz);
        scene.add(ledStrip); groups.furniture.push(ledStrip);

        // ── Digital control panel — mounted FLUSH on inner right wall ──
        // Panel body: rotated so its face points inward (toward -X direction)
        // Positioned well inside the wall: x = cx + rw/2 - 0.12 (leaving clearance from glass)
        const panelX  = cx + rw / 2 - 0.12;   // inset from right glass wall
        const panelZ  = cz - rd * 0.15;        // slightly toward front
        const panelY  = base + floorH * 0.50;

        const panelBodyMat = mat(0x0d1520, 0.3, 0.82);
        const controlPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.38), panelBodyMat);
        controlPanel.position.set(panelX, panelY, panelZ);
        scene.add(controlPanel); groups.furniture.push(controlPanel);

        // Brushed metal border around panel
        const panelBorderMat = mat(0x8090a0, 0.12, 0.88);
        const panelBorder = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.76, 0.42), panelBorderMat);
        panelBorder.position.set(panelX + 0.008, panelY, panelZ);
        scene.add(panelBorder); groups.furniture.push(panelBorder);
        // Re-add panel body on top of border
        const panelFace = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.72, 0.38), panelBodyMat);
        panelFace.position.set(panelX - 0.001, panelY, panelZ);
        scene.add(panelFace); groups.furniture.push(panelFace);

        // Floor indicator display (top of panel, glowing screen)
        const screenMat = new THREE.MeshStandardMaterial({ color: 0x001830, emissive: 0x003870, emissiveIntensity: 1.1 });
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.26), screenMat);
        screen.position.set(panelX - 0.03, panelY + 0.22, panelZ);
        scene.add(screen); groups.furniture.push(screen);

        // Glowing floor number indicator bar
        const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.5 });
        const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.10), indicatorMat);
        indicator.position.set(panelX - 0.031, panelY + 0.22, panelZ);
        scene.add(indicator); groups.furniture.push(indicator);

        // Small ambient glow light from the panel screen
        const panelGlow = new THREE.PointLight(0x00ccff, 0.4, 0.8);
        panelGlow.position.set(panelX - 0.15, panelY + 0.22, panelZ);
        scene.add(panelGlow); groups.furniture.push(panelGlow);

        // Floor buttons (mounted on panel face, cylinders pointing -X)
        const btnColors  = [0x00d4ff, 0x00aaff, 0xff4444, 0xffcc00];
        const btnLabels  = [1, 2, 0, -1]; // floors + open/close
        for (let bi = 0; bi < 4; bi++) {
            const btnMat = new THREE.MeshStandardMaterial({
                color: btnColors[bi], emissive: btnColors[bi], emissiveIntensity: 0.85, roughness: 0.18
            });
            const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 14), btnMat);
            btn.rotation.z = Math.PI / 2;   // cylinder axis along X (poking out of panel face)
            btn.position.set(panelX - 0.033, panelY - 0.02 - bi * 0.1, panelZ + 0.04);
            scene.add(btn); groups.furniture.push(btn);

            // Button recess ring (dark surround)
            const recessMat = mat(0x050d14, 0.5, 0.6);
            const recess = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 14), recessMat);
            recess.rotation.z = Math.PI / 2;
            recess.position.set(panelX - 0.022, panelY - 0.02 - bi * 0.1, panelZ + 0.04);
            scene.add(recess); groups.furniture.push(recess);
        }

        // Emergency stop button (red, larger, lower)
        const stopMat = new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.2 });
        const stopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 14), stopMat);
        stopBtn.rotation.z = Math.PI / 2;
        stopBtn.position.set(panelX - 0.033, panelY - 0.44, panelZ);
        scene.add(stopBtn); groups.furniture.push(stopBtn);

        // ── Handrail system — 3 walls (left, right, back) ────────
        const railMat = mat(0xc0c8d8, 0.10, 0.88);

        // Back wall rail
        const railBack = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.60, 0.04, 0.04), railMat);
        railBack.position.set(cx, base + floorH * 0.44, cz + rd / 2 - 0.11);
        scene.add(railBack); groups.furniture.push(railBack);

        // Left wall rail (runs along Z axis)
        const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, rd * 0.55), railMat);
        railLeft.position.set(cx - rw / 2 + 0.11, base + floorH * 0.44, cz);
        scene.add(railLeft); groups.furniture.push(railLeft);

        // Right wall rail (shorter — control panel occupies part of this wall)
        const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, rd * 0.30), railMat);
        railRight.position.set(cx + rw / 2 - 0.11, base + floorH * 0.44, cz + rd * 0.18);
        scene.add(railRight); groups.furniture.push(railRight);

        // Rail wall brackets (back rail)
        [-rw * 0.22, 0, rw * 0.22].forEach(dx => {
            const brk = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.07), railMat);
            brk.position.set(cx + dx, base + floorH * 0.44, cz + rd / 2 - 0.09);
            scene.add(brk); groups.furniture.push(brk);
        });

        // ── Mirror panel on back wall (reflective surface) ────────
        const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xd8e8f0, roughness: 0.02, metalness: 0.92, envMapIntensity: 1.5 });
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.65, floorH * 0.55, 0.03), mirrorMat);
        mirror.position.set(cx, base + floorH * 0.62, cz + rd / 2 - 0.07);
        scene.add(mirror); groups.furniture.push(mirror);

        // Mirror frame (brushed steel)
        const mFrameMat = mat(0xa0aab8, 0.12, 0.85);
        const mFrame = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.67 + 0.04, floorH * 0.55 + 0.04, 0.025), mFrameMat);
        mFrame.position.set(cx, base + floorH * 0.62, cz + rd / 2 - 0.083);
        scene.add(mFrame); groups.furniture.push(mFrame);

        // ── Interior ceiling light fixture (recessed LED ring) ────
        const recessCeilMat = mat(0x1a2030, 0.4, 0.6);
        const recessCeil = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20), recessCeilMat);
        recessCeil.position.set(cx, base + floorH - 0.04, cz);
        scene.add(recessCeil); groups.furniture.push(recessCeil);

        const ledRingMat = new THREE.MeshStandardMaterial({ color: 0xfff5cc, emissive: 0xfff0aa, emissiveIntensity: 2.0 });
        const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 32), ledRingMat);
        ledRing.rotation.x = Math.PI / 2;
        ledRing.position.set(cx, base + floorH - 0.035, cz);
        scene.add(ledRing); groups.furniture.push(ledRing);

        // ── Ventilation grille on ceiling ────────────────────────
        const grilleMat = mat(0x505870, 0.5, 0.6);
        for (let gi = -1; gi <= 1; gi++) {
            const grille = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.12, 0.02, 0.025), grilleMat);
            grille.position.set(cx + gi * rw * 0.15, base + floorH - 0.03, cz - rd * 0.25);
            scene.add(grille); groups.furniture.push(grille);
        }

        // ── Floor skirting (polished stone border strip) ──────────
        const skirtMat = mat(0xa89878, 0.25, 0.15);
        // Front/back skirting
        [[cz - rd / 2 + 0.06], [cz + rd / 2 - 0.06]].forEach(([sz]) => {
            const sk = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.14, 0.06, 0.04), skirtMat);
            sk.position.set(cx, base + 0.03, sz);
            scene.add(sk); groups.furniture.push(sk);
        });
        // Side skirting
        [[cx - rw / 2 + 0.06], [cx + rw / 2 - 0.06]].forEach(([sx]) => {
            const sk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, rd - 0.14), skirtMat);
            sk.position.set(sx, base + 0.03, cz);
            scene.add(sk); groups.furniture.push(sk);
        });

        // ── Sliding door — inset fully inside the front glass wall ──
        // doorZ: pushed inward by glass thickness (0.04) + small gap so panels never clip glass
        const doorZ     = cz - rd / 2 + 0.10;   // inset from front glass edge
        const panelW    = (rw - 0.14) / 2;       // half-width of each panel
        const doorH     = floorH * 0.90;
        const doorMat   = new THREE.MeshPhysicalMaterial({ color: 0xc8e4f8, transparent: true, opacity: 0.45, roughness: 0.02, metalness: 0.5 });
        const doorFrameMat = mat(0xa8b8c8, 0.12, 0.84);

        // Top frame bar (above doors, inside lift)
        const dframeTop = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.10, 0.05, 0.03), doorFrameMat);
        dframeTop.position.set(cx, base + floorH - 0.05, doorZ);
        scene.add(dframeTop); groups.furniture.push(dframeTop);

        // Side frame pillars
        [-1, 1].forEach(side => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorH, 0.03), doorFrameMat);
            pillar.position.set(cx + side * (rw / 2 - 0.06), base + doorH / 2 + 0.08, doorZ);
            scene.add(pillar); groups.furniture.push(pillar);
        });

        // Bottom door track (inside, flush with floor)
        const trackMat = mat(0x8890a0, 0.2, 0.78);
        const track = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.10, 0.025, 0.05), trackMat);
        track.position.set(cx, base + 0.012, doorZ);
        scene.add(track); groups.furniture.push(track);

        // Top door track
        const trackTop = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.10, 0.025, 0.05), trackMat);
        trackTop.position.set(cx, base + doorH + 0.08, doorZ);
        scene.add(trackTop); groups.furniture.push(trackTop);

        // Two sliding door panels — created here, animated below
        const doorLeft  = new THREE.Mesh(new THREE.BoxGeometry(panelW, doorH, 0.03), doorMat);
        const doorRight = doorLeft.clone();
        // Closed position: panels meet at center
        doorLeft.position.set(cx - panelW / 2, base + doorH / 2 + 0.08, doorZ);
        doorRight.position.set(cx + panelW / 2, base + doorH / 2 + 0.08, doorZ);
        scene.add(doorLeft);  groups.furniture.push(doorLeft);
        scene.add(doorRight); groups.furniture.push(doorRight);

        // Door handle bars (thin strip on each panel)
        const handleMat = mat(0xc0ccd8, 0.08, 0.9);
        [-1, 1].forEach(side => {
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, doorH * 0.25, 0.025), handleMat);
            handle.position.set(cx + side * 0.05, base + doorH * 0.5, doorZ - 0.02);
            scene.add(handle); groups.furniture.push(handle);
        });

        // ── Animated lift car (moves smoothly up and down) ────
        const carMat = new THREE.MeshPhysicalMaterial({
            color: 0xd4eeff, transparent: true, opacity: 0.15,
            roughness: 0.0, metalness: 0.15, side: THREE.DoubleSide
        });
        const carH = floorH * 0.82;
        const carMesh = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.2, carH, rd - 0.2), carMat);
        carMesh.position.set(cx, base + carH / 2 + 0.08, cz);
        scene.add(carMesh); groups.furniture.push(carMesh);

        // Car ceiling edge glow
        const carCeilGlowMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x44aaff, emissiveIntensity: 0.6 });
        const carCeilGlow = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.22, 0.025, rd - 0.22), carCeilGlowMat);
        carCeilGlow.position.set(cx, base + carH + 0.08, cz);
        scene.add(carCeilGlow); groups.furniture.push(carCeilGlow);

        // ── Unified looping animation: car movement + door open/close ──
        // Timeline per 10s cycle:
        //   0.00–0.15  doors closing (panels slide to center)
        //   0.15–0.45  car travels up   (doors closed)
        //   0.45–0.55  pause at top
        //   0.55–0.65  doors open at top (panels slide apart)
        //   0.65–0.70  pause open
        //   0.70–0.80  doors close again
        //   0.80–0.95  car travels down
        //   0.95–1.00  doors open at bottom → loop
        const CYCLE    = 10000; // ms
        const closedX  = panelW / 2;      // panels touching at center
        const openX    = rw / 2 - 0.07;   // panels slid to sides (near frame pillars)
        const _liftStart = Date.now();
        let _liftAnimActive = true;

        // Ease function: smooth-step (0→1)
        function _ease(t) { return t * t * (3 - 2 * t); }
        // Remap t from [a,b] to [0,1], clamped
        function _remap(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }

        function _animLift() {
            if (!_liftAnimActive) return;
            requestAnimationFrame(_animLift);

            const t = (Date.now() - _liftStart) % CYCLE / CYCLE; // 0..1

            // ── Door position ───────────────────────────────────
            let doorOffset;
            if (t < 0.15) {
                // closing
                doorOffset = _ease(_remap(t, 0, 0.15)) * (closedX - openX) + openX;
            } else if (t < 0.55) {
                // closed while car moves up
                doorOffset = closedX;
            } else if (t < 0.65) {
                // opening at top
                doorOffset = closedX - _ease(_remap(t, 0.55, 0.65)) * (closedX - openX);
            } else if (t < 0.70) {
                // open pause
                doorOffset = openX;
            } else if (t < 0.80) {
                // closing again
                doorOffset = _ease(_remap(t, 0.70, 0.80)) * (closedX - openX) + openX;
            } else if (t < 0.95) {
                // closed while car moves down
                doorOffset = closedX;
            } else {
                // opening at bottom
                doorOffset = closedX - _ease(_remap(t, 0.95, 1.00)) * (closedX - openX);
            }
            doorLeft.position.x  = cx - doorOffset;
            doorRight.position.x = cx + doorOffset;

            // ── Car vertical position ───────────────────────────
            let carT;
            if (t >= 0.15 && t < 0.55) {
                // going up
                carT = _ease(_remap(t, 0.15, 0.50));
            } else if (t >= 0.80 && t < 0.95) {
                // going down
                carT = 1 - _ease(_remap(t, 0.80, 0.95));
            } else if (t >= 0.55 && t < 0.80) {
                carT = 1; // at top
            } else {
                carT = 0; // at bottom
            }
            const travel = floorH * 0.10;
            const newY   = base + carH / 2 + 0.08 + carT * travel;
            carMesh.position.y      = newY;
            carCeilGlow.position.y  = base + carH + 0.08 + carT * travel;

            // ── Glow / shimmer pulses ───────────────────────────
            const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 14);
            carCeilGlowMat.emissiveIntensity = 0.4 + pulse * 0.5;
            glassMat.opacity  = 0.18 + pulse * 0.06;
            carMat.opacity    = 0.12 + pulse * 0.05;
            warmLight.intensity = 1.3 + pulse * 0.35;
        }
        _animLift();

        // Stop animation when scene is reset (avoid memory leak)
        if (!window._liftAnimCleanups) window._liftAnimCleanups = [];
        window._liftAnimCleanups.push(() => { _liftAnimActive = false; });
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

    // ── Indoor Swimming Pool ──────────────────────────────────
    function furnishSwimmingPool(cx, cz, fl, rw, rd, room, baseY) {
        const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;
        const poolW   = Math.min(rw * 0.62, 7.5);
        const poolD   = Math.min(rd * 0.62, 12.0);
        const poolDepthVis = 0.55;   // visual depth of basin walls
        const tileSize = 0.55;

        // ── Style-aware palette ──────────────────────────────────────
       const deckCol   = currentStyle === 'luxury'      ? 0xd4c9b0 :
                          currentStyle === 'traditional' ? 0xc8b88a :
                          currentStyle === 'minimalist'  ? 0xd8e8ee : 0xa8bcc8;
        const basinWall = currentStyle === 'luxury'      ? 0x0a3a58 :
                          currentStyle === 'minimalist'  ? 0x1a6a8a : 0x0a3a58;
        const tileCol   = currentStyle === 'luxury'      ? 0x0a5a82 :
                          currentStyle === 'minimalist'  ? 0x1890b8 : 0x0d7aaa;
        const groutCol  = 0xddeeff;
        const ladderMat = mat(currentStyle === 'luxury' ? 0xd4a84c : 0xe0e0e0, 0.1, 0.9);
        const stepCol   = currentStyle === 'traditional' ? 0xc8aa80 : 0xd0dce8;

        // ── Polished stone deck (fills entire room floor) ────────────
        addMesh(new THREE.BoxGeometry(rw - 0.05, 0.04, rd - 0.05),
            mat(deckCol, 0.35, currentStyle === 'luxury' ? 0.2 : 0.05),
            cx, fl + 0.02, cz, 0, 0, 'furniture');

        // Deck tile grout lines
        for (let i = -Math.floor(rw / tileSize / 2); i <= Math.floor(rw / tileSize / 2); i++) {
            box(0.010, 0.05, rd - 0.08, groutCol, cx + i * tileSize, fl + 0.038, cz, 0.2, 'furniture');
        }
        for (let j = -Math.floor(rd / tileSize / 2); j <= Math.floor(rd / tileSize / 2); j++) {
            box(rw - 0.08, 0.05, 0.010, groutCol, cx, fl + 0.038, cz + j * tileSize, 0.2, 'furniture');
        }

        // ── Pool basin — tiled rectangular hollow ────────────────────
        const pfl = fl + 0.04;   // top-of-deck surface Y

        // Basin floor (pool bottom, tiled)
        addMesh(new THREE.BoxGeometry(poolW - 0.12, 0.06, poolD - 0.12),
            mat(tileCol, 0.25, 0.15), cx, pfl - poolDepthVis + 0.03, cz, 0, 0, 'furniture');

        // Basin tile grout grid on pool floor
        const ptile = 0.45;
        for (let i = -Math.floor(poolW / ptile / 2); i <= Math.floor(poolW / ptile / 2); i++) {
            box(0.012, 0.065, poolD - 0.14, groutCol,
                cx + i * ptile, pfl - poolDepthVis + 0.068, cz, 0.1, 'furniture');
        }
        for (let j = -Math.floor(poolD / ptile / 2); j <= Math.floor(poolD / ptile / 2); j++) {
            box(poolW - 0.14, 0.065, 0.012, groutCol,
                cx, pfl - poolDepthVis + 0.068, cz + j * ptile, 0.1, 'furniture');
        }

        // Basin walls (4 sides — tiled)
        const bwMat = mat(tileCol, 0.22, 0.12);
        // Front & back walls
        [cz - poolD / 2, cz + poolD / 2].forEach(wz => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(poolW, poolDepthVis, 0.10), bwMat);
            m.position.set(cx, pfl - poolDepthVis / 2, wz);
            m.castShadow = true; scene.add(m); groups.furniture.push(m);
        });
        // Left & right walls
        [cx - poolW / 2, cx + poolW / 2].forEach(wx => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.10, poolDepthVis, poolD), bwMat);
            m.position.set(wx, pfl - poolDepthVis / 2, cz);
            m.castShadow = true; scene.add(m); groups.furniture.push(m);
        });

        // Coping (pool edge rim — polished stone border)
        const copingMat = mat(currentStyle === 'luxury' ? 0xe8d8b0 : 0xd0dce8, 0.2, 0.15);
        // Front & back rim
        [cz - poolD / 2 - 0.06, cz + poolD / 2 + 0.06].forEach(wz => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(poolW + 0.24, 0.06, 0.22), copingMat);
            m.position.set(cx, pfl + 0.03, wz); m.castShadow = true;
            scene.add(m); groups.furniture.push(m);
        });
        // Left & right rim
        [cx - poolW / 2 - 0.06, cx + poolW / 2 + 0.06].forEach(wx => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, poolD + 0.24), copingMat);
            m.position.set(wx, pfl + 0.03, cz); m.castShadow = true;
            scene.add(m); groups.furniture.push(m);
        });

       // ── Reflective rippling water surface ────────────────────────
        // Deep pool water — strong aqua-teal base so it reads clearly
        // against any style background (white minimalist, dark modern, etc.)
        const waterColor = currentStyle === 'luxury'      ? 0x006688 :
                           currentStyle === 'traditional' ? 0x007799 :
                           currentStyle === 'minimalist'  ? 0x1199bb : 0x0077aa;

        const waterMat = new THREE.MeshPhysicalMaterial({
            color:        waterColor,
            emissive:     0x003355,          // dark blue self-glow so it never goes white
            emissiveIntensity: 0.30,
            transparent:  true,
            opacity:      0.88,              // high opacity — pool water is opaque
            roughness:    0.04,              // near-mirror reflections
            metalness:    0.0,
            transmission: 0.06,             // very slight transmission (not a window)
            ior:          1.33,
            reflectivity: 0.85,
            side:         THREE.DoubleSide,
            depthWrite:   false,
        });
        const waterSurface = new THREE.Mesh(
            new THREE.PlaneGeometry(poolW - 0.14, poolD - 0.14, 32, 32),
            waterMat
        );
        waterSurface.rotation.x = -Math.PI / 2;
        waterSurface.position.set(cx, pfl - 0.02, cz);
        waterSurface.userData.poolWater = true;
        scene.add(waterSurface); groups.furniture.push(waterSurface);

        // Deep water depth color — darker layer underneath for visual depth
        const deepMat = new THREE.MeshStandardMaterial({
            color:   currentStyle === 'luxury' ? 0x003344 : 0x004466,
            emissive: 0x001122,
            emissiveIntensity: 0.45,
            transparent: true,
            opacity: 0.95,
            side: THREE.FrontSide,
        });
        const deepLayer = new THREE.Mesh(
            new THREE.PlaneGeometry(poolW - 0.22, poolD - 0.22),
            deepMat
        );
        deepLayer.rotation.x = -Math.PI / 2;
        deepLayer.position.set(cx, pfl - poolDepthVis + 0.07, cz); // at pool bottom
        scene.add(deepLayer); groups.furniture.push(deepLayer);

        // Caustic shimmer overlay — animated light pattern ON TOP of water
        const causticMat = new THREE.MeshStandardMaterial({
            color:             0x55ddff,
            emissive:          0x00bbdd,
            emissiveIntensity: 0.85,        // bright so it punches through
            transparent:       true,
            opacity:           0.28,
            side:              THREE.DoubleSide,
            depthWrite:        false,
        });
        const caustic = new THREE.Mesh(
            new THREE.PlaneGeometry(poolW - 0.20, poolD - 0.20, 20, 20),
            causticMat
        );
        caustic.rotation.x = -Math.PI / 2;
        caustic.position.set(cx, pfl - 0.01, cz);     // sits just above water
        caustic.userData.poolCaustic = true;
        scene.add(caustic); groups.furniture.push(caustic);

        // Lane lines on pool floor (dark stripe alternating)
        const laneColors = [0x1166aa, 0xee8800];
        const laneCount  = Math.max(2, Math.floor(poolW / 2.2));
        for (let li = 0; li < laneCount; li++) {
            const laneX = cx - poolW / 2 + (li + 0.5) * (poolW / laneCount);
            const laneMat = new THREE.MeshStandardMaterial({
                color: laneColors[li % 2],
                emissive: laneColors[li % 2],
                emissiveIntensity: 0.15,
                roughness: 0.3,
            });
            const lane = new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.01, poolD - 0.22),
                laneMat
            );
            lane.position.set(laneX, pfl - poolDepthVis + 0.075, cz);
            scene.add(lane); groups.furniture.push(lane);
        }

        // ── Glowing underwater lights (wall-mounted + floor) ─────────
        const uwLightColor = 0x00ccff;
        const uwLightPositions = [
            [cx - poolW * 0.28, cz - poolD * 0.35],
            [cx + poolW * 0.28, cz - poolD * 0.35],
            [cx - poolW * 0.28, cz + poolD * 0.35],
            [cx + poolW * 0.28, cz + poolD * 0.35],
            [cx,                cz],
            [cx - poolW * 0.28, cz],
            [cx + poolW * 0.28, cz],
        ];
        uwLightPositions.forEach(([lx, lz], i) => {
            // Strong underwater point lights — they tint the water from below
            const ul = new THREE.PointLight(uwLightColor, 2.2, Math.max(poolW, poolD) * 1.1, 1.5);
            ul.position.set(lx, pfl - poolDepthVis + 0.18, lz);
            ul.userData.baseIntensity = 2.2;
            scene.add(ul);

            // Emissive lens cap (bright cyan disk on pool wall/floor)
            const lensMat = new THREE.MeshStandardMaterial({
                color: 0x00ffff, emissive: 0x00eeff, emissiveIntensity: 4.0,
                roughness: 0.0, metalness: 0.1,
            });
            const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.018, 14), lensMat);
            lens.position.set(lx, pfl - poolDepthVis + 0.14, lz);
            scene.add(lens); groups.furniture.push(lens);

            // Glow halo disk around lens (larger, softer)
            const haloMat = new THREE.MeshStandardMaterial({
                color: 0x0099dd, emissive: 0x0088cc, emissiveIntensity: 1.8,
                transparent: true, opacity: 0.45, depthWrite: false,
            });
            const halo = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), haloMat);
            halo.rotation.x = -Math.PI / 2;
            halo.position.set(lx, pfl - poolDepthVis + 0.08, lz);
            scene.add(halo); groups.furniture.push(halo);
        });

        // Central ambient fill light tinting the whole pool cyan-blue
        const poolFillLight = new THREE.PointLight(0x0088bb, 1.8, Math.max(poolW, poolD) * 2.5, 1);
        poolFillLight.position.set(cx, pfl - poolDepthVis * 0.5, cz);
        poolFillLight.userData.baseIntensity = 1.8;
        scene.add(poolFillLight);

        // ── Pool ladder (one end, chrome) ────────────────────────────
        const ladX = cx + poolW / 2 - 0.22;
        const ladZ = cz + poolD / 2 - 0.35;
        // Two vertical rails
        [-0.14, 0.14].forEach(dx => {
            const rail = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.025, poolDepthVis + 0.55, 10),
                ladderMat
            );
            rail.position.set(ladX + dx, pfl - (poolDepthVis + 0.55) / 2 + 0.55, ladZ);
            rail.castShadow = true;
            scene.add(rail); groups.furniture.push(rail);
        });
        // Rungs
        for (let r = 0; r < 4; r++) {
            const rung = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.018, 0.30, 8),
                ladderMat
            );
            rung.rotation.z = Math.PI / 2;
            rung.position.set(ladX, pfl - poolDepthVis + 0.12 + r * 0.14, ladZ);
            scene.add(rung); groups.furniture.push(rung);
        }
        // Curved handrail top arc
        const arcRail = new THREE.Mesh(
            new THREE.TorusGeometry(0.14, 0.022, 8, 16, Math.PI),
            ladderMat
        );
        arcRail.rotation.x = Math.PI / 2;
        arcRail.position.set(ladX, pfl + 0.52, ladZ);
        arcRail.rotation.z = Math.PI / 2;
        scene.add(arcRail); groups.furniture.push(arcRail);

        // ── Entry steps (wide shallow steps into the pool) ───────────
        const stepW = 1.2;
        for (let s = 0; s < 3; s++) {
            const sW = stepW - s * 0.18;
            const sH = 0.12;
            const sZ = cz - poolD / 2 + s * 0.24 + 0.18;
            const sY = pfl - s * sH - sH / 2;
            const stepM = new THREE.Mesh(
                new THREE.BoxGeometry(sW, sH, 0.22),
                mat(stepCol, 0.4, 0.12)
            );
            stepM.position.set(cx - poolW / 2 + sW / 2 + 0.06, sY, sZ);
            stepM.castShadow = true; stepM.receiveShadow = true;
            scene.add(stepM); groups.furniture.push(stepM);
        }

        // ── Skylight above (glass ceiling panel) ─────────────────────
        const skyW = poolW * 0.72;
        const skyD = poolD * 0.55;
        const skyY = fl + (room.height || 2.7) - 0.05;

        // Frame
        const skyFrameMat = mat(
            currentStyle === 'luxury' ? 0xc9a84c : 0x606878, 0.3, 0.65
        );
        // Outer frame bars
        [[skyW + 0.16, 0.10, 0.10, cx, skyY, cz - skyD / 2],
         [skyW + 0.16, 0.10, 0.10, cx, skyY, cz + skyD / 2],
         [0.10, 0.10, skyD + 0.12, cx - skyW / 2, skyY, cz],
         [0.10, 0.10, skyD + 0.12, cx + skyW / 2, skyY, cz],
        ].forEach(([w, h, d, x, y, z]) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skyFrameMat);
            m.position.set(x, y, z); m.castShadow = true;
            scene.add(m); groups.furniture.push(m);
        });
        // Cross dividers (3 × 2 panes)
        [-skyW / 3, 0, skyW / 3].forEach(dx => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, skyD), skyFrameMat);
            m.position.set(cx + dx, skyY, cz);
            scene.add(m); groups.furniture.push(m);
        });
        [0].forEach(dz => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(skyW, 0.06, 0.06), skyFrameMat);
            m.position.set(cx, skyY, cz + dz);
            scene.add(m); groups.furniture.push(m);
        });

        // Glass panes
        const skyGlassMat = new THREE.MeshPhysicalMaterial({
            color: 0xd0f0ff, transparent: true, opacity: 0.28,
            roughness: 0.0, metalness: 0.05,
            transmission: 0.85, ior: 1.5,
            side: THREE.DoubleSide, depthWrite: false,
        });
        const paneW = (skyW - 0.20) / 3;
        for (let pi = 0; pi < 3; pi++) {
            const paneMesh = new THREE.Mesh(
                new THREE.BoxGeometry(paneW, 0.04, skyD - 0.10),
                skyGlassMat
            );
            paneMesh.position.set(cx - skyW / 2 + paneW / 2 + pi * paneW + pi * 0.06 + 0.06, skyY, cz);
            scene.add(paneMesh); groups.furniture.push(paneMesh);
        }

        // Sunlight shaft from skylight
        const skyLight = new THREE.SpotLight(0xfff8f0, 1.4, (room.height || 2.7) * 1.5, Math.PI / 6, 0.5, 1.5);
        skyLight.position.set(cx, skyY - 0.06, cz);
        skyLight.target.position.set(cx, fl, cz);
        scene.add(skyLight.target);
        scene.add(skyLight);

        // ── Tropical plants (corners) ─────────────────────────────────
        const corners = [
            [cx - rw * 0.38, cz - rd * 0.38],
            [cx + rw * 0.38, cz - rd * 0.38],
            [cx - rw * 0.38, cz + rd * 0.38],
            [cx + rw * 0.38, cz + rd * 0.38],
        ];
        corners.forEach(([px, pz], i) => {
            // Pot
            addMesh(new THREE.CylinderGeometry(0.22, 0.18, 0.38, 12),
                mat(0x9a6030, 0.75), px, fl + 0.19, pz, 0, 0, 'furniture');
            // Soil
            addMesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 12),
                mat(0x2a1a08, 0.98), px, fl + 0.41, pz, 0, 0, 'furniture');
            // Trunk
            addMesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1 + i * 0.12, 8),
                mat(0x5a3a15, 0.85), px, fl + 0.98, pz, 0, 0, 'furniture');
            // Fan leaves
            const leafAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5, Math.PI * 0.25, Math.PI * 0.75];
            leafAngles.forEach((ang, li) => {
                const lx = Math.sin(ang) * 0.55, lz = Math.cos(ang) * 0.55;
                addMesh(new THREE.BoxGeometry(0.08, 0.06, 0.60),
                    mat(li % 2 === 0 ? 0x1a7a20 : 0x28a030, 0.8),
                    px + lx * 0.5, fl + 1.55 + i * 0.05, pz + lz * 0.5,
                    0, ang, 'furniture');
            });
            // Upper foliage ball
            addMesh(new THREE.SphereGeometry(0.38, 10, 8),
                mat(i % 2 === 0 ? 0x228833 : 0x33aa44, 0.85),
                px, fl + 1.78 + i * 0.08, pz, 0, 0, 'furniture');
        });

        // ── Lounge seating (along long sides) ────────────────────────
        const loungeCol = currentStyle === 'luxury'      ? 0xf5f0e8 :
                          currentStyle === 'traditional' ? 0xd4aa70 : 0xf0f4f8;
        const frameCol  = currentStyle === 'luxury'      ? 0xd4a84c : 0xc0c8d0;
        const sideOffset = poolW / 2 + 1.05;

        [-sideOffset, sideOffset].forEach((dx, si) => {
            const loungeX = cx + dx * (si === 0 ? 1 : 1);
            const lx = si === 0 ? cx - sideOffset : cx + sideOffset;
            const count = Math.max(2, Math.floor(rd * 0.28));

            for (let li = 0; li < count; li++) {
                const lz = cz - (count - 1) * 1.3 / 2 + li * 1.3;

                // Lounge base/frame
                const frameMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.72, 0.08, 2.0),
                    mat(frameCol, 0.2, 0.55)
                );
                frameMesh.position.set(lx, fl + 0.28, lz);
                frameMesh.castShadow = true;
                scene.add(frameMesh); groups.furniture.push(frameMesh);

                // Cushion
                box(0.65, 0.12, 1.85, loungeCol, lx, fl + 0.40, lz, 0.85, 'furniture');

                // Backrest (angled)
                const back = new THREE.Mesh(
                    new THREE.BoxGeometry(0.65, 0.55, 0.07),
                    mat(loungeCol, 0.85)
                );
                back.position.set(lx, fl + 0.55, lz + (si === 0 ? 0.88 : -0.88));
                back.rotation.x = si === 0 ? 0.32 : -0.32;
                scene.add(back); groups.furniture.push(back);

                // Towel on lounge
                box(0.55, 0.02, 0.80,
                    [0xff8c69, 0x5ba4cf, 0x7fba8a, 0xf5c842][li % 4],
                    lx, fl + 0.53, lz - 0.2, 0.9, 'furniture');

                // Leg supports
                [[-0.30, -0.88], [-0.30, 0.88], [0.30, -0.88], [0.30, 0.88]].forEach(([ldx, ldz]) => {
                    box(0.05, 0.28, 0.05, frameCol, lx + ldx, fl + 0.14, lz + ldz, 0.2, 'furniture');
                });
            }

            // Small side table per pair
            const tZ = cz;
            cyl(0.24, 0.24, 0.04, 12, frameCol, lx, fl + 0.52, tZ, 'furniture');
            cyl(0.04, 0.04, 0.52, 8, frameCol, lx, fl + 0.26, tZ, 'furniture');
            // Drinks on table
            cyl(0.04, 0.035, 0.22, 8, 0xffee88, lx, fl + 0.67, tZ + 0.08, 'furniture');
        });

        // ── Safety signage (NO DIVING sign + depth marker) ────────────
        const signMat  = new THREE.MeshStandardMaterial({ color: 0xff3322, roughness: 0.9 });
        const signBase = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const poleC    = mat(0xb0b8c0, 0.2, 0.7);

        // No-diving sign pole near pool edge
        const sdX = cx + poolW / 2 + 0.16;
        const sdZ = cz - poolD / 2 + 0.28;
        box(0.03, 1.1, 0.03, 0xb0b8c0, sdX, fl + 0.55, sdZ, 0.2, 'furniture');
        // Sign board
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.20, 0.025), signMat);
        signBoard.position.set(sdX, fl + 1.14, sdZ);
        scene.add(signBoard); groups.furniture.push(signBoard);
        // White symbol strip
        box(0.22, 0.04, 0.03, 0xffffff, sdX, fl + 1.14, sdZ, 0.9, 'furniture');

        // Depth marker sign on far end pool wall
        const dmX = cx;
        const dmZ = cz + poolD / 2 + 0.08;
        box(0.035, 0.60, 0.025, 0x1a3a6a, dmX, fl + 0.56, dmZ, 0.3, 'furniture');
        // Blue depth plate
        const dmPlate = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.22, 0.030), 
            new THREE.MeshStandardMaterial({ color: 0x1155aa, roughness: 0.7 }));
        dmPlate.position.set(dmX, fl + 0.90, dmZ);
        scene.add(dmPlate); groups.furniture.push(dmPlate);

        // ── Ceiling fan over pool (modern/luxury) ────────────────────
        if (currentStyle === 'modern' || currentStyle === 'luxury') {
            const fanY = fl + (room.height || 2.7) - 0.30;
            const fanCol = currentStyle === 'luxury' ? 0xd4a84c : 0x708090;
            cyl(0.06, 0.06, 0.18, 10, fanCol, cx + poolW * 0.25, fanY, cz, 'furniture');
            [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(ang => {
                const bladeMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.55, 0.025, 0.15),
                    mat(fanCol === 0xd4a84c ? 0x8b6b3d : 0x607080, 0.6)
                );
                bladeMesh.position.set(
                    cx + poolW * 0.25 + Math.cos(ang) * 0.35,
                    fanY - 0.10,
                    cz + Math.sin(ang) * 0.35
                );
                bladeMesh.rotation.y = ang;
                scene.add(bladeMesh); groups.furniture.push(bladeMesh);
            });
        }

        // ── Register water surfaces for animation ─────────────────────
        if (!window._poolMeshes) window._poolMeshes = [];
        window._poolMeshes.push({ water: waterSurface, caustic });

        // ── Ripple animation hook (registered once) ───────────────────
        if (!window._poolAnimRegistered) {
            window._poolAnimRegistered = true;
            // Animation runs inside the main animate() loop via the _poolMeshes array
        }
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


// ── Vertical garden — wall-mounted trellis with plant pockets ──
        // Mounted flat against the short end wall, fully inside room
        const vgPanelW = isLong ? Math.min(rw * 0.5, 2.0) : 0.07;
        const vgPanelD = isLong ? 0.07 : Math.min(rd * 0.5, 2.0);
        const vgPanelH = Math.min(1.6, 2.3);
        const vgBaseY  = fl + 0.35;

        // Anchor to short end wall — inset by half panel depth + small gap
        const vgX = isLong ? cx + rw/2 - vgPanelW/2 - 0.12 : cx - (isLong ? 0 : (Math.min(rd,rw)*0.5 - vgPanelW/2 - 0.12));
        const vgZ = isLong ? cz - rd/2 + vgPanelD/2 + 0.12 : cz + rd/2 - vgPanelD/2 - 0.12;

        // Trellis backing frame (dark timber)
        box(vgPanelW, vgPanelH, vgPanelD, 0x2c1a0a, vgX, vgBaseY + vgPanelH/2, vgZ, 0.95, 'furniture');

        // Trellis grid lines (lighter wood strips)
        const cols = Math.max(2, Math.round((isLong ? vgPanelW : vgPanelD) / 0.35));
        const rows = Math.max(3, Math.round(vgPanelH / 0.35));
        for (let c = 0; c <= cols; c++) {
            const t = -( isLong ? vgPanelW : vgPanelD )/2 + c * (( isLong ? vgPanelW : vgPanelD ) / cols);
            if (isLong) box(0.03, vgPanelH, 0.03, 0x5a3510, vgX + t, vgBaseY + vgPanelH/2, vgZ, 0.8, 'furniture');
            else        box(0.03, vgPanelH, 0.03, 0x5a3510, vgX,     vgBaseY + vgPanelH/2, vgZ + t, 0.8, 'furniture');
        }
        for (let r = 0; r <= rows; r++) {
            const gy = vgBaseY + r * (vgPanelH / rows);
            if (isLong) box(vgPanelW, 0.03, 0.03, 0x5a3510, vgX, gy, vgZ, 0.8, 'furniture');
            else        box(0.03, 0.03, vgPanelD, 0x5a3510, vgX, gy, vgZ, 0.8, 'furniture');
        }

        // Plant pockets — small terracotta troughs mounted in trellis cells
        const pocketCols = Math.max(1, cols - 1);
        const pocketRows = Math.max(2, rows - 1);
        for (let pc = 0; pc < pocketCols; pc++) {
            for (let pr = 0; pr < pocketRows; pr++) {
                const span = isLong ? vgPanelW : vgPanelD;
                const ct   = -span/2 + (pc + 0.5) * (span / pocketCols);
                const gy   = vgBaseY + (pr + 0.5) * (vgPanelH / pocketRows);
                const px   = isLong ? vgX + ct : vgX;
                const pz   = isLong ? vgZ       : vgZ + ct;
                // Small terracotta pot
                cyl(0.09, 0.1, 0.12, 8, 0xb5601a, px, gy - 0.06, pz, 'furniture');
                // Soil
                cyl(0.08, 0.08, 0.02, 8, 0x3a2010, px, gy + 0.01, pz, 'furniture');
                // Plant — alternate between bushy and trailing types
                const plantCol = (pc + pr) % 3 === 0 ? 0x33aa22 : (pc + pr) % 3 === 1 ? 0x227733 : 0x44bb33;
                if ((pc + pr) % 2 === 0) {
                    // Bushy round plant
                    cyl(0.12, 0.04, 0.18, 7, plantCol, px, gy + 0.17, pz, 'furniture');
                    cyl(0.09, 0.03, 0.12, 7, 0x2a8822, px, gy + 0.27, pz, 'furniture');
                } else {
                    // Trailing vine — a few small drooping leaf clusters
                    for (let v = 0; v < 3; v++) {
                        const vOff = v * 0.1;
                        const hOff = (v % 2 === 0 ? 0.06 : -0.06);
                        cyl(0.06, 0.02, 0.08, 6, plantCol,
                            px + (isLong ? hOff : 0),
                            gy + 0.18 - vOff,
                            pz + (isLong ? 0 : hOff), 'furniture');
                    }
                }
            }
        }

        // Warm green accent light for the garden
        const gardenLight = new THREE.PointLight(0x99dd66, 0.55, 2.2);
        gardenLight.position.set(
            vgX + (isLong ? 0 : 0.4),
            vgBaseY + vgPanelH * 0.7,
            vgZ + (isLong ? 0.4 : 0)
        );
        scene.add(gardenLight);
    }

    function furnishEntrance(cx, cz, fl, rw, rd) {
    const T = STYLE_THEMES[currentStyle] || STYLE_THEMES.modern;

    // ── Stone-textured floor with herringbone pattern ──────────────────
    const stoneCol = currentStyle === 'luxury'      ? 0xd4c9b0 :
                     currentStyle === 'traditional' ? 0xc8b890 :
                     currentStyle === 'minimalist'  ? 0xeeeeee : 0xd0c8b8;
    box(rw - 0.05, 0.04, rd - 0.05, stoneCol, cx, fl + 0.02, cz, 0.7, 'furniture');
    // Textured tile lines
    const tSize = 0.55;
    for (let i = -Math.floor(rw / tSize / 2); i <= Math.floor(rw / tSize / 2); i++) {
        box(0.012, 0.045, rd - 0.1, 0xaaa090, cx + i * tSize, fl + 0.038, cz, 0.4, 'furniture');
    }
    for (let j = -Math.floor(rd / tSize / 2); j <= Math.floor(rd / tSize / 2); j++) {
        box(rw - 0.1, 0.045, 0.012, 0xaaa090, cx, fl + 0.038, cz + j * tSize, 0.4, 'furniture');
    }

    // ── Grand ceiling coffers / molding ───────────────────────────────
    const ceilY = fl + (WALL_H - 0.06);
    const cofferW = Math.min(rw * 0.4, 2.0), cofferD = Math.min(rd * 0.4, 2.0);
    const cofferCol = currentStyle === 'luxury' ? 0x1a1520 :
                      currentStyle === 'minimalist' ? 0xfafafa : 0xf0ece4;
    // Center coffer frame
    box(cofferW + 0.12, 0.06, 0.05, cofferCol, cx, ceilY, cz - cofferD / 2, 0.85, 'furniture');
    box(cofferW + 0.12, 0.06, 0.05, cofferCol, cx, ceilY, cz + cofferD / 2, 0.85, 'furniture');
    box(0.05, 0.06, cofferD, cofferCol, cx - cofferW / 2, ceilY, cz, 0.85, 'furniture');
    box(0.05, 0.06, cofferD, cofferCol, cx + cofferW / 2, ceilY, cz, 0.85, 'furniture');
    // Crown molding perimeter
    const moldCol = currentStyle === 'luxury' ? 0xc9a84c : 0xe8e2d8;
    box(rw - 0.1, 0.09, 0.06, moldCol, cx, ceilY - 0.01, cz - rd / 2 + 0.05, 0.9, 'furniture');
    box(rw - 0.1, 0.09, 0.06, moldCol, cx, ceilY - 0.01, cz + rd / 2 - 0.05, 0.9, 'furniture');
    box(0.06, 0.09, rd - 0.1, moldCol, cx - rw / 2 + 0.05, ceilY - 0.01, cz, 0.9, 'furniture');
    box(0.06, 0.09, rd - 0.1, moldCol, cx + rw / 2 - 0.05, ceilY - 0.01, cz, 0.9, 'furniture');

    // ── Grand chandelier ──────────────────────────────────────────────
    const chandelierCol = currentStyle === 'luxury' ? 0xc9a84c :
                          currentStyle === 'traditional' ? 0xb8960a : 0xddddaa;
    // Drop rod
    cyl(0.025, 0.025, 0.65, 8, chandelierCol, cx, fl + WALL_H - 0.36, cz, 'furniture');
    // Central orb
    cyl(0.10, 0.10, 0.20, 12, chandelierCol, cx, fl + WALL_H - 0.78, cz, 'furniture');
    // Arms (radial)
    const armAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
    const armR = Math.min(rw, rd) * 0.22;
    armAngles.forEach((angle, i) => {
        const ax = cx + Math.sin(angle) * armR * 0.5;
        const az = cz + Math.cos(angle) * armR * 0.5;
        // Arm rod
        const armMesh = new THREE.Mesh(
            new THREE.BoxGeometry(i < 4 ? armR : armR * 0.65, 0.03, 0.03),
            mat(chandelierCol, 0.4, 0.6)
        );
        armMesh.position.set(ax - Math.sin(angle) * armR * 0.25, fl + WALL_H - 0.78, az - Math.cos(angle) * armR * 0.25);
        armMesh.rotation.y = angle;
        scene.add(armMesh); groups.furniture.push(armMesh);
        // Pendant bulb
        cyl(0.055, 0.04, 0.18, 8, 0xfffce0,
            cx + Math.sin(angle) * armR * (i < 4 ? 0.92 : 0.72),
            fl + WALL_H - 0.97,
            cz + Math.cos(angle) * armR * (i < 4 ? 0.92 : 0.72), 'furniture');
        // Warm point light per arm (subset to avoid overdraw)
        if (i < 4) {
            const pl = new THREE.PointLight(0xffd88a, 0.45, Math.max(rw, rd) * 1.1, 2);
            pl.position.set(
                cx + Math.sin(angle) * armR * 0.9,
                fl + WALL_H - 1.05,
                cz + Math.cos(angle) * armR * 0.9
            );
            pl.userData.baseIntensity = 0.45;
            scene.add(pl);
        }
    });
    // Center drip pendants
    [0.0, 0.18, -0.18].forEach((dy, i) => {
        cyl(0.065, 0.05, 0.22, 10, 0xfffce0, cx + (i === 1 ? 0.14 : i === 2 ? -0.14 : 0), fl + WALL_H - 1.1 + dy * 0.3, cz, 'furniture');
    });

    // ── Stone-framed grand doorway (front wall) ───────────────────────
    const doorW = Math.min(rw * 0.45, 2.0);
    const doorH = Math.min(WALL_H - 0.35, 2.4);
    const stoneFrameCol = currentStyle === 'luxury'      ? 0x2a2a35 :
                          currentStyle === 'minimalist'  ? 0xd8d8d8 :
                          currentStyle === 'traditional' ? 0x7a6a50 : 0x6a7a8a;
    const doorZ = cz - rd / 2 + 0.08;
    // Side pillars
    [-1, 1].forEach(side => {
        const px = cx + side * (doorW / 2 + 0.15);
        // Main pillar
        box(0.28, doorH + 0.1, 0.22, stoneFrameCol, px, fl + (doorH + 0.1) / 2, doorZ, 0.75, 'furniture');
        // Pillar cap
        box(0.36, 0.12, 0.30, stoneFrameCol, px, fl + doorH + 0.15, doorZ, 0.8, 'furniture');
        // Pillar base plinth
        box(0.34, 0.10, 0.28, stoneFrameCol, px, fl + 0.05, doorZ, 0.8, 'furniture');
        // Stone texture detail bands
        [0.4, 0.9, 1.5, 2.0].forEach(yy => {
            if (yy < doorH)
                box(0.30, 0.025, 0.24, 0x888888, px, fl + yy, doorZ, 0.5, 'furniture');
        });
    });
    // Lintel / arch top
    box(doorW + 0.6, 0.20, 0.22, stoneFrameCol, cx, fl + doorH + 0.10, doorZ, 0.75, 'furniture');
    box(doorW + 0.72, 0.07, 0.25, stoneFrameCol, cx, fl + doorH + 0.25, doorZ, 0.8, 'furniture');
    // Glass facade panels in doorway (glass facade effect)
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88ddf0, transparent: true, opacity: 0.30,
        roughness: 0.04, metalness: 0.15, side: THREE.DoubleSide
    });
    [-doorW * 0.25, doorW * 0.25].forEach(dx => {
        const gp = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.45, doorH - 0.06, 0.06), glassMat);
        gp.position.set(cx + dx, fl + (doorH - 0.06) / 2 + 0.03, doorZ);
        scene.add(gp); groups.walls.push(gp);
    });

    // ── Symmetrical potted plants flanking doorway ────────────────────
    const plantCol = currentStyle === 'traditional' ? 0xc87941 :
                     currentStyle === 'luxury'      ? 0x2a1a08 : 0x7a5030;
    [-1, 1].forEach(side => {
        const px = cx + side * (doorW / 2 + 0.75);
        const pz = doorZ + 0.45;
        // Pot
        cyl(0.18, 0.22, 0.40, 12, plantCol, px, fl + 0.20, pz, 'furniture');
        cyl(0.16, 0.16, 0.05, 12, 0x3a2010, px, fl + 0.43, pz, 'furniture');
        // Tall ornamental plant / topiary
        cyl(0.035, 0.035, 0.85, 6, 0x2d5c15, px, fl + 0.87, pz, 'furniture');
        cyl(0.32, 0.10, 0.60, 10, 0x267a19, px, fl + 1.42, pz, 'furniture');
        cyl(0.22, 0.06, 0.40, 10, 0x31922e, px, fl + 1.82, pz, 'furniture');
        cyl(0.12, 0.04, 0.25, 8,  0x3aaa36, px, fl + 2.09, pz, 'furniture');
        // Ground-level accent flowers
        [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(ang => {
            box(0.06, 0.06, 0.06, 0xffdd44,
                px + Math.sin(ang) * 0.20, fl + 0.52,
                pz + Math.cos(ang) * 0.20, 0.6, 'furniture');
        });
    });

    // ── Warm wall sconces (bilateral symmetry) ────────────────────────
    const sconceCol = currentStyle === 'luxury' ? 0xc9a84c : 0xb8b090;
    const scY = fl + WALL_H * 0.58;
    [-rw * 0.28, rw * 0.28].forEach(dx => {
        // Sconce base plate
        box(0.10, 0.28, 0.06, sconceCol, cx + dx, scY, cz - rd / 2 + 0.06, 0.5, 'furniture');
        // Arm
        box(0.04, 0.04, 0.22, sconceCol, cx + dx, scY + 0.05, cz - rd / 2 + 0.17, 0.4, 'furniture');
        // Shade
        cyl(0.07, 0.05, 0.22, 8, 0xfffde0, cx + dx, scY + 0.05, cz - rd / 2 + 0.28, 'furniture');
        // Warm point light
        const sl = new THREE.PointLight(0xffcc66, 0.6, 2.8, 2);
        sl.position.set(cx + dx, scY + 0.18, cz - rd / 2 + 0.30);
        sl.userData.baseIntensity = 0.6;
        scene.add(sl);
    });

    // ── Vertical garden panel (side wall, warm wood finish backing) ───
    const vgThick = 0.10;
    const vgW = Math.min(rw * 0.35, 1.5);
    const vgH = Math.min(WALL_H * 0.58, 1.6);
    const vgX = cx + rw / 2 - vgThick / 2 - 0.06;
    const vgZ = cz + rd * 0.05;
    const vgY2 = fl + vgH / 2 + 0.28;
    // Wood backing panel
    box(vgThick + 0.04, vgH + 0.12, vgW + 0.10, 0x5c3d1e, vgX, vgY2, vgZ, 0.7, 'furniture');
    // Green rows
    const vgRows = Math.max(3, Math.floor(vgH / 0.30));
    for (let r = 0; r < vgRows; r++) {
        const gy = fl + 0.32 + r * (vgH / vgRows);
        box(vgThick, 0.24, vgW - 0.06, r % 2 === 0 ? 0x2a7a1a : 0x1d6010, vgX, gy, vgZ, 0.9, 'furniture');
    }
    // Accent flowers on garden
    [0.25, 0.65, 1.05].forEach((frac, fi) => {
        box(vgThick + 0.02, 0.07, vgW * 0.22,
            [0xffcc00, 0xff6644, 0xffffff][fi],
            vgX, fl + 0.32 + frac * vgH, vgZ, 0.9, 'furniture');
    });
    const gLight = new THREE.PointLight(0x88cc66, 0.35, 2.0);
    gLight.position.set(vgX - 0.4, vgY2 + 0.3, vgZ);
    scene.add(gLight);

    // ── Foyer Fountain (3 variants by style) ──────────────────────────
    // modern/minimalist → Variant A: central round tiered fountain
    // luxury            → Variant B: wall-mounted water feature
    // traditional       → Variant C: corner fountain with plants
    (function buildFountain() {
        // ── Palette ───────────────────────────────────────────────────
        const stoneCol = currentStyle === 'luxury'      ? 0x1e1a18 :
                         currentStyle === 'traditional' ? 0xb8a880 :
                         currentStyle === 'minimalist'  ? 0xe0e0e0 : 0x7a8fa0;
        const rimCol   = currentStyle === 'luxury'      ? 0xc9a84c :
                         currentStyle === 'traditional' ? 0xd4b870 :
                         currentStyle === 'minimalist'  ? 0xbbbbbb : 0x5c7a90;

        const stoneMat = new THREE.MeshStandardMaterial({ color: stoneCol, roughness: 0.88, metalness: 0.05 });
        const rimMat   = new THREE.MeshStandardMaterial({ color: rimCol,   roughness: 0.30, metalness: 0.55 });
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0x55bbee, transparent: true, opacity: 0.70,
            roughness: 0.0, metalness: 0.0,
            transmission: 0.50, thickness: 0.25,
            reflectivity: 0.95, ior: 1.33,
            side: THREE.DoubleSide
        });
        const sprayMat = new THREE.PointsMaterial({
            color: 0xaaddff, size: 0.045, transparent: true,
            opacity: 0.75, sizeAttenuation: true, depthWrite: false
        });

        // ── Shared: animated particle spray helper ────────────────────
        // Returns a THREE.Points object; its userData drives the animate loop
        function makeSpray(count, ox, oy, oz, spreadR, upSpeed) {
            const geo = new THREE.BufferGeometry();
            const pos  = new Float32Array(count * 3);
            const life = new Float32Array(count);   // 0-1 normalised lifetime
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * spreadR * 0.3;
                pos[i*3]   = ox + Math.cos(a) * r;
                pos[i*3+1] = oy + Math.random() * 0.05;
                pos[i*3+2] = oz + Math.sin(a) * r;
                life[i] = Math.random();
            }
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const pts = new THREE.Points(geo, sprayMat.clone());
            pts.userData.fountain = { ox, oy, oz, spreadR, upSpeed, life };
            scene.add(pts);
            groups.furniture.push(pts);
            return pts;
        }

        // Fountain position — same spot the stairs occupied
        const fx = cx + rw * 0.08;
        const fz = cz + rd * 0.05;
        const fy = fl;

        // ════════════════════════════════════════════════════════════
        // VARIANT A — Central round tiered fountain (modern / minimalist)
        // ════════════════════════════════════════════════════════════
        if (currentStyle === 'modern' || currentStyle === 'minimalist') {
            const basR = Math.min(rw, rd) * 0.18;   // outer basin radius
            const basH = 0.22;
            const col1 = 0x223366, col2 = 0x2255aa;

            // Outer basin — wide low cylinder
            const basinGeo = new THREE.CylinderGeometry(basR, basR * 1.08, basH, 32);
            const basin = new THREE.Mesh(basinGeo, stoneMat);
            basin.position.set(fx, fy + basH / 2, fz);
            basin.castShadow = true; basin.receiveShadow = true;
            scene.add(basin); groups.furniture.push(basin);

            // Outer basin rim ring
            const rimGeo = new THREE.TorusGeometry(basR, 0.04, 8, 32);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.x = Math.PI / 2;
            rim.position.set(fx, fy + basH, fz);
            scene.add(rim); groups.furniture.push(rim);

            // Water surface — inside basin
            const waterGeo = new THREE.CircleGeometry(basR - 0.06, 32);
            const water = new THREE.Mesh(waterGeo, waterMat);
            water.rotation.x = -Math.PI / 2;
            water.position.set(fx, fy + basH - 0.04, fz);
            scene.add(water); groups.furniture.push(water);
            water.userData.waterSurface = true;

            // Central pedestal column
            const pedH = 0.55;
            const pedGeo = new THREE.CylinderGeometry(0.08, 0.11, pedH, 16);
            const ped = new THREE.Mesh(pedGeo, stoneMat);
            ped.position.set(fx, fy + basH + pedH / 2, fz);
            scene.add(ped); groups.furniture.push(ped);

            // Upper small bowl
            const bowlH = 0.14;
            const bowlGeo = new THREE.CylinderGeometry(basR * 0.42, basR * 0.38, bowlH, 24);
            const bowl = new THREE.Mesh(bowlGeo, stoneMat);
            bowl.position.set(fx, fy + basH + pedH + bowlH / 2, fz);
            scene.add(bowl); groups.furniture.push(bowl);

            // Upper rim
            const rimTop = new THREE.Mesh(new THREE.TorusGeometry(basR * 0.42, 0.025, 8, 24), rimMat);
            rimTop.rotation.x = Math.PI / 2;
            rimTop.position.set(fx, fy + basH + pedH + bowlH, fz);
            scene.add(rimTop); groups.furniture.push(rimTop);

            // Upper water surface
            const waterTop = new THREE.Mesh(new THREE.CircleGeometry(basR * 0.40, 24), waterMat.clone());
            waterTop.rotation.x = -Math.PI / 2;
            waterTop.position.set(fx, fy + basH + pedH + bowlH - 0.03, fz);
            scene.add(waterTop); groups.furniture.push(waterTop);

            // Cascading water curtain (thin cylinder shell, open top/bottom)
            const curtainH = pedH - 0.02;
            const curtainGeo = new THREE.CylinderGeometry(basR * 0.44, basR * 0.44, curtainH, 24, 1, true);
            const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshPhysicalMaterial({
                color: 0x88ccff, transparent: true, opacity: 0.22,
                roughness: 0.0, side: THREE.DoubleSide, depthWrite: false
            }));
            curtain.position.set(fx, fy + basH + curtainH / 2, fz);
            scene.add(curtain); groups.furniture.push(curtain);
            curtain.userData.waterCurtain = true;

            // Spray particles from upper bowl
            makeSpray(80, fx, fy + basH + pedH + bowlH, fz, basR * 0.38, 0.022);

            // Underwater glow
            const wLight = new THREE.PointLight(0x44aaff, 0.9, basR * 3.5, 2);
            wLight.position.set(fx, fy + basH - 0.08, fz);
            wLight.userData.baseIntensity = 0.9;
            scene.add(wLight);

            // Soft rim halo
            const halo = new THREE.PointLight(0x99ddff, 0.5, basR * 5, 2);
            halo.position.set(fx, fy + basH + pedH * 0.8, fz);
            halo.userData.baseIntensity = 0.5;
            scene.add(halo);
        }

        // ════════════════════════════════════════════════════════════
        // VARIANT B — Wall-mounted water feature (luxury)
        // ════════════════════════════════════════════════════════════
        else if (currentStyle === 'luxury') {
            // Positioned against the back interior wall of the entrance
            const wx = fx;
            const wz = cz + rd / 2 - 0.18;  // back wall
            const panW = Math.min(rw * 0.42, 1.6);
            const panH = Math.min(WALL_H * 0.62, 1.7);
            const trayH = 0.18;

            // Dark stone backing panel
            const backMat = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.75, metalness: 0.2 });
            const back = new THREE.Mesh(new THREE.BoxGeometry(panW, panH, 0.09), backMat);
            back.position.set(wx, fy + panH / 2 + 0.12, wz);
            back.castShadow = true;
            scene.add(back); groups.furniture.push(back);

            // Decorative metal frame
            [[panW + 0.06, 0.05, 0.12, wx, fy + panH + 0.15, wz],   // top bar
             [panW + 0.06, 0.05, 0.12, wx, fy + 0.09, wz],           // bottom bar
             [0.05, panH + 0.10, 0.12, wx - panW/2, fy + panH/2 + 0.12, wz],  // left post
             [0.05, panH + 0.10, 0.12, wx + panW/2, fy + panH/2 + 0.12, wz],  // right post
            ].forEach(([w,h,d,x,y,z]) => {
                const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), rimMat);
                m.position.set(x,y,z);
                scene.add(m); groups.furniture.push(m);
            });

            // Water sheet — thin plane covering face of panel
            const sheetMat = new THREE.MeshPhysicalMaterial({
                color: 0x66ccee, transparent: true, opacity: 0.32,
                roughness: 0.0, metalness: 0.0,
                transmission: 0.7, ior: 1.33,
                side: THREE.DoubleSide, depthWrite: false
            });
            const sheet = new THREE.Mesh(new THREE.PlaneGeometry(panW - 0.04, panH - 0.04, 8, 16), sheetMat);
            sheet.position.set(wx, fy + panH / 2 + 0.12, wz + 0.05);
            sheet.userData.waterSheet = true;
            scene.add(sheet); groups.furniture.push(sheet);

            // Collection trough at the base
            const trough = new THREE.Mesh(new THREE.BoxGeometry(panW + 0.08, trayH, 0.28), stoneMat);
            trough.position.set(wx, fy + trayH / 2, wz - 0.08);
            scene.add(trough); groups.furniture.push(trough);

            // Water in trough
            const tw = new THREE.Mesh(new THREE.BoxGeometry(panW, 0.02, 0.22), waterMat.clone());
            tw.position.set(wx, fy + trayH - 0.01, wz - 0.05);
            scene.add(tw); groups.furniture.push(tw);

            // Fine mist particles at base of sheet
            makeSpray(60, wx, fy + trayH, wz - 0.06, panW * 0.45, 0.010);

            // Backlit glow behind water sheet
            const wl = new THREE.PointLight(0x2255ff, 1.1, panW * 3, 2);
            wl.position.set(wx, fy + panH * 0.55, wz - 0.12);
            wl.userData.baseIntensity = 1.1;
            scene.add(wl);

            // Top accent strip light
            const strip = new THREE.PointLight(0x99eeff, 0.6, panW * 2, 2);
            strip.position.set(wx, fy + panH + 0.1, wz);
            strip.userData.baseIntensity = 0.6;
            scene.add(strip);
        }

        // ════════════════════════════════════════════════════════════
        // VARIANT C — Corner fountain with plants (traditional)
        // ════════════════════════════════════════════════════════════
        else {
            // Sits in one corner of the entrance room
            const cr = Math.min(rw, rd) * 0.16;
            const cornerX = fx - rw * 0.12;
            const cornerZ = fz - rd * 0.12;

            // Corner quarter-circle basin
            const basinShape = new THREE.Shape();
            basinShape.absarc(0, 0, cr, 0, Math.PI / 2, false);
            basinShape.lineTo(0, 0);
            const basinGeo2 = new THREE.ExtrudeGeometry(basinShape, {
                depth: 0.20, bevelEnabled: false
            });
            const cornerBasin = new THREE.Mesh(basinGeo2, stoneMat);
            cornerBasin.rotation.x = -Math.PI / 2;
            cornerBasin.position.set(cornerX - cr, fy, cornerZ - cr);
            cornerBasin.castShadow = true; cornerBasin.receiveShadow = true;
            scene.add(cornerBasin); groups.furniture.push(cornerBasin);

            // Water pool surface (quarter circle)
            const poolShape = new THREE.Shape();
            poolShape.absarc(0, 0, cr - 0.06, 0, Math.PI / 2, false);
            poolShape.lineTo(0, 0);
            const poolGeo = new THREE.ShapeGeometry(poolShape);
            const pool = new THREE.Mesh(poolGeo, waterMat.clone());
            pool.rotation.x = -Math.PI / 2;
            pool.position.set(cornerX - cr, fy + 0.19, cornerZ - cr);
            scene.add(pool); groups.furniture.push(pool);

            // Central spout column in corner
            const spoutCol = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.55, 12), stoneMat);
            spoutCol.position.set(cornerX, fy + 0.275, cornerZ);
            scene.add(spoutCol); groups.furniture.push(spoutCol);

            // Spout nozzle
            const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), rimMat);
            nozzle.position.set(cornerX, fy + 0.60, cornerZ);
            scene.add(nozzle); groups.furniture.push(nozzle);

            // Cascading water arc (thin torus segment)
            const arcMat = new THREE.MeshPhysicalMaterial({
                color: 0x88ddff, transparent: true, opacity: 0.38,
                roughness: 0.0, depthWrite: false, side: THREE.DoubleSide
            });
            const arc = new THREE.Mesh(new THREE.TorusGeometry(cr * 0.5, 0.025, 8, 24, Math.PI * 0.6), arcMat);
            arc.position.set(cornerX - cr * 0.3, fy + 0.42, cornerZ - cr * 0.3);
            arc.rotation.set(Math.PI * 0.35, Math.PI * 0.25, 0);
            scene.add(arc); groups.furniture.push(arc);

            // Spray from nozzle tip
            makeSpray(55, cornerX, fy + 0.65, cornerZ, cr * 0.55, 0.018);

            // ── Flanking potted plants (corner variant) ───────────────
            const potCol2 = 0xc87941;
            [[-cr * 0.9, cr * 0.15], [cr * 0.15, -cr * 0.9]].forEach(([dx, dz]) => {
                const px2 = cornerX + dx, pz2 = cornerZ + dz;
                // Pot
                const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.32, 12),
                    new THREE.MeshStandardMaterial({ color: potCol2, roughness: 0.75 }));
                pot.position.set(px2, fy + 0.16, pz2);
                scene.add(pot); groups.furniture.push(pot);
                // Soil
                const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12),
                    new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.98 }));
                soil.position.set(px2, fy + 0.34, pz2);
                scene.add(soil); groups.furniture.push(soil);
                // Trunk
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.70, 6),
                    new THREE.MeshStandardMaterial({ color: 0x3b2008, roughness: 0.9 }));
                trunk.position.set(px2, fy + 0.71, pz2);
                scene.add(trunk); groups.furniture.push(trunk);
                // Foliage tiers
                [[0.22, 0.18, 0.32, 0x2a7a1a], [0.16, 0.13, 0.55, 0x1d6010], [0.10, 0.07, 0.80, 0x246615]].forEach(([rt, rb, yy, col]) => {
                    const f = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 0.22, 10),
                        new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
                    f.position.set(px2, fy + yy, pz2);
                    scene.add(f); groups.furniture.push(f);
                });
            });

            // Warm water glow
            const wl3 = new THREE.PointLight(0x44aaff, 0.7, cr * 5, 2);
            wl3.position.set(cornerX - cr * 0.5, fy + 0.25, cornerZ - cr * 0.5);
            wl3.userData.baseIntensity = 0.7;
            scene.add(wl3);
        }

        // ── Register fountain animation (runs every frame in animate()) ──
        if (!window._fountainMeshes) window._fountainMeshes = [];
        scene.traverse(obj => {
            if (obj.isPoints && obj.userData.fountain) window._fountainMeshes.push(obj);
            if (obj.isMesh  && (obj.userData.waterSurface || obj.userData.waterSheet || obj.userData.waterCurtain)) window._fountainMeshes.push(obj);
        });
    })(); // end buildFountain

    // ── Welcome mat ──────────────────────────────────────────────────
    const matCol = currentStyle === 'luxury' ? 0x2a1a08 : 0x4a3a28;
    addMesh(new THREE.BoxGeometry(Math.min(rw * 0.3, 1.2), 0.025, Math.min(rd * 0.12, 0.55)),
        mat(matCol, 0.98), cx, fl + 0.013, cz - rd / 2 + 0.5, 0, 0, 'furniture');
    // Mat pattern (lighter stripe)
    box(Math.min(rw * 0.26, 1.0), 0.03, 0.04, 0x7a6a50, cx, fl + 0.016, cz - rd / 2 + 0.5, 0.9, 'furniture');

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

        // ── Fountain animation ─────────────────────────────────────────
        const t = Date.now() * 0.001;
        if (window._fountainMeshes) {
            window._fountainMeshes.forEach(obj => {
                // Animated water spray particles
                if (obj.isPoints && obj.userData.fountain) {
                    const fd = obj.userData.fountain;
                    if (!fd.life) {
                        fd.life = new Float32Array(obj.geometry.attributes.position.count);
                        for (let i = 0; i < fd.life.length; i++) fd.life[i] = Math.random();
                    }
                    const pos = obj.geometry.attributes.position.array;
                    const count = pos.length / 3;
                    for (let i = 0; i < count; i++) {
                        fd.life[i] += 0.018;
                        if (fd.life[i] > 1.0) {
                            const a = Math.random() * Math.PI * 2;
                            const r = Math.random() * fd.spreadR * 0.25;
                            pos[i*3]   = fd.ox + Math.cos(a) * r;
                            pos[i*3+1] = fd.oy;
                            pos[i*3+2] = fd.oz + Math.sin(a) * r;
                            fd.life[i] = 0;
                        } else {
                            const lf = fd.life[i];
                            const dx = pos[i*3]   - fd.ox;
                            const dz = pos[i*3+2] - fd.oz;
                            pos[i*3+1] = fd.oy + lf * fd.upSpeed * 28 - lf * lf * 14;
                            const dr = 0.004 * fd.spreadR;
                            const len = Math.sqrt(dx*dx + dz*dz) || 0.001;
                            pos[i*3]   += dx / len * dr;
                            pos[i*3+2] += dz / len * dr;
                        }
                    }
                    obj.geometry.attributes.position.needsUpdate = true;
                    obj.material.opacity = 0.60 + Math.sin(t * 1.8) * 0.12;
                }
                // Rippling water surface pulse
                if (obj.isMesh && obj.userData.waterSurface) {
                    obj.material.opacity = 0.60 + Math.sin(t * 2.2) * 0.10;
                    obj.position.y += Math.sin(t * 3.5) * 0.0002;
                }
                // Wall water sheet shimmer
                if (obj.isMesh && obj.userData.waterSheet) {
                    obj.material.opacity = 0.28 + Math.sin(t * 2.8 + 1.2) * 0.07;
                    obj.scale.y = 1.0 + Math.sin(t * 1.4) * 0.008;
                }
                // Curtain shimmer + slow rotation
                if (obj.isMesh && obj.userData.waterCurtain) {
                    obj.material.opacity = 0.18 + Math.sin(t * 3.1) * 0.06;
                    obj.rotation.y += 0.003;
                }
            });
        }
        
        // ── Pool water ripple animation ─────────────────────────────
        if (window._poolMeshes && window._poolMeshes.length) {
            const pt = Date.now() * 0.001;
            window._poolMeshes.forEach(({ water, caustic }) => {
                // Animated vertex ripple on water surface
                if (water && water.geometry && water.geometry.attributes.position) {
                    const pos = water.geometry.attributes.position;
                    const count = pos.count;
                    for (let i = 0; i < count; i++) {
                        const x = pos.getX(i), z = pos.getZ(i);
                        pos.setY(i,
                            Math.sin(x * 3.2 + pt * 1.8) * 0.022 +
                            Math.sin(z * 2.6 + pt * 1.3) * 0.018 +
                            Math.sin((x - z) * 2.1 + pt * 2.1) * 0.012 +
                            Math.cos(x * 1.5 + z * 1.5 + pt * 0.9) * 0.008
                        );
                    }
                    pos.needsUpdate = true;
                    water.geometry.computeVertexNormals();
                    // Pulsing opacity — stays high (opaque pool water)
                    water.material.opacity = 0.84 + Math.sin(pt * 1.4) * 0.06;
                    // Emissive glow breathes like underwater lighting
                    water.material.emissiveIntensity = 0.25 + Math.sin(pt * 2.2) * 0.12;
                }
                // Caustic shimmer — faster flicker, brighter peaks
                if (caustic && caustic.material) {
                    caustic.material.emissiveIntensity = 0.70 + Math.sin(pt * 3.5 + 0.8) * 0.30;
                    caustic.material.opacity           = 0.22 + Math.sin(pt * 4.1 + 1.2) * 0.12;
                    // Slowly drift caustic pattern for shimmer effect
                    caustic.position.x += Math.sin(pt * 0.7) * 0.0004;
                    caustic.position.z += Math.cos(pt * 0.5) * 0.0004;
                }
            });
        }
        
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