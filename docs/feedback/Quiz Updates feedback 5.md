This is a strong direction and, conceptually, I think it is the right simplification. The current state you describe really is an awkward dual-model system: one matching system based on topIssues/priority rankings and another based on shared quiz answers. That kind of overlap creates UX confusion, implementation drag, and explanation problems. Moving to one questionnaire, one matching formula is cleaner for users and cleaner for engineering.

My verdict:

🟡 Approve with changes
The product direction is right, but the plan still needs a few important clarifications before implementation.

The biggest theme: this plan is framed as a cleanup, but it is actually a core product-model migration. It removes not just old code, but also one of your two main representations of candidate policy identity. That has implications beyond feed scoring.

What is especially good

The biggest win is the simplification itself. The proposed formula is easy to explain:
	•	compare answers to the same questions,
	•	compute closeness,
	•	average it,
	•	show the result.  

That is much more defensible to users than the current hybrid of:
	•	issue overlap ratio,
	•	priority bonus,
	•	base points,
	•	plus separate quiz-answer logic.  

I also think the plan correctly identifies where the model leaks into the UI:
	•	alignment tooltip,
	•	shared policy chips,
	•	candidate detail “Issues” tab,
	•	feed generation,
	•	seed generation.  

And philosophically, this is consistent with the direction set in PLAN-10C:
	•	same questionnaire for candidates and voters,
	•	MC answers mapped to spectrum values,
	•	one matching system rather than multiple overlapping abstractions.

The biggest remaining problem: “issueId” vs “questionId” drift

The most important architectural concern is that this plan still describes responses like:

Array<{ issueId: string; answer: number }>

But PLAN-10C already moved the model toward QuestionResponse keyed by questionId, with Issue and Question separated as distinct concepts.

That means this plan is at risk of slipping backward into the older issue-centric model just when you finished normalizing it.

This matters because in Quiz v2:
	•	one issue can potentially have multiple questions over time,
	•	questions can retire,
	•	options can change,
	•	question sets can rotate by district/version.  

So before implementation, I would change the alignment input contract to something like:
	•	questionId
	•	answer
	•	optional metadata already available from question config

Then, if you want to group by issue for display, do that in presentation logic, not in the core response contract.

Second major concern: this plan may remove too much from candidate identity

The plan says topIssues becomes optional/deprecated and no longer used for matching. That part is good. But you should be careful not to accidentally remove the broader idea of candidate issue identity from the product.  

A 7-question quiz is a good matching instrument. It is not necessarily a complete political profile.

So I think you should distinguish:
	•	matching model → pure quiz-based, as proposed
	•	candidate content model → may still include richer issue positions for profile/exploration later

In other words, I agree with removing topIssues from scoring. I am less convinced you should think of it as fully obsolete forever unless you are intentionally deciding that quiz answers are the only policy layer in the product.

That is a product decision, not just a technical cleanup.

Third major concern: null score behavior needs stronger UX definition

The plan says:
	•	if no shared answers → score = null  

That is fine technically, but the product behavior needs to be much more explicit.

For example:
	•	What does Explore show for unscored candidates?
	•	What does My Issues show if user has not answered anything?
	•	What does candidate detail show when score is null?
	•	How does sorting behave when score is null?
	•	What chips or labels appear in the feed?

Given your recent PLAN-10C decisions, I would expect:
	•	Explore/My Area can still show candidates without score,
	•	My Issues probably should not be available meaningfully until the user has answered enough questions,
	•	low-confidence/null states need consistent UI language.  

So I would add a dedicated section:
	•	Null/low-data behavior
with explicit rules.

The “X of 7 policy positions match” text is probably wrong for this model

The testing section says:
	•	“Alignment tooltip shows ‘X of 7 policy positions match’”  

I would not use that phrasing with the new scoring system.

Why:
	•	the new system is based on continuous closeness, not exact matches
	•	if user and candidate are near each other but not identical, saying “match” becomes misleading
	•	“3 of 7 match” suggests binary equality, while your formula is scalar closeness

A better framing would be something like:
	•	“Compared across 5 shared policy answers”
	•	“Match score based on 5 shared responses”
	•	“Alignment based on 5 answered questions”

This is a subtle but important language shift.

Shared policy chips need a definition, not just a data-source swap

The plan says shared policy chips should still work, but now using candidateResponses. That is directionally right, but incomplete.  

You still need to define what makes a chip “shared.”

Is it:
	•	exact same option,
	•	within a closeness threshold,
	•	or just one of the compared questions?

That matters because if the chip says “Trade” and the user picked Free Trade while the candidate picked Limited Trade, is that “shared”? Maybe partially. Maybe not.

So I would add an explicit chip rule, for example:
	•	show chip only when closeness ≥ 0.75
	•	or show two categories: “aligned on” vs “differs on”

Without that, the UI can still be confusing even if the data model is cleaner.

Candidate detail screen rewrite needs more specificity

The proposed replacement for the Issues tab is good:
	•	question text
	•	candidate answer
	•	user answer if available  

That is much better than ranked priority lists.

But I would add three things before implementation:
	1.	What if the user has not answered that question?
Show candidate answer only, without implying a comparison.
	2.	What if the candidate has not answered that question?
Either omit it, or show “No response yet.”
	3.	Do you show only active quiz questions, or also retired historical answers?
PLAN-10C introduced rotation/versioning, so this matters.  

Right now the plan is a strong mockup idea, but not fully specified for real data states.

Feed generation change is right, but it probably needs a stronger contract

The plan says:
	•	pass candidate user doc questionnaireResponses
	•	remove matchedIssues
	•	remove candidatePositions
	•	add candidateResponses  

That all makes sense.

But I would strongly recommend that FeedItem contain derived alignment presentation data, not just raw responses.

Why:
	•	raw responses are enough for scoring
	•	but cards still need simple render-time facts like:
	•	sharedCount
	•	score
	•	maybe alignedQuestionIds or sharedAnswerLabels
	•	maybe answerCoverage

Otherwise UI components will each start recomputing interpretation logic locally, and you reintroduce drift.

So I would revise the plan to say:
	•	move raw response comparison into a single normalization step
	•	keep feed components mostly presentation-only

The plan conflicts slightly with PLAN-10C’s candidate completeness logic

In PLAN-10C you decided:
	•	candidates are hidden from “My Issues” until they answer active questions.  

This new plan says:
	•	My Issues filter still sorts by alignment score.  

That is fine, but I would make the interaction explicit:
	•	are incompletely answered candidates excluded entirely from My Issues,
	•	or included if they have some shared answers,
	•	or included only after minimum coverage?

PLAN-10C leans toward exclusion until they answer active questions, but this plan should restate that dependency so no one implements partial-score inclusion accidentally.

Seed-data cleanup is good, but don’t remove migration aids too early

I agree that:
	•	POSITION_TEMPLATES
	•	generateAllIssuePositions
	•	ALL_ISSUE_IDS
can probably go once matching no longer depends on topIssues.  

But I would be careful about the order.

If any parts of the app, tooling, tests, or debug scripts still assume those structures, deleting them immediately could make rollout harder. I would recommend a two-step migration:
	1.	stop using them in runtime matching/UI,
	2.	then remove generation code after tests and seed paths are updated.

That is especially important since you’re using avatar candidates and reseeding in dev/beta environments.

One missing piece: analytics and explanation copy migration

This plan should add the same kind of audit discipline that 10A had.

Because if you eliminate priority issues:
	•	old help text,
	•	old analytics names,
	•	old tooltips,
	•	old dashboard terms,
	•	and any internal debugging language around topIssues
become misleading.  

So I would add:
	•	string/copy audit for “priority issues”
	•	analytics/event audit for issue-overlap concepts
	•	explainer audit for “match” vs “closeness” wording

The strongest product argument for this plan

This plan’s biggest strength is not just code simplification. It creates a single explainable user story:

“You and the candidate answered the same questions. We compare how close your answers are.”

That is much easier to defend and much easier to trust than:

“We compare your selected issues, their ranked priorities, bonus weights, and a separate questionnaire.”

That simplicity is a huge product win.  

Bottom line

I think this plan is directionally right and likely worth doing. It is one of the better simplification plans you’ve shown because it removes a whole parallel conceptual layer from the system.

But before implementation, I would tighten these items:
	1.	Use questionId, not issueId, in the new matching contract.
	2.	Add explicit null/low-data behavior for score and sorting.  
	3.	Define what counts as a “shared policy chip.”  
	4.	Clarify candidate completeness rules relative to PLAN-10C’s My Issues filter.
	5.	Add copy/analytics migration for “priority issues” language.  
	6.	Be explicit that removing topIssues from matching does not necessarily mean removing richer candidate policy content from the product forever.  

So my decision would be:

Approve with revisions
Good product move, but needs one more pass to lock down data-contract and UI-state details.