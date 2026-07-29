import { useState } from 'react';
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
import { Peligro, Spacing } from '@/constants/theme';
import { Deuda } from '@/lib/api';
import { useApi } from '@/lib/useApi';

const VISTAS = ['Deudas', 'Arancel Cero', 'Fraccionar'] as const;
type Vista = (typeof VISTAS)[number];

export default function Cuenta() {
  const c = useColores();
  const [vista, setVista] = useState<Vista>('Deudas');

  const deudas = useApi<Deuda[]>('deudas/pendientes');
  // OJO: no usar `solicitud-gratuidad`. Ese endpoint devuelve las solicitudes de
  // TODOS los alumnos (con cédula, teléfono, dirección y correo), no las propias.
  // El listado del alumno es `arancel0/datatable`, igual que en la web.
  const otros = useApi<{ aaData?: unknown[] }>(
    vista === 'Arancel Cero'
      ? 'arancel0/datatable'
      : vista === 'Fraccionar'
        ? 'deudas/fraccionamiento-info'
        : null
  );

  const total = (deudas.datos ?? []).reduce((suma, d) => suma + (d.saldo ?? 0), 0);

  return (
    <Pantalla
      refrescando={deudas.refrescando}
      onRefresh={() => {
        deudas.recargar();
        otros.recargar();
      }}>
      <Tarjeta>
        <Text style={{ color: c.textSecondary, fontSize: 14 }}>Monto total deuda</Text>
        <Text style={[e.total, { color: total > 0 ? Peligro : c.text }]}>
          {total.toLocaleString('es-PY')} Gs.
        </Text>
      </Tarjeta>

      <Segmentos opciones={VISTAS} valor={vista} onCambio={setVista} />

      {vista === 'Deudas' ? (
        deudas.cargando ? (
          <Cargando />
        ) : deudas.error ? (
          <Aviso texto={deudas.error} />
        ) : !deudas.datos?.length ? (
          <Aviso texto="No tenés deudas pendientes." />
        ) : (
          deudas.datos.map((d, i) => <FilaDeuda key={i} deuda={d} />)
        )
      ) : otros.cargando ? (
        <Cargando />
      ) : (
        <ListaDatos
          datos={otros.error ? null : (otros.datos?.aaData ?? otros.datos)}
          vacio={
            vista === 'Arancel Cero'
              ? 'No tenés conceptos con arancel cero.'
              : 'No hay información de fraccionamiento disponible.'
          }
        />
      )}

      <Text style={[e.nota, { color: c.textSecondary }]}>
        Los pagos se siguen haciendo por los canales habituales de la facultad. Esta app solo
        muestra el estado de cuenta.
      </Text>
    </Pantalla>
  );
}

function FilaDeuda({ deuda }: { deuda: Deuda }) {
  const c = useColores();
  // El backend separa el concepto de las materias que lo componen; la web las
  // muestra juntas y sin ellas no se sabe por qué se debe.
  const materias = deuda.asignaturas?.replace(/,\s*$/, '').trim();

  return (
    <Tarjeta>
      <View style={{ gap: 6 }}>
        <Text style={[e.concepto, { color: c.text }]}>{deuda.concepto?.trim()}</Text>

        {materias ? (
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 18 }}>{materias}</Text>
        ) : null}

        <View style={e.datos}>
          {deuda.numeroCuota ? <Dato etiqueta="Cuota" valor={String(deuda.numeroCuota)} /> : null}
          {deuda.fechaVencimiento ? (
            <Dato etiqueta="Vencimiento" valor={deuda.fechaVencimiento} />
          ) : null}
          <Dato etiqueta="Monto" valor={`${deuda.montoStr} Gs.`} />
          <Dato etiqueta="Saldo" valor={`${deuda.saldoStr} Gs.`} destacado />
        </View>
      </View>
    </Tarjeta>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  const c = useColores();
  return (
    <View style={e.dato}>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{etiqueta}</Text>
      <Text
        style={{
          color: destacado ? Peligro : c.text,
          fontSize: destacado ? 17 : 15,
          fontWeight: destacado ? '700' : '500',
        }}>
        {valor}
      </Text>
    </View>
  );
}

const e = StyleSheet.create({
  total: { fontSize: 32, fontWeight: '700' },
  concepto: { fontSize: 16, fontWeight: '600' },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, marginTop: Spacing.one },
  dato: { gap: 1 },
  nota: { fontSize: 12, lineHeight: 17, marginTop: Spacing.three },
});
