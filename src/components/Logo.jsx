// Símbolo: una puerta en arco con una luz dentro.
export default function Logo({ tamano = 36, texto = true }) {
  return (
    <span className="logo">
      <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="16" fill="var(--primario)" />
        <path d="M18 52V30a14 14 0 0 1 28 0v22z" fill="var(--sobre-primario)" />
        <circle cx="32" cy="36" r="5" fill="#F2B45A" />
      </svg>
      {texto && <span className="logo-texto">Antesala</span>}
    </span>
  )
}
