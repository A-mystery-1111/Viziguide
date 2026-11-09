import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from './context'
import { requireSupabase, supabase } from '../lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(Boolean(supabase))

    useEffect(() => {
        if (!supabase) return

        let mounted = true
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (mounted) setSession(nextSession)
        })

        void supabase.auth.getSession()
            .then(({ data }) => { if (mounted) setSession(data.session) })
            .catch(() => { if (mounted) setSession(null) })
            .finally(() => { if (mounted) setLoading(false) })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    const value: AuthContextValue = {
        user: session?.user ?? null,
        session,
        loading,
        signUp: (email, password, fullName) => requireSupabase().auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/app`,
                data: fullName ? { full_name: fullName } : undefined,
            },
        }),
        signIn: (email, password) => requireSupabase().auth.signInWithPassword({ email, password }),
        signInWithGoogle: () => requireSupabase().auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/app` },
        }),
        signOut: () => requireSupabase().auth.signOut(),
        resetPassword: (email) => requireSupabase().auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        }),
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
