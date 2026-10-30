export type AgentMode = 'plan' | 'edit' | 'review' | 'test' | 'debug';
export type Workspace = { id: string; name: string; provider: 'supabase' | 'local'; };
export type AgentRun = { id: string; mode: AgentMode; status: 'queued' | 'running' | 'completed' | 'failed'; };
