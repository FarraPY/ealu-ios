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
  const otros = useApi<unknown>(
    vista === 'Arancel Cero'
      ? 'solicitud-gratuidad'
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
          datos={otros.error ? null : otros.datos}
          vacio={
            vista === 'Arancel Cero'
              ? 'No hay solicitudes de arancel cero registradas.'
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
  return (
    <Tarjeta>
      <View style={{ gap: 4 }}>
        <Text style={[e.concepto, { color: c.text }]}>{deuda.concepto?.trim()}</Text>
        <View style={e.entre}>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            {[
              deuda.numeroCuota ? `Cuota ${deuda.numeroCuota}` : null,
              deuda.fechaVencimiento ? `Vence ${deuda.fechaVencimiento}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={[e.monto, { color: c.text }]}>{deuda.saldoStr ?? deuda.montoStr}</Text>
        </View>
      </View>
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  total: { fontSize: 32, fontWeight: '700' },
  entre: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.two },
  concepto: { fontSize: 15, fontWeight: '600' },
  monto: { fontSize: 17, fontWeight: '700' },
  nota: { fontSize: 12, lineHeight: 17, marginTop: Spacing.three },
});
