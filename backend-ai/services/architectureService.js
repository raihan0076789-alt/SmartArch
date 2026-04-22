/**
 * architectureService.js
 * Building Layout Engine — BSP subdivision, adjacency graph,
 * circulation validation, multi-floor staircase, image→floorplan pipeline.
 */

import { Ollama } from 'ollama';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { createCanvas, loadImage } from 'canvas';   // npm i canvas
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const WALL_THICKNESS  = 0.2;
const DOOR_WIDTH      = 0.9;
const FLOOR_HEIGHT    = 3.0;
const MIN_ROOM_DIM    = 2.5;   // metres — smallest valid room side
const STAIR_WIDTH     = 1.2;
const STAIR_STEPS     = 12;

/** Canonical room-type catalogue with min area (m²) and adjacency weights */
const ROOM_CATALOGUE = {
  entrance:  { minArea:  4, color: '#a0c4ff', adjacency: { living: 10, hallway: 10 } },
  living:    { minArea: 16, color: '#bde0fe', adjacency: { dining: 9, kitchen: 7, entrance: 10, hallway: 8 } },
  dining:    { minArea: 10, color: '#ffd6a5', adjacency: { kitchen: 10, living: 9, hallway: 6 } },
  kitchen:   { minArea:  8, color: '#fdffb6', adjacency: { dining: 10, living: 7, hallway: 5 } },
  bedroom:   { minArea: 12, color: '#caffbf', adjacency: { bathroom: 10, hallway: 9 } },
  bathroom:  { minArea:  4, color: '#9bf6ff', adjacency: { bedroom: 10, hallway: 7 } },
  hallway:   { minArea:  4, color: '#e0e0e0', adjacency: {} },
  office:    { minArea:  8, color: '#c3b1e1', adjacency: { hallway: 8 } },
  garage:    { minArea: 16, color: '#d4a373', adjacency: { entrance: 7, hallway: 5 } },
  stairs:    { minArea:  4, color: '#bbb',    adjacency: { hallway: 10 } },
};

// ─────────────────────────────────────────────
//  UTILITY — pure geometry helpers
// ─────────────────────────────────────────────

/** Axis-aligned rect overlap test (exclusive boundary) */
function rectsOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function rectArea(r) { return r.w * r.h; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function randBetween(lo, hi) { return lo + Math.random() * (hi - lo); }

// ─────────────────────────────────────────────
//  BSP NODE
// ─────────────────────────────────────────────
class BSPNode {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left  = null;
    this.right = null;
    this.room  = null;   // assigned after leaf is finalised
  }

  get isLeaf() { return !this.left && !this.right; }

  /**
   * Recursively split until each leaf is small enough for one room.
   * @param {number} minSize  — minimum leaf dimension before stopping
   * @param {number} depth    — recursion guard
   */
  split(minSize = MIN_ROOM_DIM * 2 + WALL_THICKNESS, depth = 0) {
    if (depth > 8) return;

    const canSplitH = this.h >= minSize * 2;
    const canSplitV = this.w >= minSize * 2;

    if (!canSplitH && !canSplitV) return;   // leaf

    // Prefer to split the longer axis; add randomness
    let splitVertical;
    if (canSplitH && canSplitV) {
      splitVertical = this.w > this.h
        ? Math.random() < 0.65
        : Math.random() < 0.35;
    } else {
      splitVertical = canSplitV;
    }

    if (splitVertical) {
      const splitX = Math.round(randBetween(minSize, this.w - minSize) * 10) / 10;
      this.left  = new BSPNode(this.x,          this.y, splitX,          this.h);
      this.right = new BSPNode(this.x + splitX, this.y, this.w - splitX, this.h);
    } else {
      const splitY = Math.round(randBetween(minSize, this.h - minSize) * 10) / 10;
      this.left  = new BSPNode(this.x, this.y,          this.w, splitY         );
      this.right = new BSPNode(this.x, this.y + splitY, this.w, this.h - splitY);
    }

    this.left.split(minSize, depth + 1);
    this.right.split(minSize, depth + 1);
  }

  /** Collect all leaf nodes */
  getLeaves() {
    if (this.isLeaf) return [this];
    return [...(this.left?.getLeaves() || []), ...(this.right?.getLeaves() || [])];
  }
}

// ─────────────────────────────────────────────
//  LAYOUT ENGINE
// ─────────────────────────────────────────────
class LayoutEngine {

  /**
   * Generate a complete multi-floor building layout.
   * @param {object} params
   * @param {string}   params.buildingType  residential | office | commercial
   * @param {number}   params.floors        number of floors (1–6)
   * @param {number}   params.totalArea     total floor area m² per floor
   * @param {Array}    params.rooms         [{type, count}]  room requirements
   * @returns {{ floors: Floor[] }}
   */
  generate(params) {
    const {
      buildingType = 'residential',
      floors       = 1,
      totalArea    = 100,
      rooms        = [],
    } = params;

    const floorCount  = clamp(Math.round(floors), 1, 6);
    const areaPerFloor = Math.max(totalArea, 40);

    // Building footprint — roughly square
    const side = Math.ceil(Math.sqrt(areaPerFloor));
    const bldgW = side;
    const bldgH = Math.ceil(areaPerFloor / side);

    // Resolve full room list for floor 0; upper floors get bedrooms + bathrooms + hallway
    const groundRooms = this._resolveRoomList(buildingType, rooms, 0);
    const upperRooms  = this._resolveRoomList(buildingType, rooms, 1);

    const floorsData = [];
    for (let lvl = 0; lvl < floorCount; lvl++) {
      const roomTypes = lvl === 0 ? groundRooms : upperRooms;
      const floor = this._generateFloor(lvl, bldgW, bldgH, roomTypes, floorCount);
      floorsData.push(floor);
    }

    // Wire staircases between consecutive floors
    if (floorCount > 1) {
      this._placeStaircases(floorsData);
    }

    return { floors: floorsData };
  }

  // ── Private ──────────────────────────────────

  /**
   * Determine which room types to place on a given floor.
   */
  _resolveRoomList(buildingType, requested, floorLevel) {
    const types = [];

    if (requested && requested.length > 0) {
      requested.forEach(({ type, count = 1 }) => {
        for (let i = 0; i < count; i++) types.push(type);
      });
    } else {
      // Sensible defaults per building type
      if (buildingType === 'residential') {
        if (floorLevel === 0) {
          types.push('entrance','living','dining','kitchen','bathroom','hallway');
        } else {
          types.push('bedroom','bedroom','bathroom','hallway');
        }
      } else if (buildingType === 'office') {
        types.push('entrance','hallway','office','office','office','bathroom','bathroom');
      } else {
        types.push('entrance','hallway','living','kitchen','bathroom');
      }
    }

    // Always ensure a hallway exists for circulation
    if (!types.includes('hallway')) types.push('hallway');

    return types;
  }

  /**
   * Build one floor: BSP → room assignment → walls → doors.
   */
  _generateFloor(level, bldgW, bldgH, roomTypes, totalFloors) {
    // 1. BSP partition
    const root = new BSPNode(0, 0, bldgW, bldgH);
    root.split(MIN_ROOM_DIM * 2);

    const leaves = root.getLeaves();

    // 2. Sort leaves by area descending; sort room types by minArea descending
    const sortedLeaves = [...leaves].sort((a, b) => rectArea(b) - rectArea(a));
    const sortedTypes  = [...roomTypes].sort(
      (a, b) => (ROOM_CATALOGUE[b]?.minArea || 6) - (ROOM_CATALOGUE[a]?.minArea || 6)
    );

    // 3. Assign room types to leaves (greedy)
    const rooms = [];
    sortedLeaves.forEach((leaf, i) => {
      const type   = sortedTypes[i] || 'hallway';
      const inset  = WALL_THICKNESS;
      const room   = {
        id:     `${type}-${level}-${i}`,
        type,
        x:      parseFloat((leaf.x + inset).toFixed(2)),
        y:      parseFloat((leaf.y + inset).toFixed(2)),
        width:  parseFloat((leaf.w - inset * 2).toFixed(2)),
        height: parseFloat((leaf.h - inset * 2).toFixed(2)),
        label:  type.charAt(0).toUpperCase() + type.slice(1),
        color:  ROOM_CATALOGUE[type]?.color || '#ccc',
      };

      // Guard: skip degenerate rooms
      if (room.width >= MIN_ROOM_DIM && room.height >= MIN_ROOM_DIM) {
        rooms.push(room);
        leaf.room = room;
      }
    });

    // 4. Build walls from BSP splits
    const walls = this._extractWalls(root, bldgW, bldgH);

    // 5. Place doors based on adjacency graph
    const doors = this._placeDoors(rooms, walls);

    // 6. Reserve stair placeholder on floor 0 and top if multi-floor
    // (actual stair meshes placed by _placeStaircases)
    const stairs = [];

    return { level, rooms, walls, doors, stairs, width: bldgW, height: bldgH };
  }

  /**
   * Walk the BSP tree and emit wall segments at every split boundary.
   */
  _extractWalls(node, bldgW, bldgH) {
    const wallSet = new Map();  // dedup by key

    const addWall = (x1, y1, x2, y2) => {
      // Normalise direction so (x1,y1) is always the smaller coordinate
      let wx1 = x1, wy1 = y1, wx2 = x2, wy2 = y2;
      if (wx1 > wx2 || (wx1 === wx2 && wy1 > wy2)) {
        [wx1, wx2] = [wx2, wx1];
        [wy1, wy2] = [wy2, wy1];
      }
      const key = `${wx1},${wy1},${wx2},${wy2}`;
      if (!wallSet.has(key)) {
        wallSet.set(key, { id: `wall-${wallSet.size}`, x1: wx1, y1: wy1, x2: wx2, y2: wy2, thickness: WALL_THICKNESS });
      }
    };

    // Outer perimeter walls
    addWall(0,      0,      bldgW, 0     );
    addWall(bldgW,  0,      bldgW, bldgH );
    addWall(bldgW,  bldgH,  0,     bldgH );
    addWall(0,      bldgH,  0,     0     );

    // Internal partition walls from BSP splits
    const traverse = (n) => {
      if (!n || n.isLeaf) return;
      const l = n.left, r = n.right;
      // Determine if split was vertical (left/right share same y-range) or horizontal
      if (Math.abs(l.x + l.w - r.x) < 0.01) {
        // Vertical split — shared boundary is a vertical wall
        const sx = l.x + l.w;
        addWall(sx, n.y, sx, n.y + n.h);
      } else {
        // Horizontal split
        const sy = l.y + l.h;
        addWall(n.x, sy, n.x + n.w, sy);
      }
      traverse(l);
      traverse(r);
    };
    traverse(node);

    return Array.from(wallSet.values());
  }

  /**
   * For every pair of adjacent rooms, punch a door in their shared wall.
   * Adjacency: rooms whose bounding boxes share an edge within WALL_THICKNESS tolerance.
   */
  _placeDoors(rooms, walls) {
    const doors   = [];
    const doorSet = new Set();

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];

        const sharedEdge = this._sharedEdge(a, b);
        if (!sharedEdge) continue;

        // Adjacency weight — prioritise based on catalogue
        const aCat = ROOM_CATALOGUE[a.type] || {};
        const weight = aCat.adjacency?.[b.type] || 0;
        if (weight === 0 && a.type !== 'hallway' && b.type !== 'hallway') continue;

        const key = [a.id, b.id].sort().join('|');
        if (doorSet.has(key)) continue;
        doorSet.add(key);

        // Centre the door on the shared edge
        const door = this._createDoor(sharedEdge, a, b, doors.length);
        if (door) doors.push(door);
      }
    }

    return doors;
  }

  /**
   * Return shared-edge descriptor if rooms a and b are adjacent (share a wall segment).
   * Returns null if not adjacent.
   */
  _sharedEdge(a, b) {
    const tol = WALL_THICKNESS + 0.1;

    const aRight  = a.x + a.width;
    const aBottom = a.y + a.height;
    const bRight  = b.x + b.width;
    const bBottom = b.y + b.height;

    // Check vertical shared edge: a's right ≈ b's left (or vice versa)
    if (Math.abs(aRight - b.x) < tol) {
      const overlapY0 = Math.max(a.y, b.y);
      const overlapY1 = Math.min(aBottom, bBottom);
      if (overlapY1 - overlapY0 >= DOOR_WIDTH + 0.2) {
        return { axis: 'vertical', x: aRight, y0: overlapY0, y1: overlapY1 };
      }
    }
    if (Math.abs(bRight - a.x) < tol) {
      const overlapY0 = Math.max(a.y, b.y);
      const overlapY1 = Math.min(aBottom, bBottom);
      if (overlapY1 - overlapY0 >= DOOR_WIDTH + 0.2) {
        return { axis: 'vertical', x: a.x, y0: overlapY0, y1: overlapY1 };
      }
    }

    // Check horizontal shared edge
    if (Math.abs(aBottom - b.y) < tol) {
      const overlapX0 = Math.max(a.x, b.x);
      const overlapX1 = Math.min(aRight, bRight);
      if (overlapX1 - overlapX0 >= DOOR_WIDTH + 0.2) {
        return { axis: 'horizontal', y: aBottom, x0: overlapX0, x1: overlapX1 };
      }
    }
    if (Math.abs(bBottom - a.y) < tol) {
      const overlapX0 = Math.max(a.x, b.x);
      const overlapX1 = Math.min(aRight, bRight);
      if (overlapX1 - overlapX0 >= DOOR_WIDTH + 0.2) {
        return { axis: 'horizontal', y: a.y, x0: overlapX0, x1: overlapX1 };
      }
    }

    return null;
  }

  _createDoor(edge, roomA, roomB, index) {
    if (edge.axis === 'vertical') {
      const midY = (edge.y0 + edge.y1) / 2;
      return {
        id:      `door-${index}`,
        x:       parseFloat(edge.x.toFixed(2)),
        y:       parseFloat((midY - DOOR_WIDTH / 2).toFixed(2)),
        width:   DOOR_WIDTH,
        height:  2.1,
        facing:  'east',
        connectsRooms: [roomA.id, roomB.id],
      };
    } else {
      const midX = (edge.x0 + edge.x1) / 2;
      return {
        id:      `door-${index}`,
        x:       parseFloat((midX - DOOR_WIDTH / 2).toFixed(2)),
        y:       parseFloat(edge.y.toFixed(2)),
        width:   DOOR_WIDTH,
        height:  2.1,
        facing:  'south',
        connectsRooms: [roomA.id, roomB.id],
      };
    }
  }

  /**
   * Find a hallway (or largest room) on each floor and insert staircase objects
   * that share the same XZ position across consecutive floors.
   */
  _placeStaircases(floorsData) {
    // Pick a corner position from floor 0 for all staircases
    const f0      = floorsData[0];
    const anchor  = this._findStairAnchor(f0);

    for (let lvl = 0; lvl < floorsData.length - 1; lvl++) {
      const stair = {
        id:         `stair-${lvl}-${lvl + 1}`,
        startFloor: lvl,
        endFloor:   lvl + 1,
        position:   { x: anchor.x, y: anchor.y },
        width:      STAIR_WIDTH,
        depth:      STAIR_WIDTH * 3,   // 3× width for tread run
        steps:      STAIR_STEPS,
      };

      floorsData[lvl    ].stairs.push({ ...stair, direction: 'up'   });
      floorsData[lvl + 1].stairs.push({ ...stair, direction: 'down' });
    }
  }

  /** Find the hallway, or else the largest room, and return a stair anchor point */
  _findStairAnchor(floor) {
    const hallway = floor.rooms.find(r => r.type === 'hallway');
    const ref     = hallway || floor.rooms.reduce((best, r) =>
      (r.width * r.height > best.width * best.height ? r : best), floor.rooms[0]);

    if (!ref) return { x: 0.5, y: 0.5 };
    return {
      x: parseFloat((ref.x + 0.3).toFixed(2)),
      y: parseFloat((ref.y + 0.3).toFixed(2)),
    };
  }
}

// ─────────────────────────────────────────────
//  IMAGE → FLOORPLAN PIPELINE
// ─────────────────────────────────────────────
class FloorplanImageParser {
  /**
   * Lightweight edge-detection + contour → room polygon → JSON pipeline.
   * Uses the `canvas` npm package (server-side).
   *
   * @param {Buffer} imageBuffer  Raw image buffer (PNG/JPEG)
   * @param {number} scaleFactor  Pixels per metre (default 20)
   * @returns {{ floors: Floor[] }}
   */
  async parse(imageBuffer, scaleFactor = 20) {
    const img    = await loadImage(imageBuffer);
    const W      = img.width;
    const H      = img.height;

    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, W, H);
    const pixels    = imageData.data;   // Uint8ClampedArray RGBA

    // 1. Greyscale
    const grey = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      grey[i] = Math.round(0.299 * pixels[i*4] + 0.587 * pixels[i*4+1] + 0.114 * pixels[i*4+2]);
    }

    // 2. Sobel edge detection
    const edges = this._sobelEdges(grey, W, H);

    // 3. Simple threshold → binary wall map
    const EDGE_THRESHOLD = 60;
    const wallMap = edges.map(v => v > EDGE_THRESHOLD ? 1 : 0);

    // 4. Flood-fill to find connected regions (rooms)
    const regions = this._floodFillRegions(wallMap, W, H);

    // 5. Convert regions to room rects
    const rooms = regions
      .filter(r => r.pixelCount > 400)   // discard noise
      .map((region, i) => this._regionToRoom(region, i, scaleFactor));

    // 6. Infer adjacency-based doors
    const engine = new LayoutEngine();
    const doors  = engine._placeDoors(rooms, []);

    // 7. Wrap in single-floor structure
    const bldgW = parseFloat((W / scaleFactor).toFixed(2));
    const bldgH = parseFloat((H / scaleFactor).toFixed(2));

    const walls = this._buildOutlineWalls(bldgW, bldgH);

    return {
      floors: [{
        level:  0,
        rooms,
        walls,
        doors,
        stairs: [],
        width:  bldgW,
        height: bldgH,
        source: 'image-parse',
      }]
    };
  }

  // ── Private ──────────────────────────────────

  _sobelEdges(grey, W, H) {
    const out = new Float32Array(W * H);
    const kx  = [-1,0,1, -2,0,2, -1,0,1];
    const ky  = [-1,-2,-1, 0,0,0, 1,2,1];

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let gx = 0, gy = 0;
        for (let ky_ = -1; ky_ <= 1; ky_++) {
          for (let kx_ = -1; kx_ <= 1; kx_++) {
            const idx = (y + ky_) * W + (x + kx_);
            const ki  = (ky_ + 1) * 3 + (kx_ + 1);
            gx += grey[idx] * kx[ki];
            gy += grey[idx] * ky[ki];
          }
        }
        out[y * W + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return out;
  }

  /** 4-connected flood fill returning array of {minX,minY,maxX,maxY,pixelCount} */
  _floodFillRegions(wallMap, W, H) {
    const visited = new Uint8Array(W * H);
    const regions = [];

    for (let startY = 0; startY < H; startY++) {
      for (let startX = 0; startX < W; startX++) {
        const idx = startY * W + startX;
        if (wallMap[idx] === 1 || visited[idx]) continue;

        // BFS
        const stack = [idx];
        visited[idx] = 1;
        let minX = startX, minY = startY, maxX = startX, maxY = startY;
        let count = 0;

        while (stack.length > 0) {
          const cur = stack.pop();
          const cx  = cur % W;
          const cy  = Math.floor(cur / W);
          count++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbours = [cur - 1, cur + 1, cur - W, cur + W];
          for (const n of neighbours) {
            if (n < 0 || n >= W * H) continue;
            const nx = n % W;
            const ny = Math.floor(n / W);
            if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
            if (visited[n] || wallMap[n] === 1) continue;
            visited[n] = 1;
            stack.push(n);
          }
        }

        regions.push({ minX, minY, maxX, maxY, pixelCount: count });
      }
    }
    return regions;
  }

  _regionToRoom(region, index, scaleFactor) {
    const TYPES = ['living','bedroom','kitchen','dining','bathroom','hallway','office'];
    const type  = TYPES[index % TYPES.length];
    return {
      id:     `parsed-room-${index}`,
      type,
      x:      parseFloat((region.minX / scaleFactor).toFixed(2)),
      y:      parseFloat((region.minY / scaleFactor).toFixed(2)),
      width:  parseFloat(((region.maxX - region.minX) / scaleFactor).toFixed(2)),
      height: parseFloat(((region.maxY - region.minY) / scaleFactor).toFixed(2)),
      label:  type.charAt(0).toUpperCase() + type.slice(1),
      color:  ROOM_CATALOGUE[type]?.color || '#ccc',
    };
  }

  _buildOutlineWalls(W, H) {
    return [
      { id: 'w-top',    x1: 0, y1: 0, x2: W, y2: 0,  thickness: WALL_THICKNESS },
      { id: 'w-right',  x1: W, y1: 0, x2: W, y2: H,  thickness: WALL_THICKNESS },
      { id: 'w-bottom', x1: W, y1: H, x2: 0, y2: H,  thickness: WALL_THICKNESS },
      { id: 'w-left',   x1: 0, y1: H, x2: 0, y2: 0,  thickness: WALL_THICKNESS },
    ];
  }
}

// ─────────────────────────────────────────────
//  AI CHAT WRAPPER  (Ollama)
// ─────────────────────────────────────────────
class OllamaChat {
  constructor() {
    this.host  = process.env.OLLAMA_HOST  || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'phi3:mini';
    this.ollama = new Ollama({ host: this.host });
    logger.info(`OllamaChat initialised — host: ${this.host}, model: ${this.model}`);
  }

  /**
   * @param {string}   systemPrompt  Rich project-aware system context
   * @param {string}   userMessage   Current user message
   * @param {string}   requestId     For logging
   * @param {Array}    history       Optional prior turns [{role,content}]
   */
  async chat(systemPrompt, userMessage, requestId, history = [], overrideOptions = {}) {
    try {
      logger.info(`[${requestId}] Ollama chat → model: ${this.model}, history: ${history.length} turns`);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),   // keep last 6 turns (3 exchanges) to stay within context window
        { role: 'user',   content: userMessage },
      ];

      const res = await this.ollama.chat({
        model:   this.model,
        messages,
        stream:  false,
        options: {
          temperature:  0.72,   // slightly creative but grounded
          top_p:        0.90,
          top_k:        40,
          num_predict:  1024,   // enough for detailed suggestions without runaway responses
          repeat_penalty: 1.1,  // discourages repetitive phrasing
          stop: ['<|end|>', '<|user|>', '[INST]'],  // phi3 / mistral stop tokens
          ...overrideOptions,   // allow per-call overrides (e.g. deterministic feedback)
        },
      });

      if (!res?.message?.content) throw new ApiError('Empty Ollama response', 500);
      logger.info(`[${requestId}] Ollama OK — ${res.message.content.length} chars`);
      return res.message.content.trim();
    } catch (err) {
      logger.error(`[${requestId}] Ollama error:`, err);
      if (err.code === 'ECONNREFUSED')
        throw new ApiError(`Cannot connect to Ollama at ${this.host}. Make sure Ollama is running.`, 503);
      if (err.message?.includes('not found'))
        throw new ApiError(`Model '${this.model}' not found — run: ollama pull ${this.model}`, 404);
      throw new ApiError(`Ollama: ${err.message}`, err.statusCode || 500);
    }
  }
}

// ─────────────────────────────────────────────
//  MAIN SERVICE — public API
// ─────────────────────────────────────────────
class ArchitectureService {
  constructor() {
    this.layoutEngine   = new LayoutEngine();
    this.imageParser    = new FloorplanImageParser();
    this.ollamaChat     = new OllamaChat();
  }

  // ── Layout generation ────────────────────────

  /**
   * Generate a building floorplan layout programmatically (no AI required).
   * @param {object} params  — see LayoutEngine.generate()
   * @param {string} requestId
   * @returns {{ floors: Floor[] }}
   */
  generateFloorplan(params, requestId) {
    logger.info(`[${requestId}] generateFloorplan — params: ${JSON.stringify(params)}`);
    try {
      const result = this.layoutEngine.generate(params);
      logger.info(`[${requestId}] Floorplan generated — ${result.floors.length} floor(s)`);
      return result;
    } catch (err) {
      logger.error(`[${requestId}] generateFloorplan error:`, err);
      throw new ApiError(`Layout generation failed: ${err.message}`, 500);
    }
  }

  /**
   * Parse an uploaded floorplan image into a floorplan JSON.
   * @param {Buffer} imageBuffer
   * @param {number} scaleFactor  pixels per metre
   * @param {string} requestId
   * @returns {{ floors: Floor[] }}
   */
  async parseFloorplanImage(imageBuffer, scaleFactor = 20, requestId) {
    logger.info(`[${requestId}] parseFloorplanImage — buffer size: ${imageBuffer.length}`);
    try {
      const result = await this.imageParser.parse(imageBuffer, scaleFactor);
      logger.info(`[${requestId}] Image parsed — ${result.floors[0].rooms.length} room(s) detected`);
      return result;
    } catch (err) {
      logger.error(`[${requestId}] parseFloorplanImage error:`, err);
      throw new ApiError(`Image parse failed: ${err.message}`, 500);
    }
  }

  // ── AI Chat (Ollama) ─────────────────────────

  /**
   * Thin proxy for /chat and /suggest routes.
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @param {string} requestId
   * @param {Array}  history  Optional [{role,content}] conversation turns
   */
  async callLlamaAPI(systemPrompt, userMessage, requestId, history = [], overrideOptions = {}) {
    return this.ollamaChat.chat(systemPrompt, userMessage, requestId, history, overrideOptions);
  }
}

export const architectureService = new ArchitectureService();