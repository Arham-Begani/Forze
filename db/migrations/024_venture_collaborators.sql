-- 024_venture_collaborators.sql
-- Add venture_members and venture_invites tables for role-based team collaboration.

-- Venture Members (Role-based access)
CREATE TABLE IF NOT EXISTS venture_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venture_id, user_id)
);

-- Venture Invites
CREATE TABLE IF NOT EXISTS venture_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill: Make all existing venture creators the 'owner' of their venture in the new table
INSERT INTO venture_members (venture_id, user_id, role, created_at)
SELECT id, user_id, 'owner', created_at
FROM ventures
ON CONFLICT (venture_id, user_id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_venture_members_user_id ON venture_members(user_id);
CREATE INDEX IF NOT EXISTS idx_venture_members_venture_id ON venture_members(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_invites_venture_id ON venture_invites(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_invites_token ON venture_invites(token);

-- RLS Policies
ALTER TABLE venture_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_invites ENABLE ROW LEVEL SECURITY;

-- Note: We rely heavily on our API and server-side checks for specific RBAC enforcement,
-- but basic RLS is provided below.

-- Users can view venture members if they are part of the venture.
CREATE POLICY "Users can view members of their ventures" ON venture_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    venture_id IN (SELECT venture_id FROM venture_members WHERE user_id = auth.uid())
  );

-- Only owners and admins can manage members, but we do not enforce this entirely in RLS
-- to allow our backend service client more explicit control and easier debugging.
-- We allow users to see their own invites and invites for their ventures.
CREATE POLICY "Users can view invites for their ventures" ON venture_invites
  FOR SELECT USING (
    venture_id IN (SELECT venture_id FROM venture_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
 