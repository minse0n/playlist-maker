export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getLlmConfig(): LlmConfig {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_DEFAULT_MODEL;
  if (!baseUrl) throw new Error("LLM_BASE_URL is not set");
  if (!apiKey) throw new Error("LLM_API_KEY is not set");
  if (!model) throw new Error("LLM_DEFAULT_MODEL is not set");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

export class LlmHttpError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(body);
    this.name = "LlmHttpError";
  }
}

/** Calls an OpenAI-compatible /chat/completions endpoint and returns the assistant message text. */
export async function chatCompletion(params: {
  system: string;
  user: string;
  jsonMode: boolean;
}): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      ...(params.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new LlmHttpError(res.status, await res.text());

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}
