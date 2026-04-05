/**
 * Migration script: Backfill roundId on existing endorsements.
 *
 * Existing endorsements were created without a roundId field.
 * This script:
 * 1. Reads the current round from partyConfig
 * 2. Finds all endorsement docs missing roundId
 * 3. Sets roundId to the current round
 *
 * Usage:
 *   npx ts-node scripts/migrateEndorsements.ts
 *
 * Idempotent: skips docs that already have a roundId.
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
  console.log('Starting endorsement migration...');

  // 1. Get the current round
  const configSnap = await db.doc('config/partyConfig').get();
  const currentRoundId = configSnap.data()?.currentRoundId || 'round_1_endorsement';
  console.log(`Current round: ${currentRoundId}`);

  // 2. Get all endorsements
  const endorsementsSnap = await db.collection('endorsements').get();
  console.log(`Total endorsements: ${endorsementsSnap.size}`);

  // 3. Filter to those missing roundId
  const needsMigration = endorsementsSnap.docs.filter((doc) => {
    const data = doc.data();
    return !data.roundId;
  });

  console.log(`Endorsements missing roundId: ${needsMigration.length}`);

  if (needsMigration.length === 0) {
    console.log('Nothing to migrate. All endorsements already have roundId.');
    return;
  }

  // 4. Batch update in groups of 500
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < needsMigration.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = needsMigration.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      batch.update(doc.ref, { roundId: currentRoundId });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`Updated ${updated}/${needsMigration.length} endorsements`);
  }

  console.log(`Migration complete. ${updated} endorsements updated with roundId="${currentRoundId}".`);
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
