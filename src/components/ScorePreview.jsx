import { DOMAINS, domainScore, scoreColor, computeTotalRisk, formatMoney, nafLabel } from '../lib/complianceEngine'

export default function ScorePreview({ company, obligations, score, bodacc, onUnlock, onBack }) {
  const siege = company.siege || {}
  const dirigeant = company.dirigeants?.[0]
    ? `${company.dirigeants[0].prenoms || ''} ${company.dirigeants[0].nom || ''}`.trim()
    : '—'
  const totalRisk = computeTotalRisk(obligations)
  const okCount = obligations.filter(o => o.s === 'ok').length
  const checkCount = obligations.filter(o => ['check', 'doc'].includes(o.s)).length
  const warnCount = obligations.filter(o => ['warn', 'bad'].includes(o.s)).length
  const totalObs = obligations.filter(o => o.s !== 'info' && o.s !== 'reco').length
  const hasBodaccAlerts = bodacc?.alerts?.length > 0

  return (
    <div className="result-container">
      <button className="back-link" onClick={onBack}>← Nouvelle recherche</button>

      <h1 className="company-name">{company.nom_complet || company.nom_raison_sociale}</h1>

      <div className="meta-row">
        {[
          ['SIRET', siege.siret],
          ['NAF', company.activite_principale],
          ['Création', company.date_creation],
          ['Dirigeant', dirigeant],
          ['Activité', nafLabel(company.activite_principale)],
        ].map(([label, value], i) => (
          <div className="meta-item" key={i}>
            <span className="meta-label">{label}</span>
            <span className="meta-value">{value || '—'}</span>
          </div>
        ))}
      </div>

      {/* Score Circle */}
      <div className="score-ring">
        <svg viewBox="0 0 200 200" width="180" height="180">
          <circle cx="100" cy="100" r="82" fill="none" stroke="#f4f4f5" strokeWidth="12" />
          <circle cx="100" cy="100" r="82" fill="none" stroke={scoreColor(score)} strokeWidth="12"
            strokeDasharray={`${score / 100 * 515} 515`} strokeLinecap="round"
            transform="rotate(-90 100 100)" className="score-arc" />
        </svg>
        <div className="score-center">
          <span className="score-num" style={{ color: scoreColor(score) }}>{score}</span>
          <span className="score-denom">/100</span>
        </div>
      </div>
      <p className="score-title">Conformité estimée</p>
      <p className="score-sub">Basée sur les données publiques disponibles</p>

      {/* RISK AMOUNT — the money shot */}
      {totalRisk > 0 && (
        <div className="risk-banner">
          <div className="risk-icon">⚠️</div>
          <div className="risk-content">
            <div className="risk-amount">{formatMoney(totalRisk)} €</div>
            <div className="risk-label">de risques financiers identifiés</div>
            <div className="risk-detail">
              Amendes, pénalités et sanctions auxquelles votre entreprise s'expose si les obligations non conformes ne sont pas régularisées
            </div>
          </div>
        </div>
      )}

      {/* Bodacc alerts */}
      {hasBodaccAlerts && (
        <div className="bodacc-banner">
          <div className="bodacc-icon">🔴</div>
          <div className="bodacc-content">
            <div className="bodacc-title">Alertes Bodacc détectées</div>
            {bodacc.alerts.map((a, i) => (
              <div className="bodacc-alert" key={i}>
                <strong>{a.title}</strong> — {a.detail}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domain tabs */}
      <div className="domain-tabs">
        {Object.entries(DOMAINS).map(([key, { label, icon }]) => {
          const ds = domainScore(obligations, key)
          return (
            <div key={key} className="domain-tab">
              <span className="dt-icon">{icon}</span>
              <span className="dt-label">{label}</span>
              <span className="dt-score" style={{ color: ds.score != null ? scoreColor(ds.score) : '#a1a1aa' }}>
                {ds.score != null ? ds.score : '??'}
              </span>
              <span className="dt-count">{ds.count} oblig.</span>
            </div>
          )
        })}
      </div>

      {/* Summary cards */}
      <div className="summary-row">
        <div className="summary-card s-green">
          <span className="s-num">{okCount}</span>
          <span className="s-label">Conformes</span>
        </div>
        <div className="summary-card s-orange">
          <span className="s-num">{checkCount}</span>
          <span className="s-label">À vérifier</span>
        </div>
        <div className="summary-card s-red">
          <span className="s-num">{warnCount}</span>
          <span className="s-label">Risqués</span>
        </div>
      </div>

      {/* Blurred preview of obligations */}
      <div className="preview-obligations">
        <h2 className="section-title">{totalObs} obligations analysées pour votre entreprise</h2>
        <div className="preview-blur">
          <div className="preview-fake-card" />
          <div className="preview-fake-card" />
          <div className="preview-fake-card" />
          <div className="preview-overlay">
            <div className="preview-lock">🔒</div>
            <h3>Voir le détail de chaque obligation</h3>
            <p>Découvrez quelles obligations vous manquent, combien chacune peut vous coûter, et exactement quoi faire pour vous mettre en conformité.</p>
            <button className="btn-primary btn-indigo btn-lg" onClick={onUnlock}>
              Accéder à mon rapport complet →
            </button>
            <span className="preview-note">Gratuit — seul votre email est requis</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bottom-cta">
        <div className="bottom-cta-risk">
          Risque total identifié : <strong>{formatMoney(totalRisk)} €</strong>
        </div>
        <div className="bottom-cta-accessa">
          Accessa vous protège à partir de <strong>19 €/mois</strong>
        </div>
      </div>
    </div>
  )
}
