/**
 * Selector de malla curricular.
 *
 * El alumno puede tener varias matrículas cuando la facultad cambia el plan de
 * estudios a mitad de carrera: la malla vieja guarda el historial anterior y la
 * nueva los datos actuales. Notas, materias y promedio cambian según cuál esté
 * activa, así que esto va visible en cada pantalla que dependa de ella —igual
 * que el desplegable del encabezado en la web—, no escondido en ajustes.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColores } from '@/components/base';
import { Spacing } from '@/constants/theme';
import { useSesion } from '@/lib/sesion';

export function SelectorMalla() {
  const c = useColores();
  const { matriculas, codcarsec, elegirMatricula } = useSesion();
  const [abierto, setAbierto] = useState(false);

  // Con una sola matrícula no hay nada que elegir.
  if (matriculas.length < 2) return null;

  const actual = matriculas.find((m) => (m.codcarsec ?? '').trim() === codcarsec);

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        style={[e.barra, { backgroundColor: c.backgroundElement }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textSecondary, fontSize: 11 }}>MALLA CURRICULAR</Text>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
            {String(actual?.carrera ?? codcarsec).trim()}
          </Text>
        </View>
        <Text style={{ color: c.marca, fontSize: 13, fontWeight: '600' }}>Cambiar</Text>
      </Pressable>

      <Modal
        visible={abierto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierto(false)}
        onDismiss={() => setAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <View style={e.cabecera}>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>Malla curricular</Text>
            <Pressable onPress={() => setAbierto(false)} hitSlop={12}>
              <Text style={{ color: c.textSecondary, fontSize: 16 }}>Cerrar</Text>
            </Pressable>
          </View>

          <Text style={[e.ayuda, { color: c.textSecondary }]}>
            Elegí la malla para ver los datos que le corresponden. La anterior guarda tu
            historial previo al cambio de plan.
          </Text>

          <View style={{ padding: Spacing.three, gap: Spacing.two }}>
            {matriculas.map((m) => {
              const cod = (m.codcarsec ?? '').trim();
              const activa = cod === codcarsec;
              return (
                <Pressable
                  key={cod}
                  onPress={() => {
                    elegirMatricula(cod);
                    setAbierto(false);
                  }}
                  style={[
                    e.opcion,
                    { backgroundColor: c.backgroundElement },
                    activa && { borderColor: c.marca, borderWidth: 2 },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                      {String(m.carrera ?? '').trim() || cod}
                    </Text>
                    <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                      {cod}
                      {m.anhoingreso ? ` · Ingreso ${m.anhoingreso}` : ''}
                    </Text>
                  </View>
                  {activa ? (
                    <Text style={{ color: c.marca, fontSize: 18, fontWeight: '700' }}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const e = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  ayuda: { fontSize: 13, lineHeight: 18, paddingHorizontal: Spacing.three },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
