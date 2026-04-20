import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    if (resetError) {
      setError(resetError.message || 'Une erreur est survenue.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Accessa</Link>

        {sent ? (
          <div className="auth-sent-state">
            <div className="auth-sent-icon">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle cx="22" cy="22" r="22" fill="#eef2ff" />
                <rect x="7" y="13" width="30" height="20" rx="2.5" stroke="#4f46e5" strokeWidth="1.8" />
                <path d="M7 17l15 10 15-10" stroke="#4f46e5" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="auth-title">Email envoyé</h1>
            <p className="auth-sub">
              Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
              Vérifiez vos spams si vous ne le voyez pas.
            </p>
            <Link to="/login" className="btn-primary btn-indigo" style={{ display: 'inline-block', marginTop: '20px' }}>
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Mot de passe oublié</h1>
              <p className="auth-sub">
                Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="fp-email">Email</label>
                <input
                  id="fp-email"
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com"
                  autoComplete="email"
                  required
                />
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>

            <p className="auth-footer">
              <Link to="/login" className="auth-link">← Retour à la connexion</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
