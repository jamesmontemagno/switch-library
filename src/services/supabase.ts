import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Only create client if configured
let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

// Export a proxy that handles the unconfigured case
export const supabase = {
  auth: {
    getSession: async () => {
      if (!supabaseClient) {
        return { data: { session: null }, error: null };
      }
      return supabaseClient.auth.getSession();
    },
    onAuthStateChange: (callback: Parameters<SupabaseClient['auth']['onAuthStateChange']>[0]) => {
      if (!supabaseClient) {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
      return supabaseClient.auth.onAuthStateChange(callback);
    },
    signInWithOAuth: async (options: Parameters<SupabaseClient['auth']['signInWithOAuth']>[0]) => {
      if (!supabaseClient) {
        return { data: { provider: '', url: '' }, error: new Error('Supabase not configured') };
      }
      return supabaseClient.auth.signInWithOAuth(options);
    },
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      if (!supabaseClient) {
        return { data: { user: null, session: null }, error: new Error('Supabase not configured') };
      }
      return supabaseClient.auth.signInWithPassword(credentials);
    },
    signUp: async (credentials: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      if (!supabaseClient) {
        return { data: { user: null, session: null }, error: new Error('Supabase not configured') };
      }
      return supabaseClient.auth.signUp(credentials);
    },
    resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
      if (!supabaseClient) {
        return { data: {}, error: new Error('Supabase not configured') };
      }
      return supabaseClient.auth.resetPasswordForEmail(email, options);
    },
    updateUser: async (attributes: { password?: string; email?: string; data?: Record<string, unknown> }) => {
      if (!supabaseClient) {
        return { data: { user: null }, error: new Error('Supabase not configured') };
      }
      return supabaseClient.auth.updateUser(attributes);
    },
    signOut: async () => {
      if (!supabaseClient) {
        return { error: null };
      }
      return supabaseClient.auth.signOut();
    },
  },
  from: (table: string) => {
    if (!supabaseClient) {
      // Return a mock that returns empty results
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            gte: () => Promise.resolve({ count: 0, error: null }),
          }),
        }),
        insert: () => Promise.resolve({ error: null }),
        upsert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: new Error('Supabase not configured') }),
        }),
      };
    }
    return supabaseClient.from(table);
  },
};
