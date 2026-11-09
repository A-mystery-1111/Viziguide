import { createContext } from 'react'
import type { AuthResponse, Session, User } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabase'

export type AuthContextValue = {
    user: User | null
    session: Session | null
    loading: boolean
    signUp: (email: string, password: string, fullName?: string) => Promise<AuthResponse>
    signIn: (email: string, password: string) => Promise<AuthResponse>
    signInWithGoogle: () => ReturnType<ReturnType<typeof requireSupabase>['auth']['signInWithOAuth']>
    signOut: () => ReturnType<ReturnType<typeof requireSupabase>['auth']['signOut']>
    resetPassword: (email: string) => ReturnType<ReturnType<typeof requireSupabase>['auth']['resetPasswordForEmail']>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)