// backend-main/models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        minlength: [8, 'Password must be at least 8 characters'],
        select: false
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true
    },

    // Role: 'user' kept for backward-compat during migration; new registrations default to 'architect'
    role: {
        type: String,
        enum: ['user', 'architect', 'admin', 'client'],
        default: 'architect'
    },

    // Basic contact info
    company:  { type: String, trim: true },
    phone:    { type: String, trim: true },
    avatar:   { type: String, default: '' },

    // Architect professional profile (new fields)
    bio: {
        type: String,
        trim: true,
        maxlength: [500, 'Bio cannot exceed 500 characters'],
        default: ''
    },
    location: {
        type: String,
        trim: true,
        maxlength: [100, 'Location cannot exceed 100 characters'],
        default: ''
    },
    specialization: {
        type: String,
        trim: true,
        maxlength: [100, 'Specialization cannot exceed 100 characters'],
        default: ''
    },
    experience: {
        type: Number,
        min: [0, 'Experience cannot be negative'],
        max: [60, 'Experience seems too high'],
        default: 0
    },
    portfolio: {
        type: [String],
        validate: {
            validator: function (arr) { return arr.length <= 10; },
            message: 'Portfolio cannot have more than 10 links'
        },
        default: []
    },

    // Stats managed by system
    rating:        { type: Number, default: 0, min: 0, max: 5 },
    totalProjects: { type: Number, default: 0, min: 0 },

    preferences: {
        theme:       { type: String, enum: ['light', 'dark'], default: 'light' },
        defaultUnit: { type: String, enum: ['meters', 'feet'], default: 'meters' },
        autoSave:    { type: Boolean, default: true }
    },

    // Subscription
    plan: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    },
    planExpiresAt:          { type: Date,   default: null },
    razorpaySubscriptionId: { type: String, default: null },
    aiMessagesUsed:         { type: Number, default: 0 },
    aiMessagesResetAt:      { type: Date,   default: null },

    // Presence
    lastSeen:            { type: Date, default: null },

    // Account status
    suspended:           { type: Boolean, default: false },
    emailVerified:       { type: Boolean, default: true },
    emailOtp:            String,
    emailOtpExpire:      Date,
    otpResendCount:      { type: Number, default: 0 },
    otpResendDate:       Date,
    resetPasswordToken:  String,
    resetPasswordExpire: Date,
    createdAt:           { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) { next(); return; }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getEmailOtp = function () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.emailOtp       = crypto.createHash('sha256').update(otp).digest('hex');
    this.emailOtpExpire = Date.now() + 10 * 60 * 1000;
    return otp;
};

userSchema.methods.getResetPasswordToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.resetPasswordToken  = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    return resetToken;
};

module.exports = mongoose.model('User', userSchema);