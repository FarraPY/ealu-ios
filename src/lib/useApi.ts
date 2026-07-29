import { useCallback, useEffect, useState } from 'react';

import { apiGet } from '@/lib/api';

export type Consulta<T> = {
  datos: T | null;
  error: string | null;
  cargando: boolean;
  refrescando: boolean;
  recargar: () => void;
};

/** GET a la API con estado de carga, error y pull-to-refresh. `path` null = no pedir nada. */
export function useApi<T>(path: string | null): Consulta<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const traer = useCallback(
    async (esRefresco: boolean) => {
      if (!path) {
        setCargando(false);
        return;
      }
      esRefresco ? setRefrescando(true) : setCargando(true);
      try {
        setDatos(await apiGet<T>(path));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido.');
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [path]
  );

  useEffect(() => {
    traer(false);
  }, [traer]);

  const recargar = useCallback(() => {
    traer(true);
  }, [traer]);

  return { datos, error, cargando, refrescando, recargar };
}
