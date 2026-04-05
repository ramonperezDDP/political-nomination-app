/**
 * Migration script: Remove pre_nomination as the active contest round.
 *
 * Updates partyConfig to use round_1_endorsement as the starting round.
 * The contestRounds/pre_nomination Firestore document is intentionally
 * retained for historical audit trail interpretability.
 *
 * This script:
 * 1. Reads config/partyConfig
 * 2. If currentRoundId is 'pre_nomination', updates it to 'round_1_endorsement'
 * 3. Also updates the deprecated contestStage field
 *
 * Usage:
 *   npx ts-node scripts/migrateRemovePreNomination.ts
 *
 * Idempotent: no-ops if currentRoundId is already something other than 'pre_nomination'.
 * Safe to run multiple times.
 */

import * as admin from 'firebase-admin';

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var
// or the default service account when running on GCP)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrate() {
  console.log('Starting pre_nomination removal migration...');

  const configRef = db.doc('config/partyConfig');
  const configSnap = await configRef.get();

  if (!configSnap.exists) {
    console.log('config/partyConfig does not exist. Nothing to migrate.');
    return;
  }

  const data = configSnap.data()!;
  const currentRoundId = data.currentRoundId;
  const contestStage = data.contestStage;

  console.log(`Current state: currentRoundId=${currentRoundId}, contestStage=${contestStage}`);

  const updates: Record<string, string> = {};

  if (currentRoundId === 'pre_nomination') {
    updates.currentRoundId = 'round_1_endorsement';
  }

  if (contestStage === 'pre_nomination') {
    updates.contestStage = 'round_1_endorsement';
  }

  if (Object.keys(updates).length === 0) {
    console.log('No fields reference pre_nomination. Migration already complete.');
    return;
  }

  await configRef.update(updates);
  console.log('Updated partyConfig:', updates);
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
