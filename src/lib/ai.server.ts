/**
 * Server-only AI helpers.
 *
 * Text generation talks to any OpenAI-compatible endpoint (`AI_BASE_URL`).
 * Video generation talks to an endpoint that exposes an async `/videos` job API.
 * Both are configured entirely through environment variables, so the app is not
 * tied to any single provider.
 */

export class AiGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AiGatewayError";
  }
}

function textConfig() {
  const baseUrl = process.env["AI_BASE_URL"] ?? "https://api.openai.com/v1";
  const apiKey = process.env["AI_API_KEY"];
  const model = process.env["AI_TEXT_MODEL"] ?? "gpt-4.1-mini";
  if (!apiKey) throw new Error("AI_API_KEY is not configured.");
  return { baseUrl, apiKey, model };
}

function videoConfig() {
  const baseUrl = process.env["AI_VIDEO_BASE_URL"] ?? process.env["AI_BASE_URL"];
  const apiKey = process.env["AI_VIDEO_API_KEY"] ?? process.env["AI_API_KEY"];
  const model = process.env["AI_VIDEO_MODEL"];
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Video generation is not configured (AI_VIDEO_* variables).");
  }
  return { baseUrl, apiKey, model };
}

async function readError(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
    return parsed.message ?? parsed.error?.message ?? raw.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

/** Chat-completions call with a strict JSON schema response. */
export async function generateStructured<T>(options: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Kept for models that support a reasoning-effort hint; ignored otherwise. */
  reasoningEffort?: "low" | "medium" | "high";
}): Promise<T> {
  const { baseUrl, apiKey, model } = textConfig();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: options.instructions },
        { role: "user", content: options.input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
    }),
  });

  if (!res.ok) throw new AiGatewayError(res.status, await readError(res));

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new AiGatewayError(502, "The AI service returned no result.");
  return JSON.parse(text) as T;
}

export async function createVideoJob(prompt: string): Promise<string> {
  const { baseUrl, apiKey, model } = videoConfig();
  const res = await fetch(`${baseUrl}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt, size: "1280x720", seconds: "8" }),
  });
  if (!res.ok) throw new AiGatewayError(res.status, await readError(res));
  const job = (await res.json()) as { id: string };
  return job.id;
}

export interface VideoJobStatus {
  status: string;
  progress?: number;
  error?: { code?: string; message?: string };
}

export async function getVideoJob(jobId: string): Promise<VideoJobStatus> {
  const { baseUrl, apiKey } = videoConfig();
  const res = await fetch(`${baseUrl}/videos/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new AiGatewayError(res.status, await readError(res));
  return (await res.json()) as VideoJobStatus;
}

export async function downloadVideo(jobId: string): Promise<ArrayBuffer> {
  const { baseUrl, apiKey } = videoConfig();
  const res = await fetch(`${baseUrl}/videos/${jobId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new AiGatewayError(res.status, await readError(res));
  return await res.arrayBuffer();
}

/** Turns a step's plain visual description into a 3D-animation render brief. */
export function buildThreeDPrompt(
  visualPrompt: string,
  stepTitle: string,
  objectOnly = false,
): string {
  return [
    "Stylized 3D animated instructional short, cinematic soft studio lighting,",
    "clean uncluttered environment, shallow depth of field,",
    "in a single continuous shot with gentle camera movement.",
    `Scene: ${visualPrompt || stepTitle}`,
    objectOnly
      ? "Use only inanimate objects and simple animated motion cues. No people, children, human figures, faces, anatomy, or bodily actions."
      : "An adult cartoon character clearly performs the action from start to finish so the instruction is easy to follow.",
    "No on-screen text, no captions, no watermarks, no logos, no dialogue. Soft ambient background music only.",
  ].join(" ");
}

/** Rewrites a scene a safety filter rejected into a neutral object-only version. */
export async function rewriteVisualPromptForSafety(
  visualPrompt: string,
  stepTitle: string,
): Promise<string> {
  const result = await generateStructured<{ visual_prompt: string }>({
    instructions: [
      "You rewrite short scene descriptions for a family-friendly 3D animation model.",
      "Represent the instructional idea using only inanimate tabletop objects, simple motion cues,",
      "and abstract symbols. Do not include people, children, human figures, faces, anatomy,",
      "bodily actions, bathrooms, bodily fluids, medical detail, brand names, or real people.",
      "Keep the result neutral, clearly stylized, and family-friendly. One sentence, English only.",
    ].join(" "),
    input: `Step title: ${stepTitle}\nScene: ${visualPrompt}`,
    schemaName: "safe_visual_prompt",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["visual_prompt"],
      properties: { visual_prompt: { type: "string" } },
    },
  });
  return result.visual_prompt?.trim() || visualPrompt;
}

/** Backwards-compatible alias. */
export { AiGatewayError as AiError };
