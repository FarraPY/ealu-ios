/**
 * Reglas de formato de los PDF de notas, sacadas del código de la web.
 *
 * Están acá y no en `pdf-notas.ts` para que no arrastren imports de Expo: así
 * `scripts/verificar-pdf.mjs` puede armar el HTML en Node sin levantar la app.
 */
// Solo el tipo: no deja rastro en tiempo de ejecución y el script corre igual.
import type { NotaFinal } from '@/lib/api';

/**
 * Quita los acentos, como hace su `toText`.
 *
 * Su generador pasa por esta función la carrera, el nombre, la cédula, la
 * asignatura, el acta y la descripción de la nota; el nombre del semestre NO.
 * Se replica esa asimetría tal cual para que el texto salga igual. Ojo que la
 * ñ sobrevive: su expresión solo cubre las vocales.
 */
export function sinAcentos(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/([aeio])́|(u)[́̈]/gi, '$1$2')
    .normalize();
}

export function escapar(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Texto dinámico: sin acentos y escapado, como en el original. */
export function txt(s: unknown): string {
  return escapar(sinAcentos(s));
}

/** Lo mínimo que necesita `agrupar`; las notas reales traen bastante más. */
export type Fila = {
  cursoStr?: string | null;
  descripcurso?: string | null;
  codcurso: number;
};

/**
 * Ordena por semestre y agrupa, igual que su `contenidoPdf`: primero `codcurso`
 * y a igualdad el nombre del semestre. Agrupa por nombre, no por código.
 */
export function agrupar<T extends Fila>(filas: T[]) {
  const nombre = (f: T) => (f.cursoStr ?? f.descripcurso ?? '').trim();
  const ordenadas = [...filas].sort((a, b) =>
    a.codcurso !== b.codcurso ? a.codcurso - b.codcurso : nombre(a).localeCompare(nombre(b))
  );
  const grupos: { titulo: string; filas: T[] }[] = [];
  for (const f of ordenadas) {
    const titulo = nombre(f);
    if (grupos.at(-1)?.titulo !== titulo) grupos.push({ titulo, filas: [] });
    grupos.at(-1)!.filas.push(f);
  }
  return grupos;
}

/**
 * Recorta la asignatura como el original: a más de 70 caracteres la corta y baja
 * la fuente a 6, y a más de 50 solo baja a 7.
 */
export function asignatura(descrip: string): { texto: string; pt: number } {
  const d = String(descrip ?? '');
  if (d.length > 70) return { texto: `${d.substring(0, 70)}...`, pt: 6 };
  if (d.length > 50) return { texto: d, pt: 7 };
  return { texto: d, pt: 9 };
}

export type Comun = {
  facultad: string;
  /** Código de facultad: define qué escudo lleva el encabezado. */
  codigoFacultad: string;
  carrera: string;
  nombre: string;
  cedula: string;
  codcarsec: string;
};

export type DatosPdf = Comun & {
  notas: NotaFinal[];
  promedio: number;
};

/** Filas de `notas_libres/{codcarsec}`, con las columnas que usa su PDF. */
export type NotaLibre = Fila & {
  descripasign: string;
  fechaExaDMY?: string | null;
  nroacta?: string | null;
  nota?: string | null;
  descripnota?: string | null;
  cantcred?: number | null;
};

/** Estilos comunes. Las medidas son las del original, en milímetros sobre A4. */
const ESTILOS = `
  @page { size: A4; margin: 10mm 10mm 10mm 15mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .marco { border: 0.3mm solid #b4b4b4; height: 22mm; position: relative;
           box-sizing: border-box; }
  .escudo { position: absolute; left: 1mm; top: 1mm; width: 15mm; height: 15mm;
            object-fit: contain; }
  .titulos { text-align: center; font-weight: bold; padding-top: 1.5mm; line-height: 4mm; }
  .carrera { padding: 1mm 0 0 20mm; border-bottom: 0.2mm solid #000; }
  .persona { display: flex; justify-content: space-between; padding: 1mm 0 0 5mm;
             border-bottom: 0.2mm solid #000; }
  th { font-weight: bold; text-align: left; padding: 2mm 0 0.5mm 0;
       border-bottom: 0.2mm solid #000; }
  th.caja { padding: 0; border: 0; font-weight: normal; }
  td { height: 5mm; padding: 0; vertical-align: bottom; }
  tr.grupo td { font-weight: bold; text-align: center; padding-top: 4mm;
                border-bottom: 0.2mm solid #000; }
  .c { text-align: center; white-space: nowrap; }
  .pie { border-top: 0.2mm solid #000; padding-top: 1.5mm; margin-top: 1mm;
         font-weight: bold; text-align: right; }
`;

/**
 * Caja del encabezado. Replica `createLogoTitleAndSubTitle` seguido de
 * `addHeader`: marco gris, escudo a la izquierda y los tres títulos centrados.
 *
 * Va dentro del `<thead>` a propósito: WebKit repite el thead en cada página
 * impresa, que es lo que hace el original al cortar (vuelve a dibujar la caja y
 * los datos del alumno arriba de cada hoja).
 */
function encabezado(d: Comun, logo: string | null, subtitulo: string, columnas: number): string {
  return `<tr><th class="caja" colspan="${columnas}">
      <div class="marco">
        ${logo ? `<img class="escudo" src="${logo}" alt="">` : ''}
        <div class="titulos">
          UNIVERSIDAD NACIONAL DE ASUNCIÓN<br>${escapar(d.facultad)}<br>${subtitulo}
        </div>
      </div>
      <div class="carrera"><b>CARRERA:</b> ${txt(d.carrera)}</div>
      <div class="persona">
        <span><b>NOMBRES Y APELLIDOS:</b> ${txt(d.nombre)}</span>
        <span><b>CÉDULA:</b> ${txt(d.cedula)}</span>
      </div>
    </th></tr>`;
}

export function htmlFinales(d: DatosPdf, logo: string | null): string {
  let i = 0;
  const cuerpo = agrupar(d.notas)
    .map((g) => {
      // El original rotula siempre: (COMPLETO) o (INCOMPLETO), nunca a secas.
      const completo = g.filas[0]?.cursocompleto?.trim().toUpperCase() === 'S';
      const filas = g.filas
        .map((n) => {
          i += 1;
          const a = asignatura(n.descripasign);
          return `<tr>
            <td class="n">${i})</td>
            <td style="font-size:${a.pt}pt">${txt(a.texto)}</td>
            <td class="c">${escapar(n.fechaExaDMY ?? '')}</td>
            <td class="c">${txt(n.nroacta ?? '')}</td>
            <td class="c">${escapar(n.puntajeef ?? '')}</td>
            <td class="c">${escapar(n.nota ?? '')} ${n.nota ? `(${txt(n.descripnota)})` : ''}</td>
          </tr>`;
        })
        .join('');
      const rotulo = `${g.titulo} ${completo ? '(COMPLETO)' : '(INCOMPLETO)'}`;
      return `<tr class="grupo"><td colspan="6">${escapar(rotulo)}</td></tr>${filas}`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${ESTILOS}</style></head><body>
    <table>
      <colgroup><col style="width:7mm"><col><col style="width:20mm">
        <col style="width:15mm"><col style="width:15mm"><col style="width:35mm"></colgroup>
      <thead>
        ${encabezado(d, logo, 'NOTAS FINALES', 6)}
        <tr>
          <th></th><th>ASIGNATURA</th><th class="c">FECHA</th>
          <th class="c">N° ACTA</th><th class="c">PUNTAJE</th><th class="c">NOTA</th>
        </tr>
      </thead>
      <tbody>${cuerpo}</tbody>
    </table>
    <div class="pie">PROMEDIO: ${escapar(d.promedio)}</div>
  </body></html>`;
}

export function htmlLibres(d: Comun, libres: NotaLibre[], logo: string | null): string {
  let i = 0;
  const cuerpo = agrupar(libres)
    .map((g) => {
      const filas = g.filas
        .map((n) => {
          i += 1;
          const a = asignatura(n.descripasign);
          return `<tr>
            <td class="n">${i})</td>
            <td style="font-size:${a.pt}pt">${txt(a.texto)}</td>
            <td class="c">${escapar(n.fechaExaDMY ?? '')}</td>
            <td class="c">${txt(n.nroacta ?? '')}</td>
            <td class="c">${escapar(n.nota ?? '')} ${n.nota ? `(${txt(n.descripnota)})` : ''}</td>
            <td class="c">${escapar(n.cantcred ?? '')}</td>
          </tr>`;
        })
        .join('');
      // Libres no lleva (COMPLETO)/(INCOMPLETO): solo el nombre del semestre.
      return `<tr class="grupo"><td colspan="6">${escapar(g.titulo)}</td></tr>${filas}`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${ESTILOS}</style></head><body>
    <table>
      <colgroup><col style="width:7mm"><col><col style="width:20mm">
        <col style="width:15mm"><col style="width:35mm"><col style="width:15mm"></colgroup>
      <thead>
        ${encabezado(d, logo, 'NOTAS LIBRES', 6)}
        <tr>
          <th></th><th>ASIGNATURA</th><th class="c">FECHA</th>
          <th class="c">N° ACTA</th><th class="c">NOTA</th><th class="c">CRED/HS</th>
        </tr>
      </thead>
      <tbody>${cuerpo}</tbody>
    </table>
  </body></html>`;
}

