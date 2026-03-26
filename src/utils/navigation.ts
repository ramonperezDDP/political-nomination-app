import { router } from 'expo-router';

/**
 * Navigate back safely. If no back stack exists (deep link, cold start),
 * fall back to a specified route.
 */
export function goBack(fallback: string = '/(main)/(home)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
