import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, BrainCircuit, ChevronRight, Code2, GitBranch, Play, Search, Settings2, Sparkles, Terminal, X, Zap } from 'lucide-react';
import './styles.css';
import { supabaseConfig } from './lib/supabase';
import { listWorkspaces, type Workspace } from './lib/workspaces';

type Panel = 'explorer' | 'source' | 'agents' | 'terminal' | 'activity';
const files = [
  { path: 'src/App.tsx', language: 'tsx' },
  { path: 'src/agent/orchestrator.ts', language: 'ts' },
  { path: 'src/lib/supabase.ts', language: 'ts' },
  { path: 'README.md', language: 'md' },
];
const snippets: Record<string, string[]> = {
  'src/App.tsx': ["import { useState } from 'react';", "import { AgentPanel } from './agent';", '', 'export default function App() {', "  const [mode, setMode] = useState('focus')", '', '  return (', '    <Workspace mode={mode}>', "      <AgentPanel capabilities={['plan', 'edit', 'test']}", '        approvalMode="guarded"', '      />', '    </Workspace>', '  )', '}'],
  'src/agent/orchestrator.ts': ["export type AgentMode = 'plan' | 'edit' | 'review'", '', 'export async function runAgent(prompt: string) {', '  return { status: "awaiting-approval", prompt }', '}'],
  'src/lib/supabase.ts': ["const url = import.meta.env.VITE_SUPABASE_URL", "const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY", '', 'export const configured = Boolean(url && key)'],
  'README.md': ['# CodeForge', '', 'A customizable AI-native development environment.'],
};

function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [connection, setConnection] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [prompt, setPrompt] = useState('');
  const [activity, setActivity] = useState('Ready to build');
  const [selectedFile, setSelectedFile] = useState(files[0].path);
  const [panel, setPanel] = useState<Panel>('explorer');
  const [searchOpen, setSearchOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');

  useEffect(() => {
    if (!supabaseConfig.configured) { setConnection('offline'); return; }
    listWorkspaces().then((items) => { setWorkspaces(items); setConnection('connected'); }).catch(() => setConnection('offline'));
  }, []);

  const code = useMemo(() => snippets[selectedFile] ?? [], [selectedFile]);
  const runAgent = (task = prompt) => {
    const value = task.trim();
    if (!value) return;
    setRunState('running'); setActivity(`Planning: ${value}`); setPrompt('');
    window.setTimeout(() => { setRunState('done'); setActivity(`Completed: ${value}`); }, 900);
  };
  const runProject = () => {
    setRunState('running'); setActivity('Running project checks…');
    window.setTimeout(() => { setRunState('done'); setActivity('Checks passed — ready to ship'); }, 1000);
  };
  const panelTitle = panel === 'explorer' ? 'EXPLORER' : panel === 'source' ? 'SOURCE CONTROL' : panel === 'agents' ? 'AGENTS' : panel === 'terminal' ? 'TERMINAL' : 'ACTIVITY';

  return <main className="shell">
    <header className="topbar">
      <button className="brand brand-button" onClick={() => { setPanel('explorer'); setActivity('Ready to build'); }}><span className="mark"><Sparkles size={17}/></span><span>CodeForge</span><b>ALPHA</b></button>
      <button className="workspace workspace-button" onClick={() => setActivity(`${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'} available`)}><span className="status-dot"/> {workspaces[0]?.name ?? 'personal / codeforge-ide'} <ChevronRight size={14}/> main</button>
      <div className="top-actions"><button onClick={() => setSearchOpen(true)}><Search size={16}/> Search</button><button className="run" onClick={runProject}><Play size={15} fill="currentColor"/> {runState === 'running' ? 'Running…' : 'Run'}</button><button className="avatar" onClick={() => setActivity('Profile settings are ready')}>MK</button></div>
    </header>
    <section className="layout">
      <aside className="rail">{([['explorer', Code2], ['source', GitBranch], ['agents', BrainCircuit], ['terminal', Terminal], ['activity', Activity]] as const).map(([name, Icon]) => <button className={panel === name ? 'rail-button selected' : 'rail-button'} key={name} onClick={() => { setPanel(name); if (name === 'terminal') setTerminalOpen(true); }} title={name}><Icon/></button>)}</aside>
      <aside className="sidebar"><div className="side-title"><span>{panelTitle}</span><button className="icon-button" onClick={() => setActivity(`${panelTitle.toLowerCase()} refreshed`)}>↻</button></div>{panel === 'explorer' ? <><div className="tree"><div className="folder">⌄ <span>CODEFORGE-IDE</span></div>{files.map((file) => <button className={'file ' + (selectedFile === file.path ? 'active' : '')} key={file.path} onClick={() => { setSelectedFile(file.path); setActivity(`Opened ${file.path}`); }}><span className="file-dot"/> {file.path}</button>)}</div><div className="agent-card"><div className="agent-head"><span className="pulse"/> ORCHESTRATOR</div><h3>{activity}</h3><p>Plan, implement, test, and review in one controlled loop.</p><button onClick={() => { setPanel('agents'); setActivity('Agent console opened'); }}>Open agent console <ChevronRight size={14}/></button></div></> : <div className="panel-empty"><Settings2 size={18}/><strong>{panelTitle}</strong><span>Choose an action from the command center.</span><button onClick={() => setPanel('explorer')}>Back to explorer</button></div>}</aside>
      <div className="editor"><div className="tabs"><button className="tab active">{selectedFile.split('/').pop()} <X size={12}/></button><button className="tab" onClick={() => setSelectedFile('src/agent/orchestrator.ts')}>orchestrator.ts</button><button className="tab add" onClick={() => setActivity('New file action selected')}>+</button></div><div className="code"><div className="gutter">{code.map((_, i) => <span key={i}>{i + 1}</span>)}</div><pre><code>{code.map((line, i) => <React.Fragment key={i}><span className={line.includes('import') || line.includes('export') ? 'kw' : line.includes("'") || line.includes('"') ? 'str' : line.includes('<') ? 'tag' : ''}>{line}</span>{'\n'}</React.Fragment>)}</code></pre></div><div className="bottom"><span><span className="green">●</span> TypeScript</span><span>{connection === 'connected' ? 'Supabase connected' : connection === 'offline' ? 'Supabase not configured' : 'Connecting…'}</span><span>UTF-8</span><span>Prettier</span></div>{terminalOpen && <div className="terminal-drawer"><div><b>TERMINAL</b><button onClick={() => setTerminalOpen(false)}><X size={14}/></button></div><code>$ pnpm test{ '\n'}✓ workspace checks passed{ '\n'}$ _</code></div>}</div>
      <aside className="inspector"><div className="inspector-title">AI COMMAND CENTER <span>⌘K</span></div><div className="prompt"><div className="spark"><Sparkles size={16}/></div><p>What should we build next?</p><div className="prompt-input"><input aria-label="AI task" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runAgent()} placeholder="Describe a task in natural language…"/><button onClick={() => runAgent()} aria-label="Run AI task"><ChevronRight size={16}/></button></div><div className="chips"><button onClick={() => runAgent('Review this file')}>Review this file</button><button onClick={() => runAgent('Find bugs')}>Find bugs</button><button onClick={() => runAgent('Write tests')}>Write tests</button></div></div><div className="run-card"><div className="run-label"><span className="green">●</span> {runState === 'running' ? 'LIVE SESSION' : runState === 'done' ? 'SESSION COMPLETE' : 'READY'} <span>guarded mode</span></div><h3>{activity}</h3><div className="progress"><i className={runState === 'running' ? 'running' : runState === 'done' ? 'complete' : ''}/></div><div className="steps"><div>✓ Understand repository</div><div>✓ Design implementation</div><div className="current"><Zap size={13}/> {runState === 'done' ? 'Review result' : 'Awaiting your next task'}</div></div></div><div className="metrics"><div><span>WORKSPACES</span><strong>{workspaces.length}</strong></div><div><span>CONNECTION</span><strong>{connection === 'connected' ? 'LIVE' : 'OFF'}</strong></div><div><span>CONTEXT</span><strong>82%</strong></div></div></aside>
    </section>{searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="search-modal" onClick={(event) => event.stopPropagation()}><div><b>Search workspace</b><button onClick={() => setSearchOpen(false)}><X size={16}/></button></div><input autoFocus placeholder="Search files, symbols, commands…" onKeyDown={(event) => event.key === 'Enter' && setSearchOpen(false)}/><small>Press Enter to close · Search indexing is ready for the next workspace sync.</small></div></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
