import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  type ApplicationConfig,
} from "@angular/core";
import { provideChativa } from "@chativa/angular";
import { DummyConnector } from "@chativa/connector-dummy";

/**
 * One connector instance for the whole app. `connectDelay: 0` skips
 * DummyConnector's default 2s fake handshake.
 */
export const dummy = new DummyConnector({ replyDelay: 500, connectDelay: 0 });

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No Zone.js in this app (it is not in package.json or angular.json) —
    // the wrappers call `markForCheck()` themselves, so everything below
    // updates without it.
    provideZonelessChangeDetection(),
    // Registers + activates the connector and applies the theme before any
    // <chativa-chat-iva> renders — the Angular equivalent of
    // `window.chativaSettings`.
    provideChativa({
      connector: dummy,
      theme: {
        colors: { primary: "#dd0031", secondary: "#c3002f" },
        // Hide the (custom) launcher while the panel is open.
        hideButtonOnOpen: true,
      },
    }),
  ],
};
