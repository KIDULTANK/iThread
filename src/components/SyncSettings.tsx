import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n/registry";
import { getAllMaps } from "../store/mapStore";
import { syncMap } from "../sync/engine";
import { IndexedDbSyncLocal, syncEndpoint } from "../sync/localStore";
import { WebDavRepository } from "../sync/webdav";
import "./settingsMessages";

export function SyncSettings({
  activeMapId,
  onLibraryChange,
}: { activeMapId?: string; onLibraryChange?: () => void | Promise<void> }) {
  const [endpoint, setEndpoint] = useState("");
  const [configured, setConfigured] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [maps, setMaps] = useState<{ id: string; title: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<Awaited<ReturnType<IndexedDbSyncLocal["conflicts"]>>>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [report, setReport] = useState({ done: 0, conflicts: 0, pending: 0 });
  const live = useRef(true);
  const protectedId = useRef(activeMapId);
  protectedId.current = activeMapId;
  const local = useCallback(
    (workspace: string) =>
      new IndexedDbSyncLocal(workspace, () => {
        if (!live.current) throw new Error("cancelled");
        return protectedId.current;
      }),
    [],
  );
  const refresh = useCallback(
    async (workspace: string) => {
      const store = local(workspace);
      const [docs, ids, copies] = await Promise.all([
        getAllMaps(),
        store.selectedIds(),
        store.conflicts(),
      ]);
      if (live.current) {
        setMaps(docs.filter((d) => !d.meta?.trashedAt).map((d) => ({ id: d.id, title: d.title })));
        setSelected(ids);
        setConflicts(copies);
      }
    },
    [local],
  );
  useEffect(() => {
    live.current = true;
    void syncEndpoint()
      .then(async (url) => {
        if (live.current) {
          setEndpoint(url);
          setConfigured(url);
        }
        await refresh(url);
      })
      .catch(() => {
        if (live.current) setStatus("error");
      });
    return () => {
      live.current = false;
    };
  }, [refresh]);
  function repository() {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    const authorization =
      username || password ? `Basic ${btoa(String.fromCharCode(...bytes))}` : undefined;
    return new WebDavRepository(configured, (input, init) =>
      fetch(input, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          ...(authorization ? { Authorization: authorization } : {}),
        },
      }),
    );
  }
  async function configure() {
    setBusy(true);
    try {
      const url = new URL(endpoint.trim());
      if (!url.pathname.endsWith("/")) url.pathname += "/";
      new WebDavRepository(url.href); // Validate without contacting the server.
      await syncEndpoint(url.href);
      if (url.href !== configured) {
        setUsername("");
        setPassword("");
      }
      setConfigured(url.href);
      setEndpoint(url.href);
      setRemoteIds([]);
      setStatus("configured");
      await refresh(url.href);
    } catch {
      setStatus("error");
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function discover() {
    setBusy(true);
    setStatus("");
    try {
      const ids = await repository().list();
      if (live.current) {
        setRemoteIds(ids);
        setStatus("discovered");
      }
    } catch {
      if (live.current) setStatus("error");
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function toggle(id: string, enabled: boolean) {
    setBusy(true);
    try {
      await local(configured).select(id, enabled);
      await refresh(configured);
    } catch {
      setStatus("error");
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function run() {
    setBusy(true);
    setStatus("running");
    const counts = { done: 0, conflicts: 0, pending: 0 };
    try {
      const store = local(configured);
      const repo = repository();
      for (const id of await store.selectedIds()) {
        if (!live.current) break;
        try {
          const result = await syncMap(id, store, repo);
          if (result === "conflict") counts.conflicts++;
          else if (result === "retry") counts.pending++;
          else counts.done++;
        } catch (error) {
          if (
            error instanceof Error &&
            ["active-map", "pending-local-save"].includes(error.message)
          )
            counts.pending++;
          else throw error;
        }
      }
      if (live.current) {
        setStatus("complete");
      }
    } catch {
      if (live.current) {
        setStatus("error");
      }
    } finally {
      if (live.current) {
        setReport(counts);
        try {
          await refresh(configured);
          await onLibraryChange?.();
        } catch {
          if (live.current) setStatus("error");
        } finally {
          if (live.current) setBusy(false);
        }
      }
    }
  }
  const rows = [
    ...maps,
    ...[...new Set([...remoteIds, ...selected])]
      .filter((id) => !maps.some((m) => m.id === id))
      .map((id) => ({ id, title: id })),
  ];
  function downloadConflict(copy: (typeof conflicts)[number]) {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              mapId: copy.mapId,
              savedAt: copy.savedAt,
              local: copy.local,
              remote: copy.remote.value,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ithread-conflict-${copy.savedAt}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="mm-settings-section mm-sync-section" aria-label={t("sync.title")}>
      <h3>{t("sync.title")}</h3>
      <p className="mm-settings-help">{t("sync.intro")}</p>
      <label className="mm-map-field">
        <span>{t("sync.endpoint")}</span>
        <input
          className="mm-map-control"
          type="url"
          value={endpoint}
          disabled={busy}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://"
        />
      </label>
      <button type="button" disabled={busy || !endpoint.trim()} onClick={() => void configure()}>
        {t("sync.configure")}
      </button>
      <label className="mm-map-field">
        <span>{t("sync.username")}</span>
        <input
          className="mm-map-control"
          value={username}
          maxLength={256}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="mm-map-field">
        <span>{t("sync.password")}</span>
        <input
          className="mm-map-control"
          type="password"
          value={password}
          maxLength={2048}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
        />
      </label>
      <p className="mm-settings-help">{t("sync.credentialsHelp")}</p>
      <div className="mm-sync-actions">
        <button
          type="button"
          disabled={busy || !configured || endpoint !== configured}
          onClick={() => void discover()}
        >
          {t("sync.discover")}
        </button>
        <button
          type="button"
          disabled={busy || !configured || endpoint !== configured || selected.length === 0}
          onClick={() => void run()}
        >
          {t("sync.run")}
        </button>
      </div>
      <p className="mm-settings-help">{t("sync.selectionHelp")}</p>
      <div className="mm-sync-maps">
        {rows.map((map) => (
          <label key={map.id}>
            <input
              type="checkbox"
              checked={selected.includes(map.id)}
              disabled={busy || !configured || !/^[a-zA-Z0-9_-]{1,128}$/.test(map.id)}
              onChange={(e) => void toggle(map.id, e.target.checked)}
            />
            {map.title || map.id}
            {map.id === activeMapId && <small>{t("sync.active")}</small>}
          </label>
        ))}
      </div>
      {status && (
        <output className="mm-settings-help">
          {status === "complete"
            ? t("sync.report", report)
            : status === "running"
              ? t("sync.running")
              : status === "configured"
                ? t("sync.configured")
                : status === "discovered"
                  ? t("sync.discovered")
                  : t("sync.error")}
        </output>
      )}
      {conflicts.length > 0 && (
        <div>
          <h4>{t("sync.conflicts")}</h4>
          <p className="mm-settings-help">{t("sync.conflictsHelp")}</p>
          {conflicts.map((copy) => (
            <details key={`${copy.mapId}:${copy.remote.etag}`}>
              <summary>{copy.local?.title || copy.remote.value?.title || copy.mapId}</summary>
              <button type="button" onClick={() => downloadConflict(copy)}>
                {t("sync.downloadConflict")}
              </button>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
