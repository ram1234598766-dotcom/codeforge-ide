import { describe, expect, it } from 'vitest';
import { parseAgentOutput } from '../agents';

describe('parseAgentOutput', () => {
  it('parses a response and complete file creation actions', () => {
    expect(parseAgentOutput(JSON.stringify({
      response: 'Created a starter app.',
      actions: [{ type: 'create', path: 'src/App.tsx', content: 'export default function App() {}', reason: 'App entry point' }],
    }))).toEqual({
      response: 'Created a starter app.',
      actions: [{ type: 'create', path: 'src/App.tsx', content: 'export default function App() {}', reason: 'App entry point' }],
    });
  });

  it('accepts fenced JSON from a provider', () => {
    expect(parseAgentOutput('```json\n{"response":"Done","actions":[]}\n```')).toEqual({ response: 'Done', actions: [] });
  });

  it('allows explanatory responses with no file changes', () => {
    expect(parseAgentOutput(JSON.stringify({ response: 'Here is the review.' }))).toEqual({ response: 'Here is the review.', actions: [] });
  });

  it('rejects invalid JSON and invalid paths', () => {
    expect(() => parseAgentOutput('not json')).toThrow('not valid structured JSON');
    expect(() => parseAgentOutput(JSON.stringify({
      response: 'No.',
      actions: [{ type: 'create', path: '../secrets.txt', content: 'secret' }],
    }))).toThrow('invalid file path');
  });

  it('rejects unsupported operations and duplicate paths', () => {
    expect(() => parseAgentOutput(JSON.stringify({
      response: 'No.',
      actions: [{ type: 'delete', path: 'src/App.tsx', content: '' }],
    }))).toThrow('only create or update');
    expect(() => parseAgentOutput(JSON.stringify({
      response: 'No.',
      actions: [
        { type: 'create', path: 'src/App.tsx', content: 'a' },
        { type: 'update', path: 'SRC/app.tsx', content: 'b' },
      ],
    }))).toThrow('more than one action');
  });

  it('enforces per-file, total byte, and action-count limits', () => {
    expect(() => parseAgentOutput(JSON.stringify({
      response: 'Large file',
      actions: [{ type: 'create', path: 'large.txt', content: 'x'.repeat(1_000_001) }],
    }))).toThrow('exceeds 1 MB');
    expect(() => parseAgentOutput(JSON.stringify({
      response: 'Too many files',
      actions: Array.from({ length: 13 }, (_, index) => ({ type: 'create', path: `file-${index}.txt`, content: 'x' })),
    }))).toThrow('at most 12');
  });
});
