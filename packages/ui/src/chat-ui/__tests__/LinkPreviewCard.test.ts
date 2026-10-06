import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../LinkPreviewCard";
import type { LinkMetadataFetcher } from "../LinkPreviewCard";
import { $, flush, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Card = LitLike & { url: string; variant: string; metadataFetcher: LinkMetadataFetcher | null };

let seq = 0;
/** Results are cached per URL at module level, so every test uses fresh URLs. */
const freshUrl = (host = "example.com") => `https://${host}/page-${++seq}-${Date.now()}`;

async function render(props: Partial<Card>) {
  const el = await mount<Card>("link-preview-card", props);
  await flush();
  await el.updateComplete;
  return el;
}

describe("LinkPreviewCard", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => {
    resetGlobals();
    delete (window as unknown as Record<string, unknown>).chativaMetadataFetcher;
  });

  it("renders the fetched metadata (image, favicon, domain, title, description)", async () => {
    const url = freshUrl();
    const fetcher = vi.fn().mockResolvedValue({
      title: "Example title",
      description: "Example description",
      image: "https://cdn.test/og.png",
      favicon: "https://cdn.test/fav.ico",
      domain: "example.com",
    });
    const el = await render({ url, metadataFetcher: fetcher });

    expect(fetcher).toHaveBeenCalledWith(url);
    const link = $<HTMLAnchorElement>(el, "a")!;
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect($(el, ".preview-title")!.textContent).toBe("Example title");
    expect($(el, ".preview-desc")!.textContent).toBe("Example description");
    expect($(el, ".preview-image")!.getAttribute("src")).toBe("https://cdn.test/og.png");
    expect($(el, ".preview-domain img")!.getAttribute("src")).toBe("https://cdn.test/fav.ico");
    expect($(el, ".preview-domain span")!.textContent).toBe("example.com");
  });

  it("derives domain and favicon from the URL when metadata omits them", async () => {
    const url = freshUrl("docs.chativa.dev");
    const el = await render({ url, metadataFetcher: vi.fn().mockResolvedValue({}) });
    expect($(el, ".preview-domain span")!.textContent).toBe("docs.chativa.dev");
    expect($(el, ".preview-domain img")!.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=docs.chativa.dev&sz=32",
    );
    expect($(el, ".preview-title")).toBeNull();
    expect($(el, ".preview-desc")).toBeNull();
    expect($(el, ".preview-image")).toBeNull();
  });

  it("shows a loading state while the fetcher is pending", async () => {
    let resolve!: (v: unknown) => void;
    const fetcher = vi.fn(() => new Promise((r) => { resolve = r; })) as unknown as LinkMetadataFetcher;
    const url = freshUrl("slow.test");
    const el = await mount<Card>("link-preview-card", { url, metadataFetcher: fetcher });
    await el.updateComplete;
    expect($(el, ".preview-loading")).not.toBeNull();
    expect($(el, ".preview-loading span")!.textContent).toBe("slow.test");

    resolve({ title: "Done" });
    await flush();
    await el.updateComplete;
    expect($(el, ".preview-loading")).toBeNull();
    expect($(el, ".preview-title")!.textContent).toBe("Done");
  });

  it("falls back to a plain domain link when the fetcher rejects", async () => {
    const url = freshUrl("broken.test");
    const el = await render({ url, metadataFetcher: vi.fn().mockRejectedValue(new Error("nope")) });
    expect($(el, ".preview-fallback")).not.toBeNull();
    expect($(el, ".preview-fallback span")!.textContent).toBe("broken.test");
    expect($(el, ".preview-fallback img")!.getAttribute("src")).toContain("domain=broken.test");
  });

  it("falls back immediately when no fetcher is available", async () => {
    const url = freshUrl("none.test");
    const el = await render({ url });
    expect($(el, ".preview-fallback")).not.toBeNull();
  });

  it("renders the raw string and no favicon for an unparseable URL", async () => {
    const el = await render({ url: "not a url" });
    expect($(el, ".preview-fallback span")!.textContent).toBe("not a url");
    expect($(el, ".preview-fallback img")).toBeNull();
  });

  it("uses window.chativaMetadataFetcher when no fetcher property is set", async () => {
    const globalFetcher = vi.fn().mockResolvedValue({ title: "Global" });
    (window as unknown as Record<string, unknown>).chativaMetadataFetcher = globalFetcher;
    const el = await render({ url: freshUrl() });
    expect(globalFetcher).toHaveBeenCalledTimes(1);
    expect($(el, ".preview-title")!.textContent).toBe("Global");
  });

  it("caches metadata per URL so a second card does not fetch again", async () => {
    const url = freshUrl();
    const fetcher = vi.fn().mockResolvedValue({ title: "Cached" });
    await render({ url, metadataFetcher: fetcher });
    const second = await render({ url, metadataFetcher: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect($(second, ".preview-title")!.textContent).toBe("Cached");
  });

  it("re-fetches when the url property changes", async () => {
    const fetcher = vi.fn().mockImplementation(async (u: string) => ({ title: u.split("/").pop() }));
    const el = await render({ url: freshUrl(), metadataFetcher: fetcher });
    const next = freshUrl();
    el.url = next;
    await el.updateComplete;
    await flush();
    await el.updateComplete;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect($(el, ".preview-title")!.textContent).toBe(next.split("/").pop());
  });

  it("does nothing without a url", async () => {
    const fetcher = vi.fn();
    await render({ metadataFetcher: fetcher as unknown as LinkMetadataFetcher });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
