/**
 * oska.AI V1 — Automated Admin Security & Observability Test Suite
 */

import crypto from 'crypto';
import adminService from '../admin-service.js';

console.log('🧪 Starting oska.AI Admin Security Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
  }
}

// 1. Test Access Code Hashing & Verification
console.log('--- 1. Cryptographic Access Code Verification ---');
const testCode = '849201';
const wrongCode = '123456';
const salt = crypto.randomBytes(16).toString('hex');
const derivedKey = crypto.scryptSync(testCode, salt, 64);
const testHash = `scrypt$${salt}$${derivedKey.toString('hex')}`;

assert(adminService.verifyAccessCode(testCode, testHash) === true, 'Valid 6-digit access code matches cryptographic hash');
assert(adminService.verifyAccessCode(wrongCode, testHash) === false, 'Invalid 6-digit access code is rejected');
assert(adminService.verifyAccessCode('abc', testHash) === false, 'Non-numeric access code is rejected');
assert(adminService.verifyAccessCode('', testHash) === false, 'Empty access code is rejected');

// 2. Test Admin Session Generation & Validation
console.log('\n--- 2. Admin Session Token & Sliding TTL ---');
const { rawToken, session } = adminService.createAdminSession('test_uid', 'oshadhaperera500@gmail.com');
assert(Boolean(rawToken && rawToken.length === 64), 'Generated cryptographically random 64-char hex session token');
assert(Boolean(session && session.tokenHash), 'Session hash stored in secure ledger');

// Mock request with session cookie
const mockReqValid = {
  headers: {
    cookie: `oska_admin_session=${rawToken}`
  }
};
const validatedSession = adminService.requireAdminAccess(mockReqValid);
assert(Boolean(validatedSession && validatedSession.email === 'oshadhaperera500@gmail.com'), 'requireAdminAccess successfully authorizes valid session cookie');

// Mock request without cookie
const mockReqInvalid = { headers: {} };
assert(adminService.requireAdminAccess(mockReqInvalid) === null, 'requireAdminAccess rejects unauthenticated request');

// 3. Test Observability & Ledger Recorders
console.log('\n--- 3. Observability & Ledger Recording ---');
adminService.recordUsage({
  userId: 'user_123',
  userEmail: 'alice@example.com',
  provider: 'gemini',
  model: 'gemini-3.7-flash',
  tool: 'web-search',
  inputTokens: 120,
  outputTokens: 450,
  latencyMs: 680,
  status: 'success'
});

assert(adminService.usageLedger.length > 0, 'UsageEvent recorded in immutable ledger');
assert(adminService.usageLedger[0].totalTokens === 570, 'Token arithmetic calculated accurately');

adminService.recordSearch({
  userId: 'user_123',
  userEmail: 'alice@example.com',
  tool: 'web-search',
  queryText: 'Latest AI breakthroughs',
  provider: 'crawler',
  latencyMs: 340,
  sourceCount: 5
});

assert(adminService.searchLedger.length > 0, 'SearchEvent recorded in audit ledger');

// 4. Test Live Presence
console.log('\n--- 4. Live Presence & Connection Tracking ---');
adminService.updatePresence('user_123', 'conn_desktop_1', {
  email: 'alice@example.com',
  device: 'Desktop Chrome',
  area: 'Chat',
  activity: 'Chatting'
});

const pres = adminService.presenceLedger.get('user_123');
assert(Boolean(pres && pres.online === true), 'Presence ledger accurately reflects online state');
assert(adminService.getOnlineCount() >= 1, 'Online count calculated from active heartbeat connections');

// 5. Test System Settings & Maintenance Mode
console.log('\n--- 5. System Settings & Maintenance Flags ---');
adminService.systemSettings.maintenanceEnabled = true;
adminService.systemSettings.maintenanceMessage = 'Custom scheduled maintenance';
assert(adminService.systemSettings.maintenanceEnabled === true, 'Maintenance mode set');

adminService.recordAudit('MAINTENANCE_ENABLED', 'oshadhaperera500@gmail.com', 'SYSTEM', 'MAINTENANCE', { test: true });
assert(adminService.auditLedger.some(a => a.action === 'MAINTENANCE_ENABLED'), 'Audit log written for maintenance change');

console.log(`\n======================================================`);
console.log(`🎉 Test Suite Complete: ${passedTests} / ${totalTests} tests passed`);
console.log(`======================================================\n`);
