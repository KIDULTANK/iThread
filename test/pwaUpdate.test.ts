// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetPwaUpdateForTest, checkForUpdate, initPwaUpdateToast } from "../src/pwa/pwaUpdate";
import type { ToastKind, ToastOptions } from "../src/pwa/pwaUpdate";
// Same module instance the service imports via the `virtual:pwa-register` alias.
import {
  __getLastRegisterSWOptions,
  __getRegisterCount,
  __getUpdateCalls,
  __resetPwaRegisterStub,
  __triggerNeedRefresh,
  __triggerOfflineReady,
} from "./stubs/virtual-pwa-register";

interface ToastCall {
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}
let toasts: ToastCall[];
const showToast = (kind: ToastKind, message: string, opts?: ToastOptions) => {
  toasts.push({ kind, message, action: opts?.action });
};

// jsdom has no navigator.serviceWorker; set/remove it per test.
const setRegistration = (reg: unknown) => {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => reg },
  });
};
const removeServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    // biome-ignore lint/performance/noDelete: test cleanup of a defined property
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  }
};

beforeEach(() => {
  toasts = [];
  __resetPwaRegisterStub();
  __resetPwaUpdateForTest();
  removeServiceWorker();
});
afterEach(() => {
  removeServiceWorker();
  Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: undefined });
});

describe("initPwaUpdateToast", () => {
  it("does not let a service worker replace bundled Android code", async () => {
    Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: {} });
    initPwaUpdateToast(showToast);
    expect(__getRegisterCount()).toBe(0);
    expect(await checkForUpdate()).toBe("unsupported");
  });
  it("registers both SW lifecycle callbacks", () => {
    initPwaUpdateToast(showToast);
    const opts = __getLastRegisterSWOptions();
    expect(typeof opts?.onNeedRefresh).toBe("function");
    expect(typeof opts?.onOfflineReady).toBe("function");
  });

  it("onNeedRefresh shows a 'Refresh now' toast whose action calls updateSW(true)", () => {
    initPwaUpdateToast(showToast);
    __triggerNeedRefresh();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toMatch(/new version/i);
    expect(toasts[0].action?.label).toBe("Refresh now");
    toasts[0].action?.run();
    expect(__getUpdateCalls()).toEqual([true]);
  });

  it("onOfflineReady shows an offline-ready toast", () => {
    initPwaUpdateToast(showToast);
    __triggerOfflineReady();
    expect(toasts.some((t) => /offline/i.test(t.message))).toBe(true);
  });

  it("is idempotent — a second init does not register the SW again", () => {
    initPwaUpdateToast(showToast);
    initPwaUpdateToast(showToast);
    expect(__getRegisterCount()).toBe(1);
  });
});

describe("checkForUpdate", () => {
  it("returns 'unsupported' when the service worker API is absent", async () => {
    expect(await checkForUpdate()).toBe("unsupported");
  });

  it("returns 'unsupported' when there is no registration yet", async () => {
    setRegistration(null);
    expect(await checkForUpdate()).toBe("unsupported");
  });

  it("returns 'already-pending' and re-surfaces the prompt when one is waiting", async () => {
    initPwaUpdateToast(showToast); // wires the toast + cached updateSW
    setRegistration({ waiting: {}, update: async () => {} });
    expect(await checkForUpdate()).toBe("already-pending");
    expect(toasts.some((t) => t.action?.label === "Refresh now")).toBe(true);
  });

  it("returns 'newly-found' when update() pulls a new worker", async () => {
    const reg = { waiting: null, installing: null, update: async () => {} };
    setRegistration(reg);
    // update() "finds" a new worker -> it starts installing
    reg.update = async () => {
      (reg as { installing: unknown }).installing = {};
    };
    expect(await checkForUpdate()).toBe("newly-found");
  });

  it("returns 'up-to-date' when update() finds nothing new", async () => {
    setRegistration({ waiting: null, installing: null, update: async () => {} });
    expect(await checkForUpdate()).toBe("up-to-date");
  });

  it("returns 'unsupported' when update() throws", async () => {
    setRegistration({
      waiting: null,
      installing: null,
      update: async () => {
        throw new Error("network");
      },
    });
    expect(await checkForUpdate()).toBe("unsupported");
  });
});
