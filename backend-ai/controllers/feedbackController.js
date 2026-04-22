/**
 * feedbackController.js  (v2 — llama3 compatible)
 * POST /api/architecture/feedback
 */

import { architectureService } from '../services/architectureService.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export const getDesignFeedback = async (req, res, next) => {
  const requestId = uuidv4();
  try {
    const { projectData } = req.body;

    if (!projectData) {
      return res.status(400).json({ error: 'Bad Request', message: 'projectData is required', requestId });
    }

    const floors   = Array.isArray(projectData.floors) ? projectData.floors : [];
    const allRooms = floors.flatMap(f => Array.isArray(f.rooms) ? f.rooms : []);

    if (allRooms.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Project must have at least one room before requesting feedback',
        requestId,
      });
    }

    logger.info(`[${requestId}] getDesignFeedback — project: "${projectData.name}", rooms: ${allRooms.length}`);

    const prompt   = buildPrompt(projectData);

    // Use a dedicated system prompt so the model stays in strict JSON mode
    const systemPrompt = `You are an architectural design scoring system. You output ONLY valid JSON. No prose, no markdown, no explanation — just the raw JSON object requested. Do not change the JSON keys. Fill every value with a real analysis of the given project data.`;

    let rawReply;
    try {
      // Deterministic options: temperature=0 → same input always produces same scores
      rawReply = await architectureService.callLlamaAPI(systemPrompt, prompt, requestId, [], {
        temperature:    0.0,
        top_p:          1.0,
        top_k:          1,
        num_predict:    1500,
        repeat_penalty: 1.0,
      });
    } catch (ollamaErr) {
      // Ollama offline or model not pulled → use pure heuristic fallback silently
      logger.warn(`[${requestId}] Ollama unavailable — heuristic fallback: ${ollamaErr.message}`);
      const feedback = heuristicFallback(projectData);
      return res.status(200).json({ success: true, requestId, feedback, timestamp: new Date().toISOString() });
    }

    logger.info(`[${requestId}] Raw reply (first 400): ${rawReply.slice(0, 400)}`);

    const feedback = parseResponse(rawReply, projectData);

    logger.info(`[${requestId}] Feedback score: ${feedback.overallScore}/10`);

    return res.status(200).json({ success: true, requestId, feedback, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`[${requestId}] Error in getDesignFeedback:`, error);
    next(error);
  }
};

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(pd) {
  const floors    = pd.floors || [];
  const allRooms  = floors.flatMap(f => f.rooms || []);
  const style     = pd.style || 'modern';
  const type      = pd.type  || 'residential';
  const totalArea = ((pd.totalWidth || 0) * (pd.totalDepth || 0)).toFixed(0);

  const roomTypes = allRooms.map(r => r.type);
  const winCount  = allRooms.reduce((s, r) => s + (r.windows?.length || 0), 0);
  const doorCount = allRooms.reduce((s, r) => s + (r.doors?.length || 0), 0);
  const hasBed    = roomTypes.includes('bedroom');
  const hasBath   = roomTypes.includes('bathroom');
  const hasKit    = roomTypes.includes('kitchen');
  const hasLiv    = roomTypes.includes('living');

  const roomList = allRooms.slice(0, 12)
    .map(r => `${r.name||r.type}(${r.type},${(r.width||0).toFixed(1)}x${(r.depth||0).toFixed(1)}m,doors:${(r.doors||[]).length},windows:${(r.windows||[]).length})`)
    .join('; ');

  // Pre-compute deterministic heuristic scores for ALL 5 dimensions.
  // The LLM is instructed to USE these exact numbers — not invent new ones.
  // This gives consistent results while letting the LLM generate the text.
  const spS = allRooms.length >= 6 ? 8 : allRooms.length >= 4 ? 7 : allRooms.length >= 2 ? 5 : 3;
  const flS = doorCount >= 4 ? 8 : doorCount >= 2 ? 6 : doorCount >= 1 ? 4 : 2;
  const ltS = winCount  >= 5 ? 9 : winCount  >= 3 ? 7 : winCount  >= 1 ? 5 : 2;
  const stS = style === 'modern' || style === 'luxury' ? 7 : style === 'traditional' ? 7 : 6;
  const fcS = (hasBed && hasBath && hasKit && hasLiv) ? 9
            : (hasBed && hasBath && hasKit)           ? 7
            : (hasBed || hasKit)                      ? 5 : 3;
  const ovS = Math.round((spS + flS + ltS + stS + fcS) / 5);

  return `PROJECT DATA:
- Building: ${type}, style: ${style}
- Footprint: ${pd.totalWidth||0}m x ${pd.totalDepth||0}m = ${totalArea}m2, Floors: ${floors.length}
- Rooms (${allRooms.length} total): ${roomList||'none'}
- Total doors: ${doorCount}, Total windows: ${winCount}
- Has bedroom:${hasBed} bathroom:${hasBath} kitchen:${hasKit} living:${hasLiv}
- Materials: walls=${pd.materials?.exterior?.walls||'unspecified'} floor=${pd.materials?.interior?.flooring||'unspecified'}

SCORING RULES (you MUST use these exact integer scores — do not change them):
- spaceUtilisation score = ${spS}
- roomFlow score = ${flS}
- naturalLight score = ${ltS}
- styleConsistency score = ${stS}
- functionalCompleteness score = ${fcS}
- overallScore = ${ovS}

Write specific, accurate summary and detail text based on the actual project data above.
Respond with ONLY this JSON object (no prose, no markdown fences):
{"overallScore":${ovS},"dimensions":{"spaceUtilisation":{"score":${spS},"title":"Space Utilisation","summary":"<one sentence>","detail":"<two sentences referencing actual room sizes>"},"roomFlow":{"score":${flS},"title":"Room Flow and Circulation","summary":"<one sentence>","detail":"<two sentences about the ${doorCount} door(s) and circulation>"},"naturalLight":{"score":${ltS},"title":"Natural Light","summary":"<one sentence>","detail":"<two sentences about the ${winCount} window(s) and light quality>"},"styleConsistency":{"score":${stS},"title":"Style Consistency","summary":"<one sentence>","detail":"<two sentences about how ${style} style is applied>"},"functionalCompleteness":{"score":${fcS},"title":"Functional Completeness","summary":"<one sentence>","detail":"<two sentences about which essential rooms are present or missing>"}},"topIssues":["<specific issue 1>","<specific issue 2>","<specific issue 3>"],"quickWins":["<specific quick win 1>","<specific quick win 2>","<specific quick win 3>"]}`;
}

// ── Parser — 4 strategies, always returns a valid object ─────────────────────
function parseResponse(raw, pd) {
  // 1. Direct parse
  const r1 = tryJSON(raw.trim());
  if (r1) return normalise(r1, pd);

  // 2. Strip markdown fences
  const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const r2 = tryJSON(stripped);
  if (r2) return normalise(r2, pd);

  // 3. Extract largest balanced {} block
  const r3 = extractLargestBrace(raw);
  if (r3) return normalise(r3, pd);

  // 4. Regex field-by-field extraction
  const r4 = regexExtract(raw);
  if (r4) return normalise(r4, pd);

  // 5. Heuristic fallback — always renders correctly
  logger.warn(`All parse strategies failed. Using heuristic fallback.`);
  return heuristicFallback(pd);
}

function tryJSON(str) {
  try {
    const p = JSON.parse(str);
    if (p && typeof p === 'object' && ('overallScore' in p || 'dimensions' in p)) return p;
  } catch {}
  return null;
}

function extractLargestBrace(str) {
  const blocks = [];
  let depth = 0, start = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') { if (!depth) start = i; depth++; }
    else if (str[i] === '}' && depth > 0) {
      depth--;
      if (!depth && start !== -1) { blocks.push(str.slice(start, i + 1)); start = -1; }
    }
  }
  blocks.sort((a, b) => b.length - a.length);
  for (const b of blocks) { const p = tryJSON(b); if (p) return p; }
  return null;
}

function regexExtract(str) {
  const num  = (re) => { const m = str.match(re); return m ? clamp(m[1]) : 5; };
  const txt  = (re) => { const m = str.match(re); return m ? m[1].replace(/\\n/g,' ').trim() : ''; };
  return {
    overallScore: num(/"overallScore"\s*:\s*(\d+)/),
    dimensions: {
      spaceUtilisation:       { score: num(/"spaceUtilisation"[^}]*?"score"\s*:\s*(\d+)/s),       title: 'Space Utilisation',       summary: txt(/"spaceUtilisation"[^}]*?"summary"\s*:\s*"([^"]+)"/s),       detail: txt(/"spaceUtilisation"[^}]*?"detail"\s*:\s*"([^"]+)"/s) },
      roomFlow:               { score: num(/"roomFlow"[^}]*?"score"\s*:\s*(\d+)/s),               title: 'Room Flow and Circulation',summary: txt(/"roomFlow"[^}]*?"summary"\s*:\s*"([^"]+)"/s),               detail: txt(/"roomFlow"[^}]*?"detail"\s*:\s*"([^"]+)"/s) },
      naturalLight:           { score: num(/"naturalLight"[^}]*?"score"\s*:\s*(\d+)/s),           title: 'Natural Light',           summary: txt(/"naturalLight"[^}]*?"summary"\s*:\s*"([^"]+)"/s),           detail: txt(/"naturalLight"[^}]*?"detail"\s*:\s*"([^"]+)"/s) },
      styleConsistency:       { score: num(/"styleConsistency"[^}]*?"score"\s*:\s*(\d+)/s),       title: 'Style Consistency',       summary: txt(/"styleConsistency"[^}]*?"summary"\s*:\s*"([^"]+)"/s),       detail: txt(/"styleConsistency"[^}]*?"detail"\s*:\s*"([^"]+)"/s) },
      functionalCompleteness: { score: num(/"functionalCompleteness"[^}]*?"score"\s*:\s*(\d+)/s), title: 'Functional Completeness', summary: txt(/"functionalCompleteness"[^}]*?"summary"\s*:\s*"([^"]+)"/s), detail: txt(/"functionalCompleteness"[^}]*?"detail"\s*:\s*"([^"]+)"/s) },
    },
    topIssues: [],
    quickWins:  [],
  };
}

// ── Heuristic fallback — always returns fully populated object ────────────────
function heuristicFallback(pd) {
  const floors    = pd.floors || [];
  const allRooms  = floors.flatMap(f => f.rooms || []);
  const roomTypes = allRooms.map(r => r.type);
  const winCount  = allRooms.reduce((s, r) => s + (r.windows?.length || 0), 0);
  const doorCount = allRooms.reduce((s, r) => s + (r.doors?.length || 0), 0);
  const hasEss    = ['bedroom','bathroom','kitchen'].every(t => roomTypes.includes(t));
  const spS  = allRooms.length >= 4 ? 6 : allRooms.length >= 2 ? 5 : 3;
  const flS  = doorCount >= 2 ? 6 : doorCount >= 1 ? 5 : 3;
  const ltS  = winCount  >= 3 ? 7 : winCount  >= 1 ? 5 : 3;
  const fcS  = hasEss ? 7 : 4;
  const ovS  = Math.round((spS + flS + ltS + 6 + fcS) / 5);

  return {
    overallScore: ovS,
    scoreLabel:   scoreLabel(ovS),
    projectName:  pd.name || 'Untitled',
    analysedAt:   new Date().toISOString(),
    dimensions: {
      spaceUtilisation:       { score: spS, title: 'Space Utilisation',       summary: 'Room count and area reviewed.', detail: allRooms.length < 3 ? 'Few rooms detected — the footprint may be under-utilised. Add more functional spaces.' : 'Room proportions appear reasonable. Ensure living and dining areas have at least 15m² each.' },
      roomFlow:               { score: flS, title: 'Room Flow and Circulation',summary: 'Door count and connectivity reviewed.', detail: doorCount === 0 ? 'No doors placed yet. Doors are essential for defining circulation between spaces.' : 'Some circulation exists. Verify that private rooms (bedrooms) do not open directly into public areas.' },
      naturalLight:           { score: ltS, title: 'Natural Light',           summary: 'Window placement reviewed.', detail: winCount === 0 ? 'No windows placed. Every habitable room needs at least one window for light and ventilation.' : `${winCount} window(s) found. Add windows to any room that lacks them, prioritising south-facing walls.` },
      styleConsistency:       { score: 6,   title: 'Style Consistency',       summary: `${pd.style||'Modern'} style consistency reviewed.`, detail: `Ensure all material choices — walls, flooring, roof — reflect the ${pd.style||'modern'} aesthetic coherently. Avoid mixing conflicting finishes.` },
      functionalCompleteness: { score: fcS, title: 'Functional Completeness', summary: 'Essential rooms reviewed.', detail: hasEss ? 'Core spaces are present. Consider adding a hallway and dining room for a complete layout.' : 'Essential rooms are missing. A minimum residential layout needs bedroom, bathroom, and kitchen.' },
    },
    topIssues: [
      winCount  === 0 ? 'No windows placed — add windows to all habitable rooms' : 'Review window sizes for adequate daylight factor',
      doorCount === 0 ? 'No doors placed — rooms are currently inaccessible'     : 'Verify door swing directions do not block circulation',
      !hasEss         ? 'Missing essential rooms: bedroom, bathroom, or kitchen'  : 'Consider adding a dedicated entrance lobby',
    ],
    quickWins: [
      winCount  === 0 ? 'Place one window per room on the longest external wall' : 'Add a skylight to any central room lacking natural light',
      doorCount === 0 ? 'Place doors connecting all adjacent rooms'              : 'Widen the corridor between bedroom and bathroom',
      allRooms.length < 4 ? 'Add a hallway to separate public and private zones' : 'Group wet rooms (bathroom/kitchen) to simplify plumbing',
    ],
  };
}

// ── Normalise any parsed shape into the canonical response shape ──────────────
function normalise(parsed, pd) {
  const score = clamp(parsed.overallScore);
  const dims  = parsed.dimensions || {};

  return {
    overallScore: score,
    scoreLabel:   parsed.scoreLabel || scoreLabel(score),
    projectName:  pd.name || 'Untitled',
    analysedAt:   new Date().toISOString(),
    dimensions: {
      spaceUtilisation:       normDim(dims.spaceUtilisation,       'Space Utilisation'),
      roomFlow:               normDim(dims.roomFlow,               'Room Flow and Circulation'),
      naturalLight:           normDim(dims.naturalLight,           'Natural Light'),
      styleConsistency:       normDim(dims.styleConsistency,       'Style Consistency'),
      functionalCompleteness: normDim(dims.functionalCompleteness, 'Functional Completeness'),
    },
    topIssues: Array.isArray(parsed.topIssues) ? parsed.topIssues.slice(0, 3) : [],
    quickWins:  Array.isArray(parsed.quickWins)  ? parsed.quickWins.slice(0, 3)  : [],
  };
}

function normDim(d, defaultTitle) {
  if (!d || typeof d !== 'object') return { score: 5, title: defaultTitle, summary: '', detail: '' };
  return {
    score:   clamp(d.score),
    title:   (typeof d.title   === 'string' && d.title.trim())   ? d.title.trim()   : defaultTitle,
    summary: typeof d.summary === 'string' ? d.summary.trim() : '',
    detail:  typeof d.detail  === 'string' ? d.detail.trim()  : '',
  };
}

function clamp(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 5 : Math.max(1, Math.min(10, n));
}

function scoreLabel(s) {
  if (s >= 9) return 'Excellent';
  if (s >= 7) return 'Good';
  if (s >= 5) return 'Needs work';
  if (s >= 3) return 'Poor';
  return 'Critical issues';
}