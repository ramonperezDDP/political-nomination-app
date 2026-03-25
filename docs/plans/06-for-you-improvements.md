# PLAN: For You Page Improvements

## Summary
- Require ID verification before sharing a candidate
- Add a label for the percent alignment explaining what it represents

## Current State
- For You screen: `app/(tabs)/for-you.tsx` (488 lines)
- Share button in PSACard is a placeholder with empty `onPress` (`src/components/feed/PSACard.tsx:252-256`)
- Alignment score displayed in `AlignmentBadge` component but no explanatory label
- User verification status available via `userProfile?.verificationStatus`
- Verify identity screen at `app/(auth)/verify-identity.tsx`

## Files to Modify
- `src/components/feed/PSACard.tsx` — add verification gate on share, add alignment label
- `app/(tabs)/for-you.tsx` — add alignment explanation banner

## Implementation Details

### 1. Gate sharing behind ID verification (`src/components/feed/PSACard.tsx`)

Add verification check before sharing. If unverified, prompt user to verify first:

```tsx
// Add imports
import { Share, Alert } from 'react-native';
import { useAuthStore, useUserStore } from '@/stores';
import { router } from 'expo-router';

// Inside PSACard component, add:
const { userProfile } = useUserStore();
const isVerified = userProfile?.verificationStatus === 'verified';

const handleShare = async () => {
  if (!isVerified) {
    Alert.alert(
      'Verification Required',
      'You need to verify your identity before sharing candidates. Would you like to verify now?',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Verify',
          onPress: () => router.push('/(auth)/verify-identity'),
        },
      ]
    );
    return;
  }

  try {
    await Share.share({
      message: `Check out ${feedItem.candidate.displayName} on AMSP!`,
    });
  } catch (error) {
    console.error('Error sharing:', error);
  }
};
```

Replace the empty share `onPress` with `handleShare`:

```tsx
// Current (line ~252):
<IconButton icon="share-variant" onPress={() => {}} />

// Updated:
<IconButton icon="share-variant" onPress={handleShare} />
```

### 2. Add alignment score explanation label

In `PSACard.tsx`, add a label below or beside the alignment badge:

```tsx
{/* Alignment Badge — already exists, add label */}
<View style={styles.alignmentSection}>
  <AlignmentBadge score={alignmentScore} />
  <Text variant="labelSmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
    Policy Match
  </Text>
</View>
```

### 3. Add explanation banner in For You screen header (`app/(tabs)/for-you.tsx`)

Add a one-time dismissible banner explaining alignment scores:

```tsx
const [showAlignmentInfo, setShowAlignmentInfo] = useState(true);

// In header area, after search/filters:
{showAlignmentInfo && (
  <Card style={styles.infoBanner}>
    <View style={styles.infoBannerContent}>
      <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary} />
      <Text variant="bodySmall" style={styles.infoBannerText}>
        The % alignment shows how closely a candidate's policy positions match your quiz answers.
        Higher scores mean better alignment with your values.
      </Text>
      <IconButton
        icon="close"
        size={16}
        onPress={() => setShowAlignmentInfo(false)}
      />
    </View>
  </Card>
)}
```

Styles:
```typescript
infoBanner: {
  marginHorizontal: 16,
  marginBottom: 8,
  padding: 12,
},
infoBannerContent: {
  flexDirection: 'row',
  alignItems: 'flex-start',
},
infoBannerText: {
  flex: 1,
  marginHorizontal: 8,
  color: theme.colors.outline,
},
```

## Testing
- Tap share on a candidate when unverified → shows verification prompt
- Tap "Verify" in prompt → navigates to verify identity screen
- Tap share when verified → shows native share sheet
- Alignment score has "Policy Match" label beneath it
- Info banner appears on For You page explaining alignment
- Banner can be dismissed with X button
