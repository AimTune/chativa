/**
 * Theme value object — pure types, no logic.
 * No external dependencies allowed.
 */

export type ButtonPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type ButtonSize = "small" | "medium" | "large";
export type SpaceLevel = "1" | "2" | "3" | "4" | "5";

/** Avatar configuration for bot and user sides. */
export interface AvatarConfig {
  /** URL for the bot avatar image. Omit to use the default robot SVG. */
  bot?: string;
  /** URL for the user avatar image. Omit to use the default person SVG. */
  user?: string;
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
}

export interface LayoutConfig {
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  horizontalSpace?: SpaceLevel;
  verticalSpace?: SpaceLevel;
}

export interface ThemeConfig {
  colors: ThemeColors;
  position: ButtonPosition;
  positionMargin?: SpaceLevel;
  size: ButtonSize;
  layout: LayoutConfig;
  /** Avatar configuration for bot and user sides. */
  avatar?: AvatarConfig;
  /** Show delivery/read status ticks on user messages. Default: false. */
  showMessageStatus?: boolean;
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
};

/** Build CSS variable map from a ThemeConfig. */
export function themeToCSS(theme: ThemeConfig): Record<string, string> {
  return {
    "--chativa-primary-color": theme.colors.primary,
    "--chativa-secondary-color": theme.colors.secondary,
    "--chativa-background-color": theme.colors.background,
    "--chativa-text-color": theme.colors.text,
    "--chativa-border-color": theme.colors.border,
  };
}

/** Deep merge a partial theme over a base theme. */
export function mergeTheme(
  base: ThemeConfig,
  overrides: DeepPartial<ThemeConfig>
): ThemeConfig {
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    layout: { ...base.layout, ...(overrides.layout ?? {}) },
  } as ThemeConfig;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
