Here’s a direct, critical review across the plans, focusing on architecture integrity, sequencing risk, and where things will break if implemented as-is.

⸻

🔴 Executive Summary (Blunt)
	•	PLAN-17 is the only truly implementation-ready plan
	•	PLAN-16 is close but has a model mismatch (easy fix)
	•	PLAN-13 / PLAN-12 / PLAN-14 are conceptually right but structurally unsafe right now
	•	PLAN-10 (quiz) is actively dangerous to implement

Big picture:

You’ve got a strong architecture direction (PLAN-00 + PLAN-17), but several feature plans are still written against older mental models (pre-round system, pre-unified navigation, pre-bookmark system).

⸻

🟢 PLAN-17 (Unified App Shell)

📄  

✅ What’s excellent

This is solid, senior-level navigation architecture:
	•	Correct use of Expo Router grouping ((main) vs (auth))
	•	Fixes the root cause of your earlier bug:
❗ “never wrap <Tabs> in a <View>” — this is exactly right
	•	Smart duplication pattern:
	•	Candidate detail under both (feed) and (leaderboard) = correct tab context preservation
	•	Clean separation:
	•	Browsing vs candidate flows → 👍

⚠️ Risks / Gaps

1. Route duplication = future drift risk

You now have:

(feed)/candidate/[id]
(leaderboard)/candidate/[id]

Same screen, two locations.

👉 Risk:
	•	One gets updated, the other doesn’t
	•	Analytics / tracking divergence

Recommendation:
Abstract shared screen:

src/screens/CandidateDetailScreen.tsx

Then both routes import it.

⸻

2. Quiz inconsistency (you contradict PLAN-10)
	•	PLAN-17: quiz = hidden tab inside (main)
	•	PLAN-10: quiz = onboarding flow

👉 This is already conflicting.

Recommendation:
Lock this now:
	•	Quiz is standalone, not onboarding
	•	Treat as tool, not gate

⸻

3. Deep link ambiguity

You say:

“Deep link to candidate detail shows correct tab bar state”

But you haven’t defined:
	•	Which tab becomes active on deep link?

👉 This will break.

Recommendation:
Define explicitly:

Entry Source	Tab
Unknown / deep link	(feed) default
Explicit param	use it


⸻

4. State coupling in AppHeader

You’re pulling:
	•	selectedBrowsingDistrict
	•	currentRoundLabel

👉 Good—but:
	•	No memoization strategy
	•	No loading state handling

Risk:
Header re-renders constantly → perf issues

⸻

Verdict

✅ Ship this first. Everything else depends on it.

⸻

🟡 PLAN-16 (About the Contest)

📄  

✅ What’s strong
	•	Correct direction: Firestore-driven timeline
	•	Great UX concept (timeline + voting method explanation)
	•	Aligns with PLAN-00 philosophy (global state)

⸻

🔴 Critical Issues

1. You’re still using rejected data model

You explicitly note:

uses isActive / isComplete

But PLAN-00 rejects that.

👉 This is a hard blocker, not a minor issue.

⸻

2. Data model gap (this is bigger than you flagged)

You need:
	•	labels
	•	voting method
	•	candidate counts
	•	descriptions

But current model only has:
	•	label
	•	shortLabel

👉 You have presentation requirements without schema support

⸻

3. Real-time dependency risk

You rely on:
	•	Firestore updates
	•	selectors

👉 If configStore isn’t stable:
	•	timeline flickers
	•	incorrect states

⸻

Recommendation

This is fixable by:
	•	Use:

selectRoundStatus(roundId)


	•	Add either:
	•	description to ContestRound
OR
	•	static map (better for now)

⸻

Verdict

🟡 Implement after PLAN-17 + small schema decision

⸻

🔴 PLAN-13 (Leaderboard)

📄  

🚨 Major Problems

1. Mass endorse = architecturally wrong

You already caught it, but it’s worse:
	•	Client loop:

for (...) await endorseCandidate()



👉 This will:
	•	partially succeed
	•	create race conditions
	•	corrupt state

This must be a backend operation.

⸻

2. Authorization model is inconsistent

You’re mixing:
	•	biometric auth
	•	verification rules
	•	endorsement eligibility

👉 These must be unified under:

selectCanEndorseCandidate


⸻

3. Filtering source conflict

You identified it:
	•	For You = quiz issues
	•	PLAN-09 = broader filters

👉 This is a product decision not resolved

⸻

4. Future model mismatch

You still reference:
	•	isEliminated

But system is moving to:
	•	contestStatus

⸻

Verdict

🔴 Do NOT implement yet

Needs:
	•	backend batch endpoint
	•	finalized filtering model
	•	round-aware endorsement logic

⸻

🔴 PLAN-12 (For You)

📄  

🚨 This is deceptively risky

1. Bookmark system is undefined

You asked the right questions—but they are not optional:
	•	round-scoped?
	•	district-scoped?
	•	persists across verification?

👉 This is core domain logic, not UI detail.

⸻

2. Share gating is product-hostile

You said:

require verification to share

👉 This contradicts:
	•	growth mechanics
	•	rest of product (low-friction browsing)

This will:
	•	reduce virality
	•	feel arbitrary

⸻

3. Dealbreaker dependency conflict

This plan depends on:
	•	dealbreakers

PLAN-10:
	•	deletes them

👉 Direct contradiction.

⸻

4. Store-only bookmarks = broken persistence

You proposed:

userStore.bookmarks

👉 This fails:
	•	across sessions
	•	across devices
	•	after verification

⸻

Verdict

🔴 Block until product decisions made

This is not an implementation plan yet—it’s a spec draft.

⸻

🟡 PLAN-14 (Profile Fixes)

📄  

✅ Good
	•	UX improvements are solid
	•	Separation of endorsed vs bookmarked = correct direction

⸻

⚠️ Issues

1. Depends on nonexistent system (bookmarks)

You’re building UI for:
	•	PLAN-12 (not implemented)
	•	undefined data model

⸻

2. Verification model is outdated

Uses:

verificationStatus === 'verified'

But system is:
	•	multi-axis verification

⸻

3. Navigation fix is already solved by PLAN-17

You correctly flagged this.

⸻

Verdict

🟡 Partially implementable

Safe now:
	•	header fixes
	•	name/initials

Defer:
	•	endorsements redesign

⸻

🔴 PLAN-10 (Quiz)

📄  

🚨 This plan will break your app

1. Completely outdated architecture
	•	assumes onboarding quiz
	•	ignores standalone quiz (PLAN-03)

⸻

2. Massive cross-system impact

Removing dealbreakers affects:
	•	alignment engine
	•	filters
	•	onboarding
	•	UI copy
	•	multiple plans

👉 This is a product-level migration, not a feature tweak.

⸻

3. Scope explosion

You’re mixing:
	•	navigation changes
	•	data model changes
	•	UX grouping
	•	feature removal

👉 This should be split into 3–4 plans.

⸻

Verdict

🔴 Do NOT implement

Needs full rewrite aligned to:
	•	standalone quiz
	•	final decision on dealbreakers

⸻

🧭 Recommended Execution Order

If you want this to actually land cleanly:

Phase 1 (Foundation)
	1.	✅ PLAN-17 (App shell)
	2.	🟡 PLAN-16 (fixed to selectors)

⸻

Phase 2 (Data model decisions)
	3.	❗ Decide:
	•	bookmarks model
	•	issue filtering source
	•	dealbreakers fate

⸻

Phase 3 (Features)
	4.	🟡 PLAN-14 (partial)
	5.	🔴 PLAN-13 (after backend batch endpoint)
	6.	🔴 PLAN-12 (after bookmark spec)

⸻

Phase 4
	7.	🔴 Rewrite PLAN-10 completely

⸻

🧠 Final Insight (Most Important)

You’ve crossed a key threshold:

You are no longer building screens — you are building a stateful political system with temporal rules (rounds, eligibility, progression).

That means:
	•	UI plans must follow domain model, not lead it
	•	Any ambiguity in:
	•	rounds
	•	eligibility
	•	bookmarks
👉 will create cascading bugs everywhere

⸻
