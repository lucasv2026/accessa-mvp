// ============================================
// ACCESSA — Compliance Engine v2
// Each obligation has: penalty, consequence, action, source
// ============================================

// --- NAF Sector mapping ---
const SECTOR_MAP = {
  BTP: ['41','42','43'],
  RESTO: ['56'],
  COMMERCE: ['45','46','47'],
  TECH: ['62','63'],
  CONSEIL: ['70'],
  SANTE: ['86'],
  TRANSPORT: ['49','50','51','52'],
  IMMO: ['68'],
  FORMATION: ['85'],
  INDUSTRIE: ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33'],
}

export function getSector(naf) {
  if (!naf) return 'AUTRE'
  const p = naf.replace('.', '').substring(0, 2)
  for (const [sec, codes] of Object.entries(SECTOR_MAP)) {
    if (codes.includes(p)) return sec
  }
  return 'AUTRE'
}

export function nafLabel(code) {
  const labels = {
    '41':'Construction de bâtiments','42':'Génie civil','43':'Travaux de construction spécialisés',
    '56':'Restauration','45':'Commerce de véhicules','46':'Commerce de gros','47':'Commerce de détail',
    '62':'Programmation informatique','63':'Services d\'information','65':'Assurance',
    '70':'Conseil de gestion','86':'Activités pour la santé','49':'Transports terrestres',
    '50':'Transports par eau','68':'Activités immobilières','85':'Enseignement',
  }
  const p = code ? code.replace('.','').substring(0,2) : ''
  return labels[p] || 'Activité professionnelle'
}

export function getEffectif(tranche) {
  return {'NN':0,'00':0,'01':2,'02':4,'03':8,'06':15,'11':35,'12':75,'21':150,'22':350,'31':750,'32':1500}[tranche] || 0
}

// --- Estimate CA from effectif + sector for RGPD penalty calc ---
function estimateCA(effectif, sector) {
  const base = {
    BTP: 80000, RESTO: 60000, COMMERCE: 90000, TECH: 120000,
    CONSEIL: 100000, TRANSPORT: 70000, IMMO: 100000, AUTRE: 80000,
  }
  const perEmployee = base[sector] || 80000
  if (effectif === 0) return 150000 // solo entrepreneur
  return Math.max(effectif * perEmployee, 150000)
}

// ============================================
// MAIN ANALYSIS FUNCTION
// Returns array of obligations with full data
// ============================================
export function analyzeCompliance(co) {
  const naf = co.activite_principale || ''
  const sec = getSector(naf)
  const eff = getEffectif(co.tranche_effectif_salarie)
  const emp = co.caractere_employeur === 'O'
  const etat = co.etat_administratif || 'A'
  const hasFin = co.finances && Object.keys(co.finances).length > 0
  const comp = co.complements || {}
  const siege = co.siege || {}
  const rge = siege.liste_rge || []
  const estimatedCA = estimateCA(eff, sec)
  const obs = []

  // ===================
  // FISCAL
  // ===================
  obs.push({
    d: 'fiscal', n: 'Immatriculation active',
    s: etat === 'A' ? 'ok' : 'bad',
    t: etat === 'A' ? 'Entreprise active au répertoire Sirene' : 'Entreprise fermée ou radiée au répertoire',
    consequence: etat === 'A' ? null : 'Interdiction totale d\'exercer et de facturer',
    action: etat === 'A' ? null : 'Contactez le greffe du tribunal de commerce pour régulariser votre situation',
    penalty: etat === 'A' ? 0 : 75000,
    source: 'INSEE / Sirene',
    auto: true,
  })

  obs.push({
    d: 'fiscal', n: 'Dépôt des comptes annuels',
    s: hasFin ? 'ok' : 'warn',
    t: hasFin ? 'Comptes annuels déposés au greffe' : 'Aucun dépôt de comptes annuels détecté auprès du greffe',
    consequence: hasFin ? null : 'Amende et risque de radiation d\'office. Les partenaires et banques ne peuvent pas évaluer votre solvabilité',
    action: hasFin ? null : 'Déposez vos comptes annuels auprès du greffe du tribunal de commerce dans les 7 mois suivant la clôture de l\'exercice',
    penalty: hasFin ? 0 : 1500,
    source: 'Code de commerce — Art. L.232-21 à L.232-23',
    auto: true,
  })

  obs.push({
    d: 'fiscal', n: 'Facturation électronique',
    s: 'info',
    t: 'Obligation de réception des factures électroniques au 1er septembre 2026',
    consequence: 'Amende de 15 € par facture non conforme, plafonnée à 15 000 € par an',
    action: 'Vérifiez que votre logiciel de facturation est compatible avec le format Factur-X ou le Portail Public de Facturation',
    penalty: 15000,
    source: 'Loi de finances 2024 — Art. 91',
    auto: true,
  })

  obs.push({
    d: 'fiscal', n: 'Attestation de régularité fiscale',
    s: 'doc',
    t: 'Attestation prouvant que l\'entreprise est à jour de ses obligations fiscales (IS, TVA)',
    consequence: 'Impossible de répondre aux marchés publics. Signal négatif pour les donneurs d\'ordre',
    action: 'Téléchargez votre attestation depuis votre espace professionnel sur impots.gouv.fr',
    penalty: 0,
    source: 'DGFIP — BOFiP',
    auto: false,
  })

  // ===================
  // SOCIAL / RH
  // ===================
  obs.push({
    d: 'social', n: 'Attestation de vigilance URSSAF',
    s: 'doc',
    t: 'Attestation sociale prouvant que l\'entreprise est à jour de ses cotisations',
    consequence: 'Obligatoire pour tout contrat > 5 000 € HT. Sans elle, le donneur d\'ordre engage sa responsabilité solidaire',
    action: 'Téléchargez votre attestation depuis votre espace en ligne urssaf.fr — rubrique Attestations. Validité : 6 mois',
    penalty: 0,
    source: 'Code du travail — Art. L.8222-1 / CSS — Art. L.243-15',
    auto: false,
  })

  if (emp || eff > 0) {
    obs.push({
      d: 'social', n: 'Document Unique d\'Évaluation des Risques (DUERP)',
      s: 'check',
      t: `Obligatoire dès le 1er salarié. Effectif détecté : ${eff}. Doit être mis à jour au moins chaque année`,
      consequence: 'Amende de 1 500 € par constat d\'absence (3 000 € en récidive). En cas d\'accident du travail sans DUERP, la faute inexcusable de l\'employeur peut être retenue',
      action: 'Rédigez votre DUERP en listant les risques par unité de travail. Des modèles gratuits sont disponibles sur le site de l\'INRS',
      penalty: 1500,
      source: 'Code du travail — Art. R.4121-1 à R.4121-4',
      auto: true,
    })

    obs.push({
      d: 'social', n: 'Registre unique du personnel',
      s: 'check',
      t: `Obligatoire. Doit mentionner chaque salarié avec nom, emploi, qualification, dates d'entrée et sortie`,
      consequence: `Amende de 750 € par salarié non inscrit. Avec ${eff} salariés, le risque atteint ${eff * 750} €`,
      action: 'Tenez un registre physique ou numérique. Mettez-le à jour à chaque embauche, changement de poste ou départ',
      penalty: eff * 750,
      source: 'Code du travail — Art. L.1221-13',
      auto: true,
    })

    obs.push({
      d: 'social', n: 'Médecine du travail',
      s: 'check',
      t: 'Adhésion obligatoire à un Service de Prévention et de Santé au Travail (SPST)',
      consequence: 'Amende de 1 500 €. En cas d\'accident, la responsabilité de l\'employeur est aggravée sans suivi médical',
      action: 'Adhérez à un SPST (ex: CIAMT, CMIE, AST). Organisez la visite d\'information et de prévention dans les 3 mois suivant l\'embauche',
      penalty: 1500,
      source: 'Code du travail — Art. L.4622-1',
      auto: true,
    })

    obs.push({
      d: 'social', n: 'Affichages obligatoires',
      s: 'check',
      t: 'Horaires collectifs, coordonnées inspection du travail, médecine du travail, consignes de sécurité, interdiction de fumer, lutte contre le harcèlement',
      consequence: 'Amende de 1 500 € par affichage manquant constaté lors d\'un contrôle',
      action: 'Affichez dans un lieu accessible à tous les salariés : horaires, coordonnées de l\'inspection du travail et du SPST, convention collective applicable, consignes incendie',
      penalty: 1500,
      source: 'Code du travail — Art. R.2262-1 et suivants',
      auto: true,
    })
  }

  if (eff >= 11) {
    obs.push({
      d: 'social', n: 'Comité Social et Économique (CSE)',
      s: 'warn',
      t: `Effectif de ${eff} salariés détecté (seuil : 11). L'employeur doit organiser les élections professionnelles`,
      consequence: 'Délit d\'entrave : 7 500 € d\'amende et jusqu\'à 1 an d\'emprisonnement. Les salariés peuvent saisir le tribunal',
      action: 'Informez les salariés et les organisations syndicales de l\'organisation des élections. Le scrutin doit avoir lieu dans les 90 jours suivant l\'information',
      penalty: 7500,
      source: 'Code du travail — Art. L.2311-2 / Art. L.2317-1',
      auto: true,
    })
  }

  if (eff >= 20) {
    obs.push({
      d: 'social', n: 'Obligation d\'emploi travailleurs handicapés (OETH)',
      s: 'check',
      t: `6 % de l'effectif (${Math.ceil(eff * 0.06)} postes) doivent être occupés par des travailleurs handicapés ou contribution AGEFIPH`,
      consequence: `Contribution AGEFIPH estimée à ${formatMoney(Math.ceil(eff * 0.06) * 500)} €/an si l'obligation n'est pas respectée`,
      action: 'Déclarez votre OETH via la DSN. Recrutez des travailleurs RQTH ou passez des contrats avec des ESAT/EA',
      penalty: Math.ceil(eff * 0.06) * 500,
      source: 'Code du travail — Art. L.5212-2',
      auto: true,
    })
  }

  if (eff >= 50) {
    const penaltyEgapro = Math.round(estimatedCA * 0.01)
    obs.push({
      d: 'social', n: 'Index égalité professionnelle',
      s: comp.egapro_renseignee ? 'ok' : 'warn',
      t: comp.egapro_renseignee ? 'Index égalité femmes-hommes publié — conforme' : 'Index non publié. Publication obligatoire avant le 1er mars de chaque année',
      consequence: comp.egapro_renseignee ? null : `Pénalité financière jusqu'à 1 % de la masse salariale, soit environ ${formatMoney(penaltyEgapro)} €/an`,
      action: comp.egapro_renseignee ? null : 'Calculez et publiez votre index sur le site egapro.travail.gouv.fr avant le 1er mars',
      penalty: comp.egapro_renseignee ? 0 : penaltyEgapro,
      source: 'Code du travail — Art. L.1142-8',
      auto: true,
    })
  }

  if (comp.convention_collective_renseignee) {
    obs.push({
      d: 'social', n: 'Convention collective',
      s: 'ok',
      t: 'Convention collective renseignée et applicable',
      consequence: null, action: null, penalty: 0,
      source: 'Code du travail', auto: true,
    })
  }

  // ===================
  // ASSURANCES
  // ===================
  obs.push({
    d: 'assurances', n: 'Responsabilité Civile Professionnelle',
    s: 'doc',
    t: 'Assurance couvrant les dommages causés à des tiers dans le cadre de l\'activité professionnelle',
    consequence: 'En cas de sinistre, l\'entreprise et le dirigeant sont responsables sur leurs biens personnels. Risque de faillite',
    action: 'Uploadez votre attestation RC Pro pour vérification de validité et de couverture',
    penalty: 0,
    source: 'Code des assurances',
    auto: false,
  })

  if (sec === 'BTP') {
    obs.push({
      d: 'assurances', n: 'Assurance décennale',
      s: 'doc',
      t: 'Obligatoire pour toute entreprise du BTP. Couvre les dommages compromettant la solidité de l\'ouvrage pendant 10 ans',
      consequence: 'Délit pénal : 75 000 € d\'amende et 6 mois d\'emprisonnement. Interdiction d\'exercer. Le client peut annuler le contrat',
      action: 'Souscrivez une assurance décennale auprès d\'un assureur spécialisé BTP. Uploadez l\'attestation pour vérification',
      penalty: 75000,
      source: 'Code civil — Art. 1792 / Code des assurances — Art. L.241-1 / Code pénal — Art. L.243-3',
      auto: true,
    })
  }

  obs.push({
    d: 'assurances', n: 'Assurance multirisque professionnelle',
    s: 'doc',
    t: 'Assurance couvrant les locaux, le matériel, les marchandises contre incendie, dégât des eaux, vol',
    consequence: 'En cas de sinistre, aucune indemnisation. L\'activité peut s\'arrêter définitivement',
    action: 'Uploadez votre attestation d\'assurance multirisque pour vérification',
    penalty: 0,
    source: 'Code des assurances',
    auto: false,
  })

  // ===================
  // JURIDIQUE
  // ===================
  obs.push({
    d: 'juridique', n: 'Extrait Kbis',
    s: etat === 'A' ? 'ok' : 'bad',
    t: etat === 'A' ? `Entreprise immatriculée depuis le ${co.date_creation}` : 'Entreprise non active au registre du commerce',
    consequence: etat === 'A' ? null : 'Impossible de facturer, de contracter ou d\'ouvrir un compte bancaire professionnel',
    action: etat === 'A' ? null : 'Contactez le greffe pour régulariser',
    penalty: etat === 'A' ? 0 : 75000,
    source: 'INPI / RNE', auto: true,
  })

  const rgpdPenalty = Math.min(Math.round(estimatedCA * 0.04), 20000000)
  obs.push({
    d: 'juridique', n: 'Conformité RGPD',
    s: 'check',
    t: 'Registre des traitements, mentions légales, politique de confidentialité, consentement cookies, DPO si applicable',
    consequence: `Amende jusqu'à 4 % du chiffre d'affaires, soit environ ${formatMoney(rgpdPenalty)} € pour votre entreprise. Plaintes clients possibles auprès de la CNIL`,
    action: 'Rédigez votre registre des traitements, mettez à jour vos mentions légales et votre politique de confidentialité. Désignez un DPO si vous traitez des données sensibles à grande échelle',
    penalty: rgpdPenalty,
    source: 'RGPD — Règlement UE 2016/679 — Art. 83',
    auto: false,
  })

  if (co.dirigeants?.length > 0) {
    const dir = co.dirigeants[0]
    obs.push({
      d: 'juridique', n: 'Dirigeants déclarés',
      s: 'ok',
      t: `${dir.prenoms || ''} ${dir.nom || ''} — ${dir.qualite || ''}`.trim(),
      consequence: null, action: null, penalty: 0,
      source: 'INPI / RNE', auto: true,
    })
  }

  obs.push({
    d: 'juridique', n: 'Bénéficiaires effectifs',
    s: 'check',
    t: 'Déclaration obligatoire au Registre des Bénéficiaires Effectifs de toute personne détenant plus de 25 % du capital',
    consequence: 'Amende de 7 500 € pour le dirigeant. 6 mois d\'emprisonnement en cas de non-déclaration volontaire',
    action: 'Déclarez vos bénéficiaires effectifs auprès du greffe du tribunal de commerce via le guichet unique formalites.entreprises.gouv.fr',
    penalty: 7500,
    source: 'Code monétaire et financier — Art. L.561-46',
    auto: false,
  })

  // ===================
  // CERTIFICATIONS (par secteur)
  // ===================
  if (sec === 'BTP') {
    obs.push({
      d: 'certifications', n: 'Certification RGE',
      s: rge.length > 0 ? 'ok' : 'reco',
      t: rge.length > 0 ? `Certifié RGE : ${rge.join(', ')}` : 'Non certifié RGE. Cette certification permet d\'accéder aux aides MaPrimeRénov et aux marchés publics de rénovation énergétique',
      consequence: rge.length > 0 ? null : 'Impossible d\'accéder aux marchés de rénovation énergétique subventionnés. Perte de compétitivité face aux concurrents certifiés',
      action: rge.length > 0 ? null : 'Faites certifier votre entreprise par un organisme accrédité (Qualibat, Qualifelec, Qualit\'EnR)',
      penalty: 0, source: 'ADEME / Qualibat', auto: true,
    })

    obs.push({
      d: 'certifications', n: 'Carte BTP',
      s: 'check',
      t: `Carte d'identification professionnelle obligatoire pour chaque salarié intervenant sur un chantier`,
      consequence: `Amende de 4 000 € par salarié sans carte. Avec ${eff} salariés : risque de ${formatMoney(eff * 4000)} €`,
      action: 'Déclarez chaque salarié sur le site cartebtp.fr dans les 48h suivant l\'embauche',
      penalty: eff * 4000,
      source: 'Code du travail — Art. L.8291-1', auto: true,
    })
  }

  if (sec === 'RESTO') {
    obs.push({
      d: 'certifications', n: 'Licence de débit de boissons',
      s: 'check',
      t: 'Obligatoire pour tout établissement servant des boissons alcoolisées',
      consequence: 'Amende de 3 750 € et fermeture administrative possible',
      action: 'Obtenez votre permis d\'exploitation (formation de 20h) puis déclarez votre licence en mairie',
      penalty: 3750, source: 'Code de la santé publique — Art. L.3332-1', auto: true,
    })
    obs.push({
      d: 'certifications', n: 'Formation hygiène alimentaire (HACCP)',
      s: 'check',
      t: 'Au moins une personne dans l\'établissement doit justifier d\'une formation en hygiène alimentaire',
      consequence: 'Fermeture administrative par la DDPP en cas de contrôle. Amende de 1 500 €',
      action: 'Faites suivre la formation HACCP (14h) à au moins un membre de votre équipe. Conservez l\'attestation',
      penalty: 1500, source: 'Décret n°2011-731 du 24 juin 2011', auto: true,
    })
    obs.push({
      d: 'certifications', n: 'Affichage des prix et des allergènes',
      s: 'check',
      t: 'Les prix doivent être affichés à l\'intérieur et à l\'extérieur. Les 14 allergènes doivent être indiqués',
      consequence: 'Amende de 1 500 €. En cas d\'accident allergique sans information, responsabilité pénale du gérant',
      action: 'Affichez vos prix TTC à l\'entrée et en salle. Indiquez les allergènes sur le menu ou par écrit',
      penalty: 1500, source: 'Arrêté du 17/11/2014 — Règlement UE 1169/2011', auto: true,
    })
  }

  if (sec === 'TRANSPORT') {
    obs.push({
      d: 'certifications', n: 'Licence de transport',
      s: 'check',
      t: 'Licence communautaire ou licence de transport intérieur obligatoire',
      consequence: 'Délit pénal : 15 000 € d\'amende et 1 an d\'emprisonnement. Immobilisation des véhicules',
      action: 'Obtenez votre attestation de capacité professionnelle puis demandez votre licence auprès de la DREAL',
      penalty: 15000, source: 'Code des transports — Art. L.3211-1', auto: true,
    })
  }

  if (sec === 'IMMO') {
    obs.push({
      d: 'certifications', n: 'Carte professionnelle immobilière',
      s: 'check',
      t: 'Carte T (transaction) ou G (gestion) obligatoire pour exercer',
      consequence: 'Délit d\'exercice illégal : 6 mois d\'emprisonnement et 7 500 € d\'amende',
      action: 'Demandez votre carte auprès de la CCI. Renouvelable tous les 3 ans avec 42h de formation continue',
      penalty: 7500, source: 'Loi Hoguet n°70-9 / Loi ALUR 2014', auto: true,
    })
  }

  if (sec === 'FORMATION') {
    obs.push({
      d: 'certifications', n: 'Certification Qualiopi',
      s: 'check',
      t: 'Obligatoire pour accéder aux fonds publics et mutualisés de la formation professionnelle',
      consequence: 'Impossible de faire financer les formations par les OPCO, Pôle Emploi ou le CPF. Perte de la majorité des clients',
      action: 'Faites auditer votre organisme par un certificateur accrédité par le COFRAC',
      penalty: 0, source: 'Loi Avenir professionnel n°2018-771 — Art. 6', auto: true,
    })
  }

  return obs
}

// ============================================
// SCORING
// ============================================
export function computeScore(obs) {
  let total = 0, scored = 0
  for (const o of obs) {
    if (o.s === 'info' || o.s === 'reco') continue
    total++
    scored += ({ ok:1, check:0.5, warn:0.3, doc:0.4, bad:0 }[o.s] ?? 0.5)
  }
  return total ? Math.round(scored / total * 100) : 50
}

export function domainScore(obs, domain) {
  const filtered = obs.filter(o => o.d === domain)
  return filtered.length ? { score: computeScore(filtered), count: filtered.length } : { score: null, count: 0 }
}

export function computeTotalRisk(obs) {
  let total = 0
  for (const o of obs) {
    if (o.s !== 'ok' && o.penalty > 0) total += o.penalty
  }
  return total
}

export function scoreColor(s) {
  return s >= 80 ? '#16a34a' : s >= 50 ? '#ea580c' : '#dc2626'
}

export function formatMoney(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Domain metadata
export const DOMAINS = {
  fiscal: { label: 'Fiscal', icon: '📊' },
  social: { label: 'Social / RH', icon: '👥' },
  assurances: { label: 'Assurances', icon: '🛡️' },
  juridique: { label: 'Juridique', icon: '⚖️' },
  certifications: { label: 'Certifications', icon: '📜' },
}

export const STATUS = {
  ok: { label:'Conforme', color:'#16a34a', bg:'#f0fdf4' },
  check: { label:'À vérifier', color:'#ea580c', bg:'#fff7ed' },
  warn: { label:'Attention', color:'#dc2626', bg:'#fef2f2' },
  bad: { label:'Critique', color:'#dc2626', bg:'#fef2f2' },
  doc: { label:'Document requis', color:'#4f46e5', bg:'#eef2ff' },
  info: { label:'À anticiper', color:'#7c3aed', bg:'#faf5ff' },
  reco: { label:'Recommandé', color:'#0891b2', bg:'#ecfeff' },
}

// Sector data for landing page
export const SECTORS_DISPLAY = [
  { icon:'🔨', name:'BTP & Construction', detail:'Décennale, RGE, carte BTP, DUERP chantier, Qualibat, coordination SPS…' },
  { icon:'🍳', name:'Restauration', detail:'HACCP, licence alcool, affichage prix, allergènes, normes ERP…' },
  { icon:'💇', name:'Artisanat', detail:'Qualification professionnelle, RC Pro, registre des métiers…' },
  { icon:'👗', name:'Mode & Commerce', detail:'RGPD e-commerce, étiquetage, REP textile, affichage environnemental…' },
  { icon:'💻', name:'Tech & Services', detail:'RGPD, CGV, propriété intellectuelle, hébergement de données…' },
  { icon:'🏠', name:'Immobilier', detail:'Carte T/G, loi Alur, DPE, assurance RC Pro, anti-blanchiment…' },
  { icon:'🚛', name:'Transport', detail:'Licence transport, capacité professionnelle, chronotachygraphe…' },
  { icon:'🎓', name:'Formation', detail:'Qualiopi, bilan pédagogique, déclaration d\'activité, CGV formation…' },
]
