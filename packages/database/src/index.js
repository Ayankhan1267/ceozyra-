"use strict";
/**
 * ZYRA — Database Package
 * Prisma client singleton, connection helpers, and repository helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
exports.healthCheck = healthCheck;
exports.findMany = findMany;
exports.findUnique = findUnique;
exports.create = create;
exports.update = update;
exports.deleteRecord = deleteRecord;
exports.count = count;
exports.transaction = transaction;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
async function connectDatabase() {
    try {
        await exports.prisma.$connect();
        console.log('[DB] Connected to database');
    }
    catch (error) {
        console.error('[DB] Connection failed:', error);
        process.exit(1);
    }
}
async function disconnectDatabase() {
    await exports.prisma.$disconnect();
}
async function healthCheck() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        return { status: 'healthy' };
    }
    catch {
        return { status: 'unhealthy' };
    }
}
function getDelegate(model) {
    const delegate = exports.prisma[model];
    if (!delegate) {
        throw new Error(`Unknown Prisma model: ${model}`);
    }
    return delegate;
}
async function findMany(model, args = {}) {
    return getDelegate(model).findMany(args);
}
async function findUnique(model, args) {
    return getDelegate(model).findUnique(args);
}
async function create(model, args) {
    return getDelegate(model).create(args);
}
async function update(model, args) {
    return getDelegate(model).update(args);
}
async function deleteRecord(model, args) {
    return getDelegate(model).delete(args);
}
async function count(model, args = {}) {
    return getDelegate(model).count(args);
}
// ─── Transaction Wrapper ──────────────────────────────────────
async function transaction(callback) {
    return exports.prisma.$transaction(async (tx) => callback(tx));
}
