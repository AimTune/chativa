import {
  defineGenUIComponent,
  genUIDefinitionStore,
  type GenUIComponentDefinition,
} from "@chativa/core";
import { GenUIRegistry } from "./GenUIRegistry";

/** Names that came from the server, so a catalog can replace its own earlier version. */
const _fromServer = new Set<string>();

/**
 * Who wins when a server definition names a component the app already registered.
 *
 * - `"app-wins"` (default) — the local component stays. A backend must not be
 *   able to redefine `genui-form`, or the checkout widget you shipped, under
 *   your feet.
 * - `"server-wins"` — the definition replaces the local registration. Choose
 *   this when the server is the source of truth for widgets and the local
 *   registrations are only fallbacks.
 */
export type ServerComponentPolicy = "app-wins" | "server-wins";

let _policy: ServerComponentPolicy = "app-wins";

/**
 * Decide what happens on a name collision. Call before connecting.
 *
 * @example
 * ```ts
 * import { setServerComponentPolicy } from "@chativa/genui";
 *
 * setServerComponentPolicy("server-wins");
 * ```
 */
export function setServerComponentPolicy(policy: ServerComponentPolicy): void {
  _policy = policy;
}

/** The policy in force. */
export function getServerComponentPolicy(): ServerComponentPolicy {
  return _policy;
}

/**
 * Register one server-defined component.
 *
 * A definition always replaces an earlier definition of the same name from the
 * server itself (a new version of the same widget). A collision with a *local*
 * registration is resolved by {@link setServerComponentPolicy}.
 *
 * @returns whether the component was registered.
 */
export function registerServerComponent(definition: GenUIComponentDefinition): boolean {
  const { name } = definition;
  if (!name || typeof definition.template !== "string") return false;

  const collidesWithLocal = GenUIRegistry.has(name) && !_fromServer.has(name);
  if (collidesWithLocal && _policy === "app-wins") {
    // Silence here is the worst outcome: the local component renders with the
    // server's props, which it was never written for, and the widget comes out
    // blank. Say exactly what happened and what the two ways out are.
    console.warn(
      `[GenUI] The server defines a component named "${name}", but "${name}" is already ` +
        `registered locally — keeping the local one (policy: "app-wins").\n` +
        `  • the widget will render with the SERVER's props, which the local component may not expect\n` +
        `  • to let the server win:  setServerComponentPolicy("server-wins")\n` +
        `  • or rename one of them so both can coexist.`
    );
    return false;
  }

  GenUIRegistry.register(name, defineGenUIComponent(definition) as unknown as typeof HTMLElement);
  _fromServer.add(name);
  return true;
}

/**
 * Subscribe the registry to server-announced component catalogs.
 *
 * Called once as a side-effect of importing `@chativa/genui`. Subscribing
 * replays whatever the connector already published, so it doesn't matter
 * whether the socket connected before or after this bundle loaded.
 *
 * @returns an unsubscribe function (tests; apps never need it).
 */
export function subscribeServerComponents(): () => void {
  return genUIDefinitionStore.subscribe((definitions) => {
    for (const definition of definitions) registerServerComponent(definition);
  });
}

/** Forget which names came from the server, and reset the policy — tests only. */
export function clearServerComponents(): void {
  for (const name of _fromServer) GenUIRegistry.unregister(name);
  _fromServer.clear();
  _policy = "app-wins";
}
