"use client";

import * as React from "react";

/**
 * Wraps an async `load()` — a dynamic `import()` of the LitElement module
 * plus `@lit/react`'s `createComponent()` — into a React component that
 * mounts once that module has resolved on the client.
 *
 * Renders `null` until then, including for the entire server render: `load`
 * only ever runs inside `useEffect`, which React never executes during SSR.
 * That keeps this package free of `window`/`document`/`customElements`
 * references at module-evaluation time, so it builds cleanly with `next
 * build` and `vite build` and is safe to import from a Server Component
 * tree (the actual widget still only renders client-side).
 */
export function createLazyElementComponent<P extends object, E extends Element = HTMLElement>(
  load: () => Promise<React.ComponentType<P & React.RefAttributes<E>>>,
  displayName: string,
): React.ComponentType<P & React.RefAttributes<E>> {
  const LazyElement = React.forwardRef<E, P>(function LazyElement(props, ref) {
    const [Component, setComponent] = React.useState<React.ComponentType<
      P & React.RefAttributes<E>
    > | null>(null);

    React.useEffect(() => {
      let cancelled = false;
      load().then((Loaded) => {
        if (!cancelled) setComponent(() => Loaded);
      });
      return () => {
        cancelled = true;
      };
    }, []);

    if (!Component) return null;
    return <Component {...(props as P)} ref={ref} />;
  });

  LazyElement.displayName = displayName;
  return LazyElement as unknown as React.ComponentType<P & React.RefAttributes<E>>;
}
