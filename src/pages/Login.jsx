import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'sent'
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })

    if (authError) {
      setError(authError.message || 'Une erreur est survenue, veuillez réessayer.')
      setLoading(false)
      return
    }

    setStep('sent')
    setLoading(false)
  }

  if (step === 'sent') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Link to="/" className="auth-logo">Accessa</Link>

          <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '26px',
            }}>
              📩
            </div>
            <h1 className="auth-title">Vérifiez vos emails</h1>
            <p className="auth-sub" style={{ marginTop: '8px', lineHeight: '1.6' }}>
              Un lien de connexion a été envoyé à{' '}
              <strong style={{ color: '#0f172a' }}>{email}</strong>.<br />
              Cliquez sur ce lien pour accéder à votre espace.
            </p>
          </div>

          <div style={{
            background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: '10px',
            padding: '14px 16px', fontSize: '13px', color: '#64748b', marginBottom: '20px',
          }}>
            📬 Pas reçu ? Vérifiez vos spams ou{' '}
            <button
              onClick={() => { setStep('form'); setEmail(''); setError('') }}
              style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: '600',
                cursor: 'pointer', padding: 0, fontSize: '13px' }}
            >
              réessayez avec une autre adresse
            </button>
            .
          </div>

          <p className="auth-footer">
            <Link to="/" className="auth-link auth-link--muted">← Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Accessa</Link>

        <div className="auth-header">
          <h1 className="auth-title">Se connecter</h1>
          <p className="auth-sub">
            Entrez votre email — nous vous envoyons un lien de connexion instantané.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Adresse email</label>
            <input
              id="login-email"
              type="email"
              className="auth-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="gate-spinner" style={{ width: '14px', height: '14px' }} />
                Envoi en cours…
              </>
            ) : (
              'Recevoir mon lien de connexion'
            )}
          </button>
        </form>

        <p className="auth-legal">
          Connexion sécurisée sans mot de passe. Le lien expire après 1 heure.
        </p>

        <p className="auth-footer">
          <Link to="/" className="auth-link auth-link--muted">← Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  )
}
