/**
 * Distribución de notas de una materia — equivale a "más info" en la web.
 *
 * Necesita turno, sección y convocatoria, que solo vienen en las inscripciones
 * (no en `notas_finales`), así que se abre desde la pestaña Inscripción.
 * Se dibuja con barras en vez de la torta de la web: en pantalla chica los
 * porcentajes de una torta son ilegibles y las barras se comparan mejor.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso, Cargando, Tarjeta, Titulo, useColores } from '@/components/base';
import { Spacing } from '@/constants/theme';
import { InfoAsignatura, Inscripcion } from '@/lib/api';
import { useApi } from '@/lib/useApi';

/** Color por nota: rojo para el aplazo, verde para el 5, como en la web. */
const COLOR_NOTA: Record<string, string> = {
  '1': '#e5484d',
  '2': '#f76b15',
  '3': '#ffc53d',
  '4': '#3e63dd',
  '5': '#46a758',
};

export function DistribucionNotas({
  materia,
  codcarsec,
  onCerrar,
}: {
  materia: Inscripcion | null;
  codcarsec: string;
  onCerrar: () => void;
}) {
  const c = useColores();

  const ruta = materia
    ? `infoasignatura?codcarsec=${encodeURIComponent(codcarsec)}` +
      `&codcurso=${materia.codcurso ?? ''}` +
      `&codasign=${encodeURIComponent((materia.codasign ?? '').trim())}` +
      `&anho=${materia.anho ?? ''}` +
      `&convocatoria=${materia.convocatoria ?? ''}` +
      `&turno=${encodeURIComponent((materia.turno ?? '').trim())}` +
      `&seccion=${encodeURIComponent((materia.seccion ?? '').trim())}`
    : null;

  const consulta = useApi<InfoAsignatura>(ruta);
  const chart = consulta.datos?.chartData;
  const info = consulta.datos?.infoasig;

  // `data` trae un arreglo de cantidades por profesor; se suman todos.
  const totalPorNota = (chart?.notas ?? []).map((_, i) =>
    (chart?.data?.[i] ?? []).reduce((s, v) => s + (v ?? 0), 0)
  );
  const total = totalPorNota.reduce((s, v) => s + v, 0);

  return (
    <Modal
      visible={!!materia}
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

        <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
            {materia?.asignatura?.trim()}
          </Text>
          {info ? (
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>
              {[
                info.anho,
                info.turnodescrip?.trim() || info.turno?.trim(),
                info.seccion?.trim() ? `Sección ${info.seccion.trim()}` : null,
                info.convocatoria ? `Convocatoria ${info.convocatoria}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}

          {consulta.cargando ? (
            <Cargando />
          ) : consulta.error ? (
            <Aviso texto={consulta.error} />
          ) : !total ? (
            <Aviso texto="No hay notas registradas para esta materia en ese período." />
          ) : (
            <>
              {chart?.labels?.length ? (
                <>
                  <Titulo>{chart.labels.length > 1 ? 'Profesores' : 'Profesor'}</Titulo>
                  <Tarjeta>
                    {chart.labels.map((p) => (
                      <Text key={p} style={{ color: c.text, fontSize: 15 }}>
                        {p?.trim()}
                      </Text>
                    ))}
                  </Tarjeta>
                </>
              ) : null}

              <Titulo>Cómo le fue al curso</Titulo>
              <Tarjeta>
                {(chart?.notas ?? []).map((nota, i) => {
                  const cant = totalPorNota[i];
                  const pct = (cant / total) * 100;
                  const clave = nota?.trim() ?? '';
                  return (
                    <View key={clave} style={{ gap: 4 }}>
                      <View style={e.entre}>
                        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>
                          Nota {clave}
                        </Text>
                        <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                          {cant} · {pct.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={[e.riel, { backgroundColor: c.backgroundSelected }]}>
                        <View
                          style={[
                            e.barra,
                            {
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: COLOR_NOTA[clave] ?? c.marca,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
                <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: Spacing.one }}>
                  {total} notas registradas
                </Text>
              </Tarjeta>
            </>
          )}
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
