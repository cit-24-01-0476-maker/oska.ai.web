#!/usr/bin/env node
/**
 * oska.AI V1 — Admin Access Code Hashing Utility
 * 
 * Generates a secure cryptographic hash for ADMIN_ACCESS_CODE_HASH
 * Uses Node.js native scrypt with a 16-byte random salt.
 * 
 * Usage:
 *   node scripts/hash-admin-code.mjs <6-digit-code>
 *   or interactively:
 *   node scripts/hash-admin-code.mjs
 */

import crypto from 'crypto';
import readline from 'readline';

function hashAccessCode(code) {
  const cleanCode = String(code).trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    console.error('Error: Admin Access Code must be exactly 6 digits (0-9).');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(cleanCode, salt, 64);
  const hashString = `scrypt$${salt}$${derivedKey.toString('hex')}`;

  console.log('\n======================================================');
  console.log('🔒 oska.AI V1 — Secure Admin Access Code Hash Generated');
  console.log('======================================================');
  console.log('\nAdd this environment variable to Vercel and your .env:');
  console.log(`\nADMIN_ACCESS_CODE_HASH=${hashString}\n`);
  console.log('⚠️  IMPORTANT: Never commit or share your plaintext 6-digit code.');
  console.log('======================================================\n');
}

const argCode = process.argv[2];
if (argCode) {
  hashAccessCode(argCode);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter 6-digit Admin Access Code: ', (input) => {
    rl.close();
    hashAccessCode(input);
  });
}
