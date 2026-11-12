-- Schema V8: Default Project for Rooms
-- Add is_default column to projects table
-- Only one project can be default at a time

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Create index for default project lookup
CREATE INDEX IF NOT EXISTS idx_projects_is_default ON projects(is_default) WHERE is_default = true;

-- Ensure only one project can be default (enforced at application level)
