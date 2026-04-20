import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'sent'
  const [error, setError] = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: form.email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
        data: {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
        },
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

  // ── Email envoyé ───────────────────────────────────────────────────────────
  if (step === 'sent') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Link to="/" className="auth-logo">Accessa</Link>

          <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '30px',
              boxShadow: '0 4px 16px rgba(79,70,229,0.12)',
            }}>
              📩
            </div>
            <h1 className="auth-title">Vérifiez vos emails</h1>
            <p className="auth-sub" style={{ marginTop: '10px', lineHeight: '1.7' }}>
              Bonjour <strong style={{ color: '#0f172a' }}>{form.firstName}</strong> ! Un lien de
              confirmation a été envoyé à{' '}
              <strong style={{ color: '#0f172a' }}>{form.email}</strong>.<br />
              Cliquez dessus pour accéder à votre espace Accessa.
            </p>
          </div>

          <div style={{
            background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px',
            padding: '16px 18px', fontSize: '13px', color: '#64748b', marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '6px' }}>
              📬 Pas reçu ?
            </strong>
            Vérifiez vos spams, ou{' '}
            <button
              onClick={() => { setStep('form'); setError('') }}
              style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: '600',
                cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}
            >
              réessayez avec une autre adresse
            </button>
            .<br />
            Le lien expire après 1 heure.
          </div>

          <p className="auth-footer">
            <Link to="/" className="auth-link auth-link--muted">← Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Formulaire ─────────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Accessa</Link>

        <div className="auth-header">
          <h1 className="auth-title">Créer mon espace</h1>
          <p className="auth-sub">
            Analysez la conformité de votre entreprise en 2 minutes.
            Aucun mot de passe requis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-row">
            <div className="auth-field">
              <label className="auth-label" htmlFor="su-fn">Prénom</label>
              <input
                id="su-fn"
                type="text"
                className="auth-input"
                value={form.firstName}
                onChange={set('firstName')}
                placeholder="Jean"
                autoComplete="given-name"
                autoFocus
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="su-ln">Nom</label>
              <input
                id="su-ln"
                type="text"
                className="auth-input"
                value={form.lastName}
                onChange={set('lastName')}
                placeholder="Dupont"
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="su-email">Email professionnel</label>
            <input
              id="su-email"
              type="email"
              className="auth-input"
              value={form.email}
              onChange={set('email')}
              placeholder="vous@entreprise.com"
              autoComplete="email"
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
              'Recevoir mon lien de connexion →'
            )}
          </button>
        </form>

        <p className="auth-legal">
          Connexion sécurisée sans mot de passe. Vos données ne sont jamais revendues.
        </p>

        <p className="auth-footer">
          Déjà un compte ?{' '}
          <Link to="/login" className="auth-link">Se connecter</Link>
        </p>
        <p className="auth-footer" style={{ marginTop: '8px' }}>
          <Link to="/" className="auth-link auth-link--muted">← Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  )
}
