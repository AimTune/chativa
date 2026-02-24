import { DEFAULT_THEME, mergeTheme } from "./Theme";
import type {
  ThemeConfig,
  ThemeColors,
  LayoutConfig,
  ButtonPosition,
  ButtonSize,
  SpaceLevel,
  AvatarConfig,
  DeepPartial,
} from "./Theme";

/**
 * ThemeBuilder — fluent builder for ThemeConfig.
 *
 * Pure TypeScript. No external imports. Domain layer only.
 *
 * @example
 * ```ts
 * const theme = ThemeBuilder.create()
 *   .setPrimary("#e11d48")
 *   .setSize("large")
 *   .setPosition("bottom-left")
 *   .setShowMessageStatus(true)
 *   .build();
 * ```
 *
 * Note: `allowFullscreen` is a runtime ChatStore setting, not part of ThemeConfig.
 * Use `chatStore.getState().setAllowFullscreen(true)` to control it separately.
 */
export class ThemeBuilder {
  private _overrides: DeepPartial<ThemeConfig> = {};

  static create(): ThemeBuilder {
    return new ThemeBuilder();
  }

  setPrimary(value: string): this {
    this._overrides.colors = { ...this._overrides.colors, primary: value };
    return this;
  }

  setSecondary(value: string): this {
    this._overrides.colors = { ...this._overrides.colors, secondary: value };
    return this;
  }

  setBackground(value: string): this {
    this._overrides.colors = { ...this._overrides.colors, background: value };
    return this;
  }

  setText(value: string): this {
    this._overrides.colors = { ...this._overrides.colors, text: value };
    return this;
  }

  setBorder(value: string): this {
    this._overrides.colors = { ...this._overrides.colors, border: value };
    return this;
  }

  /** Override multiple colors at once. Only the provided keys are changed. */
  setColors(colors: Partial<ThemeColors>): this {
    this._overrides.colors = { ...this._overrides.colors, ...colors };
    return this;
  }

  setPosition(value: ButtonPosition): this {
    this._overrides.position = value;
    return this;
  }

  setSize(value: ButtonSize): this {
    this._overrides.size = value;
    return this;
  }

  setPositionMargin(value: SpaceLevel): this {
    this._overrides.positionMargin = value;
    return this;
  }

  /** Override layout fields. Only the provided keys are changed. */
  setLayout(layout: Partial<LayoutConfig>): this {
    this._overrides.layout = { ...this._overrides.layout, ...layout };
    return this;
  }

  setAvatar(avatar: AvatarConfig): this {
    this._overrides.avatar = avatar;
    return this;
  }

  setShowMessageStatus(value: boolean): this {
    this._overrides.showMessageStatus = value;
    return this;
  }

  /** Merge accumulated overrides with DEFAULT_THEME and return the result. */
  build(): ThemeConfig {
    return mergeTheme(DEFAULT_THEME, this._overrides);
  }
}
