/**
 * Genera el PDF de notas finales en el dispositivo.
 *
 * La web lo arma en el navegador con jsPDF: no hay endpoint que lo devuelva, así
 * que hay que construirlo del lado del cliente igual que ellos. Se replica el
 * formato del original (encabezado de la facultad, agrupado por semestre,
 * asignatura / fecha / acta / puntaje / nota).
 */
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

import { NotaFinal } from '@/lib/api';

function escapar(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export type DatosPdf = {
  facultad: string;
  carrera: string;
  nombre: string;
  cedula: string;
  notas: NotaFinal[];
  promedio: number;
};

function agrupar(notas: NotaFinal[]) {
  const mapa = new Map<number, { titulo: string; notas: NotaFinal[] }>();
  for (const n of notas) {
    const clave = n.codcurso ?? 0;
    const g = mapa.get(clave) ?? { titulo: n.descripcurso?.trim() || 'Sin curso', notas: [] };
    g.notas.push(n);
    mapa.set(clave, g);
  }
  return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
}

function html(d: DatosPdf): string {
  let i = 0;
  const cuerpo = agrupar(d.notas)
    .map(([, g]) => {
      const filas = g.notas
        .map((n) => {
          i += 1;
          return `<tr>
            <td class="n">${i})</td>
            <td>${escapar(n.descripasign)}</td>
            <td class="c">${escapar(n.fechaExaDMY ?? '')}</td>
            <td class="c">${escapar(n.nroacta)}</td>
            <td class="c">${escapar(n.puntajeef ?? '')}</td>
            <td class="c">${escapar(n.nota)} (${escapar(n.descripnota)})</td>
          </tr>`;
        })
        .join('');
      return `<tr><td colspan="6" class="grupo">${escapar(g.titulo)}</td></tr>${filas}`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 24px; }
    h1 { font-size: 13px; text-align: center; margin: 0; line-height: 1.5; }
    .datos { margin: 16px 0 12px; font-size: 11px; }
    .datos div { margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; padding: 4px 3px; }
    td { padding: 3px; font-size: 10.5px; }
    td.c { text-align: center; white-space: nowrap; }
    td.n { width: 26px; color: #555; }
    .grupo { font-weight: bold; text-align: center; padding-top: 10px;
             border-bottom: 1px solid #999; font-size: 10.5px; }
    .pie { margin-top: 18px; font-size: 11px; font-weight: bold; text-align: right; }
    .aviso { margin-top: 10px; font-size: 9px; color: #666; text-align: center; }
  </style></head><body>
    <h1>UNIVERSIDAD NACIONAL DE ASUNCIÓN<br>${escapar(d.facultad)}<br>NOTAS FINALES</h1>
    <div class="datos">
      <div><b>CARRERA:</b> ${escapar(d.carrera)}</div>
      <div><b>NOMBRES Y APELLIDOS:</b> ${escapar(d.nombre)}</div>
      <div><b>CÉDULA:</b> ${escapar(d.cedula)}</div>
    </div>
    <table>
      <thead><tr>
        <th></th><th>ASIGNATURA</th><th style="text-align:center">FECHA</th>
        <th style="text-align:center">N° ACTA</th><th style="text-align:center">PUNTAJE</th>
        <th style="text-align:center">NOTA</th>
      </tr></thead>
      <tbody>${cuerpo}</tbody>
    </table>
    <div class="pie">PROMEDIO: ${d.promedio.toFixed(2)}</div>
  </body></html>`;
}

/**
 * Genera el PDF y abre la hoja de compartir de iOS, desde donde se puede guardar
 * en Archivos o enviarlo. Equivale al botón "DESCARGAR PDF" de la web, que
 * también construye el documento en el cliente (con jsPDF).
 */
export async function compartirNotasPdf(d: DatosPdf): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: html(d) });
  await shareAsync(uri, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: 'Notas finales',
  });
}
