/**
 * Theme value object — pure types, no logic.
 * No external dependencies allowed.
 */

export type ButtonPosition =
    | "bottom-right"
    | "bottom-left"
    | "top-right"
    | "top-left";
export type ButtonSize = "small" | "medium" | "large";
export type SpaceLevel = "1" | "2" | "3" | "4" | "5";

/**
 * Controls how the chat window is presented.
 * - `popup`      — floating card near the launcher button (default)
 * - `side-panel` — full-height drawer docked to the viewport edge
 * - `fullscreen` — covers the entire viewport
 * - `inline`     — positioned statically inside its parent container
 */
export type WindowMode = "popup" | "side-panel" | "fullscreen" | "inline";

/** Avatar configuration for bot and user sides. */
export interface AvatarConfig {
    /** URL for the bot avatar image. Omit to use the default robot SVG. */
    bot?: string;
    /** URL for the user avatar image. Omit to use the default person SVG. */
    user?: string;
    /** URL for the header avatar image. Omit to use the default robot SVG. */
    header?: string;
    /** Show bot avatar. Default: true. */
    showBot?: boolean;
    /** Show user avatar. Default: true. */
    showUser?: boolean;
}

export interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    border: string;
    /** Accent/highlight color (e.g. warnings, secondary CTAs). Optional. */
    accent?: string;
    /** Surface color for cards/panels distinct from the base background. Optional. */
    surface?: string;
    /** Secondary body text color. Optional. */
    textSecondary?: string;
    /** Tertiary/muted text color (e.g. timestamps, disclaimers). Optional. */
    textTertiary?: string;
    /** Success state color. Optional. */
    success?: string;
    /** Error state color. Optional. */
    error?: string;
    /** Warning state color. Optional. */
    warning?: string;
    /** Informational state color. Optional. */
    info?: string;
}

export interface LayoutConfig {
    width?: string;
    height?: string;
    maxWidth?: string;
    maxHeight?: string;
    horizontalSpace?: SpaceLevel;
    verticalSpace?: SpaceLevel;
}

/**
 * End-of-conversation survey configuration.
 * The connector must implement `sendSurvey` for submissions to be delivered.
 */
export interface EndOfConversationSurveyConfig {
    /** Enable the survey flow. Default: `true`. */
    enabled?: boolean;
    /**
     * Where the survey is shown.
     * - `"inline"` — appended to the message list as a bot-authored card
     * - `"screen"` — full-height overlay over the chat view (default)
     */
    mode?: "inline" | "screen";
    /**
     * When to trigger the survey.
     * - `"onClose"` — intercept the close button and show the survey first (default)
     * - `"manual"`  — only shown when the host dispatches `show-survey`
     */
    trigger?: "onClose" | "manual";
    /** Maximum rating value (stars). Default: `5`. */
    maxRating?: number;
    /**
     * If the user selects a rating at or below this value, a comment is required
     * before submit is enabled. Set to `0` to never require a comment.
     * Default: `3`.
     */
    requireCommentBelow?: number;
    /**
     * Opaque identifier forwarded to the connector as `SurveyPayload.kind`.
     * Useful when the backend distinguishes bot-vs-agent surveys.
     * Default: `1`.
     */
    kind?: string | number;
    /**
     * After submit or skip, fully tear down the engine and connector so the
     * next open starts from scratch (fresh connection, empty history, launcher
     * view). Set to `false` to keep the session alive and just close the
     * widget (messages, connection, and state are preserved).
     * Default: `true`.
     */
    resetOnSubmit?: boolean;
}

/**
 * Low-emphasis notice shown either under the chat input or at the beginning
 * of the scrollable conversation (e.g. an AI-generated-content disclaimer).
 * Disabled by default.
 */
export interface DisclaimerConfig {
    /** Show the disclaimer note. Default: `false`. */
    enabled?: boolean;
    /** Fixed note shown below the chat input. */
    bottomText?: string;
    /** Note shown as the first item in the scrollable conversation. */
    conversationStartText?: string;
}

/**
 * Names of the built-in icons that can be swapped via `ThemeConfig.icons`.
 * Each value must be inner SVG markup (e.g. `<path d="..."/>`), rendered
 * inside chativa's own `<svg>` wrapper — do not include an outer `<svg>` tag.
 * The wrapper sets `fill`/`stroke` to `currentColor` so icons inherit the
 * surrounding icon color automatically.
 */
export type IconName =
    | "chatLauncher"
    | "close"
    | "minimize"
    | "search"
    | "send"
    | "emoji"
    | "attach"
    | "maximizeFullscreen"
    | "minimizeFullscreen";

export type IconsConfig = Partial<Record<IconName, string>>;

export interface ThemeConfig {
    allowFullscreen?: boolean;
    colors: ThemeColors;
    position: ButtonPosition;
    positionMargin?: SpaceLevel;
    size: ButtonSize;
    layout: LayoutConfig;
    /** Avatar configuration for bot and user sides. */
    avatar?: AvatarConfig;
    /** Show delivery/read status ticks on user messages. Default: false. */
    showMessageStatus?: boolean;
    /** Enable the search toggle button in the chat header. Default: true. */
    enableSearch?: boolean;
    /**
     * How the chat window is presented. Default: `"popup"`.
     * See `WindowMode` for details.
     */
    windowMode?: WindowMode;
    /**
     * Enable multi-conversation mode inside the popup.
     * When `true`, a conversations icon button appears in the chat header.
     * Clicking it opens a conversation list view (slide-in within the popup).
     * Requires the connector to implement `listConversations` / `switchConversation`.
     * Default: `false`.
     */
    enableMultiConversation?: boolean;
    /** Enable the file upload button in the chat input. Default: true. */
    enableFileUpload?: boolean;
    /**
     * Hide the launcher button when the chat window is open.
     * Only applies when slotted (custom) content is used.
     * Default: `false`.
     */
    hideButtonOnOpen?: boolean;
    /** End-of-conversation survey configuration. Default: disabled. */
    endOfConversationSurvey?: EndOfConversationSurveyConfig;
    /** Low-emphasis disclaimer note (e.g. AI-content warning). Default: disabled. */
    disclaimer?: DisclaimerConfig;
    /** Custom SVG markup overrides for built-in icons, keyed by IconName. */
    icons?: IconsConfig;
}

export const DEFAULT_THEME: ThemeConfig = {
    colors: {
        primary: "#4f46e5",
        secondary: "#6c757d",
        background: "#ffffff",
        text: "#212529",
        border: "#dee2e6",
    },
    position: "bottom-right",
    positionMargin: "2",
    size: "medium",
    layout: {
        width: "360px",
        height: "520px",
        maxWidth: "100%",
        maxHeight: "100%",
        horizontalSpace: "2",
        verticalSpace: "2",
    },
    showMessageStatus: true,
    endOfConversationSurvey: {
        enabled: true,
        mode: "screen",
        trigger: "onClose",
        maxRating: 5,
        requireCommentBelow: 3,
        kind: 1,
        resetOnSubmit: true,
    },
};

/** Build CSS variable map from a ThemeConfig. */
export function themeToCSS(theme: ThemeConfig): Record<string, string> {
    const { colors } = theme;
    const vars: Record<string, string> = {
        "--chativa-primary-color": colors.primary,
        "--chativa-secondary-color": colors.secondary,
        "--chativa-background-color": colors.background,
        "--chativa-text-color": colors.text,
        "--chativa-border-color": colors.border,
    };
    if (colors.accent) vars["--chativa-accent-color"] = colors.accent;
    if (colors.surface) vars["--chativa-surface"] = colors.surface;
    if (colors.textSecondary) vars["--chativa-text-secondary"] = colors.textSecondary;
    if (colors.textTertiary) vars["--chativa-text-tertiary"] = colors.textTertiary;
    if (colors.success) vars["--chativa-success-color"] = colors.success;
    if (colors.error) vars["--chativa-error-color"] = colors.error;
    if (colors.warning) vars["--chativa-warning-color"] = colors.warning;
    if (colors.info) vars["--chativa-info-color"] = colors.info;
    return vars;
}

/** Deep merge a partial theme over a base theme. */
export function mergeTheme(
    base: ThemeConfig,
    overrides: DeepPartial<ThemeConfig>,
): ThemeConfig {
    return {
        ...base,
        ...overrides,
        colors: { ...base.colors, ...(overrides.colors ?? {}) },
        layout: { ...base.layout, ...(overrides.layout ?? {}) },
        endOfConversationSurvey:
            base.endOfConversationSurvey || overrides.endOfConversationSurvey
                ? {
                      ...(base.endOfConversationSurvey ?? {}),
                      ...(overrides.endOfConversationSurvey ?? {}),
                  }
                : undefined,
        disclaimer:
            base.disclaimer || overrides.disclaimer
                ? {
                      ...(base.disclaimer ?? {}),
                      ...(overrides.disclaimer ?? {}),
                  }
                : undefined,
        icons:
            base.icons || overrides.icons
                ? {
                      ...(base.icons ?? {}),
                      ...(overrides.icons ?? {}),
                  }
                : undefined,
    } as ThemeConfig;
}

export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
