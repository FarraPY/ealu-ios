import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { Peligro, Spacing } from '@/constants/theme';
import { Extension, NotaFinal, NotasFinales } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { useApi } from '@/lib/useApi';

const VISTAS = ['Finales', 'Firmas', 'Parciales', 'Extensión', 'Libres'] as const;
type Vista = (typeof VISTAS)[number];

const RUTA: Record<Vista, string> = {
  Finales: 'notas_finales',
  Firmas: 'firmas',
  Parciales: 'notas_parciales',
  Extensión: 'actividad_extension',
  Libres: 'notas_libres',
};

const VACIO: Record<Vista, string> = {
  Finales: 'No hay calificaciones finales registradas para esta malla.',
  Firmas: 'No hay firmas registradas en este período.',
  Parciales:
    'No hay parciales cargados. La sección existe, pero los puntajes dependen de que la facultad los suba al sistema.',
  Extensión: 'No hay actividades de extensión universitaria registradas.',
  Libres: 'No hay actas libres registradas.',
};

function fechaDe(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function Notas() {
  const { codcarsec } = useSesion();
  const [vista, setVista] = useState<Vista>('Finales');

  const consulta = useApi<unknown>(codcarsec ? `${RUTA[vista]}/${codcarsec}` : null);

  return (
    <Pantalla refrescando={consulta.refrescando} onRefresh={consulta.recargar}>
      <SelectorMalla />
      <Segmentos opciones={VISTAS} valor={vista} onCambio={setVista} />

      {consulta.cargando ? (
        <Cargando />
      ) : consulta.error ? (
        <Aviso texto={consulta.error} />
      ) : vista === 'Finales' ? (
        <Finales datos={consulta.datos as NotasFinales | null} />
      ) : vista === 'Firmas' ? (
        <Firmas datos={consulta.datos as Firma[] | null} />
      ) : vista === 'Extensión' ? (
        <ExtensionUniv datos={consulta.datos as Extension | null} />
      ) : (
        <ListaDatos datos={consulta.datos} vacio={VACIO[vista]} />
      )}
    </Pantalla>
  );
}

// ---------------------------------------------------------------------- finales

function Finales({ datos }: { datos: NotasFinales | null }) {
  const c = useColores();
  const notas = datos?.notas ?? [];
  // Por defecto los semestres más recientes primero: es lo que se consulta.
  const [recientesPrimero, setRecientesPrimero] = useState(true);
  const [detalle, setDetalle] = useState<NotaFinal | null>(null);

  const porCurso = useMemo(() => {
    const mapa = new Map<number, { titulo: string; notas: NotaFinal[] }>();
    for (const n of notas) {
      const clave = n.codcurso ?? 0;
      const grupo = mapa.get(clave) ?? { titulo: n.descripcurso?.trim() || 'Sin curso', notas: [] };
      grupo.notas.push(n);
      mapa.set(clave, grupo);
    }
    const orden = [...mapa.entries()].sort((a, b) => a[0] - b[0]);
    return recientesPrimero ? orden.reverse() : orden;
  }, [notas, recientesPrimero]);

  if (!notas.length) return <Aviso texto={VACIO.Finales} />;

  return (
    <>
      <Tarjeta>
        <View style={e.entreFilas}>
          <View>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>Promedio general</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>
              {notas.length} materias aprobadas
            </Text>
          </View>
          <Text style={[e.promedio, { color: c.text }]}>{(datos?.promedio ?? 0).toFixed(2)}</Text>
        </View>
      </Tarjeta>

      <Pressable
        onPress={() => setRecientesPrimero((v) => !v)}
        style={[e.orden, { backgroundColor: c.backgroundElement }]}>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>Orden</Text>
        <Text style={{ color: c.marca, fontSize: 13, fontWeight: '600' }}>
          {recientesPrimero ? 'Últimos semestres primero' : 'Primeros semestres primero'}
        </Text>
      </Pressable>

      {porCurso.map(([codcurso, grupo]) => (
        <View key={codcurso}>
          <Titulo>{grupo.titulo}</Titulo>
          {grupo.notas.map((n, i) => (
            <FilaNota key={`${n.codasign}-${i}`} nota={n} onDetalle={() => setDetalle(n)} />
          ))}
        </View>
      ))}

      <DetalleNota nota={detalle} onCerrar={() => setDetalle(null)} />
    </>
  );
}

function FilaNota({ nota, onDetalle }: { nota: NotaFinal; onDetalle: () => void }) {
  const c = useColores();
  const aplazado = nota.valornota === 1;

  return (
    <Pressable onPress={onDetalle}>
      <Tarjeta>
        <View style={e.filaNota}>
          <View style={e.notaCaja}>
            <Text style={[e.notaValor, { color: aplazado ? Peligro : c.text }]}>
              {nota.nota?.trim()}
            </Text>
          </View>

          <View style={e.filaTexto}>
            <Text style={[e.asignatura, { color: c.text }]}>{nota.descripasign?.trim()}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>
              {[
                nota.codasign?.trim(),
                nota.descripnota?.trim(),
                nota.cantcred ? `${nota.cantcred} créd.` : null,
                nota.anho,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <Text style={{ color: c.marca, fontSize: 13, fontWeight: '600' }}>Más info</Text>
        </View>
      </Tarjeta>
    </Pressable>
  );
}

function DetalleNota({ nota, onCerrar }: { nota: NotaFinal | null; onCerrar: () => void }) {
  const c = useColores();
  if (!nota) return null;

  const campos: [string, string | null][] = [
    ['Asignatura', nota.descripasign?.trim()],
    ['Código', nota.codasign?.trim()],
    ['Curso', nota.descripcurso?.trim()],
    ['Nota', `${nota.nota?.trim()} (${nota.descripnota?.trim()})`],
    ['Créditos', nota.cantcred ? String(nota.cantcred) : null],
    ['Acta', nota.nroacta?.trim() || null],
    ['Fecha', fechaDe(nota.fecha)],
    ['Escala', nota.codescala?.trim() || null],
    ['Año', String(nota.anho)],
    ['Observación', nota.observacion],
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={e.modalCabecera}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
            Detalle del acta
          </Text>
          <Pressable onPress={onCerrar} hitSlop={12}>
            <Text style={{ color: c.marca, fontSize: 16 }}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}>
          <Tarjeta>
            {campos
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={e.detalleFila}>
                  <Text style={{ color: c.textSecondary, fontSize: 13, flex: 1 }}>{k}</Text>
                  <Text
                    style={{ color: c.text, fontSize: 15, flex: 1.4, textAlign: 'right' }}
                    selectable>
                    {v}
                  </Text>
                </View>
              ))}
          </Tarjeta>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ----------------------------------------------------------------------- firmas

type Firma = {
  asigndescrip: string;
  cursodescrip: string;
  codasign: string;
  duracionfirma: number | null;
  promedio: number | null;
  promedioponderado: number | null;
  anho: number | null;
};

function Firmas({ datos }: { datos: Firma[] | null }) {
  const c = useColores();
  if (!datos?.length) return <Aviso texto={VACIO.Firmas} />;

  return (
    <>
      {datos.map((f, i) => (
        <Tarjeta key={i}>
          <View style={{ gap: 4 }}>
            <Text style={[e.asignatura, { color: c.text }]}>{f.asigndescrip?.trim()}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>
              {[f.cursodescrip?.trim(), f.anho].filter(Boolean).join(' · ')}
            </Text>
            <View style={e.entreFilas}>
              {f.duracionfirma ? (
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                  Duración: {f.duracionfirma} períodos
                </Text>
              ) : (
                <View />
              )}
              {typeof f.promedioponderado === 'number' ? (
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                  {f.promedioponderado.toFixed(2)}
                </Text>
              ) : null}
            </View>
          </View>
        </Tarjeta>
      ))}
    </>
  );
}

// -------------------------------------------------------- extensión universitaria

const SUB_EXT = ['Actividades', 'Por tipo'] as const;
type SubExt = (typeof SUB_EXT)[number];

function ExtensionUniv({ datos }: { datos: Extension | null }) {
  const c = useColores();
  const [sub, setSub] = useState<SubExt>('Actividades');
  const r = datos?.resumenExtension;

  if (!r) return <Aviso texto={VACIO.Extensión} />;

  const completo = r.creds_completo === 'S';

  return (
    <>
      <Tarjeta>
        <View style={e.entreFilas}>
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>Créditos de extensión</Text>
          <Text style={{ color: completo ? c.text : Peligro, fontSize: 15, fontWeight: '700' }}>
            {completo ? 'COMPLETO' : 'PENDIENTE'}
          </Text>
        </View>
        <View style={e.metricas}>
          <Metrica valor={`${r.horasCumplidas}`} de={`${r.horasRequeridas}`} etiqueta="Horas" />
          <Metrica valor={`${r.activcount}`} de={`${r.minactreq}`} etiqueta="Actividades" />
          <Metrica valor={`${r.horasAjustadas}`} etiqueta="Ajustadas" />
        </View>
      </Tarjeta>

      <Segmentos opciones={SUB_EXT} valor={sub} onCambio={setSub} />

      {sub === 'Actividades' ? (
        !r.extensionList?.length ? (
          <Aviso texto="No hay actividades registradas." />
        ) : (
          r.extensionList.map((a, i) => (
            <Tarjeta key={i}>
              <View style={{ gap: 4 }}>
                <Text style={[e.asignatura, { color: c.text }]}>{a.descripcion?.trim()}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                  {[a.tipoEvento?.trim(), a.anho].filter(Boolean).join(' · ')}
                </Text>
                <View style={e.entreFilas}>
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                    {[fechaDe(a.fechaInicio), fechaDe(a.fechaFin)]
                      .filter(Boolean)
                      .filter((v, idx, arr) => arr.indexOf(v) === idx)
                      .join(' – ')}
                  </Text>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                    {a.horasEvento} h
                  </Text>
                </View>
              </View>
            </Tarjeta>
          ))
        )
      ) : (
        <ListaDatos
          datos={datos?.resumenExtensionPorTipoEvento}
          vacio="No hay resumen por tipo de actividad."
        />
      )}
    </>
  );
}

function Metrica({ valor, de, etiqueta }: { valor: string; de?: string; etiqueta: string }) {
  const c = useColores();
  return (
    <View style={{ gap: 1 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>
        {valor}
        {de ? <Text style={{ color: c.textSecondary, fontSize: 14 }}> / {de}</Text> : null}
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{etiqueta}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  entreFilas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promedio: { fontSize: 32, fontWeight: '700' },
  orden: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
  filaNota: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  notaCaja: { width: 34, alignItems: 'center' },
  notaValor: { fontSize: 26, fontWeight: '700' },
  filaTexto: { flex: 1, gap: 2 },
  asignatura: { fontSize: 15, fontWeight: '600' },
  metricas: { flexDirection: 'row', gap: Spacing.five, marginTop: Spacing.two },
  modalCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  detalleFila: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
});
