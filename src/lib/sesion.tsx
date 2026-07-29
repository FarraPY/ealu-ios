import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  apiGet,
  borrarCredenciales,
  Credenciales,
  guardarCredenciales,
  leerCredenciales,
  login,
  logout as apiLogout,
  Matricula,
  SessionInfo,
} from '@/lib/api';

/**
 * Detecta si la app se acaba de instalar.
 *
 * El Keychain de iOS **sobrevive a la desinstalación**: sin esta marca, reinstalar
 * el IPA dejaría la sesión anterior ya iniciada, sin pedir contraseña. El archivo
 * vive en el sandbox de la app, que sí se borra al desinstalar.
 */
function esInstalacionNueva(): boolean {
  try {
    const marca = new File(Paths.document, 'ealu-instalado');
    if (marca.exists) return false;
    marca.create();
    marca.write(new Date().toISOString());
    return true;
  } catch {
    // Ante la duda, no borrar credenciales: es peor expulsar al usuario sin motivo.
    return false;
  }
}

type Estado = 'cargando' | 'fuera' | 'dentro';

type Contexto = {
  estado: Estado;
  info: SessionInfo | null;
  /** Matrículas del alumno: puede tener más de una (p. ej. dos mallas curriculares). */
  matriculas: Matricula[];
  codcarsec: string;
  elegirMatricula: (codcarsec: string) => void;
  iniciarSesion: (c: Credenciales) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const SesionContext = createContext<Contexto | null>(null);

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      // Instalación nueva: descartar lo que el Keychain haya conservado.
      if (esInstalacionNueva()) {
        await borrarCredenciales();
        if (vigente) setEstado('fuera');
        return;
      }

      // Sin credenciales guardadas no se entra, aunque el servidor todavía tenga
      // viva la cookie. Es lo que hace que "cerrar sesión" realmente cierre.
      const creds = await leerCredenciales();
      if (!creds) {
        if (vigente) setEstado('fuera');
        return;
      }

      try {
        const datos = await apiGet<SessionInfo>('sesion-ealu/info');
        if (vigente) {
          setInfo(datos);
          setEstado('dentro');
        }
      } catch {
        if (vigente) setEstado('fuera');
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (c: Credenciales) => {
    await login(c);
    // Solo guardamos las credenciales si el servidor ya las aceptó.
    await guardarCredenciales(c);
    try {
      setInfo(await apiGet<SessionInfo>('sesion-ealu/info'));
      setEstado('dentro');
    } catch (e) {
      await borrarCredenciales();
      throw e;
    }
  }, []);

  const cerrarSesion = useCallback(async () => {
    await apiLogout();
    setInfo(null);
    setElegida(null);
    setEstado('fuera');
  }, []);

  const valor = useMemo<Contexto>(() => {
    const matriculas = info?.matriculaList ?? [];
    // Sin elección explícita usamos la primera, igual que la web.
    const codcarsec = (elegida ?? matriculas[0]?.codcarsec ?? '').trim();
    return {
      estado,
      info,
      matriculas,
      codcarsec,
      elegirMatricula: setElegida,
      iniciarSesion,
      cerrarSesion,
    };
  }, [estado, info, elegida, iniciarSesion, cerrarSesion]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion(): Contexto {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return ctx;
}
