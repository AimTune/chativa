/**
 * Pure mapping functions that convert DirectLine activities
 * into Chativa IncomingMessage structures.
 *
 * No side-effects — all functions are stateless and easily testable.
 */

import type {
  Activity,
  Message,
  CardAction,
  Attachment,
  HeroCard,
  Thumbnail,
  Signin,
  Receipt,
  AudioCard,
  VideoCard,
  AnimationCard,
  AdaptiveCard,
  FlexCard,
} from "botframework-directlinejs";
import type { IncomingMessage, MessageAction } from "@chativa/core";

/* ------------------------------------------------------------------ */
/*  Sentinel returned for typing activities                           */
/* ------------------------------------------------------------------ */

export const TYPING_SENTINEL = Symbol("typing");
export type MapResult = IncomingMessage | typeof TYPING_SENTINEL | null;

/* ------------------------------------------------------------------ */
/*  Content-type constants                                            */
/* ------------------------------------------------------------------ */

const CT_HERO = "application/vnd.microsoft.card.hero";
const CT_THUMBNAIL = "application/vnd.microsoft.card.thumbnail";
const CT_ADAPTIVE = "application/vnd.microsoft.card.adaptive";
const CT_SIGNIN = "application/vnd.microsoft.card.signin";
const CT_OAUTH = "application/vnd.microsoft.card.oauth";
const CT_RECEIPT = "application/vnd.microsoft.card.receipt";
const CT_AUDIO = "application/vnd.microsoft.card.audio";
const CT_VIDEO = "application/vnd.microsoft.card.video";
const CT_ANIMATION = "application/vnd.microsoft.card.animation";
const CT_FLEX = "application/vnd.microsoft.card.flex";

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Convert a DirectLine Activity into a Chativa IncomingMessage.
 *
 * Returns:
 * - `IncomingMessage` for renderable messages
 * - `TYPING_SENTINEL` for typing indicators (handled by the connector)
 * - `null` for activities that should be ignored (echo, events, etc.)
 */
export function mapActivityToMessage(
  activity: Activity,
  userId: string,
): MapResult {
  // Filter out echoed user messages
  if (activity.from.id === userId) return null;

  // Typing indicator
  if (activity.type === "typing") return TYPING_SENTINEL;

  // Only process message activities
  if (activity.type !== "message") return null;

  const msg = activity as Message;
  const id = msg.id ?? `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();

  // Map suggested actions (may be used as top-level actions or as quick-reply)
  const suggestedActions = mapSuggestedActions(msg);

  // If there are attachments, process them
  if (msg.attachments && msg.attachments.length > 0) {
    const result = mapAttachments(msg, id, timestamp);
    if (result && suggestedActions.length > 0) {
      result.actions = suggestedActions;
    }
    return result;
  }

  // Text + suggested actions → quick-reply
  if (suggestedActions.length > 0) {
    return {
      id,
      type: "quick-reply",
      from: "bot",
      data: { text: msg.text ?? "", actions: suggestedActions },
      timestamp,
    };
  }

  // Plain text
  if (msg.text) {
    return {
      id,
      type: "text",
      from: "bot",
      data: { text: msg.text },
      timestamp,
    };
  }

  // Nothing meaningful
  return null;
}

/* ------------------------------------------------------------------ */
/*  Attachment mapping                                                */
/* ------------------------------------------------------------------ */

function mapAttachments(
  msg: Message,
  id: string,
  timestamp: number,
): IncomingMessage | null {
  const attachments = msg.attachments!;
  const layout = msg.attachmentLayout;

  // Multiple hero/thumbnail/flex cards with carousel layout
  const cardTypes = [CT_HERO, CT_THUMBNAIL, CT_FLEX];
  const allCards = attachments.every((a) => cardTypes.includes(a.contentType));

  if (allCards && (attachments.length > 1 || layout === "carousel")) {
    return {
      id,
      type: "carousel",
      from: "bot",
      data: {
        cards: attachments.map((a) =>
          mapHeroLikeCard((a as HeroCard | Thumbnail | FlexCard).content),
        ),
      },
      timestamp,
    };
  }

  // Single attachment
  return mapSingleAttachment(attachments[0], msg, id, timestamp);
}

function mapSingleAttachment(
  att: Attachment,
  msg: Message,
  id: string,
  timestamp: number,
): IncomingMessage | null {
  const ct = att.contentType;

  // Hero / Thumbnail / Flex card
  if (ct === CT_HERO || ct === CT_THUMBNAIL || ct === CT_FLEX) {
    const content = (att as HeroCard | Thumbnail | FlexCard).content;
    return {
      id,
      type: "card",
      from: "bot",
      data: mapHeroLikeCard(content),
      timestamp,
    };
  }

  // Adaptive card — simple parse
  if (ct === CT_ADAPTIVE) {
    return mapAdaptiveCard((att as AdaptiveCard).content, id, timestamp);
  }

  // Signin / OAuth card
  if (ct === CT_SIGNIN || ct === CT_OAUTH) {
    const content = (att as Signin).content;
    return {
      id,
      type: "buttons",
      from: "bot",
      data: {
        text: content.text ?? "Please sign in",
        buttons: mapCardButtons(content.buttons),
      },
      timestamp,
    };
  }

  // Receipt card
  if (ct === CT_RECEIPT) {
    return mapReceiptCard((att as Receipt).content, id, timestamp);
  }

  // Video card
  if (ct === CT_VIDEO) {
    const content = (att as VideoCard).content;
    const mediaUrl = content.media?.[0]?.url;
    if (!mediaUrl) return null;
    return {
      id,
      type: "video",
      from: "bot",
      data: {
        src: mediaUrl,
        poster: content.image?.url,
        caption: content.title ?? msg.text,
      },
      timestamp,
    };
  }

  // Audio card
  if (ct === CT_AUDIO) {
    const content = (att as AudioCard).content;
    const mediaUrl = content.media?.[0]?.url;
    if (!mediaUrl) return null;
    return {
      id,
      type: "file",
      from: "bot",
      data: {
        url: mediaUrl,
        name: content.title ?? "audio",
        mimeType: "audio/mpeg",
      },
      timestamp,
    };
  }

  // Animation card (typically GIFs)
  if (ct === CT_ANIMATION) {
    const content = (att as AnimationCard).content;
    const mediaUrl = content.media?.[0]?.url;
    if (!mediaUrl) return null;
    return {
      id,
      type: "image",
      from: "bot",
      data: {
        src: mediaUrl,
        caption: content.title ?? msg.text,
      },
      timestamp,
    };
  }

  // Image attachment (contentType starts with "image/")
  if (ct.startsWith("image/") && "contentUrl" in att) {
    return {
      id,
      type: "image",
      from: "bot",
      data: {
        src: att.contentUrl,
        alt: att.name,
        caption: msg.text,
      },
      timestamp,
    };
  }

  // Video file attachment
  if (ct.startsWith("video/") && "contentUrl" in att) {
    return {
      id,
      type: "video",
      from: "bot",
      data: {
        src: att.contentUrl,
        caption: msg.text,
      },
      timestamp,
    };
  }

  // Generic file attachment
  if ("contentUrl" in att) {
    return {
      id,
      type: "file",
      from: "bot",
      data: {
        url: att.contentUrl,
        name: att.name ?? "file",
        mimeType: ct,
      },
      timestamp,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Hero-like card mapping (hero, thumbnail, flex share same shape)    */
/* ------------------------------------------------------------------ */

function mapHeroLikeCard(content: HeroCard["content"]): Record<string, unknown> {
  return {
    image: content.images?.[0]?.url,
    title: content.title ?? "",
    subtitle: content.subtitle ?? content.text,
    buttons: mapCardButtons(content.buttons),
  };
}

/* ------------------------------------------------------------------ */
/*  Card button / action mapping                                      */
/* ------------------------------------------------------------------ */

export function mapCardButtons(
  buttons?: CardAction[],
): MessageAction[] {
  if (!buttons || buttons.length === 0) return [];

  return buttons.map((btn): MessageAction => {
    const label = ("title" in btn ? btn.title : undefined) ?? String(btn.value ?? "");

    switch (btn.type) {
      case "openUrl":
      case "signin":
        return { label, url: String(btn.value ?? "") };

      case "call":
        return { label, url: String(btn.value ?? "") };

      case "imBack":
      case "postBack":
      case "messageBack":
      default:
        return { label, value: String(btn.value ?? label) };
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Suggested actions mapping                                         */
/* ------------------------------------------------------------------ */

function mapSuggestedActions(msg: Message): MessageAction[] {
  const actions = msg.suggestedActions?.actions;
  if (!actions || actions.length === 0) return [];

  return actions.map((a): MessageAction => {
    const label = ("title" in a ? a.title : undefined) ?? String(a.value ?? "");
    if (a.type === "openUrl") {
      return { label, url: String(a.value ?? "") };
    }
    return { label, value: String(a.value ?? label) };
  });
}

/* ------------------------------------------------------------------ */
/*  Adaptive Card — simple parse                                      */
/* ------------------------------------------------------------------ */

interface AdaptiveElement {
  type: string;
  text?: string;
  url?: string;
  body?: AdaptiveElement[];
  items?: AdaptiveElement[];
  columns?: Array<{ items?: AdaptiveElement[] }>;
  actions?: Array<{ type: string; title?: string; url?: string; data?: unknown }>;
  [key: string]: unknown;
}

function mapAdaptiveCard(
  content: Record<string, unknown>,
  id: string,
  timestamp: number,
): IncomingMessage {
  const texts: string[] = [];
  let image: string | undefined;
  const buttons: MessageAction[] = [];

  // Recursive body parser
  function walk(elements?: AdaptiveElement[]) {
    if (!elements) return;
    for (const el of elements) {
      switch (el.type) {
        case "TextBlock":
          if (el.text) texts.push(el.text);
          break;
        case "Image":
          if (!image && el.url) image = el.url;
          break;
        case "ActionSet":
          if (el.actions) mapAdaptiveActions(el.actions, buttons);
          break;
        case "Container":
          walk(el.items);
          break;
        case "ColumnSet":
          for (const col of el.columns ?? []) {
            walk(col.items);
          }
          break;
        case "Column":
          walk(el.items);
          break;
      }
    }
  }

  walk(content.body as AdaptiveElement[] | undefined);

  // Top-level actions
  if (Array.isArray(content.actions)) {
    mapAdaptiveActions(content.actions as AdaptiveElement["actions"] & object, buttons);
  }

  // Fallback text
  const fallback =
    (content.fallbackText as string) ??
    (content.speak as string) ??
    texts.join("\n");

  // If we have an image and a title, render as card
  if (image) {
    return {
      id,
      type: "card",
      from: "bot",
      data: {
        image,
        title: texts[0] ?? "",
        subtitle: texts.slice(1).join("\n"),
        buttons,
      },
      timestamp,
    };
  }

  // If we have buttons, render as buttons message
  if (buttons.length > 0) {
    return {
      id,
      type: "buttons",
      from: "bot",
      data: {
        text: fallback || "Adaptive Card",
        buttons,
      },
      timestamp,
    };
  }

  // Plain text fallback
  return {
    id,
    type: "text",
    from: "bot",
    data: { text: fallback || "[Adaptive Card]" },
    timestamp,
  };
}

function mapAdaptiveActions(
  actions: Array<{ type: string; title?: string; url?: string; data?: unknown }>,
  out: MessageAction[],
) {
  for (const a of actions) {
    const label = a.title ?? "Action";
    if (a.type === "Action.OpenUrl" && a.url) {
      out.push({ label, url: a.url });
    } else if (a.type === "Action.Submit") {
      out.push({ label, value: typeof a.data === "string" ? a.data : label });
    } else {
      out.push({ label, value: label });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Receipt card mapping                                              */
/* ------------------------------------------------------------------ */

function mapReceiptCard(
  content: Receipt["content"],
  id: string,
  timestamp: number,
): IncomingMessage {
  const lines: string[] = [];
  if (content.title) lines.push(`**${content.title}**`);

  if (content.facts) {
    for (const fact of content.facts) {
      lines.push(`${fact.key}: ${fact.value}`);
    }
  }

  if (content.items) {
    for (const item of content.items) {
      const price = item.price ? ` — ${item.price}` : "";
      lines.push(`- ${item.title ?? "Item"}${price}`);
    }
  }

  if (content.tax) lines.push(`Tax: ${content.tax}`);
  if (content.total) lines.push(`**Total: ${content.total}**`);

  return {
    id,
    type: "text",
    from: "bot",
    data: { text: lines.join("\n") },
    timestamp,
  };
}
