import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// Support both modern publishable keys and legacy anon keys
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  const configured = Boolean(supabaseUrl && supabaseKey);
  console.log('[Supabase Config]', { 
    configured, 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseKey 
  });
  return configured;
};

// Only create client if configured
let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
}

// Type for mock query builder that chains
type MockQueryResult = { data: unknown; error: Error | null; count?: number };
type MockPromise = Promise<MockQueryResult> & MockQueryBuilder;

interface MockQueryBuilder {
  select: (columns?: string, options?: { count?: string; head?: boolean }) => MockPromise;
  eq: (column: string, value: unknown) => MockPromise;
  neq: (column: string, value: unknown) => MockPromise;
  gt: (column: string, value: unknown) => MockPromise;
  gte: (column: string, value: unknown) => MockPromise;
  lt: (column: string, value: unknown) => MockPromise;
  lte: (column: string, value: unknown) => MockPromise;
  like: (column: string, value: string) => MockPromise;
  ilike: (column: string, value: string) => MockPromise;
  is: (column: string, value: unknown) => MockPromise;
  in: (column: string, values: unknown[]) => MockPromise;
  order: (column: string, options?: { ascending?: boolean }) => MockPromise;
  limit: (count: number) => MockPromise;
  range: (from: number, to: number) => MockPromise;
  single: () => MockPromise;
  maybeSingle: () => MockPromise;
}

// Helper to create a chainable mock that handles all cases
const createMockChain = (resolveValue: unknown = null, isError = true): MockPromise => {
  const mockError = isError ? new Error('Supabase not configured') : null;
  const mockResult: MockQueryResult = { 
    data: resolveValue, 
    error: mockError,
    count: Array.isArray(resolveValue) ? resolveValue.length : 0 
  };
  
  // Create the promise base
  const basePromise = Promise.resolve(mockResult);
  
  // Create methods that return new chainable mocks
  const createChainMethods = (): MockQueryBuilder => ({
    select: () => createMockChain(resolveValue, isError),
    eq: () => createMockChain(resolveValue, isError),
    neq: () => createMockChain(resolveValue, isError),
    gt: () => createMockChain(resolveValue, isError),
    gte: () => createMockChain(resolveValue, isError),
    lt: () => createMockChain(resolveValue, isError),
    lte: () => createMockChain(resolveValue, isError),
    like: () => createMockChain(resolveValue, isError),
    ilike: () => createMockChain(resolveValue, isError),
    is: () => createMockChain(resolveValue, isError),
    in: () => createMockChain(resolveValue, isError),
    order: () => createMockChain(resolveValue, isError),
    limit: () => createMockChain(resolveValue, isError),
    range: () => createMockChain(resolveValue, isError),
    single: () => createMockChain(resolveValue, isError),
    maybeSingle: () => createMockChain(resolveValue, isError),
  });
  
  // Combine promise with chain methods
  return Object.assign(basePromise, createChainMethods()) as MockPromise;
};

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
      // Return a comprehensive mock that supports all chaining patterns
      return {
        select: (_columns?: string, options?: { count?: string; head?: boolean }) => createMockChain([], !options?.head),
        insert: () => createMockChain(null, true),
        upsert: () => createMockChain(null, true),
        update: () => createMockChain(null, true),
        delete: () => createMockChain(null, true),
      };
    }
    return supabaseClient.from(table);
  },
};
