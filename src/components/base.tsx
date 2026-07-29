/**
 * Piezas visuales compartidas.
 *
 * `ListaDatos` renderiza la respuesta de la API adaptándose a su forma en vez de
 * asumir campos concretos: todavía no conocemos el JSON exacto de cada endpoint,
 * y así ninguna pantalla queda en blanco por un nombre de campo equivocado.
 * A medida que confirmemos los campos reales, cada pantalla puede pasar a un
 * layout hecho a medida sin tocar el resto.
 */
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export function useColores() {
  const esquema = useColorScheme();
  return Colors[esquema === 'dark' ? 'dark' : 'light'];
}

// ------------------------------------------------------------------- contenedor

export function Pantalla({
  children,
  refrescando,
  onRefresh,
}: {
  children: ReactNode;
  refrescando?: boolean;
  onRefresh?: () => void;
}) {
  const c = useColores();
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={estilos.contenido}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refrescando} onRefresh={onRefresh} tintColor={c.textSecondary} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  const c = useColores();
  return <Text style={[estilos.titulo, { color: c.textSecondary }]}>{children}</Text>;
}

export function Tarjeta({ children }: { children: ReactNode }) {
  const c = useColores();
  return <View style={[estilos.tarjeta, { backgroundColor: c.backgroundElement }]}>{children}</View>;
}

// ----------------------------------------------------------------- estados base

export function Cargando() {
  const c = useColores();
  return (
    <View style={estilos.centro}>
      <ActivityIndicator color={c.textSecondary} />
    </View>
  );
}

export function Aviso({ texto }: { texto: string }) {
  const c = useColores();
  return (
    <Tarjeta>
      <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 21 }}>{texto}</Text>
    </Tarjeta>
  );
}

/** Error con acción: sin esto hay que cambiar de pestaña para volver a intentar. */
export function AvisoError({ texto, onReintentar }: { texto: string; onReintentar?: () => void }) {
  const c = useColores();
  return (
    <Tarjeta>
      <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 21 }}>{texto}</Text>
      {onReintentar ? (
        <Pressable
          onPress={onReintentar}
          style={[estilos.reintentar, { backgroundColor: c.backgroundSelected }]}>
          <Text style={{ color: c.marca, fontSize: 15, fontWeight: '600' }}>Reintentar</Text>
        </Pressable>
      ) : null}
    </Tarjeta>
  );
}

// ------------------------------------------------------------------- segmentos

export function Segmentos<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: readonly T[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  const c = useColores();
  return (
    <View style={[estilos.segmentos, { backgroundColor: c.backgroundElement }]}>
      {opciones.map((op) => {
        const activo = op === valor;
        return (
          <Pressable
            key={op}
            onPress={() => onCambio(op)}
            style={[
              estilos.segmento,
              activo && { backgroundColor: c.backgroundSelected },
            ]}>
            <Text
              style={{
                color: activo ? c.text : c.textSecondary,
                fontSize: 13,
                fontWeight: activo ? '600' : '400',
              }}
              numberOfLines={1}>
              {op}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------- formato valores

function humanizar(clave: string) {
  return clave
    .replace(/[_.]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (m) => m.toUpperCase());
}

function formatear(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return String(valor);
  if (typeof valor !== 'string') return null;

  // Fechas ISO -> dd/mm/aaaa
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return valor;
}

const CLAVES_TITULO = [
  'asignatura', 'materia', 'descripcion', 'nombre', 'titulo', 'mensaje', 'detalle', 'concepto',
];

function tituloDe(obj: Record<string, unknown>): string | null {
  for (const clave of CLAVES_TITULO) {
    const hit = Object.keys(obj).find((k) => k.toLowerCase() === clave);
    if (hit && typeof obj[hit] === 'string' && obj[hit]) return obj[hit] as string;
  }
  return null;
}

function esOculta(clave: string) {
  const k = clave.toLowerCase();
  return k === 'id' || k.startsWith('$') || k.endsWith('id') || k === 'orden';
}

// ----------------------------------------------------------------- lista datos

function FilaDato({ clave, valor }: { clave: string; valor: string }) {
  const c = useColores();
  return (
    <View style={estilos.fila}>
      <Text style={[estilos.etiqueta, { color: c.textSecondary }]} numberOfLines={2}>
        {humanizar(clave)}
      </Text>
      <Text style={[estilos.valor, { color: c.text }]} selectable>
        {valor}
      </Text>
    </View>
  );
}

function TarjetaObjeto({ obj }: { obj: Record<string, unknown> }) {
  const c = useColores();
  const titulo = tituloDe(obj);
  const campos = Object.entries(obj)
    .filter(([k, v]) => !esOculta(k) && formatear(v) !== null)
    .filter(([, v]) => v !== titulo);

  return (
    <Tarjeta>
      {titulo ? <Text style={[estilos.tituloTarjeta, { color: c.text }]}>{titulo}</Text> : null}
      {campos.map(([k, v]) => (
        <FilaDato key={k} clave={k} valor={formatear(v)!} />
      ))}
    </Tarjeta>
  );
}

/** Acepta un objeto, un array de objetos, un array de primitivos o un valor suelto. */
export function ListaDatos({ datos, vacio }: { datos: unknown; vacio: string }) {
  const c = useColores();

  if (datos === null || datos === undefined) return <Aviso texto={vacio} />;

  if (Array.isArray(datos)) {
    if (datos.length === 0) return <Aviso texto={vacio} />;
    return (
      <>
        {datos.map((item, i) =>
          item && typeof item === 'object' ? (
            <TarjetaObjeto key={i} obj={item as Record<string, unknown>} />
          ) : (
            <Tarjeta key={i}>
              <Text style={{ color: c.text, fontSize: 15 }}>{formatear(item) ?? '—'}</Text>
            </Tarjeta>
          )
        )}
      </>
    );
  }

  if (typeof datos === 'object') return <TarjetaObjeto obj={datos as Record<string, unknown>} />;

  return <Aviso texto={formatear(datos) ?? vacio} />;
}


const estilos = StyleSheet.create({
  // gap de 12 entre tarjetas: con 8 quedaban visualmente pegadas.
  contenido: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 12 },
  centro: { paddingVertical: Spacing.five, alignItems: 'center' },
  titulo: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    marginLeft: Spacing.one,
  },
  tarjeta: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: Spacing.three, gap: Spacing.two },
  tituloTarjeta: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.half },
  reintentar: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    marginTop: Spacing.one,
  },
  segmentos: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3, marginBottom: Spacing.two },
  segmento: { flex: 1, paddingVertical: Spacing.two, borderRadius: 8, alignItems: 'center' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  etiqueta: { fontSize: 13, flex: 1 },
  valor: { fontSize: 15, flex: 1.2, textAlign: 'right', fontWeight: '500' },
});
