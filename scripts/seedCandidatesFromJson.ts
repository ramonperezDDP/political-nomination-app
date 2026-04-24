#!/usr/bin/env ts-node
/**
 * seedCandidatesFromJson — push 202 fictional candidates + optional PSAs
 * from scripts/data/candidates-PA-{01,02}.json into Firestore + Storage.
 *
 * See docs/plans/PLAN-20-seed-candidate-profiles.md for the full design.
 *
 * Usage:
 *   npx ts-node scripts/seedCandidatesFromJson.ts               # dry-run
 *   npx ts-node scripts/seedCandidatesFromJson.ts --confirm     # write
 *   npx ts-node scripts/seedCandidatesFromJson.ts --confirm --remove-legacy
 *
 * Env-based emulator routing: set FIRESTORE_EMULATOR_HOST and
 * FIREBASE_STORAGE_EMULATOR_HOST before invoking to target the emulator
 * instead of the live project.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { spawnSync } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildBio } = require('./lib/buildBio');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scanBio } = require('./lib/blocklist');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { zipToZone } = require('./lib/zipToZone');

// ==================== CONFIG ====================

const PROJECT_ID = 'party-nomination-app';
const BUCKET_NAME = 'party-nomination-app.firebasestorage.app';
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'scripts', 'data');
const AVATARS_DIR = path.join(REPO_ROOT, 'assets', 'candidates');
const FIRESTORE_BATCH_LIMIT = 500;

interface Args {
  confirm: boolean;
  removeLegacy: boolean;
  allowDeletes: boolean;
  districtFilter: string | null;
  skipImages: boolean;
  skipPsas: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { confirm: false, removeLegacy: false, allowDeletes: false, districtFilter: null, skipImages: false, skipPsas: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--confirm') a.confirm = true;
    else if (v === '--remove-legacy') a.removeLegacy = true;
    else if (v === '--allow-deletes') a.allowDeletes = true;
    else if (v === '--skip-images') a.skipImages = true;
    else if (v === '--skip-psas') a.skipPsas = true;
    else if (v === '--district') {
      const nxt = argv[++i];
      if (!nxt || nxt.startsWith('--')) throw new Error(`--district requires a value (e.g. --district PA-01)`);
      if (nxt !== 'PA-01' && nxt !== 'PA-02') throw new Error(`--district must be PA-01 or PA-02, got "${nxt}"`);
      a.districtFilter = nxt;
    }
    else if (v === '--dry-run') a.confirm = false;
    else if (v.startsWith('--')) throw new Error(`Unknown flag: ${v}`);
  }
  return a;
}

// ==================== TYPES ====================

interface JsonQuizResponse { questionId: string; issueId: string; answer: number | null; optionShortLabel: string | null; }
interface JsonCandidate {
  pn: number;
  firstName: string;
  lastName: string;
  displayName: string;
  age: number;
  gender: string;
  ethnicity: string;
  neighborhood: string;
  zipCode: string;
  district: string;
  imageFilename: string;
  endorsements: { start: number | null; afterTop20: number | null; afterTop10: number | null; afterVTH: number | null; afterDebate: number | null; winner: number | null };
  quizResponses: JsonQuizResponse[];
}
interface JsonDistrict { district: string; questions: any[]; candidates: JsonCandidate[]; }

interface AvatarPlan { path: string; hash: string; needsUpload: boolean; currentHash: string | null; }
interface ThumbnailPlan { hash: string; needsUpload: boolean; currentHash: string | null; }
interface CandidatePlan {
  kind: 'create' | 'update' | 'skip';
  json: JsonCandidate;
  candidateId: string;
  userId: string;
  existingCandidate: any | null;
  existingUser: any | null;
  avatar: AvatarPlan | null;
  thumbnail: ThumbnailPlan | null;
  bio: { summary: string; background: string; reasonForRunning: string };
  zone: string;
  topIssues: any[];
}

// Thumbnail params baked into thumbHash so a param change forces re-upload.
const THUMBNAIL_VERSION = 'v1-256-jpeg-q80';
const THUMBNAIL_MAX_PX = 256;
const THUMBNAIL_JPEG_QUALITY = 80;
interface PsaPlan {
  kind: 'create' | 'update' | 'skip';
  psaId: string;
  candidateId: string;
  district: string;
  pn: number;
  videoPath: string;
  videoHash: string;
  currentHash: string | null;
  durationSec: number;
  sidecar: any | null;
  issueIds: string[];
  title: string;
  description: string;
  // Thumbnail source: either a candidate-supplied landscape image or a
  // frame-grab from the portrait video. Hash-tracked separately from the
  // video so swapping only the landscape image re-uploads just the thumb.
  landscapeThumbPath: string | null;
  thumbSourceHash: string;
  needsThumbUpload: boolean;
}
interface LegacyDoc { collection: 'candidates' | 'users'; id: string; displayName?: string; email?: string; createdAt?: string; }
interface OrphanDoc { collection: 'candidates' | 'users' | 'psas'; id: string; displayName?: string; }

// ==================== INIT ====================

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME });
}

function verifyFfmpegChain() {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    const res = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (res.status !== 0) {
      throw new Error(`${bin} not found on PATH. Install with: brew install ffmpeg`);
    }
  }
}

// ==================== HASHING ====================

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256File(p: string): string {
  return sha256(fs.readFileSync(p));
}

// ==================== ID FORMATTING ====================

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}
function candidateIdFor(district: string, pn: number): string {
  return `seed-${district}-${pad3(pn)}`;
}
function userIdFor(district: string, pn: number): string {
  return `seed-user-${district}-${pad3(pn)}`;
}
function psaIdFor(district: string, pn: number): string {
  return `seed-psa-${district}-${pad3(pn)}`;
}

// ==================== PLANNING ====================

async function planCandidates(jsons: JsonDistrict[], args: Args) {
  const db = admin.firestore();
  const existingCandSnap = await db.collection('candidates').get();
  const existingUserSnap = await db.collection('users').get();
  const existingCands = new Map<string, any>();
  const existingUsers = new Map<string, any>();
  existingCandSnap.docs.forEach((d) => existingCands.set(d.id, d.data()));
  existingUserSnap.docs.forEach((d) => existingUsers.set(d.id, d.data()));

  const plans: CandidatePlan[] = [];
  const avatarsToUpload: { plan: CandidatePlan; avatar: AvatarPlan }[] = [];
  const thumbnailsToUpload: { plan: CandidatePlan; thumb: ThumbnailPlan; sourcePath: string }[] = [];

  for (const jd of jsons) {
    if (args.districtFilter && jd.district !== args.districtFilter) continue;
    for (const c of jd.candidates) {
      const candidateId = candidateIdFor(c.district, c.pn);
      const userId = userIdFor(c.district, c.pn);
      const existingCand = existingCands.get(candidateId) || null;
      const existingUser = existingUsers.get(userId) || null;
      const kind: CandidatePlan['kind'] = existingCand ? 'update' : 'create';

      // Avatar hash + derived thumbnail hash
      let avatar: AvatarPlan | null = null;
      let thumbnail: ThumbnailPlan | null = null;
      if (!args.skipImages) {
        const avPath = path.join(AVATARS_DIR, `${c.district}-Profile-Pics`, c.imageFilename);
        if (!fs.existsSync(avPath)) {
          console.error(`WARN: missing avatar for PN ${c.pn} (${c.district}): ${avPath} — candidate will be created without a photo on this run.`);
        } else {
          const hash = sha256File(avPath);
          const currentHash = existingCand?.photoHash || null;
          avatar = { path: avPath, hash, needsUpload: hash !== currentHash, currentHash };
          // Thumbnail tag = source hash + params version. Regenerates when
          // either the source photo or the thumbnail params change.
          const thumbTag = `${hash}/${THUMBNAIL_VERSION}`;
          const currentThumb = existingCand?.thumbnailHash || null;
          thumbnail = { hash: thumbTag, needsUpload: thumbTag !== currentThumb, currentHash: currentThumb };
        }
      }

      // Bio (derived) + zone + topIssues
      const bio = buildBio(c, jd.questions);
      const bioIssues = scanBio(bio);
      if (bioIssues.length) {
        const msgs = bioIssues.map((i: any) => `${i.field}: ${i.issue}`).join('; ');
        throw new Error(`Bio scan failed for PN ${c.pn} (${c.district}): ${msgs}`);
      }
      const { zone } = zipToZone(c.zipCode, c.district);
      const topIssues = deriveTopIssues(c, jd.questions);

      const plan: CandidatePlan = { kind, json: c, candidateId, userId, existingCandidate: existingCand, existingUser, avatar, thumbnail, bio, zone, topIssues };
      plans.push(plan);
      if (avatar && avatar.needsUpload) avatarsToUpload.push({ plan, avatar });
      if (thumbnail && thumbnail.needsUpload && avatar) {
        thumbnailsToUpload.push({ plan, thumb: thumbnail, sourcePath: avatar.path });
      }
    }
  }

  // Orphan seed- candidates (in Firestore but not in JSON)
  const expectedIds = new Set(plans.map((p) => p.candidateId));
  const orphans: OrphanDoc[] = [];
  for (const [id, data] of existingCands) {
    if (id.startsWith('seed-') && !expectedIds.has(id)) {
      orphans.push({ collection: 'candidates', id, displayName: data?.displayName });
    }
  }
  const expectedUserIds = new Set(plans.map((p) => p.userId));
  for (const [id, data] of existingUsers) {
    if (id.startsWith('seed-user-') && !expectedUserIds.has(id)) {
      orphans.push({ collection: 'users', id, displayName: data?.displayName });
    }
  }

  // Legacy docs (non-seed-prefixed candidates / candidate-role users)
  const legacy: LegacyDoc[] = [];
  for (const [id, data] of existingCands) {
    if (!id.startsWith('seed-')) {
      legacy.push({ collection: 'candidates', id, displayName: data?.displayName, email: data?.email, createdAt: formatTs(data?.createdAt) });
    }
  }
  for (const [id, data] of existingUsers) {
    if (data?.role === 'candidate' && !id.startsWith('seed-user-')) {
      legacy.push({ collection: 'users', id, displayName: data?.displayName, email: data?.email, createdAt: formatTs(data?.createdAt) });
    }
  }

  return { plans, avatarsToUpload, thumbnailsToUpload, orphans, legacy };
}

function deriveTopIssues(c: JsonCandidate, questions: any[]) {
  const qIndex: Record<string, any> = {};
  for (const q of questions) qIndex[q.id] = q;
  const scored = (c.quizResponses || []).map((r) => ({ r, mag: Math.abs(coerceAnswer(r, qIndex)) }));
  scored.sort((a, b) => b.mag - a.mag);
  const top = scored.slice(0, 3).map(({ r }) => ({
    issueId: r.issueId,
    position: r.optionShortLabel || 'Center',
    priority: 0, // filled after
    spectrumPosition: coerceAnswer(r, qIndex),
  }));
  top.forEach((ti: any, i: number) => (ti.priority = i + 1));
  return top;
}

function coerceAnswer(r: JsonQuizResponse, qIndex: Record<string, any>): number {
  // PLAN-20 / Edge Cases: null → center value for 3-option questions
  if (r.answer === null || r.answer === undefined) {
    const q = qIndex[r.questionId];
    if (!q) return 0;
    if (q.options.length === 3) return 0;
    throw new Error(`Null answer on binary question ${r.questionId}; no neutral option exists.`);
  }
  return r.answer;
}

function formatTs(ts: any): string | undefined {
  if (!ts) return undefined;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  return String(ts);
}

// ==================== PSA PLANNING ====================

function ffprobeDurationSec(file: string): number {
  const res = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`ffprobe failed for ${file}: ${res.stderr}`);
  return parseFloat(res.stdout.trim());
}

function generateThumbnail(videoPath: string, durationSec: number, outPath: string) {
  const ss = Math.max(0.01, durationSec * 0.15).toFixed(2);
  const res = spawnSync('ffmpeg', ['-y', '-ss', ss, '-i', videoPath, '-frames:v', '1', '-vf', "scale='min(720,iw)':-1:flags=lanczos", '-q:v', '4', outPath], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`ffmpeg thumbnail failed for ${videoPath}: ${res.stderr}`);
}

function findLandscapeThumbPath(district: string, pn: number): string | null {
  const districtCode = district.replace(/^PA-/, '');
  const dir = path.join(AVATARS_DIR, `${district}-PSA-Landscape-Thumbs`);
  if (!fs.existsSync(dir)) return null;
  // Accept both `01-1.jpg` (unpadded, matches the PSA filename regex) and
  // `01-01.jpg` (2-digit padded, matches the actual video filenames).
  const pnVariants = [String(pn), pn.toString().padStart(2, '0')];
  for (const pnStr of pnVariants) {
    for (const ext of ['jpg', 'jpeg', 'png']) {
      const p = path.join(dir, `${districtCode}-${pnStr}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function planPsas(jsons: JsonDistrict[], candidatePlansByKey: Map<string, CandidatePlan>, args: Args): Promise<{ psaPlans: PsaPlan[]; orphans: OrphanDoc[] }> {
  if (args.skipPsas) return { psaPlans: [], orphans: [] };
  const db = admin.firestore();
  const psaSnap = await db.collection('psas').get();
  const existing = new Map<string, any>();
  psaSnap.docs.forEach((d) => existing.set(d.id, d.data()));

  const psaPlans: PsaPlan[] = [];
  const seenIds = new Set<string>();

  for (const jd of jsons) {
    if (args.districtFilter && jd.district !== args.districtFilter) continue;
    const videoDir = path.join(AVATARS_DIR, `${jd.district}-PSA-Videos`);
    if (!fs.existsSync(videoDir)) continue;
    const files = fs.readdirSync(videoDir).filter((f) => /\.(mp4|mov|m4v)$/i.test(f));
    for (const filename of files) {
      const m = filename.match(/^(\d{2})-(\d{1,3})\.(mp4|mov|m4v)$/i);
      if (!m) { console.warn(`  skipping unrecognized PSA filename: ${filename}`); continue; }
      const districtCode = m[1]; // "01" or "02"
      const pn = parseInt(m[2], 10);
      const expectedDistrict = `PA-${districtCode}`;
      if (expectedDistrict !== jd.district) continue;

      const candidatePlan = candidatePlansByKey.get(`${jd.district}-${pn}`);
      if (!candidatePlan) {
        console.warn(`  PSA ${filename} references PN ${pn} in ${jd.district} but no matching candidate in JSON — skipping`);
        continue;
      }

      const videoPath = path.join(videoDir, filename);
      const videoHash = sha256File(videoPath);
      const psaId = psaIdFor(jd.district, pn);
      seenIds.add(psaId);
      const prior = existing.get(psaId);
      const currentHash = prior?.videoHash || null;
      const kind: PsaPlan['kind'] = prior ? (currentHash === videoHash ? 'skip' : 'update') : 'create';

      const duration = Math.round(ffprobeDurationSec(videoPath));

      // Sidecar
      const sidecarPath = videoPath.replace(/\.(mp4|mov|m4v)$/i, '.meta.json');
      let sidecar: any | null = null;
      if (fs.existsSync(sidecarPath)) {
        try { sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8')); }
        catch (e: any) { console.warn(`  WARN: sidecar ${sidecarPath} is invalid JSON: ${e.message}; ignoring`); }
      }

      const title = sidecar?.title || `A message from ${candidatePlan.json.displayName}`;
      const description = sidecar?.description || `${candidatePlan.json.displayName} on their priorities for ${jd.district}.`;
      const issueIds: string[] = Array.isArray(sidecar?.issueIds)
        ? sidecar.issueIds
        : candidatePlan.topIssues.map((ti: any) => ti.issueId);

      // Thumbnail source: prefer a candidate-supplied landscape image;
      // fall back to a frame grab from the portrait video (tagged with the
      // video hash so a video swap regenerates the frame).
      const landscapeThumbPath = findLandscapeThumbPath(jd.district, pn);
      const thumbSourceHash = landscapeThumbPath
        ? `landscape:${sha256File(landscapeThumbPath)}`
        : `frame:${videoHash}`;
      const currentThumbSourceHash = prior?.thumbSourceHash || null;
      const needsThumbUpload = thumbSourceHash !== currentThumbSourceHash;

      psaPlans.push({
        kind,
        psaId,
        candidateId: candidatePlan.candidateId,
        district: jd.district,
        pn,
        videoPath,
        videoHash,
        currentHash,
        durationSec: duration,
        sidecar,
        issueIds,
        title,
        description,
        landscapeThumbPath,
        thumbSourceHash,
        needsThumbUpload,
      });
    }
  }

  // Orphan PSAs (seed-psa-*) not referenced by any video file
  const orphans: OrphanDoc[] = [];
  for (const [id, data] of existing) {
    if (id.startsWith('seed-psa-') && !seenIds.has(id)) {
      orphans.push({ collection: 'psas', id, displayName: data?.title });
    }
  }
  return { psaPlans, orphans };
}

// ==================== DIFF SUMMARY ====================

function printSummary(plan: {
  candidates: CandidatePlan[];
  avatarsToUpload: { plan: CandidatePlan; avatar: AvatarPlan }[];
  thumbnailsToUpload: { plan: CandidatePlan; thumb: ThumbnailPlan; sourcePath: string }[];
  psas: PsaPlan[];
  orphans: OrphanDoc[];
  legacy: LegacyDoc[];
}, args: Args) {
  const creates = plan.candidates.filter((p) => p.kind === 'create').length;
  const updates = plan.candidates.filter((p) => p.kind === 'update').length;
  const psaCreates = plan.psas.filter((p) => p.kind === 'create').length;
  const psaUpdates = plan.psas.filter((p) => p.kind === 'update').length;
  const psaSkips = plan.psas.filter((p) => p.kind === 'skip').length;
  const videosToUpload = plan.psas.filter((p) => p.kind !== 'skip');
  const totalVideoBytes = videosToUpload.reduce((sum, p) => sum + fs.statSync(p.videoPath).size, 0);
  const thumbUploads = plan.psas.filter((p) => p.needsThumbUpload);
  const thumbFromLandscape = thumbUploads.filter((p) => p.landscapeThumbPath).length;
  const thumbFromFrameGrab = thumbUploads.length - thumbFromLandscape;

  console.log('');
  console.log('================ PLAN ================');
  console.log(`Mode: ${args.confirm ? 'WRITE (--confirm)' : 'DRY-RUN (default)'}${args.removeLegacy ? ' +REMOVE-LEGACY' : ''}${args.allowDeletes ? ' +ALLOW-DELETES' : ''}`);
  console.log('');
  console.log(`Candidates: ${creates} create, ${updates} update, ${plan.candidates.filter((p) => p.kind === 'skip').length} skip`);
  console.log(`Avatars:    ${plan.avatarsToUpload.length} to upload`);
  console.log(`Thumbnails: ${plan.thumbnailsToUpload.length} to generate + upload (${THUMBNAIL_MAX_PX}px JPEG q${THUMBNAIL_JPEG_QUALITY})`);
  console.log(`PSAs:       ${psaCreates} create, ${psaUpdates} update, ${psaSkips} skip`);
  console.log(`  videos:   ${videosToUpload.length} to upload (${(totalVideoBytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  psa thumbs: ${thumbUploads.length} to upload (${thumbFromLandscape} landscape image, ${thumbFromFrameGrab} frame-grab)`);
  console.log('');

  if (args.removeLegacy) {
    console.log(`LEGACY WIPE — ${plan.legacy.length} doc(s) to delete`);
    for (const l of plan.legacy) {
      console.log(`  ${l.collection}/${l.id}  ${l.displayName ? `name="${l.displayName}"` : ''}  ${l.email ? `email=${l.email}` : ''}  ${l.createdAt ? `created=${l.createdAt}` : ''}`);
    }
    console.log('');
  }

  if (plan.orphans.length) {
    console.log(`ORPHAN seed- docs (not in JSON) — ${plan.orphans.length}:`);
    for (const o of plan.orphans) {
      console.log(`  ${o.collection}/${o.id}  ${o.displayName ? `"${o.displayName}"` : ''}`);
    }
    if (!args.allowDeletes) console.log(`  (pass --allow-deletes to remove)`);
    console.log('');
  }

  // Batch chunk preview
  const totalUserBatches = Math.ceil(plan.candidates.filter((p) => p.kind !== 'skip').length / FIRESTORE_BATCH_LIMIT);
  const totalCandBatches = totalUserBatches;
  const totalPsaBatches = Math.ceil(plan.psas.filter((p) => p.kind !== 'skip' || p.needsThumbUpload).length / FIRESTORE_BATCH_LIMIT);
  console.log(`Batches: users ${totalUserBatches}, candidates ${totalCandBatches}, psas ${totalPsaBatches} (limit ${FIRESTORE_BATCH_LIMIT}/batch)`);
  console.log('======================================');
}

// ==================== TYPED CONFIRMATION ====================

function promptTyped(prompt: string, expected: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() === expected);
    });
  });
}

// ==================== EXECUTION ====================

async function uploadFile(localPath: string, storagePath: string, contentType: string): Promise<string> {
  const bucket = admin.storage().bucket();
  const token = crypto.randomUUID();
  const buf = fs.readFileSync(localPath);
  await bucket.file(storagePath).save(buf, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=86400',
      metadata: { firebaseStorageDownloadTokens: token },
    },
    resumable: false,
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function guessImageContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function guessVideoContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

async function executeLegacyWipe(legacy: LegacyDoc[]) {
  if (legacy.length === 0) return;
  const db = admin.firestore();
  const byCollection: Record<string, LegacyDoc[]> = {};
  for (const l of legacy) (byCollection[l.collection] ||= []).push(l);
  for (const [coll, docs] of Object.entries(byCollection)) {
    const chunks = Math.ceil(docs.length / FIRESTORE_BATCH_LIMIT);
    if (docs.length > 0 && chunks === 0) throw new Error('chunking math regression');
    console.log(`  legacy-wipe ${coll}: ${docs.length} docs in ${chunks} batch(es)`);
    for (let i = 0; i < chunks; i++) {
      const batch = db.batch();
      const slice = docs.slice(i * FIRESTORE_BATCH_LIMIT, (i + 1) * FIRESTORE_BATCH_LIMIT);
      for (const l of slice) batch.delete(db.collection(coll).doc(l.id));
      await batch.commit();
    }
  }
}

async function executeAvatarUploads(items: { plan: CandidatePlan; avatar: AvatarPlan }[], uploadedPaths: string[]) {
  for (const { plan, avatar } of items) {
    const ext = path.extname(avatar.path) || '.png';
    const storagePath = `profilePhotos/${plan.userId}/avatar${ext}`;
    const ct = guessImageContentType(avatar.path);
    const url = await uploadFile(avatar.path, storagePath, ct);
    uploadedPaths.push(storagePath);
    (plan as any)._photoUrl = url;
  }
}

function generateAvatarThumbnail(sourcePath: string, outPath: string) {
  // macOS sips: scale longest side to THUMBNAIL_MAX_PX, convert to JPEG at quality q.
  const res = spawnSync('sips', [
    '-Z', String(THUMBNAIL_MAX_PX),
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(THUMBNAIL_JPEG_QUALITY),
    sourcePath,
    '--out', outPath,
  ], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`sips thumbnail failed for ${sourcePath}: ${res.stderr}`);
}

async function executeThumbnailUploads(
  items: { plan: CandidatePlan; thumb: ThumbnailPlan; sourcePath: string }[],
  uploadedPaths: string[],
) {
  const tmpDir = '/tmp';
  for (const { plan, thumb, sourcePath } of items) {
    const localThumb = path.join(tmpDir, `amsp-thumb-${plan.userId}.jpg`);
    generateAvatarThumbnail(sourcePath, localThumb);
    const storagePath = `profileThumbnails/${plan.userId}/thumbnail.jpg`;
    const url = await uploadFile(localThumb, storagePath, 'image/jpeg');
    uploadedPaths.push(storagePath);
    try { fs.unlinkSync(localThumb); } catch { /* ignore */ }
    (plan as any)._thumbnailUrl = url;
    (plan as any)._thumbnailHash = thumb.hash;
  }
}

async function executePsaUploads(psas: PsaPlan[], uploadedPaths: string[]) {
  const tmpDir = '/tmp';
  for (const p of psas) {
    // Video upload: only when the video file changed (create or update)
    if (p.kind !== 'skip') {
      const ext = path.extname(p.videoPath);
      const videoStoragePath = `psaVideos/${p.candidateId}/video${ext}`;
      const videoUrl = await uploadFile(p.videoPath, videoStoragePath, guessVideoContentType(p.videoPath));
      uploadedPaths.push(videoStoragePath);
      (p as any)._videoUrl = videoUrl;
    }
    // Thumbnail upload: only when the thumb source changed
    if (p.needsThumbUpload) {
      const thumbStoragePath = `psaThumbnails/${p.candidateId}/thumbnail.jpg`;
      let sourcePath: string;
      let tmpCleanup: string | null = null;
      if (p.landscapeThumbPath) {
        sourcePath = p.landscapeThumbPath;
      } else {
        sourcePath = path.join(tmpDir, `amsp-psa-thumb-${p.psaId}.jpg`);
        tmpCleanup = sourcePath;
        generateThumbnail(p.videoPath, p.durationSec, sourcePath);
      }
      const thumbUrl = await uploadFile(sourcePath, thumbStoragePath, 'image/jpeg');
      uploadedPaths.push(thumbStoragePath);
      if (tmpCleanup) { try { fs.unlinkSync(tmpCleanup); } catch { /* ignore */ } }
      (p as any)._thumbUrl = thumbUrl;
    }
  }
}

async function executeDocWrites(plan: {
  candidates: CandidatePlan[];
  psas: PsaPlan[];
  orphans: OrphanDoc[];
}, args: Args, jsonsByDistrict: Map<string, JsonDistrict>) {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // Build user and candidate writes
  const userWrites: { id: string; data: any }[] = [];
  const candWrites: { id: string; data: any }[] = [];

  for (const p of plan.candidates) {
    if (p.kind === 'skip') continue;
    const c = p.json;
    const questions = jsonsByDistrict.get(c.district)!.questions;
    const qIndex: Record<string, any> = {};
    for (const q of questions) qIndex[q.id] = q;

    // quizResponses with null→center substitution
    const questionnaireResponses = (c.quizResponses || []).map((r) => ({
      questionId: r.questionId,
      issueId: r.issueId,
      answer: coerceAnswer(r, qIndex),
    }));

    const selectedIssues = p.topIssues.map((ti: any) => ti.issueId);

    const existingUser = p.existingUser;
    const userDoc: any = {
      id: p.userId,
      email: existingUser?.email ?? `${p.userId}@example.com`,
      firstName: c.firstName,
      lastName: c.lastName,
      displayName: c.displayName,
      isAnonymous: existingUser?.isAnonymous ?? false,
      gender: c.gender,
      ethnicity: c.ethnicity,
      role: 'candidate',
      verification: existingUser?.verification ?? { email: 'verified', voterRegistration: 'verified', photoId: 'verified' },
      onboarding: existingUser?.onboarding ?? { questionnaire: 'complete' },
      districts: existingUser?.districts ?? [{ id: c.district, type: 'congressional', name: c.district, state: 'PA' }],
      selectedIssues,
      questionnaireResponses,
      zipCode: c.zipCode,
      lastActiveAt: existingUser?.lastActiveAt ?? now,
      sessionCount: existingUser?.sessionCount ?? 0,
      firstSeenAt: existingUser?.firstSeenAt ?? now,
      appVersion: existingUser?.appVersion ?? 'seed',
      platform: existingUser?.platform ?? 'seed',
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now,
    };
    const avatarUrl = (p as any)._photoUrl || p.existingCandidate?.photoUrl || null;
    const thumbUrl = (p as any)._thumbnailUrl || p.existingCandidate?.thumbnailUrl || null;
    const thumbHash = (p as any)._thumbnailHash || p.existingCandidate?.thumbnailHash || null;
    if (avatarUrl) userDoc.photoUrl = avatarUrl;
    if (thumbUrl) userDoc.thumbnailUrl = thumbUrl;

    const candDoc: any = {
      id: p.candidateId,
      userId: p.userId,
      status: 'approved',
      signatureDocUrl: p.existingCandidate?.signatureDocUrl ?? '',
      declarationData: p.existingCandidate?.declarationData ?? { encryptedPayload: '', keyId: '' },
      reasonForRunning: p.bio.reasonForRunning,
      topIssues: p.topIssues,
      bio: {
        summary: p.bio.summary,
        background: p.bio.background,
        education: p.existingCandidate?.bio?.education ?? [],
        experience: p.existingCandidate?.bio?.experience ?? [],
        achievements: p.existingCandidate?.bio?.achievements ?? [],
      },
      district: c.district,
      zone: p.zone,
      updatedAt: now,
    };
    // Runtime-owned fields: write only on create
    if (p.kind === 'create') {
      candDoc.profileViews = 0;
      candDoc.trendingScore = 0;
      candDoc.endorsementCount = c.endorsements?.afterTop20 ?? 0;
      candDoc.publishedAt = now;
      candDoc.createdAt = now;
    }
    if (p.avatar) candDoc.photoHash = p.avatar.hash;
    if (avatarUrl) candDoc.photoUrl = avatarUrl;
    if (thumbUrl) candDoc.thumbnailUrl = thumbUrl;
    if (thumbHash) candDoc.thumbnailHash = thumbHash;

    userWrites.push({ id: p.userId, data: userDoc });
    candWrites.push({ id: p.candidateId, data: candDoc });
  }

  // Write users, then candidates — chunked
  await writeBatched(db, 'users', userWrites);
  await writeBatched(db, 'candidates', candWrites);

  // PSAs
  const psaWrites: { id: string; data: any }[] = [];
  for (const p of plan.psas) {
    if (p.kind === 'skip' && !p.needsThumbUpload) continue;
    const prior = await db.collection('psas').doc(p.psaId).get().then((s) => s.exists ? s.data() : null);
    const psaDoc: any = {
      id: p.psaId,
      candidateId: p.candidateId,
      title: p.title,
      description: p.description,
      videoUrl: (p as any)._videoUrl || prior?.videoUrl,
      thumbnailUrl: (p as any)._thumbUrl || prior?.thumbnailUrl,
      duration: p.durationSec,
      status: (p.sidecar?.status) || prior?.status || 'published',
      issueIds: p.issueIds,
      videoHash: p.videoHash,
      thumbSourceHash: p.thumbSourceHash,
      updatedAt: now,
    };
    if (p.kind === 'create') {
      psaDoc.views = 0;
      psaDoc.likes = 0;
      psaDoc.createdAt = now;
    }
    psaWrites.push({ id: p.psaId, data: psaDoc });
  }
  await writeBatched(db, 'psas', psaWrites);

  // Orphan deletes (--allow-deletes)
  if (args.allowDeletes && plan.orphans.length) {
    const byColl: Record<string, OrphanDoc[]> = {};
    for (const o of plan.orphans) (byColl[o.collection] ||= []).push(o);
    for (const [coll, docs] of Object.entries(byColl)) {
      const chunks = Math.ceil(docs.length / FIRESTORE_BATCH_LIMIT);
      if (docs.length > 0 && chunks === 0) throw new Error('chunking math regression');
      console.log(`  orphan-delete ${coll}: ${docs.length} docs in ${chunks} batch(es)`);
      for (let i = 0; i < chunks; i++) {
        const batch = db.batch();
        const slice = docs.slice(i * FIRESTORE_BATCH_LIMIT, (i + 1) * FIRESTORE_BATCH_LIMIT);
        for (const o of slice) batch.delete(db.collection(coll).doc(o.id));
        await batch.commit();
      }
    }
  }
}

async function writeBatched(db: admin.firestore.Firestore, collection: string, writes: { id: string; data: any }[]) {
  if (writes.length === 0) return;
  const chunks = Math.ceil(writes.length / FIRESTORE_BATCH_LIMIT);
  if (writes.length > 0 && chunks === 0) throw new Error('chunking math regression');
  console.log(`  writing ${writes.length} ${collection} doc(s) in ${chunks} batch(es)`);
  for (let i = 0; i < chunks; i++) {
    const batch = db.batch();
    const slice = writes.slice(i * FIRESTORE_BATCH_LIMIT, (i + 1) * FIRESTORE_BATCH_LIMIT);
    for (const w of slice) batch.set(db.collection(collection).doc(w.id), w.data, { merge: true });
    await batch.commit();
  }
}

// ==================== MAIN ====================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Seeding candidates — ${args.confirm ? 'WRITE MODE' : 'dry-run'}`);
  if (process.env.FIRESTORE_EMULATOR_HOST) console.log(`  Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) console.log(`  Storage emulator:   ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);

  if (!args.skipPsas) verifyFfmpegChain();
  initAdmin();

  const jsons: JsonDistrict[] = ['PA-01', 'PA-02'].map((d) =>
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, `candidates-${d}.json`), 'utf8'))
  );
  const jsonsByDistrict = new Map<string, JsonDistrict>();
  jsons.forEach((j) => jsonsByDistrict.set(j.district, j));

  const candPlan = await planCandidates(jsons, args);
  const plansByKey = new Map<string, CandidatePlan>();
  for (const p of candPlan.plans) plansByKey.set(`${p.json.district}-${p.json.pn}`, p);
  const psaOut = await planPsas(jsons, plansByKey, args);

  const combinedOrphans = [...candPlan.orphans, ...psaOut.orphans];
  const plan = {
    candidates: candPlan.plans,
    avatarsToUpload: candPlan.avatarsToUpload,
    thumbnailsToUpload: candPlan.thumbnailsToUpload,
    psas: psaOut.psaPlans,
    orphans: combinedOrphans,
    legacy: candPlan.legacy,
  };

  printSummary(plan, args);

  if (!args.confirm) {
    console.log('\nDry-run only. Re-run with --confirm to apply.');
    return;
  }

  if (args.removeLegacy && plan.legacy.length > 0) {
    const typed = await promptTyped(
      `\n[!] --remove-legacy will delete ${plan.legacy.length} doc(s). Type the project ID to confirm: `,
      PROJECT_ID
    );
    if (!typed) {
      console.error('Confirmation string did not match. Aborting before any writes.');
      process.exit(2);
    }
  }

  console.log('\nExecuting...');
  // Execution order: build the new world first, then tear down the old.
  // If any of the upload / write steps below fail, process.exit(1) runs
  // BEFORE executeLegacyWipe ever touches the existing data. This trades a
  // brief period where both legacy + new candidates coexist (harmless — the
  // new ones use `seed-` IDs that don't collide) for a strong guarantee
  // that we never end up in an empty-state where the wipe succeeded but
  // creates failed.
  const uploadedPaths: string[] = [];
  try {
    if (!args.skipImages) {
      await executeAvatarUploads(plan.avatarsToUpload, uploadedPaths);
      await executeThumbnailUploads(plan.thumbnailsToUpload, uploadedPaths);
    }
    if (!args.skipPsas) await executePsaUploads(plan.psas.filter((p) => p.kind !== 'skip' || p.needsThumbUpload), uploadedPaths);
    await executeDocWrites(plan, args, jsonsByDistrict);
  } catch (err) {
    console.error('\nA create / upload step failed BEFORE the legacy wipe ran. Legacy data is untouched.');
    if (uploadedPaths.length > 0) {
      console.error(`\nStorage objects uploaded before the failure (may be orphaned — clean up manually if needed):`);
      for (const p of uploadedPaths) console.error(`  gs://${BUCKET_NAME}/${p}`);
    }
    throw err;
  }
  if (args.removeLegacy) await executeLegacyWipe(plan.legacy);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nSeeder failed:', err);
  process.exit(1);
});
