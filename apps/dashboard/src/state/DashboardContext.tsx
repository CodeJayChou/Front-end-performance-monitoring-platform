import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { QueryClient } from "../api/client";
import type { ConnectionConfig, DashboardFilters } from "../api/types";
import { filtersFromSearch, filtersToSearch } from "./filters";

const STORAGE_KEY = "monitor-dashboard-connection";

interface DashboardState {
  connection: ConnectionConfig | null;
  client: QueryClient | null;
  filters: DashboardFilters;
  refreshKey: number;
  saveConnection: (connection: ConnectionConfig) => void;
  clearConnection: () => void;
  setFilters: (filters: DashboardFilters) => void;
  refresh: () => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useSearchParams();
  const [connection, setConnection] = useState<ConnectionConfig | null>(readConnection);
  const [refreshKey, setRefreshKey] = useState(0);
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const client = useMemo(
    () => (connection ? new QueryClient(connection) : null),
    [connection],
  );

  const saveConnection = useCallback((next: ConnectionConfig) => {
    const clean = {
      baseUrl: next.baseUrl.trim().replace(/\/$/, ""),
      projectId: next.projectId.trim(),
      adminKey: next.adminKey.trim(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    setConnection(clean);
  }, []);

  const clearConnection = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setConnection(null);
  }, []);

  const setFilters = useCallback(
    (next: DashboardFilters) => setSearch(filtersToSearch(next, search), { replace: true }),
    [search, setSearch],
  );

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  // New SDK events are asynchronous (ingest → processor → query). Keep an
  // open dashboard current without requiring the user to press Refresh.
  useEffect(() => {
    if (!connection) return;
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [connection, refresh]);

  return (
    <DashboardContext.Provider
      value={{
        connection,
        client,
        filters,
        refreshKey,
        saveConnection,
        clearConnection,
        setFilters,
        refresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardState {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used within DashboardProvider");
  return value;
}

function readConnection(): ConnectionConfig | null {
  const configuredBaseUrl = import.meta.env.VITE_QUERY_API_URL as string | undefined;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ConnectionConfig;
      if (parsed.baseUrl && parsed.projectId && parsed.adminKey) {
        if (parsed.baseUrl.replace(/\/$/, "") === "http://localhost:3002" && configuredBaseUrl) {
          const migrated = { ...parsed, baseUrl: configuredBaseUrl.replace(/\/$/, "") };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
        return parsed;
      }
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  const baseUrl = configuredBaseUrl;
  const projectId = import.meta.env.VITE_PROJECT_ID as string | undefined;
  const adminKey = import.meta.env.VITE_ADMIN_KEY as string | undefined;
  return baseUrl && projectId && adminKey ? { baseUrl, projectId, adminKey } : null;
}
