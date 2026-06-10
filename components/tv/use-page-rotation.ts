'use client';

import { useEffect, useState } from 'react';

// Rotación automática de páginas para TVs sin input: cada `intervalMs` avanza una
// página y vuelve al inicio. Se clampa cuando el total baja (ej: entregas vacían
// el tablero).
export function usePageRotation(totalPages: number, intervalMs = 10000): number {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, intervalMs);
    return () => clearInterval(id);
  }, [totalPages, intervalMs]);

  return totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
}
