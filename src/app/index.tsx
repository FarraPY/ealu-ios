import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso, AvisoError, Cargando, Pantalla, Tarjeta, Titulo, useColores } from '@/components/base';
import { SelectorMalla } from '@/components/selector-malla';
import { Peligro, Spacing } from '@/constants/theme';
import { NotasFinales, UltimaNota } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { useApi } from '@/lib/useApi';

export default function Inicio() {
  const c = useColores();
  const { info, codcarsec } = useSesion();

  const ultimas = useApi<UltimaNota[]>(codcarsec ? `ultimas-notas/${codcarsec}` : null);
  const finales = useApi<NotasFinales>(codcarsec ? `notas_finales/${codcarsec}` : null);
  const deuda = useApi<boolean>('deudas/tiene-deuda');

  const user = info?.user as Record<string, unknown> | undefined;
  const nombre = (user?.nameAndSurname as string) ?? '';
  const carrera = (info?.matriculaList?.find((m) => m.codcarsec?.trim() === codcarsec)
    ?.carrera as string) ?? '';

  const recargar = () => {
    ultimas.recargar();
    finales.recargar();
    deuda.recargar();
  };

  /**
   * Materias efectivamente aprobadas.
   *
   * `notas` trae un acta por rendición, no una por materia: incluye los aplazos
   * (nota 1 en la escala 1A5), repite la materia cuando se rindió más de una vez,
   * y suma un registro de Extensión Universitaria que no es una asignatura sino
   * un requisito de egreso. Contar el largo del arreglo infla el número.
   */
  const aprobadas = useMemo(() => {
    const notas = finales.datos?.notas ?? [];
    const distintas = new Set(
      notas
        .filter((n) => n.codescala?.trim().toUpperCase() !== 'EXT')
        .filter((n) => n.valornota >= 2)
        .map((n) => n.codasign?.trim())
        .filter(Boolean)
    );
    return distintas.size;
  }, [finales.datos]);

  return (
    <Pantalla refrescando={ultimas.refrescando} onRefresh={recargar}>
      <Text style={[e.nombre, { color: c.text }]}>{nombre}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, marginBottom: Spacing.two }}>
        {info?.facultad?.nombre}
        {carrera ? ` · ${carrera.trim()}` : ''}
      </Text>

      <SelectorMalla />

      <View style={e.fila}>
        <Metrica
          valor={finales.datos ? finales.datos.promedio.toFixed(2) : '—'}
          etiqueta="Promedio"
        />
        <Metrica
          valor={finales.datos ? String(aprobadas) : '—'}
          etiqueta="Materias aprobadas"
        />
      </View>

      {deuda.datos === true ? <Aviso texto="Tenés deudas pendientes. Mirá la pestaña Cuenta." /> : null}

      <Titulo>Últimas notas · 30 días</Titulo>
      {ultimas.cargando ? (
        <Cargando />
      ) : ultimas.error ? (
        <AvisoError texto={ultimas.error} onReintentar={ultimas.recargar} />
      ) : !ultimas.datos?.length ? (
        <Aviso texto="No hay notas cargadas en los últimos 30 días. Las notas aparecen cuando la cátedra las sube al sistema." />
      ) : (
        <>
          {ultimas.datos.map((n, i) => (
            <FilaUltimaNota key={i} nota={n} />
          ))}
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: Spacing.one }}>
            Si rendiste hace poco y no figura, todavía no la cargaron. Deslizá para actualizar.
          </Text>
        </>
      )}
    </Pantalla>
  );
}

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const c = useColores();
  return (
    <View style={[e.metrica, { backgroundColor: c.backgroundElement }]}>
      <Text style={[e.metricaValor, { color: c.text }]}>{valor}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{etiqueta}</Text>
    </View>
  );
}

function FilaUltimaNota({ nota }: { nota: UltimaNota }) {
  const c = useColores();
  // La escala es 1 a 5; el 1 es aplazo.
  const aplazado = nota.ausente || nota.nota === 1;
  return (
    <Tarjeta>
      <View style={e.filaNota}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[e.asignatura, { color: c.text }]}>{nota.asignatura?.trim()}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            {nota.tipoexamen?.trim()} · {nota.fechaexamen}
          </Text>
        </View>
        <Text style={[e.notaValor, { color: aplazado ? Peligro : c.text }]}>
          {nota.ausente ? 'AUS' : (nota.nota ?? '—')}
        </Text>
      </View>
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  nombre: { fontSize: 26, fontWeight: '700' },
  fila: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  metrica: { flex: 1, borderRadius: 14, padding: Spacing.three, gap: 2 },
  metricaValor: { fontSize: 28, fontWeight: '700' },
  filaNota: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  asignatura: { fontSize: 15, fontWeight: '600' },
  notaValor: { fontSize: 26, fontWeight: '700', minWidth: 46, textAlign: 'right' },
});
