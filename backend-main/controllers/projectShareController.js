// backend-main/controllers/projectShareController.js
// Handles sharing architect projects with clients and public link generation.

const ProjectShare = require('../models/ProjectShare');
const Project      = require('../models/Project');
const Connection   = require('../models/Connection');
const User         = require('../models/User');

// ─── POST /api/projects/:id/share ─────────────────────────────────────────────
// Architect shares a project.
// Body: { mode: 'connection'|'link', clientId?, connectionId?, message? }
exports.shareProject = async (req, res) => {
    try {
        const { mode = 'connection', clientId, connectionId, message = '' } = req.body;

        // Verify project ownership
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }
        if (!project.owner.equals(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Only the project owner can share it.' });
        }

        if (mode === 'connection') {
            // ── Mode 1: share with a specific connected client ────────────────
            if (!clientId) {
                return res.status(400).json({ success: false, message: 'clientId is required for connection mode.' });
            }

            // Verify connection exists and is accepted
            // Prefer connectionId lookup when provided (avoids ambiguity with multiple clients)
            const connQuery = connectionId
                ? { _id: connectionId, architect: req.user._id, status: 'accepted' }
                : { architect: req.user._id, client: clientId, status: 'accepted' };
            const conn = await Connection.findOne(connQuery);
            if (!conn) {
                return res.status(400).json({
                    success: false,
                    message: 'You must have an accepted connection with this client to share a project.'
                });
            }

            // Check if already shared (non-revoked) — try connection-scoped first, then legacy fallback
            let existing = await ProjectShare.findOne({
                project:    project._id,
                sharedWith: clientId,
                connection: conn._id,
                isRevoked:  false
            });
            // Fallback: legacy record may not have connection field set
            if (!existing) {
                existing = await ProjectShare.findOne({
                    project:    project._id,
                    sharedWith: clientId,
                    isRevoked:  false
                });
                // Back-fill connection field on legacy record
                if (existing && !existing.connection) {
                    existing.connection = conn._id;
                }
            }
            if (existing) {
                // Re-share: update message and reset view stats
                existing.message   = message;
                existing.viewedAt  = null;
                existing.viewCount = 0;
                await existing.save();
                const populated = await existing.populate('project', 'name type status metadata floors totalWidth totalDepth style materials specifications');
                return res.json({ success: true, data: populated, message: 'Share updated.' });
            }

            const share = await ProjectShare.create({
                project:    project._id,
                sharedBy:   req.user._id,
                sharedWith: clientId,
                connection: conn._id,
                mode:       'connection',
                message
            });

            // Add to client's unread count via connection
            conn.unreadByClient += 1;
            await conn.save();

            await share.populate('project', 'name type status metadata floors totalWidth totalDepth style materials specifications');
            return res.status(201).json({ success: true, data: share, message: 'Project shared successfully!' });

        } else if (mode === 'link') {
            // ── Mode 2: generate a public shareable link ──────────────────────
            const share = await ProjectShare.create({
                project:   project._id,
                sharedBy:  req.user._id,
                mode:      'link',
                message
            });
            return res.status(201).json({ success: true, data: share, message: 'Shareable link generated!' });

        } else {
            return res.status(400).json({ success: false, message: 'Invalid mode. Use connection or link.' });
        }

    } catch (err) {
        console.error('shareProject error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/projects/:id/shares ─────────────────────────────────────────────
// Architect: list all shares for their project
exports.getProjectShares = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
        if (!project.owner.equals(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        const shares = await ProjectShare.find({ project: project._id })
            .populate('sharedWith', 'name email avatar')
            .sort('-createdAt');

        res.json({ success: true, data: shares });
    } catch (err) {
        console.error('getProjectShares error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── DELETE /api/projects/:id/shares/:shareId ─────────────────────────────────
// Architect revokes a share
exports.revokeShare = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
        if (!project.owner.equals(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        const share = await ProjectShare.findOne({ _id: req.params.shareId, project: project._id });
        if (!share) return res.status(404).json({ success: false, message: 'Share not found.' });

        share.isRevoked = true;
        await share.save();

        res.json({ success: true, message: 'Share revoked.' });
    } catch (err) {
        console.error('revokeShare error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/shares/my ───────────────────────────────────────────────────────
// Client: get all projects shared with them
exports.getMySharedProjects = async (req, res) => {
    try {
        const shares = await ProjectShare.find({
            sharedWith: req.user._id,
            isRevoked:  false,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
        })
        .populate('project',  'name type status metadata floors totalWidth totalDepth style materials specifications thumbnail description tags createdAt updatedAt')
        .populate('sharedBy', 'name email avatar specialization rating')
        .sort('-createdAt');

        res.json({ success: true, data: shares });
    } catch (err) {
        console.error('getMySharedProjects error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/shares/token/:token ─────────────────────────────────────────────
// Public endpoint: view project by share token (no auth required for link mode)
exports.getShareByToken = async (req, res) => {
    try {
        const share = await ProjectShare.findOne({
            shareToken: req.params.token,
            isRevoked:  false,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
        })
        .populate('project',  'name type status metadata floors totalWidth totalDepth style materials specifications thumbnail description tags')
        .populate('sharedBy', 'name email avatar specialization company rating');

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'This share link is invalid, has been revoked, or has expired.'
            });
        }

        // For connection-mode shares verify the requester is the intended client
        if (share.mode === 'connection') {
            // Require auth for connection-mode
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, message: 'Authentication required to view this project.' });
            }
            const jwt = require('jsonwebtoken');
            let decoded;
            try {
                decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
            } catch {
                return res.status(401).json({ success: false, message: 'Invalid token.' });
            }
            if (!share.sharedWith.equals(decoded.id)) {
                return res.status(403).json({ success: false, message: 'This project was not shared with you.' });
            }
        }

        // Track view
        if (!share.viewedAt) share.viewedAt = new Date();
        share.viewCount += 1;
        await share.save();

        res.json({ success: true, data: share });
    } catch (err) {
        console.error('getShareByToken error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/shares/my-connections ──────────────────────────────────────────
// Architect: get list of accepted connected clients (for share modal dropdown)
exports.getConnectedClients = async (req, res) => {
    try {
        const conns = await Connection.find({
            architect: req.user._id,
            status:    'accepted'
        }).populate('client', 'name email avatar');

        const clients = conns.map(c => ({
            connectionId: c._id,
            client:       c.client
        }));

        res.json({ success: true, data: clients });
    } catch (err) {
        console.error('getConnectedClients error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};