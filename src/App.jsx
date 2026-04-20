import { useState } from 'react'
import { analyzeCompliance, computeScore, computeTotalRisk } from './lib/complianceEngine'
import { fullCompanySearch } from './lib/apiClient'
import Navigation from './components/Navigation'
import Landing from './components/Landing'
import ScorePreview from './components/ScorePreview'
import EmailGate from './components/EmailGate'
import FullReport from './components/FullReport'

export default function App() {
  // View: 'landing' | 'score' | 'email' | 'report'
  const [view, setView] = useState('landing')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Data
  const [company, setCompany] = useState(null)
  const [obligations, setObligations] = useState([])
  const [score, setScore] = useState(0)
  const [bodacc, setBodacc] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [siren, setSiren] = useState('')

  async function handleSearch(sirenInput) {
    const cleaned = sirenInput.replace(/\s/g, '')
    if (cleaned.length !== 9 || !/^\d+$/.test(cleaned)) {
      setError('Le SIREN doit contenir exactement 9 chiffres')
      return
    }
    setError('')
    setLoading(true)
    setSiren(cleaned)

    const result = await fullCompanySearch(cleaned)

    if (!result.success) {
      if (result.error === 'not_found') {
        setError('Aucune entreprise trouvée avec ce SIREN. Vérifiez le numéro.')
      } else {
        setError('Service temporairement indisponible. Réessayez dans quelques secondes.')
      }
      setLoading(false)
      return
    }

    const co = result.company
    setCompany(co)
    setBodacc(result.bodacc || null)

    const obs = analyzeCompliance(co)
    setObligations(obs)
    setScore(computeScore(obs))

    setView('score')
    setLoading(false)

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleUnlockReport() {
    setView('email')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleEmailSubmit({ email, firstName }) {
    setUserEmail(email)
    setView('report')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goHome() {
    setView('landing')
    setCompany(null)
    setObligations([])
    setScore(0)
    setBodacc(null)
    setUserEmail('')
    setError('')
  }

  return (
    <div className="app">
      <Navigation
        onLogoClick={goHome}
        rightLabel={
          view === 'landing' ? 'Conformité administrative' :
          view === 'score' ? 'Score de conformité' :
          view === 'email' ? 'Rapport de conformité' :
          'Rapport détaillé'
        }
      />

      {view === 'landing' && (
        <Landing onSearch={handleSearch} loading={loading} error={error} />
      )}

      {view === 'score' && company && (
        <ScorePreview
          company={company}
          obligations={obligations}
          score={score}
          bodacc={bodacc}
          onUnlock={handleUnlockReport}
          onBack={goHome}
        />
      )}

      {view === 'email' && company && (
        <EmailGate
          score={score}
          totalRisk={computeTotalRisk(obligations)}
          companyName={company.nom_complet || company.nom_raison_sociale}
          siren={siren}
          obligations={obligations}
          onSubmit={handleEmailSubmit}
        />
      )}

      {view === 'report' && company && (
        <FullReport
          company={company}
          obligations={obligations}
          score={score}
          bodacc={bodacc}
          userEmail={userEmail}
          onBack={goHome}
        />
      )}

      <footer className="footer">
        © 2026 Accessa · Conformité administrative pour TPE & PME
      </footer>
    </div>
  )
}
