import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`

export default function EmailGate({ siren, score, totalRisk, companyName, obligations }) {
  const [step, setStep] = useState('form') // 'form' | 'sending' | 'sent' | 'error'
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  const riskFormatted = totalRisk > 0 ? totalRisk.toLocaleString('fr-FR') + ' €' : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setErrorMsg('')
    setLoading(true)

    try {
      // 1. Sauvegarder le lead dans Supabase
      const { data: insertData, error: insertError } = await supabase
        .from('leads')
        .insert([{
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          company_name: companyName,
          siren,
          score,
          total_risk: totalRisk,
          obligations: obligations || [],
        }])
        .select('id, siren, email')

      if (insertError) {
        // Non bloquant — on continue quand même l'envoi email
        console.error('[EmailGate] Lead insert error:', insertError.message, insertError.details)
      } else {
        console.log('[EmailGate] Lead saved:', insertData)
      }

      // 2. Envoyer email personnalisé via Resend (Edge Function publique, verify_jwt=false)
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName,
          score,
          totalRisk,
          siren,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('[EmailGate] Edge function error:', errData)
        throw new Error(errData.error || `Erreur serveur (${res.status})`)
      }

      setStep('sent')
    } catch (err) {
      console.error('[EmailGate]', err)
      setErrorMsg(err.message || "Erreur lors de l'envoi, merci de réessayer.")
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  // ── État envoyé ───────────────────────────────────────────────────────────
  if (step === 'sent') {
    return (
      <div className="gate-wrap">
        <div className="gate-card gate-card--sent">
          <div className="gate-sent-icon">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#eef2ff" />
              <rect x="9" y="16" width="34" height="22" rx="3" stroke="#4f46e5" strokeWidth="2" />
              <path d="M9 20l17 11 17-11" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="gate-sent-title">Votre rapport est en route</h2>
          <p className="gate-sent-body">
            📩 Votre rapport est en cours d'envoi. Vérifiez votre email{' '}
            <strong>{email}</strong> pour accéder à votre analyse complète.
          </p>
          <div className="gate-sent-hint">
            <span>Pas reçu ? Vérifiez vos spams.</span>
            <button className="gate-resend-btn" onClick={() => { setStep('form'); setErrorMsg('') }}>
              Modifier l'adresse
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulaire ───────────────────────────────────────────────────────────
  return (
    <div className="gate-wrap">
      {/* Bandeau score */}
      <div className="gate-preview">
        <div className="gate-preview-score" style={{ color: scoreColor }}>
          <span className="gate-preview-num">{score}</span>
          <span className="gate-preview-denom">/100</span>
        </div>
        <div className="gate-preview-info">
          <p className="gate-preview-company">{companyName}</p>
          {riskFormatted && (
            <p className="gate-preview-risk">{riskFormatted} de risques identifiés</p>
          )}
        </div>
        <div className="gate-preview-lock">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Rapport verrouillé
        </div>
      </div>

      {/* Formulaire principal */}
      <div className="gate-card">
        <div className="gate-header">
          <span className="gate-badge">Accès confidentiel</span>
          <h2 className="gate-title">Recevez votre rapport complet</h2>
          <p className="gate-subtitle">
            Vos obligations détaillées, actions correctives et risques financiers
            vous seront envoyés directement par email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="gate-form">
          <div className="gate-row">
            <div className="gate-field">
              <label className="gate-label" htmlFor="gate-fn">Prénom</label>
              <input
                id="gate-fn"
                type="text"
                className="gate-input"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jean"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="gate-field">
              <label className="gate-label" htmlFor="gate-ln">Nom</label>
              <input
                id="gate-ln"
                type="text"
                className="gate-input"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Dupont"
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="gate-field">
            <label className="gate-label" htmlFor="gate-email">Email professionnel</label>
            <input
              id="gate-email"
              type="email"
              className="gate-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              autoComplete="email"
              required
            />
          </div>

          {(step === 'error' || errorMsg) && (
            <div className="gate-error">
              {errorMsg || "Erreur lors de l'envoi, merci de réessayer."}
            </div>
          )}

          <button type="submit" className="gate-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="gate-spinner" />
                Envoi en cours…
              </>
            ) : (
              <>
                Recevoir mon rapport
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          <p className="gate-legal">
            Vos données ne sont jamais revendues. Accès instantané, sans abonnement imposé.
          </p>
        </form>

        <div className="gate-features">
          <div className="gate-feature">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1.5" y="5.5" width="10" height="7" rx="1.5" stroke="#4f46e5" strokeWidth="1.3" />
              <path d="M4 5.5V3.5a2.5 2.5 0 015 0v2" stroke="#4f46e5" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Données sécurisées
          </div>
          <div className="gate-feature">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="#4f46e5" strokeWidth="1.3" />
              <path d="M6.5 3.5v3l2 1.5" stroke="#4f46e5" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Email immédiat
          </div>
          <div className="gate-feature">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5l3 3 6-6" stroke="#4f46e5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Aucun spam
          </div>
        </div>
      </div>
    </div>
  )
}
