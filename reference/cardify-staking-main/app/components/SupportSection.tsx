'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { openaiService } from '../lib/openai-service';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// Removed unused interfaces - now using OpenAI service

// Removed unused chatbotKnowledge - now using OpenAI service

export default function SupportSection() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm the NickPlaysCrypto AI Assistant. I can help you with information about our platform, staking, games, and more. How can I assist you today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const generateResponse = async (userMessage: string): Promise<string> => {
    try {
      // Convert messages to OpenAI format for context
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.text
      }));

      // Use OpenAI service for intelligent responses
      const response = await openaiService.generateResponse(userMessage, conversationHistory);
      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      // Fallback to basic response
      return `I apologize, but I'm having trouble processing your request right now. Please try again, or feel free to ask me about:
      
• Platform features and information
• Staking procedures and rewards  
• Available games and gameplay
• Social media links and community
• Token information and trading data

I'm here to help with any questions about NickPlaysCrypto!`;
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    // Scroll to bottom when user sends message
    setTimeout(() => scrollToBottom(), 100);

    try {
      // Generate response using OpenAI service
      const response = await generateResponse(currentInput);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Scroll to bottom when bot responds
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error handling message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I apologize, but I'm having trouble processing your request right now. Please try again!",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Scroll to bottom on error
      setTimeout(() => scrollToBottom(), 100);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { label: "Platform Info", action: "Tell me about the platform" },
    { label: "How to Stake", action: "How do I stake tokens?" },
    { label: "Games", action: "What games are available?" },
    { label: "Social Links", action: "Show me social media links" },
    { label: "Token Info", action: "Tell me about NPC token" }
  ];

  const handleQuickAction = async (action: string) => {
    setInputText(action);
    await handleSendMessage();
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">
            🤖 AI Support Assistant
          </h1>
          <p className="text-gray-300 text-sm sm:text-base md:text-lg">
            Get instant help with NickPlaysCrypto platform, staking, games, and more!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.action)}
                className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-white/10 p-3 sm:p-4">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white font-medium text-sm sm:text-base">AI Assistant</span>
              <span className="text-gray-400 text-xs sm:text-sm">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={messagesContainerRef}
            className="h-80 sm:h-96 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 sm:px-4 sm:py-3 rounded-lg ${
                    message.isUser
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-xs sm:text-sm">{message.text}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-white border border-white/20 px-3 py-2 sm:px-4 sm:py-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-white/10 p-3 sm:p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about NickPlaysCrypto..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 sm:px-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 text-sm sm:text-base"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isTyping}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-4 py-2 sm:px-6 rounded-lg transition-all duration-200 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">💰 How to Stake</h3>
            <ol className="text-gray-300 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
              <li>1. Visit <a href="https://npc-staking.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">npc-staking.vercel.app</a></li>
              <li>2. Connect your Solana wallet</li>
              <li>3. Navigate to the staking section</li>
              <li>4. Choose your stake amount</li>
              <li>5. Complete the staking process</li>
              <li>6. Start earning rewards!</li>
            </ol>
          </div>

          <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 border border-green-500/30 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">📊 Platform Features</h3>
            <ul className="text-gray-300 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
              <li>• Real-time staking analytics</li>
              <li>• Interactive gaming section</li>
              <li>• Token performance tracking</li>
              <li>• Community integration</li>
            </ul>
          </div>

          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">🎮 Gaming</h3>
            <ul className="text-gray-300 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
              <li>• Cyber Defense strategy game</li>
              <li>• Pop Pop bubble game</li>
              <li>• Puzzle Match brain teaser</li>
              <li>• Space Shooter adventure</li>
            </ul>
          </div>

          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">🔗 External Links</h3>
            <ul className="text-gray-300 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
              <li>• <a href="https://npc-staking.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Staking App</a></li>
              <li>• <a href="https://www.nickplayscrypto.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Official Website</a></li>
              <li>• <a href="https://x.com/NickPlaysCrypto" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Twitter/X</a></li>
              <li>• <a href="https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">DexScreener</a></li>
              <li>• Discord Community</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
