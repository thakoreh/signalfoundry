// @vitest-environment jsdom
import React, { StrictMode, act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkspaceSession,
  useWorkspaceSession,
} from "../components/workspace-session";
let container: HTMLDivElement;
let root: Root;
let savedApi: ReturnType<typeof useWorkspaceSession>["api"];
const failures: unknown[] = [];
function Probe() {
  const { api } = useWorkspaceSession();
  useEffect(() => {
    savedApi = api;
    void api("/workspace").catch((error) => failures.push(error));
  }, [api]);
  return null;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  failures.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("workspace request lifecycle", () => {
  it("gives StrictMode's second passive data effect a live session without reviving old pending requests", async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi.fn(async (_path: string, options: RequestInit) => {
      signals.push(options.signal!);
      return Response.json({ id: "workspace_a" });
    });
    vi.stubGlobal("fetch", fetch);
    await act(async () =>
      root.render(
        <StrictMode>
          <WorkspaceSession mode="saas" role="org:admin" organizationId="org_a">
            <Probe />
          </WorkspaceSession>
        </StrictMode>,
      ),
    );
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(failures).toEqual([]);
    await act(async () => root.unmount());
    expect(signals[1].aborted).toBe(true);
    const calls = fetch.mock.calls.length;
    expect(() => savedApi("/workspace")).toThrow();
    expect(fetch).toHaveBeenCalledTimes(calls);
    root = createRoot(container);
  });
  it("aborts genuine-unmount work and prevents an old organization API closure from making future calls", async () => {
    const records: { signal: AbortSignal; org: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_path: string, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = options.signal!;
            records.push({
              signal,
              org: new Headers(options.headers).get(
                "X-SignalFoundry-Organization",
              ),
            });
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );
    await act(async () =>
      root.render(
        <WorkspaceSession
          key="org_a"
          mode="saas"
          role="org:admin"
          organizationId="org_a"
        >
          <Probe />
        </WorkspaceSession>,
      ),
    );
    const oldApi = savedApi;
    await act(async () =>
      root.render(
        <WorkspaceSession
          key="org_b"
          mode="saas"
          role="org:member"
          organizationId="org_b"
        >
          <Probe />
        </WorkspaceSession>,
      ),
    );
    expect(records[0].signal.aborted).toBe(true);
    expect(records[0].org).toBe("org_a");
    expect(records[1].org).toBe("org_b");
    expect(records[1].signal.aborted).toBe(false);
    expect(() => oldApi("/workspace")).toThrow();
    expect(records).toHaveLength(2);
    await act(async () => root.unmount());
    expect(records[1].signal.aborted).toBe(true);
    expect(() => savedApi("/workspace")).toThrow();
    root = createRoot(container);
  });
});
