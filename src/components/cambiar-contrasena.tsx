import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColores } from '@/components/base';
import { CabeceraModalInset, Peligro, Spacing } from '@/constants/theme';
import { cambiarContrasena } from '@/lib/api';

export function CambiarContrasena({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  const c = useColores();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const coinciden = nueva !== '' && nueva === confirmar;
  const puede = actual !== '' && coinciden && !enviando;

  function limpiar() {
    setActual('');
    setNueva('');
    setConfirmar('');
    setError(null);
    setOk(false);
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await cambiarContrasena(actual, nueva, confirmar);
      setOk(true);
      setActual('');
      setNueva('');
      setConfirmar('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        limpiar();
        onCerrar();
      }}
      onDismiss={() => {
        limpiar();
        onCerrar();
      }}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={e.cabecera}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
              Cambiar contraseña
            </Text>
            <Pressable
              onPress={() => {
                limpiar();
                onCerrar();
              }}
              hitSlop={12}>
              <Text style={{ color: c.marca, fontSize: 16 }}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
            keyboardShouldPersistTaps="handled">
            {ok ? (
              <View style={[e.aviso, { backgroundColor: c.backgroundElement }]}>
                <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>
                  Contraseña cambiada. La app ya guardó la nueva, así que no vas a tener que
                  volver a iniciar sesión.
                </Text>
              </View>
            ) : null}

            <Campo etiqueta="Contraseña actual" valor={actual} onCambio={setActual} />
            <Campo etiqueta="Contraseña nueva" valor={nueva} onCambio={setNueva} />
            <Campo etiqueta="Repetir la nueva" valor={confirmar} onCambio={setConfirmar} />

            {confirmar !== '' && !coinciden ? (
              <Text style={{ color: Peligro, fontSize: 13 }}>Las contraseñas no coinciden.</Text>
            ) : null}
            {error ? <Text style={{ color: Peligro, fontSize: 14, lineHeight: 20 }}>{error}</Text> : null}

            <Pressable
              onPress={enviar}
              disabled={!puede}
              style={[e.boton, { backgroundColor: c.marca, opacity: puede ? 1 : 0.35 }]}>
              {enviando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={e.botonTexto}>Cambiar contraseña</Text>
              )}
            </Pressable>

            <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>
              La contraseña viaja solo a api.una.py y se guarda cifrada en el Keychain del
              iPhone.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Campo({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
}) {
  const c = useColores();
  return (
    <View style={{ gap: Spacing.one, marginTop: Spacing.two }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambio}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={[e.input, { backgroundColor: c.backgroundElement, color: c.text }]}
      />
    </View>
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
  aviso: { borderRadius: 12, padding: Spacing.three },
  input: { borderRadius: 12, paddingHorizontal: Spacing.three, height: 48, fontSize: 16 },
  boton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
