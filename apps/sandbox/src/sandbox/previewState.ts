import { chatStore, type WindowMode } from "@chativa/core";

/**
 * Shared state for the sandbox Preview area (issue #13).
 *
 * The preview is single-instance: it does not mount a second `<chat-iva>`.
 * `<sandbox-preview-stage>` wraps the page's one widget and, while a preset
 * is selected, sizes it inside a frame with `theme.windowMode = "inline"`.
 * See `PreviewStage.ts` for why a second instance is not used.
 *
 * The state lives in this module (not in a tab component) so the selected
 * breakpoint survives tab switches and is shared by the Preview tab and the
 * stage toolbar. Only the Preview tab's Reset, the global Reset all, picking
 * a different window mode, or a viewport narrower than the breakpoint below
 * turn it off.
 */

export type PreviewPresetId = "off" | "mobile" | "tablet" | "desktop" | "free";

export interface PreviewSize {
  width: number;
  height: number;
}

export interface PreviewPreset extends PreviewSize {
  id: Exclude<PreviewPresetId, "off" | "free">;
  label: string;
}

export const PREVIEW_PRESETS: readonly PreviewPreset[] = [
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "desktop", label: "Desktop", width: 1280, height: 800 },
];

/** Starting size of the Free (drag-resize) frame. */
export const FREE_DEFAULT_SIZE: PreviewSize = { width: 480, height: 720 };

/** The preview is hidden on viewports at or below this width (px). */
export const PREVIEW_MAX_HIDDEN_WIDTH = 768;
const NARROW_QUERY = `(max-width: ${PREVIEW_MAX_HIDDEN_WIDTH}px)`;

export interface PreviewState {
  preset: PreviewPresetId;
  /** Last size of the Free frame — kept while switching presets. */
  freeSize: PreviewSize;
}

let _state: PreviewState = { preset: "off", freeSize: { ...FREE_DEFAULT_SIZE } };
/** Window mode that was active before the preview switched to `inline`. */
let _restoreWindowMode: WindowMode | null = null;
const _listeners = new Set<(s: PreviewState) => void>();

function emit(next: PreviewState) {
  _state = next;
  for (const fn of _listeners) fn(_state);
}

export function getPreviewState(): PreviewState {
  return _state;
}

export function subscribePreview(fn: (s: PreviewState) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function isPreviewSupported(): boolean {
  return !window.matchMedia(NARROW_QUERY).matches;
}

/** Fixed width × height for a preset, or the current Free size. */
export function previewSizeOf(state: PreviewState): PreviewSize | null {
  if (state.preset === "off") return null;
  if (state.preset === "free") return state.freeSize;
  return PREVIEW_PRESETS.find((p) => p.id === state.preset) ?? null;
}

export function setPreviewPreset(preset: PreviewPresetId): void {
  if (preset === _state.preset) return;
  if (preset === "off") {
    resetPreview();
    return;
  }
  if (!isPreviewSupported()) return;

  const store = chatStore.getState();
  if (_state.preset === "off") {
    // Entering the preview: remember the host-page window mode, switch the
    // one widget to inline so it fills the preview frame, and open it.
    _restoreWindowMode = store.theme.windowMode ?? "popup";
    emit({ ..._state, preset });
    if (store.theme.windowMode !== "inline") store.setTheme({ windowMode: "inline" });
    if (store.isFullscreen) store.setFullscreen(false);
    if (!store.isOpened) store.open();
    return;
  }
  emit({ ..._state, preset });
}

export function setPreviewFreeSize(size: PreviewSize): void {
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  if (width === _state.freeSize.width && height === _state.freeSize.height) return;
  emit({ ..._state, freeSize: { width, height } });
}

/**
 * Turn the preview off and put the widget back into the window mode it had
 * before. The Free size is kept so re-entering Free picks it up again.
 */
export function resetPreview(): void {
  if (_state.preset === "off") return;
  const restore = _restoreWindowMode;
  _restoreWindowMode = null;
  emit({ ..._state, preset: "off" });
  const store = chatStore.getState();
  if (restore && restore !== "inline" && store.theme.windowMode === "inline") {
    store.setTheme({ windowMode: restore });
  }
}

// Leaving inline mode from elsewhere (Appearance → Window Mode, Appearance
// Reset, a pasted config) ends the preview: the widget can no longer live
// inside the frame. Its new window mode is kept — nothing to restore.
chatStore.subscribe((s) => {
  if (_state.preset === "off") return;
  if ((s.theme.windowMode ?? "popup") !== "inline") {
    _restoreWindowMode = null;
    emit({ ..._state, preset: "off" });
  }
});

// The preview is a desktop tool — on narrow viewports it turns itself off.
window.matchMedia(NARROW_QUERY).addEventListener("change", (e) => {
  if (e.matches) resetPreview();
});
