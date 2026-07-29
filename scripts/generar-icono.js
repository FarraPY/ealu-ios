/**
 * Convierte cualquier PNG en un icono valido para iOS o Android.
 *
 * iOS rechaza iconos con canal alfa, y los logos vienen con fondo transparente:
 * hay que componerlos sobre un color solido. Ademas exige 1024x1024 exactos.
 *
 *   node generar-icono.js <entrada.png> <salida.png> [#RRGGBB fondo] [margen 0..0.3] [#RRGGBB tinte]
 *
 * El tinte es opcional: si se pasa, el logo se pinta de ese color usando su canal
 * alfa como mascara. Hace falta cuando el fondo es del mismo color que el logo
 * (un logo granate sobre fondo granate no se ve).
 *
 * Para el icono adaptativo de Android el fondo lo pone el sistema
 * (android.adaptiveIcon.backgroundColor), asi que la capa de adelante tiene que
 * salir con alfa. Se pide poniendo `transparente` como fondo y pasando en el
 * quinto argumento el color a recortar:
 *
 *   node generar-icono.js icon.png foreground.png transparente 0.22 clave:#990301
 *
 * El margen ahi tiene que ser mas grande que en iOS: Android recorta el icono a
 * un circulo o un cuadrado redondeado, y solo garantiza que se vea el 66% central.
 */
const zlib = require('zlib');
const fs = require('fs');

const [, , ENTRADA, SALIDA, FONDO_HEX = '#ffffff', MARGEN = '0.10', TINTE_HEX] = process.argv;
const alfa = FONDO_HEX === 'transparente';
/** Color de fondo a recortar, cuando la salida lleva alfa. */
const clave = TINTE_HEX?.startsWith('clave:')
  ? [
      parseInt(TINTE_HEX.slice(7, 9), 16),
      parseInt(TINTE_HEX.slice(9, 11), 16),
      parseInt(TINTE_HEX.slice(11, 13), 16),
    ]
  : null;
const tinte =
  TINTE_HEX && !clave
    ? [
        parseInt(TINTE_HEX.slice(1, 3), 16),
        parseInt(TINTE_HEX.slice(3, 5), 16),
        parseInt(TINTE_HEX.slice(5, 7), 16),
      ]
    : null;
const N = 1024;
const margen = parseFloat(MARGEN);
const fondo = alfa
  ? [0, 0, 0]
  : [
      parseInt(FONDO_HEX.slice(1, 3), 16),
      parseInt(FONDO_HEX.slice(3, 5), 16),
      parseInt(FONDO_HEX.slice(5, 7), 16),
    ];

// ------------------------------------------------------------------ leer PNG
function leerPng(ruta) {
  const b = fs.readFileSync(ruta);
  let o = 8;
  let ancho = 0, alto = 0, tipoColor = 0, prof = 0;
  const idat = [];
  let paleta = null, trns = null;

  while (o < b.length) {
    const largo = b.readUInt32BE(o);
    const tipo = b.toString('ascii', o + 4, o + 8);
    const datos = b.subarray(o + 8, o + 8 + largo);
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      prof = datos[8];
      tipoColor = datos[9];
    } else if (tipo === 'IDAT') idat.push(datos);
    else if (tipo === 'PLTE') paleta = Buffer.from(datos);
    else if (tipo === 'tRNS') trns = Buffer.from(datos);
    else if (tipo === 'IEND') break;
    o += 12 + largo;
  }
  if (prof !== 8) throw new Error('solo se admiten PNG de 8 bits por canal');

  const canales = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipoColor];
  if (!canales) throw new Error('tipo de color no soportado: ' + tipoColor);

  const crudo = zlib.inflateSync(Buffer.concat(idat));
  const bpp = canales;
  const paso = ancho * bpp;
  const sal = Buffer.alloc(alto * paso);

  // Deshacer los filtros por scanline (spec PNG, seccion 9)
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (paso + 1)];
    const linea = crudo.subarray(y * (paso + 1) + 1, y * (paso + 1) + 1 + paso);
    const dest = sal.subarray(y * paso, (y + 1) * paso);
    const arriba = y > 0 ? sal.subarray((y - 1) * paso, y * paso) : null;
    for (let i = 0; i < paso; i++) {
      const a = i >= bpp ? dest[i - bpp] : 0;
      const b2 = arriba ? arriba[i] : 0;
      const c = arriba && i >= bpp ? arriba[i - bpp] : 0;
      let v = linea[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b2;
      else if (filtro === 3) v += (a + b2) >> 1;
      else if (filtro === 4) {
        const p = a + b2 - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c;
      }
      dest[i] = v & 0xff;
    }
  }

  // Normalizar a RGBA
  const rgba = Buffer.alloc(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    let r, g, bl, al = 255;
    if (tipoColor === 6) { r = sal[i*4]; g = sal[i*4+1]; bl = sal[i*4+2]; al = sal[i*4+3]; }
    else if (tipoColor === 2) { r = sal[i*3]; g = sal[i*3+1]; bl = sal[i*3+2]; }
    else if (tipoColor === 0) { r = g = bl = sal[i]; }
    else if (tipoColor === 4) { r = g = bl = sal[i*2]; al = sal[i*2+1]; }
    else { const idx = sal[i]; r = paleta[idx*3]; g = paleta[idx*3+1]; bl = paleta[idx*3+2];
           al = trns && idx < trns.length ? trns[idx] : 255; }
    rgba[i*4] = r; rgba[i*4+1] = g; rgba[i*4+2] = bl; rgba[i*4+3] = al;
  }
  return { ancho, alto, rgba };
}

// ------------------------------------------------- escalar, componer y escribir
const src = leerPng(ENTRADA);
const canales = alfa ? 4 : 3;
const dest = Buffer.alloc(N * N * canales);
const lado = Math.round(N * (1 - 2 * margen));
const desde = Math.round((N - lado) / 2);

for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    let r = fondo[0], g = fondo[1], b = fondo[2], salidaAlfa = 0;
    const lx = x - desde, ly = y - desde;
    if (lx >= 0 && ly >= 0 && lx < lado && ly < lado) {
      // Muestreo bilineal para que no quede dentado al reescalar
      const fx = (lx / lado) * (src.ancho - 1);
      const fy = (ly / lado) * (src.alto - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, src.ancho - 1), y1 = Math.min(y0 + 1, src.alto - 1);
      const tx = fx - x0, ty = fy - y0;
      let acc = [0, 0, 0, 0];
      const puntos = [[x0,y0,(1-tx)*(1-ty)],[x1,y0,tx*(1-ty)],[x0,y1,(1-tx)*ty],[x1,y1,tx*ty]];
      for (const [px, py, w] of puntos) {
        const i = (py * src.ancho + px) * 4;
        acc[0] += src.rgba[i] * w; acc[1] += src.rgba[i+1] * w;
        acc[2] += src.rgba[i+2] * w; acc[3] += src.rgba[i+3] * w;
      }
      let a = acc[3] / 255;
      let src3 = [acc[0], acc[1], acc[2]];

      if (tinte) {
        // Se ignora el color original y solo se conserva la forma.
        // Si la imagen ya viene recortada, la silueta es el alfa. Si trae fondo
        // blanco opaco (lo habitual al exportar a WEBP/JPG), el alfa no sirve de
        // mascara y hay que deducirla de la oscuridad del pixel.
        const luz = (acc[0] + acc[1] + acc[2]) / 3 / 255;
        // El logo no es negro puro (granate y rojo dan oscuridad ~0.73-0.82), así
        // que la mascara cruda saldria translucida. Se satura dividiendo por el
        // tono mas claro del logo; los bordes conservan el antialiasing.
        const porOscuridad = Math.min(1, (1 - luz) / 0.7);
        a = a < 0.99 ? a : porOscuridad;
        src3 = tinte;
      }

      if (clave) {
        // El logo viene ya compuesto sobre un fondo solido (el icono de iOS).
        // Se recupera la silueta midiendo cuanto se aleja cada pixel de ese
        // color: identico al fondo -> transparente, lejano -> opaco. Los bordes
        // suavizados caen en el medio y conservan el antialiasing.
        const dist = Math.max(
          Math.abs(acc[0] - clave[0]),
          Math.abs(acc[1] - clave[1]),
          Math.abs(acc[2] - clave[2])
        );
        salidaAlfa = Math.min(255, Math.round((dist / 255) * 1.15 * 255));
        // El color se toma del pixel mas opaco posible para que el borde no
        // arrastre el granate del fondo original.
        const f = salidaAlfa > 0 ? 255 / salidaAlfa : 0;
        r = Math.min(255, Math.round(clave[0] + (acc[0] - clave[0]) * f));
        g = Math.min(255, Math.round(clave[1] + (acc[1] - clave[1]) * f));
        b = Math.min(255, Math.round(clave[2] + (acc[2] - clave[2]) * f));
      } else {
        r = Math.round(src3[0] * a + fondo[0] * (1 - a));
        g = Math.round(src3[1] * a + fondo[1] * (1 - a));
        b = Math.round(src3[2] * a + fondo[2] * (1 - a));
        salidaAlfa = Math.round(a * 255);
      }
    }
    const o = (y * N + x) * canales;
    dest[o] = r; dest[o+1] = g; dest[o+2] = b;
    if (alfa) dest[o+3] = salidaAlfa;
  }
}

const filas = Buffer.alloc(N * (1 + N * canales));
let o = 0;
for (let y = 0; y < N; y++) {
  filas[o++] = 0;
  dest.copy(filas, o, y * N * canales, (y + 1) * N * canales);
  o += N * canales;
}

const tabla = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t; })();
const crc32 = (buf) => { let c = -1;
  for (let i = 0; i < buf.length; i++) c = tabla[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0; };
const trozo = (tipo, datos) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([l, cuerpo, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; ihdr[9] = alfa ? 6 : 2;

fs.writeFileSync(SALIDA, Buffer.concat([
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  trozo('IHDR', ihdr),
  trozo('IDAT', zlib.deflateSync(filas, { level: 9 })),
  trozo('IEND', Buffer.alloc(0)),
]));
console.log(
  alfa
    ? `capa ${N}x${N} con alfa, recortando ${TINTE_HEX} -> ${SALIDA}`
    : `icono ${N}x${N} sin alfa sobre ${FONDO_HEX} -> ${SALIDA}`
);
