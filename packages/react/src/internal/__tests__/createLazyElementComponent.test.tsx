import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { createLazyElementComponent } from "../createLazyElementComponent";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface Props {
  label?: string;
}

type Loaded = React.ComponentType<Props & React.RefAttributes<HTMLDivElement>>;

const Real = React.forwardRef<HTMLDivElement, Props>(function Real({ label }, ref) {
  return <div data-testid="real" ref={ref}>{label}</div>;
});

/** A load() whose resolution the test controls. */
function deferredLoad() {
  let resolve!: (c: Loaded) => void;
  const promise = new Promise<Loaded>((r) => {
    resolve = r;
  });
  const load = vi.fn(() => promise);
  return { load, resolve: () => resolve(Real) };
}

describe("createLazyElementComponent", () => {
  it("sets the display name", () => {
    const Lazy = createLazyElementComponent<Props, HTMLDivElement>(deferredLoad().load, "LazyThing");
    expect(Lazy.displayName).toBe("LazyThing");
  });

  it("renders nothing until load() resolves, then renders the loaded component with props", async () => {
    const { load, resolve } = deferredLoad();
    const Lazy = createLazyElementComponent<Props, HTMLDivElement>(load, "Lazy");

    const { container, getByTestId } = render(<Lazy label="hello" />);
    expect(container.innerHTML).toBe("");
    expect(load).toHaveBeenCalledOnce();

    await act(async () => resolve());

    expect(getByTestId("real").textContent).toBe("hello");
  });

  it("forwards the ref to the loaded element", async () => {
    const { load, resolve } = deferredLoad();
    const Lazy = createLazyElementComponent<Props, HTMLDivElement>(load, "Lazy");
    const ref = React.createRef<HTMLDivElement>();

    render(<Lazy ref={ref} />);
    await act(async () => resolve());

    await waitFor(() => expect(ref.current).toBeInstanceOf(HTMLDivElement));
  });

  it("does not update state when unmounted before load() resolves", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { load, resolve } = deferredLoad();
    const Lazy = createLazyElementComponent<Props, HTMLDivElement>(load, "Lazy");

    const { unmount, container } = render(<Lazy />);
    unmount();
    await act(async () => resolve());

    expect(container.innerHTML).toBe("");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("re-renders the loaded component when props change, without reloading", async () => {
    const { load, resolve } = deferredLoad();
    const Lazy = createLazyElementComponent<Props, HTMLDivElement>(load, "Lazy");

    const { rerender, getByTestId } = render(<Lazy label="a" />);
    await act(async () => resolve());
    rerender(<Lazy label="b" />);

    expect(getByTestId("real").textContent).toBe("b");
    expect(load).toHaveBeenCalledOnce();
  });
});
