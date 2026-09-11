import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createAcquisition } from '../server/acquisition.js';

test('来源只首次记录，报表区分付费、退款与净音频用量，不输出个人资料', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE user (id TEXT, createdAt INTEGER, emailVerified INTEGER); CREATE TABLE kotoba_billing_live (user_id TEXT, state TEXT)');
    db.prepare('INSERT INTO user VALUES (?, ?, ?)').run('private-user-id', 1, 1);
    db.prepare('INSERT INTO user VALUES (?, ?, ?)').run('unverified-user', 1, 0);
    const metric = createAcquisition(db, { live: true, now: () => 42 });
    assert.equal(metric.record('private-user-id', 'https://private.example/search?q=secret'), false);
    metric.record('private-user-id', 'google'); metric.record('private-user-id', 'community');
    db.prepare('INSERT INTO kotoba_billing_live VALUES (?, ?)').run('private-user-id', JSON.stringify({ trialClaimed: true, grants: [{ kind: 'trial', usedSamples: 16000 }, { kind: 'topup', paidAmount: 999, refundedAmount: 999, usedSamples: 0 }] }));
    const result = metric.report(), group = result.groups[0];
    assert.equal(group.source, 'google'); assert.equal(group.verifiedAccounts, 1);
    assert.equal(group.trialClaimedAccounts, 1); assert.equal(group.accountsWithNetAudioUsage, 1);
    assert.equal(group.accountsWithPaidGrant, 1); assert.equal(group.accountsWithRetainedPaidGrant, 0);
    assert.equal(group.netAudioHours, 1 / 3600);
    assert.doesNotMatch(JSON.stringify(result), /private-user-id|unverified-user/);
    assert.equal(createAcquisition(db, { live: true }).report().groups[0].source, 'google');
  } finally { db.close(); }
});
