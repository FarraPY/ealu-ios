import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  apiGet,
  borrarCredenciales,
  Credenciales,
  guardarCredenciales,
  login,
  logout as apiLogout,
  Matricula,
  SessionInfo,
} from '@/lib/api';

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

  // Al abrir la app: si hay credenciales guardadas, apiGet renueva la sesión solo
  // (401 -> re-login transparente), así que basta con pedir los datos de sesión.
  useEffect(() => {
    let vigente = true;
    (async () => {
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
