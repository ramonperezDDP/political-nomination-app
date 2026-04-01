🧭 EPIC 1 — Header & Contest Rounds UI

⸻

🎫 TICKET 1.1 — Redesign Contest Rounds Indicator (Layout + Styling)

Description
Redesign the contest rounds indicator UI to match updated design feedback. The current layout appears misaligned and visually inconsistent. Update to a centered, evenly spaced layout with improved typography and purple color scheme.

Requirements
	•	Center-align all round labels horizontally
	•	Even spacing between all rounds
	•	Replace red styling with purple theme
	•	Apply tighter typography (reduced spacing, slightly smaller font)
	•	Ensure labels are consistently formatted:
	•	Endorsement One
	•	Endorsement Two
	•	Endorsement Three
	•	Virtual Town Hall
	•	Debate
	•	Final Results

Acceptance Criteria
	•	All round labels are horizontally centered
	•	Purple styling replaces red throughout
	•	Typography is consistent across all labels
	•	No visual overlap or truncation on small screens

Dependencies
	•	Uses currentRoundId from config store (PLAN-00)

⸻

🎫 TICKET 1.2 — Ensure Rounds Indicator Consistency Across Screens

Description
Ensure the updated rounds indicator renders consistently across all primary screens.

Acceptance Criteria
	•	Rounds indicator visible and styled correctly on:
	•	Home
	•	For You
	•	Leaderboard
	•	Candidate Detail
	•	Current round is clearly highlighted
	•	No layout shifts between screens

⸻

🧭 EPIC 2 — App Header Consistency

⸻

🎫 TICKET 2.1 — Add AppHeader to Profile Screen

Description
The profile screen currently does not include the AppHeader, creating inconsistency with the rest of the app. Add AppHeader to the profile screen while preserving navigation behavior.

Acceptance Criteria
	•	AppHeader appears on Profile screen
	•	District selector works correctly
	•	Current round label updates correctly
	•	No overlap with profile content
	•	Back navigation still functions correctly

Dependencies
	•	App shell architecture (PLAN-17)

⸻

🧭 EPIC 3 — Home Screen Action Section

⸻

🎫 TICKET 3.1 — Add Action Menu Below Quiz

Description
Add a new action section directly below the quiz module on the home screen with the following items in order.

Items (in order)
	1.	Filter … by Quiz answer
	2.	Search … by name & location
	3.	Verify Identity … learn how this works
	4.	Submit Endorsements … learn how this works
	5.	About the Contest

Acceptance Criteria
	•	Section appears directly below quiz
	•	Items appear in correct order
	•	Each item is tappable
	•	Visual style consistent with app design

⸻

🎫 TICKET 3.2 — Implement Filter Action

Description
Hook “Filter … by Quiz answer” to existing filter system.

Acceptance Criteria
	•	Opens filter UI
	•	Applies question-based filtering (PLAN-10C)
	•	No legacy issue-based logic used

⸻

🎫 TICKET 3.3 — Implement Search Action

Description
Add search functionality triggered from the home action menu.

Scope
	•	Search by candidate name
	•	Search by location (district/state)

Acceptance Criteria
	•	Search UI opens from action
	•	Results update dynamically
	•	Handles empty states

⸻

🧭 EPIC 4 — Modal System

⸻

🎫 TICKET 4.1 — Build Reusable Modal Component

Description
Create a reusable modal component for informational popups.

Requirements
	•	Title
	•	Scrollable content
	•	Supports links
	•	Close via:
	•	X button
	•	swipe down
	•	tap outside

Acceptance Criteria
	•	Modal reusable across multiple features
	•	Handles long content gracefully
	•	Works on iOS and Android

⸻

🎫 TICKET 4.2 — Verify Identity Modal

Description
Implement modal for identity verification explanation.

Acceptance Criteria
	•	Opens from action menu
	•	Displays full content correctly  
	•	Donation link opens externally

⸻

🎫 TICKET 4.3 — Submit Endorsements Modal

Description
Implement modal explaining endorsement submission process.

Acceptance Criteria
	•	Explains bookmark → endorse flow
	•	Explains identity requirement
	•	Includes donation link
	•	Matches copy exactly  

⸻

🎫 TICKET 4.4 — About the Contest Modal

Description
Implement modal showing contest timeline and explanation.

Acceptance Criteria
	•	Weekly demo timeline displayed
	•	Real contest timeline displayed
	•	Proper formatting (bullets, spacing)

⸻

🧭 EPIC 5 — FAQ System

⸻

🎫 TICKET 5.1 — Create FAQ Data Model

Description
Define structured FAQ data model grouped by section.

Sections
	•	Endorsement Rounds
	•	Virtual Town Hall
	•	Debate
	•	Final Results

Acceptance Criteria
	•	Each FAQ has question + answer
	•	Supports links and formatting

⸻

🎫 TICKET 5.2 — Build FAQ UI (Accordion)

Description
Create expandable FAQ UI component.

Acceptance Criteria
	•	Sections collapsible/expandable
	•	Smooth animations
	•	Mobile-friendly layout

⸻

🎫 TICKET 5.3 — Integrate FAQ into About Modal

Acceptance Criteria
	•	FAQ visible within About modal
	•	Proper grouping and spacing

⸻

🧭 EPIC 6 — Endorsement UX

⸻

🎫 TICKET 6.1 — Add “Endorse En Masse” Button

Description
Add batch endorsement capability.

Acceptance Criteria
	•	Button visible on Leaderboard
	•	Uses bookmarked candidates
	•	Clear labeling

⸻

🎫 TICKET 6.2 — Gate Endorsements with Verification

Acceptance Criteria
	•	Non-verified users see modal
	•	Verified users proceed normally
	•	Consistent with Phase 2 rules

⸻

🧭 EPIC 7 — Content & Copy

⸻

🎫 TICKET 7.1 — Standardize Contest Terminology

Acceptance Criteria
	•	All screens use consistent round naming
	•	No legacy terms remain

⸻

🎫 TICKET 7.2 — Remove Deprecated Language

Acceptance Criteria
	•	No “Top Picks”
	•	No dealbreaker references
	•	Consistent quiz-based language

⸻

🧭 EPIC 8 — Data & Logic Integration

⸻

🎫 TICKET 8.1 — Ensure Quiz-Based Filtering Only

Acceptance Criteria
	•	Filtering uses question responses only
	•	No issue-based logic remains

⸻

🎫 TICKET 8.2 — Validate Endorsement Flow

Acceptance Criteria
	•	Bookmark → endorse works
	•	Round-scoped logic enforced
	•	Lock after submission enforced

⸻

🎫 TICKET 8.3 — Eligibility Enforcement

Acceptance Criteria
	•	Verification required for endorsement
	•	Not required for browsing/bookmarking

⸻

🧭 EPIC 9 — QA & Testing

⸻

🎫 TICKET 9.1 — Modal QA

Acceptance Criteria
	•	All modals open/close correctly
	•	Links work
	•	Content renders correctly

⸻

🎫 TICKET 9.2 — Rounds UI QA

Acceptance Criteria
	•	Indicator matches current round
	•	Visual consistency across screens

⸻

🎫 TICKET 9.3 — Endorsement QA

Acceptance Criteria
	•	Endorsements submit correctly
	•	Locking enforced
	•	Mass endorse works reliably

