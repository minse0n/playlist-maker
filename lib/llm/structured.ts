import type { ZodType } from "zod";
import { chatCompletion, LlmHttpError } from "@/lib/llm/client";
import { withBackoff } from "@/lib/retry";

/**
 * Asks the LLM for JSON matching `jsonSchema`, validates the response against
 * `zodSchema`, and on validation failure sends the invalid JSON plus the Zod issues
 * back once, asking for a corrected response, before giving up.
 */
export async function generateStructured<T>(params: {
  prompt: string;
  jsonSchema: object;
  zodSchema: ZodType<T>;
}): Promise<T> {
  const { prompt, jsonSchema, zodSchema } = params;

  const system = `You are a JSON API. Respond with ONLY a single JSON object that conforms to this JSON Schema, with no markdown fences and no commentary:\n${JSON.stringify(jsonSchema)}`;

  const call = (user: string) =>
    withBackoff(async () => {
      try {
        return await chatCompletion({ system, user, jsonMode: true });
      } catch (err) {
        // Some OpenAI-compatible servers reject response_format; retry once in plain mode.
        if (err instanceof LlmHttpError && err.status === 400) {
          return chatCompletion({ system, user, jsonMode: false });
        }
        throw err;
      }
    });

  const firstText = await call(prompt);
  const firstAttempt = safeJsonParse(firstText);

  let issues: string;
  if (firstAttempt.ok) {
    const firstResult = zodSchema.safeParse(firstAttempt.value);
    if (firstResult.success) return firstResult.data;
    issues = JSON.stringify(firstResult.error.issues, null, 2);
  } else {
    issues = `Response was not valid JSON: ${firstAttempt.error}`;
  }

  const repairPrompt = `Your previous response did not match the required schema.

Previous response:
${firstText}

Validation issues:
${issues}

Return ONLY corrected JSON matching the schema exactly. Do not include any explanation.`;

  const secondAttempt = safeJsonParse(await call(repairPrompt));
  if (!secondAttempt.ok) {
    throw new Error(`LLM repair attempt returned invalid JSON: ${secondAttempt.error}`);
  }
  const secondResult = zodSchema.safeParse(secondAttempt.value);
  if (!secondResult.success) {
    throw new Error(`LLM repair attempt still failed schema validation: ${secondResult.error.message}`);
  }
  return secondResult.data;
}

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
