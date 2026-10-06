import {
  ENVIRONMENT_INITIALIZER,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from "@angular/core";
import { ChativaService, type ChativaConfig } from "./chativa.service";

/** The config passed to `provideChativa()` / `ChativaModule.forRoot()`. */
export const CHATIVA_CONFIG = new InjectionToken<ChativaConfig>("CHATIVA_CONFIG");

/**
 * Register a connector, install extensions and apply theme/locale/i18n
 * overrides when the application (or route) injector is created — i.e.
 * before any `<chativa-chat-iva>` renders.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideChativa({ connector: new DummyConnector() })],
 * });
 * ```
 */
export function provideChativa(config: ChativaConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: CHATIVA_CONFIG, useValue: config },
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(ChativaService).configure(inject(CHATIVA_CONFIG)),
    },
  ]);
}
