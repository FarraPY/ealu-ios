/**
 * "Más info" de una materia. La web tiene dos versiones y acá se unifican:
 *
 * - Desde Calificaciones/Finales usa `infoexafinal` (4 parámetros) y devuelve
 *   PORCENTAJES ya calculados por nota. La web lo dibuja como torta.
 * - Desde Inscripciones/Preinscripciones usa `infoasignatura` (7 parámetros) y
 *   devuelve CANTIDADES por nota y por profesor. La web lo dibuja como barras.
 *
 * Las dos se muestran con barras horizontales: en pantalla chica una torta con
 * cinco porciones es ilegible, y las barras permiten comparar profesores.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso, Cargando, Tarjeta, Titulo, useColores } from '@/components/base';
import { Spacing } from '@/constants/theme';
import { Inscripcion, NotaFinal } from '@/lib/api';
import { useApi } from '@/lib/useApi';

export type OrigenInfo =
  | { tipo: 'inscripcion'; materia: Inscripcion }
  | { tipo: 'nota'; nota: NotaFinal };

/** Color por nota: rojo el aplazo, verde el 5, como en la web. */
const COLOR_NOTA: Record<string, string> = {
  '1': '#e5484d',
  '2': '#f76b15',
  '3': '#ffc53d',
  '4': '#3e63dd',
  '5': '#46a758',
};

type Serie = { nombre: string | null; notas: string[]; porcentajes: number[]; total: number | null };

type RespuestaInfo = {
  // infoasignatura
  chartData?: { data: number[][]; notas: string[]; labels: string[] } | null;
  // infoexafinal
  data?: number[];
  labels?: string[];
  infoasig?: Record<string, unknown> | null;
};

function rutaDe(origen: OrigenInfo, codcarsec: string): string {
  if (origen.tipo === 'nota') {
    const n = origen.nota;
    return (
      `infoexafinal?codcarsec=${encodeURIComponent(codcarsec)}` +
      `&codasign=${encodeURIComponent((n.codasign ?? '').trim())}` +
      `&anho=${n.anho ?? ''}` +
      `&codnota=${n.valornota ?? ''}`
    );
  }
  const m = origen.materia;
  return (
    `infoasignatura?codcarsec=${encodeURIComponent(codcarsec)}` +
    `&codcurso=${m.codcurso ?? ''}` +
    `&codasign=${encodeURIComponent((m.codasign ?? '').trim())}` +
    `&anho=${m.anho ?? ''}` +
    `&convocatoria=${m.convocatoria ?? ''}` +
    `&turno=${encodeURIComponent((m.turno ?? '').trim())}` +
    `&seccion=${encodeURIComponent((m.seccion ?? '').trim())}`
  );
}

/** Normaliza las dos formas de respuesta a una lista de series comparables. */
function seriesDe(r: RespuestaInfo | null): Serie[] {
  if (!r) return [];

  // infoexafinal: porcentajes planos, una sola serie sin profesor.
  if (Array.isArray(r.data) && Array.isArray(r.labels) && typeof r.data[0] === 'number') {
    return [
      {
        nombre: null,
        notas: r.labels.map((s) => String(s).trim()),
        porcentajes: r.data as number[],
        total: null,
      },
    ];
  }

  // infoasignatura: cantidades por nota (filas) y por profesor (columnas).
  const chart = r.chartData;
  if (!chart?.notas?.length) return [];
  const notas = chart.notas.map((s) => String(s).trim());
  return (chart.labels ?? []).map((nombre, j) => {
    const cant = notas.map((_, i) => chart.data?.[i]?.[j] ?? 0);
    const total = cant.reduce((s, v) => s + v, 0);
    return {
      nombre: String(nombre ?? '').trim() || 'Sin profesor',
      notas,
      porcentajes: cant.map((v) => (total ? (v / total) * 100 : 0)),
      total,
    };
  });
}

function promedioDe(notas: string[], porcentajes: number[]): number {
  let suma = 0;
  let peso = 0;
  notas.forEach((etiqueta, i) => {
    const valor = Number(etiqueta);
    if (!Number.isFinite(valor)) return;
    suma += valor * porcentajes[i];
    peso += porcentajes[i];
  });
  return peso ? suma / peso : 0;
}

/**
 * Solo el contenido, sin modal. Se usa embebido dentro del detalle del acta:
 * encadenar dos modales en iOS hace que el segundo aparezca y se oculte solo.
 */
export function ContenidoDistribucion({
  origen,
  codcarsec,
  conEncabezado = false,
}: {
  origen: OrigenInfo | null;
  codcarsec: string;
  conEncabezado?: boolean;
}) {
  const c = useColores();
  const consulta = useApi<RespuestaInfo>(origen ? rutaDe(origen, codcarsec) : null);

  const series = seriesDe(consulta.datos);
  const info = (consulta.datos?.infoasig ?? {}) as Record<string, unknown>;
  const titulo =
    origen?.tipo === 'nota'
      ? origen.nota.descripasign?.trim()
      : origen?.materia.asignatura?.trim();

  const subtitulo = [
    info.anho,
    (info.turnodescrip as string)?.trim() || (info.turno as string)?.trim(),
    (info.seccion as string)?.trim() ? `Sección ${String(info.seccion).trim()}` : null,
    info.convocatoria ? `Convocatoria ${info.convocatoria}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ gap: Spacing.two }}>
      {conEncabezado ? (
        <>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{titulo}</Text>
          {subtitulo ? (
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>{subtitulo}</Text>
          ) : null}
        </>
      ) : null}

      {consulta.cargando ? (
        <Cargando />
      ) : consulta.error ? (
        <Aviso texto={consulta.error} />
      ) : !series.length ? (
        <Aviso texto="No hay datos de distribución para esta materia." />
      ) : (
        <>
          <Titulo>
            {series.length > 1 ? 'Cómo califica cada profesor' : 'Cómo le fue al curso'}
          </Titulo>

          {series.map((s, idx) => (
            <Tarjeta key={s.nombre ?? idx}>
              {s.nombre ? (
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{s.nombre}</Text>
              ) : null}
              <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: Spacing.one }}>
                {[
                  s.total !== null ? `${s.total} notas` : null,
                  `promedio ${promedioDe(s.notas, s.porcentajes).toFixed(2)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              {s.notas.map((nota, i) => {
                const pct = s.porcentajes[i] ?? 0;
                return (
                  <View key={nota} style={{ gap: 3 }}>
                    <View style={e.entre}>
                      <Text style={{ color: c.text, fontSize: 13 }}>Nota {nota}</Text>
                      <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                        {pct.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={[e.riel, { backgroundColor: c.backgroundSelected }]}>
                      <View
                        style={[
                          e.barra,
                          {
                            width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                            backgroundColor: COLOR_NOTA[nota] ?? c.marca,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </Tarjeta>
          ))}
        </>
      )}
    </View>
  );
}

/** Versión en modal, para abrir desde la lista de materias inscriptas. */
export function DistribucionNotas({
  origen,
  codcarsec,
  onCerrar,
}: {
  origen: OrigenInfo | null;
  codcarsec: string;
  onCerrar: () => void;
}) {
  const c = useColores();
  return (
    <Modal
      visible={!!origen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
      onDismiss={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={e.cabecera}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
            Distribución de notas
          </Text>
          <Pressable onPress={onCerrar} hitSlop={12}>
            <Text style={{ color: c.marca, fontSize: 16 }}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.three }}>
          <ContenidoDistribucion origen={origen} codcarsec={codcarsec} conEncabezado />
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: Spacing.three },
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riel: { height: 10, borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10, borderRadius: 5 },
});
