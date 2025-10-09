import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { validateEnvironment } from './env-validator';

// Database types
export interface Ticket {
  id: string;
  wallet_address: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  message_text: string;
  is_user: boolean;
  sender: string;
  created_at: string;
}

// Validate environment variables only if they are actually missing
if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL === '') {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required. Please add it to your .env.local file.');
}
if (!ENV.SUPABASE_ANON_KEY || ENV.SUPABASE_ANON_KEY === '') {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please add it to your .env.local file.');
}
if (!ENV.SUPABASE_SERVICE_KEY || ENV.SUPABASE_SERVICE_KEY === '') {
  throw new Error('SUPABASE_SERVICE_KEY is required. Please add it to your .env.local file.');
}

// Create Supabase client for client-side operations
export const supabase = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_ANON_KEY
);

// Create Supabase client for admin operations (server-side)
export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Ticket operations
export class TicketService {
  // Create a new ticket
  static async createTicket(
    walletAddress: string,
    subject: string,
    description: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<Ticket> {
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        wallet_address: walletAddress,
        subject,
        description,
        priority,
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial message
    await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: data.id,
        message_text: description,
        is_user: true,
        sender: walletAddress
      });

    return data;
  }

  // Get tickets for a specific wallet
  static async getTicketsByWallet(walletAddress: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get all tickets (admin only)
  static async getAllTickets(): Promise<Ticket[]> {
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get messages for a ticket
  static async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Add message to ticket
  static async addMessage(
    ticketId: string,
    messageText: string,
    isUser: boolean,
    sender: string
  ): Promise<TicketMessage> {
    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        message_text: messageText,
        is_user: isUser,
        sender
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update ticket status
  static async updateTicketStatus(
    ticketId: string,
    status: 'open' | 'in-progress' | 'resolved' | 'closed'
  ): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId);

    if (error) throw error;
  }

  // Update ticket priority
  static async updateTicketPriority(
    ticketId: string,
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({ priority })
      .eq('id', ticketId);

    if (error) throw error;
  }

  // Admin: Add admin response to ticket
  static async addAdminResponse(
    ticketId: string,
    messageText: string,
    adminWallet: string
  ): Promise<TicketMessage> {
    const { data, error } = await supabaseAdmin
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        message_text: messageText,
        is_user: false,
        sender: adminWallet
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
