export type OllamaModel = {
  name: string;
  size?: number;
  modified_at?: string;
};

export type OllamaCompletion = {
  content: string;
  model: string;
};

/** Restricts a browser-configured Ollama endpoint to loopback addresses only. */
export function normalizeOllamaBaseUrl(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter the local Ollama address.');
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Ollama address must be a valid URL such as http://127.0.0.1:11434.');
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      !loopbackHosts.has(parsed.hostname.toLowerCase()) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new Error('For safety, Ollama must be reachable at localhost, 127.0.0.1, or ::1 without URL credentials or a custom path.');
  }
  return parsed.origin;
}

export async function listOllamaModels(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<OllamaModel[]> {
  const base = normalizeOllamaBaseUrl(baseUrl);
  let response: Response;
  try {
    response = await fetcher(`${base}/api/tags`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error('Cannot reach Ollama. Start Ollama, then allow the CodeForge site origin in OLLAMA_ORIGINS and retry.');
  }
  if (!response.ok) throw new Error(`Ollama model discovery failed (HTTP ${response.status}).`);
  const payload = await response.json() as { models?: unknown };
  if (!Array.isArray(payload.models)) throw new Error('Ollama returned an unexpected model-list response.');
  return payload.models.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const model = item as Record<string, unknown>;
    const name = typeof model.name === 'string' ? model.name : typeof model.model === 'string' ? model.model : '';
    if (!name || name.length > 200) return [];
    return [{
      name,
      ...(typeof model.size === 'number' ? { size: model.size } : {}),
      ...(typeof model.modified_at === 'string' ? { modified_at: model.modified_at } : {}),
    }];
  });
}

export async function runOllamaAgent(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  fetcher: typeof fetch = fetch,
): Promise<OllamaCompletion> {
  const base = normalizeOllamaBaseUrl(baseUrl);
  const selectedModel = model.trim();
  if (!selectedModel || selectedModel.length > 200) throw new Error('Choose an installed Ollama model in Settings.');
  let response: Response;
  try {
    response = await fetcher(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
        max_tokens: 8192,
        temperature: 0.15,
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    throw new Error('Ollama is unreachable or blocked by browser CORS. Start Ollama and set OLLAMA_ORIGINS to the exact CodeForge website origin.');
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Ollama returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`);
  }
  const payload = await response.json() as {
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('The selected Ollama model returned no assistant content.');
  if (new TextEncoder().encode(content).byteLength > 2_000_000) throw new Error('Ollama output exceeded the 2 MB response limit.');
  return {
    content,
    model: typeof payload.model === 'string' && payload.model.length <= 200 ? payload.model : selectedModel,
  };
}
