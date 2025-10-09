-- Quick fix for RLS policies
-- Run this in your Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view own ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can create own ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Service role can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Service role can view all messages" ON ticket_messages;

-- Create simple policies that allow all operations
CREATE POLICY "Allow all operations on tickets" ON tickets
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ticket_messages" ON ticket_messages
    FOR ALL USING (true) WITH CHECK (true);
