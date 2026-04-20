# PLAN-20: Seed Candidate Profiles and Manage Ongoing Edits

## Goal

Incorporate 202 fictional candidate profiles (101 per district, PA-01 and PA-02) into Firestore, plus any PSA videos dropped into the PSA folders, and establish a durable workflow for editing candidate text, swapping avatars or PSA videos, and adding/removing candidates after the initial seed.

Today the app ships with ~20 hand-coded candidates baked into `seedCandidates()` inside `src/services/firebase/firestore.ts`. Beyond that, there is no structured way to manage a larger candidate roster or to make small corrections without a code change and full reseed. PSAs today are expected to be authored in-app via `createPSA()`, which is not practical for seeded candidates.

## Scope and Risk Posture

This project is a **beta test in active development**. There is one Firebase project, a small known set of internal testers, and no user-facing SLA. The plan is deliberately *not* investing in:

- A segregated staging / production split or dev Firebase project.
- Firestore emulator test harness or CI gates.
- Containerized `ffmpeg` or version-pinning across hosts.
- A formal rollback service (manual export before risky runs is sufficient).

**Why:** The cost of these investments is high relative to the risk at beta scale. They become worth doing once (a) external users are relying on data integrity, (b) multiple engineers are seeding data, or (c) regulatory/compliance requirements appear. None of those conditions hold today. Revisit when scope changes.

Safeguards we *do* keep, because they are cheap and high-value:
- Dry-run by default, `--confirm` for writes, additional `--allow-deletes` for deletions.
- Typed-project-ID confirmation prompt when `--remove-legacy --confirm` are combined (see Decision 11).
- Stable IDs + upsert semantics so repeated runs converge rather than destroy.
- Hash-diff uploads so retries / re-runs are idempotent.
- Runtime-owned field preservation (endorsements, views, etc.) so iterative edits don't reset live counters.
- Optional Firestore-emulator smoke test before the first live run (see Phase 3 step 3b).
- Manual backup one-liners, run before the first destructive operation:
  - Firestore: `gcloud firestore export gs://party-nomination-app-backups/$(date +%Y%m%d-%H%M) --project party-nomination-app`
  - Storage (avatars + PSA videos + thumbnails): `gsutil -m cp -r gs://party-nomination-app.firebasestorage.app/profilePhotos /tmp/amsp-backup/profilePhotos-$(date +%Y%m%d-%H%M) && gsutil -m cp -r gs://party-nomination-app.firebasestorage.app/psaVideos /tmp/amsp-backup/psaVideos-$(date +%Y%m%d-%H%M) && gsutil -m cp -r gs://party-nomination-app.firebasestorage.app/psaThumbnails /tmp/amsp-backup/psaThumbnails-$(date +%Y%m%d-%H%M)`
  - **Bucket note**: Firestore exports must target `gs://party-nomination-app-backups` (us-central1). The live app bucket `gs://party-nomination-app.firebasestorage.app` is us-east1 which Firestore rejects. The backups bucket was created 2026-04-19 specifically for this.

## Impact Summary

| Area | Files | Change |
|------|-------|--------|
| Seed data (new) | 2 | `scripts/data/candidates-PA-{01,02}.json` — canonical candidate source of truth |
| Seed data (archived) | 2 | `scripts/data/candidates-PA-{01,02}.csv` — kept as-is for provenance, no longer read |
| Converter | 1 | `scripts/convertCandidatesCsv.js` — already in place; run on-demand if CSV is re-sourced |
| Avatars | 202 | `assets/candidates/PA-{01,02}-Profile-Pics/*.png` — checked into git |
| PSA videos | 0–N | `assets/candidates/PA-{01,02}-PSA-Videos/{district}-{pn}.mp4` — opt-in, only seeded if present |
| PSA sidecars (optional) | 0–N | `assets/candidates/PA-{01,02}-PSA-Videos/{district}-{pn}.meta.json` — optional metadata overrides |
| Bio builder (new) | 2 | `scripts/lib/buildBio.js` + `scripts/buildBios.js` — deterministic bio generator + preview CLI with profanity scan |
| Zone mapper (new) | 2 | `scripts/lib/zipToZone.js` + `scripts/mapZones.js` — zip→zone table + preview CLI for QC review |
| Seeder (new) | 1 | `scripts/seedCandidatesFromJson.ts` — idempotent upsert + image/video upload + thumbnail generation; imports `buildBio` and `zipToZone` |
| npm scripts | 1 | `package.json` — `build:bios`, `map:zones`, `seed:candidates`, `seed:candidates:apply` |
| Existing seeder | 1 | `seedCandidates()` in `firestore.ts` — **removed** after legacy wipe (see Decision 11) along with its hardcoded 20-candidate array and helpers |
| Tooling | — | `ffmpeg`/`ffprobe` required on seed host for thumbnail + duration extraction |
| Docs | 1 | This plan document |

**Total: 1 new script, 1 new plan doc, 2 npm entries, 202 avatar files, 1 sample PSA video (more may arrive), 2 data JSONs.**

---

## Key Design Decisions

### Decision 1: JSON files are the source of truth

Candidate text, quiz responses, and image references all live in `scripts/data/candidates-PA-XX.json`, which is checked into git.

**Why:**
- Existing candidates are hardcoded in a TypeScript file — a file edit + reseed cycle that product-side collaborators cannot do alone. Moving to structured JSON removes code coupling.
- Git gives us diff, blame, history, and PR review for every change.
- No admin-UI build required. If/when a live editor is built, this JSON can remain as the initial-seed dataset.

**Alternatives considered:**
- Firestore as source of truth with an admin UI → significant new build, deferred.
- Keep CSV as canonical → CSV is sparse and human-hostile (Y/N/X markers, unnamed columns). JSON is the human-editable layer.

### Decision 2: Stable, content-addressable IDs

Each seeded candidate has a deterministic ID derived from its district and position number (`pn`):

- `candidateId` = `seed-PA-01-001` … `seed-PA-02-101`
- `userId`      = `seed-user-PA-01-001` …

**Why:** Upserting the same ID across runs is what makes ongoing edits work. If IDs were random, every seeder run would create duplicates or force a destructive wipe. Stable IDs also let us reference candidates from test fixtures or support tickets by a stable key.

### Decision 3: Upsert semantics, not delete-and-recreate

The seeder reconciles JSON ↔ Firestore:
- **Create** — JSON entry exists, no Firestore doc → create user + candidate.
- **Update** — both exist → overwrite only the seed-owned fields (see Decision 5).
- **Delete** — Firestore doc exists with a `seed-…` ID but no JSON entry → delete (gated behind `--allow-deletes` flag).

**Why:** The existing reseed deletes and recreates every candidate, which resets live runtime fields (endorsements, trending scores, bookmarks). That's destructive for any production-style usage and makes iterative editing painful.

### Decision 4: Content-hash image sync

Each candidate doc carries a `photoHash` field (SHA-256 of the local avatar file). On each seeder run:
- Compute hash of the local image at `assets/candidates/PA-XX-Profile-Pics/{imageFilename}`.
- If it matches Firestore's stored hash → skip upload.
- If missing or different → upload to `profilePhotos/{userId}/avatar.{ext}`, get download URL, update `photoUrl` + `photoHash`.

**Why:** Avoids 202 redundant Storage uploads on every run. Lets image swaps work the same way as text edits — just drop a new file and re-seed.

### Decision 5: Seed-owned vs. runtime-owned fields

The seeder touches only fields that originate in the JSON. Runtime fields accumulated from user activity are preserved across seeds.

| Field | Owner | On seed |
|-------|-------|---------|
| `displayName`, `bio`, `topIssues`, `district`, `zone`, `reasonForRunning`, `status`, `photoUrl`, `photoHash` | seed | overwrite |
| User's `questionnaireResponses`, `selectedIssues`, `gender`, `firstName`, `lastName` | seed | overwrite |
| `endorsementCount` | seed (on create) + runtime (after) | initialize from CSV's `afterTop20` on first create; runtime increments/decrements thereafter |
| `profileViews`, `trendingScore`, `contestStatus`, `publishedAt` | runtime | write on create only |

**Why:** The 202 candidates will accumulate endorsements from real beta testers. Edits to a bio should not reset those counts. Initial `endorsementCount` is seeded from the CSV's `afterTop20` column — a plausible distribution that makes the leaderboard look populated immediately. After creation, the field is owned by runtime Cloud Functions (`onEndorsementCreate`/`Delete`) and never overwritten by the seeder again.

**Audit done:** `onEndorsementCreate` increments `endorsementCount` by 1 and `onEndorsementDelete` decrements it by 1 (verified in `functions/src/endorsements/endorsementTriggers.ts`). The counter therefore tracks current net endorsements, not strictly total-ever. For seeded candidates this is functionally equivalent to "total ever" because the `afterTop20` baseline is untouched until a beta tester actually endorses, and any later un-endorse can only cancel a prior endorse from that same tester — the seeded baseline never decays. Leaderboard/trending code treats the field as a monotonic-ish score; no downstream logic is broken by pre-seeding a non-zero value.

### Decision 6: Bios and `reasonForRunning` — auto-generated, with ethnicity used as modeling context only (never in prose)

The CSV does not include bio or `reasonForRunning` text, but the seeder does have enough structured inputs to compose a plausible, non-placeholder-looking bio per candidate. Inputs available to the generator: `firstName`, `lastName`, `age`, `gender`, `ethnicity`, `neighborhood`, `district`, `imageFilename`, and the 7 quiz answers (with each answer's `optionShortLabel`).

**Ethnicity policy:** Ethnicity is preserved as a structured field on the user doc (useful for future analytics, moderation, UI facets) but is **never rendered into bio prose**. It acts as internal modeling context only — the template author keeps the candidate's whole demographic picture in mind when choosing phrasing, but the emitted text names only age, neighborhood, district, and quiz positions.

Generation strategy (deterministic, no LLM call at seed time, no fabricated facts):

- **`bio.summary`** (one sentence):
  `"{displayName}, {age}, is a candidate from {neighborhood} in {district}."`
  Example: `"Maria Smith, 25, is a candidate from Bristol in PA-01."`

- **`bio.background`** (short paragraph, 2–3 sentences, synthesized from demographics + quiz positions):
  - Sentence 1: neighborhood-rooted framing with age.
    e.g., `"Maria is a 25-year-old running in Bucks County's PA-01 district, home-based in Bristol."`
  - Sentence 2: names the candidate's three most-decisive quiz positions by `optionShortLabel`, pulling from the answers with the largest `|spectrumValue|`. For the binary district questions, the Yes/No shortLabel is paired with a short question descriptor.
    e.g., `"Her platform leads with Protection on trade, Escalation on Iran policy, and Close on borders."`
  - Sentence 3 (optional): local-issue stance from the district-specific questions.
    e.g., `"Locally, she backs federal flood-mitigation funding and stricter environmental standards for new homes."`

- **`bio.education`, `bio.experience`, `bio.achievements`** = **empty arrays**. We will not fabricate degrees, employers, or accolades. These fields remain blank until real content is supplied.

- **`reasonForRunning`** (one sentence): summarizes the top three issue positions as the candidate's stated reasons.
  Template: `"{firstName} is running on {position1}, {position2}, and {position3}."`
  where each position is the question's `issueId` rendered human-readably prefixed with the answer's `shortLabel`.
  Example: `"Maria is running on Protection in trade, Escalation in Iran policy, and Close on borders."`

No left/right or progressive/conservative language is emitted anywhere — the bio references only the literal `shortLabel` chosen by the candidate, consistent with the app's non-2-party framing.

Generated bios are written to the Firestore `Candidate` doc at seed time. They are overwritten on every seed run (since they are derived). If a human wants to hand-author a bio later, we'll add per-candidate override fields to the JSON (e.g., `bioOverrides: { summary, background, reasonForRunning }`) and the seeder will prefer overrides when present — trivial extension when needed, not done now.

**Why:** The earlier "placeholder" strategy risked shipping obviously-fake copy. Auto-generation from real quiz data gives every candidate a unique, information-dense bio without fabrication. Since bios are deterministic outputs of JSON + question schema, they stay in sync if quiz answers change. Dropping ethnicity from prose avoids the risk of awkward or tokenizing constructions flagged by review.

### Decision 12: Standalone bio builder tool for preview before seeding

The bio generator is implemented as a self-contained, side-effect-free function exported from a new module `scripts/lib/buildBio.js`:

```
buildBio(candidate, questionSchema) → { summary, background, reasonForRunning }
```

It is invoked two ways:
1. **By the seeder** (`scripts/seedCandidatesFromJson.ts`) at seed time, once per candidate, to produce the bio fields written to Firestore.
2. **By a standalone CLI** (`scripts/buildBios.js`) that reads both district JSONs and writes a preview report to `scripts/data/bios-preview-PA-{01,02}.md`. Each report contains a heading per candidate and the three generated fields underneath, so a human can scroll through all 202 bios and spot awkward phrasing before any Firestore write happens.

Preview flow:
```
npm run build:bios          # writes scripts/data/bios-preview-PA-*.md
# open the preview files, review for weird wording or repetition
# tweak scripts/lib/buildBio.js if needed
# re-run until satisfied
npm run seed:candidates     # dry-run; bios match what was previewed
npm run seed:candidates:apply
```

The preview report also emits a short stats block at the top:
- average summary length in characters
- average background length in sentences
- any fields that contain suspect substrings (raw `null`, double spaces, unclosed quotes)
- count of bios whose background falls back to the shorter 2-sentence form (no strong-spectrum quiz answers)

**Why:** Bios touch every candidate — a bad template stamps 202 copies of the same problem. A standalone preview + review step is the cheapest way to catch awkward wording, matches the dev-beta posture (no full CI infra, just a human review gate), and gives product control without needing to spin up an admin UI. The shared `buildBio` module keeps the seeder and the preview tool in lockstep — whatever's reviewed is exactly what gets written.

**Profanity / sensitive-phrase scan:** `buildBio.js` ships with a small in-repo blocklist (`scripts/lib/blocklist.js` — slurs, obvious profanity, a short list of sensitive substrings that would be inappropriate in a candidate-profile context). The preview CLI runs every generated bio field through the blocklist; any match fails the preview with an error listing the candidate PN, field, and matched term. No blocklisted content can make it to Firestore since the seeder shares the same function and re-checks at seed time. The blocklist lives in git so it can be grown over time via PR.

### Decision 13: Zone pooling via zip-code mapping, QC'd with a preview tool

The `Candidate` doc carries a `zone` field. The existing hardcoded seeder assigns zones randomly from a per-district pool. Random zone assignment produces unrealistic distributions (e.g., a candidate whose neighborhood is in Bristol getting assigned a zone that corresponds to a different corner of the district).

Instead, the zone is derived from the candidate's zip code via a hand-authored mapping table:

- `scripts/lib/zipToZone.js` — exports `zipToZone(zipCode, district) → zoneId` plus a `ZIP_TO_ZONE` table. Each entry is a single zip code → zone assignment, with a short comment noting the neighborhood covered. Unknown zip codes fall back to a documented district-level default (e.g., `pa01-central`) with a console warning emitted by the mapper.

- `scripts/mapZones.js` — CLI that reads both candidate JSONs and emits `scripts/data/zones-preview-PA-{01,02}.md`, **grouped by assigned zone**. For each zone, lists every candidate routed to it with their neighborhood, zip, and `pn`. Also emits a summary block:
  - candidate count per zone (to check for empty or over-packed zones)
  - list of unknown zip codes that fell back to the default
  - any candidate whose neighborhood looks inconsistent with the assigned zone (heuristic: the zone name doesn't appear as a substring in the neighborhood name — weak signal, manual review)

npm script: `"map:zones": "node scripts/mapZones.js"`.

QC flow:
```
npm run map:zones           # writes scripts/data/zones-preview-PA-*.md
# review the grouping — does Bristol feel "south," "central," or "north"?
# edit scripts/lib/zipToZone.js to adjust
# re-run
npm run build:bios          # regenerate bios (bios don't reference zone, but keep cadence)
npm run seed:candidates     # dry-run includes the zone each candidate will land in
```

The seeder imports `zipToZone` and uses it to compute each candidate's `zone` field at write time. Deterministic, so the same JSON + same table always produces the same assignment.

**Why:** Zone affects the "My Area" filter in the For You feed and the district map on the home screen. Random assignment would produce a Bristol resident showing up in PA-01's north zone when visually they should be south. A zip-code table is the simplest authoritative rule that maps real geography onto the app's zone model, and the preview tool lets us QC the mapping before any data is written. Future refinements (e.g., more granular zip+neighborhood compound keys) are just edits to the table.

### Decision 7: No Firebase Auth records for seeded candidates

Seeded candidates get Firestore `users/` docs but not real Firebase Auth accounts. They cannot log in. Email fields are synthetic (`seed-pa-01-001@example.com`).

**Why:** These are avatars for beta demo, not real humans. Auth accounts would add auth cleanup complexity and create unused real identities in production Auth.

### Decision 8: Targets live project; no separate dev environment

Per `.firebaserc`, the only configured Firebase project is `party-nomination-app`. There is no dev project. To compensate:

- Seeder runs `--dry-run` by default. Previews: N to create, M to update, K to delete, total Storage bytes to upload.
- Real writes require `--confirm`.
- Deletes require `--allow-deletes` on top of `--confirm`.

**Why:** Seeding is destructive if misconfigured. A dry-run preview is cheap insurance.

### Decision 9: PSA videos are opt-in per candidate, auto-described

Not every candidate will have a PSA. The seeder treats PSAs as a second-class artifact:

- **Discovery**: the seeder globs `assets/candidates/PA-{01,02}-PSA-Videos/*.{mp4,mov,m4v}`. A video is matched to a candidate by filename — e.g., `02-85.mp4` → PA-02 `pn` 85. Candidates without a matching file simply have no PSA doc.
- **Stable ID**: `psaId` = `seed-psa-PA-02-085`. Same upsert-not-recreate semantics as candidates.
- **Auto-extracted fields**: `duration` (via `ffprobe`), `videoUrl` (Storage upload), `thumbnailUrl` (frame grab at ~1s via `ffmpeg`, uploaded to Storage).
- **Auto-generated text** (placeholders):
  - `title` = `"A message from {displayName}"`
  - `description` = `"{displayName} on their priorities for {district}."`
- **Auto-derived `issueIds`**: the candidate's three strongest non-zero quiz answers by `|answer|`. If fewer than three non-zero, fill with the quiz question order.
- **Override via sidecar JSON**: an optional file `{district}-{pn}.meta.json` sitting beside the video can override any of `title`, `description`, `issueIds`, `status`. Example:
  ```json
  {
    "title": "A safer Philly",
    "description": "Diego on transit safety.",
    "issueIds": ["pa02-transit", "welfare"],
    "status": "published"
  }
  ```
- **Status default**: `'published'`. Override via sidecar if we want drafts.
- **Views/likes**: created at 0, runtime-owned thereafter (not touched on re-seed).

**Why:** we have one sample today and may never get more than a handful. Auto-generated defaults mean a new PSA = drop a file, re-seed. The sidecar gives us an escape hatch for high-profile videos where we want crafted copy, without requiring a schema change.

### Decision 10: Content-hash sync for videos, thumbnails regenerated from video hash

Same pattern as avatar images:
- PSA doc stores `videoHash` (SHA-256 of the local mp4).
- On seed: hash match → skip upload; mismatch or missing → upload video, regenerate thumbnail, upload thumbnail, update both URLs.
- Thumbnail is always regenerated when video is re-uploaded — no separate thumbnail hash needed.

**Why:** bandwidth. A 4 MB sample is fine; scaling to a few dozen is still trivial, but re-uploading everything on every seed run is wasteful. Thumbnails regenerate cheaply from the new video.

### Decision 11: Remove ALL existing candidate data and start fresh from the JSON

Product-owner intent: wipe every candidate-shaped doc currently in Firestore and rebuild the entire roster from the JSON files. This includes the original hardcoded 20 AND any in-app-created candidates that may exist from early beta testing. After this plan runs, the only candidates in the system are the 202 from JSON plus any subsequent additions to the JSON. This is explicitly a clean slate.

Cleanup actions, wrapped into the Node seeder behind an explicit `--remove-legacy` flag:

1. Query `candidates/` and `users/` (filtered to `role == 'candidate'`) for every doc whose `id` does not start with `seed-` / `seed-user-`.
2. **Enumerate every affected doc ID in the dry-run output**, grouped by collection, with the candidate's displayName, email (if present), and createdAt timestamp alongside each ID. This is the preview gate — the operator sees exactly what will be deleted before passing `--confirm`.
3. On `--confirm --remove-legacy`: batch-delete the enumerated docs (500 per batch). Related docs that reference these candidates (endorsements, bookmarks, psas, candidateApplications, profileMetrics) are **not** swept by this flag; they become orphaned. Listed as a follow-up below.
4. Dry-run by default, same as every other destructive path.
5. Recommended: run the `gcloud firestore export` backup command from the Scope section before this flag is used the first time.

After the legacy wipe completes (one-time), the in-app `seedCandidates()` function and its hardcoded arrays are deleted from `src/services/firebase/firestore.ts` — along with the `QUESTION_OPTIONS` / `snapVal` helpers that only supported it. `reseedAllData()` keeps working for issues / questions / quiz config (the other three seed calls), just without the candidate slice.

**Orphan sweep (deferred, with audit backing the deferral):** Any endorsements, bookmarks, psas, candidateApplications, or profileMetrics docs referencing the deleted candidateIds will now point to nothing. Deferred from this plan because an audit of every user-facing surface confirms graceful handling:

| Surface | File:line | Behavior on missing candidate | Severity |
|---------|-----------|-------------------------------|----------|
| Endorsements list | `app/(main)/(profile)/endorsements.tsx:131-132, 164, 218` | `.filter(e => e.candidate !== null)` + per-item `if (!item.candidate) return null` | LOW — silently skipped |
| Bookmarks tab | `app/(main)/(profile)/endorsements.tsx:132, 218` | Same filter pattern | LOW — silently skipped |
| Leaderboard | `app/(main)/(leaderboard)/index.tsx` via `getCandidatesWithUsers()` in `firestore.ts:234, 260-261` | Fetches only approved candidates; missing user falls back to `user?.displayName || 'Unknown Candidate'` | LOW — rare + labeled |
| For You feed | `app/(main)/(feed)/index.tsx` via `getCandidatesForFeed()` in `firestore.ts:198, 207-211` | Approved-only fetch; missing user returns `{ candidate, user: null }`, filtered before render | LOW — never hits deleted refs |
| Candidate detail | `src/screens/CandidateDetailScreen.tsx:136, 460-476` | Explicit null check renders `EmptyState` with "Candidate not found" + back button; all deeper reads use `candidate?.bio?.…` optional chaining | LOW — clean fallback |
| Messages / conversations | `app/(candidate)/messages.tsx:94-95, 123` | Participant lookup returns `'Unknown'` for deleted participant IDs; avatar degrades to generic | MEDIUM (cosmetic) — shows "Unknown" but no crash |

No surface crashes on a dangling candidate ref. Leaving orphan docs in place is safe. A `--sweep-orphans` flag remains a possible future cleanup if we want to eliminate the "Unknown" cosmetic cases in messages; no urgency.

**Why:** Product owner explicitly wants a clean slate. The wide-delete filter ("everything not prefixed `seed-`") matches that intent. The dry-run ID enumeration gives the operator a concrete list to eyeball before any destructive action. At beta scale with no production SLA, a clean restart is preferable to carrying forward a mix of legacy + new data.

**Typed confirmation gate:** When `--remove-legacy` AND `--confirm` are combined, the seeder prompts interactively for the operator to type the literal project ID string `party-nomination-app` before proceeding. Mistyping or pressing enter without input aborts with no writes. This defends against muscle-memory shell recalls or a wrong-flag combo — a high-friction barrier exactly at the point where the blast radius is highest.

---

## Implementation Phases

### Phase 1a: Bio builder library + preview CLI (new, comes first)

Three files:
- `scripts/lib/buildBio.js` — pure function `buildBio(candidate, questionSchema)` returning `{ summary, background, reasonForRunning }`. Exported for import by both the seeder and the preview CLI. Deterministic, no I/O, no Firestore.
- `scripts/lib/blocklist.js` — small in-repo blocklist (slurs, profanity, clearly-inappropriate terms). Exports `scanBio(bio) → string[]` returning matched terms (empty array = clean).
- `scripts/buildBios.js` — CLI that reads `scripts/data/candidates-PA-{01,02}.json`, calls `buildBio` for every candidate, runs every field through `scanBio`, and writes `scripts/data/bios-preview-PA-{01,02}.md` plus a stats block at the top of each file. If any bio contains a blocklist match, the CLI exits non-zero and lists the offenders; no preview file is written in that case.

npm script: `"build:bios": "node scripts/buildBios.js"` — add to `package.json`.

Phase 1a gate: the operator reviews both preview files and is satisfied with the wording before moving to Phase 1. If wording needs adjustment, `buildBio.js` is tweaked and `npm run build:bios` is re-run; no Firestore interaction happens.

### Phase 1b: Zone mapping library + preview CLI (new, runs in parallel with 1a)

Two files:
- `scripts/lib/zipToZone.js` — exports `zipToZone(zipCode, district) → zoneId` backed by a hand-authored `ZIP_TO_ZONE` table. Unknown zip codes fall back to a district-level default with a warning.
- `scripts/mapZones.js` — CLI that reads both candidate JSONs, calls `zipToZone` for each, and writes `scripts/data/zones-preview-PA-{01,02}.md` grouped by assigned zone, plus a summary block (count per zone, unknown zips, heuristic neighborhood/zone mismatch warnings).

npm script: `"map:zones": "node scripts/mapZones.js"`.

Phase 1b gate: the operator reviews the zone groupings and is satisfied that candidates are routed to geographically plausible zones. Edits happen in `scripts/lib/zipToZone.js`; re-run `npm run map:zones` until happy.

### Phase 1: Node seeder script (new)

File: `scripts/seedCandidatesFromJson.ts`

Responsibilities:
1. Load both JSON files. Validate required fields; collect `_missingAnswers` warnings.
2. Initialize `firebase-admin` with Application Default Credentials; resolve Storage bucket from `GoogleService-Info.plist` (`party-nomination-app.firebasestorage.app`). Verify `ffmpeg` + `ffprobe` are on `$PATH`; fail fast otherwise.
3. Read existing candidates and PSAs from Firestore; index by deterministic ID prefix `seed-`.
4. If `--remove-legacy`: read non-`seed-` candidate + user docs; build the legacy-wipe plan with full doc-ID enumeration (name, email, createdAt per row).
5. For each JSON candidate, compute plan: `create` | `update` | `skip` (identical). Call `buildBio(candidate)` from Phase 1a to produce bio fields.
6. For each plan item of type `update`/`create`, compute image hash and check against Firestore; plan avatar uploads.
7. Scan PSA video folders. For each video file, compute plan vs. any existing `seed-psa-*` doc; hash-compare video; plan video + thumbnail upload + metadata write. Read optional sidecar JSON for overrides.
8. Print diff summary — broken out as legacy deletes (with full ID list), candidates create/update/delete, avatars upload, PSAs create/update/delete, videos upload (with total bytes). Batch counts shown explicitly so operator can sanity-check against the 500-per-batch Firestore limit.
9. If `--dry-run` (default): exit.
10. If `--confirm`: execute in this order — **build up the new world before tearing down the old**:
    a. Typed-project-ID prompt if `--remove-legacy` is set.
    b. Upload changed avatars.
    c. Upload changed videos + generated thumbnails.
    d. Batch-write user, candidate, and PSA docs.
    e. **Only after** (b–d) succeed: execute the legacy wipe.
    
    Rationale: if any of b–d fails, the process exits with legacy data intact — we're in a transient "both legacy and new candidates visible" state rather than an empty state. Stable `seed-` IDs mean the legacy docs and new docs don't collide. The operator can fix the failure and re-run (idempotent upsert handles partial-create correctly) before the wipe ever runs.
    
    Orphaned Storage uploads (uploads that succeeded before a doc-write failure) are logged with their `gs://` paths at exit so the operator can clean up manually. Future extension: wrap upload+write pairs and auto-delete on failure.

**Batch-overflow guard:** the seeder computes `chunkCount = Math.ceil(docsInPlan / 500)` and logs e.g. `"writing 202 user docs in 1 batch, 202 candidate docs in 1 batch"`. If any single collection's plan exceeds 500 docs, chunking produces multiple sequential batches; if for any reason the chunk math yields `0` when `docsInPlan > 0`, the seeder throws rather than silently writing nothing. The 500 cap is hardcoded since it is Firestore's documented limit; future growth past it is an explicit code change, not a silent truncation.
11. If `--allow-deletes` and orphan `seed-…` docs exist: delete in separate batch.

Flags:
- `--confirm` — actually write
- `--allow-deletes` — also delete orphans (seed-prefixed docs with no JSON entry)
- `--remove-legacy` — also delete pre-existing non-`seed-` candidates + their users (one-time cleanup of the old hardcoded 20)
- `--district PA-01` — run only one district
- `--skip-images` — text-only update, fast path
- `--skip-psas` — skip PSA discovery/upload entirely

Thumbnail generation:
- Extract a single frame at `duration × 0.15` (avoid the first-frame black fade-in), scaled to max 720px on the long edge, JPEG quality ~85.
- Write to a temp file (e.g., `/tmp/amsp-psa-thumb-{psaId}.jpg`), upload to `psaThumbnails/{candidateId}/thumbnail.jpg`, then delete the temp.
- Using `ffmpeg -ss {t} -i video -frames:v 1 -vf scale=…` — one subprocess per video.

### Phase 2: npm scripts

In root `package.json`:

```json
{
  "scripts": {
    "build:bios": "node scripts/buildBios.js",
    "map:zones": "node scripts/mapZones.js",
    "seed:candidates": "ts-node scripts/seedCandidatesFromJson.ts",
    "seed:candidates:apply": "ts-node scripts/seedCandidatesFromJson.ts --confirm"
  }
}
```

`npm run build:bios` and `npm run map:zones` are the preview gates (Phases 1a + 1b). `npm run seed:candidates` is the dry-run; `seed:candidates:apply` is the action.

### Phase 3: Initial seed run

1. Verify Application Default Credentials: `gcloud auth application-default login` if not already set up.
2. Verify `ffmpeg` and `ffprobe` on `$PATH` (`which ffmpeg ffprobe`). Install via `brew install ffmpeg` if missing.
3. **Bio + zone preview:** `npm run build:bios` and `npm run map:zones`. Review both. Iterate on `scripts/lib/buildBio.js` and `scripts/lib/zipToZone.js` until the output is acceptable. No Firestore interaction.
4. **Optional emulator smoke test** (~30 minutes, one-shot). In one terminal: `firebase emulators:start --only firestore,storage --project party-nomination-app`. In another: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npm run seed:candidates:apply`. The seeder auto-detects the emulator env vars and targets it instead of prod. This exercises the full upload + write path on throwaway data; catches class-level bugs (malformed JSON, batch chunking math, ffmpeg subprocess failures, auth-rule oversights) before touching the live project. Skip if time-pressed, but recommended for the very first run.
5. **Backups** (run both):
   - `gcloud firestore export gs://party-nomination-app.firebasestorage.app/backups/$(date +%Y%m%d-%H%M) --project party-nomination-app`
   - `gsutil -m cp -r gs://party-nomination-app.firebasestorage.app/{profilePhotos,psaVideos,psaThumbnails} /tmp/amsp-backup/$(date +%Y%m%d-%H%M)/`
6. `npm run seed:candidates -- --remove-legacy` — inspect planned diff against prod. Expected: full ID list of every non-`seed-` candidate and candidate-role user marked for deletion; 202 candidate creates; 202 avatar uploads; 1 PSA create + video upload + thumbnail upload for Diego Ortiz/PN 85 in PA-02.
7. `npm run seed:candidates:apply -- --remove-legacy` — execute. Prompt asks for the project ID string; type `party-nomination-app` and enter to proceed.
8. Smoke test in iOS simulator: leaderboard populated, For You feed shows new candidates, district filter works on both, Diego Ortiz's PSA plays in the feed with its generated thumbnail.

### Phase 4: Ongoing workflow documentation (this plan acts as the doc)

The "How to edit" workflows below are the operational record of how the JSON-driven flow is expected to be used day-to-day.

---

## Ongoing Workflows

### Edit a candidate's text (name, neighborhood, quiz answer, bio, etc.)

1. Open `scripts/data/candidates-PA-XX.json`.
2. Edit the relevant fields on the candidate. Keep `pn` unchanged — it's the identity key.
3. Run `npm run seed:candidates` to preview the diff.
4. Run `npm run seed:candidates:apply`.
5. Commit the JSON change.

### Swap a candidate's avatar

1. Replace the image at `assets/candidates/PA-XX-Profile-Pics/{filename}` with the new file (keep the same filename, or update `imageFilename` in the JSON if the extension changes).
2. Run `npm run seed:candidates` — hash mismatch triggers an upload plan.
3. Run `npm run seed:candidates:apply`.
4. Commit both the image file and the JSON (if `imageFilename` changed).

### Add a new candidate

1. Assign the next `pn` for that district in the JSON (e.g., PA-01 currently ends at 101, so new candidate is 102).
2. Add the JSON entry with all required fields (see shape at the top of either JSON file).
3. Drop the avatar at `assets/candidates/PA-XX-Profile-Pics/XX-102.png`.
4. Seed.

### Remove a candidate

1. Delete the entry from the JSON.
2. Run `npm run seed:candidates` — will show the candidate in "would delete" but refuse to act.
3. Run `npm run seed:candidates -- --confirm --allow-deletes`.
4. Keep the image file or delete it — irrelevant once the Firestore ref is gone.

### Re-zone candidates after editing the zip table (text-only run)

After editing `scripts/lib/zipToZone.js`, every affected candidate's `zone` field needs to be re-written in Firestore — but avatars and videos shouldn't be re-uploaded.

1. `npm run map:zones` — confirm the new grouping in the preview file.
2. `npm run seed:candidates -- --skip-images --skip-psas` — dry-run; shows every affected candidate doc as an `update` with no avatar/PSA uploads planned.
3. `npm run seed:candidates:text` — convenience alias for `--confirm --skip-images --skip-psas`. Writes only the Firestore candidate docs with new `zone` values; photos and PSAs stay untouched.

Hash-diff upload logic is skipped entirely on this path, so even if image files changed on disk, this workflow never re-uploads them. Use `seed:candidates:assets` (below) for asset-only runs.

### Batch-upload new or changed assets (image or video) without re-writing bios

After dropping a new avatar (or replacing an existing one), or dropping a new PSA video:

1. `npm run seed:candidates -- --skip-psas` — dry-run that will show which avatar hashes changed. (Use no `--skip-psas` to also include PSAs.)
2. `npm run seed:candidates:assets` — convenience alias for `--confirm --skip-psas`. Uploads changed avatars, updates the candidate doc's `photoUrl` + `photoHash`, and rewrites the full seed-owned field set (so it picks up any concurrent JSON edits too). PSAs are skipped; use the unskipped form for PSA-only or full-asset runs.

Hash-diff means this is cheap — unchanged avatars are identified by local SHA-256 vs. the stored `photoHash` and skipped.

### Regenerate JSON from CSV (rarely)

Only needed if the upstream spreadsheet is revised and you want to reset the JSON. The script `scripts/convertCandidatesCsv.js` is idempotent — runs clobber the JSON with CSV-derived content, destroying any manual JSON edits. Don't run casually; prefer editing the JSON directly.

### Add a PSA video for a candidate

1. Drop the file at `assets/candidates/PA-XX-PSA-Videos/{district}-{pn}.mp4` (e.g., `02-85.mp4`). Other container formats (`.mov`, `.m4v`) are also accepted.
2. (Optional) Drop a sidecar `{district}-{pn}.meta.json` alongside to override the auto-generated title/description/issueIds.
3. `npm run seed:candidates` — preview shows a PSA create + one video upload + one thumbnail upload.
4. `npm run seed:candidates:apply`.
5. Commit the video file (and sidecar if any).

### Swap a PSA video

Replace the file (keep the same filename) and re-seed. Video hash mismatch triggers re-upload; thumbnail is regenerated from the new video automatically.

### Edit PSA text (title, description, issueIds) without re-uploading video

1. Create or edit the sidecar `{district}-{pn}.meta.json` next to the video.
2. Seed. The video hash is unchanged, so no upload; only the PSA Firestore doc is updated with the new metadata.

### Remove a PSA

Delete the video file (and sidecar if any) from the folder. Run `npm run seed:candidates:apply -- --allow-deletes`. The `seed-psa-…` doc is removed; the candidate remains.

---

## Edge Cases and Follow-ups

- **PN 18 (Joseph White) missing `borders-1` answer.** Resolved: the seeder substitutes the center-option spectrum value (`0` for `borders-1`, paired with `optionShortLabel: "Partially Close"`) whenever a JSON quiz response has `answer: null`. This matches the "no strong position" semantics the middle option represents in every 3-option question and keeps the response array complete. If more null answers appear in future data drops, the same rule applies to any 3-option question; for binary questions (Y/N), a null answer would trigger a hard error since there's no neutral middle option.
- **Zone assignment.** Resolved via Decision 13 + Phase 1b. A hand-authored zip→zone table in `scripts/lib/zipToZone.js` drives the assignment; `npm run map:zones` emits a preview file grouped by zone so the mapping is QC'd before any Firestore write. Unknown zip codes fall back to a documented default and are called out in the preview for follow-up.
- **`topIssues` derivation.** The `Candidate` doc requires `topIssues: TopIssue[]` (3 items with issueId, position text, spectrumPosition). Nothing in the CSV maps to this directly. For now, derive from the candidate's 3 strongest-spectrum quiz answers — pick the three questions whose `|answer|` is largest, use the answer as `spectrumPosition`, use the question's option `shortLabel` as `position`. Good enough to populate leaderboard spectrum averages; editable later by hand in JSON if we add a `topIssues` field explicitly.
- **Removal of all legacy candidate data.** Resolved via Decision 11 and the `--remove-legacy` flag. The clean-slate wipe targets every non-`seed-` candidate and candidate-role user, with full doc-ID enumeration in the dry-run preview. Runs once as part of the first seeder execution, followed by deletion of the hardcoded arrays and helpers in `firestore.ts`. Orphan endorsements / bookmarks / psas / candidateApplications / profileMetrics referencing the deleted candidates are deliberately left alone (the app should be tolerant of missing candidate refs); a `--sweep-orphans` follow-up is a future decision.
- **Image format consistency.** All 202 avatars are PNG. Seeder should still handle JPG correctly in case future additions use a different format (use the file extension from `imageFilename`).
- **Production Storage quota.** 202 images × ~40KB each ≈ 8MB. Videos are larger (the sample is 4 MB for 5 s) — a few dozen PSAs is still well under a gig. Negligible at current scale.
- **Permission rules.** Storage rules `profilePhotos/{userId}/`, `psaVideos/{candidateId}/`, and `psaThumbnails/{candidateId}/` all gate writes by owner/authenticated. The Node seeder uses Admin SDK which bypasses rules — no change needed. In-app reads (authenticated users) continue to work per existing rules.
- **ffmpeg/ffprobe dependency.** Required only on the host running the seeder, not in the app or CI. The seeder errors out with a clear install hint if either is missing.
- **Unmatched PSA video.** If a video filename doesn't correspond to any known `pn` (e.g., `02-999.mp4`), the seeder logs a warning and skips. Doesn't fail.
- **Candidate-less PSA edge case.** If a candidate is later removed from JSON but their PSA video is still on disk, the next run plans to delete both the candidate and the orphaned PSA doc. The video file on disk is left alone for humans to clean up.
- **Portrait vs. landscape videos.** The sample is 544×720 (portrait). Thumbnail scaling clamps the long edge to 720px — works for either orientation without forcing aspect change.
- **Cloud Functions trigger audit (done).** Existing triggers listen on: `endorsements/{id}` (create + delete), `candidateApplications/{id}` (create), and Firebase Auth user lifecycle. **None** listen to `users/{id}`, `candidates/{id}`, or `psas/{id}` — the collections the seeder writes to. Running the seeder will not fan out notifications, emails, or leaderboard rebuilds. If new triggers are added on those collections later, this plan should be revisited.
- **Missing avatar file.** If `imageFilename` is referenced in JSON but the file is absent on disk, the seeder fails that candidate loudly with the exact missing path and continues with the rest (does not abort the whole run). Missing avatars are never silently skipped.
- **Missing PSA video sidecar.** Sidecars are optional; absence is not an error. Malformed sidecar JSON (parse error) fails that PSA only and logs the path.
- **First-run hash catch-up.** Existing docs with no `photoHash` / `videoHash` will be treated as "needs upload" on the first run after this plan ships. Expected, one-time, then steady-state.

---

## Resolved Questions

All previously-open questions have been answered. Recording the resolutions here for the record:

- **PSA coverage** — only candidates with a matching video file get a PSA. No expectation of full coverage. Resolved via Decision 9.
- **PSA title/description source** — auto-generated placeholders with optional sidecar JSON overrides. Resolved via Decision 9.
- **Thumbnails** — auto-extracted from the video via ffmpeg at ~15% into the clip. Resolved via Decision 10 and the Phase 1 spec.
- **Duration** — read from ffprobe output. Resolved via the Phase 1 spec.
- **PN 18 missing `borders-1` answer** — substitute the center-option spectrum value (`0`, `"Partially Close"`). Resolved via Decision 6 / Edge Cases.
- **Initial endorsement counts** — seed from the CSV's `afterTop20` column on first create; runtime-owned thereafter. Resolved via Decision 5.
- **Legacy 20 hardcoded candidates** — remove via the seeder's `--remove-legacy` flag, then strip the hardcoded arrays from `firestore.ts`. Resolved via Decision 11.
- **Bio and `reasonForRunning`** — auto-generate deterministically via the new `buildBio()` function (Decision 6 + Decision 12). Ethnicity is available as modeling context but never written into prose. A standalone `npm run build:bios` preview step lets product review all 202 bios before any Firestore write.
- **Bio preview / review loop** — introduced explicitly as Phase 1a and Decision 12. `scripts/buildBios.js` writes `bios-preview-PA-{01,02}.md` files for human review; iterate on `scripts/lib/buildBio.js` until satisfied.
- **`endorsementCount` semantics** — verified: running counter that increments/decrements with create/delete endorsement triggers. Pre-seeded `afterTop20` value acts as a baseline; beta activity accumulates on top. No downstream distortion. Decision 5.
- **Orphan sweep for deleted legacy candidates** — deferred, backed by a UI audit (see Edge Cases) showing all user-facing surfaces handle dangling refs without crashing. Cosmetic "Unknown" label only appears in the messages screen for deleted conversation participants.
- **Zone assignment** — deterministic via zip→zone table (Decision 13 + Phase 1b), QC'd via `npm run map:zones`.
- **Profanity / sensitive-phrase guard on bios** — blocklist check in `scripts/lib/blocklist.js` runs in both the preview CLI and the seeder. Any match fails the preview/seed run loudly.
- **Typed project-ID confirmation for legacy wipe** — added to Decision 11. Interactive prompt blocks the most-destructive flag combination behind a friction gate.
- **Optional Firestore emulator smoke test** — added as Phase 3 step 4. Skippable but recommended for the first live run.
- **Storage backup** — documented one-liners for `profilePhotos`, `psaVideos`, `psaThumbnails` prefixes via `gsutil -m cp -r` in the Scope section.
- **Batch-overflow guard** — explicit Math.ceil chunking with a hard throw on pathological cases; see Phase 1 step 10.

With those resolved, nothing blocks the implementation of Phase 1 (the Node seeder script).

---

## Execution Log

### 2026-04-19 — Initial live seed against `party-nomination-app`

Sequence executed per Phase 3:

1. **ADC setup** — `gcloud auth application-default login` completed with `info@digitaldemocracyproject.org`; ADC file written to `~/.config/gcloud/application_default_credentials.json`. Quota project set to `party-nomination-app`.
2. **Temurin JDK installed** — required for Firebase emulators (`brew install --cask temurin` → `openjdk 26 Temurin-26+35`).
3. **Emulator smoke test** — `firebase emulators:start --only firestore,storage --project party-nomination-app` + seeder `--confirm --remove-legacy`. Result: 202 candidate + 202 user + 1 PSA creates, 202 avatar + 1 video + 1 thumbnail uploads, all fields verified (photoUrl, photoHash, zone, endorsementCount baseline, bio prose) before tearing down.
4. **Backup bucket created** — `gcloud storage buckets create gs://party-nomination-app-backups --location=us-central1 --project=party-nomination-app` (us-east1 live bucket rejected by Firestore exports).
5. **Pre-apply Firestore export** — `gs://party-nomination-app-backups/20260419-2032`.
6. **Prod dry-run** — `npx ts-node scripts/seedCandidatesFromJson.ts --remove-legacy`. Plan: 202 creates, 202 avatar uploads, 1 PSA + video + thumbnail upload, 552 legacy deletes (24 candidate docs + 528 candidate-role user docs, all `@example.com` synthetic from prior in-app reseed runs across Jan–Mar 2026).
7. **Prod apply** — `echo "party-nomination-app" | npx ts-node scripts/seedCandidatesFromJson.ts --confirm --remove-legacy`. Typed confirmation matched; execution order: creates+uploads first, legacy wipe last. All steps reported "Done." without errors.
8. **Post-apply verification** — `candidates: 202 (all seed)`, `users: 274 (202 seed + 72 non-candidate-role preserved)`, `psas: 1`. Sample PN 1 Maria Smith: photoUrl resolves, zone=`pa01-south`, endorsementCount=3168, bio.summary="Maria Smith, 25, an electrician from Bristol." PSA `seed-psa-PA-02-085` duration=5s, title="A message from Diego Ortiz".
9. **iOS simulator smoke test** — Leaderboard shows #1 Maria Smith (3.2K), #2 Scott Foster (2.8K), #3 Pat King (2.7K), #4 Gary Gonzalez (2.6K). For You feed renders full-screen Storage-hosted avatars, alignment match computed from new `questionnaireResponses`, "Endorse all 50" mass-endorse button appears on My Issues filter.

No failures, no rollback needed. Cloud Functions trigger audit held: `onEndorsementCreate/Delete`, `processApplication`, and auth lifecycle triggers did NOT fire during the run (none listen on users/, candidates/, or psas/).

Artifacts of this run:
- Firestore backup: `gs://party-nomination-app-backups/20260419-2032`
- Local backup (not run): `/tmp/amsp-backup/` — skipped per dev-beta posture; the live bucket wasn't modified on a read path.

### Post-run cleanup (in-app seeder removal)

Still pending as a follow-up PR:
- Delete `seedCandidates()` and its hardcoded 20-candidate array from `src/services/firebase/firestore.ts`.
- Delete the `QUESTION_OPTIONS` / `snapVal` helpers that only supported it.
- `reseedAllData()` continues to work for issues / questions / quiz config (the other three seed calls); drop the candidate slice only.

Low priority — nothing calls `seedCandidates()` at runtime in normal use; the Node seeder is the exclusive path for the roster going forward.
