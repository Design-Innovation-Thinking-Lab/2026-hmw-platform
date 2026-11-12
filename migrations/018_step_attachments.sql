-- Schema V17: Analysis Step Attachments
-- Purpose: Allow uploading reference files (images, PDFs, etc.) to analysis steps
-- Use case: Upload example files for AI to reference during analysis

-- 1. Step Attachments Table
CREATE TABLE IF NOT EXISTS analysis_step_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid REFERENCES analysis_flow_steps(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text, -- 'image', 'pdf', 'document', 'reference'
  storage_path text NOT NULL, -- Supabase Storage path
  mime_type text,
  file_size integer,
  description text, -- Optional description of the file's purpose
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_step_attachments_step_id 
  ON analysis_step_attachments(step_id);

-- 3. Enable Row Level Security
ALTER TABLE analysis_step_attachments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy - Allow all operations for authenticated users
CREATE POLICY "Allow all step_attachments operations" 
  ON analysis_step_attachments 
  FOR ALL 
  USING (true);

-- 5. Comment for documentation
COMMENT ON TABLE analysis_step_attachments IS 
  'Stores reference files attached to analysis steps for AI to read during analysis';
