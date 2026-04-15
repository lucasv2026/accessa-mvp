import { useState } from 'react'
import { DOMAINS, STATUS, domainScore, scoreColor, computeTotalRisk, formatMoney, nafLabel } from '../lib/complianceEngine'

export default function FullReport({ company, obligations, score, bodacc, userEmail, onBack }) {
  const [tab, setTab] = useState('all')

  const siege = company.siege || {}
  const dirigeant = company.dirigeants?.[0]
    ? `${company.dirigeants[0].prenoms || ''} ${company.dirigeants[0].nom || ''}`.trim()
    : '—'
  const totalRisk = computeTotalRisk(obligations)
  const filtered = tab === 'all' ? obligations : obligations.filter(o => o.d === tab)
  const okCount = obligations.filter(o => o.s === 'ok').length
  const checkCount = obligations.filter(o => ['check', 'doc'].includes(o.s)).length
  const warnCount = obligations.filter(o => ['warn', 'bad'].includes(o.s)).length
  const hasBodaccAlerts = bodacc?.alerts?.length > 0

  return (
    <div className="result-container">
      <button className="back-link" onClick={onBack}>← Nouvelle recherche</button>

      {/* Header with company + score */}
      <div className="report-header">
        <div className="report-header-left">
          <h1 className="company-name-sm">{company.nom_complet || company.nom_raison_sociale}</h1>
          <div className="meta-row-sm">
            <span>{siege.siret}</span>
            <span>·</span>
            <span>{nafLabel(company.activite_principale)}</span>
            <span>·</span>
            <span>{dirigeant}</span>
          </div>
        </div>
        <div className="report-header-right">
          <div className="score-mini" style={{ borderColor: scoreColor(score) }}>
            <span className="score-mini-num" style={{ color: scoreColor(score) }}>{score}</span>
            <span className="score-mini-label">/100</span>
          </div>
        </div>
      </div>

      {/* Risk banner */}
      {totalRisk > 0 && (
        <div className="risk-banner">
          <div className="risk-icon">⚠️</div>
          <div className="risk-content">
            <div className="risk-amount">{formatMoney(totalRisk)} €</div>
            <div className="risk-label">de risques financiers identifiés</div>
          </div>
        </div>
      )}

      {/* Bodacc alerts */}
      {hasBodaccAlerts && (
        <div className="bodacc-banner">
          <div className="bodacc-icon">🔴</div>
          <div className="bodacc-content">
            <div className="bodacc-title">Alertes Bodacc</div>
            {bodacc.alerts.map((a, i) => (
              <div className="bodacc-alert" key={i}>
                <strong>{a.title}</strong> — {a.detail}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-card s-green"><span className="s-num">{okCount}</span><span className="s-label">Conformes</span></div>
        <div className="summary-card s-orange"><span className="s-num">{checkCount}</span><span className="s-label">À vérifier</span></div>
        <div className="summary-card s-red"><span className="s-num">{warnCount}</span><span className="s-label">Risqués</span></div>
      </div>

      {/* Domain filter tabs */}
      <div className="domain-tabs">
        <button className={`domain-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          <span className="dt-icon">📋</span>
          <span className="dt-label">Tout</span>
          <span className="dt-score">{obligations.length}</span>
        </button>
        {Object.entries(DOMAINS).map(([key, { label, icon }]) => {
          const ds = domainScore(obligations, key)
          if (ds.count === 0) return null
          return (
            <button key={key} className={`domain-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              <span className="dt-icon">{icon}</span>
              <span className="dt-label">{label}</span>
              <span className="dt-score" style={{ color: ds.score != null ? scoreColor(ds.score) : '#a1a1aa' }}>
                {ds.score != null ? ds.score : '??'}
              </span>
              <span className="dt-count">{ds.count}</span>
            </button>
          )
        })}
      </div>

      {/* FULL OBLIGATIONS LIST */}
      <h2 className="section-title">
        {tab === 'all' ? 'Toutes les obligations détectées' : `Obligations — ${DOMAINS[tab]?.label}`}
      </h2>

      <div className="obligations">
        {filtered.map((ob, i) => {
          const st = STATUS[ob.s] || STATUS.check
          return (
            <div className="ob-card-full" key={i} style={{ borderLeftColor: st.color }}>
              <div className="ob-tags">
                <span className="ob-domain">{DOMAINS[ob.d]?.label}</span>
                <span className="ob-status" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                {ob.auto && <span className="ob-auto">Détecté par Accessa</span>}
                {ob.penalty > 0 && ob.s !== 'ok' && (
                  <span className="ob-penalty">💰 {formatMoney(ob.penalty)} €</span>
                )}
              </div>

              <h3 className="ob-name">{ob.n}</h3>
              <p className="ob-detail">{ob.t}</p>

              {/* Consequence */}
              {ob.consequence && ob.s !== 'ok' && (
                <div className="ob-consequence">
                  <span className="ob-section-label">⚠️ Ce que vous risquez</span>
                  <p>{ob.consequence}</p>
                </div>
              )}

              {/* Action */}
              {ob.action && ob.s !== 'ok' && (
                <div className="ob-action">
                  <span className="ob-section-label">✅ Ce que vous devez faire</span>
                  <p>{ob.action}</p>
                </div>
              )}

              {/* Source */}
              <p className="ob-source">Source : {ob.source}</p>
            </div>
          )
        })}
      </div>

      {/* Upsell */}
      <div className="upsell">
        <div className="upsell-risk">
          Risque total identifié : <strong>{formatMoney(totalRisk)} €</strong>
        </div>
        <h2>Ne restez pas exposé</h2>
        <p>
          Accessa ne se contente pas de détecter vos manquements — il vous aide à les résoudre, 
          vous connecte à un réseau d'entreprises conformes, et vous ouvre de nouvelles opportunités.
        </p>
        <div className="upsell-comparison">
          <div className="upsell-col upsell-without">
            <h4>Sans Accessa</h4>
            <ul>
              <li>Vous découvrez les amendes au moment du contrôle</li>
              <li>Vos attestations expirent sans que vous le sachiez</li>
              <li>Vous perdez des marchés publics faute de documents à jour</li>
              <li>Vos clients et donneurs d'ordre ne peuvent pas vérifier votre conformité</li>
              <li>Vous passez des heures à chercher quels documents produire</li>
            </ul>
          </div>
          <div className="upsell-col upsell-with">
            <h4>Avec Accessa</h4>
            <ul>
              <li>Alertes 30 jours avant chaque échéance</li>
              <li>Génération automatique des documents manquants (DUERP, mentions légales, registres)</li>
              <li>Badge "Vérifié Accessa" qui rassure vos clients et donneurs d'ordre</li>
              <li>Accès au réseau d'entreprises conformes — vos partenaires sont vérifiés aussi</li>
              <li>Dossier de conformité prêt pour les marchés publics et appels d'offres</li>
            </ul>
          </div>
        </div>
        <div className="upsell-actions">
          <button className="btn-primary btn-indigo btn-lg">Protéger mon entreprise — à partir de 19 €/mois →</button>
        </div>
        <p className="upsell-note">14 jours d'essai gratuit · Sans engagement · Annulation en 1 clic</p>
      </div>
    </div>
  )
}
