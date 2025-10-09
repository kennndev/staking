'use client';

import { useState, useEffect, memo } from 'react';
import { TicketService, TicketMessage } from '../lib/supabase';

interface TicketModalProps {
  ticket: any;
  onClose: () => void;
  onReply: () => void;
  ticketReply: string;
  setTicketReply: (reply: string) => void;
  isLoading: boolean;
}

const TicketModal = memo(({ 
  ticket, 
  onClose, 
  onReply, 
  ticketReply, 
  setTicketReply, 
  isLoading 
}: TicketModalProps) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Load messages when modal opens
  useEffect(() => {
    if (ticket && ticket.messages.length === 0) {
      loadMessages();
    } else if (ticket) {
      setMessages(ticket.messages);
    }
  }, [ticket]);

  const loadMessages = async () => {
    if (!ticket) return;
    
    setMessagesLoading(true);
    try {
      const ticketMessages = await TicketService.getTicketMessages(ticket.id);
      const formattedMessages = ticketMessages.map(msg => ({
        ...msg,
        text: msg.message_text,
        timestamp: new Date(msg.created_at),
        isUser: msg.is_user
      }));
      setMessages(formattedMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{ticket.subject}</h3>
            <p className="text-sm text-gray-400">#{ticket.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Ticket Messages */}
        <div className="flex-1 overflow-y-auto border border-white/10 rounded-lg p-3 sm:p-4 mb-4 bg-black/20">
          {messagesLoading ? (
            <div className="text-center py-4">
              <p className="text-gray-400">Loading messages...</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-xs md:max-w-sm lg:max-w-md px-3 sm:px-4 py-2 rounded-lg break-words ${
                      message.is_user
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-gray-100'
                    }`}
                  >
                    <p className="text-sm break-words">{message.message_text}</p>
                    <p className="text-xs opacity-70 mt-1 break-words">
                      {message.sender.length > 20 ? `${message.sender.slice(0, 8)}...${message.sender.slice(-8)}` : message.sender} • {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reply Input */}
        {ticket.status === 'closed' ? (
          <div className="bg-gray-600/20 border border-gray-500/50 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">
              This ticket is closed. No more messages can be added.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <input
              type="text"
              value={ticketReply}
              onChange={(e) => setTicketReply(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onReply()}
              placeholder="Type your reply..."
              className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onReply}
              disabled={!ticketReply.trim() || isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-200 w-full sm:w-auto"
            >
              {isLoading ? 'Sending...' : 'Reply'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

TicketModal.displayName = 'TicketModal';

export default TicketModal;
