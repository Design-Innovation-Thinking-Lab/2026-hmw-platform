-- Schema V15: Project Ownership
-- Enable project ownership for mode managers

-- Add foreign key constraint for owner_id (column already exists)
ALTER TABLE projects 
DROP CONSTRAINT IF EXISTS fk_projects_owner;

ALTER TABLE projects 
ADD CONSTRAINT fk_projects_owner 
FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for owner-based queries
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- Add is_public column for sharing projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Create index for public projects
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public) WHERE is_public = true;

-- Comment: Existing projects with NULL owner_id will be managed by admins
