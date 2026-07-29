/**
 * Cliente de la API de EALU (https://api.una.py:8443/ealu-backend/).
 *
 * La autenticación del backend es por cookie de sesión (JSESSIONID), no JWT.
 * En iOS, fetch usa NSHTTPCookieStorage, que persiste entre reinicios de la app,
 * así que la cookie sobrevive sola. Cuando el servidor la caduca por inactividad
 * respondemos con un login transparente usando las credenciales del Keychain:
 * por eso el usuario no vuelve a ver la pantalla de login.
 */
import * as SecureStore from 'expo-secure-store';

export const BASE = 'https://api.una.py:8443/ealu-backend/';

const CREDS_KEY = 'ealu.credenciales';

export type Credenciales = { username: string; password: string; codfacul: string };

export type Facultad = {
  id: number;
  codigo: string;
  nombre: string;
  nombreCompleto?: string;
  mostrar?: boolean;
  online?: boolean;
  /** Flags que la propia API expone para saber qué secciones habilita cada facultad. */
  tieneParciales?: boolean;
  tienePreinscasig?: boolean;
  tieneInscexafinal?: boolean;
  /** Tope de materias que admite una preinscripción (Medicina: 5). */
  maxPreinscasig?: number;
};

export type Matricula = { codcarsec?: string; [k: string]: unknown };

export type SessionInfo = {
  user?: Record<string, unknown>;
  alumno?: Record<string, unknown>;
  facultad?: Facultad;
  matriculaList?: Matricula[];
  [k: string]: unknown;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- credenciales

export async function guardarCredenciales(c: Credenciales) {
  await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify(c));
}

export async function leerCredenciales(): Promise<Credenciales | null> {
  const raw = await SecureStore.getItemAsync(CREDS_KEY);
  return raw ? (JSON.parse(raw) as Credenciales) : null;
}

export async function borrarCredenciales() {
  await SecureStore.deleteItemAsync(CREDS_KEY);
}

// ----------------------------------------------------------------------- login

export async function login(c: Credenciales): Promise<void> {
  const body =
    `username=${encodeURIComponent(c.username)}&password=${encodeURIComponent(c.password)}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}login?codfacul=${encodeURIComponent(c.codfacul)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor de la UNA.');
  }

  if (!res.ok) {
    throw new ApiError(
      res.status === 401 || res.status === 403
        ? 'Cédula o contraseña incorrecta.'
        : `El servidor respondió ${res.status}.`,
      res.status
    );
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}logout`, { method: 'POST' });
  } catch {
    // Cerrar sesión localmente igual: borrar las credenciales es lo que importa.
  }
  await borrarCredenciales();
}

// --------------------------------------------------------------------- request

/**
 * El backend puede responder a una sesión caducada con 401/403 o devolviendo
 * HTML en lugar de JSON. Ambos casos disparan un único reintento con re-login.
 */
async function pedir(
  path: string,
  init: RequestInit,
  reintentar: boolean,
  esperaJson = true,
  intento = 0
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { Accept: esperaJson ? 'application/json' : '*/*', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Sin conexión con el servidor de la UNA.');
  }

  // El backend devuelve 500 de forma intermitente y a la siguiente llamada anda.
  // Se reintenta solo en lecturas: repetir un POST podría duplicar una escritura.
  const esLectura = !init.method || init.method === 'GET';
  if (res.status >= 500 && esLectura && intento < 2) {
    await new Promise((r) => setTimeout(r, 600 * (intento + 1)));
    return pedir(path, init, reintentar, esperaJson, intento + 1);
  }

  const tipo = res.headers.get('content-type') ?? '';
  const sesionPerdida =
    res.status === 401 ||
    res.status === 403 ||
    (esperaJson && res.ok && res.status !== 204 && !tipo.includes('json'));

  if (sesionPerdida && reintentar) {
    const creds = await leerCredenciales();
    if (creds) {
      await login(creds);
      return pedir(path, init, false, esperaJson);
    }
    throw new ApiError('Tu sesión expiró. Iniciá sesión de nuevo.', 401);
  }

  if (!res.ok) {
    throw new ApiError(
      res.status >= 500
        ? 'El servidor de la UNA no está respondiendo bien en este momento.'
        : `El servidor respondió ${res.status}.`,
      res.status
    );
  }
  return res;
}

async function leerJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return null as T;
  const texto = await res.text();
  if (!texto) return null as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ApiError('El servidor devolvió una respuesta que no se pudo leer.');
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return leerJson<T>(await pedir(path, {}, true));
}

/**
 * Trae una imagen protegida (`perfil/qr.png`, `perfil/foto.png`) como data URI.
 * No se puede pasar la URL directo a <Image>: esos endpoints exigen la cookie de
 * sesión, y el cargador de imágenes no la envía.
 */
export async function obtenerImagen(path: string): Promise<string> {
  const res = await pedir(path, {}, true, false);
  const blob = await res.blob();
  return new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new ApiError('No se pudo leer la imagen.'));
    lector.onload = () => resolver(String(lector.result));
    lector.readAsDataURL(blob);
  });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return leerJson<T>(await pedir(path, init, true));
}

/** El backend es Spring y varias escrituras esperan formulario, no JSON. */
export async function apiPostForm<T>(path: string, campos: Record<string, string>): Promise<T> {
  const body = Object.entries(campos)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const init: RequestInit = {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };
  return leerJson<T>(await pedir(path, init, true));
}

// ------------------------------------------------------------------ inscripción

export type TurnoSeccion = {
  checked: boolean;
  turno: string;
  seccion: string;
  text: string;
  /** `anho:convocatoria:codcarsec:codasign:turno:seccion:electiva` — lo que espera el POST. */
  value: string;
};

export type RespuestaHabilitadas = {
  success?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  data?: AsignaturaHabilitada[];
  extraValues?: {
    /** true = la preinscripción ya se cerró y no admite cambios. */
    cierreHecho?: boolean;
    formaPagoSeleccionable?: boolean;
    [k: string]: unknown;
  };
};

export type AsignaturaHabilitada = {
  checked: boolean;
  codasign: string;
  asignatura: string;
  asignaturaStr: string;
  curso: string;
  codcurso: number | null;
  semestre: unknown;
  optativa: boolean;
  electiva: boolean;
  puedeModificar: boolean;
  conFirma: unknown;
  turnoSeccionList: TurnoSeccion[];
};

// ------------------------------------------------------------------ contraseña

/**
 * Cambia la contraseña y actualiza la guardada en el Keychain.
 *
 * Sin ese segundo paso la app queda con la contraseña vieja y el re-login
 * automático empieza a fallar en silencio: el usuario acaba expulsado la próxima
 * vez que el servidor caduque la sesión.
 */
export async function cambiarContrasena(
  actual: string,
  nueva: string,
  confirmar: string
): Promise<void> {
  const cuerpo =
    `currentPass=${encodeURIComponent(actual)}` +
    `&newPass=${encodeURIComponent(nueva)}` +
    `&confirmPass=${encodeURIComponent(confirmar)}`;

  const res = await pedir(
    'perfil/cambiar-contrasenha',
    {
      method: 'POST',
      body: cuerpo,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    true
  );

  // El backend puede responder 200 con un mensaje de error en el cuerpo.
  const texto = await res.text();
  if (texto) {
    try {
      const json = JSON.parse(texto) as { success?: boolean; errorMessage?: string };
      if (json.success === false) {
        throw new ApiError(json.errorMessage || 'No se pudo cambiar la contraseña.');
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // Respuesta no JSON: si el HTTP fue correcto, se toma como éxito.
    }
  }

  const creds = await leerCredenciales();
  if (creds) await guardarCredenciales({ ...creds, password: nueva });
}

// ------------------------------------------------------------------ facultades

/** Endpoint público: no requiere sesión, por eso no pasa por `pedir`. */
export async function obtenerFacultades(): Promise<Facultad[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}facultades`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('No se pudo cargar la lista de facultades.');
  }
  if (!res.ok) throw new ApiError('No se pudo cargar la lista de facultades.', res.status);

  const todas = (await res.json()) as Facultad[];
  return todas
    .filter((f) => f.mostrar !== false)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// ------------------------------------------------------- formas de los recursos
// Confirmadas contra respuestas reales de la API. Los campos que el backend puede
// devolver nulos se tipan como opcionales para no romper el render.

export type UltimaNota = {
  asignatura: string;
  tipoexamen: string;
  fechaexamen: string;
  nota: number | null;
  ausente: boolean;
  puntajeobtenido: number | null;
};

export type NotaFinal = {
  codasign: string;
  descripasign: string;
  descripcurso: string;
  descripnota: string;
  nota: string;
  valornota: number;
  cantcred: number;
  anho: number;
  fecha: number | null;
  /** Orden real del semestre; `descripcurso` es texto y no se puede ordenar. */
  codcurso: number;
  nroacta: string | null;
  codescala: string | null;
  observacion: string | null;
};

export type NotasFinales = { notas: NotaFinal[]; promedio: number };

export type Deuda = {
  concepto: string;
  /** Materias que componen la deuda; el concepto solo no dice por qué se debe. */
  asignaturas: string | null;
  montoStr: string;
  saldoStr: string;
  saldo: number;
  numeroCuota: number | null;
  fechaVencimiento: string | null;
};

// ------------------------------------------------------- extensión universitaria

export type ActividadExtension = {
  descripcion: string;
  tipoEvento: string;
  anho: number;
  horasEvento: number;
  fechaInicio: number | null;
  fechaFin: number | null;
};

export type ResumenExtension = {
  horasRequeridas: number;
  horasCumplidas: number;
  horasAjustadas: number;
  minactreq: number;
  activcount: number;
  creds_completo: string;
  extensionList: ActividadExtension[];
};

export type Extension = {
  resumenExtension: ResumenExtension | null;
  resumenExtensionPorTipoEvento: unknown;
};

export type Inscripcion = {
  asignatura: string;
  curso: string;
  codcurso: number | null;
  turno: string | null;
  seccion: string | null;
  anho: number;
  aprobado: unknown;
  porcasis: number | null;
  derechoexa: unknown;
};

/**
 * Algunos endpoints (p. ej. `asig-habilitadas`) envuelven el resultado en
 * `{ success, errorMessage, data }` y otros devuelven el array pelado.
 */
export function desenvolver(res: unknown): unknown {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res) {
    return (res as { data?: unknown }).data ?? null;
  }
  return res ?? null;
}
