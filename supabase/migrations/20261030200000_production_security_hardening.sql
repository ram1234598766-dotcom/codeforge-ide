-- CodeForge production security hardening.
-- Keep helper logic out of PostgREST's exposed public schema and limit it to signed-in RLS evaluation.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_workspace_member(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = target_workspace
        AND wm.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = target_workspace
        AND w.owner_id = (SELECT auth.uid())
    );
$function$;

REVOKE ALL ON FUNCTION private.is_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_workspace_member(uuid) TO authenticated;

-- Trigger-only profile creation runs with a minimal SECURITY DEFINER search path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$function$;

-- Functions used only by database triggers must not be callable through PostgREST RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role;

-- Replace the exposed SECURITY DEFINER helper with the private-schema helper.
DROP POLICY IF EXISTS "members read runs" ON public.agent_runs;
DROP POLICY IF EXISTS "users create runs" ON public.agent_runs;
DROP POLICY IF EXISTS "users update own runs" ON public.agent_runs;
DROP POLICY IF EXISTS "members read audit" ON public.audit_events;
DROP POLICY IF EXISTS "members access files" ON public.files;
DROP POLICY IF EXISTS "members delete files" ON public.files;
DROP POLICY IF EXISTS "members edit files" ON public.files;
DROP POLICY IF EXISTS "members update files" ON public.files;
DROP POLICY IF EXISTS "profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "members read" ON public.workspace_members;
DROP POLICY IF EXISTS "owners manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace members read" ON public.workspaces;
DROP POLICY IF EXISTS "workspace owners write" ON public.workspaces;

DROP FUNCTION IF EXISTS public.is_workspace_member(uuid);

CREATE POLICY "profiles self access"
ON public.profiles FOR ALL TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "workspace members read"
ON public.workspaces FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()) OR private.is_workspace_member(id));

CREATE POLICY "workspace owners insert"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "workspace owners update"
ON public.workspaces FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "workspace owners delete"
ON public.workspaces FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "members read"
ON public.workspace_members FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR private.is_workspace_member(workspace_id));

CREATE POLICY "owners insert members"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "owners update members"
ON public.workspace_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "owners delete members"
ON public.workspace_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "members read files"
ON public.files FOR SELECT TO authenticated
USING (
  private.is_workspace_member(workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "editors insert files"
ON public.files FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = files.workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role IN ('owner', 'admin', 'member')
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "editors update files"
ON public.files FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = files.workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role IN ('owner', 'admin', 'member')
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = files.workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role IN ('owner', 'admin', 'member')
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "editors delete files"
ON public.files FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = files.workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role IN ('owner', 'admin', 'member')
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "members read runs"
ON public.agent_runs FOR SELECT TO authenticated
USING (private.is_workspace_member(workspace_id) OR user_id = (SELECT auth.uid()));

CREATE POLICY "editors create runs"
ON public.agent_runs FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = agent_runs.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "users update own runs"
ON public.agent_runs FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = agent_runs.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = agent_runs.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "members read audit"
ON public.audit_events FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (workspace_id IS NOT NULL AND private.is_workspace_member(workspace_id))
);

CREATE INDEX IF NOT EXISTS agent_runs_user_id_idx ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS audit_events_user_id_idx ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS files_created_by_idx ON public.files(created_by);
CREATE INDEX IF NOT EXISTS files_parent_id_idx ON public.files(parent_id);
CREATE INDEX IF NOT EXISTS files_updated_by_idx ON public.files(updated_by);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON public.workspace_members(user_id);
