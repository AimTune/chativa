import type {
    IConnector,
    MessageHandler,
    ConnectHandler,
    DisconnectHandler,
    TypingHandler,
    MessageStatusHandler,
    ChativaContext,
    SurveyPayload,
} from "@chativa/core";
import type {
    OutgoingMessage,
    HistoryResult,
    IncomingMessage,
} from "@chativa/core";
import { DirectLine, ConnectionStatus } from "botframework-directlinejs";
import type { Activity } from "botframework-directlinejs";
import { mapActivityToMessage, TYPING_SENTINEL } from "./mapActivity";

/** Minimal subscription interface returned by RxJS5 Observable.subscribe(). */
interface Unsubscribable {
    unsubscribe(): void;
}

/**
 * Context passed to custom event handlers — provides the info and methods
 * needed to respond to a bot-initiated event activity.
 */
export interface EventHandlerContext {
    /** The raw DirectLine event activity. */
    activity: Activity;
    /** The user ID for this session. */
    userId: string;
    /** The user display name for this session. */
    userName: string;
    /** Send an event activity back to the bot. */
    postEvent(name: string, value?: unknown): void;
    /**
     * Full Chativa context — access messages, chat UI, theme, and event bus.
     * Available when the connector is used via ChatEngine (which injects it).
     */
    chativa: ChativaContext;
}

/**
 * Handler for a bot-initiated event activity.
 * Keyed by event name (e.g. `"LocationRequest"`).
 */
export type EventHandler = (ctx: EventHandlerContext) => void;

export interface DirectLineConnectorOptions {
    /** DirectLine channel secret (server-side only — generates a token). */
    secret?: string;
    /** Pre-fetched DirectLine token. */
    token?: string;
    /** URL of a custom token-generating endpoint (POST, returns { token, conversationId? }). */
    tokenGeneratorUrl?: string;
    /** Override the user ID instead of auto-generating one. */
    userId?: string;
    /** Display name sent with activities. */
    userName?: string;
    /** Sovereign-cloud DirectLine endpoint (e.g. government, china). */
    domain?: string;
    /** BCP-47 locale sent with the webchat/join event and outgoing activities (e.g. "tr-TR"). */
    locale?: string;
    /**
     * Extra key-value pairs merged into the `webchat/join` event's `value` payload.
     * Example: `{ language: "tr", tenant: "galataport" }`
     */
    joinParameters?: Record<string, unknown>;
    /**
     * Custom handlers for bot-initiated event activities, keyed by event name.
     * Example:
     * ```ts
     * eventHandlers: {
     *   LocationRequest: (ctx) => {
     *     navigator.geolocation.getCurrentPosition((pos) => {
     *       ctx.postEvent("webchat/location", {
     *         latitude: pos.coords.latitude,
     *         longitude: pos.coords.longitude,
     *       });
     *     });
     *   },
     * }
     * ```
     */
    eventHandlers?: Record<string, EventHandler>;
    /**
     * When true, persist conversation state (conversationId, token, watermark)
     * to localStorage so the conversation can be resumed across page reloads.
     */
    resumeConversation?: boolean;
    /**
     * How long (ms) to keep the typing indicator visible after a bot typing
     * signal before auto-clearing it. Each new typing signal resets the timer.
     * Default: 3000. Ignored when `typingUntilMessage` is true.
     */
    typingTimeoutMs?: number;
    /**
     * When true, the typing indicator stays on until the next bot message
     * arrives (no auto-clear timeout).
     */
    typingUntilMessage?: boolean;
}

/* ── Constants ────────────────────────────────────────────────────── */

const USER_ID_KEY = "chativa_directline_userId";
const CONVERSATION_KEY = "chativa_directline_conversation";

interface PersistedConversation {
    conversationId: string;
    token: string;
    watermark?: string;
    userId: string;
}

/* ── Module-level helpers ─────────────────────────────────────────── */

function getOrCreateUserId(): string {
    try {
        const stored = localStorage.getItem(USER_ID_KEY);
        if (stored) return stored;
    } catch {
        // localStorage unavailable (e.g. incognito, SSR)
    }
    const id =
        Math.random().toString(36).slice(2, 15) +
        Math.random().toString(36).slice(2, 15);
    try {
        localStorage.setItem(USER_ID_KEY, id);
    } catch {
        // best-effort
    }
    return id;
}

/** Extract expiry time (ms since epoch) from a JWT token. */
function getTokenExpiry(token: string): number | null {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

async function fetchToken(
    secret: string,
    userId: string,
): Promise<{ token: string; conversationId: string }> {
    const res = await fetch(
        "https://directline.botframework.com/v3/directline/tokens/generate",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ user: { id: userId, name: userId } }),
        },
    );
    if (!res.ok) {
        throw new Error(`DirectLine token fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as {
        token: string;
        conversationId: string;
    };
    return { token: data.token, conversationId: data.conversationId };
}

async function fetchTokenFromUrl(
    url: string,
): Promise<{ token: string; conversationId?: string; userId?: string }> {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
        throw new Error(`Token generator failed: ${res.status}`);
    }
    return (await res.json()) as {
        token: string;
        conversationId?: string;
        userId?: string;
    };
}

/** Refresh an existing DirectLine token via the REST API. */
async function refreshDirectLineToken(
    currentToken: string,
    domain?: string,
): Promise<{ token: string; conversationId: string }> {
    const base = domain ?? "https://directline.botframework.com/v3/directline";
    const res = await fetch(`${base}/tokens/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) {
        throw new Error(`Token refresh failed: ${res.status}`);
    }
    return (await res.json()) as { token: string; conversationId: string };
}

/**
 * DirectLineConnector — Azure Bot Framework DirectLine v3 adapter.
 *
 * Maps all Bot Framework activity types (hero cards, carousels,
 * suggested actions, images, videos, files, adaptive cards, etc.)
 * into Chativa's native message types.
 */
export class DirectLineConnector implements IConnector {
    readonly name = "directline";
    readonly addSentToHistory = true;

    private directLine!: DirectLine;
    private conversationId!: string;
    private userId!: string;
    private userName: string | undefined;
    private token!: string;
    private options: DirectLineConnectorOptions;
    private chativaCtx: ChativaContext | null = null;

    private messageHandler: MessageHandler | null = null;
    private connectHandler: ConnectHandler | null = null;
    private disconnectHandler: DisconnectHandler | null = null;
    private typingHandler: TypingHandler | null = null;
    private messageStatusHandler: MessageStatusHandler | null = null;

    private activitySub: Unsubscribable | null = null;
    private connectionSub: Unsubscribable | null = null;
    private typingTimeout: ReturnType<typeof setTimeout> | null = null;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    /** Queue of sent message IDs awaiting echo confirmation. */
    private pendingIds: string[] = [];
    /** True after the first successful connection (reserved for future join-vs-rejoin logic). */
    private hasConnectedBefore = false;
    /** Resolves the connect() promise once the bot sends its first message after join. */
    private resolveReady: (() => void) | null = null;
    /** Last known activity watermark — used for conversation resume. */
    private watermark: string | undefined;
    /** When true, skip the next join/rejoin event (used during resume). */
    private _skipNextJoin = false;

    constructor(options: DirectLineConnectorOptions) {
        this.options = options;
    }

    setContext(ctx: ChativaContext): void {
        this.chativaCtx = ctx;
    }

    /**
     * Register (or replace) an event handler for a bot-initiated event activity.
     * Can be called before or after `connect()`.
     *
     * @example
     * ```ts
     * connector.addEventHandler("LocationRequest", (ctx) => {
     *   navigator.geolocation.getCurrentPosition((pos) => {
     *     ctx.postEvent("webchat/location", { latitude: pos.coords.latitude, ... });
     *   });
     * });
     * ```
     */
    addEventHandler(name: string, handler: EventHandler): void {
        this.options.eventHandlers ??= {};
        this.options.eventHandlers[name] = handler;
    }

    /** Remove a previously registered event handler by name. */
    removeEventHandler(name: string): boolean {
        if (!this.options.eventHandlers?.[name]) return false;
        delete this.options.eventHandlers[name];
        return true;
    }

    /** Check whether an event handler is registered for the given name. */
    hasEventHandler(name: string): boolean {
        return !!this.options.eventHandlers?.[name];
    }

    /** Return the names of all registered event handlers. */
    getEventHandlerNames(): string[] {
        return Object.keys(this.options.eventHandlers ?? {});
    }

    async connect(): Promise<void> {
        this.userId = this.options.userId ?? getOrCreateUserId();
        this.userName = this.options.userName;

        // ── Try to resume a persisted conversation ────────────────────
        let isResuming = false;
        if (this.options.resumeConversation) {
            const persisted = this.loadPersistedConversation();
            if (persisted) {
                try {
                    const refreshed = await refreshDirectLineToken(
                        persisted.token,
                        this.options.domain,
                    );
                    this.token = refreshed.token;
                    this.conversationId = persisted.conversationId;
                    this.watermark = persisted.watermark;
                    this.userId = persisted.userId;
                    isResuming = true;
                } catch {
                    // Persisted token expired or invalid — start fresh
                    this.clearPersistedConversation();
                }
            }
        }

        // ── Acquire token (fresh conversation) ────────────────────────
        if (!isResuming) {
            if (this.options.tokenGeneratorUrl) {
                const result = await fetchTokenFromUrl(
                    this.options.tokenGeneratorUrl,
                );
                this.token = result.token;
                if (result.conversationId)
                    this.conversationId = result.conversationId;
                if (result.userId) this.userId = result.userId;
            } else if (this.options.token) {
                this.token = this.options.token;
            } else if (this.options.secret) {
                const result = await fetchToken(
                    this.options.secret,
                    this.userId,
                );
                this.token = result.token;
                this.conversationId = result.conversationId;
            } else {
                throw new Error(
                    "DirectLineConnector: provide token, secret, or tokenGeneratorUrl.",
                );
            }
        }

        // ── Schedule automatic token refresh ──────────────────────────
        this.scheduleTokenRefresh();

        // ── Create DirectLine instance ────────────────────────────────
        this.directLine = new DirectLine({
            token: this.token,
            domain: this.options.domain,
            ...(isResuming
                ? {
                      conversationId: this.conversationId,
                      watermark: this.watermark,
                  }
                : {}),
        });

        if (isResuming) {
            this.hasConnectedBefore = true;
            this._skipNextJoin = true;
        }

        // ── Wait for connection ───────────────────────────────────────
        const ready = new Promise<void>((resolve) => {
            this.resolveReady = resolve;
        });

        this.startListening(isResuming);

        await ready;
        this.connectHandler?.();

        if (this.options.resumeConversation) {
            this.persistConversation();
        }
    }

    async disconnect(): Promise<void> {
        this.activitySub?.unsubscribe();
        this.activitySub = null;
        this.connectionSub?.unsubscribe();
        this.connectionSub = null;
        this.clearTypingTimeout();
        this.clearRefreshTimer();

        try {
            this.directLine?.end();
        } catch {
            // DirectLine.end() may throw if already ended
        }

        this.messageHandler = null;
        this.connectHandler = null;
        this.disconnectHandler = null;
        this.typingHandler = null;
        this.messageStatusHandler = null;
    }

    /** Clear persisted conversation state and reset watermark. */
    clearConversation(): void {
        this.watermark = undefined;
        this.clearPersistedConversation();
    }

    async sendMessage(message: OutgoingMessage): Promise<void> {
        this.pendingIds.push(message.id);
        // Mark as "sent" immediately so it shows before the echo arrives
        this.messageStatusHandler?.(message.id, "sent");
        return new Promise<void>((resolve, reject) => {
            this.directLine
                .postActivity({
                    type: "message",
                    from: {
                        id: this.userId,
                        name: this.userName ?? this.userId,
                    },
                    text: (message.data as { text?: string }).text ?? "",
                    conversation: { id: this.conversationId },
                    channelId: "directline",
                    ...(this.options.locale
                        ? { locale: this.options.locale }
                        : {}),
                    timestamp: new Date().toISOString(),
                    id: message.id,
                })
                .subscribe({
                    next: () => resolve(),
                    error: (err: unknown) => reject(err),
                });
        });
    }

    async sendFile(file: File): Promise<void> {
        const domain =
            this.options.domain ??
            "https://directline.botframework.com/v3/directline";
        const url = `${domain}/conversations/${this.conversationId}/upload?userId=${encodeURIComponent(this.userId)}`;

        const formData = new FormData();
        formData.append("file", file, file.name);

        const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.token}` },
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`DirectLine file upload failed: ${res.status}`);
        }
    }

    /**
     * Submit an end-of-conversation survey as a DirectLine event activity.
     * Matches the legacy `webchat/customerfeedback` event shape so existing
     * bot flows keep working:
     *   value: { rating, comment, type }
     * where `type` is `kind` coerced to a number (defaulting to 1) to preserve
     * compatibility with bots that switch on numeric survey types.
     */
    async sendSurvey(payload: SurveyPayload): Promise<void> {
        const rawType =
            typeof payload.kind === "number"
                ? payload.kind
                : payload.kind !== undefined
                  ? Number(payload.kind)
                  : 1;
        const type = Number.isFinite(rawType) ? rawType : 1;

        return new Promise<void>((resolve, reject) => {
            this.directLine
                .postActivity({
                    type: "event",
                    name: "webchat/customerfeedback",
                    from: { id: this.userId, name: this.userId },
                    value: {
                        rating: payload.rating,
                        comment: payload.comment ?? "",
                        type,
                    },
                })
                .subscribe({
                    next: () => resolve(),
                    error: (err: unknown) => reject(err),
                });
        });
    }

    async sendFeedback(
        messageId: string,
        feedback: "like" | "dislike",
    ): Promise<void> {
        // Look up the correlationId from the stored message's channelData
        const msg = this.chativaCtx?.messages
            .getAll()
            .find((m) => m.id === messageId);
        const correlationId = (
            msg?.data?.channelData as Record<string, unknown> | undefined
        )?.correlationId;

        if (!correlationId) {
            console.warn(
                "[DirectLineConnector] sendFeedback: no correlationId found for message",
                messageId,
            );
            return;
        }

        // Bot expects numeric: 0 = like, 1 = dislike
        const feedbackType = feedback === "like" ? 0 : 1;

        return new Promise<void>((resolve, reject) => {
            this.directLine
                .postActivity({
                    type: "event",
                    name: "webchat/messageFeedback",
                    from: { id: this.userId, name: this.userId },
                    value: { correlationId, feedbackType },
                })
                .subscribe({
                    next: () => resolve(),
                    error: (err: unknown) => reject(err),
                });
        });
    }

    async loadHistory(cursor?: string): Promise<HistoryResult> {
        const domain =
            this.options.domain ??
            "https://directline.botframework.com/v3/directline";
        const url = cursor
            ? `${domain}/conversations/${this.conversationId}/activities?watermark=${encodeURIComponent(cursor)}`
            : `${domain}/conversations/${this.conversationId}/activities`;

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${this.token}` },
        });

        if (!res.ok) {
            throw new Error(`DirectLine history fetch failed: ${res.status}`);
        }

        const data = (await res.json()) as {
            activities: Activity[];
            watermark: string;
        };

        const messages: IncomingMessage[] = [];
        for (const activity of data.activities) {
            // User's own messages — mapActivityToMessage filters these out (live dedup),
            // but history needs them.
            if (
                activity.from.id === this.userId &&
                activity.type === "message"
            ) {
                const msg = activity as Activity & { text?: string };
                if (msg.text) {
                    messages.push({
                        id:
                            activity.id ??
                            `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        type: "text",
                        from: "user",
                        data: { text: msg.text },
                        timestamp: activity.timestamp
                            ? new Date(activity.timestamp).getTime()
                            : Date.now(),
                    });
                }
                continue;
            }

            const result = mapActivityToMessage(activity, this.userId);
            if (result !== null && result !== TYPING_SENTINEL) {
                messages.push(result);
            }
        }

        return {
            messages,
            hasMore: false,
            cursor: data.watermark,
        };
    }

    onMessage(callback: MessageHandler): void {
        this.messageHandler = callback;
    }

    onConnect(callback: ConnectHandler): void {
        this.connectHandler = callback;
    }

    onDisconnect(callback: DisconnectHandler): void {
        this.disconnectHandler = callback;
    }

    onTyping(callback: TypingHandler): void {
        this.typingHandler = callback;
    }

    onMessageStatus(callback: MessageStatusHandler): void {
        this.messageStatusHandler = callback;
    }

    /* ── Private helpers ───────────────────────────────────────────── */

    /**
     * Subscribe to DirectLine connectionStatus$ and activity$ observables.
     * Extracted so it can be re-used after an ExpiredToken reconnect.
     */
    private startListening(resolveOnOnline: boolean) {
        this.connectionSub = this.directLine.connectionStatus$.subscribe(
            (status: ConnectionStatus) => {
                switch (status) {
                    case ConnectionStatus.Online:
                        this.sendJoinEvent();
                        // Resumed / reconnected conversations resolve immediately
                        if (resolveOnOnline && this.resolveReady) {
                            this.resolveReady();
                            this.resolveReady = null;
                        }
                        break;
                    case ConnectionStatus.ExpiredToken:
                        this.handleExpiredToken();
                        break;
                    case ConnectionStatus.FailedToConnect:
                        if (this.options.resumeConversation) {
                            this.clearPersistedConversation();
                        }
                        this.disconnectHandler?.("Failed to connect");
                        break;
                    case ConnectionStatus.Ended:
                        this.disconnectHandler?.("Connection ended");
                        break;
                }
            },
        );

        this.activitySub = this.directLine.activity$.subscribe((activity) => {
            try {
                // Track watermark and conversationId from every activity
                if (activity.id) this.watermark = activity.id;
                if (!this.conversationId && activity.conversation?.id) {
                    this.conversationId = activity.conversation.id;
                }

                // Skip own echoed activities
                if (activity.from.id === this.userId) {
                    // Echoed user message → mark the original as "read"
                    if (activity.type === "message") {
                        const pendingId = this.pendingIds.shift();
                        if (pendingId) {
                            this.messageStatusHandler?.(pendingId, "read");
                        }
                    }
                    return;
                }

                // Bot-initiated event
                if (activity.type === "event" && activity.name) {
                    // Built-in: DisableFeedbackButton — mark the message as feedback-sent
                    if (
                        activity.name === "DisableFeedbackButton" &&
                        activity.value
                    ) {
                        const val = activity.value as {
                            CorrelationId?: string;
                            FeedbackType?: number;
                        };
                        if (val.CorrelationId) {
                            this.handleDisableFeedback(
                                val.CorrelationId,
                                val.FeedbackType,
                            );
                        }
                    }

                    // Dispatch to custom event handler (if registered)
                    const handler = this.options.eventHandlers?.[activity.name];
                    if (handler) {
                        handler(this.createEventContext(activity));
                    }
                    return;
                }

                const result = mapActivityToMessage(activity, this.userId);

                if (result === TYPING_SENTINEL) {
                    this.handleTyping();
                    return;
                }

                if (result !== null) {
                    // Clear typing indicator when a message arrives
                    this.clearTypingTimeout();
                    this.typingHandler?.(false);

                    // First bot message → resolve connect() and signal "connected"
                    if (this.resolveReady) {
                        this.resolveReady();
                        this.resolveReady = null;
                    }

                    this.messageHandler?.(result);

                    // Persist state after delivering a message
                    if (this.options.resumeConversation) {
                        this.persistConversation();
                    }
                }
            } catch (err) {
                console.warn(
                    "[DirectLineConnector] Activity mapping error:",
                    err,
                );
            }
        });
    }

    /** Build the context object passed to custom event handlers. */
    private createEventContext(activity: Activity): EventHandlerContext {
        const from = { id: this.userId, name: this.userName ?? this.userId };
        return {
            activity,
            userId: this.userId,
            userName: this.userName ?? this.userId,
            postEvent: (name: string, value?: unknown) => {
                this.directLine
                    .postActivity({
                        type: "event",
                        name,
                        from,
                        ...(this.options.locale
                            ? { locale: this.options.locale }
                            : {}),
                        value,
                    })
                    .subscribe();
            },
            chativa: this.chativaCtx!,
        };
    }

    /** Send webchat/join (first connect) or webchat/rejoin (reconnect) event. */
    private sendJoinEvent() {
        const locale = this.options.locale;
        const from = { id: this.userId, name: this.userName ?? this.userId };
        // Read reserved for future join-vs-rejoin branching; keeps the field alive.
        void this.hasConnectedBefore;

        // Skip join/rejoin when resuming a persisted conversation
        if (this._skipNextJoin) {
            this._skipNextJoin = false;
            this.hasConnectedBefore = true;
            this.directLine
                .postActivity({
                    type: "event",
                    name: "webchat/rejoin",
                    from,
                    ...(locale ? { locale } : {}),
                    value: { ...(locale ? { language: locale } : {}) },
                })
                .subscribe();
            return;
        }
        this.directLine
            .postActivity({
                type: "event",
                name: "webchat/join",
                from,
                ...(locale ? { locale } : {}),
                value: {
                    ...(locale ? { language: locale } : {}),
                    ...this.options.joinParameters,
                },
            })
            .subscribe();
    }

    /** Handle DisableFeedbackButton event — find the message by correlationId and patch it. */
    private handleDisableFeedback(
        correlationId: string,
        feedbackType?: number,
    ) {
        const messages = this.chativaCtx?.messages.getAll();
        if (!messages) return;
        const msg = messages.find(
            (m) =>
                (m.data?.channelData as Record<string, unknown> | undefined)
                    ?.correlationId === correlationId,
        );
        if (msg) {
            this.chativaCtx!.messages.update(msg.id, {
                data: { ...msg.data, feedbackDisabled: true, feedbackType },
            });
        }
    }

    private handleTyping() {
        this.clearTypingTimeout();
        this.typingHandler?.(true);
        if (this.options.typingUntilMessage) {
            // No timer — rely on next bot message (handled by ChatEngine) to clear.
            return;
        }
        const ms = this.options.typingTimeoutMs ?? 3000;
        this.typingTimeout = setTimeout(() => {
            this.typingHandler?.(false);
            this.typingTimeout = null;
        }, ms);
    }

    private clearTypingTimeout() {
        if (this.typingTimeout !== null) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }

    /* ── Token refresh ──────────────────────────────────────────────── */

    /** Schedule a token refresh 60 seconds before expiry. */
    private scheduleTokenRefresh() {
        this.clearRefreshTimer();
        const expiry = getTokenExpiry(this.token);
        if (!expiry) return;

        const delay = expiry - Date.now() - 60_000;
        if (delay <= 0) {
            // Token is already about to expire — refresh immediately
            this.refreshTokenNow();
            return;
        }
        this.refreshTimer = setTimeout(() => this.refreshTokenNow(), delay);
    }

    /** Pre-emptively refresh the token before it expires. */
    private async refreshTokenNow() {
        try {
            const result = await refreshDirectLineToken(
                this.token,
                this.options.domain,
            );
            this.token = result.token;
            this.scheduleTokenRefresh();
            if (this.options.resumeConversation) {
                this.persistConversation();
            }
        } catch (err) {
            console.warn("[DirectLineConnector] Token refresh failed:", err);
        }
    }

    /**
     * Called when DirectLine emits ExpiredToken status.
     * Refreshes the token and recreates the DirectLine connection.
     */
    private async handleExpiredToken() {
        try {
            const result = await refreshDirectLineToken(
                this.token,
                this.options.domain,
            );
            this.token = result.token;
            this.scheduleTokenRefresh();
        } catch {
            if (this.options.resumeConversation) {
                this.clearPersistedConversation();
            }
            this.disconnectHandler?.("Token expired and refresh failed");
            return;
        }

        // Tear down old DirectLine
        this.activitySub?.unsubscribe();
        this.connectionSub?.unsubscribe();
        this.clearTypingTimeout();
        try {
            this.directLine.end();
        } catch {
            /* already ended */
        }

        // Recreate with new token, preserving conversation
        this.directLine = new DirectLine({
            token: this.token,
            domain: this.options.domain,
            conversationId: this.conversationId,
            watermark: this.watermark,
        });

        this.startListening(true);

        if (this.options.resumeConversation) {
            this.persistConversation();
        }
    }

    private clearRefreshTimer() {
        if (this.refreshTimer !== null) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /* ── Conversation persistence ───────────────────────────────────── */

    private persistConversation() {
        if (!this.conversationId || !this.token) return;
        try {
            const data: PersistedConversation = {
                conversationId: this.conversationId,
                token: this.token,
                watermark: this.watermark,
                userId: this.userId,
            };
            localStorage.setItem(CONVERSATION_KEY, JSON.stringify(data));
        } catch {
            // localStorage unavailable
        }
    }

    private loadPersistedConversation(): PersistedConversation | null {
        try {
            const raw = localStorage.getItem(CONVERSATION_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as PersistedConversation;
        } catch {
            return null;
        }
    }

    private clearPersistedConversation() {
        try {
            localStorage.removeItem(CONVERSATION_KEY);
        } catch {
            // best-effort
        }
    }
}
