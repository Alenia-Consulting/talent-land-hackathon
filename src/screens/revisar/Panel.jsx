import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DesktopShell from '../../components/DesktopShell.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import NoiseBadge from '../../components/NoiseBadge.jsx'
import StepThumb from '../../components/StepThumb.jsx'
import SitePlayer from '../../components/SitePlayer.jsx'
import OrigenGuia from '../../components/OrigenGuia.jsx'
import { datosPendientes, useAppStore, useLugar } from '../../state/AppStore.jsx'
import { minutosSegundos } from '../../state/formato.js'
import { ErrorImagen, reducirImagen } from '../../services/imagenes.js'
import { FILTRO_VOZ_HZ } from '../../config.js'
import { usaFoto, videoUrlDe } from '../../state/medio.js'

/** Lista editable: un elemento por línea; se guarda al salir del campo. */
function CampoLista({ id, etiqueta, valor, alGuardar }) {
  const [texto, setTexto] = useState(valor.join('\n'))
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <textarea
        id={id}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => alGuardar(texto.split('\n').map((l) => l.trim()).filter(Boolean))}
      />
    </div>
  )
}

export default function Panel() {
  const { lugarId } = useParams()
  const lugar = useLugar(lugarId)
  const { dispatch } = useAppStore()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const selectorFoto = useRef(null)
  const [errorFoto, setErrorFoto] = useState('')

  if (!lugar) {
    return (
      <DesktopShell>
        <h1>Todavía no hay guía</h1>
        <p className="lectura">Sube el vídeo del recorrido y la IA monta el borrador.</p>
        <Button to="/grabar/subir" icono="subir" grande>Subir un vídeo</Button>
      </DesktopShell>
    )
  }

  const n = lugar.pasos.length
  const indice = Math.min(Math.max((Number(params.get('paso')) || 1) - 1, 0), n - 1)
  const paso = lugar.pasos[indice]
  const pendientes = datosPendientes(lugar)
  const totalFaltan = lugar.pasos.reduce((s, p) => s + (p.faltan?.length || 0), 0)
  const revisados = lugar.pasos.filter((p) => p.revisado).length
  const publicada = lugar.estado === 'publicada'
  const duracionTotal = Math.max(...lugar.pasos.map((p) => p.fin ?? 0), 1)

  const cambiar = (cambios) => dispatch({ tipo: 'ACTUALIZAR_PASO', lugarId: lugar.id, indice, cambios })
  const cambiarTramo = (campo, valor) => {
    const v = Math.min(Math.max(Number(valor) || 0, 0), duracionTotal)
    const inicio = campo === 'inicio' ? v : paso.inicio
    const fin = campo === 'fin' ? v : paso.fin
    if (fin - inicio < 1) return
    cambiar({ inicio, fin, duracion: minutosSegundos(fin - inicio) })
  }

  async function alElegirFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    setErrorFoto('')
    try {
      const fotoSubida = await reducirImagen(archivo)
      cambiar({ fotoSubida, medio: 'foto' })
    } catch (err) {
      setErrorFoto(err instanceof ErrorImagen ? err.message : 'No se pudo cargar la foto. Prueba con otra.')
    }
  }

  function publicar() {
    dispatch({ tipo: 'PUBLICAR', lugarId: lugar.id })
    navegar(`/publicar/${lugar.id}`)
  }

  return (
    <DesktopShell>
      <div className="fila-espacio" style={{ marginBottom: 16 }}>
        <div>
          <Link to="/cliente/guias">← Todas las guías</Link>
          <h1 style={{ margin: '4px 0 0' }}>{lugar.nombre}</h1>
          <OrigenGuia lugar={lugar} />
        </div>
        <Button to={`/guia/${lugar.id}`} icono="ojo" variante="sec">Ver como persona usuaria</Button>
      </div>

      <div className="panel">
        <nav aria-label="Pasos de la guía">
          <ol className="panel-lista lista-limpia">
            {lugar.pasos.map((p, i) => (
              <li key={`${p.nombre}-${i}`}>
                <button
                  type="button"
                  className="panel-paso"
                  aria-current={i === indice}
                  onClick={() => setParams({ paso: String(i + 1) })}
                >
                  <StepThumb paso={p} tamano={44} redondeo={10} />
                  <span style={{ flex: 1 }}>
                    {i + 1}. {p.nombre}
                  </span>
                  {(p.faltan || []).some((d) => !String(p.completado?.[d] ?? '').trim()) && (
                    <span className="etiqueta-ambar" style={{ padding: '2px 8px', fontSize: 13 }}>
                      {(p.faltan || []).filter((d) => !String(p.completado?.[d] ?? '').trim()).length} dato
                    </span>
                  )}
                  {p.revisado && <Icon nombre="check" size={20} />}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section aria-labelledby="editor" className="tarjeta">
          <h2 id="editor">{paso.nombre}</h2>
          <SitePlayer
            key={`${lugar.id}-${indice}-${videoUrlDe(lugar, paso) ? 'clip' : 'foto'}`}
            videoUrl={videoUrlDe(lugar, paso)}
            inicio={paso.inicio ?? 0}
            fin={paso.fin}
            paso={paso}
            filtroHz={FILTRO_VOZ_HZ}
          />

          <fieldset className="campo" style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
            <legend>Qué enseña este paso</legend>
            <div className="envuelto" role="group" aria-label="Qué enseña este paso">
              {lugar.videoUrl && (
                <button type="button" className="chip" aria-pressed={!usaFoto(paso)} onClick={() => cambiar({ medio: 'clip' })}>
                  Clip del vídeo
                </button>
              )}
              <button
                type="button"
                className="chip"
                aria-pressed={usaFoto(paso)}
                disabled={!paso.fotoSubida}
                onClick={() => cambiar({ medio: 'foto' })}
              >
                Foto
              </button>
            </div>
            <input
              ref={selectorFoto}
              type="file"
              accept="image/*"
              hidden
              onChange={alElegirFoto}
              aria-label="Elegir una foto para este paso"
            />
            <div className="fila" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <Button icono="subir" variante="sec" onClick={() => selectorFoto.current?.click()}>
                {paso.fotoSubida ? 'Cambiar la foto' : 'Subir una foto'}
              </Button>
              {paso.fotoSubida && (
                <Button icono="cerrar" variante="sec" onClick={() => cambiar({ fotoSubida: null, medio: 'clip' })}>
                  Quitar la foto
                </Button>
              )}
            </div>
            {errorFoto && <p className="sec" role="alert" style={{ marginTop: 8 }}>{errorFoto}</p>}
            {!lugar.videoUrl && !paso.fotoSubida && (
              <p className="sec" style={{ marginTop: 8 }}>Este lugar no tiene clip. Sube una foto para enseñar el paso.</p>
            )}
          </fieldset>

          {videoUrlDe(lugar, paso) && paso.inicio !== undefined && (
            <>
            <div style={{ marginTop: 16 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>Ajusta inicio y fin del clip</p>
              <p className="sec" style={{ marginBottom: 0 }}>
                {paso.fotoT != null ? `La foto del paso sale del segundo ${Math.round(paso.fotoT)}. ` : ''}
                El clip dura {Math.max(0, Math.round((paso.fin ?? 0) - (paso.inicio ?? 0)))} s.
              </p>
            </div>
            <div className="rejilla-2" style={{ marginTop: 8 }}>
              <div className="campo">
                <label htmlFor="inicio">El clip empieza en (s)</label>
                <input id="inicio" type="number" min="0" max={duracionTotal} step="0.5" value={paso.inicio} onChange={(e) => cambiarTramo('inicio', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="fin">El clip acaba en (s)</label>
                <input id="fin" type="number" min="0" max={duracionTotal} step="0.5" value={paso.fin} onChange={(e) => cambiarTramo('fin', e.target.value)} />
              </div>
            </div>
            </>
          )}
          <p style={{ marginTop: 12 }}>
            <NoiseBadge nivel={paso.ruido} mostrarTono />{' '}
            <span className="sec">
              {paso.ruidoDbfs === null || paso.ruidoDbfs === undefined ? '' : `${paso.ruidoDbfs} dBFS · medido del audio, no se edita`}
            </span>
          </p>

          <p className="sec" style={{ marginTop: 0 }}>Voces filtradas: se oye el ambiente, pero no las conversaciones.</p>
          <div className="campo">
            <label htmlFor="texto">Texto en lectura fácil</label>
            <span className="sec" style={{ fontSize: 15 }}>Frases cortas · Una idea por frase · Segunda persona</span>
            <textarea id="texto" value={paso.texto} onChange={(e) => cambiar({ texto: e.target.value })} />
          </div>
          <CampoLista key={indice} id="detalles" etiqueta="Qué esperar (uno por línea)" valor={paso.detalles || []} alGuardar={(detalles) => cambiar({ detalles })} />
          <div className="campo">
            <label htmlFor="ayuda">A quién pedir ayuda</label>
            <input id="ayuda" value={paso.ayuda || ''} onChange={(e) => cambiar({ ayuda: e.target.value || null })} />
          </div>

          {(paso.faltan || []).length > 0 && (
            <fieldset className="tarjeta" style={{ marginBottom: 16 }}>
              <legend className="etiqueta-ambar">Datos que faltan</legend>
              {paso.faltan.map((dato) => (
                <div className="campo" key={dato}>
                  <label htmlFor={`dato-${dato}`}>{dato}</label>
                  <input
                    id={`dato-${dato}`}
                    value={paso.completado?.[dato] ?? ''}
                    onChange={(e) => dispatch({ tipo: 'COMPLETAR_DATO', lugarId: lugar.id, indice, dato, valor: e.target.value })}
                  />
                </div>
              ))}
            </fieldset>
          )}

          <div className="fila">
            <Button icono="check" variante={paso.revisado ? 'primario' : 'sec'} aria-pressed={Boolean(paso.revisado)} onClick={() => cambiar({ revisado: !paso.revisado })}>
              {paso.revisado ? 'Paso revisado' : 'Marcar como revisado'}
            </Button>
            {indice < n - 1 && (
              <Button icono="der" variante="sec" onClick={() => setParams({ paso: String(indice + 2) })}>Siguiente paso</Button>
            )}
          </div>
        </section>

        <aside className="tarjeta" aria-labelledby="lista-final">
          <h2 id="lista-final">Antes de publicar</h2>
          <ul className="lista-limpia">
            <li className="tarea">
              <span className={`tarea-marca${pendientes.length === 0 ? ' hecha' : ''}`} style={pendientes.length === 0 ? { background: 'var(--primario)', color: 'var(--sobre-primario)', borderColor: 'var(--primario)' } : undefined}>
                {pendientes.length === 0 && <Icon nombre="check" size={16} />}
              </span>
              <span>Datos completados: {totalFaltan - pendientes.length} de {totalFaltan}</span>
            </li>
            <li className="tarea hecha">
              <span className="tarea-marca"><Icon nombre="check" size={16} /></span>
              <span>Voces filtradas al escuchar</span>
            </li>
            <li className="tarea prevista">
              <span className="tarea-marca" />
              <span>Caras difuminadas · previsto</span>
            </li>
            <li className="tarea">
              <span className="tarea-marca" />
              <span>Pasos revisados: {revisados} de {n}</span>
            </li>
          </ul>
          {publicada ? (
            <Button to={`/publicar/${lugar.id}`} icono="qr" grande bloque>Ver enlace y QR</Button>
          ) : (
            <Button icono="check" grande bloque disabled={pendientes.length > 0} onClick={publicar}>
              Aprobar y publicar
            </Button>
          )}
          {!publicada && pendientes.length > 0 && (
            <p className="sec" role="status" style={{ marginTop: 12 }}>
              Falta: {pendientes.map((p) => `${p.dato} (${p.paso})`).join(', ')}.
            </p>
          )}
          <p className="sec" style={{ marginTop: 12 }}>Nada se publica sin tu aprobación.</p>
        </aside>
      </div>
    </DesktopShell>
  )
}
