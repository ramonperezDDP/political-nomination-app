Yes — these updates are meaningfully better. The set is now better triaged, better sequenced, and less likely to cause accidental regressions. But a few plans still have “status text is correct, body is stale” problems.

Here’s the same blunt review.

⸻

Executive Summary

The revised set is much healthier:
	•	PLAN-17 remains the foundation and is still the clear first move
	•	PLAN-16 is closer, but its implementation body still contradicts its own review notes
	•	PLAN-14 now correctly admits it is only partially implementable, but the body still contains deferred work as if it were ready
	•	PLAN-13 correctly marks itself blocked, but the body still reads like an implementation plan for unsafe behavior
	•	PLAN-12 is still a spec draft, not an implementation plan
	•	PLAN-10 is still not safe, but the product decision on dealbreakers helps a lot

So the top-level sequencing is now good, but several documents still need a second-pass cleanup so the “Status / Review Notes / Implementation Details” sections stop fighting each other.            

⸻

PLAN-17 — Unified App Shell

📄  

Verdict

Still the best plan in the set. Still ship first.

What improved

You incorporated the right criticisms:
	•	explicitly marked it as ship first
	•	called out route duplication drift risk
	•	resolved the quiz conflict by locking quiz as standalone
	•	acknowledged deep-link default behavior
	•	flagged AppHeader render/perf concerns

That is exactly the right evolution.

What is still slightly under-specified

1. Deep link rule is better, but still too hand-wavy

You now say:
	•	default to (feed) for unknown/deep-linked candidate detail
	•	use from if present

That is directionally correct, but you still need a single canonical rule for all candidate navigation so people do not invent alternate link shapes later.

The missing piece is:
	•	what is the canonical route generator?
	•	who owns adding from=leaderboard or from=feed?
	•	what happens if someone deep-links to an old /candidate/[id] path after the migration?

You need a small “routing contract” section, not just an implementation note.

2. AppHeader loading behavior needs a concrete fallback

You correctly note loading state, but not what the header renders when state is unavailable.

You should define:
	•	round label while config is loading
	•	district pill while browsing district is unset
	•	what happens for anonymous user before hydration

Without that, implementation will improvise.

3. Web compatibility is still a risk surface

You mention the <Slot> / SafeArea alias pattern, which is good, but this remains one of the easiest places for “works on native, broken on web” regressions.

That deserves a dedicated test checklist item, not just a constraint footnote.

Final take

This is the one plan I would actually trust an engineer to start with now.

⸻

PLAN-16 — About the Contest

📄  

Verdict

Much improved in prioritization, but the body still contradicts the review notes.

This is the biggest “looks fixed at the top, still stale underneath” document.

What improved

The sequencing is now right:
	•	implement after PLAN-17
	•	use selectContestTimeline
	•	use selectRoundStatus(roundId)
	•	prefer static presentation maps for human-readable voting-method text
	•	call out real-time flicker risk

All good.

The major remaining problem

The document still uses the rejected model in its implementation example

In the review notes, you correctly say:
	•	no isActive
	•	no isComplete
	•	use selectRoundStatus(roundId)

But then in the actual render example you still do this:

const isActive = round.id === currentRoundId;
const isPast = round.isComplete;

and later you say:

The isComplete and isActive fields on each ContestRound document … drive the visual treatment.

That is a direct contradiction of the plan’s own corrections.  

This is not cosmetic. It means someone implementing from the body will reintroduce the wrong model.

Other remaining issues

1. “ContestRounds are fetched once” vs “timeline updates in real time”

You say:
	•	contestRounds should be fetched once
	•	currentRoundId updates in real time

That is probably fine operationally, but only if the product team truly does not expect admin edits to labels or candidate counts to appear live.

Right now the document still implies admins can change labels/counts without deploy. That expectation conflicts with “fetch once unless app reloads.”

You need to choose one of these:
	•	Static round metadata + live currentRoundId
	•	or Live round metadata + live currentRoundId

Right now you are describing both.

2. Round hiding policy is under-defined

You hide post_election, but the document doesn’t say whether there are any other non-display rounds now or later.

That should probably be a display whitelist or display flag, not an inline special case.

Final take

This is close, but not ready until the body is rewritten to match the notes. Right now it is still hazardous because the wrong code example is more likely to be copied than the warning above it.

⸻

PLAN-14 — Profile Fixes

📄  

Verdict

Status is now correct; body still includes too much deferred work.

This plan has improved in honesty more than in implementability.

What improved

The new framing is right:
	•	safe now: header fixes
	•	defer endorsements redesign
	•	defer navigation work to PLAN-17
	•	verification must use capability selectors

That is exactly the right cut line.

The problem

The implementation section still reads like the full plan is actionable

Even though the header says “partially implementable,” the body still includes:
	•	full endorsements redesign
	•	bookmarks section
	•	endorse all bookmarked
	•	verification prompts
	•	local back-button fixes

That is exactly the work your review notes say to defer.  

So the document is now self-aware, but still dangerous.

Specific issues

1. Verification logic still stale in code examples

The notes correctly say:
	•	use selectFullyVerified
	•	use selectMissingVerifications

But the actual code samples still use:

userProfile?.verificationStatus === 'verified'

That should be removed from the document entirely if the plan is supposed to steer people correctly.

2. Endorsements page still assumes bookmark model exists

The document still proposes a UI whose entire middle depends on bookmarks, even though it now admits bookmarks are blocked on PLAN-12.

That creates false readiness.

3. Route examples are now outdated under PLAN-17

There are still old route references such as:
	•	app/(tabs)/profile.tsx
	•	app/settings/endorsements.tsx
	•	router.push('/(tabs)/for-you')

Those paths become stale as soon as PLAN-17 lands, which this plan explicitly says should happen first.

What I would do

Split this into:
	•	PLAN-14A: profile header + beta CTA hiding
	•	PLAN-14B: endorsements page redesign after bookmark model and round-scoped endorsement model exist

Right now it is one document pretending to be two.

Final take

The diagnosis is now right. The execution content still needs pruning.

⸻

PLAN-13 — Leaderboard Improvements

📄  

Verdict

Correctly blocked at the top, still unsafe in the body.

This is better because it now clearly says “do not implement yet,” which is good. But the body still hands engineers an unsafe implementation recipe.

What improved

You properly elevated the blockers:
	•	mass endorse must be backend
	•	eligibility must flow through existing selectors
	•	product decision required on filter source

That is the right call.

The problem

The implementation section still prescribes the exact unsafe thing you say not to do

You still include:

for (const entry of candidatesToEndorse) {
  await endorseCandidate(...)
}

and a biometric-first flow, even though the review notes now explicitly say that approach is invalid.  

That means the doc is still operationally dangerous.

Remaining concerns

1. The cutoff-line fix could be split out and shipped independently

This is important: not everything in this plan is blocked equally.

You have one tiny, low-risk UI fix:
	•	hide cutoff line on Trending tab

That could be extracted and shipped now as a standalone cleanup plan.

Bundling it with mass-endorse and filtering means an easy win stays trapped behind hard blockers.

2. The future section still uses stale elimination naming

You correctly flag that isEliminated is stale, but the “Future” section still includes it in examples.

That should be rewritten now or removed.

3. Filter model ambiguity is still unresolved in the actual plan body

The doc says the product decision is unresolved, but the actual implementation section still assumes:
	•	leaderboard pills come from user-selected issues

That is premature.

What I would do

Refactor this into two docs:
	•	PLAN-13A: trending cutoff line cleanup — implementable now
	•	PLAN-13B: issue filtering + mass endorse — blocked on backend and product rules

Final take

The blocking status is right. The body needs to stop pretending there’s an approved implementation.

⸻

PLAN-12 — For You Improvements

📄  

Verdict

Still a spec draft, but the critique is sharper now.

This plan is now more honest, which is progress. It is still not an implementation plan.

What improved

Two important clarifications happened:
	•	bookmarks are now recognized as core domain logic
	•	you explicitly state the product decision should be:
	•	remove share gating requirement

That is a very good correction.

But the body still contradicts the decision

1. Share gating is still in the summary and implementation

The review notes now say:
	•	remove share gating requirement

But the plan summary still says:
	•	require ID verification before sharing

and the code sample still gates Share.share() behind verification.  

That contradiction needs to be cleaned up immediately.

2. Bookmark data model is still under-modeled in the actual type

You now correctly say bookmarks are round-aware pre-endorsements, but the proposed type is still just:

id, odid, candidateId, createdAt

That is nowhere near enough for the semantics now being described.

If bookmarks are round-aware pre-endorsements, the model likely needs at least:
	•	user id
	•	candidate id
	•	round id
	•	district id or browsing district context
	•	createdAt
	•	maybe status / resolvedAt / endorsedAt / invalidatedReason

Not because every field must be stored, but because the lifecycle is now domain-relevant.

3. “Use existing alignment modal” is now blocked by dealbreaker removal

You note this correctly, but the implementation section still says:
	•	extract current candidate detail modal and reuse it

That is still risky until the modal content itself is refactored to remove dealbreaker content.

4. Store/subscription strategy is still missing

You now say bookmarks must be persisted in Firestore, but the document still does not define:
	•	collection shape
	•	subscription ownership
	•	whether feed screen subscribes directly or store subscribes once
	•	whether bookmarks are user-scoped only or user+district+round scoped in queries

This is why I still call it a spec draft, not a build plan.

Final take

The document’s judgment is now much better than its implementation section. It needs a separate bookmark spec before it becomes actionable.

⸻

PLAN-10 — Quiz Improvements

📄  

Verdict

Still not implementable, but it is now pointed in the right direction.

This improved more than the others conceptually because one major product ambiguity is now settled:
	•	dealbreakers are being removed entirely
	•	quiz is standalone, not onboarding

That is a real step forward.

What improved

You now correctly frame this as:
	•	full rewrite needed
	•	phase 4
	•	split into separate efforts:
	•	dealbreaker removal migration
	•	standalone quiz UX improvements
	•	issue-scope grouping

That is exactly right.

The problem

The body is still basically the old plan

The document still spends most of its detail describing an outdated architecture:
	•	app/(auth)/onboarding/questionnaire.tsx
	•	app/(auth)/onboarding/issues.tsx
	•	route to onboarding questionnaire
	•	delete onboarding dealbreakers screen as part of this same change

But the plan itself says the quiz is standalone now.  

So again, the status header is smarter than the body.

Remaining strategic issue

Dealbreaker removal still needs migration design, not just deletion list

You have now confirmed the product decision, which is huge. But the plan still treats removal mostly as:
	•	remove references
	•	delete files
	•	update labels

That is insufficient.

A real migration plan still needs:
	•	existing user data handling
	•	backward compatibility for reads during rollout
	•	Firestore cleanup timing
	•	whether old fields remain readable temporarily
	•	whether alignment calculations degrade gracefully during mixed-version clients
	•	rollout order across mobile/web/admin if applicable

Without that, this can still become a breaking migration.

One nuance

The note says:
	•	quiz deselect capability exists

If that is true, then that item should come out of this plan entirely. It should not remain in the summary as proposed work.

Final take

This is no longer “dangerously unaware,” but it is still a stale implementation doc. Needs to be rewritten from scratch around the standalone quiz.

⸻

Cross-Plan Assessment

What is now good

The portfolio-level sequencing is much better:
	1.	PLAN-17 first
	2.	PLAN-16 second
	3.	defer bookmark / mass endorse / endorsements redesign until domain rules exist
	4.	PLAN-10 last as migration

That is the right arc.            

What is still the big systemic weakness

Several docs now have this pattern:
	•	Header/status: correct
	•	Review notes: correct
	•	Implementation details/code samples: stale and contradictory

That is dangerous because implementers usually copy the examples, not the warnings.

So the next editorial task is not “invent new architecture.” It is:

Make each plan internally consistent so the implementation section only contains work that is actually approved.

⸻

Recommended Next Execution Order

Here is the order I would use now:

Phase 1
	•	PLAN-17 as written

Phase 2
	•	PLAN-16, but first rewrite the render examples to use selectRoundStatus(roundId) only

Phase 3
	•	PLAN-14A split out:
	•	profile header fixes
	•	hide Run for Office CTA behind real feature flag/config
	•	optionally PLAN-13A split out:
	•	hide cutoff line on Trending

Phase 4

Before any bookmark-related UI:
	•	write a dedicated Bookmark Domain Spec
	•	then rewrite PLAN-12 and the deferred part of PLAN-14

Phase 5
	•	rewrite PLAN-10 as a true migration plan for dealbreaker removal + standalone quiz cleanup

⸻

Bottom Line

The revised set is substantially better managed, but not yet fully clean. The strongest improvement is that you now have the right sequencing and the right skepticism. The main remaining problem is editorial consistency inside each file.

In plain terms:
	•	PLAN-17: ready
	•	PLAN-16: close, but body still wrong
	•	PLAN-14: only partially salvageable in current form
	•	PLAN-13: correctly blocked, but body still unsafe
	•	PLAN-12: still a spec, not a build plan
	•	PLAN-10: now correctly recognized as a rewrite/migration, not a feature task

The highest-value next step is to do one cleanup pass that strips stale code examples out of the blocked plans and splits partial plans into smaller executable ones.