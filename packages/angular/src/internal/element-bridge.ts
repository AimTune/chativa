/**
 * Glue between an Angular wrapper and the custom element it renders.
 *
 * Property writes and DOM listeners can arrive before the element exists
 * (inputs are set before the wrapper's view is created, and the element is
 * only rendered once `@chativa/ui` has loaded). The bridge remembers both and
 * replays them onto the element as soon as it is attached, then keeps
 * writing straight through. Values are always assigned as DOM **properties**,
 * never attributes, so objects and booleans reach the Lit element intact.
 */
export class ElementBridge<E extends HTMLElement = HTMLElement> {
  private el: E | null = null;
  private readonly props = new Map<string, unknown>();
  private readonly listeners: Array<[string, EventListener]> = [];

  /** The currently attached element, if any. */
  get element(): E | null {
    return this.el;
  }

  /** Assign a DOM property now (if attached) and on every future attach. */
  setProperty(name: string, value: unknown): void {
    this.props.set(name, value);
    if (this.el) (this.el as unknown as Record<string, unknown>)[name] = value;
  }

  /** Add a DOM event listener now (if attached) and on every future attach. */
  listen(type: string, listener: EventListener): void {
    this.listeners.push([type, listener]);
    this.el?.addEventListener(type, listener);
  }

  attach(el: E | null): void {
    if (el === this.el) return;
    this.detach();
    if (!el) return;
    this.el = el;
    const target = el as unknown as Record<string, unknown>;
    this.props.forEach((value, name) => {
      target[name] = value;
    });
    this.listeners.forEach(([type, listener]) => el.addEventListener(type, listener));
  }

  /** Remove every listener from the current element and forget it. */
  detach(): void {
    const el = this.el;
    if (!el) return;
    this.listeners.forEach(([type, listener]) => el.removeEventListener(type, listener));
    this.el = null;
  }

  destroy(): void {
    this.detach();
    this.listeners.length = 0;
    this.props.clear();
  }
}
