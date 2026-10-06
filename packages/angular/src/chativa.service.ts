import { Injectable, type OnDestroy } from "@angular/core";
import {
  ConnectorRegistry,
  EventBus,
  ExtensionRegistry,
  chatStore,
  i18next,
  type DeepPartial,
  type EventBusEventName,
  type EventBusPayloadMap,
  type IConnector,
  type IExtension,
  type ThemeConfig,
} from "@chativa/core";
import { resolveConnectorName } from "./internal/resolve-connector";

/**
 * App-wide Chativa configuration — the Angular equivalent of setting
 * `window.chativaSettings` before `<chat-iva>` connects. Accepted by
 * `provideChativa()`, `ChativaModule.forRoot()` and `ChativaService.configure()`.
 */
export interface ChativaConfig {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and activate as the default. */
  connector?: string | IConnector;
  /** Extensions to install once (already-installed names are skipped). */
  extensions?: IExtension[];
  /** Theme overrides, deep-merged over the default theme. */
  theme?: DeepPartial<ThemeConfig>;
  /** Initial locale override (e.g. `"tr"`, `"en"`), skipping browser detection. */
  locale?: string;
  /** Flat i18n translation overrides, applied to every registered language. */
  i18n?: Record<string, unknown>;
}

/**
 * Runtime access to Chativa's registries and stores from Angular code:
 * register/activate connectors, install extensions, change theme and locale,
 * open/close the panel and subscribe to `EventBus` events.
 *
 * Every method is a thin, typed call into the `@chativa/core` singletons that
 * `<chat-iva>` itself reads — there is no parallel Angular-side state. Event
 * subscriptions made through {@link on} and the i18n listeners installed by
 * {@link setTranslations} are torn down when the injector is destroyed.
 */
@Injectable({ providedIn: "root" })
export class ChativaService implements OnDestroy {
  private readonly cleanups = new Set<() => void>();
  private translationsCleanup: (() => void) | null = null;
  private localeCleanup: (() => void) | null = null;

  /** Apply a whole {@link ChativaConfig} at once. */
  configure(config: ChativaConfig): void {
    if (config.connector !== undefined) this.useConnector(config.connector);
    config.extensions?.forEach((extension) => this.installExtension(extension));
    if (config.theme) this.setTheme(config.theme);
    if (config.locale) this.setLocale(config.locale);
    if (config.i18n) this.setTranslations(config.i18n);
  }

  // ── Connectors ─────────────────────────────────────────────────────────────

  /** Register a connector instance. Idempotent — an already-registered name is left as is. */
  registerConnector(connector: IConnector): void {
    if (!ConnectorRegistry.has(connector.name)) ConnectorRegistry.register(connector);
  }

  /** Remove a connector from `ConnectorRegistry`. */
  unregisterConnector(name: string): void {
    ConnectorRegistry.unregister(name);
  }

  /**
   * Make a connector the active one (registering an instance first).
   * Takes effect for `<chat-iva>` elements that connect afterwards.
   * @returns the connector name.
   */
  useConnector(connector: string | IConnector): string {
    const name = resolveConnectorName(connector) as string;
    if (chatStore.getState().activeConnector !== name) chatStore.getState().setConnector(name);
    return name;
  }

  /** Name of the currently active connector. */
  get activeConnector(): string {
    return chatStore.getState().activeConnector;
  }

  /** Names of every registered connector. */
  listConnectors(): string[] {
    return ConnectorRegistry.list();
  }

  // ── Extensions ─────────────────────────────────────────────────────────────

  /** Install an extension. Idempotent — an already-installed name is skipped. */
  installExtension(extension: IExtension): void {
    if (!ExtensionRegistry.has(extension.name)) ExtensionRegistry.install(extension);
  }

  uninstallExtension(name: string): void {
    ExtensionRegistry.uninstall(name);
  }

  listExtensions(): string[] {
    return ExtensionRegistry.list();
  }

  // ── Theme, locale, translations ────────────────────────────────────────────

  /** Deep-merge theme overrides over the current theme. */
  setTheme(theme: DeepPartial<ThemeConfig>): void {
    chatStore.getState().setTheme(theme);
  }

  /**
   * Switch the widget language. If i18next is not initialised yet (it is
   * initialised by `@chativa/ui`, which the wrappers load lazily), the switch
   * is applied as soon as it is.
   */
  setLocale(locale: string): void {
    this.localeCleanup?.();
    this.localeCleanup = null;
    const apply = () => {
      void i18next.changeLanguage(locale);
    };
    if (i18next.isInitialized) {
      apply();
      return;
    }
    const once = () => {
      i18next.off("initialized", once);
      this.localeCleanup = null;
      apply();
    };
    i18next.on("initialized", once);
    this.localeCleanup = () => i18next.off("initialized", once);
  }

  /**
   * Flat translation overrides applied on top of every registered language,
   * and re-applied on language switches. Replaces the previous overrides set
   * through this method.
   */
  setTranslations(overrides: Record<string, unknown>): void {
    this.translationsCleanup?.();
    const applyToLng = (lng: string) => {
      i18next.addResourceBundle(lng, "translation", overrides, true, true);
    };
    const applyToAll = () => Object.keys(i18next.store.data).forEach(applyToLng);
    if (i18next.isInitialized) applyToAll();
    else i18next.on("initialized", applyToAll);
    i18next.on("languageChanged", applyToLng);
    this.translationsCleanup = () => {
      i18next.off("initialized", applyToAll);
      i18next.off("languageChanged", applyToLng);
    };
  }

  // ── Panel state ────────────────────────────────────────────────────────────

  open(): void {
    chatStore.getState().open();
  }

  close(): void {
    chatStore.getState().close();
  }

  toggle(): void {
    chatStore.getState().toggle();
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a Chativa `EventBus` event. Returns an unsubscribe function;
   * any subscription still active is removed when the injector is destroyed.
   *
   * The handler is a plain callback, not an Angular output: if it changes
   * template state in a zoneless or `OnPush` component, set a signal or call
   * `markForCheck()` so the view updates.
   */
  on<K extends EventBusEventName>(
    event: K,
    handler: (payload: EventBusPayloadMap[K]) => void,
  ): () => void {
    EventBus.on(event, handler);
    const off = () => {
      EventBus.off(event, handler);
      this.cleanups.delete(off);
    };
    this.cleanups.add(off);
    return off;
  }

  ngOnDestroy(): void {
    [...this.cleanups].forEach((off) => off());
    this.translationsCleanup?.();
    this.translationsCleanup = null;
    this.localeCleanup?.();
    this.localeCleanup = null;
  }
}
