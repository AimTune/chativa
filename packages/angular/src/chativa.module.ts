import { NgModule, type ModuleWithProviders } from "@angular/core";
import { ChatIvaComponent } from "./chat-iva.component";
import { ChatBotButtonComponent } from "./chat-bot-button.component";
import { GenUIMessageComponent } from "./genui-message.component";
import { provideChativa } from "./provide-chativa";
import type { ChativaConfig } from "./chativa.service";

const COMPONENTS = [ChatIvaComponent, ChatBotButtonComponent, GenUIMessageComponent];

/**
 * NgModule entry point for apps that still use modules. It imports and
 * re-exports the standalone wrapper components — the standalone classes can
 * be imported directly instead.
 *
 * @example
 * ```ts
 * @NgModule({ imports: [BrowserModule, ChativaModule.forRoot({ connector: "dummy" })] })
 * export class AppModule {}
 * ```
 */
@NgModule({
  imports: COMPONENTS,
  exports: COMPONENTS,
})
export class ChativaModule {
  /** Import once in the root module to apply a {@link ChativaConfig} at startup. */
  static forRoot(config: ChativaConfig = {}): ModuleWithProviders<ChativaModule> {
    return { ngModule: ChativaModule, providers: [provideChativa(config)] };
  }
}
