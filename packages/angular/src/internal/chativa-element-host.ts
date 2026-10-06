import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  inject,
  type EventEmitter,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { ElementBridge } from "./element-bridge";
import { loadChativaUi } from "./load-chativa-ui";

/**
 * Shared base for the wrapper components. Each subclass renders its custom
 * element as `<tag #el *ngIf="loaded">` so the element is only created once
 * `@chativa/ui` has registered it — on the browser platform only, which
 * keeps the wrappers safe to render during Angular SSR.
 *
 * Nothing here depends on Zone.js: every state change that the template
 * reads, and every output emission, is followed by `markForCheck()`, which
 * schedules change detection under zoneless (Angular 18+) as well as under
 * `OnPush` + Zone.js.
 */
@Directive()
export abstract class ChativaElementHost<E extends HTMLElement = HTMLElement>
  implements OnInit, OnDestroy
{
  /** `true` once `@chativa/ui` has loaded and the custom element is rendered. */
  loaded = false;

  protected readonly bridge = new ElementBridge<E>();
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private destroyed = false;

  /** The underlying custom element (`null` until loaded, and during SSR). */
  get element(): E | null {
    return this.bridge.element;
  }

  @ViewChild("el")
  set elementRef(ref: ElementRef<E> | undefined) {
    this.bridge.attach(ref?.nativeElement ?? null);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    void loadChativaUi().then(() => {
      if (this.destroyed) return;
      this.loaded = true;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.bridge.destroy();
  }

  /** Emit an output and make sure the change is picked up without Zone.js. */
  protected emit<T>(output: EventEmitter<T>, value: T): void {
    output.emit(value);
    this.cdr.markForCheck();
  }

  /** Wire a DOM `CustomEvent` on the element to an output's `detail`. */
  protected forwardDomEvent<T>(type: string, output: EventEmitter<T>): void {
    this.bridge.listen(type, (event) => this.emit(output, (event as CustomEvent<T>).detail));
  }
}
