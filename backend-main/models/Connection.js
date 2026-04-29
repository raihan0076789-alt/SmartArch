// backend-main/models/Connection.js
// Tracks connect requests from clients to architects, and their chat messages.
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole:{ type: String, enum: ['client', 'architect'], required: true },
    type:      { type: String, enum: ['text', 'image'], default: 'text' },
    text:      { type: String, trim: true, maxlength: 2000, default: '' },
    imageUrl:  { type: String, default: '' },   // relative URL served from /uploads/chat/
    readAt:    { type: Date, default: null }
}, { timestamps: true });

const additionalProjectSchema = new mongoose.Schema({
    projectId:          { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProject', required: true },
    projectName:        { type: String, default: '' },
    assignedAt:         { type: Date, default: Date.now },
    architectProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    acceptanceStatus:   { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    respondedAt:        { type: Date, default: null }
}, { _id: false });

const connectionSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    architect: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Optional project context (first/primary project)
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    },
    projectName: { type: String, default: '' },   // snapshot name for display

    // Additional projects assigned after connection is accepted
    additionalProjects: [additionalProjectSchema],

    // The initial message the client sends when connecting
    introMessage: { type: String, trim: true, maxlength: 1000, default: '' },

    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },

    // Chat — only visible/usable after status === 'accepted'
    messages: [messageSchema],

    // Unread counts for quick badge display
    unreadByArchitect: { type: Number, default: 0 },
    unreadByClient:    { type: Number, default: 0 }

}, { timestamps: true });

// One active connection per client-architect pair
connectionSchema.index({ client: 1, architect: 1 }, { unique: true });

module.exports = mongoose.model('Connection', connectionSchema);