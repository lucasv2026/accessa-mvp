export default function Navigation({ onLogoClick, rightLabel }) {
  return (
    <nav className="nav">
      <span className="nav-logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
        Accessa
      </span>
      <span className="nav-label">{rightLabel || 'Conformité administrative'}</span>
    </nav>
  )
}
