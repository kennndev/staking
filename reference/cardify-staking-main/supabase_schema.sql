-- Supabase Database Schema for Ticket System
-- Run this SQL in your Supabase SQL Editor

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket_messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_user BOOLEAN NOT NULL DEFAULT true,
    sender TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_wallet_address ON tickets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tickets_updated_at 
    BEFORE UPDATE ON tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_ticket_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tickets 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.ticket_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ticket_last_message_trigger
    AFTER INSERT ON ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_last_message();

-- Enable Row Level Security (RLS)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for tickets table
-- Allow all operations for now (we'll implement wallet-based auth later)
CREATE POLICY "Allow all operations on tickets" ON tickets
    FOR ALL USING (true) WITH CHECK (true);

-- Create policies for ticket_messages table  
-- Allow all operations for now (we'll implement wallet-based auth later)
CREATE POLICY "Allow all operations on ticket_messages" ON ticket_messages
    FOR ALL USING (true) WITH CHECK (true);

-- Admin policies (for service role)
-- Service role can view all tickets
CREATE POLICY "Service role can view all tickets" ON tickets
    FOR ALL USING (auth.role() = 'service_role');

-- Service role can view all messages
CREATE POLICY "Service role can view all messages" ON ticket_messages
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON ticket_messages TO authenticated;
GRANT ALL ON tickets TO service_role;
GRANT ALL ON ticket_messages TO service_role;
