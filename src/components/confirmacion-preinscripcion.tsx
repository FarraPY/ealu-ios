/**
 * Vista de "Ver confirmación" de la preinscripción.
 *
 * Replica `#/inscasig/confirmacion`: datos del alumno y la lista de materias
 * seleccionadas con semestre, curso, turno, sección y firma. Sirve para revisar
 * qué se va a enviar antes de cerrar, que es irreversible.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso, Cargando, Tarjeta, Titulo, useColores } from '@/components/base';
import { CabeceraModalInset, Spacing } from '@/constants/theme';
import { useSesion } from '@/lib/sesion';
import { useApi } from '@/lib/useApi';

type MateriaConfirmada = {
  asignatura: string;
  codasign: string;
  curso: string | null;
  codcurso: number | null;
  semestre: number | null;
  turno: string | null;
  seccion: string | null;
  doc_firma: string | null;
};

type Respuesta = { data?: MateriaConfirmada[]; success?: boolean; errorMessage?: string | null };

export function ConfirmacionPreinscripcion({
  visible,
  codcarsec,
  onCerrar,
}: {
  visible: boolean;
  codcarsec: string;
  onCerrar: () => void;
}) {
  const c = useColores();
  const { info, matriculas } = useSesion();
  const consulta = useApi<Respuesta>(visible ? `confirmacion-preinscripcion/${codcarsec}` : null);

  const materias = consulta.datos?.data ?? [];
  const alumno = (info?.alumno ?? {}) as Record<string, unknown>;
  const carrera = String(
    matriculas.find((m) => (m.codcarsec ?? '').trim() === codcarsec)?.carrera ?? ''
  ).trim();

  const datos: [string, string][] = [
    ['Cédula', String(alumno.cedula ?? '').trim()],
    ['Nombres y apellidos', String((info?.user as Record<string, unknown>)?.nameAndSurname ?? '')],
    ['Carrera', carrera],
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
      onDismiss={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={e.cabecera}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
            Confirmación
          </Text>
          <Pressable onPress={onCerrar} hitSlop={12}>
            <Text style={{ color: c.marca, fontSize: 16 }}>Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
            {info?.facultad?.nombre}
          </Text>

          <Tarjeta>
            {datos
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={e.dato}>
                  <Text style={{ color: c.textSecondary, fontSize: 13, flex: 1 }}>{k}</Text>
                  <Text
                    style={{ color: c.text, fontSize: 14, flex: 1.5, textAlign: 'right' }}
                    selectable>
                    {v}
                  </Text>
                </View>
              ))}
          </Tarjeta>

          <Titulo>Asignaturas seleccionadas</Titulo>

          {consulta.cargando ? (
            <Cargando />
          ) : consulta.error ? (
            <Aviso texto={consulta.error} />
          ) : !materias.length ? (
            <Aviso texto="No hay asignaturas seleccionadas para confirmar." />
          ) : (
            <>
              {materias.map((m, i) => (
                <Tarjeta key={`${m.codasign}-${i}`}>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                    {m.asignatura?.trim()}
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                    {[
                      m.curso?.trim() || (m.codcurso ? `Curso ${m.codcurso}` : null),
                      m.semestre ? `Semestre ${m.semestre}` : null,
                      m.turno && m.seccion
                        ? `${m.turno.trim()}/${m.seccion.trim()}`
                        : null,
                      m.doc_firma?.trim() ? `Firma ${m.doc_firma.trim()}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Tarjeta>
              ))}
              <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: Spacing.one }}>
                {materias.length} asignatura(s). Revisá que estén todas antes de cerrar la
                preinscripción.
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    paddingTop: Spacing.three + CabeceraModalInset,
    gap: Spacing.three,
  },
  dato: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
});
