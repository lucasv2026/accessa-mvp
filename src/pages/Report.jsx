import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fullCompanySearch } from '../lib/apiClient'
import { analyzeCompliance, computeScore } from '../lib/complianceEngine'
import FullReport from '../components/FullReport'
import Navigation from '../components/Navigation'

export default function Report() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const siren = searchParams.get('siren')
  const loadingRef = useRef(false)

  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [reportData, setReportData] = useState(null)

  useEffect(() => {
    let mounted = true

    async function tryLoad(session) {
      if (loadingRef.current || !mounted) return
      loadingRef.current = true
      await loadReport(session.user, siren, {
        mounted: () => mounted,
        setStatus,
        setErrorMsg,
        setReportData,
      })
    }

    // Vérifier session existante (cas rechargement)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) tryLoad(session)
    })

    // Écouter le retour du lien magique
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        tryLoad(session)
      } else if (event === 'SIGNED_OUT') {
        if (mounted) navigate('/login')
      }
    })

    // Timeout si le token n'arrive pas
    const timeout = setTimeout(() => {
      if (mounted && !loadingRef.current) {
        setErrorMsg('Lien expiré ou invalide. Veuillez relancer une analyse.')
        setStatus('error')
      }
    }, 10000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [siren, navigate])

  if (status === 'loading') {
    return (
      <div className="app">
        <Navigation onLogoClick={() => navigate('/')} rightLabel="Rapport" />
        <div className="report-loading">
          <div className="report-loading-ring">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="#e4e4e7" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20"
                stroke="#4f46e5"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="31.4 94.2"
                className="report-loading-arc"
              />
            </svg>
          </div>
          <p className="report-loading-text">Chargement de votre rapport…</p>
          <p className="report-loading-hint">Vérification de l'accès en cours</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="app">
        <Navigation onLogoClick={() => navigate('/')} rightLabel="Rapport" />
        <div className="report-error">
          <div className="report-error-icon">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="24" stroke="#fecaca" strokeWidth="2" fill="#fef2f2" />
              <path d="M26 16v14M26 34v2" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="report-error-title">Accès impossible</h2>
          <p className="report-error-msg">{errorMsg}</p>
          <button className="btn-primary btn-indigo" onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Navigation onLogoClick={() => navigate('/')} rightLabel="Rapport détaillé" />
      <FullReport
        company={reportData.company}
        obligations={reportData.obligations}
        score={reportData.score}
        bodacc={reportData.bodacc}
        userEmail={reportData.userEmail}
        onBack={() => navigate('/')}
      />
      <footer className="footer">
        © 2026 Accessa · Conformité administrative pour TPE & PME
      </footer>
    </div>
  )
}

async function loadReport(user, siren, { mounted, setStatus, setErrorMsg, setReportData }) {
  if (!siren) {
    if (mounted()) {
      setErrorMsg('SIREN manquant dans le lien. Veuillez relancer une analyse depuis l\'accueil.')
      setStatus('error')
    }
    return
  }

  try {
    // Charger données entreprise + lead en parallèle
    const [companyResult, { data: leads }] = await Promise.all([
      fullCompanySearch(siren),
      supabase
        .from('leads')
        .select('obligations, score, total_risk, first_name')
        .eq('email', user.email)
        .eq('siren', siren)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    if (!companyResult.success) {
      if (mounted()) {
        setErrorMsg('Impossible de charger les données de l\'entreprise.')
        setStatus('error')
      }
      return
    }

    const company = companyResult.company
    let obligations
    let score

    if (leads && leads.length > 0 && leads[0].obligations?.length > 0) {
      obligations = typeof leads[0].obligations === 'string'
        ? JSON.parse(leads[0].obligations)
        : leads[0].obligations
      score = leads[0].score || computeScore(obligations)
    } else {
      obligations = analyzeCompliance(company)
      score = computeScore(obligations)
    }

    if (mounted()) {
      setReportData({
        company,
        bodacc: companyResult.bodacc || null,
        obligations,
        score,
        userEmail: user.email,
      })
      setStatus('ready')
    }
  } catch (err) {
    console.error('[Report] loadReport error:', err)
    if (mounted()) {
      setErrorMsg('Une erreur est survenue lors du chargement du rapport.')
      setStatus('error')
    }
  }
}
