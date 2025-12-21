-- Add owner_id column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- Enable RLS on organizations if not already enabled (it was in schema.sql but good to be safe)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own organization
CREATE POLICY "Users can create their own organization"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can view their own organization
CREATE POLICY "Users can view their own organization"
ON organizations FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

-- Policy: Users can update their own organization
CREATE POLICY "Users can update their own organization"
ON organizations FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id);

-- Policy: Users can delete their own organization
CREATE POLICY "Users can delete their own organization"
ON organizations FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Down migration (commented out)
-- ALTER TABLE organizations DROP COLUMN owner_id;
-- DROP POLICY "Users can create their own organization" ON organizations;
-- DROP POLICY "Users can view their own organization" ON organizations;
-- DROP POLICY "Users can update their own organization" ON organizations;
-- DROP POLICY "Users can delete their own organization" ON organizations;
