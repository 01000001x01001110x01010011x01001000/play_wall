/**
 * Minimal typing for the Tauri global injected when the app runs inside the
 * desktop shell (withGlobalTauri in tauri.conf.json). In a normal browser
 * window.__TAURI__ is undefined and the titlebar is not rendered.
 */

interface TauriWindowHandle {
  minimize(): Promise<void>;
  close(): Promise<void>;
  setAlwaysOnTop(value: boolean): Promise<void>;
}

interface Window {
  __TAURI__?: {
    window: { getCurrentWindow(): TauriWindowHandle };
    core: { invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> };
  };
}
