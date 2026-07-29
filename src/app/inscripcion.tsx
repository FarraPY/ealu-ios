import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Aviso,
  Cargando,
  ListaDatos,
  Pantalla,
  Segmentos,
  Tarjeta,
  Titulo,
  useColores,
} from '@/components/base';
import { SelectorMalla } from '@/components/selector-malla';
import { Spacing } from '@/constants/theme';
import {
  apiPostForm,
  AsignaturaHabilitada,
  desenvolver,
  Inscripcion,
  RespuestaHabilitadas,
} from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { useApi } from '@/lib/useApi';

const AMBITOS = ['Materias', 'Exámenes'] as const;
type Ambito = (typeof AMBITOS)[number];

const VISTAS = ['Disponibles', 'Preinscriptas', 'Inscriptas', 'Horarios'] as const;
type Vista = (typeof VISTAS)[number];

export default function InscripcionScreen() {
  const { codcarsec } = useSesion();
  const [ambito, setAmbito] = useState<Ambito>('Materias');
  const [vista, setVista] = useState<Vista>('Inscriptas');

  const ruta = rutaDe(ambito, vista, codcarsec);
  const consulta = useApi<unknown>(codcarsec ? ruta : null);
  const datos = desenvolver(consulta.datos);

  return (
    <Pantalla refrescando={consulta.refrescando} onRefresh={consulta.recargar}>
      <SelectorMalla />
      <Segmentos opciones={AMBITOS} valor={ambito} onCambio={setAmbito} />
      <Segmentos opciones={VISTAS} valor={vista} onCambio={setVista} />

      {consulta.cargando ? (
        <Cargando />
      ) : consulta.error ? (
        <Aviso texto={consulta.error} />
      ) : ambito === 'Materias' && vista === 'Disponibles' ? (
        <Habilitadas
          respuesta={(consulta.datos as RespuestaHabilitadas) ?? {}}
          codcarsec={codcarsec}
          onGuardado={consulta.recargar}
        />
      ) : Array.isArray(datos) && datos.length && vista !== 'Horarios' ? (
        <PorSemestre materias={datos as Inscripcion[]} />
      ) : (
        <ListaDatos datos={datos} vacio={vacioDe(ambito, vista)} />
      )}
    </Pantalla>
  );
}

function rutaDe(ambito: Ambito, vista: Vista, cc: string): string {
  if (ambito === 'Materias') {
    return {
      Disponibles: `asig-habilitadas/${cc}`,
      Preinscriptas: `preinscripciones-registradas/${cc}`,
      Inscriptas: `inscripciones-registradas/${cc}`,
      Horarios: 'horarios',
    }[vista];
  }
  return {
    Disponibles: `inscexafinal/examenes-habilitados/${cc}`,
    // `buff` es el buffer de preinscripción, distinto de las ya registradas.
    Preinscriptas: `inscexafinal/buff/${cc}`,
    Inscriptas: `inscexafinal/registradas/${cc}`,
    Horarios: `horario-examen/${cc}`,
  }[vista];
}

/**
 * Los vacíos de exámenes casi nunca significan un error: en varias facultades la
 * inscripción a finales se hace presencialmente en la cátedra y recién después
 * alguien la carga acá —si la carga—. Decirlo evita que el usuario crea que la
 * app falló y vaya a revisar la web para encontrar lo mismo.
 */
function vacioDe(ambito: Ambito, vista: Vista): string {
  if (vista === 'Horarios') return 'No hay horarios publicados para este período.';

  if (ambito === 'Exámenes') {
    return vista === 'Disponibles'
      ? 'No hay exámenes habilitados para inscribirse en línea. En muchas facultades la inscripción se hace presencialmente en cada cátedra, y recién después la cargan al sistema.'
      : 'No figuran exámenes registrados. Si ya te inscribiste en la cátedra, puede que todavía no lo hayan cargado acá: deslizá hacia abajo para volver a consultar.';
  }

  return vista === 'Disponibles'
    ? 'No hay materias habilitadas para preinscribirse en este momento.'
    : 'No hay registros para esta malla en el período actual.';
}

// ------------------------------------------------------- preinscripción (POST)

function Habilitadas({
  respuesta,
  codcarsec,
  onGuardado,
}: {
  respuesta: RespuestaHabilitadas;
  codcarsec: string;
  onGuardado: () => void;
}) {
  const c = useColores();
  const { info } = useSesion();
  const asignaturas = respuesta.data ?? [];
  const cerrada = respuesta.extraValues?.cierreHecho === true;
  const eligePago = respuesta.extraValues?.formaPagoSeleccionable === true;

  // value del turno/sección elegido por asignatura; ausente = no seleccionada.
  const [elegidas, setElegidas] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const a of asignaturas) {
      const sec = a.turnoSeccionList?.find((s) => s.checked);
      if (a.checked && sec) inicial[a.codasign] = sec.value;
    }
    return inicial;
  });
  const [guardando, setGuardando] = useState(false);

  // La web separa las materias por semestre; sin eso, las optativas de cursos
  // viejos se mezclan con las del semestre actual y no se distingue cuál es cuál.
  const gruposPorCurso = useMemo(() => {
    const mapa = new Map<string, AsignaturaHabilitada[]>();
    for (const a of asignaturas) {
      const clave = a.curso?.trim() || 'Sin curso';
      mapa.set(clave, [...(mapa.get(clave) ?? []), a]);
    }
    return [...mapa.entries()].sort(
      (x, y) => (x[1][0].codcurso ?? 0) - (y[1][0].codcurso ?? 0)
    );
  }, [asignaturas]);

  if (!asignaturas.length) return <Aviso texto={vacioDe('Materias', 'Disponibles')} />;

  function alternar(a: AsignaturaHabilitada) {
    setElegidas((prev) => {
      const copia = { ...prev };
      if (copia[a.codasign]) delete copia[a.codasign];
      else copia[a.codasign] = (a.turnoSeccionList?.[0]?.value ?? '').trim();
      return copia;
    });
  }

  /** Paso 1: guarda el borrador. Reversible mientras no se cierre. */
  async function registrar(): Promise<void> {
    await apiPostForm(`registrar-preinscripciones/${codcarsec}`, {
      anhoConvocCodcarsecCodasignTurnoSeccionList: Object.values(elegidas)
        .filter(Boolean)
        .join(','),
    });
  }

  function guardar() {
    const marcadas = asignaturas.filter((a) => elegidas[a.codasign]).length;
    const sinMarcar = asignaturas.length - marcadas;

    Alert.alert(
      'Guardar preinscripción',
      `Se guardan ${marcadas} materia(s)` +
        (sinMarcar ? `; las ${sinMarcar} sin marcar quedan fuera` : '') +
        '.\n\nPodés volver y cambiarla las veces que quieras: recién se envía ' +
        'cuando la cerrás.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Guardar',
          onPress: async () => {
            setGuardando(true);
            try {
              await registrar();
              Alert.alert(
                'Guardada',
                'Tu selección quedó guardada. Todavía podés modificarla; se envía al cerrar la preinscripción.'
              );
              onGuardado();
            } catch (err) {
              Alert.alert('No se pudo guardar', mensajeDe(err));
            } finally {
              setGuardando(false);
            }
          },
        },
      ]
    );
  }

  /** Paso 2: cierra y envía. Irreversible. */
  function cerrar() {
    const marcadas = asignaturas.filter((a) => elegidas[a.codasign]).length;

    const ejecutar = async (modoPago: 'CONTADO' | 'CUOTAS') => {
      setGuardando(true);
      try {
        await registrar();
        await apiPostForm(`cerrar-preinscripcion/${codcarsec}?modoPago=${modoPago}`, {});
        Alert.alert('Preinscripción cerrada', 'Tu preinscripción fue enviada.');
        onGuardado();
      } catch (err) {
        Alert.alert('No se pudo cerrar', mensajeDe(err));
      } finally {
        setGuardando(false);
      }
    };

    const aviso =
      `Vas a cerrar tu preinscripción con ${marcadas} materia(s).\n\n` +
      'Después de cerrarla NO vas a poder cambiar la selección ni agregar otras ' +
      'materias. Asegurate de que estén TODAS las que vas a cursar.';

    Alert.alert(
      'Cerrar preinscripción',
      aviso,
      eligePago
        ? [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Pago contado', onPress: () => ejecutar('CONTADO') },
            { text: 'Pago en cuotas', onPress: () => ejecutar('CUOTAS') },
          ]
        : [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar y enviar', style: 'destructive', onPress: () => ejecutar('CONTADO') },
          ]
    );
  }

  if (cerrada) {
    return (
      <>
        <Aviso texto="Ya cerraste tu preinscripción de este período, así que no admite cambios. Podés ver el detalle en Preinscriptas." />
        {asignaturas.map((a) => (
          <Tarjeta key={a.codasign}>
            <Text style={[e.asignatura, { color: c.text }]}>
              {a.asignaturaStr?.trim() || a.asignatura?.trim()}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>{a.curso?.trim()}</Text>
          </Tarjeta>
        ))}
      </>
    );
  }

  return (
    <>
      {/* Guardar deja un borrador que sobrevive al cierre de la app; cerrar es lo
          que envía y congela la selección. Distinguirlo bien importa: cerrar de
          más deja al alumno sin poder inscribirse al resto de sus materias. */}
      <Aviso texto="Guardar conserva tu selección para seguir después. Cerrar envía lo guardado y ya no vas a poder cambiarla ni agregar otras materias." />

      {/* Solo la cuenta: un "N de M" haría pensar que M es un tope, y no lo hay. */}
      <Text style={{ color: c.textSecondary, fontSize: 13, marginBottom: Spacing.one }}>
        Materias seleccionadas: {Object.keys(elegidas).length}
      </Text>

      {gruposPorCurso.map(([curso, lista]) => (
        <View key={curso}>
          <Titulo>{curso}</Titulo>
          {lista.map((a) => {
            const seleccionada = !!elegidas[a.codasign];
            const secciones = a.turnoSeccionList ?? [];
            return (
          <Pressable key={a.codasign} onPress={() => a.puedeModificar && alternar(a)}>
            <Tarjeta>
              <View style={e.fila}>
                <View
                  style={[
                    e.casilla,
                    { borderColor: seleccionada ? c.marca : c.textSecondary },
                    seleccionada && { backgroundColor: c.marca },
                  ]}>
                  {seleccionada ? <Text style={e.tilde}>✓</Text> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[e.asignatura, { color: c.text }]}>
                    {a.asignaturaStr?.trim() || a.asignatura?.trim()}
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                    {[
                      secciones.length === 1 ? secciones[0]?.text?.trim() : null,
                      a.optativa ? 'Optativa' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {!a.puedeModificar ? (
                    <Text style={{ color: c.textSecondary, fontSize: 12 }}>No modificable</Text>
                  ) : null}
                </View>
              </View>

              {/* Con más de una sección hay que poder elegir turno y profesor,
                  igual que el desplegable de la web. */}
              {seleccionada && secciones.length > 1 ? (
                <View style={e.secciones}>
                  {secciones.map((s) => {
                    const activa = elegidas[a.codasign] === s.value;
                    return (
                      <Pressable
                        key={s.value}
                        onPress={() =>
                          setElegidas((prev) => ({ ...prev, [a.codasign]: s.value }))
                        }
                        style={[
                          e.chip,
                          { backgroundColor: activa ? c.marca : c.backgroundSelected },
                        ]}>
                        <Text
                          style={{
                            color: activa ? '#fff' : c.text,
                            fontSize: 13,
                            fontWeight: activa ? '600' : '400',
                          }}>
                          {s.text?.trim() || `${s.turno}/${s.seccion}`.trim()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
                </Tarjeta>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable
        onPress={guardar}
        disabled={guardando}
        style={[e.boton, { backgroundColor: c.backgroundElement, opacity: guardando ? 0.5 : 1 }]}>
        <Text style={[e.botonTexto, { color: c.text }]}>
          {guardando ? 'Guardando…' : 'Guardar preinscripción'}
        </Text>
      </Pressable>

      <Pressable
        onPress={cerrar}
        disabled={guardando}
        style={[e.boton, { backgroundColor: c.marca, opacity: guardando ? 0.5 : 1 }]}>
        <Text style={[e.botonTexto, { color: '#fff' }]}>Guardar y cerrar preinscripción</Text>
      </Pressable>
    </>
  );
}

function mensajeDe(err: unknown): string {
  return err instanceof Error ? err.message : 'Error desconocido.';
}

// ------------------------------------------------------------ materias cursando

/**
 * Agrupa por semestre igual que Calificaciones. Sin esto, una lista de 18 materias
 * de años distintos es imposible de leer de un vistazo.
 */
function PorSemestre({ materias }: { materias: Inscripcion[] }) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, { orden: number; materias: Inscripcion[] }>();
    for (const m of materias) {
      const titulo = [m.curso?.trim(), m.anho].filter(Boolean).join(' · ') || 'Sin curso';
      const g = mapa.get(titulo) ?? { orden: (m.anho ?? 0) * 100 + (m.codcurso ?? 0), materias: [] };
      g.materias.push(m);
      mapa.set(titulo, g);
    }
    // Más reciente arriba.
    return [...mapa.entries()].sort((a, b) => b[1].orden - a[1].orden);
  }, [materias]);

  return (
    <>
      {grupos.map(([titulo, g]) => (
        <View key={titulo}>
          <Titulo>{titulo}</Titulo>
          {g.materias.map((m, i) => (
            <FilaMateria key={i} materia={m} />
          ))}
        </View>
      ))}
    </>
  );
}

function FilaMateria({ materia }: { materia: Inscripcion }) {
  const c = useColores();
  const detalles = [
    materia.curso?.trim(),
    materia.turno && materia.seccion
      ? `${materia.turno.trim()}/${materia.seccion.trim()}`
      : null,
    materia.anho ? String(materia.anho) : null,
  ].filter(Boolean);

  return (
    <Tarjeta>
      <View style={{ gap: 4 }}>
        <Text style={[e.asignatura, { color: c.text }]}>{materia.asignatura?.trim()}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>{detalles.join(' · ')}</Text>
        {typeof materia.porcasis === 'number' && materia.porcasis > 0 ? (
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            Asistencia: {materia.porcasis}%
          </Text>
        ) : null}
      </View>
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  asignatura: { fontSize: 15, fontWeight: '600' },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 8 },
  tilde: { color: '#fff', fontSize: 14, fontWeight: '700' },
  boton: {
    marginTop: Spacing.three,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
