/**
 * Genera los PDF de notas en el dispositivo.
 *
 * La web los arma en el navegador con jsPDF: no hay endpoint que los devuelva,
 * así que hay que construirlos del lado del cliente igual que ellos.
 *
 * El formato es UNO SOLO para todas las facultades. En su código no hay ningún
 * condicional por facultad: las coordenadas están fijas y lo único que varía es
 * el escudo (`facultad.codigo`) y el nombre de la facultad, los dos leídos de la
 * sesión. Un alumno de Derecho recibe el mismo formato con su propio escudo.
 *
 * Las medidas de acá replican las del original, que dibuja en milímetros sobre
 * A4: caja del encabezado de 15 a 200 mm, filas cada 5 mm, escudo de 15×15 mm.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

import {
  Comun,
  DatosPdf,
  htmlFinales,
  htmlLibres,
  NotaLibre,
  nombreArchivo,
} from '@/lib/pdf-formato';

const LOGOS = 'https://www.cnc.una.py/ealu/assets/img/logos/';

/**
 * Escudo del encabezado, como data URI.
 *
 * La web hace `imgToBase64("assets/img/logos/" + codigo + ".png")` y si falla cae
 * a `UNA.png`: cada facultad tiene su escudo y algunas (FACEN) no tienen archivo
 * propio. Se replica ese mismo respaldo.
 */
async function logoDe(codigo: string): Promise<string | null> {
  for (const nombre of [codigo.trim().toUpperCase(), 'UNA']) {
    if (!nombre) continue;
    try {
      const res = await fetch(`${LOGOS}${nombre}.png`);
      if (!res.ok) continue;
      const blob = await res.blob();
      return await new Promise<string>((ok, fallo) => {
        const lector = new FileReader();
        lector.onerror = () => fallo(new Error('logo ilegible'));
        lector.onload = () => ok(String(lector.result));
        lector.readAsDataURL(blob);
      });
    } catch {
      // Probar el siguiente; el PDF se genera igual sin escudo.
    }
  }
  return null;
}

/**
 * Imprime el HTML y abre la hoja de compartir, desde donde se puede guardar en
 * Archivos o enviarlo.
 *
 * `printToFileAsync` devuelve un nombre temporal, así que se renombra al que usa
 * su `openPdf` para que el archivo guardado quede igual que el de la web.
 *
 * OJO con `move`: devuelve una promesa. Sin esperarla, `shareAsync` recibía la
 * ruta mientras el archivo estaba en tránsito, no encontraba nada y fallaba con
 * FilePermissionException ("You don't have access to the provided file"). Se usa
 * `moveSync`, que es la variante síncrona.
 */
async function compartir(html: string, nombre: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const archivo = new File(uri);
  const destino = new File(Paths.cache, nombre);
  if (destino.exists) destino.delete();
  archivo.moveSync(destino);
  await shareAsync(destino.uri, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: nombre,
  });
}

export async function compartirNotasPdf(d: DatosPdf, apellidoNombre: string): Promise<void> {
  const logo = await logoDe(d.codigoFacultad);
  await compartir(
    htmlFinales(d, logo),
    nombreArchivo('notas_finales', d.codcarsec, apellidoNombre)
  );
}

export async function compartirLibresPdf(
  d: Comun,
  libres: NotaLibre[],
  usuario: string
): Promise<void> {
  const logo = await logoDe(d.codigoFacultad);
  await compartir(htmlLibres(d, libres, logo), nombreArchivo('notas_libres', d.codcarsec, usuario));
}
