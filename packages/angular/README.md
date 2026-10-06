# @chativa/angular

Angular 16+ wrapper for the [Chativa](https://github.com/AimTune/chativa) chat widget — standalone components with typed inputs and outputs, an `NgModule`, and a `ChativaService` for runtime connector and extension registration.

```bash
npm install @chativa/angular @chativa/core @chativa/ui @chativa/connector-dummy
```

```ts
import { Component } from "@angular/core";
import { ChatIvaComponent, ChatBotButtonComponent, type IncomingMessage } from "@chativa/angular";
import { DummyConnector } from "@chativa/connector-dummy";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [ChatIvaComponent, ChatBotButtonComponent],
  template: `
    <chativa-chat-iva [connector]="dummy" (message)="onMessage($event)" />
    <chativa-chat-bot-button />
  `,
})
export class AppComponent {
  readonly dummy = new DummyConnector();
  onMessage(message: IncomingMessage) {
    console.log(message);
  }
}
```

Works with Zone.js and zoneless change detection, and with AOT/SSR builds (the widget only renders in the browser).

Full documentation: https://chativa.aimtune.dev/angular
