/**
 * Verifica las reglas de formato de los PDF de notas contra el comportamiento
 * del generador de la web.
 *
 *   node --experimental-strip-types scripts/verificar-pdf.mjs
 *
 * Los valores esperados salen de leer su bundle (chunk 9), no de suponer.
 */
import assert from 'node:assert/strict';

import {
  agrupar,
  asignatura,
  htmlFinales,
  htmlLibres,
  sinAcentos,
  txt,
} from '../src/lib/pdf-formato.ts';

// Su `toText` saca los acentos de las vocales pero no toca la ñ.
assert.equal(sinAcentos('MEDICINA INTERNA Ⅰ'), 'MEDICINA INTERNA Ⅰ');
assert.equal(sinAcentos('ANATOMÍA'), 'ANATOMIA');
assert.equal(sinAcentos('PATOLOGÍA GENERAL Y BUCAL'), 'PATOLOGIA GENERAL Y BUCAL');
assert.equal(sinAcentos('NUÑEZ'), 'NUÑEZ', 'la ñ tiene que sobrevivir');
assert.equal(sinAcentos('NÚÑEZ'), 'NUÑEZ', 'solo cae el acento, no la tilde de la ñ');
assert.equal(sinAcentos('ANGÜÉ'), 'ANGUE', 'diéresis y agudo, los dos casos de su expresión');
assert.equal(sinAcentos(null), '');

// `txt` además escapa: el HTML tiene que salir inerte.
assert.equal(txt('  CIRUGÍA & TRAUMA  '), 'CIRUGIA &amp; TRAUMA');
assert.equal(txt('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');

// Agrupa por nombre de semestre, ordenando por codcurso y a igualdad por nombre.
// El original prefiere `cursoStr`; si no viene, cae a `descripcurso`.
const filas = [
  { codcurso: 2, cursoStr: 'SEGUNDO SEMESTRE', id: 'b1' },
  { codcurso: 1, cursoStr: 'PRIMER SEMESTRE', id: 'a1' },
  { codcurso: 2, cursoStr: 'SEGUNDO SEMESTRE', id: 'b2' },
  { codcurso: 1, descripcurso: 'PRIMER SEMESTRE', id: 'a2' },
];
const grupos = agrupar(filas);
assert.deepEqual(
  grupos.map((g) => g.titulo),
  ['PRIMER SEMESTRE', 'SEGUNDO SEMESTRE']
);
assert.deepEqual(
  grupos.map((g) => g.filas.map((f) => f.id)),
  [
    ['a1', 'a2'],
    ['b1', 'b2'],
  ]
);

// Dos semestres con el mismo codcurso pero distinto nombre son grupos distintos.
assert.equal(
  agrupar([
    { codcurso: 3, cursoStr: 'TERCERO B' },
    { codcurso: 3, cursoStr: 'TERCERO A' },
  ]).length,
  2
);

// El original NO reordena por nombre cuando el codcurso ya los separa.
assert.deepEqual(
  agrupar([
    { codcurso: 2, cursoStr: 'AAA' },
    { codcurso: 1, cursoStr: 'ZZZ' },
  ]).map((g) => g.titulo),
  ['ZZZ', 'AAA']
);

// Recorte de asignatura: >70 corta y baja a 6pt, >50 solo baja a 7pt.
assert.deepEqual(asignatura('CIRUGIA'), { texto: 'CIRUGIA', pt: 9 });
const c51 = 'C'.repeat(51);
assert.deepEqual(asignatura(c51), { texto: c51, pt: 7 });
const c71 = 'C'.repeat(71);
assert.deepEqual(asignatura(c71), { texto: `${'C'.repeat(70)}...`, pt: 6 });
// Justo en los bordes no cambia nada: su condición es estrictamente mayor.
assert.equal(asignatura('C'.repeat(50)).pt, 9);
assert.equal(asignatura('C'.repeat(70)).pt, 7);

// ------------------------------------------------------------ HTML ya armado

const comun = (facultad, codigoFacultad) => ({
  facultad,
  codigoFacultad,
  carrera: 'CARRERA DE PRUEBA',
  nombre: 'NOMBRE APELLIDO',
  cedula: '0000000',
  codcarsec: 'XX',
});

const nota = (codcurso, cursoStr, descripasign, cursocompleto) => ({
  codcurso,
  cursoStr,
  descripasign,
  nota: '4',
  descripnota: 'DISTINGUIDO',
  fechaExaDMY: '14/07/2025',
  nroacta: '10001',
  puntajeef: 82,
  cursocompleto,
});

const finales = htmlFinales(
  {
    ...comun('FACULTAD DE CIENCIAS MEDICAS', 'MED'),
    promedio: 3.25,
    notas: [
      nota(1, 'PRIMER SEMESTRE', 'ANATOMÍA DESCRIPTIVA', 'S'),
      nota(2, 'SEGUNDO SEMESTRE', 'HISTOLOGÍA', 'N'),
    ],
  },
  'data:image/png;base64,ESCUDO'
);

// Cada semestre lleva su rótulo, y siempre uno de los dos.
assert.match(finales, /PRIMER SEMESTRE \(COMPLETO\)/);
assert.match(finales, /SEGUNDO SEMESTRE \(INCOMPLETO\)/);
assert.doesNotMatch(finales, /SEMESTRE<\/td>/, 'nunca debe quedar un semestre sin rotular');

// La asignatura pierde los acentos; el nombre del semestre no.
assert.match(finales, /ANATOMIA DESCRIPTIVA/);
assert.match(finales, /HISTOLOGIA/);

// El promedio va tal cual lo da la API, sin redondear a dos decimales.
assert.match(finales, /PROMEDIO: 3\.25</);
assert.doesNotMatch(finales, /PROMEDIO: 3\.3/);

// Columnas de finales, en orden.
assert.match(finales, /ASIGNATURA[\s\S]*FECHA[\s\S]*N° ACTA[\s\S]*PUNTAJE[\s\S]*NOTA/);

// Nada de la facultad está fijo en el código: sale de los datos, escudo incluido.
const derecho = htmlFinales(
  { ...comun('FACULTAD DE DERECHO', 'DER'), promedio: 4, notas: [nota(1, 'PRIMERO', 'CIVIL', 'S')] },
  'data:image/png;base64,OTROESCUDO'
);
assert.match(derecho, /FACULTAD DE DERECHO/);
assert.match(derecho, /OTROESCUDO/);
assert.doesNotMatch(derecho, /MEDICAS|MED\.png/, 'no puede filtrarse la facultad de Medicina');

// Libres: otras columnas, sin promedio y sin (COMPLETO)/(INCOMPLETO).
const libres = htmlLibres(
  comun('FACULTAD DE DERECHO', 'DER'),
  [
    {
      codcurso: 1,
      cursoStr: 'PRIMER SEMESTRE',
      descripasign: 'INGLÉS TÉCNICO',
      fechaExaDMY: '02/03/2025',
      nroacta: '20001',
      nota: '4',
      descripnota: 'DISTINGUIDO',
      cantcred: 3,
    },
  ],
  null
);
assert.match(libres, /NOTAS LIBRES/);
assert.match(libres, /CRED\/HS/);
assert.doesNotMatch(libres, /PUNTAJE/);
assert.doesNotMatch(libres, /PROMEDIO/);
assert.doesNotMatch(libres, /\(COMPLETO\)|\(INCOMPLETO\)/);
assert.match(libres, /INGLES TECNICO/);

console.log('formato de PDF: todo en orden');
