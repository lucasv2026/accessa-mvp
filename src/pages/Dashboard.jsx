import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fullCompanySearch } from '../lib/apiClient'
import { analyzeCompliance, computeScore, computeTotalRisk } from '../lib/complianceEngine'

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(n) { return new Intl.NumberFormat('fr-FR').format(n || 0) }

function scoreColor(s) { return s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626' }
function scoreBg(s)    { return s >= 80 ? '#f0fdf4' : s >= 50 ? '#fffbeb' : '#fef2f2' }
function scoreBorder(s){ return s >= 80 ? '#bbf7d0' : s >= 50 ? '#fde68a' : '#fecaca' }
function scoreLabel(s) { return s >= 80 ? 'Protégé' : s >= 50 ? 'Risques modérés' : 'Exposition critique' }
function scoreDetail(s){
  return s >= 80
    ? "Votre entreprise est bien couverte contre les risques réglementaires."
    : s >= 50
    ? "Quelques obligations nécessitent votre attention."
    : "Des actions urgentes sont requises pour protéger votre activité."
}

// complianceEngine fields: d=domain, n=label, s=status, penalty, t=description, consequence, action, source
const S = {
  ok:   { label:'Conforme',        color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
  check:{ label:'À vérifier',      color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
  warn: { label:'Non conforme',    color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
  bad:  { label:'Critique',        color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
  doc:  { label:'Document requis', color:'#4f46e5', bg:'#eef2ff', border:'#c7d2fe' },
  info: { label:'À anticiper',     color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe' },
  reco: { label:'Recommandé',      color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc' },
}

const DOMAIN_LABEL = {
  fiscal:'Fiscal', social:'Social / RH',
  assurances:'Assurances', juridique:'Juridique', certifications:'Certifications',
}
const DOMAIN_ICON = {
  fiscal:'📊', social:'👥', assurances:'🛡️', juridique:'⚖️', certifications:'📜',
}

// ─── Shared design tokens ─────────────────────────────────────────────────

const CARD = {
  background: 'white', borderRadius: '16px',
  border: '1px solid #f1f5f9',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
}

const BTN_PRIMARY = {
  display:'inline-flex', alignItems:'center', gap:'6px',
  padding:'10px 20px',
  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
  color:'white', border:'none', borderRadius:'10px',
  fontSize:'14px', fontWeight:'600', cursor:'pointer',
  boxShadow:'0 4px 12px rgba(79,70,229,0.25)',
}
const BTN_GHOST = {
  display:'inline-flex', alignItems:'center', gap:'6px',
  padding:'8px 16px',
  background:'transparent', color:'#4f46e5',
  border:'1.5px solid #c7d2fe', borderRadius:'8px',
  fontSize:'13px', fontWeight:'600', cursor:'pointer',
}

// ─── Sub-components ────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'system-ui', background:'#f8fafc' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', borderRadius:'50%',
          border:'3px solid #e2e8f0', borderTopColor:'#4f46e5',
          animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <p style={{ color:'#94a3b8', fontSize:'14px' }}>Chargement...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function OnboardingSearch({ user, onAnalysisDone }) {
  const [siren, setSiren]         = useState('')
  const [step, setStep]           = useState('idle') // idle | searching | confirm | analyzing | error
  const [company, setCompany]     = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    const cleaned = siren.replace(/\s+/g, '').trim()
    if (cleaned.length !== 9 || !/^\d+$/.test(cleaned)) {
      setErrorMsg('Le numéro SIREN doit contenir exactement 9 chiffres.')
      return
    }
    setErrorMsg('')
    setStep('searching')

    const result = await fullCompanySearch(cleaned)
    if (!result.success) {
      setErrorMsg("Entreprise introuvable. Vérifiez le numéro SIREN.")
      setStep('idle')
      return
    }
    setCompany({ ...result.company, siren: cleaned })
    setStep('confirm')
  }

  async function handleAnalyze() {
    setStep('analyzing')

    const obligations = analyzeCompliance(company)
    const score       = computeScore(obligations)
    const total_risk  = computeTotalRisk(obligations)
    const name        = company.nom_complet || company.nom_raison_sociale || 'Mon entreprise'

    // Save to DB and link to authenticated user
    const { data: lead } = await supabase
      .from('leads')
      .insert([{
        email:        user.email,
        first_name:   user.user_metadata?.first_name || '',
        last_name:    user.user_metadata?.last_name  || '',
        company_name: name,
        siren:        company.siren,
        score,
        total_risk,
        obligations,
        user_id:      user.id,
      }])
      .select('*')
      .single()

    const finalLead = lead || {
      id: null, email: user.email, company_name: name,
      siren: company.siren, score, total_risk, obligations,
      created_at: new Date().toISOString(),
    }

    onAnalysisDone({
      ...finalLead,
      obligations: Array.isArray(finalLead.obligations) ? finalLead.obligations : obligations,
    })
  }

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || ''

  return (
    <div style={{ maxWidth:'600px', margin:'60px auto', padding:'0 16px' }}>

      {/* Welcome header */}
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'52px', marginBottom:'16px' }}>👋</div>
        <h2 style={{ fontSize:'26px', fontWeight:'800', color:'#0f172a',
          marginBottom:'10px', letterSpacing:'-0.5px' }}>
          Bonjour{firstName ? ` ${firstName}` : ''} !
        </h2>
        <p style={{ color:'#64748b', fontSize:'16px', lineHeight:'1.6', maxWidth:'440px', margin:'0 auto' }}>
          Pour afficher votre rapport de conformité, entrez le SIREN de votre entreprise.
          L'analyse prend moins de 5 secondes.
        </p>
      </div>

      {/* Search card */}
      <div style={{ ...CARD, padding:'32px 36px' }}>

        {step !== 'confirm' && step !== 'analyzing' && (
          <form onSubmit={handleSearch}>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600',
              color:'#374151', marginBottom:'10px' }}>
              Numéro SIREN (9 chiffres)
            </label>
            <div style={{ display:'flex', gap:'10px' }}>
              <input
                type="text"
                value={siren}
                onChange={e => { setSiren(e.target.value); setErrorMsg('') }}
                placeholder="Ex : 552 032 534"
                maxLength={11}
                style={{
                  flex:1, padding:'12px 16px', borderRadius:'10px',
                  border:'1.5px solid #e2e8f0', fontSize:'16px', fontFamily:'monospace',
                  outline:'none', letterSpacing:'0.05em',
                  background: step === 'searching' ? '#f8fafc' : 'white',
                }}
                disabled={step === 'searching'}
                autoFocus
              />
              <button type="submit" disabled={step === 'searching'} style={{
                ...BTN_PRIMARY, padding:'12px 24px', whiteSpace:'nowrap',
                opacity: step === 'searching' ? 0.7 : 1,
              }}>
                {step === 'searching' ? (
                  <>
                    <span style={{ display:'inline-block', width:'14px', height:'14px',
                      borderRadius:'50%', border:'2px solid rgba(255,255,255,0.4)',
                      borderTopColor:'white', animation:'spin 0.7s linear infinite' }} />
                    Recherche…
                  </>
                ) : 'Rechercher'}
              </button>
            </div>
            {errorMsg && (
              <p style={{ marginTop:'10px', fontSize:'13px', color:'#dc2626' }}>{errorMsg}</p>
            )}
            <p style={{ marginTop:'12px', fontSize:'12px', color:'#94a3b8' }}>
              💡 Vous trouvez votre SIREN sur votre Kbis, avis de situation SIRENE ou sur data.inpi.fr
            </p>
          </form>
        )}

        {/* Confirmation step */}
        {step === 'confirm' && company && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'16px' }}>🏢</div>
            <p style={{ fontSize:'13px', color:'#94a3b8', textTransform:'uppercase',
              letterSpacing:'0.08em', marginBottom:'6px' }}>Entreprise trouvée</p>
            <h3 style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a',
              marginBottom:'6px', letterSpacing:'-0.3px' }}>
              {company.nom_complet || company.nom_raison_sociale}
            </h3>
            <p style={{ fontSize:'14px', color:'#64748b', marginBottom:'28px' }}>
              SIREN {company.siren}
              {company.activite_principale && ` · ${company.activite_principale}`}
            </p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button
                onClick={() => { setStep('idle'); setCompany(null) }}
                style={{ ...BTN_GHOST, padding:'11px 22px' }}
              >
                ← Modifier
              </button>
              <button onClick={handleAnalyze} style={{ ...BTN_PRIMARY, padding:'11px 28px' }}>
                Lancer l'analyse →
              </button>
            </div>
          </div>
        )}

        {/* Analyzing step */}
        {step === 'analyzing' && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ width:'44px', height:'44px', borderRadius:'50%',
              border:'3px solid #e2e8f0', borderTopColor:'#4f46e5',
              animation:'spin 0.8s linear infinite', margin:'0 auto 20px' }} />
            <p style={{ fontWeight:'600', color:'#0f172a', fontSize:'15px', marginBottom:'6px' }}>
              Analyse en cours…
            </p>
            <p style={{ color:'#94a3b8', fontSize:'13px' }}>
              Nous vérifions vos obligations réglementaires
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function ScoreCircle({ score }) {
  const r = 76, circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = scoreColor(score)
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ flexShrink:0 }}>
      <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transform:'rotate(-90deg)', transformOrigin:'90px 90px',
          transition:'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x="90" y="83" textAnchor="middle" fill={color}
        fontSize="38" fontWeight="800" fontFamily="system-ui, sans-serif">{score}</text>
      <text x="90" y="105" textAnchor="middle" fill="#94a3b8"
        fontSize="14" fontFamily="system-ui, sans-serif">/100</text>
    </svg>
  )
}

function Badge({ status }) {
  const m = S[status] || S.check
  return (
    <span style={{ display:'inline-flex', alignItems:'center',
      padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'600',
      color:m.color, background:m.bg, border:`1px solid ${m.border}`, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a',
      marginBottom:'16px', display:'flex', alignItems:'center', gap:'8px' }}>
      {children}
    </h2>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────

function DashboardHeader({ user, activeTab, setActiveTab, logout }) {
  return (
    <header style={{ background:'white', borderBottom:'1px solid #f1f5f9',
      height:'64px', display:'flex', alignItems:'center', padding:'0 32px',
      justifyContent:'space-between', position:'sticky', top:0, zIndex:100,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>

      <span style={{ fontWeight:'800', fontSize:'18px', color:'#4f46e5',
        letterSpacing:'-0.5px', cursor:'default', userSelect:'none' }}>
        Accessa
      </span>

      <nav style={{ display:'flex', gap:'2px' }}>
        {['Dashboard','Obligations','Documents'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding:'7px 18px', borderRadius:'8px', border:'none', cursor:'pointer',
            fontSize:'14px', fontWeight: activeTab === tab ? '600' : '400',
            background: activeTab === tab ? '#eef2ff' : 'transparent',
            color: activeTab === tab ? '#4f46e5' : '#64748b',
            transition:'all 0.15s',
          }}>{tab}</button>
        ))}
      </nav>

      <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
        <span style={{ fontSize:'13px', color:'#94a3b8',
          maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {user?.email ?? ''}
        </span>
        <button onClick={logout} style={{ padding:'7px 16px', borderRadius:'8px',
          border:'1.5px solid #e2e8f0', background:'white', cursor:'pointer',
          fontSize:'13px', fontWeight:'500', color:'#64748b', transition:'all 0.15s' }}>
          Déconnexion
        </button>
      </div>
    </header>
  )
}

// ─── Zone 1 — Score + Risque ──────────────────────────────────────────────

function ScoreZone({ lead }) {
  const { score, total_risk } = lead
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>

      {/* Score */}
      <div style={{ ...CARD, padding:'32px', display:'flex', alignItems:'center', gap:'32px',
        background: scoreBg(score), border:`1px solid ${scoreBorder(score)}` }}>
        <ScoreCircle score={score} />
        <div>
          <p style={{ fontSize:'11px', color:'#94a3b8', textTransform:'uppercase',
            letterSpacing:'0.1em', marginBottom:'8px' }}>Indice de protection</p>
          <p style={{ fontSize:'26px', fontWeight:'800', color:scoreColor(score),
            lineHeight:1, marginBottom:'10px' }}>
            {scoreLabel(score)}
          </p>
          <p style={{ fontSize:'13px', color:'#64748b', lineHeight:'1.5', maxWidth:'220px' }}>
            {scoreDetail(score)}
          </p>
        </div>
      </div>

      {/* Risque */}
      <div style={{ ...CARD, padding:'32px',
        background:'linear-gradient(145deg,#fff5f5 0%,#fef2f2 100%)',
        border:'1px solid #fecaca', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:'11px', color:'#f87171', textTransform:'uppercase',
            letterSpacing:'0.1em', marginBottom:'14px' }}>Exposition financière</p>
          <p style={{ fontSize:'48px', fontWeight:'900', color:'#dc2626',
            lineHeight:1, letterSpacing:'-2px', marginBottom:'8px' }}>
            {fmt(total_risk)}
            <span style={{ fontSize:'22px', marginLeft:'4px', fontWeight:'700' }}>€</span>
          </p>
          <p style={{ fontSize:'13px', color:'#ef4444', marginBottom:'20px' }}>
            Amendes et pénalités potentielles
          </p>
        </div>
        <div style={{ padding:'12px 16px', background:'rgba(220,38,38,0.08)',
          borderRadius:'10px', fontSize:'13px', color:'#b91c1c',
          display:'flex', alignItems:'center', gap:'8px' }}>
          <span>⚠️</span>
          <span>Exposition maximale en cas de contrôle</span>
        </div>
      </div>

    </div>
  )
}

// ─── Plan d'action ────────────────────────────────────────────────────────

function ActionPlan({ items, setActiveTab }) {
  if (items.length === 0) return null
  return (
    <div style={{ ...CARD, padding:'24px', marginBottom:'20px' }}>
      <SectionTitle>🔥 Plan d'action — Priorités immédiates</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
        {items.map((ob, i) => (
          <div key={i} style={{ padding:'18px', borderRadius:'12px',
            background:'#fef2f2', border:'1px solid #fecaca',
            display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a', lineHeight:'1.4' }}>
                {ob.n}
              </p>
              <span style={{ fontSize:'11px', fontWeight:'700', color:'#dc2626',
                background:'#fecaca', padding:'2px 8px', borderRadius:'20px', whiteSpace:'nowrap' }}>
                #{i+1}
              </span>
            </div>
            <p style={{ fontSize:'13px', color:'#dc2626', fontWeight:'600' }}>
              {fmt(ob.penalty)} € d'amende
            </p>
            <button
              onClick={() => setActiveTab('Obligations')}
              style={{ padding:'8px 14px', borderRadius:'8px', border:'none',
                background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color:'white', fontSize:'13px', fontWeight:'600', cursor:'pointer',
                marginTop:'auto' }}>
              Corriger en 1 clic →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KPI cards ────────────────────────────────────────────────────────────

function KpiRow({ kpi }) {
  const items = [
    { icon:'✅', value:kpi.conforme, label:'Conformes',    color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
    { icon:'⚠️', value:kpi.aVerifier, label:'À vérifier', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    { icon:'❌', value:kpi.critique, label:'Non conformes', color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
  ]
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'20px' }}>
      {items.map(({ icon, value, label, color, bg, border }) => (
        <div key={label} style={{ ...CARD, background:bg, border:`1px solid ${border}`,
          padding:'24px', textAlign:'center' }}>
          <p style={{ fontSize:'22px', marginBottom:'10px' }}>{icon}</p>
          <p style={{ fontSize:'44px', fontWeight:'900', color, lineHeight:1, marginBottom:'8px' }}>{value}</p>
          <p style={{ fontSize:'13px', color:'#64748b', fontWeight:'500' }}>{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Zone 2 — Identité + Trust badge ─────────────────────────────────────

function CompanyZone({ lead }) {
  const { company_name, siren, score, created_at } = lead
  const badgeLabel = score >= 80 ? 'Audit Ready' : score >= 50 ? 'En cours de mise en conformité' : 'Risques identifiés'
  const badgeColor = scoreColor(score)
  const badgeBg = scoreBg(score)
  const badgeBorder = scoreBorder(score)

  function copyStatus() {
    const text = `${company_name} — Score Accessa : ${score}/100 (${badgeLabel})`
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:'20px', marginBottom:'20px' }}>

      {/* Company info */}
      <div style={{ ...CARD, padding:'28px' }}>
        <SectionTitle>🏢 Identité de l'entreprise</SectionTitle>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <p style={{ fontSize:'11px', color:'#94a3b8', textTransform:'uppercase',
              letterSpacing:'0.08em', marginBottom:'4px' }}>Raison sociale</p>
            <p style={{ fontSize:'18px', fontWeight:'700', color:'#0f172a' }}>{company_name}</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
            <div style={{ padding:'14px', background:'#f8fafc', borderRadius:'10px' }}>
              <p style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'4px' }}>SIREN</p>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#374151',
                fontFamily:'monospace', letterSpacing:'1px' }}>{siren}</p>
            </div>
            <div style={{ padding:'14px', background:'#f8fafc', borderRadius:'10px' }}>
              <p style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'4px' }}>Dernière analyse</p>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#374151' }}>
                {new Date(created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust badge */}
      <div style={{ ...CARD, padding:'28px', background:badgeBg,
        border:`1px solid ${badgeBorder}`, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', textAlign:'center', gap:'16px' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'50%',
          background:`${badgeColor}18`, border:`2px solid ${badgeBorder}`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px' }}>
          {score >= 80 ? '✅' : score >= 50 ? '⚠️' : '🔴'}
        </div>
        <div>
          <p style={{ fontSize:'11px', color:'#94a3b8', textTransform:'uppercase',
            letterSpacing:'0.1em', marginBottom:'6px' }}>Statut</p>
          <p style={{ fontSize:'16px', fontWeight:'800', color:badgeColor }}>{badgeLabel}</p>
        </div>
        <button onClick={copyStatus} style={{
          ...BTN_GHOST, borderColor:badgeBorder, color:badgeColor, fontSize:'12px' }}>
          Partager mon statut
        </button>
      </div>

    </div>
  )
}

// ─── Zone 3 — Réseau & Partenaires ────────────────────────────────────────

function NetworkZone() {
  return (
    <div style={{ ...CARD, padding:'28px', marginBottom:'20px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'20px' }}>
        <div style={{ flex:1 }}>
          <SectionTitle>🤝 Réseau & Partenaires</SectionTitle>
          <p style={{ fontSize:'14px', color:'#64748b', lineHeight:'1.6', marginBottom:'20px' }}>
            Vos partenaires, fournisseurs et sous-traitants peuvent impacter votre conformité.
            La vérification automatique du statut de conformité de votre réseau sera bientôt disponible.
          </p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {['Sous-traitants', 'Fournisseurs', 'Donneurs d\'ordre'].map(label => (
              <span key={label} style={{ padding:'6px 14px', background:'#f8fafc',
                borderRadius:'20px', fontSize:'13px', color:'#64748b',
                border:'1px solid #e2e8f0' }}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding:'20px 28px', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)',
          borderRadius:'12px', border:'1px solid #c7d2fe', textAlign:'center',
          minWidth:'160px', flexShrink:0 }}>
          <p style={{ fontSize:'24px', marginBottom:'8px' }}>🚀</p>
          <p style={{ fontSize:'13px', fontWeight:'700', color:'#4f46e5' }}>Bientôt</p>
          <p style={{ fontSize:'12px', color:'#818cf8', marginTop:'4px' }}>disponible</p>
        </div>
      </div>
    </div>
  )
}

// ─── Zone 4 — Coffre-fort documents ──────────────────────────────────────

function DocumentsPreview({ documents, setActiveTab }) {
  const preview = documents.slice(0, 4)
  const iconFor = (label) => {
    if (label.toLowerCase().includes('rc pro') || label.toLowerCase().includes('responsabilité')) return '📋'
    if (label.toLowerCase().includes('urssaf') || label.toLowerCase().includes('attestation')) return '🏛️'
    if (label.toLowerCase().includes('kbis') || label.toLowerCase().includes('extrait')) return '📄'
    if (label.toLowerCase().includes('décennale') || label.toLowerCase().includes('assurance')) return '🛡️'
    return '📁'
  }
  return (
    <div style={{ ...CARD, padding:0, marginBottom:'20px', overflow:'hidden' }}>
      <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <SectionTitle style={{ margin:0 }}>📂 Coffre-fort documents</SectionTitle>
        <button onClick={() => setActiveTab('Documents')} style={{
          ...BTN_GHOST, padding:'6px 14px', fontSize:'12px' }}>
          Voir tout →
        </button>
      </div>
      {preview.length === 0 ? (
        <p style={{ padding:'32px 24px', color:'#94a3b8', fontSize:'14px', textAlign:'center' }}>
          Aucun document requis détecté.
        </p>
      ) : (
        preview.map((ob, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center',
            justifyContent:'space-between', padding:'14px 24px',
            borderBottom: i < preview.length - 1 ? '1px solid #f8fafc' : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <span style={{ fontSize:'20px' }}>{iconFor(ob.n)}</span>
              <div>
                <p style={{ fontSize:'14px', fontWeight:'500', color:'#0f172a' }}>{ob.n}</p>
                <p style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>
                  {DOMAIN_ICON[ob.d]} {DOMAIN_LABEL[ob.d] || ob.d}
                </p>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <Badge status={ob.s} />
              <button style={{ padding:'6px 14px', borderRadius:'8px', border:'none',
                background:'#eef2ff', color:'#4f46e5', fontSize:'12px',
                fontWeight:'600', cursor:'pointer' }}>
                Uploader
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Historique ───────────────────────────────────────────────────────────

function HistoryTable({ allLeads }) {
  if (allLeads.length <= 1) return null
  return (
    <div style={{ ...CARD, padding:0, marginBottom:'20px', overflow:'hidden' }}>
      <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9' }}>
        <SectionTitle>🕐 Historique des analyses</SectionTitle>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ background:'#f8fafc' }}>
            {['Entreprise','Date','Score','Risque'].map(h => (
              <th key={h} style={{ padding:'10px 24px', textAlign:'left',
                fontSize:'11px', fontWeight:'600', color:'#94a3b8',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allLeads.map((l, i) => (
            <tr key={i} style={{ borderTop:'1px solid #f1f5f9' }}>
              <td style={{ padding:'13px 24px', fontSize:'14px', color:'#0f172a', fontWeight:'500' }}>
                {l.company_name}
              </td>
              <td style={{ padding:'13px 24px', fontSize:'13px', color:'#64748b' }}>
                {new Date(l.created_at).toLocaleDateString('fr-FR')}
              </td>
              <td style={{ padding:'13px 24px' }}>
                <span style={{ fontWeight:'700', color:scoreColor(l.score),
                  background:scoreBg(l.score), padding:'3px 10px',
                  borderRadius:'20px', fontSize:'13px' }}>
                  {l.score}/100
                </span>
              </td>
              <td style={{ padding:'13px 24px', fontSize:'14px', color:'#dc2626', fontWeight:'600' }}>
                {fmt(l.total_risk)} €
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Dashboard Home ────────────────────────────────────────────────────────

function DashboardHome({ lead, allLeads, user, kpi, actionPlan, navigate, setActiveTab }) {
  const firstName = user?.user_metadata?.first_name || ''
  return (
    <>
      {/* Welcome */}
      <div style={{ marginBottom:'32px' }}>
        <h1 style={{ fontSize:'28px', fontWeight:'800', color:'#0f172a',
          letterSpacing:'-0.5px', marginBottom:'6px' }}>
          Bonjour{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p style={{ color:'#64748b', fontSize:'15px' }}>
          Tableau de bord de conformité —{' '}
          <strong style={{ color:'#0f172a' }}>{lead.company_name}</strong>
        </p>
      </div>

      <ScoreZone lead={lead} />

      {lead.obligations && (
        <>
          <ActionPlan items={actionPlan} setActiveTab={setActiveTab} />
          <KpiRow kpi={kpi} />
        </>
      )}

      <CompanyZone lead={lead} />
      <NetworkZone />

      {lead.obligations && (
        <DocumentsPreview
          documents={lead.obligations.filter(o => o.s === 'doc')}
          setActiveTab={setActiveTab}
        />
      )}

      <HistoryTable allLeads={allLeads} />

      <div style={{ paddingTop:'8px' }}>
        <button onClick={() => navigate('/')} style={{ ...BTN_PRIMARY, fontSize:'15px', padding:'13px 28px' }}>
          + Analyser une autre entreprise
        </button>
      </div>
    </>
  )
}

// ─── Obligations Tab ──────────────────────────────────────────────────────

function ObligationsTab({ obs, filter, setFilter, expanded, setExpanded }) {
  if (!obs || obs.length === 0) {
    return (
      <div style={{ ...CARD, padding:'60px', textAlign:'center' }}>
        <p style={{ fontSize:'32px', marginBottom:'12px' }}>📋</p>
        <p style={{ fontSize:'16px', fontWeight:'600', color:'#0f172a', marginBottom:'8px' }}>
          Aucune obligation trouvée
        </p>
        <p style={{ color:'#94a3b8', fontSize:'14px' }}>
          Effectuez une analyse depuis l'accueil pour voir vos obligations.
        </p>
      </div>
    )
  }

  const domains = ['Tout', ...Object.keys(DOMAIN_LABEL)]
  const filtered = filter === 'Tout' ? obs : obs.filter(o => o.d === filter)

  return (
    <>
      {/* Filter bar */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
        {domains.map(d => {
          const active = filter === d
          const label = d === 'Tout' ? 'Tout' : DOMAIN_LABEL[d]
          const icon = d === 'Tout' ? '📋' : DOMAIN_ICON[d]
          const count = d === 'Tout' ? obs.length : obs.filter(o => o.d === d).length
          if (count === 0 && d !== 'Tout') return null
          return (
            <button key={d} onClick={() => setFilter(d)} style={{
              padding:'8px 16px', borderRadius:'10px', cursor:'pointer',
              fontSize:'13px', fontWeight: active ? '700' : '500',
              background: active ? '#4f46e5' : 'white',
              color: active ? 'white' : '#64748b',
              border: active ? '1.5px solid transparent' : '1.5px solid #e2e8f0',
              transition:'all 0.15s',
            }}>
              {icon} {label}{' '}
              <span style={{ opacity:0.7, fontSize:'12px' }}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* Obligation cards */}
      <div style={{ display:'grid', gap:'10px' }}>
        {filtered.map((ob, i) => {
          const isOpen = expanded === i
          const m = S[ob.s] || S.check
          return (
            <div key={i} style={{ ...CARD, overflow:'hidden' }}>
              <div
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'16px 20px', cursor:'pointer', gap:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'14px', flex:1, minWidth:0 }}>
                  <span style={{ fontSize:'18px', flexShrink:0 }}>
                    {DOMAIN_ICON[ob.d] || '📌'}
                  </span>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:'14px', fontWeight:'600', color:'#0f172a',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {ob.n}
                    </p>
                    <p style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>
                      {DOMAIN_LABEL[ob.d] || ob.d}
                    </p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
                  {ob.penalty > 0 && (
                    <span style={{ fontSize:'13px', fontWeight:'700', color:'#dc2626' }}>
                      {fmt(ob.penalty)} €
                    </span>
                  )}
                  <Badge status={ob.s} />
                  <span style={{ fontSize:'16px', color:'#94a3b8',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition:'transform 0.2s' }}>
                    ›
                  </span>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding:'0 20px 20px 20px',
                  borderTop:'1px solid #f8fafc', background:'#fafafa' }}>
                  <div style={{ display:'grid', gap:'12px', paddingTop:'16px' }}>
                    {ob.t && (
                      <div>
                        <p style={{ fontSize:'11px', fontWeight:'600', color:'#94a3b8',
                          textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>
                          Situation détectée
                        </p>
                        <p style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6' }}>{ob.t}</p>
                      </div>
                    )}
                    {ob.consequence && (
                      <div style={{ padding:'12px 14px', background:'#fef2f2',
                        borderRadius:'8px', border:'1px solid #fecaca' }}>
                        <p style={{ fontSize:'11px', fontWeight:'600', color:'#dc2626',
                          marginBottom:'4px' }}>Risque si non corrigé</p>
                        <p style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6' }}>{ob.consequence}</p>
                      </div>
                    )}
                    {ob.action && (
                      <div style={{ padding:'12px 14px', background:'#eef2ff',
                        borderRadius:'8px', border:'1px solid #c7d2fe' }}>
                        <p style={{ fontSize:'11px', fontWeight:'600', color:'#4f46e5',
                          marginBottom:'4px' }}>Action recommandée</p>
                        <p style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6' }}>{ob.action}</p>
                      </div>
                    )}
                    {ob.source && (
                      <p style={{ fontSize:'11px', color:'#94a3b8' }}>
                        📚 Source : {ob.source}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────

function DocumentsTab({ documents }) {
  const iconFor = (label = '') => {
    if (label.toLowerCase().includes('rc pro') || label.toLowerCase().includes('responsabilité')) return '📋'
    if (label.toLowerCase().includes('urssaf')) return '🏛️'
    if (label.toLowerCase().includes('kbis')) return '📄'
    if (label.toLowerCase().includes('décennale')) return '🏗️'
    if (label.toLowerCase().includes('multirisque')) return '🛡️'
    if (label.toLowerCase().includes('régularité')) return '💼'
    if (label.toLowerCase().includes('convention')) return '📑'
    return '📁'
  }

  return (
    <>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', marginBottom:'6px' }}>
          Coffre-fort documents
        </h1>
        <p style={{ color:'#64748b', fontSize:'14px' }}>
          Documents requis pour votre conformité.
          {documents.length > 0 && ` ${documents.length} document${documents.length > 1 ? 's' : ''} à fournir.`}
        </p>
      </div>

      {documents.length === 0 ? (
        <div style={{ ...CARD, padding:'60px', textAlign:'center' }}>
          <p style={{ fontSize:'32px', marginBottom:'12px' }}>📂</p>
          <p style={{ fontSize:'16px', fontWeight:'600', color:'#0f172a' }}>
            Aucun document requis
          </p>
          <p style={{ color:'#94a3b8', fontSize:'14px', marginTop:'8px' }}>
            Votre profil ne nécessite pas de document particulier.
          </p>
        </div>
      ) : (
        <div style={{ display:'grid', gap:'12px' }}>
          {documents.map((ob, i) => (
            <div key={i} style={{ ...CARD, padding:'20px 24px',
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'16px', flex:1, minWidth:0 }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px',
                  background:'#eef2ff', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:'20px', flexShrink:0 }}>
                  {iconFor(ob.n)}
                </div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:'15px', fontWeight:'600', color:'#0f172a',
                    marginBottom:'3px' }}>
                    {ob.n}
                  </p>
                  <p style={{ fontSize:'12px', color:'#292c30' }}>
                    {DOMAIN_ICON[ob.d]} {DOMAIN_LABEL[ob.d] || ob.d}
                    {ob.penalty > 0 && ` · Jusqu'à ${fmt(ob.penalty)} €`}
                  </p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
                <Badge status={ob.s} />
                <button style={{ ...BTN_PRIMARY, padding:'8px 18px', fontSize:'13px' }}>
                  Uploader
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Root component ────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sirenParam = searchParams.get('siren')
  const [user, setUser]           = useState(null)
  const [lead, setLead]           = useState(null)
  const [allLeads, setAllLeads]   = useState([])
  const [authLoading, setAuth]    = useState(true)
  const [dataLoading, setData]    = useState(true)
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [obFilter, setObFilter]   = useState('Tout')
  const [expanded, setExpanded]   = useState(null)

  useEffect(() => {
    async function loadData(emailToLoad) {
      // Étape 1 : chercher lead exact email+siren si siren fourni
      if (sirenParam) {
        const { data: exact } = await supabase
          .from('leads').select('*')
          .eq('email', emailToLoad)
          .eq('siren', sirenParam)
          .order('created_at', { ascending: false })

        if (exact && exact.length > 0) {
          setAllLeads(exact)
          const raw = exact[0]
          setLead({
            ...raw,
            obligations: raw.obligations
              ? (typeof raw.obligations === 'string' ? JSON.parse(raw.obligations) : raw.obligations)
              : [],
          })
          setData(false)
          return
        }

        // Étape 2 : lead non trouvé mais siren connu → charger live depuis l'API
        const result = await fullCompanySearch(sirenParam)
        if (result.success) {
          const obligations = analyzeCompliance(result.company)
          const score = computeScore(obligations)
          const total_risk = computeTotalRisk(obligations)
          const syntheticLead = {
            id: null,
            email: emailToLoad,
            siren: sirenParam,
            company_name: result.company.nom_complet || result.company.nom_raison_sociale,
            score,
            total_risk,
            obligations,
            created_at: new Date().toISOString(),
          }
          setAllLeads([syntheticLead])
          setLead(syntheticLead)
          setData(false)
          return
        }
      }

      // Étape 3 : pas de siren → charger tous les leads de cet email
      const { data: allRows } = await supabase
        .from('leads').select('*')
        .eq('email', emailToLoad)
        .order('created_at', { ascending: false })

      const rows = allRows || []
      if (rows.length > 0) {
        setAllLeads(rows)
        const raw = rows[0]
        setLead({
          ...raw,
          obligations: raw.obligations
            ? (typeof raw.obligations === 'string' ? JSON.parse(raw.obligations) : raw.obligations)
            : [],
        })
      }
      setData(false)
    }

    // Accès uniquement via session authentifiée
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { navigate('/login', { replace: true }); return }
      setUser(u)
      setAuth(false)
      loadData(u.email)
    })
  }, [navigate, sirenParam])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (authLoading) return <LoadingScreen />

  const obs = lead?.obligations ?? []
  const kpi = {
    conforme:  obs.filter(o => o.s === 'ok').length,
    aVerifier: obs.filter(o => ['check','doc','info','reco'].includes(o.s)).length,
    critique:  obs.filter(o => ['warn','bad'].includes(o.s)).length,
  }
  const actionPlan = [...obs]
    .filter(o => ['warn','bad','check'].includes(o.s) && o.penalty > 0)
    .sort((a, b) => b.penalty - a.penalty)
    .slice(0, 3)

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc',
      fontFamily:'system-ui, -apple-system, sans-serif' }}>

      <DashboardHeader
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        logout={logout}
      />

      <main style={{ maxWidth:'1200px', margin:'0 auto', padding:'40px 24px 80px' }}>

        {dataLoading && (
          <div style={{ display:'flex', justifyContent:'center', padding:'80px' }}>
            <span style={{ color:'#94a3b8', fontSize:'15px' }}>Chargement de vos données...</span>
          </div>
        )}

        {!dataLoading && !lead && (
          <OnboardingSearch
            user={user}
            onAnalysisDone={newLead => {
              setLead(newLead)
              setAllLeads([newLead])
            }}
          />
        )}

        {!dataLoading && lead && activeTab === 'Dashboard' && (
          <DashboardHome
            lead={lead}
            allLeads={allLeads}
            user={user}
            kpi={kpi}
            actionPlan={actionPlan}
            navigate={navigate}
            setActiveTab={setActiveTab}
          />
        )}

        {!dataLoading && activeTab === 'Obligations' && (
          <ObligationsTab
            obs={obs}
            filter={obFilter}
            setFilter={setObFilter}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        )}

        {!dataLoading && activeTab === 'Documents' && (
          <DocumentsTab documents={obs.filter(o => o.s === 'doc')} />
        )}

      </main>
    </div>
  )
}
