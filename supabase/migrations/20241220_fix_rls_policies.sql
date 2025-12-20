-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read messages
CREATE POLICY "Enable read access for authenticated users"
ON messages FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert messages (for manual replies)
CREATE POLICY "Enable insert access for authenticated users"
ON messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also ensure leads are readable if we ever fetch them client side (though currently passed via props)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for leads"
ON leads FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable update access for leads"
ON leads FOR UPDATE
TO authenticated
USING (true);
