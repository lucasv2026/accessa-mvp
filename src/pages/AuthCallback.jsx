import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const siren = searchParams.get('siren')
  const code = searchParams.get('code')         // PKCE flow (signInWithOtp)
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      // ── PKCE flow: ?code=... ──────────────────────────────────────────────
      if (code) {
        const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchErr) {
          console.error('[AuthCallback] exchangeCodeForSession:', exchErr.message)
          setError('Lien expiré ou invalide. Veuillez recommencer.')
          return
        }
        const dest = siren ? `/dashboard?siren=${encodeURIComponent(siren)}` : '/dashboard'
        navigate(dest, { replace: true })
        return
      }

      // ── Implicit / hash flow: #access_token=... (from generateLink) ───────
      // supabase-js auto-processes the hash and fires SIGNED_IN.
      // Just wait for the session to appear.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const dest = siren ? `/dashboard?siren=${encodeURIComponent(siren)}` : '/dashboard'
        navigate(dest, { replace: true })
        return
      }

      // Fall back to listening for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
        if (event === 'SIGNED_IN' && sess) {
          subscription.unsubscribe()
          const dest = siren ? `/dashboard?siren=${encodeURIComponent(siren)}` : '/dashboard'
          navigate(dest, { replace: true })
        }
      })

      // Timeout — if nothing happens in 12s, show error
      const timeout = setTimeout(() => {
        subscription.unsubscribe()
        setError('Lien expiré ou invalide. Veuillez recommencer.')
      }, 12000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    handleCallback()
  }, [navigate, siren, code]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: '16px', padding: '40px 48px', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '420px', width: '100%',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
            Lien invalide
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px', lineHeight: '1.6' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: 'white', fontSize: '15px', fontWeight: '600',
            }}
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          border: '3px solid #e2e8f0', borderTopColor: '#4f46e5',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
        }} />
        <p style={{ color: '#0f172a', fontWeight: '600', fontSize: '16px', marginBottom: '6px' }}>
          Connexion en cours…
        </p>
        <p style={{ color: '#94a3b8', fontSize: '13px' }}>
          Vous allez être redirigé vers votre rapport
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
