import { describe, expect, it } from 'vitest';
import { extractCodeBlocks } from './code-blocks';

describe('extractCodeBlocks', () => {
  it('extracts fenced code while ignoring the language label', () => {
    expect(extractCodeBlocks('Example:\n\n```tsx\nexport default function App() {}\n```')).toEqual(['export default function App() {}']);
  });
  it('returns each fenced block in response order', () => {
    expect(extractCodeBlocks('```ts\nconst a = 1;\n``` text ```js\nconst b = 2;\n```')).toEqual(['const a = 1;', 'const b = 2;']);
  });
  it('ignores empty fences and prose without code fences', () => {
    expect(extractCodeBlocks('plain response')).toEqual([]);
    expect(extractCodeBlocks('```ts\n\n```')).toEqual([]);
  });
});
