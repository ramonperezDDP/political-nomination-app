# PLAN: Fix Back/Cancel Button Navigation — NEEDS REDESIGN WITH SHELL PLAN

> **Updated 2026-03-25:** Status reset after branch reset. verify-identity.tsx still uses `router.replace()`. **Must be designed together with PLAN-07 and PLAN-08.**

### Review Notes (Mar 25 feedback)

**`router.back()` is not always sufficient:** When a screen is entered directly (deep link, cold start, push from nonexistent history), `router.back()` may do nothing. Need a shared navigation helper:
- If back stack exists → `router.back()`
- Otherwise → fall back to an intentional route per screen

**Depends on route nesting:** If PLAN-08 changes route structure, the list of "offending" screens and correct back behavior changes. This audit belongs after the navigation shell is finalized.

**Recommendation:** Rewrite as part of unified PLAN-07/08/15 app-shell plan. Do not implement independently.

## Summary

Pressing "Cancel" or "Back" buttons should navigate to the previous page rather than the homepage.

## Current State

- Most stack screens use Expo Router's built-in back button (Stack header), which works correctly  
- Some screens have custom cancel/back buttons that use `router.replace()` to go to a specific route instead of `router.back()`  
- Key offenders:  
  - `app/(auth)/verify-identity.tsx` — skip/cancel may route to a fixed destination  
  - `app/(candidate)/apply.tsx` — cancel button on intro step routes to profile  
  - Candidate profile page has a custom web back button that correctly uses `router.back()` (`app/candidate/[id].tsx:362-371`)

## Files to Modify

- `app/(auth)/verify-identity.tsx` — fix skip/cancel to use `router.back()`  
- `app/(candidate)/apply.tsx` — fix cancel to use `router.back()`  
- Audit all screens for `router.replace()` calls that should be `router.back()`

## Implementation Details

### 1\. Fix verify identity skip/cancel

In `app/(auth)/verify-identity.tsx`, find the skip handler and change:

```ts
// Current (approximate):
const handleSkip = () => {
  router.replace('/(tabs)');  // Goes to homepage
};

// Fixed:
const handleSkip = () => {
  router.back();  // Returns to previous screen
};
```

### 2\. Fix candidate application cancel

In `app/(candidate)/apply.tsx`, find the cancel button on the intro step:

```ts
// Current (approximate):
<SecondaryButton onPress={() => router.replace('/(tabs)/profile')}>
  Cancel
</SecondaryButton>

// Fixed:
<SecondaryButton onPress={() => router.back()}>
  Cancel
</SecondaryButton>
```

### 3\. Audit all router.replace() calls

Search for `router.replace` across the codebase. Each usage should be evaluated:

- **Legitimate uses of `router.replace()`:**  
    
  - After sign-out → replace with login screen (prevents back to authenticated state)  
  - After completing onboarding → replace with home (prevents back to onboarding)  
  - After sign-in → replace with home


- **Should be changed to `router.back()`:**  
    
  - Cancel buttons that return to "where you came from"  
  - Close/dismiss actions on modal-like screens  
  - Skip buttons that simply dismiss the current screen

### 4\. Add consistent back header to all stack screens

Ensure all stack navigators provide a back button:

In `app/settings/_layout.tsx`, verify:

```
<Stack
  screenOptions={{
    headerBackTitle: 'Back',  // or the parent screen name
    // ...
  }}
/>
```

In `app/(candidate)/_layout.tsx`, verify the same.

## Testing

- From Home → tap Verify Identity → tap Skip → returns to Home (not a fixed route)  
- From Profile → tap Verify Identity → tap Skip → returns to Profile  
- From Candidate Apply → tap Cancel → returns to where they came from  
- After sign-out, back button does NOT return to authenticated screens  
- After onboarding completion, back button does NOT return to onboarding

