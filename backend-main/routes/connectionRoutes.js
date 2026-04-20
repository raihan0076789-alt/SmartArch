// backend-main/routes/connectionRoutes.js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const crypto  = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const {
    sendRequest,
    getStatusWithArchitect,
    getMyConnections,
    respondToRequest,
    getMessages,
    sendMessage,
    sendImageMessage,
    getProjectBrief,
    getAdditionalProjectBrief,
    assignProject,
    linkAdditionalProject,
    cancelRequest,
    deleteRejected
} = require('../controllers/connectionController');

// ── Chat image upload — images only, 8 MB max ─────────────────────────────────
const CHAT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(CHAT_UPLOAD_DIR)) fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

const chatStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CHAT_UPLOAD_DIR),
    filename:    (_req, file, cb) => {
        const ext    = path.extname(file.originalname).toLowerCase();
        const unique = crypto.randomBytes(12).toString('hex');
        cb(null, `${Date.now()}-${unique}${ext}`);
    }
});

const chatUpload = multer({
    storage: chatStorage,
    limits:  { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        allowed.has(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'), false);
    }
});

// ── Client routes ──────────────────────────────────────────────────────────────
router.post('/request',                         protect, authorize('client'),              sendRequest);
router.get('/status/:architectId',              protect, authorize('client'),              getStatusWithArchitect);
router.post('/:id/assign-project',              protect, authorize('client'),              assignProject);
router.delete('/:id',                           protect, authorize('client'),              cancelRequest);       // cancel pending request
router.delete('/:id/rejected',                  protect, authorize('client'),              deleteRejected);      // delete rejected card

// ── Shared routes (client + architect) ────────────────────────────────────────
router.get('/my',                               protect, authorize('client', 'architect'), getMyConnections);
router.put('/:id/respond',                      protect, authorize('architect'),           respondToRequest);
router.get('/:id/project-brief',                protect, authorize('architect'),           getProjectBrief);
router.get('/:id/additional-projects/:projectId',        protect, authorize('architect'), getAdditionalProjectBrief);
router.patch('/:id/additional-projects/:projectId/link', protect, authorize('architect'), linkAdditionalProject);

// Chat — text
router.get('/:id/messages',                     protect, authorize('client', 'architect'), getMessages);
router.post('/:id/messages',                    protect, authorize('client', 'architect'), sendMessage);

// Chat — image  (multipart/form-data, field name: "image")
router.post('/:id/messages/image',
    protect,
    authorize('client', 'architect'),
    chatUpload.single('image'),
    sendImageMessage
);

module.exports = router;