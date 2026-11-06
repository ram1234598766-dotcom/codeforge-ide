import { describe, expect, it, vi } from 'vitest';
import { listOllamaModels, normalizeOllamaBaseUrl, runOllamaAgent } from '../ollama';

describe('normalizeOllamaBaseUrl', () => {
  it('normalizes a local Ollama address', () => {
    expect(normalizeOllamaBaseUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
  });

  it('rejects remote, credential-bearing, invalid, and non-HTTP endpoints', () => {
    expect(() => normalizeOllamaBaseUrl('https://example.com')).toThrow('localhost');
    expect(() => normalizeOllamaBaseUrl('http://user:pass@localhost:11434')).toThrow('localhost');
    expect(() => normalizeOllamaBaseUrl('not a url')).toThrow('valid URL');
    expect(() => normalizeOllamaBaseUrl('http://localhost:11434/api')).toThrow('localhost');
  });
});

describe('Ollama browser connector', () => {
  it('discovers installed model tags without sending an API key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      models: [{ name: 'qwen2.5-coder:7b', size: 123 }, { model: 'llama3.2' }, { name: '' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const models = await listOllamaModels('http://localhost:11434', fetcher);
    expect(models.map(model => model.name)).toEqual(['qwen2.5-coder:7b', 'llama3.2']);
    expect(fetcher.mock.calls[0][0]).toBe('http://localhost:11434/api/tags');
  });

  it('sends the coding prompt directly to the local OpenAI-compatible endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      model: 'qwen2.5-coder:7b',
      choices: [{ message: { content: '{"response":"Done","actions":[]}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const result = await runOllamaAgent('http://localhost:11434', 'qwen2.5-coder:7b', 'system', 'user', fetcher);
    expect(result.content).toContain('"Done"');
    expect(fetcher.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(request.messages[0].content).toBe('system');
    expect(request.response_format).toEqual({ type: 'json_object' });
    expect(request.stream).toBe(false);
    expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty('authorization');
  });

  it('surfaces unreachable and empty-model responses clearly', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listOllamaModels('http://localhost:11434', offline)).rejects.toThrow('Start Ollama');
    const empty = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(runOllamaAgent('http://localhost:11434', 'model', 'system', 'user', empty)).rejects.toThrow('no assistant content');
  });
});
