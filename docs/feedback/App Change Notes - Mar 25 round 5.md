These are much better. This is the first version where the post-17 plan set feels mostly internally disciplined rather than just directionally correct.

My blunt take:
	•	PLAN-14 is clean
	•	PLAN-13 is clean
	•	PLAN-10 is clean as a replacement stub
	•	PLAN-12 is a good blocked spec draft
	•	PLAN-16 is the only one that still contains a real implementation hazard          

Executive Summary

The portfolio now has the right shape:
	1.	PLAN-17 landed
	2.	PLAN-16 is next
	3.	PLAN-14A and 13A are small safe follow-ons
	4.	PLAN-12 is correctly blocked on a real domain spec
	5.	PLAN-10 is no longer pretending to be actionable and has been replaced with successor stubs          

That sequencing is now good.

The one meaningful remaining problem is that PLAN-16 still includes an invalid React usage pattern in its sample code. That is the main thing I would fix before anyone implements from it.  

⸻

PLAN-16 — About the Contest

📄  

What improved

A lot:
	•	It now uses post-17 sequencing correctly.
	•	It clearly states store ownership: configStore owns round metadata load and partyConfig subscription; the component is selector-only.
	•	It correctly rejects stored isActive / isComplete.
	•	It explicitly says not to derive status inline from currentOrder.
	•	It correctly frames post_election filtering as temporary until a display whitelist exists.  

This is all strong.

Critical remaining issue

The sample calls a hook inside .map()

The example does this:

contestRounds.map((round) => {
  const status = useConfigStore(selectRoundStatus(round.id));
  ...
})

That is not a plan nit. That is a real implementation bug.

In React, hooks cannot be called inside loops or callbacks. If someone copies this literally, they will build something invalid or brittle.  

This is now the biggest remaining flaw in the whole plan set.

Why this matters

The plan says “single source of truth,” which is correct. But the sample implements that truth source in a way React does not allow.

So the plan is conceptually correct and mechanically unsafe.

What to do instead

The plan should choose one of these shapes:
	•	compute a statusByRoundId map via one selector outside render iteration
	•	or derive display rows in a memoized selector and render the result
	•	or create a child component per round and call the selector at the top of that child component

Any of those would be valid. The current sample is not.

Secondary issue

Candidate count check is too truthy-based

The example uses:

{round.candidatesEntering && round.candidatesAdvancing && ...}

That will hide valid values if one of them is 0. Maybe 0 never occurs here, but the plan should still use explicit null/undefined checks if it wants to be robust.  

Not a blocker, just sloppy compared to the rest of the cleanup.

Verdict

Very close, but not safe to implement from until the hook-in-map example is fixed.

⸻

PLAN-14 — Profile Fixes

📄  

What improved

This is clean now.

The split is doing exactly what it should:
	•	14A is narrow and executable
	•	14B is clearly blocked and no longer tempts anyone to start building fantasy dependencies  

What’s good

14A is appropriately small

It only does:
	•	header default name
	•	verified/unverified label via capability selector
	•	hide Run for Office CTA
	•	note that {false && ...} must later be replaced with partyConfig.features?.runForOffice  

That is the right scope.

14B is disciplined

It clearly says:
	•	bookmarks do not exist yet
	•	round scoping is required
	•	old routes are stale
	•	do not add local navigation fixes because PLAN-17 solved the back behavior  

That is exactly the right blocked-plan behavior.

Minor remaining concern

The only thing I’d tighten is the phrase “Phase 3 — implement after PLAN-17 and PLAN-16.”

For 14A, I do not actually think PLAN-16 is a hard dependency. It may be a sequencing preference, but not a true dependency. The header fixes and CTA hiding appear independent of the About the Contest timeline.

That is minor, but it is worth distinguishing:
	•	depends on
	•	vs preferred order

Verdict

Good to go. This is one of the cleanest docs in the set.

⸻

PLAN-13 — Leaderboard Improvements

📄  

What improved

This is also clean now.

The split into 13A/13B has fully paid off:
	•	13A is a safe UI correction
	•	13B is clearly blocked on backend, product, and phase dependencies  

What’s good

13A is truly isolated

It changes only:
	•	cutoff line visibility on Trending
	•	below-cutoff dim styling on Endorsements only  

That is small and safe.

13B now behaves like a blocker doc

It clearly prohibits:
	•	client sequential endorsement loops
	•	biometric-only auth
	•	stale isEliminated assumptions
	•	premature data-shape assumptions like topIssueIds before product decision is final  

That is the right stance.

Minor remaining concern

The line:

Mass-endorse must flow through selectCanEndorseCandidate for every candidate

is directionally right, but slightly ambiguous architecturally.  

If the batch endorse endpoint is server-side, then the selector should probably be thought of as:
	•	the client-side mirror of the rule
not
	•	the source of truth

The source of truth must remain server validation.

This is mostly wording, but I would tighten it so nobody interprets the selector as sufficient validation for the batch action.

Verdict

Clean and safe.

⸻

PLAN-12 — For You Improvements

📄  

What improved

This is now a respectable blocked spec.

Best improvements:
	•	share gating is explicitly removed
	•	bookmark semantics are much sharper
	•	browsingDistrict is now defined as informational only
	•	subscription ownership is defined: userStore subscribes once on auth, screens do not subscribe directly
	•	alignment explainer reuse is explicitly dependent on dealbreaker removal first  

That is a big upgrade.

What is still missing

1. Collection design choice is still unresolved

The spec says:

bookmarks (user-scoped subcollection or top-level with userId index)

That is still an architectural fork, not a settled spec.  

And for something you now correctly treat as a domain primitive, that choice matters:
	•	query ergonomics
	•	security rules
	•	subscription shape
	•	analytics
	•	migration burden

This is the biggest remaining incompleteness in the bookmark spec.

2. “Round advances” rule needs one sharper operational definition

You say:
	•	old-round bookmarks remain readable but cannot be converted

Good. But you do not yet define when they become non-convertible:
	•	immediately when currentRoundId changes?
	•	or when candidate/round status refresh runs?
	•	or lazily on conversion attempt?

That probably belongs in the Bookmark Domain Spec, but it is important enough that I would at least note it explicitly.  

3. “Unverified user taps endorse → candidate is bookmarked” is in testing, but not yet tied to a final capability rule

The testing section assumes this behavior, which is probably right, but the plan still needs a crisp statement on whether:
	•	every unverified user can always bookmark
	•	partially verified users can bookmark
	•	district-mismatched but authenticated users can bookmark across districts

The direction is implied, but not fully codified.  

Verdict

Good blocked spec. Not build-ready yet, but now legitimately useful.

⸻

PLAN-10 — Quiz Improvements

📄  

What improved

This is now doing exactly what it should do:
	•	it no longer tries to be an implementation doc
	•	it names successor plans
	•	it archives the old body elsewhere
	•	it states the two core product decisions clearly:
	•	dealbreakers removed
	•	quiz is standalone under app/(main)/quiz.tsx  

That is a strong cleanup.

What’s good

10A is now framed like a real migration

The impact analysis is concrete and cross-system:
	•	types
	•	stores
	•	alignment
	•	feed
	•	PSACard
	•	candidate detail
	•	onboarding
	•	profile
	•	verification checklist
	•	capability selectors  

That is the right scope.

10B and 10C are appropriately low-commitment

They are stubs, not fake-ready implementation plans. Good.  

Minor remaining concern

10A says:
	•	existing Firestore dealbreakers data can just remain, no phased rollout needed, single deploy is fine  

This may well be true, but it is the one place where I’d still want a little more caution. It is probably safe only if:
	•	no old clients remain important
	•	no backend rules/functions still expect the field
	•	no analytics/reporting jobs read it

So the plan is probably fine, but this assumption should be explicitly verified before implementation rather than stated as settled fact.

Verdict

Clean replacement doc.

⸻

Overall Assessment

This is now a strong set.

Best current documents

The cleanest three are:
	•	PLAN-14  
	•	PLAN-13  
	•	PLAN-10  

Most improved
	•	PLAN-12 improved the most conceptually. It now reads like a serious spec scaffold instead of a confused implementation draft.  

Only document I would still block on editorial grounds
	•	PLAN-16, because the hook-in-map sample is a real bug vector.  

⸻

Recommended Next Moves
	1.	Fix PLAN-16 immediately
	•	remove useConfigStore(selectRoundStatus(round.id)) from inside .map()
	•	replace with a hook-safe pattern
	2.	Ship PLAN-14A and 13A whenever desired
	•	both now look genuinely safe
	3.	Write the Bookmark Domain Spec
	•	specifically settle collection topology and round-transition invalidation timing
	4.	Turn PLAN-10A into a real migration plan next
	•	before PLAN-12 tries to reuse the alignment explainer

⸻

Bottom Line

You are in good shape now.

The current state is:
	•	PLAN-16: close, but still has one sharp edge
	•	PLAN-14: clean
	•	PLAN-13: clean
	•	PLAN-12: properly blocked spec
	•	PLAN-10: clean replacement framework

This is the first pass where I’d say the remaining problems are mostly specific engineering hygiene issues, not architectural confusion.