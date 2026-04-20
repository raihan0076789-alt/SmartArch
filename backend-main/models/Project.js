// backend/models/Project.js
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['living', 'bedroom', 'bathroom', 'kitchen', 'dining', 'office', 'garage', 'storage', 'staircase', 'balcony','hallway','entrance', 'other'],
        default: 'other'
    },
    width: { type: Number, required: true, min: 0 },
    depth: { type: Number, required: true, min: 0 },
    height: { type: Number, default: 2.7 },
    x: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
    rotation: { type: Number, default: 0 },
    floorMaterial: { type: String, default: 'wood' },
    wallMaterial: { type: String, default: 'paint' },
    features: [{
        type: { type: String, enum: ['window', 'door', 'closet', 'fixture', 'appliance'] },
        position: { x: Number, y: Number, z: Number },
        size: { width: Number, height: Number }
    }],
    doors: [{
        wall:  { type: String, enum: ['top', 'bottom', 'left', 'right'] },
        pos:   { type: Number, default: 0.5 },
        width: { type: Number, default: 0.9 }
    }],
    windows: [{
        wall:  { type: String, enum: ['top', 'bottom', 'left', 'right'] },
        pos:   { type: Number, default: 0.5 },
        width: { type: Number, default: 1.0 }
    }]
});

const floorSchema = new mongoose.Schema({
    level: { type: Number, required: true },
    name: { type: String, default: 'Ground Floor' },
    height: { type: Number, default: 2.7 },
    rooms: [roomSchema]
});

const projectSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Please provide a project name'], trim: true, maxlength: [100, 'Name cannot be more than 100 characters'] },
    description: { type: String, trim: true, maxlength: [500, 'Description cannot be more than 500 characters'] },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collaborators: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['viewer', 'editor', 'admin'], default: 'viewer' },
        addedAt: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['draft', 'in_progress', 'review', 'approved', 'archived'], default: 'draft' },
    type: { type: String, enum: ['residential', 'commercial', 'industrial', 'mixed'], default: 'residential' },
    totalWidth: { type: Number, required: true, min: 0 },
    totalDepth: { type: Number, required: true, min: 0 },
    style: { type: String, enum: ['modern', 'minimalist', 'traditional', 'luxury'], default: 'modern' },
    floors: [floorSchema],
    materials: {
        exterior: {
            walls: { type: String, default: 'brick' },
            roof: { type: String, default: 'tiles' },
            foundation: { type: String, default: 'concrete' }
        },
        interior: {
            flooring: { type: String, default: 'hardwood' },
            ceilings: { type: String, default: 'drywall' }
        }
    },
    specifications: {
        roofType: { type: String, enum: ['flat', 'pitched', 'hip', 'gambrel'], default: 'pitched' },
        garage: { included: { type: Boolean, default: false }, cars: { type: Number, default: 0 } },
        pool: { included: { type: Boolean, default: false }, type: { type: String } }
    },
    metadata: {
        totalArea: Number,
        totalRooms: Number,
        totalFloors: Number,
        estimatedCost: Number,
        constructionTime: Number
    },
    thumbnail: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    isPublic: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    statusHistory: [{
        status:    { type: String },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    aiFeedback: {
        overallScore:  { type: Number, default: null },
        scoreLabel:    { type: String, default: '' },
        analysedAt:    { type: Date,   default: null },
        dimensions: {
            spaceUtilisation:       { score: Number, title: String, summary: String, detail: String },
            roomFlow:               { score: Number, title: String, summary: String, detail: String },
            naturalLight:           { score: Number, title: String, summary: String, detail: String },
            styleConsistency:       { score: Number, title: String, summary: String, detail: String },
            functionalCompleteness: { score: Number, title: String, summary: String, detail: String },
        },
        topIssues: [{ type: String }],
        quickWins:  [{ type: String }],
    }
}, { timestamps: true });

projectSchema.pre('save', function(next) {
    const totalArea = this.totalWidth * this.totalDepth;
    const totalRooms = this.floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
    const totalFloors = this.floors.length;
    this.metadata = {
        totalArea,
        totalRooms,
        totalFloors,
        estimatedCost: totalArea * 1500,
        constructionTime: totalFloors * 4
    };
    next();
});

projectSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Project', projectSchema);