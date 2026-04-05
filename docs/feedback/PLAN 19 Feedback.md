This is a good simplification and I think the product decision is right. Removing pre_nomination makes the app feel more alive, reduces dead-state UI, and better matches how users experience the contest. But I would not call this low risk yet. It is probably moderate risk because this change touches the contest state machine, seed ordering, live Firestore data, and any code that assumes round order starts before endorsement.  

My verdict:

🟡 Approve with revisions
Strong direction, but the migration plan needs tightening before implementation.

What is strong

The best part of the plan is that it recognizes this is not just a content tweak. It correctly identifies that removing pre_nomination affects:
	•	types,
	•	seed data,
	•	config defaults,
	•	FAQs,
	•	cron behavior,
	•	deprecated admin functions,
	•	migration script,
	•	and live Firestore state.  

That’s the right level of seriousness.

I also agree with the product rationale:
	•	no voting,
	•	no endorsements,
	•	no filtering,
	•	no real user action.
So from a UX perspective, pre_nomination is basically dead air. Starting directly at round_1_endorsement is cleaner.  

Biggest concern: order renumbering is more dangerous than the plan suggests

The most important risk is the proposal to renumber all round order values after removing pre_nomination.  

That sounds harmless, but in your system order is used for:
	•	timeline rendering,
	•	past/current/future derivation,
	•	next-round resolution in transition logic,
	•	and beta cron progression. From your prior architecture, those are core behaviors, not decorative metadata.  

Renumbering everything means:
	•	every current/future comparison changes,
	•	existing contestTransitions history may now reference rounds whose relative order no longer matches current config,
	•	and any code or tests that assume specific order values will silently change behavior.

My recommendation

Do not renumber existing rounds unless you absolutely must.

Safer option:
	•	delete pre_nomination
	•	keep round_1_endorsement at order 1, round_2_endorsement at 2, etc.
	•	leave a gap at 0

That gives you:
	•	minimal behavioral drift,
	•	preserved historical semantics,
	•	less chance of subtle ordering bugs.

A missing zero is much less dangerous than changing the ordinal meaning of every downstream round.

Second major concern: reseeding contest rounds may be too blunt

The plan says:
	1.	deploy code
	2.	re-seed contest rounds in Firestore
	3.	update partyConfig fields  

That can work, but it depends heavily on how “re-seed” behaves.

If reseeding means overwriting all round documents, you risk:
	•	unintentionally wiping admin-managed schedule fields like startDate / endDate
	•	clobbering any future presentation/config tweaks stored in Firestore
	•	creating inconsistencies with existing contestTransitions history.

My recommendation

The plan should explicitly state whether reseeding is:
	•	destructive replace, or
	•	idempotent upsert

I strongly recommend:
	•	delete only contestRounds/pre_nomination
	•	update only the docs that truly changed
	•	avoid full reseed unless you are certain all round docs are static and disposable.

Right now “re-seed contest rounds” is too vague and potentially too destructive.

Third concern: Firestore migration order should be reversed or made atomic

The plan currently says:
	1.	deploy code
	2.	re-seed contest rounds
	3.	update partyConfig.currentRoundId and contestStage  

That leaves a window where:
	•	the app code expects no pre_nomination,
	•	but live partyConfig.currentRoundId may still be pre_nomination.

If that happens, fallbacks may save you in some places, but it is still an inconsistent live state.

My recommendation

Use a one-time migration that does these together, ideally in one backend script or transaction-like sequence:
	1.	create/update needed round docs
	2.	set partyConfig.currentRoundId = 'round_1_endorsement'
	3.	set partyConfig.contestStage = 'round_1_endorsement'
	4.	then delete contestRounds/pre_nomination if desired

That reduces the chance of a live mismatch.

Fourth concern: AboutContestCard may not be as unaffected as the plan says

The plan says AboutContestCard does not need changes because it reads from the store and will simply show one fewer round.  

That is probably mostly true, but I would not assume zero impact.

Because if the first displayed round changes from a non-voting stage to Round 1, you may need to verify:
	•	first-item spacing / timeline connector rendering,
	•	“current” chip display,
	•	candidate count text,
	•	any copy that assumes the first stage is non-endorsement,
	•	and any tests that assert exact number of timeline entries.

So I agree there may be no code changes, but there is a regression test requirement.

Fifth concern: FAQ fallback change is fine, but content review is still needed

Changing the fallback from pre_nomination to round_1_endorsement is correct.  

But removing the pre_nomination FAQ entry is not enough by itself. You should also review whether any FAQ copy elsewhere still implies:
	•	voting is not yet open,
	•	the contest starts later,
	•	or there is a pre-contest stage.

This is a smaller point, but since the product meaning changes, content should be rechecked holistically.

Sixth concern: deprecated admin function updates are underspecified

The plan says deprecated admin functions should stay consistent. Good instinct.  

But the risky part is that “deprecated” code often survives longer than intended. If partyConfig.ts still contains notification templates and unions referencing pre_nomination, that may not be purely cosmetic.

My recommendation

Either:
	•	fully update them and test that they compile and don’t emit stale notifications,
	•	or explicitly quarantine them as dead code scheduled for removal.

Right now it sits awkwardly in between.

Seventh concern: orphaned historical data should not be hand-waved

The plan says existing contestTransitions docs referencing pre_nomination can remain as historical records, and the contestRounds/pre_nomination doc can be deleted or left orphaned.  

Keeping historical transition records is absolutely correct.

But on the round doc itself, I would choose deliberately:
	•	either keep the old pre_nomination doc for historical interpretability,
	•	or delete it and accept that old audit entries reference a no-longer-present round config.

I would lean toward keeping the doc unless you have a strong reason to remove it. It costs little, and it preserves audit readability.

If you do keep it, make sure it is simply not part of the active union / seed / selector logic.

Eighth concern: default fallbacks need a search beyond listed files

The plan lists 10 files, which is a good start.  

But I would not trust that list without a project-wide search for:
	•	'pre_nomination'
	•	"Pre-Nomination"
	•	array lengths / round count assumptions
	•	tests that expect 8 total rounds or 7 displayable rounds

This is exactly the kind of change where one forgotten string constant or test fixture can create weird behavior.

So I would add an explicit requirement:
	•	global grep/audit before merge

Ninth concern: TypeScript union removal is correct, but migration timing matters

Removing 'pre_nomination' from ContestRoundId is the right final state.  

But if live Firestore still contains currentRoundId: 'pre_nomination' while the new app is running, TypeScript won’t protect you at runtime. So again, this increases the importance of doing the Firestore migration in lockstep with deployment, not as a separate manual afterthought.

Tenth concern: risk assessment is understated

I would not classify this as “Low risk.”  

It is not high risk, but it is definitely moderate because it changes:
	•	the first valid state in the contest state machine,
	•	the active round fallback across the app,
	•	beta cycle-back behavior,
	•	and potentially the interpretation of historical transitions.

That deserves a little more caution in rollout language.

What I would change in the plan

I would revise these points before implementation:

1. Do not renumber order unless required

Safer to preserve existing order numbers and just remove the inactive round.  

2. Replace “re-seed contest rounds” with explicit migration semantics

Say whether docs are overwritten, upserted, or selectively removed.  

3. Make Firestore migration coordinated, not manual-last

Update partyConfig and round docs in a controlled sequence, ideally via script.  

4. Add full-text audit requirement

Search for all references to 'pre_nomination' and related display strings before merge.  

5. Reclassify risk to moderate

And add a short regression checklist for:
	•	header
	•	timeline
	•	FAQ
	•	beta cron cycle
	•	round debug cycling
	•	current-round fallback behavior.  

Bottom line

I agree with the product decision. Removing pre_nomination is a good simplification and should make the app feel more immediate. But the safest implementation path is:
	•	keep historical ordering stable,
	•	migrate Firestore deliberately,
	•	avoid destructive reseeding,
	•	and audit every reference before merge.  

So my recommendation is:

Approve with revisions
Good plan, but tighten the migration mechanics before shipping.