/**
 * Schema-drift guard for the message, conversation, survey, tool-call and
 * GenUI chunk entities.
 *
 * Same two-sided check as `value-objects/__tests__/schema-drift.test.ts`:
 *
 * 1. **Compile-time contract** — `EXPECTED_*` constants use a mapped type
 *    `{ [K in keyof Required<T>]: true }`. Adding or removing a field on the
 *    TypeScript type without updating the constant fails `pnpm typecheck`.
 *
 * 2. **Runtime check** — the paired JSON Schema under `schemas/` is read and
 *    its `properties` keys must exactly match the constant. A schema-only
 *    change fails `pnpm test`.
 *
 * For the `AIChunk` discriminated union, every `oneOf` variant is matched by
 * its `type` const and compared against the corresponding TS interface. The
 * `EXPECTED_AI_CHUNK` map is keyed by `AIChunk["type"]`, so adding a new
 * variant to the union also fails typecheck until it is listed here.
 *
 * See `AGENTS.md → Schema Sync Rule` and `schemas/README.md`.
 */

import { describe, it, expect } from "vitest";
import incomingMessageSchema from "../../../../../../schemas/messages/incoming-message.schema.json";
import outgoingMessageSchema from "../../../../../../schemas/messages/outgoing-message.schema.json";
import messageActionSchema from "../../../../../../schemas/messages/message-action.schema.json";
import historyResultSchema from "../../../../../../schemas/messages/history-result.schema.json";
import conversationSchema from "../../../../../../schemas/messages/conversation.schema.json";
import surveyPayloadSchema from "../../../../../../schemas/messages/survey-payload.schema.json";
import toolCallSchema from "../../../../../../schemas/messages/tool-call.schema.json";
import aiChunkSchema from "../../../../../../schemas/genui/ai-chunk.schema.json";
import type {
  IncomingMessage,
  OutgoingMessage,
  MessageAction,
  HistoryResult,
} from "../Message";
import type { Conversation } from "../Conversation";
import type { ToolCall } from "../ToolCall";
import type { AIChunk, AIChunkText, AIChunkUI, AIChunkEvent } from "../GenUI";
import type { SurveyPayload } from "../../ports/IConnector";

// ── Compile-time contracts ─────────────────────────────────────────────

const EXPECTED_INCOMING_MESSAGE: {
  [K in keyof Required<IncomingMessage>]: true;
} = {
  id: true,
  type: true,
  from: true,
  data: true,
  timestamp: true,
  actions: true,
};

const EXPECTED_OUTGOING_MESSAGE: {
  [K in keyof Required<OutgoingMessage>]: true;
} = {
  id: true,
  type: true,
  data: true,
  timestamp: true,
};

const EXPECTED_MESSAGE_ACTION: {
  [K in keyof Required<MessageAction>]: true;
} = {
  label: true,
  value: true,
  url: true,
};

const EXPECTED_HISTORY_RESULT: {
  [K in keyof Required<HistoryResult>]: true;
} = {
  messages: true,
  hasMore: true,
  cursor: true,
};

const EXPECTED_CONVERSATION: { [K in keyof Required<Conversation>]: true } = {
  id: true,
  title: true,
  contact: true,
  avatar: true,
  lastMessage: true,
  lastMessageAt: true,
  unreadCount: true,
  status: true,
  metadata: true,
};

const EXPECTED_SURVEY_PAYLOAD: {
  [K in keyof Required<SurveyPayload>]: true;
} = {
  rating: true,
  comment: true,
  kind: true,
};

const EXPECTED_TOOL_CALL: { [K in keyof Required<ToolCall>]: true } = {
  id: true,
  name: true,
  description: true,
  status: true,
  params: true,
  result: true,
  error: true,
  startedAt: true,
  endedAt: true,
};

const EXPECTED_AI_CHUNK_TEXT: { [K in keyof Required<AIChunkText>]: true } = {
  type: true,
  content: true,
  id: true,
};

const EXPECTED_AI_CHUNK_UI: { [K in keyof Required<AIChunkUI>]: true } = {
  type: true,
  component: true,
  props: true,
  id: true,
};

const EXPECTED_AI_CHUNK_EVENT: { [K in keyof Required<AIChunkEvent>]: true } =
  {
    type: true,
    name: true,
    payload: true,
    id: true,
    for: true,
  };

/** One entry per `AIChunk` variant, keyed by its `type` discriminant. */
const EXPECTED_AI_CHUNK: {
  [K in AIChunk["type"]]: Record<string, true>;
} = {
  text: EXPECTED_AI_CHUNK_TEXT,
  ui: EXPECTED_AI_CHUNK_UI,
  event: EXPECTED_AI_CHUNK_EVENT,
};

// ── Schema accessor ────────────────────────────────────────────────────

interface JsonSchema {
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  oneOf?: JsonSchema[];
}

function asSchema(schema: unknown): JsonSchema {
  return schema as JsonSchema;
}

function keys(obj: Record<string, unknown> | undefined): string[] {
  return Object.keys(obj ?? {}).sort();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("schema drift — schemas/messages/*.schema.json ↔ domain entities", () => {
  it("IncomingMessage fields match messages/incoming-message.schema.json", () => {
    expect(keys(asSchema(incomingMessageSchema).properties)).toEqual(
      keys(EXPECTED_INCOMING_MESSAGE),
    );
  });

  it("OutgoingMessage fields match messages/outgoing-message.schema.json", () => {
    expect(keys(asSchema(outgoingMessageSchema).properties)).toEqual(
      keys(EXPECTED_OUTGOING_MESSAGE),
    );
  });

  it("MessageAction fields match messages/message-action.schema.json", () => {
    expect(keys(asSchema(messageActionSchema).properties)).toEqual(
      keys(EXPECTED_MESSAGE_ACTION),
    );
  });

  it("HistoryResult fields match messages/history-result.schema.json", () => {
    expect(keys(asSchema(historyResultSchema).properties)).toEqual(
      keys(EXPECTED_HISTORY_RESULT),
    );
  });

  it("Conversation fields match messages/conversation.schema.json", () => {
    expect(keys(asSchema(conversationSchema).properties)).toEqual(
      keys(EXPECTED_CONVERSATION),
    );
  });

  it("SurveyPayload fields match messages/survey-payload.schema.json", () => {
    expect(keys(asSchema(surveyPayloadSchema).properties)).toEqual(
      keys(EXPECTED_SURVEY_PAYLOAD),
    );
  });

  it("ToolCall fields match messages/tool-call.schema.json", () => {
    expect(keys(asSchema(toolCallSchema).properties)).toEqual(
      keys(EXPECTED_TOOL_CALL),
    );
  });
});

describe("schema drift — schemas/genui/ai-chunk.schema.json ↔ AIChunk", () => {
  const variants = asSchema(aiChunkSchema).oneOf ?? [];

  it("oneOf variants match the AIChunk union members", () => {
    const discriminants = variants
      .map((v) => String(v.properties?.type?.const))
      .sort();
    expect(discriminants).toEqual(keys(EXPECTED_AI_CHUNK));
  });

  for (const [type, expected] of Object.entries(EXPECTED_AI_CHUNK)) {
    it(`AIChunk variant "${type}" fields match its oneOf entry`, () => {
      const variant = variants.find((v) => v.properties?.type?.const === type);
      expect(variant, `no oneOf variant with type const "${type}"`).toBeDefined();
      expect(keys(variant?.properties)).toEqual(keys(expected));
    });
  }
});
