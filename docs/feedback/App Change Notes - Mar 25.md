Here’s the blunt version: the next set of plans is not ready to implement as-is. There are several places where the docs are stale, internally inconsistent, or now conflict with the architecture you already built in Plans 00–06. The biggest theme is that these later plans were written against an older mental model of the app, while the current system now has three important foundations already in place: anonymous-first access, browsing-district vs verified-district separation, and the contest-round state machine. A lot of these plans need to be rewritten to respect those foundations before engineering starts.

The two that are basically not “pending implementation” anymore are PLAN-09 and PLAN-11. PLAN-09 is explicitly marked implemented on the current branch, and PLAN-11 is marked re-implemented as part of PLAN-00 Phase 1. I would not spend review energy treating those as open work unless you are doing polish or regression checks.

The most important meta-fix before anything else

You should not implement Plans 07, 08, and 15 independently. They are all really one problem: app-shell architecture and navigation behavior. Right now:
	•	PLAN-07 wants a persistent title bar,
	•	PLAN-08 wants a persistent footer/tab bar on more screens,
	•	PLAN-15 wants back/cancel behavior fixed.

Those are tightly coupled. If you implement them separately, you are very likely to create double work or contradictory routing behavior. The right sequence is:
	1.	decide the final route structure,
	2.	decide which screens live inside tabs,
	3.	decide where the persistent header is rendered,
	4.	then audit back/cancel behavior on top of that shell.

PLAN-07: Persistent title bar — needs redesign before implementation

This plan has the clearest self-contradiction in the whole batch. It explicitly warns not to wrap <Tabs> in an extra <View> because that previously broke touch handling, then shows an implementation that does exactly that by returning a parent <View> with <AppHeader /> above <Tabs>. That is a red flag: the plan is warning about a failure mode while prescribing the failure mode.

The second major issue is that the district selector logic is pointed at the wrong state. The plan uses userProfile?.district and writes back with updateProfile(userProfile.id, { district }). But your earlier architecture already separated browsing district from the user’s verified districts, and Plan 02 placed browsing district in user state as selectedBrowsingDistrict, specifically so users can browse freely without mutating identity-linked district data. Rewriting userProfile.district from the header would blur that separation and could create eligibility bugs later.

That matters a lot because in your system:
	•	browsing district drives what content the user is viewing,
	•	verified districts drive what they are allowed to endorse.

So before implementing PLAN-07, the header must:
	•	read and write selectedBrowsingDistrict,
	•	work for anonymous users,
	•	never mutate verification-derived district identity,
	•	and probably live in a shared shell that is compatible with whatever PLAN-08 does.

I would also fix the plan text that says there is “no district concept in the UI.” That was true before Plan 02, but it is stale now because the district toggle and browsing district concept are already established.

PLAN-08: Persistent footer/tab bar — directionally right, but stale and too broad

The underlying idea is sound: if candidate detail and profile/settings flows are supposed to feel like part of the authenticated app, nesting them under tabs is the right Expo Router pattern. But the plan is stale in two ways. First, it still moves a dealbreakers.tsx screen into the Profile tab, even though PLAN-10 proposes removing dealbreakers entirely from the app. Those two plans are not compatible.

Second, PLAN-08 is bigger than it looks. Moving app/settings/* and app/candidate/[id].tsx into the tab context is not a simple visual change. It changes:
	•	route paths,
	•	every router.push() target,
	•	deep-link behavior,
	•	stack history,
	•	and the back-button semantics PLAN-15 is trying to fix.

That means you need a navigation migration pass, not just a file-move pass. Before implementation, I would require:
	•	a full route inventory,
	•	a map from old paths to new paths,
	•	deep-link expectations,
	•	and a decision about whether candidate detail belongs only under For You or also needs to be reachable from Leaderboard, Home, and Endorsements without feeling like a weird “For You child” route.

The plan also says “authenticated app experience,” but your app is no longer purely authenticated because anonymous access is core to the product. The shell plan needs to say clearly which non-auth screens still live outside tabs and which anonymous-access screens live inside them.

PLAN-10: Quiz improvements — this is the most stale and risky plan in the set

This plan is the least safe to implement as written because it conflicts with multiple already-built foundations.

The biggest problem is that PLAN-10 assumes the quiz still lives in the older onboarding flow and says the home screen should route directly to /(auth)/onboarding/questionnaire. But PLAN-03 already created a standalone app/quiz.tsx screen and explicitly made it accessible from home, For You prompt, and Settings. If engineering followed PLAN-10 literally, it would regress the newer quiz architecture.

The second major problem is the proposal to remove dealbreakers entirely. That is not a local change. Dealbreakers are still embedded in your current product model and cross-plan gating:
	•	PLAN-01 includes dealbreaker completion as one of the onboarding axes,
	•	PLAN-05 uses dealbreakers for the “Most Important” filter gating,
	•	PLAN-06 assumes quiz progression but sits on top of that same capability model.

So before PLAN-10 is implemented, you need a product-level decision:
	•	are dealbreakers being removed from the product,
	•	or only removed from one specific quiz surface,
	•	or renamed into another concept?

Right now the plan treats it as a code cleanup, but it is actually a system-wide product contract change.

There is also a scope mismatch: PLAN-10 talks about grouping issues into Global/National/Local “on the home screen quiz modal,” but the implemented quiz model in PLAN-03 is a standalone screen with predefined district issues already organized into Global/National/Local sections. So a lot of PLAN-10 appears to be describing an older UI that no longer exists in that form.

My recommendation: do not implement PLAN-10 until it is rewritten against the actual current quiz architecture. As written, it is too likely to regress PLAN-03 and destabilize PLAN-01/05.

PLAN-12: For You improvements — promising, but missing core business rules

This plan has good UX instincts, but it is under-specified in the places that matter most.

The biggest issue is the new bookmarking concept. The proposed Bookmark type only has odid, candidateId, and createdAt. That is not enough in your system. Because endorsements are evolving into round-scoped actions and candidates may be eliminated or move out of contention, bookmarks that are later converted into endorsements need more context. At a minimum, you need to decide whether bookmarks are:
	•	round-specific,
	•	district-specific,
	•	portable across rounds,
	•	or purely generic “save for later” objects.

Right now the plan implicitly treats them as “pre-endorsements awaiting verification,” which means round context matters a lot. A candidate bookmarked in Round 1 may be eliminated before the user verifies; a bookmarked candidate from a browsing district may not be endorsable once verified districts are checked. The plan does not address that.

The second issue is that the alignment explainer being reused from candidate detail still references dealbreaker warnings in its current source form, while PLAN-10 wants dealbreakers removed. So PLAN-12 and PLAN-10 are pulling in opposite directions.

The third issue is share gating. Requiring ID verification before sharing a candidate may be intentional, but it is not obviously aligned with the rest of the product. In PLAN-01, the high-friction gates are attached to binding political actions like endorsement and running for office. Sharing is closer to discovery and advocacy. That doesn’t make PLAN-12 wrong, but it means the rule needs a clear product rationale, because otherwise it will feel arbitrary and will hurt organic spread.

I would also be careful about where bookmark state lives. The plan adds bookmark state to userStore, but this should not just be in-memory app state if you expect cross-session persistence and post-verification workflows. It needs a real persisted model and a clear fetch/subscription strategy.

PLAN-13: Leaderboard improvements — needs business-rule hardening before code

This plan is workable, but the mass-endorse design is too naive for the app you have now.

The biggest flaw is that it treats biometric auth as the main gate for endorsement submission. But your actual endorsement rules are stronger than that. Per your current model, a binding endorsement requires:
	•	upgraded account,
	•	email verified,
	•	voter registration verified,
	•	photo ID verified,
	•	and district match.

So local biometrics can be a nice confirmation layer, but not the primary authorization model. The endorse-all path must still reuse the exact same endorsement-eligibility checks as single-candidate endorsement, otherwise you create a bypass.

The second issue is implementation safety. The plan loops through visible candidates and calls endorseCandidate() one by one on the client. That is fragile:
	•	partial success is messy,
	•	network interruptions can leave a half-submitted batch,
	•	retries can be confusing,
	•	and when round-scoped endorsements arrive, you’ll need exact current-round semantics.

This should really become a server-side batch operation or at least a callable function with a single source of truth about what got endorsed and why.

The third issue is that the future-facing notes are stale against your latest contest model. The plan says to filter with isEliminated, but your updated architecture moved to contestStatus. So the “future phase” section should be rewritten before anyone treats it as implementation guidance.

I also think the issue-filter source needs clarification. PLAN-13 copies the user-selected issue pills from For You, but PLAN-09 separately introduced “Apply Filters” on Home as a broader, system-wide policy filter independent of the quiz. You should decide whether leaderboard filtering is:
	•	based on the user’s selected issues,
	•	based on all issue options,
	•	or both.

PLAN-14: Profile fixes — mostly good, but built on shaky dependencies

This plan has several good UI fixes, but it still depends on stale data assumptions.

The biggest one is verification state. The plan uses userProfile?.verificationStatus === 'verified', but your newer account model split verification into multiple dimensions: email, voter registration, and photo ID. So the Profile page should not key off a legacy single-field status unless you explicitly still maintain a derived “fully verified” field somewhere. It should probably use capability selectors instead.

The second issue is that the redesigned Endorsements page assumes bookmarks from PLAN-12 already exist. That is fine as a dependency, but it means PLAN-14 is not independently implementable. More importantly, the page should be designed around round-scoped endorsement history from PLAN-00, not just a flat endorsed/bookmarked split. Your architecture already says “all-time totals” and “current round” are separate concepts, and the endorsements page is one of the places that distinction will matter most.

The third issue is feature flagging. Hiding “Run for Office” via false && is an understandable quick fix, but it is not a good long-term control point. You now have enough product state that this should be driven by a feature flag or config value so that beta/production behavior is intentional and auditable.  

The back-navigation guidance in PLAN-14 is also really just a dependency on PLAN-08 and PLAN-15. I would not solve it locally inside profile screens first.

PLAN-15: Back/cancel fixes — correct instinct, but the rule needs to be smarter

This plan is right that some router.replace() calls are doing the wrong thing for cancel/dismiss flows. But “change them to router.back()” is not always sufficient.

The edge case is when the screen is entered directly — for example, from a deep link, a cold start, or a push from a route that doesn’t exist in history. In those cases, router.back() may do nothing or behave oddly. So before implementation, I would define a shared navigation helper:
	•	if back stack exists → router.back()
	•	otherwise → fall back to an intentional route per screen.  

Also, if PLAN-08 changes the route nesting, the list of “offending” screens and correct back behavior will change. So this audit really belongs after the navigation shell is finalized.

PLAN-16: About the Contest update — good idea, but still contaminated by old round-state assumptions

The direction is right: make the timeline dynamic and driven by contestRounds plus current round. But the implementation text is still mixed with the old model.

The biggest inconsistency is that the plan says selectContestTimeline returns rounds with isActive and isComplete, and the rendering uses round.isComplete to decide whether a round is past. That conflicts with your newer contest-round architecture, where:
	•	partyConfig.currentRoundId is the single source of truth,
	•	round status is derived with selectors like selectRoundStatus,
	•	and you explicitly moved away from persistent isActive/isComplete flags on round docs.

So PLAN-16 needs to be rewritten to use the selectors you already have, not document booleans that the architecture now rejects.

The second issue is data shape drift. The plan says round labels, descriptions, and voting methods can be updated in Firestore without a code change, but your actual ContestRound shape doesn’t appear to include richer descriptive text for this timeline. If you want the timeline to be truly content-driven and admin-editable, you may need either:
	•	timeline-specific description fields in contestRounds,
	•	or a separate presentation map in code.

So I would definitely implement the feature, but only after the plan is corrected to follow the final PLAN-00 model.

One cross-plan conflict you should resolve explicitly: dealbreakers

The largest unresolved product conflict across 10, 12, 14, and older plans is dealbreakers.
	•	PLAN-10 says remove dealbreakers entirely from the app.  
	•	PLAN-12 still assumes the reused alignment explainer content may include dealbreaker warnings from candidate detail.  
	•	PLAN-14 doesn’t directly depend on them much, but it inherits bookmark/endorsement flows that previously interacted with dealbreaker-based filtering.  
	•	PLAN-01 and PLAN-05 still have dealbreaker-driven gating and “Most Important” behavior in the broader product model.

This is not a minor cleanup issue. It is a product-strategy fork. You should decide that before implementation of any of the user-facing improvements that touch alignment, filters, bookmarks, or endorsements.

My practical recommendation on sequencing

I would sequence the fixes like this:

First, unify the shell:
	•	rewrite PLAN-07, PLAN-08, and PLAN-15 as one app-shell/navigation plan.

Second, settle product semantics:
	•	decide whether dealbreakers stay,
	•	decide whether sharing really requires verification,
	•	decide whether bookmarks are generic saves or round-aware pre-endorsements.

Third, update dependent UI plans against the true architecture:
	•	PLAN-12, PLAN-13, PLAN-14, PLAN-16 should all be revised to use the final models from Plans 00–06 rather than older assumptions.

Bottom line

If I were signing off for engineering, I would say:
	•	Ready with minimal revision: none of the unimplemented plans yet.
	•	Closest to implementable after small rewrite: PLAN-16 and PLAN-15.
	•	Needs coordinated shell redesign first: PLAN-07 and PLAN-08.
	•	Needs major rewrite against current architecture: PLAN-10.
	•	Needs business-rule clarification before implementation: PLAN-12 and PLAN-13.
	•	Dependent on PLAN-12 + route architecture cleanup: PLAN-14.

The single most important thing to avoid is implementing these as isolated UI tickets. They are no longer isolated. They now sit on top of a real state machine and a real progressive-permissions model.
