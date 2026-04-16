import { useEffect, useState, useCallback } from "react";
import { fonarService, type FonarOverview } from "@/services/fonarService";

export function useFonarStatus() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    fonarService.status()
      .then((r) => setEnabled(!!r.enabled))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

export function useFonarOverview() {
  const [data, setData] = useState<FonarOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fonarService.overview();
      setData(r);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, reload };
}
