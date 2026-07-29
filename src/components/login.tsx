import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Spacing } from '@/constants/theme';
import { Facultad, obtenerFacultades } from '@/lib/api';
import { useSesion } from '@/lib/sesion';

export default function Login() {
  const c = useColores();
  const { iniciarSesion } = useSesion();

  const [facultades, setFacultades] = useState<Facultad[] | null>(null);
  const [facultad, setFacultad] = useState<Facultad | null>(null);
  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => {
    obtenerFacultades()
      .then(setFacultades)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar facultades.'));
  }, []);

  const puedeEntrar = !!facultad && cedula.trim() !== '' && contrasena !== '' && !entrando;

  async function entrar() {
    if (!facultad) return;
    setEntrando(true);
    setError(null);
    try {
      await iniciarSesion({
        username: cedula.trim(),
        password: contrasena,
        codfacul: facultad.codigo,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
      setEntrando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={est.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[est.marca, { color: c.text }]}>EALU</Text>
          <Text style={[est.sub, { color: c.textSecondary }]}>
            Universidad Nacional de Asunción
          </Text>

          <Campo etiqueta="Facultad">
            <Pressable
              onPress={() => facultades && setEligiendo(true)}
              style={[est.input, { backgroundColor: c.backgroundElement }]}>
              {facultades === null && !error ? (
                <ActivityIndicator color={c.textSecondary} />
              ) : (
                <Text
                  style={{ color: facultad ? c.text : c.textSecondary, fontSize: 16 }}
                  numberOfLines={1}>
                  {facultad ? facultad.nombre : 'Elegí tu facultad'}
                </Text>
              )}
            </Pressable>
          </Campo>

          <Campo etiqueta="Cédula">
            <TextInput
              value={cedula}
              onChangeText={setCedula}
              keyboardType="number-pad"
              autoComplete="username"
              placeholder="Sin puntos"
              placeholderTextColor={c.textSecondary}
              style={[est.input, { backgroundColor: c.backgroundElement, color: c.text }]}
            />
          </Campo>

          <Campo etiqueta="Contraseña">
            <TextInput
              value={contrasena}
              onChangeText={setContrasena}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              onSubmitEditing={() => puedeEntrar && entrar()}
              returnKeyType="go"
              style={[est.input, { backgroundColor: c.backgroundElement, color: c.text }]}
            />
          </Campo>

          {error ? <Text style={est.error}>{error}</Text> : null}

          <Pressable
            onPress={entrar}
            disabled={!puedeEntrar}
            style={[est.boton, { backgroundColor: c.text, opacity: puedeEntrar ? 1 : 0.35 }]}>
            {entrando ? (
              <ActivityIndicator color={c.background} />
            ) : (
              <Text style={[est.botonTexto, { color: c.background }]}>Ingresar</Text>
            )}
          </Pressable>

          <Text style={[est.pie, { color: c.textSecondary }]}>
            Tus datos se guardan cifrados en el Keychain del iPhone y solo se envían a
            api.una.py.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectorFacultad
        visible={eligiendo}
        facultades={facultades ?? []}
        onElegir={(f) => {
          setFacultad(f);
          setEligiendo(false);
        }}
        onCerrar={() => setEligiendo(false)}
      />
    </SafeAreaView>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  const c = useColores();
  return (
    <View style={{ gap: Spacing.one, marginTop: Spacing.three }}>
      <Text style={[est.etiqueta, { color: c.textSecondary }]}>{etiqueta}</Text>
      {children}
    </View>
  );
}

function SelectorFacultad({
  visible,
  facultades,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  facultades: Facultad[];
  onElegir: (f: Facultad) => void;
  onCerrar: () => void;
}) {
  const c = useColores();
  const [busqueda, setBusqueda] = useState('');

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return facultades;
    return facultades.filter((f) => f.nombre.toLowerCase().includes(q));
  }, [busqueda, facultades]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={est.modalCabecera}>
          <Text style={[est.modalTitulo, { color: c.text }]}>Facultad</Text>
          <Pressable onPress={onCerrar} hitSlop={12}>
            <Text style={{ color: c.textSecondary, fontSize: 16 }}>Cerrar</Text>
          </Pressable>
        </View>

        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar"
          placeholderTextColor={c.textSecondary}
          autoCorrect={false}
          style={[
            est.input,
            { backgroundColor: c.backgroundElement, color: c.text, marginHorizontal: Spacing.three },
          ]}
        />

        <FlatList
          data={filtradas}
          keyExtractor={(f) => String(f.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Spacing.three, gap: Spacing.one }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onElegir(item)}
              style={[est.opcion, { backgroundColor: c.backgroundElement }]}>
              <Text style={{ color: c.text, fontSize: 15 }}>{item.nombre}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                {item.codigo}
              </Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const est = StyleSheet.create({
  scroll: { padding: Spacing.four, paddingTop: Spacing.six, gap: Spacing.one },
  marca: { fontSize: 40, fontWeight: '800', letterSpacing: 2 },
  sub: { fontSize: 15, marginTop: Spacing.half, marginBottom: Spacing.four },
  etiqueta: { fontSize: 13, fontWeight: '600', marginLeft: Spacing.one },
  input: { borderRadius: 12, paddingHorizontal: Spacing.three, height: 50, fontSize: 16, justifyContent: 'center' },
  error: { color: '#e5484d', fontSize: 14, marginTop: Spacing.three, lineHeight: 20 },
  boton: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.four },
  botonTexto: { fontSize: 16, fontWeight: '700' },
  pie: { fontSize: 12, lineHeight: 17, marginTop: Spacing.four, textAlign: 'center' },
  modalCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  modalTitulo: { fontSize: 22, fontWeight: '700' },
  opcion: { padding: Spacing.three, borderRadius: 12 },
});
