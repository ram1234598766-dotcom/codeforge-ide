export type WorkspaceConsoleFile = {
  path: string;
  content: string;
};

export type WorkspaceConsoleContext = {
  workspaceName: string;
  workspaceId: string;
  files: WorkspaceConsoleFile[];
  selectedPath: string;
  dirty: boolean;
  email?: string | null;
};

export type WorkspaceConsoleResult = {
  lines: string[];
  openPath?: string;
  clear?: boolean;
};

const HELP = [
  'CodeForge workspace console — read-only file commands',
  'help                         Show this help',
  'pwd                          Show the current workspace path',
  'ls [prefix]                  List files (optionally under a path)',
  'tree                         Show workspace files',
  'cat <path>                   Print a file',
  'head <path> [lines]          Print the first 1–100 lines',
  'wc <path>                    Count lines and characters',
  'grep <text>                  Search file contents',
  'open <path>                  Open a file in the editor',
  'status                       Show workspace and editor status',
  'clear                        Clear console output',
  'Note: this console reads workspace files; it does not run OS shell commands.',
];

function fileByPath(files: WorkspaceConsoleFile[], path: string) {
  return files.find(file => file.path === path.replace(/^\.\//, '').replace(/^\/+/, ''));
}

function output(lines: string[]): WorkspaceConsoleResult {
  return { lines: lines.slice(0, 200) };
}

export function runWorkspaceConsoleCommand(
  input: string,
  context: WorkspaceConsoleContext,
): WorkspaceConsoleResult {
  const source = input.trim();
  if (!source) return output([]);
  const separator = source.search(/\s/);
  const command = (separator < 0 ? source : source.slice(0, separator)).toLowerCase();
  const args = separator < 0 ? '' : source.slice(separator).trim();
  const files = [...context.files].sort((a, b) => a.path.localeCompare(b.path));

  switch (command) {
    case 'help':
      return output(HELP);
    case 'pwd':
      return output([`/workspace/${context.workspaceName || context.workspaceId}`]);
    case 'ls': {
      const prefix = args.replace(/^\.\//, '').replace(/^\/+/, '');
      const matches = files.filter(file => !prefix || file.path.startsWith(prefix));
      return output(matches.length ? matches.map(file => file.path) : ['(no files found)']);
    }
    case 'tree':
      return output(files.length
        ? files.map(file => `${'  '.repeat(Math.max(0, file.path.split('/').length - 1)}${file.path.split('/').at(-1)}`)
        : ['(empty workspace)']);
    case 'cat':
    case 'head':
    case 'wc': {
      const parts = args.split(/\s+/).filter(Boolean);
      const path = command === 'head' && parts.length > 1 && /^\d+$/.test(parts.at(-1) || '')
        ? parts.slice(0, -1).join(' ')
        : args;
      const file = fileByPath(files, path);
      if (!file) return output([`File not found: ${path || '(missing path)'}`]);
      const lines = file.content.split('\n');
      if (command === 'cat') return output(file.content.slice(0, 16000).split('\n').concat(file.content.length > 16000 ? ['… output truncated at 16,000 characters'] : []));
      if (command === 'head') {
        const count = parts.length > 1 && /^\d+$/.test(parts.at(-1) || '') ? Math.min(100, Math.max(1, Number(parts.at(-1)))) : 10;
        return output(lines.slice(0, count));
      }
      return output([`${lines.length} lines  ${file.content.length} characters  ${file.path}`]);
    }
    case 'grep': {
      if (args.length < 2) return output(['Usage: grep <at least 2 characters>']);
      const needle = args.toLocaleLowerCase();
      const matches: string[] = [];
      for (const file of files) {
        const lines = file.content.split('\n');
        for (let index = 0; index < lines.length; index += 1) {
          if (lines[index].toLocaleLowerCase().includes(needle)) {
            matches.push(`${file.path}:${index + 1}: ${lines[index].trim().slice(0, 240)}`);
            if (matches.length >= 100) break;
          }
        }
        if (matches.length >= 100) break;
      }
      return output(matches.length ? matches : ['(no matches)']);
    }
    case 'open': {
      const file = fileByPath(files, args);
      return file ? { lines: [`Opening ${file.path}`], openPath: file.path } : output([`File not found: ${args || '(missing path)'}`]);
    }
    case 'status':
      return output([
        `Workspace: ${context.workspaceName || context.workspaceId}`,
        `Files: ${files.length}`,
        `Editor: ${context.dirty ? 'unsaved changes' : 'clean'}`,
        `Active file: ${context.selectedPath || '(none)'}`,
        `Account: ${context.email || '(authenticated user)'}`,
      ]);
    case 'clear':
      return { lines: [], clear: true };
    default:
      return output([`Command not found: ${command}. Run "help" to see supported workspace commands.`]);
  }
}
