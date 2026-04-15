// ============================================
// ACCESSA — API Client
// Connects to French government public APIs
// ============================================

const SEARCH_API = 'https://recherche-entreprises.api.gouv.fr/search'
const BODACC_API = 'https://bodacc-datadila.opendatasoft.com/api/records/1.0/search'

// --- Main company search ---
export async function searchCompany(siren) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(
      `${SEARCH_API}?q=${siren}&page=1&per_page=1`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`API returned ${res.status}`)
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return { success: false, error: 'not_found' }
    }

    return { success: true, company: data.results[0] }
  } catch (err) {
    clearTimeout(timeout)
    return { success: false, error: 'network' }
  }
}

// --- Bodacc: check for legal procedures (redressement, liquidation, etc.) ---
export async function searchBodacc(siren) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(
      `${BODACC_API}?dataset=annonces-commerciales&q=${siren}&rows=5&sort=dateparution&facet=typeavis`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (!res.ok) return { success: true, records: [] }
    const data = await res.json()

    const records = (data.records || []).map(r => ({
      type: r.fields?.typeavis || '',
      date: r.fields?.dateparution || '',
      description: r.fields?.libellenatureannonce || r.fields?.typeavis || '',
      tribunal: r.fields?.tribunal || '',
      raw: r.fields,
    }))

    return { success: true, records }
  } catch (err) {
    clearTimeout(timeout)
    return { success: true, records: [] } // Don't block on Bodacc failure
  }
}

// --- Analyze Bodacc results for risk signals ---
export function analyzeBodacc(records) {
  const alerts = []

  for (const r of records) {
    const type = (r.type || '').toLowerCase()
    const desc = (r.description || '').toLowerCase()

    if (desc.includes('liquidation') || type.includes('liquidation')) {
      alerts.push({
        severity: 'critical',
        title: 'Procédure de liquidation judiciaire',
        detail: `Publication au Bodacc le ${r.date}${r.tribunal ? ' — ' + r.tribunal : ''}`,
        date: r.date,
      })
    } else if (desc.includes('redressement') || type.includes('redressement')) {
      alerts.push({
        severity: 'critical',
        title: 'Procédure de redressement judiciaire',
        detail: `Publication au Bodacc le ${r.date}${r.tribunal ? ' — ' + r.tribunal : ''}`,
        date: r.date,
      })
    } else if (desc.includes('sauvegarde')) {
      alerts.push({
        severity: 'warning',
        title: 'Procédure de sauvegarde',
        detail: `Publication au Bodacc le ${r.date}`,
        date: r.date,
      })
    } else if (desc.includes('radiation') || desc.includes('clôture')) {
      alerts.push({
        severity: 'info',
        title: r.description,
        detail: `Publication au Bodacc le ${r.date}`,
        date: r.date,
      })
    } else if (desc.includes('vente') || desc.includes('cession')) {
      alerts.push({
        severity: 'info',
        title: 'Cession ou vente publiée',
        detail: `Publication au Bodacc le ${r.date}`,
        date: r.date,
      })
    }
  }

  return alerts
}

// --- Full company analysis (combines all APIs) ---
export async function fullCompanySearch(siren) {
  // Run both APIs in parallel
  const [companyResult, bodaccResult] = await Promise.all([
    searchCompany(siren),
    searchBodacc(siren),
  ])

  if (!companyResult.success) {
    return companyResult
  }

  const bodaccAlerts = analyzeBodacc(bodaccResult.records || [])

  return {
    success: true,
    company: companyResult.company,
    bodacc: {
      records: bodaccResult.records || [],
      alerts: bodaccAlerts,
    },
  }
}
