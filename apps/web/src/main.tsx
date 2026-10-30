import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Activity, BrainCircuit, Check, ChevronRight, Code2, FilePlus2, GitBranch, History, LogOut, Pencil, Play, Plus, Save, Search, Settings2, Sparkles, Terminal, Trash2, X, Zap } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import './styles.css';
import { apiRequest, initializeSupabase, supabase, supabaseConfig } from './lib/supabase';
import { getHostedAppRedirectUrl, getSupabaseRedirectUrl } from './lib/supabase-config';
import { getFriendlyAuthError, readAuthRedirectState, type AuthRedirectState } from './lib/auth-flow';
import {
  createWorkspace, deleteWorkspace, deleteWorkspaceFile, getWorkspaceState, listWorkspaces, listWorkspaceFiles, renameWorkspace, saveWorkspaceFile, saveWorkspaceState, getProfile, updateProfile, listWorkspaceMembers, createWorkspaceInvite, removeWorkspaceMember, acceptWorkspaceInvite,
  type Workspace,
  type FileVersion,
  listFileVersions,
  restoreFileVersion,
  type AgentRun,
  type ActivityEvent,
  type ProviderId,
  type ProviderConfig,
  type Profile,
  type WorkspaceMember,
  listProviderConfigs,
  saveProviderConfig,
  testProviderConfig,
  deleteProviderConfig,
  listAgentRuns,
  listActivity,
  type CodeChangeRequest,
  type WorkspaceSearchResult,
  searchWorkspaceFiles,
  listCodeChanges,
  proposeCodeChange,
  approveCodeChange,
  rejectCodeChange,
} from './lib/workspaces';
import { runWorkspaceConsoleCommand } from './lib/workspace-console';

type WorkspaceFile = { id?: string; path: string; content: string; language: string | null };
type Panel = 'explorer' | 'source' | 'agents' | 'terminal' | 'activity' | 'settings';
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

type AuthMode = 'signin' | 'signup' | 'reset' | 'recovery';

function AuthScreen({
  initialMessage,
  recoveryMode,
  onRecoveryComplete,
}: {
  initialMessage: string;
  recoveryMode: boolean;
  onRecoveryComplete: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialMessage);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'recovery' : 'signin');

  useEffect(() => {
    if (recoveryMode) setMode('recovery');
  }, [recoveryMode]);

  const runOAuth = async (provider: 'github' | 'google') => {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setStatus('Redirecting securely to ' + (provider === 'github' ? 'GitHub' : 'Google') + '…');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getSupabaseRedirectUrl() },
      });
      if (oauthError) {
        setError(getFriendlyAuthError(oauthError));
        setStatus('');
        setBusy(false);
      }
    } catch (oauthError) {
      setError(getFriendlyAuthError(oauthError));
      setStatus('');
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getSupabaseRedirectUrl(),
        });
        if (resetError) throw resetError;
        setStatus('If an account exists for that email, a password reset link has been sent.');
      } else if (mode === 'recovery') {
        if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPassword('');
        setConfirmPassword('');
        setStatus('Your password has been updated securely.');
        onRecoveryComplete();
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: getSupabaseRedirectUrl() },
        });
        if (signupError) throw signupError;
        if (data.session) {
          setStatus('Your account is ready. Opening your workspace…');
        } else {
          setStatus('Account created. Check your inbox for the confirmation link, then return here to sign in.');
          setMode('signin');
          setPassword('');
        }
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signinError) throw signinError;
      }
    } catch (authError) {
      const rawMessage = authError instanceof Error ? authError.message : '';
      if (rawMessage === 'The passwords do not match.' || rawMessage.startsWith('Choose a password')) {
        setError(rawMessage);
      } else {
        setError(getFriendlyAuthError(authError));
      }
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (!supabase || busy || !email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getSupabaseRedirectUrl() },
      });
      if (resendError) throw resendError;
      setStatus('If the account needs confirmation, a new email has been sent.');
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'signup'
    ? 'Create your account.'
    : mode === 'reset'
      ? 'Reset your password.'
      : mode === 'recovery'
        ? 'Choose a new password.'
        : 'Welcome back.';
  const description = mode === 'signup'
    ? 'Create one secure account for your CodeForge projects.'
    : mode === 'reset'
      ? 'We’ll send a secure password reset link to your email.'
      : mode === 'recovery'
        ? 'Set a new password to finish recovering your CodeForge account.'
        : 'Sign in securely to access your projects and saved files.';

  return <main className="auth-shell">
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-brand"><span className="mark"><Sparkles size={18}/></span><b>CodeForge</b><small>AI-NATIVE DEVELOPMENT</small></div>
      <h1>{heading}</h1>
      <p>{description}</p>
      {mode !== 'recovery' && <label htmlFor="auth-email">Email
        <input id="auth-email" type="email" autoComplete="email" required value={email}
          onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy}/>
      </label>}
      {mode !== 'reset' && <label htmlFor="auth-password">{mode === 'recovery' ? 'New password' : 'Password'}
        <input id="auth-password" type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          minLength={8} required value={password} onChange={event => setPassword(event.target.value)}
          placeholder="At least 8 characters" disabled={busy}/>
      </label>}
      {mode === 'recovery' && <label htmlFor="auth-confirm-password">Confirm new password
        <input id="auth-confirm-password" type="password" autoComplete="new-password" minLength={8}
          required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}
          placeholder="Enter the new password again" disabled={busy}/>
      </label>}
      {error && <div className="auth-error" role="alert" aria-live="assertive">{error}</div>}
      {status && <div className="auth-status" role="status" aria-live="polite">{status}</div>}
      <button className="auth-submit" type="submit" disabled={busy || !supabase}>
        {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'recovery' ? 'Update password' : 'Sign in'}
      </button>
      {mode === 'signin' && <>
        <div className="oauth-divider">OR CONTINUE WITH</div>
        <div className="oauth-buttons">
          <button type="button" disabled={busy} onClick={() => void runOAuth('github')}>GitHub</button>
          <button type="button" disabled={busy} onClick={() => void runOAuth('google')}>Google</button>
        </div>
        <div className="auth-secondary-actions">
          <button type="button" disabled={busy} onClick={() => { setMode('reset'); setError(''); setStatus(''); }}>Forgot password?</button>
          <button type="button" disabled={busy} onClick={() => void resendConfirmation()}>Resend confirmation</button>
        </div>
      </>}
      {mode !== 'recovery' && <button type="button" className="auth-switch" disabled={busy}
        onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setStatus(''); }}>
        {mode === 'signup' ? 'Already have an account? Sign in' : mode === 'reset' ? 'Back to sign in' : 'New to CodeForge? Create an account'}
      </button>}
      {mode === 'recovery' && <button type="button" className="auth-switch" disabled={busy}
        onClick={() => { setMode('signin'); setError(''); setStatus(''); }}>
        Return to sign in
      </button>}
    </form>
  </main>;
}



function LandingPage() {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const code = activeTab === 'editor'
    ? `import { createApp } from './app';\n\nconst workspace = createApp({\n  name: 'my-next-project',\n  ai: { provider: 'workers-ai' },\n  sync: { enabled: true },\n});\n\nworkspace.run();`
    : `<main class="welcome">\n  <span class="eyebrow">YOUR NEXT IDEA STARTS HERE</span>\n  <h1>Build without limits.</h1>\n  <p>One workspace. Desktop power. Mobile freedom.</p>\n  <button>Start building →</button>\n</main>`;
  return <main className="home-shell">
    <nav className="home-nav"><a className="home-brand" href="/"><span className="home-mark"><Sparkles size={18}/></span> CodeForge <small>DEVELOPER STUDIO</small></a><div className="home-nav-links"><a href="#features">Features</a><a href="#downloads">Downloads</a><a href="https://github.com/ram1234598766-dotcom/codeforge-ide" target="_blank" rel="noreferrer">GitHub ↗</a></div><a className="home-nav-cta" href="/app">Open web IDE <ChevronRight size={15}/></a></nav>
    <section className="home-hero"><div className="home-copy"><div className="home-kicker"><span/> PREVIEW IS LIVE <i>·</i> WINDOWS + ANDROID BUILDS</div><h1>Your ideas.<br/><em>Forged anywhere.</em></h1><p className="home-lede">A connected AI-native development workspace for your desktop, your phone, and the browser. Start in one place. Continue anywhere.</p><div className="home-actions"><a className="home-primary" href="/app">Launch browser preview <ChevronRight size={17}/></a><a className="home-secondary" href="#downloads">Get the apps <ArrowDownIcon/></a></div><div className="home-proof"><span><Check size={14}/> One account</span><span><Check size={14}/> Cloud-synced projects</span><span><Check size={14}/> Use each app independently</span></div></div>
      <div className="home-preview-wrap"><div className="preview-glow"/><div className="home-window"><div className="home-window-bar"><div className="window-dots"><i/><i/><i/></div><span>CODEFORGE / WORKSPACE</span><b><span/> CLOUD LINKED</b></div><div className="home-window-body"><aside className="home-mini-sidebar"><div className="mini-workspace"><span>⌘</span> my-next-project</div><small>EXPLORER</small><div className="mini-folder">⌄ src</div><div className="mini-file active">◈ app.ts</div><div className="mini-file">◇ styles.css</div><div className="mini-file">◇ index.html</div><div className="mini-folder">⌄ public</div><div className="mini-file">◇ logo.svg</div><div className="mini-ai"><Sparkles size={13}/> AI AGENT <p>Ready to help you build.</p></div></aside><div className="home-mini-editor"><div className="mini-tabs"><button className={activeTab === 'editor' ? 'active' : ''} onClick={() => setActiveTab('editor')}>app.ts</button><button className={activeTab === 'preview' ? 'active' : ''} onClick={() => setActiveTab('preview')}>Preview</button><span>⌘ S</span></div><div className="mini-code"><div className="mini-gutter">1<br/>2<br/>3<br/>4<br/>5<br/>6<br/>7<br/>8<br/>9</div><pre>{code}</pre></div><div className="mini-status"><span>● TYPESCRIPT</span><span>SYNCED</span><span>UTF-8</span></div></div></div></div><div className="home-float-card"><span className="float-icon"><Zap size={15}/></span><div><b>One workspace</b><small>Browser · Desktop · Android</small></div><span className="float-live">LIVE</span></div></div>
    </section>
    <section className="home-stats"><div><b>01</b><span>ONE IDENTITY</span><small>Sign in once across your devices</small></div><div><b>02</b><span>LIVE SYNC</span><small>Projects saved to your cloud workspace</small></div><div><b>03</b><span>FLEXIBLE BY DESIGN</span><small>Use desktop, Android, or browser alone</small></div></section>
    <section className="home-section" id="features"><div className="home-section-heading"><span>THE CODEFORGE ECOSYSTEM</span><h2>One studio. Three ways to build.</h2><p>Choose the surface that fits the moment. Your projects and account stay connected through the same secure cloud workspace.</p></div><div className="home-feature-grid"><article><div className="feature-icon"><Code2 size={19}/></div><small>01 / INSTANT</small><h3>Web preview</h3><p>Try the current IDE in your browser. No installation needed. A fast way to explore the workspace and sign in.</p><a href="/app">Open preview <ChevronRight size={14}/></a></article><article><div className="feature-icon"><MonitorIcon/></div><small>02 / DESKTOP</small><h3>Desktop for Windows</h3><p>A dedicated Windows app for a larger screen, keyboard-first workflows, and a native desktop window.</p><a href="#downloads">Get Windows installer <ChevronRight size={14}/></a></article><article><div className="feature-icon"><SmartphoneIcon/></div><small>03 / MOBILE</small><h3>Android companion</h3><p>Open your cloud IDE on the move, check projects, and continue working from your Android device.</p><a href="#downloads">Get Android app <ChevronRight size={14}/></a></article></div></section>
    <section className="home-downloads" id="downloads"><div><span className="home-kicker">READY WHEN YOU ARE</span><h2>Bring CodeForge<br/><em>to your devices.</em></h2><p>Install the native app or keep using the browser preview. All clients use the same CodeForge account and cloud workspace.</p><div className="home-sync-note"><span><Check size={14}/></span><div><b>Connected or independent</b><small>Each app can be opened on its own. Sign in with the same account to access shared cloud projects. Internet is required for cloud sync.</small></div></div></div><div className="download-cards"><article><div className="download-card-top"><MonitorIcon/><span>WINDOWS 10 / 11</span></div><h3>CodeForge Desktop</h3><p>Native Windows installer</p><a className="download-link" href="https://github.com/ram1234598766-dotcom/codeforge-ide/releases/latest/download/CodeForge-Setup-Windows.exe" download>Download latest .EXE <ArrowDownIcon/></a><small>Self-signed installer · <a href="https://github.com/ram1234598766-dotcom/codeforge-ide/releases/latest/download/CodeForge-SelfSigned.cer">publisher certificate</a></small></article><article><div className="download-card-top"><SmartphoneIcon/><span>ANDROID</span></div><h3>CodeForge Mobile</h3><p>Android package installer</p><a className="download-link" href="https://github.com/ram1234598766-dotcom/codeforge-ide/releases/latest/download/CodeForge.apk" download>Download latest .APK <ArrowDownIcon/></a><small>Signed APK · approve installation on Android</small></article><div className="download-footnote">Each button downloads the newest published installer directly. After download, open the file and approve your device’s install prompt. <a href="https://github.com/ram1234598766-dotcom/codeforge-ide/releases">View release notes and checksums</a>.</div></div></section>
    <footer className="home-footer"><a className="home-brand" href="/"><span className="home-mark"><Sparkles size={16}/></span> CodeForge</a><span>Build boldly. Ship everywhere.</span><a href="https://github.com/ram1234598766-dotcom/codeforge-ide">Open source repository ↗</a></footer>
  </main>;
}
function ArrowDownIcon() { return <span aria-hidden="true">↓</span>; }
function MonitorIcon() { return <span className="simple-device-icon" aria-hidden="true">▣</span>; }
function SmartphoneIcon() { return <span className="simple-device-icon" aria-hidden="true">▯</span>; }

function App({ authRedirectState }: { authRedirectState: AuthRedirectState }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(authRedirectState.isPasswordRecovery);
  const [authMessage, setAuthMessage] = useState(authRedirectState.message || '');
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
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [changeRequests, setChangeRequests] = useState<CodeChangeRequest[]>([]);
  const [selectedChangeId, setSelectedChangeId] = useState('');
  const [changeReviewOpen, setChangeReviewOpen] = useState(false);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('workers-ai');
  const [providerForm, setProviderForm] = useState<ProviderId>('openai');
  const [providerModel, setProviderModel] = useState('gpt-4.1-mini');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerMessage, setProviderMessage] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [inviteUrl, setInviteUrl] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [collaborationMessage, setCollaborationMessage] = useState('');
  const [activity, setActivity] = useState('Ready to build');
  const [panel, setPanel] = useState<Panel>('explorer');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'content' | 'path'>('all');
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleEntries, setConsoleEntries] = useState<Array<{ command: string; lines: string[] }>>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<FileVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [versionContent, setVersionContent] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
      if (error) setAuthMessage(getFriendlyAuthError(error));
      const currentUrl = window.location.pathname + window.location.search + window.location.hash;
      if (authRedirectState.cleanUrl !== currentUrl) {
        window.history.replaceState({}, '', authRedirectState.cleanUrl);
      }
    }).catch(() => {
      if (!active) return;
      setAuthReady(true);
      setAuthMessage('Could not restore your sign-in session. Please sign in again.');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [authRedirectState.cleanUrl]);

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
    const inviteToken = new URLSearchParams(window.location.search).get('invite');
    const acceptPendingInvite = inviteToken
      ? acceptWorkspaceInvite(inviteToken).then(() => { setNotice('Workspace invitation accepted.'); }).catch(error => { setNotice(error.message); }).finally(() => { window.history.replaceState({}, '', window.location.pathname); })
      : Promise.resolve();
    acceptPendingInvite.then(() => loadWorkspaces()).then(() => { setConnection('connected'); setActivity('Workspace loaded'); }).catch(error => { setConnection('offline'); setNotice(error.message); });
  }, [session, loadWorkspaces]);

  useEffect(() => {
    if (!session) return;
    if (panel === 'agents') {
      listAgentRuns().then(setAgentRuns).catch(error => setNotice(error.message));
      if (workspaceId) listCodeChanges(workspaceId).then(setChangeRequests).catch(error => setNotice(error.message));
    }
    if (panel === 'activity') listActivity().then(setActivityEvents).catch(error => setNotice(error.message));
    if (panel === 'settings') {
      listProviderConfigs().then(configs => {
        setProviderConfigs(configs);
        if (configs.length && selectedProvider === 'workers-ai') setSelectedProvider(configs[0].provider);
      }).catch(error => setProviderMessage(error.message));
      getProfile().then(profile => { setProfileName(profile.display_name || ''); setProfileAvatar(profile.avatar_url || ''); }).catch(error => setCollaborationMessage(error.message));
      const active = workspaces.find(item => item.id === workspaceId);
      if (workspaceId && (active?.role === 'owner' || active?.role === 'admin')) {
        listWorkspaceMembers(workspaceId).then(setWorkspaceMembers).catch(error => setCollaborationMessage(error.message));
      } else setWorkspaceMembers([]);
    }
  }, [panel, session, workspaceId, workspaces]);

  const activeWorkspace = useMemo(() => workspaces.find(item => item.id === workspaceId), [workspaces, workspaceId]);
  useEffect(() => {
    if (!searchOpen || !workspaceId || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      searchWorkspaceFiles(workspaceId, searchQuery, searchMode)
        .then(results => { if (!cancelled) { setSearchResults(results); setSearchError(''); } })
        .catch(error => { if (!cancelled) { setSearchResults([]); setSearchError(error instanceof Error ? error.message : 'Workspace search failed.'); } })
        .finally(() => { if (!cancelled) setSearchLoading(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [searchOpen, workspaceId, searchQuery, searchMode]);
  const canEditWorkspace = !activeWorkspace || activeWorkspace.role !== 'viewer';
  const canAdminWorkspace = activeWorkspace?.role === 'owner' || activeWorkspace?.role === 'admin';
  const isWorkspaceOwner = activeWorkspace?.role === 'owner';
  const selectedFile = useMemo(() => files.find(file => file.path === selectedPath), [files, selectedPath]);
  const selectedChange = useMemo(() => changeRequests.find(change => change.id === selectedChangeId), [changeRequests, selectedChangeId]);
  const dirty = content !== savedContent;
  const save = async () => {
    if (!workspaceId || !selectedPath || !canEditWorkspace) return;
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
  const runConsoleCommand = () => {
    const command = consoleInput.trim();
    if (!command) return;
    const result = runWorkspaceConsoleCommand(command, {
      workspaceName: activeWorkspace?.name || 'Workspace',
      workspaceId,
      files,
      selectedPath,
      dirty,
      email: session?.user.email,
    });
    if (result.clear) {
      setConsoleEntries([]);
    } else {
      if (result.openPath) openFile(result.openPath);
      setConsoleEntries(previous => [...previous.slice(-39), { command, lines: result.lines }]);
    }
    setConsoleInput('');
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
    if (!canEditWorkspace) return;
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
    if (!canEditWorkspace) return;
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
  const requestApproval = async () => {
    if (!workspaceId || !selectedPath || !dirty || busy) return;
    setBusy(true); setNotice('');
    try {
      const change = await proposeCodeChange(workspaceId, selectedPath, content);
      setChangeRequests(previous => [change, ...previous.filter(item => item.id !== change.id)]);
      setPanel('agents');
      setNotice('Change proposal created. Review the diff and approve it before it is applied.');
      setActivity('Awaiting code review · ' + selectedPath);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create change proposal.'); }
    finally { setBusy(false); }
  };
  const approveSelectedChange = async () => {
    if (!workspaceId || !selectedChange || busy) return;
    setBusy(true); setNotice('');
    try {
      await approveCodeChange(workspaceId, selectedChange.id);
      setChangeRequests(previous => previous.map(item => item.id === selectedChange.id ? {...item,status:'approved'} : item));
      const updated = {path:selectedChange.file_path,content:selectedChange.proposed_content,language:languageFor(selectedChange.file_path)};
      setFiles(previous => previous.map(file => file.path === updated.path ? {...file,...updated} : file));
      if (selectedPath === updated.path) { setContent(updated.content); setSavedContent(updated.content); }
      setChangeReviewOpen(false);
      setNotice('Approved and applied to D1. A pre-change version was saved.');
      setActivity('Approved code change · ' + updated.path);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not approve change.'); }
    finally { setBusy(false); }
  };
  const rejectSelectedChange = async () => {
    if (!workspaceId || !selectedChange || busy) return;
    setBusy(true); setNotice('');
    try {
      await rejectCodeChange(workspaceId, selectedChange.id);
      setChangeRequests(previous => previous.map(item => item.id === selectedChange.id ? {...item,status:'rejected'} : item));
      setChangeReviewOpen(false);
      setNotice('Change rejected. Workspace files were not modified.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not reject change.'); }
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
          provider: selectedProvider,
          context: { filePath: selectedPath, content },
        }),
      });
      setAgentOutput(result.response);
      const now = new Date().toISOString();
      setAgentRuns(previous => [{
        id: result.runId, workspace_id: workspaceId || null, task: task.trim(), agent_type: result.agentType,
        status: 'succeeded', result_json: JSON.stringify({response:result.response,model:result.model,usage:result.usage}),
        created_at: now, updated_at: now,
      }, ...previous].slice(0,30));
      setActivity('AI run completed · ' + result.agentType);
      setNotice('AI response saved to run history. No files were changed.');
    } catch (error) {
      setActivity('AI run failed');
      setNotice(error instanceof Error ? error.message : 'AI request failed.');
    } finally {
      setBusy(false);
    }
  };
  const saveProvider = async () => {
    setBusy(true); setProviderMessage('');
    try {
      await saveProviderConfig(providerForm, providerModel, providerApiKey);
      const configs = await listProviderConfigs();
      setProviderConfigs(configs); setSelectedProvider(providerForm); setProviderApiKey('');
      setProviderMessage('Provider key encrypted and saved.');
    } catch (error) { setProviderMessage(error instanceof Error ? error.message : 'Could not save provider.'); }
    finally { setBusy(false); }
  };
  const testProvider = async (provider: ProviderId) => {
    setBusy(true); setProviderMessage('');
    try { await testProviderConfig(provider); setProviderMessage(provider + ' connection verified.'); }
    catch (error) { setProviderMessage(error instanceof Error ? error.message : 'Provider test failed.'); }
    finally { setBusy(false); }
  };
  const removeProvider = async (provider: ProviderId) => {
    if (!window.confirm(`Remove the saved ${provider} API key?`)) return;
    setBusy(true);
    try {
      await deleteProviderConfig(provider);
      const configs = await listProviderConfigs();
      setProviderConfigs(configs);
      if (selectedProvider === provider) setSelectedProvider('workers-ai');
      setProviderMessage(provider + ' key removed.');
    } catch (error) { setProviderMessage(error instanceof Error ? error.message : 'Could not remove provider.'); }
    finally { setBusy(false); }
  };
  const openHistory = async (path = selectedPath) => {
    if (!workspaceId || !path) return;
    setHistoryOpen(true); setHistoryLoading(true); setHistoryVersions([]); setSelectedVersion(''); setVersionContent('');
    try {
      const versions = await listFileVersions(workspaceId, path);
      setHistoryVersions(versions);
      if (versions[0]) { setSelectedVersion(versions[0].id); setVersionContent(versions[0].content); }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load file history.'); }
    finally { setHistoryLoading(false); }
  };
  const restoreVersion = async () => {
    if (!workspaceId || !selectedVersion || !window.confirm('Restore this version? The current file will be saved as another version.')) return;
    setBusy(true);
    try {
      const restored = await restoreFileVersion(workspaceId, selectedVersion);
      setFiles(previous => previous.some(file => file.path === restored.path)
        ? previous.map(file => file.path === restored.path ? { ...file, content: restored.content, language: restored.language || languageFor(restored.path) } : file)
        : [...previous, { path: restored.path, content: restored.content, language: restored.language || languageFor(restored.path) }]);
      setOpenPaths(previous => previous.includes(restored.path) ? previous : [...previous, restored.path]);
      setSelectedPath(restored.path); setContent(restored.content); setSavedContent(restored.content);
      setHistoryOpen(false); setNotice('File version restored and saved to D1.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not restore version.'); }
    finally { setBusy(false); }
  };
  const saveProfile = async () => {
    setBusy(true); setCollaborationMessage('');
    try { await updateProfile(profileName, profileAvatar); setCollaborationMessage('Profile saved.'); }
    catch (error) { setCollaborationMessage(error instanceof Error ? error.message : 'Could not save profile.'); }
    finally { setBusy(false); }
  };
  const inviteMember = async () => {
    if (!workspaceId || !inviteEmail.trim()) return;
    setBusy(true); setCollaborationMessage('');
    try {
      const link = await createWorkspaceInvite(workspaceId, inviteEmail, inviteRole);
      setInviteUrl(link); setCollaborationMessage('Invitation link created. It expires in 7 days.');
    } catch (error) { setCollaborationMessage(error instanceof Error ? error.message : 'Could not create invitation.'); }
    finally { setBusy(false); }
  };
  const removeMember = async (userId: string) => {
    if (!workspaceId || !window.confirm('Remove this member from the workspace?')) return;
    setBusy(true);
    try {
      await removeWorkspaceMember(workspaceId, userId);
      setWorkspaceMembers(await listWorkspaceMembers(workspaceId));
      setCollaborationMessage('Member removed.');
    } catch (error) { setCollaborationMessage(error instanceof Error ? error.message : 'Could not remove member.'); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    try {
      const result = await supabase?.auth.signOut();
      if (result?.error) setNotice(getFriendlyAuthError(result.error));
    } catch (error) {
      setNotice(getFriendlyAuthError(error));
    }
  };
  const panelTitle = panel === 'explorer' ? 'EXPLORER' : panel === 'source' ? 'SOURCE CONTROL' : panel === 'agents' ? 'AGENTS' : panel === 'terminal' ? 'TERMINAL' : panel === 'settings' ? 'SETTINGS' : 'ACTIVITY';

  if (!authReady) return <main className="auth-shell"><div className="auth-card">Loading CodeForge…</div></main>;
  if (!supabaseConfig.configured) return <main className="auth-shell"><div className="auth-card"><h1>Connect Supabase Auth</h1><p>Supabase Auth is not connected to this deployment. Check the CodeForge Worker runtime configuration and public Supabase publishable key.</p></div></main>;
  if (!session || recoveryMode) return <AuthScreen
    initialMessage={authMessage}
    recoveryMode={recoveryMode}
    onRecoveryComplete={() => {
      setRecoveryMode(false);
      setAuthMessage('');
    }}
  />;

  return <main className="shell">
    <header className="topbar">
      <button className="brand brand-button" onClick={() => setPanel('explorer')}><span className="mark"><Sparkles size={17}/></span><span>CodeForge</span><b>ALPHA</b></button>
      <select className="workspace-select" value={workspaceId} onChange={e => selectWorkspace(e.target.value)} aria-label="Workspace">{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className="top-actions"><button onClick={() => setSearchOpen(true)}><Search size={16}/> Search</button><button onClick={requestApproval} disabled={!dirty || busy || !workspaceId || !canEditWorkspace} title="Create a review request for the current editor buffer"><Check size={14}/> Request approval</button><button onClick={() => openHistory()} disabled={!selectedPath}><History size={14}/> History</button><button onClick={() => setPreviewOpen(value => !value)} disabled={!selectedPath.toLowerCase().endsWith('.html')}><Play size={14}/> Preview</button><button className="run" onClick={save} disabled={!dirty || busy || !canEditWorkspace}><Save size={14}/> {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button><button className="avatar" title={session.user.email || 'Account'} onClick={signOut}><LogOut size={14}/></button></div>
    </header>
    <section className="layout">
      <aside className="rail">{([['explorer', Code2], ['source', GitBranch], ['agents', BrainCircuit], ['terminal', Terminal], ['activity', Activity], ['settings', Settings2]] as const).map(([name, Icon]) => <button className={panel === name ? 'rail-button selected' : 'rail-button'} key={name} onClick={() => { setPanel(name); if (name === 'terminal') setTerminalOpen(true); }} title={name}><Icon/></button>)}</aside>
      <aside className="sidebar"><div className="side-title"><span>{panelTitle}</span><div className="side-actions"><button className="icon-button" onClick={renameActiveWorkspace} title="Rename workspace" disabled={!canAdminWorkspace}><Pencil size={13}/></button><button className="icon-button" onClick={deleteActiveWorkspace} title="Delete workspace" disabled={!isWorkspaceOwner}><Trash2 size={13}/></button><button className="icon-button" onClick={createNewWorkspace} title="New workspace"><Plus size={15}/></button></div></div>{panel === 'explorer' ? <><div className="tree"><div className="folder">⌄ <span>{workspaces.find(item => item.id === workspaceId)?.name.toUpperCase() || 'WORKSPACE'}</span><button onClick={addFile} title="New file" disabled={!canEditWorkspace}><FilePlus2 size={13}/></button></div>{files.map(file => <div className="file-row" key={file.path}><button className={'file ' + (selectedPath === file.path ? 'active' : '')} onClick={() => openFile(file.path)}><span className="file-dot"/> {file.path}</button>{canEditWorkspace && <button className="file-delete" onClick={() => deleteFile(file.path)} title={`Delete ${file.path}`}><X size={11}/></button>}</div>)}</div><div className="agent-card"><div className="agent-head"><span className="pulse"/> ORCHESTRATOR</div><h3>{activity}</h3><p>Workspace files and edits are persisted to Cloudflare D1.</p><button onClick={() => setPanel('agents')}>Open agent console <ChevronRight size={14}/></button></div></> : panel === 'agents' ? <div className="history-list"><div className="approval-section"><div className="history-role">PENDING CODE APPROVALS · {changeRequests.filter(item => item.status === 'pending').length}</div>{changeRequests.filter(item => item.status === 'pending').length ? changeRequests.filter(item => item.status === 'pending').map(change => <button className="history-item approval-item" key={change.id} onClick={() => {setSelectedChangeId(change.id);setChangeReviewOpen(true);}}><span className="history-role">REVIEW REQUIRED</span><strong>{change.file_path}</strong><small>{new Date(change.created_at || '').toLocaleString()}</small><span className="approval-cta">Review diff <ChevronRight size={12}/></span></button>) : <small className="muted-copy">No pending changes. Unsaved editor changes can be submitted for approval.</small>}</div><div className="approval-section"><div className="history-role">RECENT AGENT RUNS</div>{agentRuns.length ? agentRuns.map(run => <button className="history-item" key={run.id} onClick={() => { try { setAgentOutput(JSON.parse(run.result_json || '{}').response || 'No response stored.'); } catch { setAgentOutput('Could not read this run result.'); } setActivity(run.agent_type + ' · ' + run.status); }}><span className="history-role">{run.agent_type} · {run.status}</span><strong>{run.task}</strong><small>{new Date(run.created_at).toLocaleString()}</small></button>) : <div className="panel-empty"><BrainCircuit size={18}/><strong>No agent runs yet</strong><span>Choose a role in the AI command center and send a task.</span></div>}</div></div> : panel === 'activity' ? <div className="history-list">{activityEvents.length ? activityEvents.map(event => <div className="history-item activity-item" key={event.id}><span className="history-role">{event.action}</span><small>{new Date(event.created_at).toLocaleString()}</small><code>{event.metadata_json}</code></div>) : <div className="panel-empty"><Activity size={18}/><strong>No activity yet</strong><span>Workspace, file, and agent actions will appear here.</span></div>}</div> : panel === 'settings' ? <div className="provider-settings"><h3>Profile</h3><p>Signed in as {session.user.email}</p><label>Display name<input value={profileName} onChange={event => setProfileName(event.target.value)} maxLength={80} placeholder="Your display name"/></label><label>Avatar URL<input value={profileAvatar} onChange={event => setProfileAvatar(event.target.value)} placeholder="https://…"/></label><button className="provider-save" onClick={saveProfile} disabled={busy}>Save profile</button><h3>Workspace collaboration</h3><p>Current role: <b>{activeWorkspace?.role || 'owner'}</b>. Invitations are single-use links that expire after 7 days.</p>{canAdminWorkspace ? <><label>Invite email<input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="teammate@example.com"/></label><label>Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value as 'admin' | 'editor' | 'viewer')}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button className="provider-save" onClick={inviteMember} disabled={busy || !inviteEmail.trim()}>Create invitation link</button>{inviteUrl && <div className="invite-link"><input readOnly value={inviteUrl}/><button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy</button></div>}<h4>Workspace members</h4>{workspaceMembers.map(member => <div className="provider-row" key={member.user_id}><div><b>{member.display_name || member.user_id.slice(0,8)}</b><small>{member.role}</small></div>{member.role !== 'owner' && <button onClick={() => removeMember(member.user_id)}>Remove</button>}</div>)}</> : <small>Only workspace owners and admins can invite or manage members.</small>}{collaborationMessage && <div className="provider-message" role="status">{collaborationMessage}</div>}<h3>Model providers</h3><p>Use your own API key. Keys are AES-GCM encrypted in D1 and decrypted only inside the Worker.</p><label>Provider<select value={providerForm} onChange={event => { const value=event.target.value as ProviderId; setProviderForm(value); setProviderModel(({openai:'gpt-4.1-mini',deepseek:'deepseek-chat',groq:'llama-3.3-70b-versatile',openrouter:'openai/gpt-4.1-mini'} as Record<ProviderId,string>)[value]); }}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option></select></label><label>Model<input value={providerModel} onChange={event => setProviderModel(event.target.value)} placeholder="Model identifier"/></label><label>API key<input type="password" value={providerApiKey} onChange={event => setProviderApiKey(event.target.value)} autoComplete="off" placeholder="Paste provider API key"/></label><button className="provider-save" onClick={saveProvider} disabled={busy || !providerApiKey.trim() || !providerModel.trim()}>Encrypt and save key</button>{providerConfigs.length > 0 && <><h4>Configured providers</h4>{providerConfigs.map(config => <div className="provider-row" key={config.provider}><div><b>{config.provider}</b><small>{config.model}</small></div><button onClick={() => testProvider(config.provider)}>Test</button><button onClick={() => removeProvider(config.provider)}>Remove</button></div>)}</>}{providerMessage && <div className="provider-message" role="status">{providerMessage}</div>}<small>Provider calls are billed by your chosen provider. Workers AI remains available as a fallback.</small></div> : panel === 'terminal' ? <div className="panel-empty"><Terminal size={18}/><strong>Workspace console</strong><span>Run safe commands against D1-backed files. This is not an operating-system shell.</span><button onClick={() => { setTerminalOpen(true); setConsoleInput('help'); }}>Open console</button></div> : <div className="panel-empty"><Settings2 size={18}/><strong>{panelTitle}</strong><span>This capability is not connected yet.</span><button onClick={() => setPanel('explorer')}>Back to explorer</button></div>}</aside>
      <div className={previewOpen ? 'editor preview-active' : 'editor'}><div className="tabs">{openPaths.map(path => <div className={selectedPath === path ? 'tab-wrap active' : 'tab-wrap'} key={path}><button className="tab" onClick={() => openFile(path)}>{path} {selectedPath === path && dirty ? '•' : <Check size={11}/>}</button><button className="tab-close" onClick={() => closeTab(path)} aria-label={`Close ${path}`}><X size={11}/></button></div>)}{!openPaths.length && <span className="tab-empty">No file open</span>}</div><div className="monaco-wrap"><Editor height="100%" theme="vs-dark" language={selectedFile?.language || 'typescript'} value={content} onChange={value => setContent(value ?? '')} options={{ readOnly: !canEditWorkspace, minimap: { enabled: true }, fontSize: 13, fontFamily: 'DM Mono, monospace', automaticLayout: true, scrollBeyondLastLine: false, wordWrap: 'on', padding: { top: 16 } }}/></div>{previewOpen && <div className="preview-pane"><div className="preview-head"><span><Play size={12}/> HTML PREVIEW · SANDBOXED</span><button onClick={() => setPreviewOpen(false)}><X size={13}/></button></div><iframe title="Sandboxed HTML preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={selectedPath.toLowerCase().endsWith('.html') ? content : '<!doctype html><html><body style="font:14px sans-serif;padding:24px">Select an HTML file to preview.</body></html>'}/></div>}<div className="bottom"><span><span className="green">●</span> {selectedFile?.language || 'Plain text'}</span><span>{connection === 'connected' ? 'Cloudflare D1 + KV connected' : 'Backend unavailable'}</span><span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span><span>UTF-8</span></div>{terminalOpen && <div className="terminal-drawer">
        <div className="terminal-head"><div><b>WORKSPACE CONSOLE</b><small>D1-backed files · allowlisted commands · no OS shell</small></div><button onClick={() => setTerminalOpen(false)} aria-label="Close workspace console"><X size={14}/></button></div>
        <div className="terminal-output" aria-live="polite">
          {consoleEntries.length === 0 ? <p>Type <code>help</code> to see available workspace commands.</p> : consoleEntries.map((entry, index) => <div className="terminal-entry" key={index}><div className="terminal-command"><span>›</span> {entry.command}</div>{entry.lines.map((line, lineIndex) => <div className="terminal-line" key={lineIndex}>{line || ' '}</div>)}</div>)}
        </div>
        <form className="terminal-input-row" onSubmit={event => { event.preventDefault(); runConsoleCommand(); }}>
          <span>›</span><input value={consoleInput} onChange={event => setConsoleInput(event.target.value)} aria-label="Workspace console command" autoComplete="off" spellCheck={false} placeholder="help, ls, cat src/App.tsx, grep TODO…"/>
          <button type="submit" disabled={!consoleInput.trim()}>Run</button>
        </form>
      </div>}</div>
      <aside className="inspector"><div className="inspector-title">AI COMMAND CENTER <span>guarded</span></div><div className="prompt"><div className="spark"><Sparkles size={16}/></div><p>What should we build next?</p><select className="agent-select" aria-label="Agent role" value={agentType} onChange={event => setAgentType(event.target.value)}><option value="coder">Coder</option><option value="planner">Planner</option><option value="reviewer">Reviewer</option><option value="debugger">Debugger</option><option value="tester">Tester</option><option value="refactorer">Refactorer</option><option value="security">Security</option><option value="documentation">Documentation</option></select><select className="agent-select" aria-label="Model provider" value={selectedProvider} onChange={event => setSelectedProvider(event.target.value)}><option value="workers-ai">Cloudflare Workers AI</option>{providerConfigs.map(config => <option key={config.provider} value={config.provider}>{config.provider} · {config.model}</option>)}</select><div className="prompt-input"><input aria-label="AI task" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => event.key === 'Enter' && runAgent()} placeholder="Describe a task…"/><button onClick={() => runAgent()} aria-label="Queue AI task"><ChevronRight size={16}/></button></div><div className="chips"><button onClick={() => runAgent('Review this file')}>Review this file</button><button onClick={() => runAgent('Find bugs')}>Find bugs</button><button onClick={() => runAgent('Write tests')}>Write tests</button></div><small className="ai-cost-note">Workers AI usage-based billing may apply.</small></div>{agentOutput && <div className="agent-output"><div><b>AGENT RESPONSE</b><button onClick={() => navigator.clipboard.writeText(agentOutput)}>Copy</button></div><pre>{agentOutput}</pre></div>}<div className="run-card"><div className="run-label"><span className="green">●</span> WORKSPACE STATUS <span>{connection}</span></div><h3>{activity}</h3><div className="steps"><div>✓ Supabase identity verified</div><div>✓ D1 workspace persistence</div><div className="current"><Zap size={13}/> Cloudflare Workers AI · usage based</div></div></div><div className="metrics"><div><span>WORKSPACES</span><strong>{workspaces.length}</strong></div><div><span>FILES</span><strong>{files.length}</strong></div><div><span>ACCOUNT</span><strong>LIVE</strong></div></div>{notice && <div className="notice" role="status">{notice}</div>}</aside>
    </section>
    {changeReviewOpen && selectedChange && <div className="modal-backdrop" onClick={() => setChangeReviewOpen(false)}><div className="history-modal change-review-modal" onClick={event => event.stopPropagation()}><div className="history-modal-head"><div><b>APPROVE CODE CHANGE</b><small>{selectedChange.file_path} · review before applying</small></div><button onClick={() => setChangeReviewOpen(false)}><X size={16}/></button></div><div className="change-review-note">This proposal will modify your workspace file only after you approve it. The current version is preserved in file history.</div><div className="history-diff"><DiffEditor height="100%" theme="vs-dark" language={languageFor(selectedChange.file_path)} original={selectedChange.original_content} modified={selectedChange.proposed_content} options={{readOnly:true,minimap:{enabled:false},fontSize:12,renderSideBySide:true,scrollBeyondLastLine:false}}/></div><div className="change-review-actions"><button className="reject-change" onClick={rejectSelectedChange} disabled={busy}>Reject</button><button className="approve-change" onClick={approveSelectedChange} disabled={busy}><Check size={14}/> {busy ? 'Applying…' : 'Approve & apply'}</button></div></div></div>}
    {historyOpen && <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}><div className="history-modal" onClick={event => event.stopPropagation()}><div className="history-modal-head"><div><b>FILE VERSION HISTORY</b><small>{selectedPath}</small></div><button onClick={() => setHistoryOpen(false)}><X size={16}/></button></div><div className="history-modal-body"><aside className="version-list">{historyLoading ? <small>Loading versions…</small> : historyVersions.length ? historyVersions.map(version => <button className={selectedVersion === version.id ? 'version-item selected' : 'version-item'} key={version.id} onClick={() => { setSelectedVersion(version.id); setVersionContent(version.content); }}><b>{new Date(version.created_at).toLocaleString()}</b><small>{version.content.length.toLocaleString()} characters</small></button>) : <div className="panel-empty"><History size={18}/><strong>No saved versions</strong><span>Save the file after editing to create a history snapshot.</span></div>}</aside><div className="history-diff">{selectedVersion ? <DiffEditor height="100%" theme="vs-dark" language={selectedFile?.language || 'typescript'} original={versionContent} modified={content} options={{readOnly:true,minimap:{enabled:false},fontSize:12,renderSideBySide:true,scrollBeyondLastLine:false}}/> : <div className="panel-empty">Select a version to compare.</div>}</div></div><div className="history-modal-foot"><span>Left: selected version · Right: current editor buffer</span><button className="run" onClick={restoreVersion} disabled={!selectedVersion || busy || !canEditWorkspace}>Restore selected version</button></div></div></div>}{searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="search-modal" onClick={event => event.stopPropagation()}>
      <div><b>Search workspace code</b><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={16}/></button></div>
      <div className="workspace-search-controls"><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search code, symbols, TODOs, or paths…" aria-label="Search workspace code"/><select value={searchMode} onChange={event => setSearchMode(event.target.value as 'all' | 'content' | 'path')} aria-label="Search mode"><option value="all">All files</option><option value="content">Code contents</option><option value="path">File paths</option></select></div>
      <div className="search-results">
        {searchLoading && <div className="search-state">Searching workspace…</div>}
        {searchError && <div className="search-state error">{searchError}</div>}
        {!searchLoading && !searchError && searchQuery.trim().length < 2 && <div className="search-state">Enter at least 2 characters to search this workspace.</div>}
        {!searchLoading && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && <div className="search-state">No matches found.</div>}
        {searchResults.map(file => <button className="workspace-search-result" key={file.path} onClick={() => { openFile(file.path); setSearchOpen(false); }}>
          <span><Code2 size={13}/><b>{file.path}</b><small>{file.matches} match{file.matches === 1 ? '' : 'es'}</small></span>
          {file.hits.map((hit, index) => <small className="search-snippet" key={index}>{hit.line > 0 ? `L${hit.line}: ` : ''}{hit.text}</small>)}
        </button>)}
      </div>
      <small>Searches all files in the selected workspace using D1 and short-lived KV caching.</small>
    </div></div>}
  </main>;
}
const hostedRedirect = getHostedAppRedirectUrl(window.location.href);
if (hostedRedirect) {
  window.location.replace(hostedRedirect);
} else {
  const authRedirectState = readAuthRedirectState(window.location.href);
  const root = createRoot(document.getElementById('root')!);
  const isAppRoute = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/');
  const authQuery = new URLSearchParams(window.location.search);
  const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isAuthCallback = authQuery.has('code') || authQuery.has('error') || authHash.has('access_token') || authHash.has('error') || authHash.has('type');
  if (!isAppRoute && !isAuthCallback) {
    root.render(<LandingPage />);
  } else {
    root.render(<main className="auth-shell"><div className="auth-card" role="status">Loading CodeForge securely…</div></main>);
    void initializeSupabase()
      .catch(() => undefined)
      .finally(() => root.render(<App authRedirectState={authRedirectState}/>));
  }
}
