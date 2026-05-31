// backend/controllers/authController.js
const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const welcomeEmailTemplate = require('../utils/welcomeEmail');
const verifyEmailTemplate  = require('../utils/verifyEmail');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, company, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        const user = await User.create({ name, email, password, company, phone });

        // // Generate 6-digit OTP and send
        // const otp = user.getEmailOtp();
        // await user.save({ validateBeforeSave: false });


        // try {
        //     await sendEmail({
        //         to: user.email,
        //         subject: 'SmartArch — Your verification code',
        //         html: verifyEmailTemplate(user.name, otp)
        //     });
        // } catch (emailErr) {
        //     console.error('OTP email failed:', emailErr.message);
        // }
        user.emailVerified = true;
        await user.save({ validateBeforeSave: false });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            message: 'Registration successful'
        });
        // No JWT yet — user must enter OTP first
        res.status(201).json({
            success: true,
            requiresVerification: true,
            email: user.email,
            message: 'Account created! Enter the 6-digit code sent to your email.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Block client accounts from logging into the architect portal
        if (user.role === 'client') {
            return res.status(403).json({
                success: false,
                message: 'This portal is for architects only. Clients please use the client portal.'
            });
        }

        // // Block login until email is verified
        // if (!user.emailVerified) {
        //     return res.status(403).json({
        //         success: false,
        //         requiresVerification: true,
        //         email: user.email,
        //         message: 'Please verify your email before logging in. Enter the OTP sent to your email.'
        //     });
        // }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, company: user.company || '', phone: user.phone || '', avatar: user.avatar || '', bio: user.bio || '', location: user.location || '', specialization: user.specialization || '', experience: user.experience || 0, rating: user.rating || 0, portfolio: user.portfolio || [], plan: user.plan, planExpiresAt: user.planExpiresAt, preferences: user.preferences, emailVerified: user.emailVerified }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, email, phone, company, preferences } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, email, phone, company, preferences },
            { new: true, runValidators: true }
        );
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        const token = generateToken(user._id);
        res.json({ success: true, token, message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.logout = async (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Body: { email }
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            // Return generic message to prevent email enumeration attacks
            return res.status(200).json({
                success: true,
                message: 'If that email is registered, a reset link has been sent.'
            });
        }

        // Generate token and save hashed version to DB
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Build the reset URL pointing to your frontend reset page
        const sourceParam = user.role === 'client' ? '&source=client' : '';
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}${sourceParam}`;

        const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family:'Outfit',sans-serif;background:#060a12;color:#f1f5f9;padding:40px;">
            <div style="max-width:520px;margin:0 auto;background:#0d1424;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
                <div style="height:4px;background:linear-gradient(90deg,#00d4c8,#3b82f6,#8b5cf6);"></div>
                <div style="padding:40px;">
                    <h2 style="font-size:1.5rem;font-weight:800;color:#f1f5f9;margin-bottom:8px;">Reset Your Password</h2>
                    <p style="color:#94a3b8;margin-bottom:24px;">You requested a password reset for your SmartArch account. Click the button below to set a new password.</p>
                    <a href="${resetUrl}" style="display:inline-block;background:#00d4c8;color:#060a12;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1rem;">
                        Reset Password
                    </a>
                    <p style="color:#64748b;font-size:0.82rem;margin-top:28px;">This link expires in <strong style="color:#f59e0b;">30 minutes</strong>. If you did not request this, please ignore this email.</p>
                    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;">
                    <p style="color:#64748b;font-size:0.78rem;">© 2025 SmartArch · AI-Powered Architecture Platform</p>
                </div>
            </div>
        </body>
        </html>`;

        try {
            await sendEmail({ to: user.email, subject: 'SmartArch — Password Reset Request', html });
            res.status(200).json({ success: true, message: "We've sent a reset link if that email matches an account with us."  });
        } catch (emailError) {
            console.error('Email send error:', emailError);
            // Rollback token if email fails
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            res.status(500).json({ success: false, message: 'Email could not be sent. Please try again later.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
// PUT /api/auth/reset-password/:token
// Body: { password }
exports.resetPassword = async (req, res) => {
    try {
        // Hash the raw token from URL to compare with DB
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }  // not expired
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Password reset token is invalid or has expired. Please request a new one.'
            });
        }

        // Set new password (pre-save hook will hash it)
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: { id: user._id, role: user.role, email: user.email, name: user.name },
            message: 'Password reset successfully. You are now logged in.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


// ─── VERIFY OTP ─────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp   Body: { email, otp }
exports.verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
        }

        const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');

        // First check if user exists at all (helps give a better error)
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser && existingUser.emailVerified) {
            return res.status(400).json({ success: false, message: 'This email is already verified. Please log in.' });
        }

        const user = await User.findOne({
            email:          email.toLowerCase().trim(),
            emailOtp:       hashedOtp,
            emailOtpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP. Please request a new code.'
            });
        }

        user.emailVerified  = true;
        user.emailOtp       = undefined;
        user.emailOtpExpire = undefined;
        await user.save({ validateBeforeSave: false });

        // Send welcome email — fire-and-forget
        sendEmail({
            to: user.email,
            subject: 'Welcome to SmartArch 🎉',
            html: welcomeEmailTemplate(user.name)
        }).catch((err) => console.error('Welcome email failed:', err.message));

        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, company: user.company || '', phone: user.phone || '', avatar: user.avatar || '', bio: user.bio || '', location: user.location || '', specialization: user.specialization || '', experience: user.experience || 0, rating: user.rating || 0, portfolio: user.portfolio || [], plan: user.plan, planExpiresAt: user.planExpiresAt, preferences: user.preferences, emailVerified: user.emailVerified },
            message: 'Email verified successfully! Welcome to SmartArch.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


// ─── GOOGLE PROFILE (popup / access-token flow) ───────────────────────────────
// POST /api/auth/google-profile
// Body: { googleId, email, name, picture, role? }
// Called after frontend fetches profile from Google's userinfo endpoint using
// an access token — no ID token verification needed here.
// The optional `role` field (e.g. 'client') is used when creating brand-new
// Google accounts so they land with the correct portal role.
// Existing accounts always keep their existing role unchanged.
exports.googleProfile = async (req, res) => {
    try {
        const { googleId, email, name, picture, role } = req.body;

        if (!googleId || !email) {
            return res.status(400).json({ success: false, message: 'Google profile data is incomplete.' });
        }

        // Whitelist allowed roles to prevent privilege escalation
        const allowedRoles = ['architect', 'client'];
        const assignedRole = allowedRoles.includes(role) ? role : 'architect';

        let user = await User.findOne({ googleId });

        if (!user) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) {
                // Existing email account — link Google ID, never change role
                user.googleId      = googleId;
                user.emailVerified = true;
                if (picture && !user.avatar) user.avatar = picture;
                await user.save({ validateBeforeSave: false });
            } else {
                // Brand-new user — use the requested role (client or architect)
                user = new User({
                    name,
                    email: email.toLowerCase(),
                    googleId,
                    avatar: picture || '',
                    emailVerified: true,
                    role: assignedRole,
                });
                await user.save({ validateBeforeSave: false });

                sendEmail({
                    to: user.email,
                    subject: 'Welcome to SmartArch 🎉',
                    html: welcomeEmailTemplate(user.name)
                }).catch((err) => console.error('Welcome email failed:', err.message));
            }
        }

        if (user.suspended) {
            return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
        }

        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
                phone: user.phone,
                avatar: user.avatar,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error('googleProfile error:', error.message);
        console.error('googleProfile stack:', error.stack);
        res.status(500).json({ success: false, message: 'Server error during Google sign-in.', detail: error.message });
    }
};

// ─── GOOGLE OAUTH (ID token flow — for future One Tap support) ────────────────
// POST /api/auth/google
// Body: { credential }  — the ID token from Google Identity Services
exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ success: false, message: 'Google credential is required.' });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            console.error('googleAuth: GOOGLE_CLIENT_ID is not set in .env');
            return res.status(500).json({ success: false, message: 'Google Sign-In is not configured on the server.' });
        }

        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(clientId);

        // Verify the ID token Google gave us
        let payload;
        try {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: clientId,
            });
            payload = ticket.getPayload();
        } catch (verifyErr) {
            console.error('Google token verification failed:', verifyErr.message);
            return res.status(401).json({ success: false, message: 'Invalid Google token. Please try again.' });
        }

        const { sub: googleId, email, name, picture } = payload;

        // Find existing user by googleId first, then by email
        let user = await User.findOne({ googleId });

        if (!user) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) {
                // Link Google to existing email/password account
                user.googleId      = googleId;
                user.emailVerified = true;
                if (picture && !user.avatar) user.avatar = picture;
                await user.save({ validateBeforeSave: false });
            } else {
                // Brand-new Google user — skip password validation entirely
                user = new User({
                    name,
                    email: email.toLowerCase(),
                    googleId,
                    avatar: picture || '',
                    emailVerified: true,
                });
                await user.save({ validateBeforeSave: false });

                // Welcome email — fire-and-forget
                sendEmail({
                    to: user.email,
                    subject: 'Welcome to SmartArch 🎉',
                    html: welcomeEmailTemplate(user.name)
                }).catch((err) => console.error('Welcome email failed:', err.message));
            }
        }

        if (user.suspended) {
            return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
        }

        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
                phone: user.phone,
                avatar: user.avatar,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error('googleAuth error:', error.message);
        console.error('googleAuth stack:', error.stack);
        res.status(500).json({ success: false, message: 'Server error during Google sign-in.' });
    }
};
// ─── HEARTBEAT ────────────────────────────────────────────────────────────────
// POST /api/auth/heartbeat  (requires auth)
// Stamps lastSeen on the authenticated user. Called every 30 s by the frontend.
// Uses updateOne with { strict: false } to bypass full-document validation
// (no password re-hash, no hooks) for maximum speed.
exports.heartbeat = async (req, res) => {
    try {
        await User.updateOne(
            { _id: req.user._id },
            { $set: { lastSeen: new Date() } }
        );
        res.json({ success: true });
    } catch (error) {
        // Non-critical — swallow silently on client, return 500 so we can debug
        console.error('heartbeat error:', error.message);
        res.status(500).json({ success: false });
    }
};
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email address.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user || user.emailVerified) {
            return res.status(200).json({
                success: true,
                message: 'If that email is registered and unverified, a new OTP has been sent.'
            });
        }

        // ── Daily resend limit: max 5 per day ─────────────────────────────────
        const MAX_RESENDS_PER_DAY = 5;
        const now = new Date();
        const lastResendDate = user.otpResendDate ? new Date(user.otpResendDate) : null;
        const isSameDay = lastResendDate &&
            lastResendDate.getUTCFullYear() === now.getUTCFullYear() &&
            lastResendDate.getUTCMonth()    === now.getUTCMonth() &&
            lastResendDate.getUTCDate()     === now.getUTCDate();

        if (isSameDay && user.otpResendCount >= MAX_RESENDS_PER_DAY) {
            return res.status(429).json({
                success: false,
                limitReached: true,
                message: `Too many attempts. You can request a maximum of ${MAX_RESENDS_PER_DAY} codes per day. Please try again tomorrow.`
            });
        }

        // Reset counter if it's a new day
        if (!isSameDay) {
            user.otpResendCount = 0;
        }

        // Increment counter and record date
        user.otpResendCount = (user.otpResendCount || 0) + 1;
        user.otpResendDate  = now;
        // ─────────────────────────────────────────────────────────────────────

        const otp = user.getEmailOtp();
        await user.save({ validateBeforeSave: false });

        try {
            await sendEmail({
                to: user.email,
                subject: 'SmartArch — New verification code',
                html: verifyEmailTemplate(user.name, otp)
            });
        } catch (emailErr) {
            console.error('Resend OTP failed:', emailErr.message);
            return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
        }

        const remaining = MAX_RESENDS_PER_DAY - user.otpResendCount;
        res.status(200).json({
            success: true,
            remaining,
            message: `A new 6-digit code has been sent to your email. ${remaining} resend${remaining === 1 ? '' : 's'} remaining today.`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};