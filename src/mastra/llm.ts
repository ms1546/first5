import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateObject } from "ai";
import type { ZodTypeAny, z } from "zod";
import { createLLMTrace } from "./telemetry/llmTelemetry";

const DEFAULT_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0";
const AWS_REGION = process.env.AWS_REGION ?? "ap-northeast-1";
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const MAX_TOKENS = Number(
  process.env.BEDROCK_MAX_OUTPUT_TOKENS ?? DEFAULT_MAX_OUTPUT_TOKENS
);

const bedrock = createAmazonBedrock({
  region: AWS_REGION,
});

export class LLMStructuredError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "LLMStructuredError";
    this.cause = cause;
  }
}

type StructuredParams<TSchema extends ZodTypeAny> = {
  schema: TSchema;
  system: string;
  prompt: string;
  modelId?: string;
  maxOutputTokens?: number;
  context?: {
    step: string;
  };
};

export async function callBedrockStructured<TSchema extends ZodTypeAny>(
  params: StructuredParams<TSchema>
): Promise<z.infer<TSchema>> {
  const {
    schema,
    system,
    prompt,
    modelId = DEFAULT_MODEL_ID,
    maxOutputTokens,
    context,
  } = params;
  const trace = createLLMTrace({
    step: context?.step ?? "unknown-step",
    modelId,
  });

  try {
    const result = await generateObject({
      model: bedrock.languageModel(modelId),
      schema,
      maxOutputTokens: maxOutputTokens ?? MAX_TOKENS,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    trace.success(result.usage?.totalTokens ?? null);
    return schema.parse(result.object);
  } catch (error) {
    trace.failure(error);
    throw new LLMStructuredError("Bedrock structured call failed", error);
  }
}
