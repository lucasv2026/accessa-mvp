import { useState } from 'react'
import { formatMoney } from '../lib/complianceEngine'

export default function EmailGate({ score, totalRisk, companyName, siren, onSubmit }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!firstName.trim()) { setError('Veuillez entrer votre prénom'); return }
    if (!lastName.trim()) { setError('Veuillez entrer votre nom'); return }
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Veuillez entrer un email professionnel valide')
      return
    }
    setError('')
    setSending(true)

    // Store email in Google Sheets via webhook
    try {
      const webhookUrl = import.meta.env.VITE_SHEETS_WEBHOOK
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, firstName, lastName, siren, companyName,
            score, totalRisk,
            date: new Date().toISOString(),
          }),
        })
      }
    } catch (err) {
      console.log('Webhook error (non-blocking):', err)
    }

    onSubmit({ email, firstName, lastName })
    setSending(false)
  }

  return (
    <div className="email-gate">
      <div className="email-gate-card">
        <div className="eg-risk-badge">⚠️ {formatMoney(totalRisk)} € de risques identifiés</div>
        <h2>Votre entreprise s'expose à des sanctions</h2>
        <p className="eg-sub">
          <strong>{companyName}</strong> a obtenu un score de <strong style={{color: score >= 80 ? '#16a34a' : score >= 50 ? '#ea580c' : '#dc2626'}}>{score}/100</strong>
        </p>
        <p className="eg-detail">
          Nous avons détecté des obligations non conformes représentant <strong>{formatMoney(totalRisk)} € d'amendes potentielles.</strong> Recevez votre rapport détaillé avec :
        </p>
        <div className="eg-benefits">
          <div className="eg-benefit">📋 Le détail de chaque obligation manquante</div>
          <div className="eg-benefit">💰 Le montant exact de chaque amende encourue</div>
          <div className="eg-benefit">✅ Les actions correctives pas à pas</div>
          <div className="eg-benefit">📄 Les documents que vous pouvez générer directement</div>
        </div>

        <form onSubmit={handleSubmit} className="eg-form">
          <div className="eg-row">
            <input type="text" placeholder="Prénom" value={firstName}
              onChange={e => { setFirstName(e.target.value); setError('') }}
              className="eg-input" required />
            <input type="text" placeholder="Nom" value={lastName}
              onChange={e => { setLastName(e.target.value); setError('') }}
              className="eg-input" required />
          </div>
          <input type="email" placeholder="votre@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            className="eg-input" required />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary btn-indigo btn-lg" disabled={sending} style={{ width: '100%' }}>
            {sending ? 'Préparation du rapport...' : 'Recevoir mon rapport de conformité →'}
          </button>
        </form>

        <div className="eg-trust">
          <span>🔒 Données confidentielles</span>
          <span>📧 Aucun spam</span>
          <span>❌ Désabonnement en 1 clic</span>
        </div>
      </div>
    </div>
  )
}
