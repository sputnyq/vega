import { useCallback, useEffect, useState } from "react";
import { catalogRequest } from "./catalog-api.js";

export interface IdentifiedCatalogRecord {
  id: number;
}

export function useCatalogCollection<T extends IdentifiedCatalogRecord>(resource: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await catalogRequest<T[]>(`/api/admin/catalog/${resource}`);
      setItems(nextItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Katalog konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => { void reload(); }, [reload]);

  async function create(input: Record<string, unknown>) {
    const created = await catalogRequest<T>(`/api/admin/catalog/${resource}`, "POST", input);
    setItems((current) => [...current, created]);
  }

  async function update(id: number, input: Record<string, unknown>) {
    const updated = await catalogRequest<T>(`/api/admin/catalog/${resource}/${id}`, "PUT", input);
    setItems((current) => current.map((item) => item.id === id ? updated : item));
  }

  async function remove(id: number) {
    await catalogRequest<{ deleted: boolean }>(`/api/admin/catalog/${resource}/${id}`, "DELETE");
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return { items, loading, error, reload, create, update, remove, setError };
}
