import type { IExtension, ExtensionContext } from "../../domain/ports/IExtension";
import type { IncomingMessage } from "../../domain/entities/Message";

const URL_REGEX = /https?:\/\/[^\s<>\]'"()]+/gi;

export type PreviewVariant = "compact" | "expanded";

export interface LinkPreviewExtensionOptions {
  urlExtractor?: (text: string) => string[];
  maxUrlsPerMessage?: number;
  defaultVariant?: PreviewVariant;
}

function defaultUrlExtractor(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

export class LinkPreviewExtension implements IExtension {
  readonly name = "link-preview";
  readonly version = "1.0.0";

  private readonly _extractor: (text: string) => string[];
  private readonly _maxUrls: number;
  private readonly _defaultVariant: PreviewVariant;

  constructor(options: LinkPreviewExtensionOptions = {}) {
    this._extractor = options.urlExtractor ?? defaultUrlExtractor;
    this._maxUrls = options.maxUrlsPerMessage ?? 3;
    this._defaultVariant = options.defaultVariant ?? "compact";
  }

  install(context: ExtensionContext): void {
    context.onAfterReceive((msg: IncomingMessage) => {
      if (msg.type !== "text") return msg;

      const preview = msg.data?.preview;
      if (preview === false) return msg;

      const text = String(msg.data?.text ?? "");
      if (!text) return msg;

      let urls = this._extractor(text);
      if (urls.length === 0) return msg;

      if (urls.length > this._maxUrls) {
        urls = urls.slice(0, this._maxUrls);
      }

      const variant: PreviewVariant =
        preview === "expanded" ? "expanded" : this._defaultVariant;

      return {
        ...msg,
        data: { ...msg.data, urls, previewVariant: variant },
      };
    });
  }

  uninstall(): void {}
}
