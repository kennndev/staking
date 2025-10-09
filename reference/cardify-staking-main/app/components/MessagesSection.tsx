'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { useStaking } from '../contexts/StakingContext';
import { TicketService, Ticket, TicketMessage } from '../lib/supabase';
import TicketModal from './TicketModal';

// Using the types from Supabase
type SupportTicket = Ticket & {
  messages: TicketMessage[];
};

export default function MessagesSection() {
  const { walletAddress } = useStaking();
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tickets from Supabase on component mount
  useEffect(() => {
    if (walletAddress) {
      loadTickets();
    }
  }, [walletAddress]);

  const loadTickets = async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const tickets = await TicketService.getTicketsByWallet(walletAddress);
      // Optimize: Only load messages for tickets that are actually needed
      // For the list view, we don't need all messages immediately
      const ticketsWithMessages = tickets.map(ticket => ({
          ...ticket,
        messages: [] // Load messages lazily when ticket is selected
      }));
      setSupportTickets(ticketsWithMessages);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Failed to load tickets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for a specific ticket (lazy loading)
  const loadTicketMessages = async (ticketId: string) => {
    try {
      const messages = await TicketService.getTicketMessages(ticketId);
      return messages.map(msg => ({
        ...msg,
        text: msg.message_text,
        timestamp: new Date(msg.created_at),
        isUser: msg.is_user
      }));
    } catch (err) {
      console.error('Error loading ticket messages:', err);
      return [];
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim() || !walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const newTicket = await TicketService.createTicket(
        walletAddress,
        newTicketSubject,
        newTicketMessage,
        'medium'
      );

      // Add the ticket with its initial message
      const ticketWithMessage: SupportTicket = {
        ...newTicket,
        messages: [{
          id: 'temp',
          ticket_id: newTicket.id,
          message_text: newTicketMessage,
          is_user: true,
          sender: walletAddress,
          created_at: newTicket.created_at
        }]
      };

      setSupportTickets(prev => [ticketWithMessage, ...prev]);
    setNewTicketSubject('');
    setNewTicketMessage('');
    setShowNewTicketForm(false);
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError('Failed to create ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplyToTicket = useCallback(async () => {
    if (!selectedTicket || !ticketReply.trim() || !walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const newMessage = await TicketService.addMessage(
        selectedTicket.id,
        ticketReply,
        true,
        walletAddress
      );

      const updatedMessage = {
        ...newMessage,
        text: newMessage.message_text,
        timestamp: new Date(newMessage.created_at),
        isUser: newMessage.is_user
    };

    const updatedTicket = {
      ...selectedTicket,
        messages: [...selectedTicket.messages, updatedMessage],
        last_message_at: newMessage.created_at,
      status: selectedTicket.status === 'closed' ? 'open' : selectedTicket.status
    };

    setSupportTickets(prev => 
      prev.map(ticket => ticket.id === selectedTicket.id ? updatedTicket : ticket)
    );
    setSelectedTicket(updatedTicket);
    setTicketReply('');
    } catch (err) {
      console.error('Error adding message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTicket, ticketReply, walletAddress]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-white bg-green-600';
      case 'in-progress': return 'text-white bg-yellow-600';
      case 'resolved': return 'text-white bg-blue-600';
      case 'closed': return 'text-white bg-gray-600';
      default: return 'text-white bg-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-white bg-red-600';
      case 'high': return 'text-white bg-orange-600';
      case 'medium': return 'text-white bg-yellow-600';
      case 'low': return 'text-white bg-green-600';
      default: return 'text-white bg-gray-600';
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300">Please connect your wallet to access the support ticket system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Support Tickets</h1>
        <p className="text-gray-300">Create and manage your support requests</p>
        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Create New Ticket */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Create New Ticket</h2>
          <button
            onClick={() => setShowNewTicketForm(!showNewTicketForm)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
          >
            {showNewTicketForm ? 'Cancel' : '+ New Ticket'}
          </button>
        </div>

        {showNewTicketForm && (
          <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={newTicketSubject}
                onChange={(e) => setNewTicketSubject(e.target.value)}
                placeholder="Brief description of your issue..."
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={newTicketMessage}
                onChange={(e) => setNewTicketMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCreateTicket}
              disabled={!newTicketSubject.trim() || !newTicketMessage.trim() || isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              {isLoading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Your Support Tickets</h3>
        
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Loading tickets...</p>
          </div>
        ) : supportTickets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No support tickets yet. Create your first ticket above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {supportTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-white font-medium">{ticket.subject}</h4>
                    <p className="text-sm text-gray-400">#{ticket.id}</p>
                    <p className="text-sm text-gray-300 mt-1 line-clamp-2">{ticket.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status.toUpperCase()}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                  <span>Messages: {ticket.messages.length}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <TicketModal 
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onReply={handleReplyToTicket}
          ticketReply={ticketReply}
          setTicketReply={setTicketReply}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}