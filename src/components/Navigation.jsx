import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navigation({ onLogoClick, rightLabel }) {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  return (
    <nav className="nav" style={{ justifyContent: 'space-between' }}>
      <span className="nav-logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
        Accessa
      </span>

      <span className="nav-label" style={{ flex: 1, textAlign: 'center' }}>
        {rightLabel || 'Conformité administrative'}
      </span>

      {!loading && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              style={btnDashboard}
            >
              Mon espace →
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                style={btnOutline}
              >
                Se connecter
              </button>
              <button
                onClick={() => navigate('/signup')}
                style={btnFilled}
              >
                Créer un compte
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

const btnBase = {
  padding: '7px 16px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
}

const btnOutline = {
  ...btnBase,
  border: '1.5px solid #e2e8f0',
  background: 'white',
  color: '#374151',
}

const btnFilled = {
  ...btnBase,
  border: 'none',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  color: 'white',
  boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
}

const btnDashboard = {
  ...btnBase,
  border: 'none',
  background: '#eef2ff',
  color: '#4f46e5',
}
