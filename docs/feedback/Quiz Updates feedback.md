This is a much better PLAN-10 than the earlier version. The most important improvement is structural: you stopped treating “quiz improvements” as one blob and split it into three separate concerns with very different risk levels. That is the right move. In particular:
	•	10A is a cross-system migration,
	•	10B is low-risk UX polish,
	•	10C is really a new quiz/data-model/matching system.  

My high-level verdict:
	•	10A: directionally right, but still under-scoped.
	•	10B: fine, low stakes.
	•	10C: promising product idea, but not ready to implement yet. It needs several foundational decisions first or it will destabilize matching, candidate data, and feed behavior.  

The strongest thing in this document

The plan correctly acknowledges that the old PLAN-10 is dead and that:
	•	dealbreakers are gone,
	•	quiz is standalone,
	•	remaining work is split by concern.  

That means it is now aligned with PLAN-17’s “quiz is a tool, not a gate” decision, which was the biggest earlier conflict.

PLAN-10A: Dealbreaker removal migration

This is mostly the right approach, but I think it is still too optimistic for a supposedly simple cleanup.

The good part is that it correctly identifies this as a cross-system removal, not just a UI edit. It calls out stores, alignment, feed, onboarding, profile, and capability selectors. That is exactly the right instinct.  

The weak part is the rollout assumption:

“single deploy, no phased rollout needed”

I would not be that casual. Even if the Firestore field can harmlessly remain, dealbreakers were part of:
	•	capability gating,
	•	feed filtering,
	•	alignment explanation,
	•	and user expectations.

So the real risk is not schema breakage. The real risk is logic drift, where:
	•	one selector still assumes dealbreakers exist,
	•	one screen still renders “Top Picks” semantics based on old logic,
	•	one explainer still references dealbreaker conflicts,
	•	one empty state still tells users to configure dealbreakers.

I would add these missing requirements to 10A:
	•	a search-and-destroy inventory for every user-facing string containing “dealbreaker,” “top picks,” or equivalent language;
	•	a selector audit to ensure no capability logic or filter availability still references removed completion states;
	•	a feed semantics rewrite, because removing dealbreakers means “Most Important” either disappears or gets redefined;
	•	a migration note for saved filters/preferences, if users have stale local/UI state tied to removed filter IDs.

The line “leave in Firestore, remove from reads” is fine as a storage tactic, but it is not enough as a product migration plan.

Biggest 10A concern: it understates the Plan-05 impact

The plan mentions auditing PLAN-01/05/06 dependencies, but I would elevate that to a blocker. PLAN-05’s experience menu and filter model depended on dealbreaker-based “Most Important” logic. If 10A removes dealbreakers, you need a replacement product definition for:
	•	what replaces “Top Picks,”
	•	whether that filter disappears,
	•	whether the feed drops from 4 filters to 3,
	•	and whether mass endorse behavior changes when the exclusion filter is gone.

Without that, 10A is not “cleanup”; it is a silent product change.

PLAN-10B: Standalone quiz UX cleanup

This part is fine, but very underdeveloped. That is okay if it is intentionally low priority.

The only caution I would add is: do not let 10B become a dumping ground for unresolved 10C decisions. Right now it says “potential items” like progress indicator and empty state. That is harmless. But once 10C starts moving, people may be tempted to sneak format or scoring changes into 10B because it sounds like “quiz UX.” That would be a mistake.  

So I would explicitly state:
	•	10B is presentation-only,
	•	no data-model changes,
	•	no scoring changes,
	•	no question taxonomy changes,
	•	no candidate-answer changes.  

That keeps it safely shippable.

PLAN-10C: this is not a content update, it is a new matching architecture

This is the most important thing to say clearly.

The plan frames 10C as “new quiz question content + scope taxonomy,” but the actual scope is much larger:
	•	new question format,
	•	potentially new Issue or Question model,
	•	district-specific question activation,
	•	candidate answer model,
	•	alignment scoring redesign,
	•	feed filter redesign,
	•	adaptive rotation/versioning,
	•	and historical response handling.  

That is not a content refresh. It is closer to a Quiz v2 platform plan.

I think the product idea is good. I do not think it is implementable yet from this document.

Biggest 10C blocker: replacement vs coexistence is unresolved

The most important unresolved question in the whole plan is this one:

Do the new multiple-choice questions replace the existing spectrum sliders, or run alongside them?  

That is not a detail. It is the core architectural fork.

Because the answer changes everything:

If multiple-choice replaces sliders:
	•	you need a migration path for existing questionnaireResponses;
	•	current alignment scoring becomes obsolete;
	•	seeded candidate spectrum positions stop being the primary matching asset;
	•	any UI that displays alignment based on spectrum logic must be reworked.

If multiple-choice coexists with sliders:
	•	you now have two incompatible answer systems;
	•	you must define how each contributes to matching;
	•	you risk confusing users with mixed question types unless the UX is very intentional;
	•	candidate profiles need both spectrum-style positions and discrete policy answers.

Until this decision is made, the rest of 10C is mostly speculative.

Second major blocker: the data model boundary is still fuzzy

The plan says to add fields like:
	•	scope,
	•	questionType,
	•	options,
	•	districtFilter,
	•	isActive,
	•	addedAt,
	•	retiredAt.  

That is reasonable, but the current plan is still fuzzy about whether these belong on:
	•	Issue,
	•	a new Question,
	•	or some hybrid.

I would strongly recommend not overloading Issue further.

Why:
	•	“Issue” is a policy concept like trade, inflation, borders.
	•	“Question” is the survey prompt and response format shown to users.
	•	those are related, but not the same thing.

For example, one issue could later support:
	•	one spectrum question,
	•	one yes/no question,
	•	one rotating event-driven question,
	•	or multiple district-specific phrasings.

So I think this needs a cleaner model:
	•	Issue = stable topic
	•	Question = answerable prompt tied to an issue
	•	QuizConfig = active set by district / version

Right now the plan hints at that, but does not commit. It should.

Third blocker: candidate answer strategy is under-specified

This is a major hidden workload.

The plan rightly says candidates must have responses to the new questions and that seed candidates need plausible answers.  

But it underestimates how foundational this is.

You need to decide:
	•	Are candidate answers first-class campaign content or derived placeholders?
	•	Can a candidate skip a question?
	•	Are answers public on the profile?
	•	Can answers change mid-contest?
	•	If a question rotates in later, do existing candidates need to backfill answers before remaining visible in Issues/My Issues filtering?
	•	What happens when a candidate has not answered an active question but a user has?  

This matters because feed ranking and match credibility depend on it. A matching system built on user answers but spotty candidate answers will produce confusing or unfair results.

Fourth blocker: alignment scoring is the real hard part, and the plan is too loose here

The current system already has a reasonably defined scoring model using issue overlap plus spectrum alignment. 10C proposes multiple-choice matching, but the scoring section is still basically an open question.

That is a big problem because:
	•	For You ranking depends on it,
	•	issue-based filters depend on it,
	•	candidate profile alignment depends on it,
	•	and user trust depends on it.

You need a scoring design before implementation planning, not after.

At minimum, 10C should define one provisional scoring model such as:
	•	exact match = 1.0
	•	adjacent/compatible option = 0.5
	•	opposite option = 0.0
	•	unanswered by candidate = excluded from denominator
	•	unanswered by user = excluded from denominator
	•	minimum-answer threshold before showing confidence

Not because that is necessarily the final model, but because engineering cannot build feed behavior without a scoring contract.

Fifth blocker: question rotation is conceptually good, but operationally risky

I agree with the push toward more adaptive, rotatable questions. Moving DISTRICT_ISSUES out of code and into Firestore is clearly the right direction.

But the plan currently treats rotation as mostly a content-management feature. It is more than that.

Rotating questions introduces product questions like:
	•	when a user’s quiz is now “stale,” do you degrade their match quality?
	•	does the feed use only active questions, or active + retired answered questions?
	•	how many unanswered new questions before “My Issues” becomes low confidence?
	•	do users get nagged to revisit the quiz after each rotation?
	•	are rotations tied to contest rounds, breaking news, or admin discretion?  

If this is not handled carefully, the quiz becomes a moving target and users may feel like their answers constantly expire.

I would not implement rotation until you define a stability rule. For example:
	•	question sets may only rotate at round boundaries,
	•	or no more than once every X days,
	•	or retired questions continue contributing for the current contest round.

Sixth blocker: district taxonomy is too simplistic

The plan currently splits local questions by “majority red district” vs “majority blue district,” with PA-01 and PA-02 as examples.  

That may be fine for a beta, but it is not a durable system design.

The risk is that this bakes editorial assumptions into the data model too early. A better framing would be:
	•	district-specific quiz config references explicit question IDs,
	•	without encoding “red” or “blue” as the operating abstraction.

In other words, the implementation should think in terms of:
	•	quizConfig/PA-01 and quizConfig/PA-02
not
	•	“red district questions” vs “blue district questions.”

That keeps the model usable when districts do not fit a neat partisan template.

Seventh blocker: short labels need a governance rule

The plan says short labels like “Protection” or “Free Trade” should be used for display on cards and feed tags. That makes sense, but these are politically loaded compressions of more complex positions.  

So I would require:
	•	a word-limit and style rule,
	•	consistency across questions,
	•	review for bias/loaded phrasing,
	•	and a distinction between display shorthand and canonical answer text.

Otherwise you risk turning nuanced answers into misleading badges.

Eighth blocker: it is unclear whether the current questions collection survives

The plan says the current architecture is already partially adaptive and that questions are Firestore-driven, but then proposes new seed structures and maybe seedQuestions() plus new config/versioning.  

You should decide explicitly whether Quiz v2:
	•	reuses the existing questions collection with extended schema,
	•	or introduces a new normalized model.

Do not drift into a half-migration where old and new question documents coexist without clear semantics.

The best way to rescue 10C

I would split 10C again, because it is still doing too much.

10C1 — Quiz data model and activation
	•	define Issue, Question, QuizConfig
	•	move district mapping to Firestore
	•	add active/retired/versioning semantics
	•	no scoring changes yet

10C2 — Matching/scoring redesign
	•	define how multiple-choice maps to alignment
	•	define candidate answer model
	•	define feed/filter behavior
	•	define migration from existing spectrum responses

10C3 — Content rollout
	•	seed actual global/national/local questions
	•	seed candidate answers
	•	update UI presentation

That would make it much easier to sequence safely.

Concrete recommendation by sub-plan

10A

Proceed after expanding it.
Needs a true dependency and copy audit, especially around Plan-05 filter semantics and leftover user-facing language.

10B

Safe whenever you want.
Just keep it presentation-only.  

10C

Do not implement yet.
It needs:
	1.	replacement vs coexistence decision,
	2.	normalized data-model decision (Issue vs Question),
	3.	candidate answer contract,
	4.	scoring model,
	5.	rotation/staleness policy.  

Bottom line

This revised PLAN-10 is a good cleanup of the planning problem, but only part of it is implementation-ready.
	•	10A: good direction, under-scoped
	•	10B: fine, low-risk
	•	10C: valuable idea, but still an architecture draft rather than an executable plan  

The most important thing to avoid is treating 10C like “new quiz content.” It is actually a new matching system.