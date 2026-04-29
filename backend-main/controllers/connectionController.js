// backend-main/controllers/connectionController.js
const Connection = require('../models/Connection');
const User       = require('../models/User');
const Project    = require('../models/Project');

// ─── POST /api/connections/request ───────────────────────────────────────────
// Client sends a connect request to an architect (optionally with a project).
exports.sendRequest = async (req, res) => {
    try {
        const { architectId, projectId, introMessage } = req.body;
        const clientId = req.user._id;

        // Validate architect exists
        const architect = await User.findById(architectId);
        if (!architect || !['architect', 'user'].includes(architect.role)) {
            return res.status(404).json({ success: false, message: 'Architect not found.' });
        }

        // Prevent duplicate — upsert-style: if rejected before, allow re-request
        const existing = await Connection.findOne({ client: clientId, architect: architectId });
        if (existing) {
            if (existing.status === 'pending') {
                return res.status(400).json({ success: false, message: 'You already have a pending request with this architect.' });
            }
            if (existing.status === 'accepted') {
                return res.status(400).json({ success: false, message: 'You are already connected with this architect.' });
            }
            // was rejected — delete old and allow fresh request
            await Connection.deleteOne({ _id: existing._id });
        }

        // Optional project context — check both architect Project and ClientProject models
        let projectName = '';
        if (projectId) {
            // First try ClientProject (client's own brief)
            const ClientProject = require('../models/ClientProject');
            const clientProj = await ClientProject.findOne({ _id: projectId, client: clientId });
            if (clientProj) {
                projectName = clientProj.title;
            } else {
                // Fall back to architect Project model (legacy)
                const proj = await Project.findOne({ _id: projectId, owner: clientId });
                if (proj) projectName = proj.name;
            }
        }

        const conn = await Connection.create({
            client:       clientId,
            architect:    architectId,
            project:      projectId || null,
            projectName,
            introMessage: introMessage || '',
            unreadByArchitect: 1   // the intro message counts as 1 unread for architect
        });

        res.status(201).json({ success: true, data: conn, message: 'Connection request sent!' });
    } catch (err) {
        console.error('sendRequest error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/connections/status/:architectId ─────────────────────────────────
// Client checks their connection status with a specific architect.
exports.getStatusWithArchitect = async (req, res) => {
    try {
        const conn = await Connection.findOne({
            client:    req.user._id,
            architect: req.params.architectId
        }).select('status _id unreadByClient');

        if (!conn) return res.json({ success: true, status: 'none' });
        res.json({ success: true, status: conn.status, connectionId: conn._id, unreadByClient: conn.unreadByClient });
    } catch (err) {
        console.error('getStatusWithArchitect error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/connections/status/:architectId/projects ────────────────────────
// Returns connectionId + all additional projects assigned to this connection.
exports.getConnectionProjects = async (req, res) => {
    try {
        const conn = await Connection.findOne({
            client:    req.user._id,
            architect: req.params.architectId,
            status:    'accepted'
       }).select('_id project projectName additionalProjects');

        if (!conn) return res.json({ success: true, data: [], connectionId: null });

    const projects = conn.additionalProjects.map(ap => ({
            projectId:   ap.projectId,
            projectName: ap.projectName,
            assignedAt:  ap.assignedAt
        }));

        // Include the primary project (from the initial connection request) if it exists
        const primaryProject = conn.project
            ? [{ projectId: conn.project, projectName: conn.projectName || 'Primary Project', isPrimary: true }]
            : [];

        res.json({ success: true, connectionId: conn._id, data: [...primaryProject, ...projects] });
    } catch (err) {
        console.error('getConnectionProjects error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/connections/my ──────────────────────────────────────────────────
// Returns all connections for the current user (client or architect).
exports.getMyConnections = async (req, res) => {
    try {
        const role   = req.user.role;
        const filter = role === 'client'
            ? { client: req.user._id }
            : { architect: req.user._id };

        const conns = await Connection.find(filter)
            .populate('client',    'name email avatar company lastSeen')
            .populate('architect', 'name email avatar specialization lastSeen')
            .sort('-updatedAt')
            .select('-messages');

        // For architect: enrich each accepted connection with the architect project
        // shared with that client via ProjectShare (Connection.project stores the
        // client's brief ID, not the architect's project, so we look up ProjectShare)
        if (role !== 'client') {
            const ProjectShare = require('../models/ProjectShare');
            const enriched = await Promise.all(conns.map(async (conn) => {
                const obj = conn.toObject();
                if (conn.status === 'accepted') {
                    // Try exact connection match first (new records)
                    let share = await ProjectShare.findOne({
                        sharedBy:   req.user._id,
                        sharedWith: conn.client._id,
                        connection: conn._id,
                        isRevoked:  false
                    }).populate('project', 'name type status statusHistory');

                    // Fallback for legacy records created before connection field was indexed
                    if (!share) {
                        share = await ProjectShare.findOne({
                            sharedBy:   req.user._id,
                            sharedWith: conn.client._id,
                            isRevoked:  false
                        }).populate('project', 'name type status statusHistory');
                        // Back-fill the connection field so future lookups hit the fast path
                        if (share) {
                            share.connection = conn._id;
                            await share.save().catch(() => {});
                        }
                    }

                    obj.architectProject = (share && share.project) ? share.project : null;

                    // Enrich each additional project with its linked architect design project
                    if (conn.additionalProjects && conn.additionalProjects.length) {
                        obj.additionalProjects = await Promise.all(conn.additionalProjects.map(async ap => {
                            const apObj = Object.assign({}, ap.toObject ? ap.toObject() : ap);
                            if (ap.architectProjectId) {
                                const apProj = await Project.findById(ap.architectProjectId)
                                    .select('name type status statusHistory').lean();
                                apObj.architectProject = apProj || null;
                            } else {
                                apObj.architectProject = null;
                            }
                            return apObj;
                        }));
                    } else {
                        obj.additionalProjects = [];
                    }
                } else {
                    obj.architectProject   = null;
                    obj.additionalProjects = [];
                }
                return obj;
            }));
            return res.json({ success: true, data: enriched });
        }

        // Populate client project brief + additionalProjects names
        const enrichedClient = await Promise.all(conns.map(async (conn) => {
            const obj = conn.toObject();
            if (conn.project) {
                const proj = await Project.findById(conn.project).select('name status type').lean();
                obj.project = proj || obj.project;
            }
            // Enrich additionalProjects with acceptanceStatus already stored on schema
            // Just ensure projectName is available (already snapshotted on assign)
            obj.additionalProjects = (conn.additionalProjects || []).map(ap => ({
                projectId:        ap.projectId,
                projectName:      ap.projectName,
                assignedAt:       ap.assignedAt,
                acceptanceStatus: ap.acceptanceStatus || 'pending'
            }));
            return obj;
        }));
        res.json({ success: true, data: enrichedClient });
    } catch (err) {
        console.error('getMyConnections error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── PUT /api/connections/:id/respond ────────────────────────────────────────
// Architect accepts or rejects a connection request.
exports.respondToRequest = async (req, res) => {
    try {
        const { action } = req.body;   // 'accept' | 'reject'
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Action must be accept or reject.' });
        }

        const conn = await Connection.findOne({ _id: req.params.id, architect: req.user._id });
        if (!conn) return res.status(404).json({ success: false, message: 'Connection request not found.' });
        if (conn.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request has already been responded to.' });
        }

        conn.status = action === 'accept' ? 'accepted' : 'rejected';
        if (action === 'accept') conn.unreadByClient += 1;  // notify client
        await conn.save();

        res.json({ success: true, data: conn, message: action === 'accept' ? 'Connection accepted!' : 'Request rejected.' });
    } catch (err) {
        console.error('respondToRequest error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/connections/:id/messages ───────────────────────────────────────
// Fetch full message history for an accepted connection.
exports.getMessages = async (req, res) => {
    try {
        const conn = await Connection.findById(req.params.id)
            .populate('client',    'name avatar lastSeen')
            .populate('architect', 'name avatar lastSeen');

        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });

        // Only parties involved can read messages
        const uid = String(req.user._id);
        if (String(conn.client._id) !== uid && String(conn.architect._id) !== uid) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        if (conn.status !== 'accepted') {
            return res.status(403).json({ success: false, message: 'Chat is only available for accepted connections.' });
        }

        // Mark messages as read for this user
        if (req.user.role === 'client') conn.unreadByClient = 0;
        else                            conn.unreadByArchitect = 0;
        await conn.save();

        res.json({ success: true, data: { connection: conn, messages: conn.messages } });
    } catch (err) {
        console.error('getMessages error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── POST /api/connections/:id/messages ──────────────────────────────────────
// Send a text message in an accepted connection.
exports.sendMessage = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Message text is required.' });
        }

        const conn = await Connection.findById(req.params.id);
        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });

        const uid = String(req.user._id);
        const isClient    = String(conn.client)    === uid;
        const isArchitect = String(conn.architect) === uid;

        if (!isClient && !isArchitect) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (conn.status !== 'accepted') {
            return res.status(403).json({ success: false, message: 'Chat is only available for accepted connections.' });
        }

        const role = isClient ? 'client' : 'architect';

        conn.messages.push({
            sender:     req.user._id,
            senderRole: role,
            type:       'text',
            text:       text.trim()
        });

        if (isClient) conn.unreadByArchitect += 1;
        else          conn.unreadByClient    += 1;

        await conn.save();

        const newMsg = conn.messages[conn.messages.length - 1];
        res.status(201).json({ success: true, data: newMsg });
    } catch (err) {
        console.error('sendMessage error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── POST /api/connections/:id/messages/image ─────────────────────────────────
// Upload an image and send it as a chat message.
// Handled by multer (chatUpload) before reaching this handler.
exports.sendImageMessage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided.' });
        }

        const conn = await Connection.findById(req.params.id);
        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });

        const uid = String(req.user._id);
        const isClient    = String(conn.client)    === uid;
        const isArchitect = String(conn.architect) === uid;

        if (!isClient && !isArchitect) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (conn.status !== 'accepted') {
            return res.status(403).json({ success: false, message: 'Chat is only available for accepted connections.' });
        }

        const role     = isClient ? 'client' : 'architect';
        const imageUrl = `/uploads/chat/${req.file.filename}`;

        conn.messages.push({
            sender:     req.user._id,
            senderRole: role,
            type:       'image',
            text:       '',
            imageUrl
        });

        if (isClient) conn.unreadByArchitect += 1;
        else          conn.unreadByClient    += 1;

        await conn.save();

        const newMsg = conn.messages[conn.messages.length - 1];
        res.status(201).json({ success: true, data: newMsg });
    } catch (err) {
        console.error('sendImageMessage error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/connections/:id/project-brief ───────────────────────────────────
// Architect fetches the full ClientProject brief attached to a connection.
// Only the architect party of the connection may call this.
//
// NOTE: Connection.project has ref:'Project' (architect model) but the stored
// ObjectId is actually a ClientProject ID when the client attaches their brief.
// We therefore skip mongoose populate and query both models directly by _id.
// If the raw ObjectId misses both models we fall back to matching ClientProject
// by (client + title) using the projectName snapshot stored on the connection.
exports.getProjectBrief = async (req, res) => {
    try {
        // Use lean() so conn.project is a raw ObjectId, not null from a failed populate
        const conn = await Connection.findById(req.params.id)
            .select('architect client project projectName')
            .lean();

        if (!conn) {
            return res.status(404).json({ success: false, message: 'Connection not found.' });
        }

        // Only the architect on this connection can read the brief
        if (String(conn.architect) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        const ClientProject = require('../models/ClientProject');

        // ── 1. Try ClientProject by stored ObjectId ───────────────────────────
        if (conn.project) {
            const brief = await ClientProject.findById(conn.project)
                .select('-__v -linkedConnection');
            if (brief) {
                return res.json({ success: true, source: 'client', data: brief });
            }

            // ── 2. Try architect Project model by same ObjectId ───────────────
            const proj = await Project.findById(conn.project)
                .select('name type status description metadata floors totalWidth totalDepth');
            if (proj) {
                return res.json({ success: true, source: 'architect', data: proj });
            }
        }

        // ── 3. Fallback: match ClientProject by client + title snapshot ───────
        if (conn.projectName && conn.client) {
            const brief = await ClientProject.findOne({
                client: conn.client,
                title:  conn.projectName
            }).select('-__v -linkedConnection');
            if (brief) {
                return res.json({ success: true, source: 'client', data: brief });
            }
        }

        return res.status(404).json({ success: false, message: 'Project details not found.' });
    } catch (err) {
        console.error('getProjectBrief error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── GET /api/connections/:id/additional-projects/:projectId ──────────────────
// Architect fetches the full brief for a specific additional project on a connection.
exports.getAdditionalProjectBrief = async (req, res) => {
    try {
        const conn = await Connection.findById(req.params.id)
            .select('architect additionalProjects')
            .lean();

        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });
        if (String(conn.architect) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        const entry = conn.additionalProjects.find(
            p => String(p.projectId) === String(req.params.projectId)
        );
        if (!entry) return res.status(404).json({ success: false, message: 'Project not found on this connection.' });

        const ClientProject = require('../models/ClientProject');
        const brief = await ClientProject.findById(entry.projectId).select('-__v -linkedConnection');
        if (!brief) return res.status(404).json({ success: false, message: 'Project details not found.' });

        res.json({ success: true, source: 'client', data: brief });
    } catch (err) {
        console.error('getAdditionalProjectBrief error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── POST /api/connections/:id/assign-project ─────────────────────────────────
// Client assigns an additional project to an already-accepted connection.
exports.assignProject = async (req, res) => {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ success: false, message: 'projectId is required.' });
        }

        const conn = await Connection.findById(req.params.id);
        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });
        if (String(conn.client) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (conn.status !== 'accepted') {
            return res.status(400).json({ success: false, message: 'Connection is not active.' });
        }

        // Resolve project name from ClientProject
        const ClientProject = require('../models/ClientProject');
        const proj = await ClientProject.findOne({ _id: projectId, client: req.user._id }).select('title');
        if (!proj) return res.status(404).json({ success: false, message: 'Project not found.' });

        // Avoid duplicate assignments
        const alreadyAssigned = conn.additionalProjects.some(
            p => String(p.projectId) === String(projectId)
        );
        if (alreadyAssigned) {
            return res.json({ success: true, message: 'Project already assigned.' });
        }

        conn.additionalProjects.push({ projectId, projectName: proj.title });
        conn.unreadByArchitect += 1;
        await conn.save();

        res.status(201).json({ success: true, message: 'Project assigned to connection.' });
    } catch (err) {
        console.error('assignProject error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── DELETE /api/connections/:id/rejected ─────────────────────────────────────
// Client deletes their own rejected connection card to clean up the UI.
exports.deleteRejected = async (req, res) => {
    try {
        const conn = await Connection.findById(req.params.id);

        if (!conn) {
            return res.status(404).json({ success: false, message: 'Connection not found.' });
        }

        // Only the originating client may delete
        if (String(conn.client) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        // Only rejected connections can be deleted via this route
        if (conn.status !== 'rejected') {
            return res.status(400).json({ success: false, message: 'Only rejected connections can be deleted this way.' });
        }

        await Connection.deleteOne({ _id: conn._id });

        res.json({ success: true, message: 'Rejected connection deleted.' });
    } catch (err) {
        console.error('deleteRejected error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── DELETE /api/connections/:id ──────────────────────────────────────────────
// Client cancels their own pending connection request.
// Only the client who sent the request may cancel it, and only while it is still pending.
exports.cancelRequest = async (req, res) => {
    try {
        const conn = await Connection.findById(req.params.id);

        if (!conn) {
            return res.status(404).json({ success: false, message: 'Connection request not found.' });
        }

        // Only the originating client may cancel
        if (String(conn.client) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized to cancel this request.' });
        }

        // Only pending requests can be cancelled
        if (conn.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: conn.status === 'accepted'
                    ? 'This request has already been accepted. You cannot cancel an active connection.'
                    : 'This request has already been responded to.'
            });
        }

        await Connection.deleteOne({ _id: conn._id });

        res.json({ success: true, message: 'Connection request cancelled successfully.' });
    } catch (err) {
        console.error('cancelRequest error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── PUT /api/connections/:id/additional-projects/:projectId/respond ──────────
// Architect accepts or declines an additional project assignment.
exports.respondToAdditionalProject = async (req, res) => {
    try {
        const { action } = req.body; // 'accept' | 'decline'
        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Action must be accept or decline.' });
        }

        const conn = await Connection.findOne({ _id: req.params.id, architect: req.user._id });
        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });

        const apExists = conn.additionalProjects.some(p => String(p.projectId) === String(req.params.projectId));
        if (!apExists) return res.status(404).json({ success: false, message: 'Additional project not found.' });

        if (action === 'decline') {
            // Permanently remove from DB so it never reappears
            conn.additionalProjects = conn.additionalProjects.filter(
                p => String(p.projectId) !== String(req.params.projectId)
            );
        } else {
            // Accept — update status in place
            const ap = conn.additionalProjects.find(p => String(p.projectId) === String(req.params.projectId));
            ap.acceptanceStatus = 'accepted';
            ap.respondedAt = new Date();
        }

        conn.unreadByClient += 1;
        await conn.save();

        res.json({ success: true, message: action === 'accept' ? 'Project accepted.' : 'Project declined.' });
    } catch (err) {
        console.error('respondToAdditionalProject error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
// ─── PATCH /api/connections/:id/additional-projects/:projectId/link ───────────
// Architect links their design project to an additional project request.
exports.linkAdditionalProject = async (req, res) => {
    try {
        const { architectProjectId } = req.body;
        if (!architectProjectId) {
            return res.status(400).json({ success: false, message: 'architectProjectId is required.' });
        }

        const conn = await Connection.findOne({ _id: req.params.id, architect: req.user._id });
        if (!conn) return res.status(404).json({ success: false, message: 'Connection not found.' });
        if (conn.status !== 'accepted') {
            return res.status(400).json({ success: false, message: 'Connection is not active.' });
        }

        const ap = conn.additionalProjects.find(
            p => String(p.projectId) === String(req.params.projectId)
        );
        if (!ap) return res.status(404).json({ success: false, message: 'Additional project not found on this connection.' });

        ap.architectProjectId = architectProjectId;
        await conn.save();

        res.json({ success: true, message: 'Architect project linked to additional project.' });
    } catch (err) {
        console.error('linkAdditionalProject error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};