"use client";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { api as callApi } from "@/lib/api";
import type { AppMode } from "@/lib/runtime-config";

type SessionClient = {
  mode: AppMode;
  role: string;
  isAdmin: boolean;
  api: typeof callApi;
  request: (path: string, options?: RequestInit) => Promise<Response>;
};
const Context = createContext<SessionClient | null>(null);
export function WorkspaceSession({
  mode,
  role,
  organizationId,
  children,
}: {
  mode: AppMode;
  role: string;
  organizationId?: string;
  children: React.ReactNode;
}) {
  const controller = useRef<AbortController | null>(null);
  const value = useMemo<SessionClient>(() => {
    const optionsWithSignal = (options: RequestInit = {}) => {
      if (!controller.current) controller.current = new AbortController();
      const signal = options.signal
        ? AbortSignal.any([options.signal, controller.current.signal])
        : controller.current.signal;
      signal.throwIfAborted();
      const headers = new Headers(options.headers);
      if (mode === "saas" && organizationId)
        headers.set("X-SignalFoundry-Organization", organizationId);
      return { ...options, signal, headers };
    };
    return {
      mode,
      role,
      isAdmin: role === "org:admin",
      api: <T,>(path: string, options?: RequestInit) =>
        callApi<T>(path, optionsWithSignal(options)),
      request: (path, options) =>
        fetch(`/api${path}`, {
          ...optionsWithSignal(options),
          cache: "no-store",
          credentials: "same-origin",
        }),
    };
  }, [mode, role, organizationId]);
  useEffect(() => {
    // React strict-mode remounts effects; each live session gets a fresh controller.
    if (!controller.current || controller.current.signal.aborted)
      controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspaceSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace session is required");
  return value;
}
