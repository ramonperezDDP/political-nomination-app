This update is a real improvement. The document now correctly treats PLAN-10 as a parent umbrella that has been replaced by successor plans, and the split is much cleaner and more honest about risk. The biggest win is that it no longer pretends Quiz v2 is “just new content.” It now explicitly recognizes it as a new matching architecture, which is the right framing.  

My updated verdict:
	•	10A: much better, close to implementation-ready, but still blocked on one unresolved product decision.
	•	10B: clean and safe.
	•	10C1/10C2/10C3: now split correctly, but 10C1 still needs one more architectural boundary, and 10C2 is still the real hard part.  

What improved materially

The strongest improvements are:
	•	10A now explicitly calls out that this is a product migration, not just code cleanup.  
	•	10B now has hard boundaries, which should keep it from becoming a side door for architecture changes.  
	•	10C is now broken into a sane sequence:
	•	data model / activation,
	•	scoring / matching,
	•	content rollout.  

That sequencing is the right one.

10A: much stronger, but still not actually “ready” until Plan-05 semantics are resolved

This is the biggest remaining issue in the document.

The plan now correctly identifies the dependency:
	•	removing dealbreakers breaks the meaning of “Most Important” / “Top Picks,”
	•	which means Plan-05 filter semantics must be redefined first.  

That is exactly right. But because that decision is marked as a blocker, I would not label 10A “ready to implement after expanding scope.” I would label it more bluntly:

Blocked on replacement filter semantics for Plan-05

Because otherwise engineering may read “ready” and start ripping out dealbreaker code before the feed/filter product behavior is settled.

That matters because once dealbreakers go away, you need an explicit answer to:
	•	does the feed have 3 filters instead of 4,
	•	does “Most Important” become “Best Match,”
	•	or does another exclusionary/priority concept replace it.  

Without that answer, 10A still creates UX ambiguity.

10A: one more missing migration requirement

You added saved filter/preference migration, which is good. But I would add one more explicit requirement:
	•	analytics / event taxonomy audit

If you have any analytics events, logs, or funnel names tied to:
	•	dealbreakers,
	•	top picks,
	•	most important,
	•	or dealbreaker completion,

those become stale the moment 10A lands.

This matters because once you remove the feature, product and growth analysis can silently get distorted if old event names remain and are interpreted as meaningful.

So I would add:
	•	audit analytics event names,
	•	audit dashboard labels,
	•	audit any Firestore-derived reporting fields that still expect dealbreaker completion.

10A: verification checklist dependency may be broader than listed

You list VerificationChecklist.tsx, which is good. But because dealbreakers were part of the progressive capability model historically, I would audit every place where onboarding progress, readiness, or “complete your profile” is summarized. Not just checklist UIs, but also:
	•	progress chips,
	•	empty states,
	•	and any logic computing completion percentages.

The plan is close, but I still want a broader “progress/completion audit” language, not only a selector audit.

10B: this is now fine

This section is now in a good place. The hard boundaries are exactly what it needed:
	•	no data model changes,
	•	no scoring changes,
	•	no taxonomy changes,
	•	no candidate-answer changes.  

That should make 10B safely executable.

The only addition I would make is a tiny procedural note:
	•	any UI polish in 10B must preserve support for both current answer rendering and whatever future 10C introduces, so avoid styling assumptions that hard-code slider-only layouts.

That is minor. Overall, 10B is now clean.

10C1: much better, but it still needs a “response model” decision in scope

This section is significantly improved. The Issue / Question / QuizConfig split is the right direction.  

But there is one missing architectural piece: the plan defines topic model and activation model, but it still does not explicitly define the response model.

You need to decide whether a user response is tied to:
	•	questionId,
	•	issueId,
	•	both,
	•	and whether responses are versioned by questionSetVersion.

This becomes important immediately if:
	•	a question is retired,
	•	wording changes,
	•	options change,
	•	or the same issue gets a new question form.

Right now you say “preserve responses, exclude from quiz” for retired questions, which is sensible. But unless responses are clearly attached to a stable question/version identity, migration gets messy.

So I would add to 10C1:
	•	define QuestionResponse keyed by questionId,
	•	include questionSetVersion or equivalent provenance,
	•	specify what happens when a question’s options change after a user has answered.

That belongs in 10C1, not later.

10C1: replacement vs coexistence is still the biggest fork

This remains the main blocker, and the document now states that clearly. Good.  

My only feedback is that the plan should force a decision sooner. Right now it says this is required before implementation, but does not express a recommendation.

I would recommend the plan choose a preferred direction, even if it is not yet approved. For example:
	•	recommended default: coexistence only as a temporary bridge, with eventual replacement

Why? Because if you leave both options equally open, downstream planning stays mushy. Engineering and product both benefit from seeing the intended direction, even if final signoff is pending.

10C2: still the hardest part, but now properly framed

This section is much improved because it now correctly identifies the core hard problems:
	•	scoring contract,
	•	candidate answer contract,
	•	feed filter behavior,
	•	short-label governance.  

That is exactly the right set of questions.

My biggest 10C2 concern now:

It still does not say who owns the scoring rules.

This sounds like a small governance point, but it matters a lot. The scoring contract affects:
	•	feed ranking,
	•	profile explanations,
	•	user trust,
	•	and candidate fairness.

So I would explicitly assign ownership:
	•	product defines scoring goals and user-visible interpretation,
	•	engineering defines implementable mechanics,
	•	policy/content team signs off on label phrasing and candidate-answer interpretation.

Without an owner, scoring plans tend to stall or drift.

10C2: candidate answer contract needs a harder stance

The document asks the right questions, but I think one answer should already be elevated:
	•	candidate answers must be first-class campaign content

If you do not make that explicit, there will be pressure to use placeholders, inferred positions, or incomplete seeding indefinitely. That would weaken trust in the matching system.

Even for avatar candidates, seeding is fine initially. But for real candidates, the end-state should be:
	•	candidates explicitly answer the active questions,
	•	those answers are visible and auditable,
	•	and profile explanations derive from those answers.

I would make that a declared design principle.

10C2: one missing question — confidence vs score

The provisional scoring bullet list is helpful, but one concept is missing:
	•	match confidence

In a question-based system, a candidate with 95% alignment on 2 answered overlaps is not the same as a candidate with 82% alignment on 8 answered overlaps.

So 10C2 should explicitly define whether the product surfaces:
	•	only a score,
	•	or a score plus confidence,
	•	or a minimum overlap threshold before showing strong labels.

This matters for feed fairness and user trust.

10C3: now properly placed, but content rollout still needs one more dependency

This section is much better now that it is clearly downstream of 10C1 and 10C2.  

The remaining issue is that question content and short labels are still politically sensitive. You already added short-label governance in 10C2, which is good. But 10C3 should explicitly require:
	•	editorial review of question phrasing,
	•	editorial review of option wording,
	•	and consistency review across districts.

That is especially important for pairs like:
	•	Open / Partially Close / Close,
	•	Socialize / Maintain / Privatize,
	•	Escalation / Limited Response / No Involvement.  

Those are not neutral just because they are short.

Question rotation policy: good to surface, but I would move some of it earlier

You currently place rotation policy in 10C3. I think part of it belongs in 10C1, because rotation affects the data model:
	•	active vs retired,
	•	versioning,
	•	response validity,
	•	change detection.  

Then the product-facing behavior can stay in 10C3:
	•	when users are prompted,
	•	how often sets rotate,
	•	how confidence degrades.

So I would split the concept:
	•	structural rotation/versioning rules in 10C1,
	•	UX/admin rotation policy in 10C3.

Recommended sequence: almost right, but I’d swap 10A and 10B only if Plan-05 is unresolved

Your sequence says:

10B → 10A → 10C1 → 10C2 → 10C3  

That is reasonable, but only because 10A is blocked on Plan-05 semantics.

If that blocker remains unresolved, then yes, 10B first makes sense.

But if the filter decision gets made quickly, I would actually consider:
	•	10A before 10B

because removing dead concepts from the product model reduces confusion before polishing the quiz UI.

So I would phrase it as:
	•	10B first only if Plan-05 filter semantics are still undecided.

Bottom line

This revision is substantially better and much closer to something engineering can safely work from.  

My updated judgment:
	•	10A: strong, but should be explicitly labeled blocked on Plan-05 replacement semantics
	•	10B: good to go
	•	10C1: strong direction, but add a formal response model
	•	10C2: right framing, still the hardest part, add score-confidence and ownership
	•	10C3: appropriately downstream, add editorial review gates

So compared with the prior draft:
	•	the planning structure is now solid,
	•	but the actual implementable part is still mainly 10B, with 10A ready only after one product decision.