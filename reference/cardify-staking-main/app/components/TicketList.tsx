'use client';

import { memo, useMemo } from 'react';

interface TicketListProps {
  tickets: any[];
  onTicketSelect: (ticket: any) => void;
  selectedTicket: any;
  isLoading: boolean;
}

const TicketItem = memo(({ ticket, isSelected, onClick }: { 
  ticket: any; 
  isSelected: boolean; 
  onClick: () => void;
}) => {
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

  return (
    <div
      className={`p-2 sm:p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-blue-500/20 border-blue-500/50'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="text-white font-medium text-sm">{ticket.subject}</h4>
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ticket.description}</p>
          <p className="text-xs text-gray-500 mt-1 break-all">
            Wallet: {ticket.wallet_address.slice(0, 8)}...{ticket.wallet_address.slice(-8)}
          </p>
        </div>
        <div className="flex flex-col space-y-1 ml-2">
          <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(ticket.status)}`}>
            {ticket.status.toUpperCase()}
          </span>
          <span className={`text-xs px-2 py-1 rounded font-medium ${getPriorityColor(ticket.priority)}`}>
            {ticket.priority.toUpperCase()}
          </span>
          {ticket.status === 'closed' && (
            <span className="text-xs px-2 py-1 rounded font-medium bg-gray-600 text-white">
              LOCKED
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
        <span>{new Date(ticket.last_message_at).toLocaleString()}</span>
      </div>
    </div>
  );
});

TicketItem.displayName = 'TicketItem';

const TicketList = memo(({ tickets, onTicketSelect, selectedTicket, isLoading }: TicketListProps) => {
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  }, [tickets]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Loading tickets...</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No tickets found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
      {sortedTickets.map((ticket) => (
        <TicketItem
          key={ticket.id}
          ticket={ticket}
          isSelected={selectedTicket?.id === ticket.id}
          onClick={() => onTicketSelect(ticket)}
        />
      ))}
    </div>
  );
});

TicketList.displayName = 'TicketList';

export default TicketList;
