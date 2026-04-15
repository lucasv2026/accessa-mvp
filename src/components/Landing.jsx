import { useState } from 'react'
import { SECTORS_DISPLAY } from '../lib/complianceEngine'

export default function Landing({ onSearch, loading, error }) {
  const [siren, setSiren] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSearch(siren)
  }

  return (
    <main className="landing">
      {/* HERO */}
      <section className="hero">
        <span className="hero-badge">Conformité TPE & PME</span>
        <h1>Votre entreprise est-elle vraiment en règle ?</h1>
        <p className="hero-sub">
          DUERP, URSSAF, RC Pro, RGPD, décennale, HACCP… <strong>Chaque secteur a ses obligations.</strong> Une seule
          manquante peut bloquer un contrat, déclencher une amende ou arrêter votre activité.
        </p>
        <form onSubmit={handleSubmit} className="search-form">
          <div className="search-box">
            <input
              type="text"
              placeholder="Votre SIREN (9 chiffres)"
              value={siren}
              onChange={e => { setSiren(e.target.value) }}
              maxLength={11}
            />
            <button type="submit" disabled={loading}>
              {loading ? '...' : 'Vérifier'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="trust-row">
            <span>✓ Gratuit</span>
            <span>✓ Résultat instantané</span>
            <span>✓ Sans inscription</span>
          </div>
        </form>
      </section>

      {/* SECTORS */}
      <section className="sectors">
        <div className="sectors-inner">
          <p className="section-badge">Expertise par secteur</p>
          <h2>Chaque métier a ses obligations.<br />Nous les connaissons toutes.</h2>
          <p className="section-sub">Accessa analyse votre code NAF et adapte automatiquement le suivi à votre secteur.</p>
          <div className="sectors-grid">
            {SECTORS_DISPLAY.map((s, i) => (
              <div className="sector-card" key={i}>
                <span className="sc-icon">{s.icon}</span>
                <div className="sc-name">{s.name}</div>
                <div className="sc-detail">{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <div className="features-inner">
          <p className="section-badge">Comment ça marche</p>
          <h2>On surveille. On vous alerte. Vous agissez.</h2>
          <p className="section-sub">Accessa tourne en arrière-plan pour que vous puissiez vous concentrer sur votre métier.</p>
          <div className="features-grid">
            <div className="feature-card">
              <span className="fc-icon">📡</span>
              <h3>Détection automatique</h3>
              <p>On identifie vos obligations selon votre activité, taille et forme juridique. Vous n'avez rien à configurer.</p>
            </div>
            <div className="feature-card">
              <span className="fc-icon">🔔</span>
              <h3>Alertes anticipées</h3>
              <p>Attestation URSSAF qui expire, seuil CSE qui approche, assurance à renouveler — vous êtes prévenu à temps.</p>
            </div>
            <div className="feature-card">
              <span className="fc-icon">📋</span>
              <h3>Actions concrètes</h3>
              <p>Pour chaque alerte : la cause, la conséquence financière, et l'action exacte à faire. Pas de jargon juridique.</p>
            </div>
            <div className="feature-card">
              <span className="fc-icon">🤝</span>
              <h3>Lien avec votre comptable</h3>
              <p>Votre expert-comptable voit la même chose que vous. Fini les emails pour demander « on est à jour ? »</p>
            </div>
          </div>
        </div>
      </section>

      {/* NETWORK */}
      <section className="network">
        <div className="network-inner">
          <p className="network-badge">Le réseau Accessa</p>
          <h2>Rejoignez le réseau des entreprises conformes</h2>
          <p className="network-intro">Chaque entreprise vérifiée obtient un badge de conformité visible par ses clients, partenaires et donneurs d'ordre. Vous prouvez votre sérieux. Vos partenaires prouvent le leur.</p>
          <div className="network-stats">
            <div className="ns-item"><span className="ns-num">5 min</span><span className="ns-label">pour connaître votre score</span></div>
            <div className="ns-item"><span className="ns-num">0 €</span><span className="ns-label">pour vérifier un partenaire</span></div>
            <div className="ns-item"><span className="ns-num">100%</span><span className="ns-label">des obligations sectorielles</span></div>
          </div>
          <div className="network-badge-preview">
            <div className="nbp-check">✓</div>
            <div className="nbp-text">
              <div className="nbp-title">Vérifié Accessa — 86/100</div>
              <div className="nbp-sub">Badge affiché sur votre site, vos devis et factures</div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPTABLE */}
      <section className="comptable" id="comptable">
        <div className="comptable-inner">
          <p className="section-badge">Pour les cabinets</p>
          <h2>Vous êtes expert-comptable ?</h2>
          <p className="section-sub">Suivez la conformité de tous vos clients depuis un seul tableau de bord. Ajoutez leurs SIREN, recevez les alertes, anticipez les risques. Accessa détecte ce que vous n'avez pas le temps de surveiller.</p>
          <div className="comptable-features">
            <div className="cf-item"><span className="cf-dot" /><span>Portefeuille multi-clients</span></div>
            <div className="cf-item"><span className="cf-dot" /><span>Alertes automatiques</span></div>
            <div className="cf-item"><span className="cf-dot" /><span>Score par client</span></div>
            <div className="cf-item"><span className="cf-dot" /><span>Marque blanche disponible</span></div>
          </div>
          <button className="btn-primary btn-indigo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Inscrire mon cabinet →</button>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="pricing-inner">
          <h2>Un prix clair qui évolue avec vous</h2>
          <p className="section-sub">Une obligation manquante peut coûter de 1 500 € à 75 000 € d'amende.<br />Accessa coûte moins qu'un seul oubli.</p>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-name">Solo</div>
              <div className="price-desc">Pour les indépendants et TPE qui veulent dormir tranquilles</div>
              <div className="price-amount">19 € <span>/mois</span></div>
              <ul className="price-features">
                <li>Score de conformité vérifié</li>
                <li>Alertes avant expiration</li>
                <li>Coffre-fort documentaire</li>
                <li>Badge conformité vérifié</li>
                <li>Actions correctives détaillées</li>
              </ul>
              <button className="btn-primary" style={{ width: '100%' }}>Commencer</button>
            </div>
            <div className="price-card popular">
              <span className="price-pop">Populaire</span>
              <div className="price-name">Business</div>
              <div className="price-desc">Pour les PME dont les obligations se multiplient</div>
              <div className="price-amount" style={{ color: '#4f46e5' }}>49 € <span>/mois</span></div>
              <ul className="price-features">
                <li>Tout Solo, plus :</li>
                <li>Obligations CSE & DUERP</li>
                <li>Suivi conventions collectives</li>
                <li>Monitoring continu avancé</li>
                <li>Support prioritaire</li>
              </ul>
              <button className="btn-primary btn-indigo" style={{ width: '100%' }}>Commencer</button>
            </div>
            <div className="price-card">
              <div className="price-name">Cabinet</div>
              <div className="price-desc">Pour les experts-comptables qui protègent leurs clients</div>
              <div className="price-amount">149 € <span>/mois</span></div>
              <ul className="price-features">
                <li>Tableau de bord multi-clients</li>
                <li>5 €/client additionnel</li>
                <li>Marque blanche disponible</li>
                <li>API & exports automatisés</li>
                <li>Formation & onboarding</li>
              </ul>
              <button className="btn-primary" style={{ width: '100%' }}>Commencer</button>
            </div>
          </div>
          <p className="price-note">Cabinet : 149 €/mois pour 20 clients, puis 5 €/client. Tous les plans incluent 14 jours d'essai gratuit.</p>
        </div>
      </section>
    </main>
  )
}
