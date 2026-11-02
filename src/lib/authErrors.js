export function getGuestSignInErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/anonymous.*(?:disabled|not enabled)|anonymous sign.?in.*disabled/i.test(message)) {
    return 'Guest sign-in is disabled in Supabase. Enable anonymous sign-ins under Authentication → Sign In / Providers, then retry.';
  }
  if (/invalid api key|no api key/i.test(message)) {
    return 'Supabase rejected the publishable key. Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the app environment.';
  }
  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'Could not reach Supabase. Check your internet connection and Supabase project URL.';
  }
  return message ? `Guest sign-in failed: ${message}` : 'Guest sign-in failed. Check Supabase Auth settings and try again.';
}
