import { validateWorkspaceFilePath } from './routes';

export type AgentFileAction = {
  type: 'create' | 'update';
  path: string;
  content: string;
  reason: string;
};

export type ParsedAgentOutput = {
  response: string;
  actions: AgentFileAction[];
};

const MAX_ACTIONS = 12;
const MAX_FILE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 2_000_000;

export type AgentFileDisposition = 'create' | 'propose' | 'skip';

export function getAgentFileDisposition(
  actionType: AgentFileAction['type'],
  existingContent: string | null,
  proposedContent: string,
): AgentFileDisposition {
  if (actionType === 'create') return existingContent === null ? 'create' : 'skip';
  if (existingContent === null || existingContent === proposedContent) return 'skip';
  return 'propose';
}

export function parseAgentOutput(raw: unknown): ParsedAgentOutput {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('The AI returned an empty response.');
  }

  let source = raw.trim();
  if (source.startsWith('```')) {
    source = source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('The AI response was not valid structured JSON. Please retry the task.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The AI response must be a JSON object.');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.response !== 'string' || !record.response.trim() || record.response.length > 20_000) {
    throw new Error('The AI response is missing its explanation or exceeds the response limit.');
  }

  const rawActions = record.actions === undefined ? [] : record.actions;
  if (!Array.isArray(rawActions) || rawActions.length > MAX_ACTIONS) {
    throw new Error(`The AI may return at most ${MAX_ACTIONS} file actions per request.`);
  }

  const actions: AgentFileAction[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const item of rawActions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('An AI file action has an invalid shape.');
    }
    const action = item as Record<string, unknown>;
    if (action.type !== 'create' && action.type !== 'update') {
      throw new Error('AI file actions may only create or update files.');
    }
    const path = typeof action.path === 'string' ? action.path.trim().replace(/^\/+/, '') : '';
    const pathError = validateWorkspaceFilePath(path);
    if (pathError) throw new Error(`The AI proposed an invalid file path: ${pathError}`);
    const key = path.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`The AI returned more than one action for ${path}.`);
    seen.add(key);

    if (typeof action.content !== 'string') {
      throw new Error(`The AI did not provide complete file content for ${path}.`);
    }
    const bytes = new TextEncoder().encode(action.content).byteLength;
    if (bytes > MAX_FILE_BYTES) throw new Error(`The generated file ${path} exceeds 1 MB.`);
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('The generated files exceed the 2 MB request limit.');

    const reason = typeof action.reason === 'string' ? action.reason.trim().slice(0, 500) : '';
    actions.push({ type: action.type, path, content: action.content, reason });
  }

  return { response: record.response.trim(), actions };
}
