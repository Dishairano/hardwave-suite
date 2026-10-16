import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface LatestVersion {
  version: string;
  notes: string;
  pub_date?: string;
}

export interface InstallProgress {
  phase:
    | "downloading"
    | "extracting"
    | "shortcuts"
    | "registering"
    | "done";
  percent: number;
  message: string;
}

export interface InstallOptions {
  install_dir: string;
  create_desktop_shortcut: boolean;
  create_start_menu_shortcut: boolean;
  launch_after: boolean;
}

export async function fetchLatestVersion(): Promise<LatestVersion> {
  return invoke<LatestVersion>("fetch_latest_version");
}

export async function defaultInstallDir(): Promise<string> {
  return invoke<string>("default_install_dir");
}

export async function startInstall(options: InstallOptions): Promise<string> {
  return invoke<string>("start_install", { options });
}

export async function cancelInstall(): Promise<void> {
  return invoke("cancel_install");
}

export async function launchInstalled(exePath: string): Promise<void> {
  return invoke("launch_installed", { exePath });
}

export async function quit(): Promise<void> {
  return invoke("quit");
}

export async function onProgress(
  handler: (p: InstallProgress) => void
): Promise<UnlistenFn> {
  return listen<InstallProgress>("install://progress", (e) => handler(e.payload));
}

// ─── Uninstall mode ──────────────────────────────────────────────────────────

export type LaunchMode = "install" | "uninstall";

export type UninstallStep =
  | "close_app"
  | "remove_plugins"
  | "remove_install_folder"
  | "remove_shortcuts"
  | "remove_registry_keys";

/** The steps of this uninstall and how many are done. */
export interface UninstallProgress {
  steps: UninstallStep[];
  done: number;
}

/** Why the uninstall stopped: the step that could not finish, and what to do. */
export interface UninstallFailure {
  step: UninstallStep | null;
  reason: string;
}

/** Which screens to show, decided by the exe from its arguments and its name. */
export async function launchMode(): Promise<LaunchMode> {
  return invoke<LaunchMode>("launch_mode");
}

/** Names of the plug-ins the Suite installed that are on this computer. Reads only. */
export async function uninstallOverview(): Promise<string[]> {
  return invoke<string[]>("uninstall_overview");
}

/** Removes the Suite, and its plug-ins when `removePlugins` is set. */
export async function startUninstall(removePlugins: boolean): Promise<void> {
  try {
    await invoke("start_uninstall", { removePlugins });
  } catch (e) {
    const failure: UninstallFailure =
      e && typeof e === "object" && "reason" in e
        ? (e as UninstallFailure)
        : { step: null, reason: String(e) };
    throw failure;
  }
}

export async function onUninstallProgress(
  handler: (p: UninstallProgress) => void
): Promise<UnlistenFn> {
  return listen<UninstallProgress>("uninstall://progress", (e) => handler(e.payload));
}
