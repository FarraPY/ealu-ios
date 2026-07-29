import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { NotaFinal, NotasFinales } from '@/lib/api';
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

/** Aviso propio cuando la sección existe pero la facultad no carga los datos. */
const VACIO: Record<Vista, string> = {
  Finales: 'No hay calificaciones finales registradas para esta malla.',
  Firmas: 'No hay firmas registradas en este período.',
  Parciales:
    'No hay parciales cargados. La sección existe, pero los puntajes dependen de que la facultad los suba al sistema.',
  Extensión: 'No hay actividades de extensión universitaria registradas.',
  Libres: 'No hay actas libres registradas.',
};

export default function Notas() {
  const c = useColores();
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

  const porCurso = useMemo(() => {
    const mapa = new Map<string, NotaFinal[]>();
    for (const n of notas) {
      const clave = n.descripcurso?.trim() || 'Sin curso';
      mapa.set(clave, [...(mapa.get(clave) ?? []), n]);
    }
    return [...mapa.entries()];
  }, [notas]);

  if (!notas.length) return <Aviso texto={VACIO.Finales} />;

  return (
    <>
      <Tarjeta>
        <View style={e.entreFilas}>
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>Promedio general</Text>
          <Text style={[e.promedio, { color: c.text }]}>{(datos?.promedio ?? 0).toFixed(2)}</Text>
        </View>
      </Tarjeta>

      {porCurso.map(([curso, lista]) => (
        <View key={curso}>
          <Titulo>{curso}</Titulo>
          {lista.map((n, i) => (
            <FilaNota key={`${n.codasign}-${i}`} nota={n} />
          ))}
        </View>
      ))}
    </>
  );
}

function FilaNota({ nota }: { nota: NotaFinal }) {
  const c = useColores();
  const aplazado = nota.valornota === 1;
  return (
    <Tarjeta>
      <View style={e.fila}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[e.asignatura, { color: c.text }]}>{nota.descripasign?.trim()}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            {[nota.codasign?.trim(), nota.cantcred ? `${nota.cantcred} créditos` : null, nota.anho]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[e.nota, { color: aplazado ? Peligro : c.text }]}>{nota.nota?.trim()}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 11 }}>{nota.descripnota?.trim()}</Text>
        </View>
      </View>
    </Tarjeta>
  );
}

// ----------------------------------------------------------------------- firmas

type Firma = {
  asigndescrip: string;
  cursodescrip: string;
  codasign: string;
  derecho: unknown;
  derecho_actual: unknown;
  periodoinicial: number | null;
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

const e = StyleSheet.create({
  entreFilas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promedio: { fontSize: 30, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  asignatura: { fontSize: 15, fontWeight: '600' },
  nota: { fontSize: 24, fontWeight: '700' },
});
