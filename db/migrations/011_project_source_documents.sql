-- 011_project_source_documents.sql
-- Add source_documents column for uploaded document text content

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS source_documents JSONB DEFAULT '[]'::jsonb;

-- source_documents stores array of { name: string, content: string, type: string }
