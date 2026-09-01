import type { DisclaimerConfig } from "@chativa/core";

export interface ResolvedDisclaimerContent {
  bottomText: string;
  conversationStartText: string;
}

/** Resolves the two independent disclaimer positions. */
export function resolveDisclaimerContent(
  disclaimer: DisclaimerConfig | undefined,
): ResolvedDisclaimerContent {
  if (!disclaimer?.enabled) {
    return { bottomText: "", conversationStartText: "" };
  }

  return {
    bottomText: disclaimer.bottomText ?? "",
    conversationStartText: disclaimer.conversationStartText ?? "",
  };
}
