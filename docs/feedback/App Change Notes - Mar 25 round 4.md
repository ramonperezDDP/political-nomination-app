These revisions are a real improvement. The set is now much cleaner, and the biggest win is that the blocked plans are starting to behave like blocked plans instead of half-approved implementation docs.

That said, there are still a few places where the document header is smarter than the implementation body.

⸻

Executive Summary
	•	PLAN-16 is now close to truly actionable, but still has one important inconsistency in how it derives round state.  
	•	PLAN-14 is much better after the split. This is the cleanest rewrite in the batch.  
	•	PLAN-13 is also much better after the split. The safe part is now safely isolated.  
	•	PLAN-12 is now correctly framed as a spec draft, which is the right move, but it still needs one more level of precision before anyone writes code from it.  
	•	PLAN-10 is now safely quarantined, but it still needs to be rewritten into replacement plans rather than preserved as a stale monolith with warnings on top.  

Overall: this is the first version where I would say the portfolio is becoming execution-safe.

⸻

PLAN-16 — About the Contest

📄  

What improved

This plan is meaningfully better now:
	•	It is clearly sequenced after PLAN-17
	•	It explicitly rejects stored isActive / isComplete
	•	It recognizes the presentation-data gap and chooses the right near-term solution: static presentation map in code
	•	It adds a useful stability rule:
	•	contest round metadata fetched once
	•	currentRoundId updates in real time

Those are all the right moves.  

Remaining issues

1. It still says “use selectRoundStatus(roundId),” but the example does inline derivation

The review notes correctly say the rendering logic should be rewritten around selectRoundStatus(roundId), but the example still does this:
	•	find currentRoundId
	•	derive currentOrder
	•	compute isActive
	•	compute isPast

That is not wrong in principle, but it weakens the plan. The whole point of calling out selectRoundStatus(roundId) is to avoid multiple ad hoc derivations across screens.  

Why this matters:
If this screen derives state inline while another screen uses the selector, you create two sources of truth for the same concept.

Recommendation:
Choose one and enforce it. I would strongly prefer:
	•	selectContestTimeline
	•	selectRoundStatus(roundId)

and remove the inline currentOrder logic from the sample entirely.

⸻

2. “Fetched once” needs a stronger statement of ownership

The plan says round config is fetched once from Firestore on app init, while currentRoundId updates in real time. That is a sensible model. But the plan does not say who owns that fetch/subscription boundary.  

Right now the reader could interpret this in two ways:
	•	VoterHome fetches metadata once locally
	•	the store loads metadata once and the component only selects

Those are very different architectures.

Recommendation:
Add one line:
	•	configStore owns round metadata load + partyConfig subscription; VoterHome is selector-only

That would make this plan substantially safer.

⸻

3. Hidden-round policy is still only partially normalized

You improved this by adding:
	•	hide post_election
	•	if more hidden rounds appear, use a display whitelist

That is better than the old inline special-case. But it is still halfway between policy and implementation.  

Recommendation:
Either:
	•	convert now to a display whitelist in the example
	•	or explicitly say “temporary special case until display whitelist is added”

⸻

Verdict

Close to ready.
This is now the strongest non-PLAN-17 document, but I would still make one cleanup pass so the code sample uses selectRoundStatus(roundId) directly and the ownership of fetch/subscription is explicit.

⸻

PLAN-14 — Profile Fixes

📄  

What improved

This is a strong rewrite.

The split into 14A / 14B was absolutely the right move:
	•	14A = safe, small, executable
	•	14B = clearly blocked with prerequisites listed

That is exactly how this should have been decomposed.  

What’s good now

1. The ready-to-ship part is genuinely ready-to-ship

14A is narrow and sane:
	•	default name → “Your Name”
	•	verification label via selectFullyVerified
	•	hide Run for Office CTA

That is the correct level of ambition for this phase.  

2. The blocked section now stops pretending

14B explicitly says:
	•	do not implement original code
	•	bookmarks do not exist yet
	•	routes will change under PLAN-17
	•	endorsements need round scoping

That is a major improvement in document integrity.  

Remaining issues

1. 14A still points to pre-PLAN-17 file paths

14A still names:
	•	app/(tabs)/profile.tsx

Since PLAN-17 is being implemented now, this path may become stale very soon depending on whether the profile route has already moved into the new structure.  

Recommendation:
Since the plan already says “implement after PLAN-17 and PLAN-16,” update the file references to the expected post-17 location, or say:
	•	“file path to be updated once PLAN-17 route migration lands”

Otherwise a future implementer may edit the wrong screen.

⸻

2. {false && ...} is still acceptable short-term, but the doc should be stricter about replacement

You correctly note the long-term need for a real feature flag in partyConfig. That is good. But this is exactly the kind of temporary hack that tends to become permanent.  

Recommendation:
Change the wording from “longer-term” to:
	•	“must be replaced with partyConfig.features?.runForOffice before beta exits”

That makes it a migration requirement, not a nice-to-have.

⸻

Verdict

Best rewrite in the batch.
14A is now small and shippable. 14B is properly blocked. Only minor path/flag cleanup remains.

⸻

PLAN-13 — Leaderboard Improvements

📄  

What improved

This also improved a lot.

Splitting into 13A / 13B was exactly right:
	•	13A = tiny UI correction
	•	13B = domain-heavy blocked work

That was the correct structural fix.  

What’s good now

1. 13A is actually safe

It does one thing:
	•	hide cutoff line on Trending
	•	keep cutoff treatment on Endorsements

That is a clean, isolated fix.  

2. 13B now clearly rejects the bad patterns

It explicitly blocks:
	•	client-side sequential endorsement loop
	•	biometric-only auth
	•	stale isEliminated model

That is exactly what needed to happen.  

Remaining issues

1. 13A may become stale under PLAN-17 route migration

Like PLAN-14, 13A still references:
	•	app/(tabs)/leaderboard.tsx

If PLAN-17 is actively landing, that path may change.  

This is not a conceptual problem, just an execution hazard.

Recommendation:
Add:
	•	“target file path may shift under PLAN-17 route migration; apply change to the leaderboard screen in its post-migration location”

⸻

2. The data-enrichment note in 13B is still slightly underspecified

You correctly preserve:
	•	topIssueIds: string[]
	•	populated from topIssues in getCandidatesWithUsers()

That is good, but if 13B is now blocked on the filter model, then the data note should be framed as tentative rather than assumed.  

Why? Because depending on the final filter decision, the leaderboard may need:
	•	user-selected issue matches
	•	candidate top issues
	•	both
	•	or precomputed match metadata

Right now the plan still leans toward one implementation shape before the product decision is final.

Recommendation:
Reword to:
	•	“candidate issue metadata will be required; exact shape depends on final filter model”

⸻

Verdict

Good split, mostly clean now.
13A is safe. 13B is properly blocked. Only minor cleanup remains.

⸻

PLAN-12 — For You Improvements

📄  

What improved

This is much better now because it has stopped pretending to be implementation-ready.

Big improvements:
	•	it explicitly says spec draft
	•	product decisions are now stated clearly
	•	share gating is removed
	•	bookmark model insufficiency is acknowledged
	•	subscription strategy is called out
	•	stale implementation examples are explicitly quarantined

That is a big step forward.  

Remaining issues

1. Bookmark invalidation rules are better, but not yet fully coherent

You now say:
	•	eliminated candidate → invalidate bookmark
	•	round changes → old bookmarks remain readable but cannot convert
	•	district mismatch after verification → alert, don’t auto-invalidate

This is much better than before, but there is still a conceptual tension: are bookmarks primarily:
	•	saved intent to endorse in a specific round, or
	•	general candidate saves with endorsement affordance

Right now the answer is “mostly the first,” but one of the district rules still behaves a bit like the second.  

That may be correct product-wise, but it needs a sharper statement.

Recommendation:
Add a one-sentence principle:
	•	“Bookmarks are round-aware endorsement intent records, but remain user-visible as historical saves after they become non-convertible.”

That would reconcile the lifecycle rules.

⸻

2. browsingDistrict needs stronger semantics

The proposed data model includes:
	•	browsingDistrict

But the plan does not specify whether that is:
	•	required immutable write-time context
	•	merely an audit field
	•	used in conversion logic
	•	or only used for user messaging

That is important because you already say district mismatch does not auto-invalidate.  

Recommendation:
Define whether browsingDistrict is:
	•	informational only
	•	or part of eligibility/conversion validation

Without that, the bookmark spec is still incomplete.

⸻

3. The alignment explainer refactor still lacks a dependency edge

You correctly say:
	•	remove dealbreaker content first
	•	then extract for reuse

That is right. But this should probably be stated as a hard sequence edge:
	1.	PLAN-10 migration removes dealbreaker content from the explainer
	2.	then PLAN-12 can extract/reuse it

Right now it is listed, but not framed as a dependency graph.  

⸻

Verdict

Correctly blocked and much more disciplined.
Still not an implementation plan, but now it is a respectable spec scaffold. The next real need is the dedicated Bookmark Domain Spec.

⸻

PLAN-10 — Quiz Improvements

📄  

What improved

This is now safely contained.

The biggest improvement is not architectural detail, but damage prevention:
	•	it clearly says do not implement
	•	it clearly says the plan is stale
	•	it clearly says it must be rewritten into separate plans

That is exactly the right interim state.  

What is still weak

1. The stale historical body is still too large

You added a strong warning:
	•	everything below is stale
	•	kept for historical context only

That helps, but the stale section is still huge and operationally detailed.  

That creates a very practical risk: someone skims the warning, then copies from the old sections anyway.

Recommendation:
Move the stale body to:
	•	an appendix section
	•	or an archived file

and leave this document as a short rewrite brief only.

⸻

2. The replacement-plan list is still not explicit enough

You correctly say this should become 3–4 plans, but the current document still stops just short of defining them.  

I would explicitly replace it with something like:
	•	PLAN-10A: Dealbreaker removal migration
	•	PLAN-10B: Standalone quiz UX cleanup
	•	PLAN-10C: Issue scope taxonomy (global | national | local)
	•	PLAN-10D: Quiz entry-point/copy cleanup if still needed

That would turn “needs rewrite” into an actual next step.

⸻

3. One piece of stale content should be removed now, not later

The header already says:
	•	quiz deselect capability exists

So any stale section describing deselect as proposed work should probably be deleted now, not preserved for history.  

That specific item is no longer useful historical context; it is just misleading.

⸻

Verdict

Safely blocked, but still too bulky.
This is now a quarantine doc, not a real plan. That is acceptable for the moment, but the next step should be replacing it with actual successor plans.

⸻

Overall Assessment

These recent changes are the first time the non-17 plans feel like they are being governed coherently.

Biggest improvements

The most important structural wins are:
	•	14 split into 14A/14B  
	•	13 split into 13A/13B  
	•	12 explicitly reclassified as a spec draft  
	•	10 explicitly quarantined as stale / dangerous  

That is exactly the right editorial direction.

Remaining systemic weakness

The remaining weakness is now smaller and more specific:

Some plans still contain examples or file references that will drift or mislead while PLAN-17 is landing.

That is fixable with one more pass.

⸻

Recommended Next Cleanup Pass

After PLAN-17 lands, I would do one short editorial sweep:
	•	PLAN-16: force the example to use selectRoundStatus(roundId) directly; define store ownership
	•	PLAN-14A / 13A: update file paths to post-PLAN-17 route locations
	•	PLAN-12: write the Bookmark Domain Spec as a separate prerequisite doc
	•	PLAN-10: archive the stale body and replace with successor-plan stubs

⸻

Bottom Line

My current confidence level:
	•	PLAN-16: close
	•	PLAN-14A: ready
	•	PLAN-13A: ready
	•	PLAN-12: correct to block
	•	PLAN-10: correct to quarantine

This is a strong improvement over the prior round. The docs are no longer mostly suffering from “unsafe ambition”; now they mostly suffer from “needs one more cleanup pass after the shell migration.”