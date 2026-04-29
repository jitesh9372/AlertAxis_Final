// ============================================================
// supabaseClient.js
// Initializes the Supabase client and exports reusable auth helpers.
// This file is the single source of truth for Supabase connectivity
// across the entire AlertAxis application.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG } from './constants';

// Create and export the Supabase client instance using the project URL
// and publishable (anon) key from the centralized APP_CONFIG constants.
// This client is used throughout the app for:
//   - Database queries (select, insert, update, delete)
//   - Authentication (sign in, sign out, session management)
//   - Storage (file uploads, signed URLs)
//   - Realtime subscriptions
export const supabase = createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

// ------------------------------------------------------------
// signInWithGoogle
// Triggers the OAuth sign-in flow with Google as the provider.
// On success, Supabase redirects the user back to the app's
// root URL ('/') after authentication is complete.
// Returns: { error } — null if successful, or an error object.
// ------------------------------------------------------------
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/' // Redirect back to home after login
    }
  });
  return { error };
};
