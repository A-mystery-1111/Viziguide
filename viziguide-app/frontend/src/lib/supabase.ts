import { createClient, type SupabaseClient, type User, type Session, type AuthResponse } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const LOCAL_STORAGE_KEY = 'viziguide_local_user'

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }
}

const listeners: Array<(event: string, session: Session | null) => void> = []

function notify(event: string, session: Session | null) {
  listeners.forEach((cb) => cb(event, session))
}

function makeSession(user: User): Session {
  return {
    access_token: 'local-demo-token',
    refresh_token: 'local-demo-refresh-token',
    expires_in: 3600 * 24 * 7,
    token_type: 'bearer',
    user,
  }
}

// Fallback mock client for Local/Demo Mode when Supabase credentials are not provided
const localMockClient: any = {
  auth: {
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      listeners.push(callback)
      const user = getStoredUser()
      const session = user ? makeSession(user) : null
      callback('INITIAL_SESSION', session)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const index = listeners.indexOf(callback)
              if (index >= 0) listeners.splice(index, 1)
            },
          },
        },
      }
    },

    async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
      const user = getStoredUser()
      return { data: { session: user ? makeSession(user) : null }, error: null }
    },

    async signUp({
      email,
      options,
    }: {
      email: string
      password?: string
      options?: { data?: { full_name?: string }; emailRedirectTo?: string }
    }): Promise<AuthResponse> {
      const user: User = {
        id: 'user_' + Math.random().toString(36).substring(2, 10),
        app_metadata: {},
        user_metadata: {
          full_name: options?.data?.full_name || email.split('@')[0],
          name: options?.data?.full_name || email.split('@')[0],
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email,
      } as User

      saveUser(user)
      const session = makeSession(user)
      notify('SIGNED_IN', session)
      return { data: { user, session }, error: null }
    },

    async signInWithPassword({ email }: { email: string; password?: string }): Promise<AuthResponse> {
      let user = getStoredUser()
      if (!user || user.email !== email) {
        user = {
          id: 'user_' + Math.random().toString(36).substring(2, 10),
          app_metadata: {},
          user_metadata: {
            full_name: email.split('@')[0],
            name: email.split('@')[0],
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email,
        } as User
      }

      saveUser(user)
      const session = makeSession(user)
      notify('SIGNED_IN', session)
      return { data: { user, session }, error: null }
    },

    async signInWithOAuth({ provider: _provider, options: _options }: any): Promise<{ data: { provider: string; url: string }; error: null }> {
      const user: User = {
        id: 'user_google_' + Math.random().toString(36).substring(2, 10),
        app_metadata: {},
        user_metadata: {
          full_name: 'Demo Google User',
          name: 'Demo Google User',
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: 'user@gmail.com',
      } as User

      saveUser(user)
      const session = makeSession(user)
      notify('SIGNED_IN', session)
      return { data: { provider: 'google', url: `${window.location.origin}/app` }, error: null }
    },

    async signOut(): Promise<{ error: null }> {
      saveUser(null)
      notify('SIGNED_OUT', null)
      return { error: null }
    },

    async updateUser({ password: _ }: { password: string }): Promise<{ data: { user: User | null }; error: null }> {
      const user = getStoredUser()
      return { data: { user }, error: null }
    },

    async resetPasswordForEmail(_email: string, _options?: any): Promise<{ data: Record<string, never>; error: null }> {
      return { data: {}, error: null }
    },
  },
}

export const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (localMockClient as SupabaseClient)

export function requireSupabase(): SupabaseClient {
  return supabase
}
