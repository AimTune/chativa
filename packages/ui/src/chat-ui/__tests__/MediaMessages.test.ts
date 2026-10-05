/**
 * Behaviour tests for the built-in rich message types: image, video, file,
 * card and carousel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageTypeRegistry } from "@chativa/core";
import { ImageMessage } from "../ImageMessage";
import { VideoMessage } from "../VideoMessage";
import { FileMessage } from "../FileMessage";
import { CardMessage } from "../CardMessage";
import { CarouselMessage } from "../CarouselMessage";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Msg = LitLike & {
  messageData: Record<string, unknown>;
  sender: "bot" | "user";
  timestamp: number;
  hideAvatar: boolean;
};

const TS = new Date(2024, 4, 2, 14, 30).getTime();
const TIME = new Date(TS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

let openSpy: ReturnType<typeof vi.spyOn>;
let actions: unknown[];
const onAction = (e: Event) => actions.push((e as CustomEvent).detail);

beforeEach(() => {
  resetGlobals();
  actions = [];
  document.addEventListener("chat-action", onAction);
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  document.removeEventListener("chat-action", onAction);
  openSpy.mockRestore();
  resetGlobals();
});

describe("message type registration", () => {
  it.each([
    ["image", ImageMessage],
    ["video", VideoMessage],
    ["file", FileMessage],
    ["card", CardMessage],
    ["carousel", CarouselMessage],
  ])("registers %s", (type, ctor) => {
    expect(MessageTypeRegistry.resolve(type)).toBe(ctor);
  });
});

describe("shared bubble chrome", () => {
  it.each(["image-message", "video-message", "file-message", "card-message", "carousel-message"])(
    "%s: bot gets an avatar (hideable), user does not; time only with a timestamp",
    async (tag) => {
      const bot = await mount<Msg>(tag, { messageData: {}, timestamp: TS });
      expect($(bot, ".message")!.classList.contains("bot")).toBe(true);
      expect($(bot, ".avatar")).not.toBeNull();
      expect($(bot, ".avatar")!.classList.contains("hidden")).toBe(false);
      expect($(bot, ".time")!.textContent).toBe(TIME);

      const hidden = await mount<Msg>(tag, { messageData: {}, hideAvatar: true });
      expect($(hidden, ".avatar")!.classList.contains("hidden")).toBe(true);
      expect($(hidden, ".time")).toBeNull();

      const user = await mount<Msg>(tag, { messageData: {}, sender: "user" });
      expect($(user, ".message")!.classList.contains("user")).toBe(true);
      expect($(user, ".avatar")).toBeNull();
    },
  );
});

describe("ImageMessage", () => {
  it("shows a skeleton until the image loads, then reveals it", async () => {
    const el = await mount<Msg>("image-message", {
      messageData: { src: "https://img.test/a.png", alt: "A cat", caption: "My cat" },
    });
    const img = $<HTMLImageElement>(el, "img")!;
    expect(img.getAttribute("src")).toBe("https://img.test/a.png");
    expect(img.getAttribute("alt")).toBe("A cat");
    expect(img.classList.contains("loading")).toBe(true);
    expect($(el, ".skeleton")).not.toBeNull();
    expect($(el, ".caption")!.textContent).toBe("My cat");
    expect($(el, ".image-wrap")!.getAttribute("title")).toBe("A cat");

    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect($(el, ".skeleton")).toBeNull();
    expect($(el, "img")!.classList.contains("loading")).toBe(false);
  });

  it("opens the full image in a new tab on click", async () => {
    const el = await mount<Msg>("image-message", { messageData: { src: "https://img.test/b.png" } });
    $(el, ".image-wrap")!.click();
    expect(openSpy).toHaveBeenCalledWith("https://img.test/b.png", "_blank");
  });

  it("does nothing on click without a src and has no caption", async () => {
    const el = await mount<Msg>("image-message", { messageData: {} });
    $(el, ".image-wrap")!.click();
    expect(openSpy).not.toHaveBeenCalled();
    expect($(el, ".caption")).toBeNull();
    expect($(el, ".image-wrap")!.getAttribute("title")).toBe("image");
  });
});

describe("VideoMessage", () => {
  it("renders a native player with src, poster and caption", async () => {
    const el = await mount<Msg>("video-message", {
      messageData: { src: "https://v.test/a.mp4", poster: "https://v.test/p.jpg", caption: "Clip" },
    });
    const video = $<HTMLVideoElement>(el, "video")!;
    expect(video.getAttribute("src")).toBe("https://v.test/a.mp4");
    expect(video.getAttribute("poster")).toBe("https://v.test/p.jpg");
    expect(video.hasAttribute("controls")).toBe(true);
    expect($(el, ".caption")!.textContent).toBe("Clip");
  });

  it("omits poster and caption when not provided", async () => {
    const el = await mount<Msg>("video-message", { messageData: { src: "https://v.test/b.mp4" } });
    expect($(el, "video")!.getAttribute("poster")).toBe("");
    expect($(el, ".caption")).toBeNull();
  });
});

describe("FileMessage", () => {
  it("renders a download link with the file name and formatted size", async () => {
    const el = await mount<Msg>("file-message", {
      messageData: { url: "https://f.test/r.pdf", name: "report.pdf", size: 2048, mimeType: "application/pdf" },
    });
    const a = $<HTMLAnchorElement>(el, "a.file-card")!;
    expect(a.getAttribute("href")).toBe("https://f.test/r.pdf");
    expect(a.getAttribute("download")).toBe("report.pdf");
    expect($(el, ".file-name")!.textContent).toBe("report.pdf");
    expect($(el, ".file-meta")!.textContent).toBe("2.0 KB");
    expect($(el, ".file-icon svg")).not.toBeNull();
  });

  it("falls back to placeholders when url / name / size are missing", async () => {
    const el = await mount<Msg>("file-message", { messageData: {} });
    expect($(el, "a.file-card")!.getAttribute("href")).toBe("#");
    expect($(el, ".file-name")!.textContent).toBe("file");
    expect($(el, ".file-meta")!.textContent).toBe("Download");
  });

  it.each([
    [500, "500 B"],
    [1536, "1.5 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
    [3 * 1024 * 1024 * 1024, "3.0 GB"],
  ])("formats %d bytes as %s", async (size, label) => {
    const el = await mount<Msg>("file-message", { messageData: { name: "x.bin", size } });
    expect($(el, ".file-meta")!.textContent).toBe(label);
  });

  it.each([
    ["doc.pdf", "", "#dc2626"],
    ["pic.PNG", "", "#0284c7"],
    ["clip", "video/mp4", "#7c3aed"],
    ["song.mp3", "", "#db2777"],
    ["bundle.zip", "", "#ea580c"],
    ["data.csv", "", "#16a34a"],
    ["deck.pptx", "", "#ea580c"],
    ["letter.docx", "", "#0284c7"],
    ["notes.txt", "text/plain", "#64748b"],
  ])("picks a type-specific icon for %s (%s)", async (name, mimeType, color) => {
    const el = await mount<Msg>("file-message", { messageData: { name, mimeType } });
    expect($(el, ".file-icon path")!.getAttribute("fill")).toBe(color);
  });
});

describe("CardMessage", () => {
  const data = {
    image: "https://c.test/hero.png",
    title: "Hero",
    subtitle: "Sub",
    buttons: [
      { label: "Docs", url: "https://docs.test" },
      { label: "Buy", value: "/buy" },
      { label: "Hi" },
    ],
  };

  it("renders image (with skeleton until loaded), title, subtitle and buttons", async () => {
    const el = await mount<Msg>("card-message", { messageData: data });
    expect($(el, ".card-title")!.textContent).toBe("Hero");
    expect($(el, ".card-subtitle")!.textContent).toBe("Sub");
    expect($(el, ".card-image")!.getAttribute("alt")).toBe("Hero");
    expect($(el, ".card-image-skeleton")).not.toBeNull();
    expect($$(el, ".card-btn").map((b) => b.textContent)).toEqual(["Docs", "Buy", "Hi"]);

    $(el, ".card-image")!.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect($(el, ".card-image-skeleton")).toBeNull();
  });

  it("url buttons open a new tab; others dispatch chat-action with value or label", async () => {
    const el = await mount<Msg>("card-message", { messageData: data });
    const [docs, buy, hi] = $$(el, ".card-btn");
    docs.click();
    expect(openSpy).toHaveBeenCalledWith("https://docs.test", "_blank", "noopener");
    expect(actions).toEqual([]);
    buy.click();
    hi.click();
    expect(actions).toEqual(["/buy", "Hi"]);
  });

  it("omits optional parts", async () => {
    const el = await mount<Msg>("card-message", { messageData: { title: "Only" } });
    expect($(el, ".card-image")).toBeNull();
    expect($(el, ".card-subtitle")).toBeNull();
    expect($(el, ".card-actions")).toBeNull();
  });
});

describe("CarouselMessage", () => {
  const cards = [
    { title: "One", image: "https://c.test/1.png", subtitle: "first", buttons: [{ label: "Pick 1", value: "p1" }] },
    { title: "Two", buttons: [{ label: "Open", url: "https://two.test" }] },
    { title: "Three" },
  ];

  let scrollTo: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scrollTo = vi.fn();
    (HTMLElement.prototype as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
  });

  it("renders a card per entry and dot indicators", async () => {
    const el = await mount<Msg>("carousel-message", { messageData: { cards } });
    expect($$(el, ".card-title").map((c) => c.textContent)).toEqual(["One", "Two", "Three"]);
    expect($$(el, ".card-subtitle")).toHaveLength(1);
    expect($$(el, ".dot")).toHaveLength(3);
    expect($$(el, ".dot")[0].classList.contains("active")).toBe(true);
  });

  it("disables prev at the start and navigates with next / dots", async () => {
    const el = await mount<Msg>("carousel-message", { messageData: { cards } });
    const [prev, next] = $$<HTMLButtonElement>(el, ".nav-btn");
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    await el.updateComplete;
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect($$(el, ".dot")[1].classList.contains("active")).toBe(true);
    expect($$<HTMLButtonElement>(el, ".nav-btn")[0].disabled).toBe(false);

    $$(el, ".dot")[2].click();
    await el.updateComplete;
    expect($$(el, ".dot")[2].classList.contains("active")).toBe(true);
    expect($$<HTMLButtonElement>(el, ".nav-btn")[1].disabled).toBe(true);

    $$(el, ".nav-btn")[0].click();
    await el.updateComplete;
    expect($$(el, ".dot")[1].classList.contains("active")).toBe(true);
  });

  it("ignores navigation to an index outside the card list", async () => {
    const el = await mount<Msg>("carousel-message", { messageData: { cards } });
    (el as unknown as { _scrollTo(i: number): void })._scrollTo(10);
    await el.updateComplete;
    expect(scrollTo).not.toHaveBeenCalled();
    expect($$(el, ".dot")[0].classList.contains("active")).toBe(true);
  });

  it("card buttons dispatch chat-action or open urls", async () => {
    const el = await mount<Msg>("carousel-message", { messageData: { cards } });
    const [pick, open] = $$(el, ".card-btn");
    pick.click();
    open.click();
    expect(actions).toEqual(["p1"]);
    expect(openSpy).toHaveBeenCalledWith("https://two.test", "_blank", "noopener");
  });

  it("swaps the image skeleton for the image once it loads", async () => {
    const el = await mount<Msg>("carousel-message", { messageData: { cards } });
    expect($$(el, ".card-image-skeleton")).toHaveLength(1);
    $(el, ".card-image")!.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect($$(el, ".card-image-skeleton")).toHaveLength(0);
  });

  it("hides dots for a single card and handles an empty list", async () => {
    const single = await mount<Msg>("carousel-message", { messageData: { cards: [{ title: "Solo" }] } });
    expect($(single, ".dots")).toBeNull();
    expect($$<HTMLButtonElement>(single, ".nav-btn").every((b) => b.disabled)).toBe(true);

    const empty = await mount<Msg>("carousel-message", { messageData: {} });
    expect($$(empty, ".card")).toHaveLength(0);
  });
});
