import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso, Cargando, Pantalla, Segmentos, Tarjeta, Titulo, useColores } from '@/components/base';
import { SelectorMalla } from '@/components/selector-malla';
import { ListaDatos } from '@/components/base';
import { Marca, Peligro, Spacing } from '@/constants/theme';
import { obtenerImagen } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { useApi } from '@/lib/useApi';

const VISTAS = ['Cédula', 'Datos', 'Vehicular'] as const;
type Vista = (typeof VISTAS)[number];

type Perfil = Record<string, unknown>;

const CAMPOS: [string, string][] = [
  ['username', 'Cédula'],
  ['email', 'Correo'],
  ['phone', 'Teléfono'],
  ['address', 'Dirección'],
  ['fechanac', 'Fecha de nacimiento'],
  ['nacionalidad', 'Nacionalidad'],
  ['grupoSanguineo', 'Grupo sanguíneo'],
  ['nombreContactoEmergencia', 'Contacto de emergencia'],
  ['numeroContactoEmergencia', 'Teléfono de emergencia'],
];

export default function PerfilScreen() {
  const c = useColores();
  const { info, codcarsec, cerrarSesion } = useSesion();
  const [vista, setVista] = useState<Vista>('Cédula');

  const perfil = useApi<Perfil>(codcarsec ? `perfil?codcarsec=${codcarsec}` : null);
  const vehicular = useApi<unknown>(vista === 'Vehicular' ? 'solicitud-acceso-vehicular' : null);

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', '¿Querés salir? Vas a tener que ingresar tus datos de nuevo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => cerrarSesion() },
    ]);
  }

  return (
    <Pantalla refrescando={perfil.refrescando} onRefresh={perfil.recargar}>
      <SelectorMalla />
      <Segmentos opciones={VISTAS} valor={vista} onCambio={setVista} />

      {vista === 'Cédula' ? (
        <Cedula perfil={perfil.datos} />
      ) : vista === 'Datos' ? (
        perfil.cargando ? (
          <Cargando />
        ) : perfil.error ? (
          <Aviso texto={perfil.error} />
        ) : (
          <Tarjeta>
            {CAMPOS.map(([clave, etiqueta]) => {
              const valor = perfil.datos?.[clave];
              if (valor === null || valor === undefined || valor === '') return null;
              return (
                <View key={clave} style={e.dato}>
                  <Text style={{ color: c.textSecondary, fontSize: 13, flex: 1 }}>{etiqueta}</Text>
                  <Text
                    style={{ color: c.text, fontSize: 15, flex: 1.3, textAlign: 'right' }}
                    selectable>
                    {String(valor).trim()}
                  </Text>
                </View>
              );
            })}
          </Tarjeta>
        )
      ) : vehicular.cargando ? (
        <Cargando />
      ) : (
        <ListaDatos
          datos={vehicular.error ? null : vehicular.datos}
          vacio="No tenés solicitudes de acceso vehicular registradas."
        />
      )}

      <Titulo>Sesión</Titulo>
      <Text style={{ color: c.textSecondary, fontSize: 13, marginBottom: Spacing.two }}>
        {info?.facultad?.nombreCompleto}
      </Text>
      <Pressable onPress={confirmarSalida} style={[e.salir, { backgroundColor: c.backgroundElement }]}>
        <Text style={{ color: Peligro, fontSize: 16, fontWeight: '600' }}>Cerrar sesión</Text>
      </Pressable>
    </Pantalla>
  );
}

// ------------------------------------------------------------ cédula universitaria

/** Las imágenes del backend exigen cookie de sesión: hay que traerlas por fetch. */
function useImagenApi(path: string | null) {
  const [uri, setUri] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!path) return;
    let vigente = true;
    obtenerImagen(path)
      .then((d) => vigente && setUri(d))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [path]);

  return { uri, fallo };
}

function Cedula({ perfil }: { perfil: Perfil | null }) {
  const { info, codcarsec, matriculas } = useSesion();
  const foto = useImagenApi('perfil/foto.png');
  const qr = useImagenApi('perfil/qr.png');

  const alumno = (info?.alumno ?? {}) as Record<string, unknown>;
  const carrera = matriculas.find((m) => (m.codcarsec ?? '').trim() === codcarsec)?.carrera;

  const campos: [string, string][] = [
    ['NOMBRES', String(alumno.nombre ?? '')],
    ['APELLIDOS', String(alumno.apellido ?? '')],
    ['NRO. DE CÉDULA', String(alumno.cedula ?? perfil?.username ?? '').trim()],
    ['FECHA DE NACIMIENTO', String(alumno.fechanac ?? '')],
    ['NACIONALIDAD', String(alumno.nacionalidad ?? '')],
    ['SEXO', alumno.sexo === 'M' ? 'MASCULINO' : alumno.sexo === 'F' ? 'FEMENINO' : ''],
    ['FACULTAD', String(info?.facultad?.nombreCompleto ?? '')],
    ['CARRERA', String(carrera ?? '').trim()],
    ['GRUPO SANGUÍNEO', String(alumno.grupoSanguineo ?? '')],
  ];

  return (
    <View style={e.cedula}>
      <Text style={e.cedulaUni}>UNIVERSIDAD NACIONAL DE ASUNCIÓN</Text>
      <Text style={e.cedulaTitulo}>CÉDULA UNIVERSITARIA</Text>

      <View style={e.fotoAro}>
        {foto.uri ? (
          <Image source={{ uri: foto.uri }} style={e.foto} />
        ) : foto.fallo ? (
          <Text style={{ color: '#ffffff88', fontSize: 11 }}>sin foto</Text>
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>

      <Text style={e.estudiante}>ESTUDIANTE</Text>

      <View style={e.campos}>
        {campos
          .filter(([, v]) => v)
          .map(([etiqueta, valor]) => (
            <View key={etiqueta} style={e.campo}>
              <Text style={e.campoEtiqueta}>{etiqueta}</Text>
              <Text style={e.campoValor}>{valor}</Text>
            </View>
          ))}
      </View>

      <View style={e.qrCaja}>
        {qr.uri ? (
          <Image source={{ uri: qr.uri }} style={e.qr} resizeMode="contain" />
        ) : qr.fallo ? (
          <Text style={{ color: '#00000088', fontSize: 12 }}>No se pudo cargar el QR</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  dato: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  salir: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  cedula: {
    backgroundColor: Marca,
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  cedulaUni: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cedulaTitulo: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: Spacing.two },
  fotoAro: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff22',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  foto: { width: 120, height: 120 },
  estudiante: { color: '#fff', fontSize: 22, fontWeight: '800', marginVertical: Spacing.two },
  campos: { alignSelf: 'stretch', gap: Spacing.two },
  campo: { gap: 1 },
  campoEtiqueta: { color: '#ffffffcc', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  campoValor: { color: '#fff', fontSize: 14 },
  qrCaja: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: Spacing.two,
    marginTop: Spacing.three,
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qr: { width: 150, height: 150 },
});
