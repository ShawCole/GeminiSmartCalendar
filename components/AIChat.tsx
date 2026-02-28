import React, { useState, useRef, useEffect } from 'react';
import { CalendarEvent, ChatMessage, ChatSession, AIUpdateEvent } from '../types';
import { processChatRequest } from '../services/geminiService';
import { Send, Bot, User as UserIcon, Loader2, Sparkles, X, ChevronLeft, MessageSquare, Plus, Trash2 } from 'lucide-react';

interface AIChatProps {
  events: CalendarEvent[];
  currentDate: Date;
  onClose: () => void;
  onAddEvents: (events: CalendarEvent[]) => void;
  onUpdateEvents: (events: AIUpdateEvent[]) => void; // New prop for updating events
  onDeleteEvents: (eventIds: string[]) => void;     // New prop for deleting events
  planContext?: string;
  
  // Multi-session props
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onCreateSession: () => void;
  onUpdateSession: (sessionId: string, messages: ChatMessage[]) => void;
  onDeleteSession: (sessionId: string) => void;
}

const AIChat: React.FC<AIChatProps> = ({ 
  events, 
  currentDate, 
  onClose, 
  onAddEvents, 
  onUpdateEvents,
  onDeleteEvents,
  planContext,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onUpdateSession,
  onDeleteSession
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Auto-scroll when messages change
  useEffect(() => {
    if (activeSession) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, activeSessionId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeSessionId) return;

    const currentInput = input;
    const currentSessionId = activeSessionId;
    setInput('');
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: currentInput,
      timestamp: new Date(),
    };

    // 1. Add User Message immediately
    onUpdateSession(currentSessionId, [userMsg]);

    // 2. Call API
    const response = await processChatRequest(userMsg.text, events, currentDate, planContext);

    // 3. Process AI actions (add, update, delete)
    const msgsToAdd: ChatMessage[] = [];
    let confirmationText = response.text;

    if (response.eventIdsToDelete.length > 0) {
      onDeleteEvents(response.eventIdsToDelete);
      confirmationText += `\n🗑️ I've deleted ${response.eventIdsToDelete.length} event${response.eventIdsToDelete.length > 1 ? 's' : ''}.`;
    }
    
    if (response.eventsToUpdate.length > 0) {
      onUpdateEvents(response.eventsToUpdate);
      confirmationText += `\n📝 I've updated ${response.eventsToUpdate.length} event${response.eventsToUpdate.length > 1 ? 's' : ''}.`;
    }

    if (response.eventsToAdd.length > 0) {
      const newEvents: CalendarEvent[] = response.eventsToAdd.map(e => ({
        id: Math.random().toString(36).substr(2, 9),
        title: e.title,
        description: e.description,
        start: new Date(e.start),
        end: new Date(e.end),
        color: (e.color as any) || 'blue'
      }));
      onAddEvents(newEvents);
      confirmationText += `\n✅ I've added ${newEvents.length} event${newEvents.length > 1 ? 's' : ''} to your calendar.`;
    }

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: confirmationText,
      timestamp: new Date(),
    };
    msgsToAdd.push(botMsg);
    
    // 4. Add Bot Messages
    onUpdateSession(currentSessionId, msgsToAdd);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- View: Chat List (History) ---
  if (!activeSession) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-80 md:w-96 absolute right-0 top-0 bottom-0 z-40 transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Gemini Assistant</h3>
              <p className="text-xs text-gray-500">History</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
          </button>
        </div>

        {/* List of Chats */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
           <button 
             onClick={onCreateSession}
             className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-colors font-medium mb-4"
           >
             <Plus size={18} /> New Chat
           </button>

           {sessions.length === 0 ? (
               <div className="text-center py-10 text-gray-400">
                   <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
                   <p className="text-sm">No conversations yet.</p>
               </div>
           ) : (
               sessions.map(session => (
                   <div 
                     key={session.id} 
                     className="group flex items-center justify-between p-3 bg-white border border-gray-200 hover:border-indigo-300 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                     onClick={() => onSelectSession(session.id)}
                   >
                       <div className="flex items-center gap-3 overflow-hidden">
                           <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0">
                               <MessageSquare size={16} />
                           </div>
                           <div className="flex flex-col overflow-hidden">
                               <span className="text-sm font-medium text-gray-700 truncate">{session.title}</span>
                               <span className="text-xs text-gray-400 truncate">
                                   {session.updatedAt.toLocaleDateString()} • {session.updatedAt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                               </span>
                           </div>
                       </div>
                       <button 
                         onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                         className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                           <Trash2 size={14} />
                       </button>
                   </div>
               ))
           )}
        </div>
      </div>
    );
  }

  // --- View: Active Chat ---
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-80 md:w-96 absolute right-0 top-0 bottom-0 z-40 transition-transform">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center gap-2">
          <button 
             onClick={() => onSelectSession(null)}
             className="p-1.5 hover:bg-indigo-100 rounded-lg text-gray-500 hover:text-indigo-600 mr-1"
          >
             <ChevronLeft size={20} />
          </button>
          <div>
            <h3 className="font-semibold text-gray-800 truncate max-w-[150px]">{activeSession.title}</h3>
            <p className="text-xs text-gray-500">Gemini 2.0 Flash</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {activeSession.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'model' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'
            }`}>
              {msg.role === 'model' ? <Bot size={16} /> : <UserIcon size={16} />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none shadow-sm'
            }`}>
              {msg.text.includes('✅') || msg.text.includes('📝') || msg.text.includes('🗑️') ? (
                  <div className="flex flex-col gap-1 text-green-700 font-medium whitespace-pre-wrap">
                      {msg.text.split('\n').map((line, idx) => (
                          <span key={idx} className="flex items-center gap-2">
                              {line.startsWith('✅') && <span className="text-green-500">✅</span>}
                              {line.startsWith('📝') && <span className="text-blue-500">📝</span>}
                              {line.startsWith('🗑️') && <span className="text-red-500">🗑️</span>}
                              {line.replace(/^[✅📝🗑️]\s*/, '')}
                          </span>
                      ))}
                  </div>
              ) : msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
              <span className="text-xs text-gray-500 font-medium">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-2 flex justify-center">
             <span className="text-[10px] text-gray-400">Powered by Gemini 2.0 Flash</span>
        </div>
      </div>
    </div>
  );
};

export default AIChat;