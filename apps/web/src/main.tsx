import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '@monaco-editor/react';
import { Activity, BrainCircuit, Check, ChevronRight, Code2, FilePlus2, GitBranch, LogOut, Pencil, Play, Plus, Save, Search, Settings2, Sparkles, Terminal, Trash2, X, Zap } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import './styles.css';
import { apiRequest, supabase, supabaseConfig } from './lib/supabase';
import {
  createWorkspace, deleteWorkspace, deleteWorkspaceFile, getWorkspaceState, listWorkspaces, listWorkspaceFiles, renameWorkspace, saveWorkspaceFile, saveWorkspaceState,
  type Workspace,
} from './lib/workspaces';

type WorkspaceFile = { id?: string; path: string; content: string; language: string | null };
type Panel = 'explorer' | 'source' | 'agents' | 'terminal' | 'activity';
const starterCode = `import { useState } from 'react';

export default function App() {
  const [message, setMessage] = useState('Hello, CodeForge');

  return (
    <main>
      <h1>{message}</h1>
      <button onClick={() => setMessage('Build something great.')}>
        Get started
      </button>
    </main>
  );
}
`;
const languageFor = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', sql: 'sql', py: 'python' } as Record<string, string>)[ext || ''] || 'plaintext';
};

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError('');
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === 'signup' && !result.data.session) setError('Check your email to confirm your account, then sign in.');
    setBusy(false);
  };
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="auth-brand"><span className="mark"><Sparkles size={18}/></span><b>CodeForge</b><small>AI-NATIVE DEVELOPMENT</small></div>
    <h1>{mode === 'signin' ? 'Welcome back.' : 'Create your workspace.'}</h1>
    <p>Sign in securely to access your projects and saved files.</p>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
    <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? 'New to CodeForge? Create an account' : 'Already have an account? Sign in'}</button>
  </form></main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [content, setContent] = useState(starterCode);
  const [savedContent, setSavedContent] = useState(starterCode);
  const [connection, setConnection] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [prompt, setPrompt] = useState('');
  const [agentType, setAgentType] = useState('coder');
  const [agentOutput, setAgentOutput] = useState('');
  const [activity, setActivity] = useState('Ready to build');
  const [panel, setPanel] = useState<Panel>('explorer');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadWorkspaces = useCallback(async () => {
    const items = await listWorkspaces();
    setWorkspaces(items);
    let active = items[0];
    if (!active) active = await createWorkspace('My first project', 'Your CodeForge workspace');
    const nextItems = active && items.length === 0 ? [active] : items;
    setWorkspaces(nextItems);
    setWorkspaceId(active.id);
    const saved = await listWorkspaceFiles(active.id);
    const mapped = saved.map(file => ({ ...file, language: file.language || languageFor(file.path) }));
    if (mapped.length === 0) {
      const initial = { path: 'src/App.tsx', content: starterCode, language: 'typescript' };
      await saveWorkspaceFile(active.id, initial.path, initial.content, initial.language);
      setFiles([initial]); setOpenPaths([initial.path]); setSelectedPath(initial.path); setContent(initial.content); setSavedContent(initial.content);
    } else {
      const state = await getWorkspaceState(active.id) as { openPaths?: unknown; selectedPath?: unknown; agentType?: unknown } | null;
      const restored = Array.isArray(state?.openPaths) ? state.openPaths.filter((path): path is string => typeof path === 'string' && mapped.some(file => file.path === path)) : [];
      const activePath = typeof state?.selectedPath === 'string' && mapped.some(file => file.path === state.selectedPath) ? state.selectedPath : (restored[0] || mapped[0].path);
      setFiles(mapped); setOpenPaths(restored.length ? restored : [activePath]); setSelectedPath(activePath);
      const activeFile = mapped.find(file => file.path === activePath)!;
      setContent(activeFile.content); setSavedContent(activeFile.content);
      if (typeof state?.agentType === 'string') setAgentType(state.agentType);
    }
  }, []);

  useEffect(() => {
    if (!session) { setWorkspaces([]); setFiles([]); setWorkspaceId(''); setConnection(supabaseConfig.configured ? 'offline' : 'offline'); return; }
    setConnection('checking');
    loadWorkspaces().then(() => { setConnection('connected'); setActivity('Workspace loaded'); }).catch(error => { setConnection('offline'); setNotice(error.message); });
  }, [session, loadWorkspaces]);

  const selectedFile = useMemo(() => files.find(file => file.path === selectedPath), [files, selectedPath]);
  const dirty = content !== savedContent;
  const save = async () => {
    if (!workspaceId || !selectedPath) return;
    setBusy(true); setNotice('');
    try {
      await saveWorkspaceFile(workspaceId, selectedPath, content, languageFor(selectedPath));
      setSavedContent(content);
      setFiles(previous => previous.map(file => file.path === selectedPath ? { ...file, content, language: languageFor(selectedPath) } : file));
      setActivity('Saved ' + selectedPath); setNotice('Saved to Cloudflare D1.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!workspaceId || connection !== 'connected') return;
    const timer = window.setTimeout(() => {
      saveWorkspaceState(workspaceId, { selectedPath, openPaths, agentType }).catch(error => console.error('Could not persist workspace editor state', error));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [workspaceId, selectedPath, openPaths, agentType, connection]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
      if (event.key.toLowerCase() === 'p') { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  });
  const openFile = (path: string) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const file = files.find(item => item.path === path);
    if (!file) return;
    setOpenPaths(previous => previous.includes(path) ? previous : [...previous, path]);
    setSelectedPath(path); setContent(file.content); setSavedContent(file.content);
  };
  const closeTab = (path: string) => {
    if (path === selectedPath && dirty && !window.confirm('Discard unsaved changes?')) return;
    const remaining = openPaths.filter(item => item !== path);
    setOpenPaths(remaining);
    if (path === selectedPath) {
      const nextPath = remaining[remaining.length - 1] || '';
      const nextFile = files.find(file => file.path === nextPath);
      setSelectedPath(nextPath); setContent(nextFile?.content || ''); setSavedContent(nextFile?.content || '');
    }
  };
  const addFile = async () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const path = window.prompt('New file path', 'src/new-file.ts');
    if (!path || !workspaceId) return;
    if (files.some(file => file.path === path)) { setNotice('A file with that path already exists.'); return; }
    setBusy(true);
    try {
      await saveWorkspaceFile(workspaceId, path, '', languageFor(path));
      const file = { path, content: '', language: languageFor(path) };
      setFiles(previous => [...previous, file]); setOpenPaths(previous => [...previous, path]); setSelectedPath(path); setContent(''); setSavedContent('');
      setNotice('File created in Cloudflare D1.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create file.'); }
    finally { setBusy(false); }
  };
  const createNewWorkspace = async () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const name = window.prompt('Workspace name');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const workspace = await createWorkspace(name.trim());
      setWorkspaces(previous => [workspace, ...previous]); setWorkspaceId(workspace.id);
      const initial = { path: 'src/App.tsx', content: starterCode, language: 'typescript' };
      await saveWorkspaceFile(workspace.id, initial.path, initial.content, initial.language);
      setFiles([initial]); setOpenPaths([initial.path]); setSelectedPath(initial.path); setContent(initial.content); setSavedContent(initial.content);
      setActivity('Created ' + workspace.name); setNotice('Workspace created.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create workspace.'); }
    finally { setBusy(false); }
  };
  const renameActiveWorkspace = async () => {
    const active = workspaces.find(item => item.id === workspaceId);
    if (!active) return;
    const name = window.prompt('Rename workspace', active.name);
    if (!name?.trim() || name.trim() === active.name) return;
    setBusy(true);
    try {
      const updated = await renameWorkspace(workspaceId, name.trim());
      setWorkspaces(previous => previous.map(item => item.id === workspaceId ? updated : item));
      setNotice('Workspace renamed.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not rename workspace.'); }
    finally { setBusy(false); }
  };
  const deleteActiveWorkspace = async () => {
    const active = workspaces.find(item => item.id === workspaceId);
    if (!active || !window.confirm(`Delete workspace "${active.name}" and all its files?`)) return;
    setBusy(true);
    try {
      await deleteWorkspace(workspaceId);
      const remaining = workspaces.filter(item => item.id !== workspaceId);
      if (remaining.length) {
        const next = remaining[0];
        const saved = await listWorkspaceFiles(next.id);
        const mapped = saved.map(file => ({ ...file, language: file.language || languageFor(file.path) }));
        setWorkspaces(remaining); setWorkspaceId(next.id); setFiles(mapped); setOpenPaths(mapped[0]?.path ? [mapped[0].path] : []);
        setSelectedPath(mapped[0]?.path || ''); setContent(mapped[0]?.content || ''); setSavedContent(mapped[0]?.content || '');
      } else {
        const next = await createWorkspace('My first project', 'Your CodeForge workspace');
        const initial = { path: 'src/App.tsx', content: starterCode, language: 'typescript' };
        await saveWorkspaceFile(next.id, initial.path, initial.content, initial.language);
        setWorkspaces([next]); setWorkspaceId(next.id); setFiles([initial]); setOpenPaths([initial.path]);
        setSelectedPath(initial.path); setContent(initial.content); setSavedContent(initial.content);
      }
      setNotice('Workspace deleted.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not delete workspace.'); }
    finally { setBusy(false); }
  };
  const deleteFile = async (path: string) => {
    if (!workspaceId || !window.confirm(`Delete ${path}?`)) return;
    setBusy(true);
    try {
      await deleteWorkspaceFile(workspaceId, path);
      const remaining = files.filter(file => file.path !== path);
      setFiles(remaining); setOpenPaths(previous => previous.filter(item => item !== path));
      if (selectedPath === path) {
        setSelectedPath(remaining[0]?.path || '');
        setOpenPaths(previous => previous.filter(item => item !== path));
        setContent(remaining[0]?.content || '');
        setSavedContent(remaining[0]?.content || '');
      }
      setNotice('File deleted from Cloudflare D1.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not delete file.'); }
    finally { setBusy(false); }
  };
  const selectWorkspace = async (id: string) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setBusy(true);
    try {
      const saved = await listWorkspaceFiles(id);
      const state = await getWorkspaceState(id) as { openPaths?: unknown; selectedPath?: unknown; agentType?: unknown } | null;
      const mapped = saved.map(file => ({ ...file, language: file.language || languageFor(file.path) }));
      const restored = Array.isArray(state?.openPaths) ? state.openPaths.filter((path): path is string => typeof path === 'string' && mapped.some(file => file.path === path)) : [];
      const activePath = typeof state?.selectedPath === 'string' && mapped.some(file => file.path === state.selectedPath) ? state.selectedPath : (restored[0] || mapped[0]?.path || '');
      const activeFile = mapped.find(file => file.path === activePath);
      setWorkspaceId(id); setFiles(mapped); setOpenPaths(restored.length ? restored : (activePath ? [activePath] : []));
      setSelectedPath(activePath); setContent(activeFile?.content || ''); setSavedContent(activeFile?.content || '');
      if (typeof state?.agentType === 'string') setAgentType(state.agentType);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load workspace.'); }
    finally { setBusy(false); }
  };
  const runAgent = async (task = prompt) => {
    if (!task.trim() || busy) return;
    setBusy(true); setNotice(''); setAgentOutput(''); setPrompt('');
    setActivity('Running ' + agentType + ' agent…');
    try {
      const result = await apiRequest<{ runId: string; response: string; agentType: string; model: string; usage: unknown }>('/api/agents/run', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          task: task.trim(),
          agentType,
          context: { filePath: selectedPath, content },
        }),
      });
      setAgentOutput(result.response);
      setActivity('AI run completed · ' + result.agentType);
      setNotice('AI response saved to run history. No files were changed.');
    } catch (error) {
      setActivity('AI run failed');
      setNotice(error instanceof Error ? error.message : 'AI request failed.');
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => { await supabase?.auth.signOut(); };
  const panelTitle = panel === 'explorer' ? 'EXPLORER' : panel === 'source' ? 'SOURCE CONTROL' : panel === 'agents' ? 'AGENTS' : panel === 'terminal' ? 'TERMINAL' : 'ACTIVITY';

  if (!authReady) return <main className="auth-shell"><div className="auth-card">Loading CodeForge…</div></main>;
  if (!supabaseConfig.configured) return <main className="auth-shell"><div className="auth-card"><h1>Connect Supabase Auth</h1><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the Worker build environment, then rebuild.</p></div></main>;
  if (!session) return <AuthScreen/>;

  return <main className="shell">
    <header className="topbar">
      <button className="brand brand-button" onClick={() => setPanel('explorer')}><span className="mark"><Sparkles size={17}/></span><span>CodeForge</span><b>ALPHA</b></button>
      <select className="workspace-select" value={workspaceId} onChange={e => selectWorkspace(e.target.value)} aria-label="Workspace">{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className="top-actions"><button onClick={() => setSearchOpen(true)}><Search size={16}/> Search</button><button className="run" onClick={save} disabled={!dirty || busy}><Save size={14}/> {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button><button className="avatar" title={session.user.email || 'Account'} onClick={signOut}><LogOut size={14}/></button></div>
    </header>
    <section className="layout">
      <aside className="rail">{([['explorer', Code2], ['source', GitBranch], ['agents', BrainCircuit], ['terminal', Terminal], ['activity', Activity]] as const).map(([name, Icon]) => <button className={panel === name ? 'rail-button selected' : 'rail-button'} key={name} onClick={() => { setPanel(name); if (name === 'terminal') setTerminalOpen(true); }} title={name}><Icon/></button>)}</aside>
      <aside className="sidebar"><div className="side-title"><span>{panelTitle}</span><div className="side-actions"><button className="icon-button" onClick={renameActiveWorkspace} title="Rename workspace" disabled={!workspaceId}><Pencil size={13}/></button><button className="icon-button" onClick={deleteActiveWorkspace} title="Delete workspace" disabled={!workspaceId}><Trash2 size={13}/></button><button className="icon-button" onClick={createNewWorkspace} title="New workspace"><Plus size={15}/></button></div></div>{panel === 'explorer' ? <><div className="tree"><div className="folder">⌄ <span>{workspaces.find(item => item.id === workspaceId)?.name.toUpperCase() || 'WORKSPACE'}</span><button onClick={addFile} title="New file"><FilePlus2 size={13}/></button></div>{files.map(file => <div className="file-row" key={file.path}><button className={'file ' + (selectedPath === file.path ? 'active' : '')} onClick={() => openFile(file.path)}><span className="file-dot"/> {file.path}</button><button className="file-delete" onClick={() => deleteFile(file.path)} title={`Delete ${file.path}`}><X size={11}/></button></div>)}</div><div className="agent-card"><div className="agent-head"><span className="pulse"/> ORCHESTRATOR</div><h3>{activity}</h3><p>Workspace files and edits are persisted to Cloudflare D1.</p><button onClick={() => setPanel('agents')}>Open agent console <ChevronRight size={14}/></button></div></> : <div className="panel-empty"><Settings2 size={18}/><strong>{panelTitle}</strong><span>{panel === 'terminal' ? 'Remote terminal execution is not enabled.' : 'This capability is not connected yet.'}</span><button onClick={() => setPanel('explorer')}>Back to explorer</button></div>}</aside>
      <div className="editor"><div className="tabs">{openPaths.map(path => <div className={selectedPath === path ? 'tab-wrap active' : 'tab-wrap'} key={path}><button className="tab" onClick={() => openFile(path)}>{path} {selectedPath === path && dirty ? '•' : <Check size={11}/>}</button><button className="tab-close" onClick={() => closeTab(path)} aria-label={`Close ${path}`}><X size={11}/></button></div>)}{!openPaths.length && <span className="tab-empty">No file open</span>}</div><div className="monaco-wrap"><Editor height="100%" theme="vs-dark" language={selectedFile?.language || 'typescript'} value={content} onChange={value => setContent(value ?? '')} options={{ minimap: { enabled: true }, fontSize: 13, fontFamily: 'DM Mono, monospace', automaticLayout: true, scrollBeyondLastLine: false, wordWrap: 'on', padding: { top: 16 } }}/></div><div className="bottom"><span><span className="green">●</span> {selectedFile?.language || 'Plain text'}</span><span>{connection === 'connected' ? 'Cloudflare D1 + KV connected' : 'Backend unavailable'}</span><span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span><span>UTF-8</span></div>{terminalOpen && <div className="terminal-drawer"><div><b>TERMINAL</b><button onClick={() => setTerminalOpen(false)}><X size={14}/></button></div><code>Remote terminal is disabled until a sandbox runner is configured.</code></div>}</div>
      <aside className="inspector"><div className="inspector-title">AI COMMAND CENTER <span>guarded</span></div><div className="prompt"><div className="spark"><Sparkles size={16}/></div><p>What should we build next?</p><select className="agent-select" aria-label="Agent role" value={agentType} onChange={event => setAgentType(event.target.value)}><option value="coder">Coder</option><option value="planner">Planner</option><option value="reviewer">Reviewer</option><option value="debugger">Debugger</option><option value="tester">Tester</option><option value="refactorer">Refactorer</option><option value="security">Security</option><option value="documentation">Documentation</option></select><div className="prompt-input"><input aria-label="AI task" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => event.key === 'Enter' && runAgent()} placeholder="Describe a task…"/><button onClick={() => runAgent()} aria-label="Queue AI task"><ChevronRight size={16}/></button></div><div className="chips"><button onClick={() => runAgent('Review this file')}>Review this file</button><button onClick={() => runAgent('Find bugs')}>Find bugs</button><button onClick={() => runAgent('Write tests')}>Write tests</button></div><small className="ai-cost-note">Workers AI usage-based billing may apply.</small></div>{agentOutput && <div className="agent-output"><div><b>AGENT RESPONSE</b><button onClick={() => navigator.clipboard.writeText(agentOutput)}>Copy</button></div><pre>{agentOutput}</pre></div>}<div className="run-card"><div className="run-label"><span className="green">●</span> WORKSPACE STATUS <span>{connection}</span></div><h3>{activity}</h3><div className="steps"><div>✓ Supabase identity verified</div><div>✓ D1 workspace persistence</div><div className="current"><Zap size={13}/> Cloudflare Workers AI · usage based</div></div></div><div className="metrics"><div><span>WORKSPACES</span><strong>{workspaces.length}</strong></div><div><span>FILES</span><strong>{files.length}</strong></div><div><span>ACCOUNT</span><strong>LIVE</strong></div></div>{notice && <div className="notice" role="status">{notice}</div>}</aside>
    </section>
    {searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="search-modal" onClick={event => event.stopPropagation()}><div><b>Search workspace files</b><button onClick={() => setSearchOpen(false)}><X size={16}/></button></div><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search file paths…"/><div className="search-results">{files.filter(file => file.path.toLowerCase().includes(searchQuery.toLowerCase())).map(file => <button key={file.path} onClick={() => { if (dirty && !window.confirm('Discard unsaved changes?')) return; setSelectedPath(file.path); setContent(file.content); setSavedContent(file.content); setSearchOpen(false); }}><Code2 size={13}/>{file.path}</button>)}</div><small>Searches the files in the current workspace.</small></div></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
