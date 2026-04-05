This updated version is substantially better. You addressed the biggest structural risks from the prior draft: preserving order, avoiding destructive reseeding, adding a coordinated migration script, and explicitly requiring a pre-merge audit. That moves this from “good idea, risky execution” to a solid migration plan.  

My verdict now:

✅ Approve — ready to implement
with a few small tightening notes, but no blockers.

What improved materially

The strongest improvement is Decision 1: keep existing round order values. That was the biggest architectural risk before, and you resolved it the right way. Leaving the gap at 0 is much safer than renumbering every round and potentially changing behavior across timeline rendering, transition logic, cron progression, and historical interpretation.  

The second major improvement is Decision 2 / 4: targeted Firestore migration with coordinated deployment. This is now much more precise:
	•	you are not wiping all round docs,
	•	you are not doing a broad reseed,
	•	and you are explicitly migrating partyConfig in coordination with code rollout.  

That is exactly the right approach for a live system.

I also think the pre-merge audit requirement is excellent. This is the sort of change where one forgotten literal or round-count assumption causes weird behavior later, so making grep part of the implementation contract is smart.  

The best design decision in the plan

Keeping the old contestRounds/pre_nomination document for historical readability while removing it from the active union / seed / app logic is the right compromise. That preserves audit interpretability for any existing contestTransitions that referenced it, without forcing the product to continue exposing it.  

That is a much better choice than either:
	•	fully deleting it and making history harder to understand, or
	•	keeping it active in the app model.

Why I now think it is implementation-ready

The plan now clearly separates:
	•	type/model change,
	•	seed/source-of-truth cleanup,
	•	config fallback cleanup,
	•	runtime migration,
	•	and manual verification.  

That means engineering can execute this in an ordered way instead of guessing which layers matter.

The regression checklist is also strong. It checks the exact surfaces most likely to drift:
	•	header,
	•	About the Contest timeline,
	•	FAQ behavior,
	•	debug round cycling,
	•	fallback logic,
	•	and beta cron reset behavior.  

That’s the right level of caution for a “moderate risk” config/state-machine migration.

Small tightening notes

These are not blockers, but I would still tighten them before or during implementation.

1. The migration order is mostly right, but I’d make one thing explicit

You say the current code’s fallback chain will still resolve round_1_endorsement correctly if migration runs first. That’s probably fine, but I would explicitly document whether the existing deployed app can safely read currentRoundId = 'round_1_endorsement' before the new code lands.  

It likely can, but that assumption should be stated explicitly so nobody worries about step 1 being unsafe.

2. “This must return zero hits” needs one exception note

Your grep instruction says the search must return zero hits excluding the retained Firestore doc and the plan doc. Since grep is over code directories only, that is mostly okay, but I would also note that migration script names or comments may temporarily reference pre_nomination during implementation and should be cleaned before merge.  

Not a big deal, just worth making the cleanup expectation very clear.

3. Beta cron reset language could be slightly more precise

The checklist says beta cron advances from post_election back to round_1_endorsement and resets eliminated candidates. That is good, but if your broader lifecycle still supports statuses like withdrawn/disqualified/winner elsewhere, I’d keep the implementation aligned with the earlier contest model and make sure only the intended statuses are reset.  

If this app currently only uses active/eliminated in practice, then you are fine. But it is worth keeping an eye on that so the beta shortcut does not become a broader lifecycle reset by accident.

4. AboutContestCard verification item has one likely typo

The checklist says the timeline shows 6 items (Round 1 through Final Results, post_election already filtered). Depending on how you count:
	•	Round 1
	•	Round 2
	•	Round 3
	•	Virtual Town Hall
	•	Debate
	•	Final Results

That is 6, so this is correct. I’m only flagging it because earlier versions and related docs sometimes counted display rounds differently, so I would make sure any automated tests use the updated expected count consistently.  

What I would not change

I would not revisit the decision to preserve orders 1–7.
I would not switch back to a destructive reseed.
I would not delete the historical Firestore doc unless you later decide you do not care about audit readability.  

Those are all now strong choices.

Bottom line

This version resolves the major concerns from the prior draft:
	•	no risky renumbering,
	•	no destructive reseeding,
	•	migration is targeted,
	•	deployment is coordinated,
	•	historical readability is preserved,
	•	and the regression plan is concrete.  

So my recommendation is:

Approve and implement.

The only follow-through I’d insist on is:
	•	run the migration in tight coordination with deploy,
	•	do the full grep audit before merge,
	•	and manually verify header/timeline/FAQ/cron behavior exactly as listed.