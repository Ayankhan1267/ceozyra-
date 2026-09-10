"use strict";
/**
 * ZYRA — Auth Package
 * Hashing, token generation, and security utilities for the API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashString = exports.sanitizeInput = exports.verifyPassword = exports.hashPassword = exports.UserRole = void 0;
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.generateSessionId = generateSessionId;
exports.verifyToken = verifyToken;
const node_crypto_1 = require("node:crypto");
exports.UserRole = {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    EMPLOYEE: 'EMPLOYEE',
    MARKETING: 'MARKETING',
    FINANCE: 'FINANCE',
    SUPPORT: 'SUPPORT',
    SUPER_ADMIN: 'SUPER_ADMIN',
};
// ─── Token generation ────────────────────────────────────────
// NOTE: For actual JWT signing/verification, use @nestjs/jwt in the API.
// These are helpers for session ID and refresh token generation.
function generateAccessToken(payload) {
    const data = JSON.stringify(payload);
    const encoded = Buffer.from(data).toString('base64url');
    const signature = (0, node_crypto_1.createHash)('sha256')
        .update(encoded + (process.env.JWT_SECRET || 'dev-secret'))
        .digest('hex');
    return `${encoded}.${signature}`;
}
function generateRefreshToken(_payload) {
    return 'rt_' + (0, node_crypto_1.randomBytes)(32).toString('hex');
}
function generateSessionId() {
    return 'sess_' + (0, node_crypto_1.randomBytes)(24).toString('hex');
}
function verifyToken(token) {
    try {
        const [encoded, signature] = token.split('.');
        if (!encoded || !signature)
            return null;
        const expectedSignature = (0, node_crypto_1.createHash)('sha256')
            .update(encoded + (process.env.JWT_SECRET || 'dev-secret'))
            .digest('hex');
        if (!(0, node_crypto_1.timingSafeEqual)(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
            return null;
        }
        return JSON.parse(Buffer.from(encoded, 'base64url').toString());
    }
    catch {
        return null;
    }
}
// Re-export password helpers and security utilities
var security_1 = require("@zyra/security");
Object.defineProperty(exports, "hashPassword", { enumerable: true, get: function () { return security_1.hashPassword; } });
Object.defineProperty(exports, "verifyPassword", { enumerable: true, get: function () { return security_1.verifyPassword; } });
Object.defineProperty(exports, "sanitizeInput", { enumerable: true, get: function () { return security_1.sanitizeInput; } });
Object.defineProperty(exports, "hashString", { enumerable: true, get: function () { return security_1.hashString; } });
