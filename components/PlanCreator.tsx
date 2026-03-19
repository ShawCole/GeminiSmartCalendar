import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2, CalendarCheck, X, Sparkles, Check, History, Clock, RefreshCcw, ArrowRight } from 'lucide-react';
import { generateSchedulePlan } from '../services/geminiService';
import { CalendarEvent, AIPlanResponse } from '../types';
import { COLORS } from '../constants';

// Add type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

interface PlanCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (events: CalendarEvent[], explanation: string) => void;
  currentDate: Date;
}

const PlanCreator: React.FC<PlanCreatorProps> = ({ isOpen, onClose, onApplyPlan, currentDate }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<AIPlanResponse | null>(null);
  
  // Refinement State
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // History State
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Simple Speech Recognition setup
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('smartcalendar_plan_history');
    if (saved) {
        try {
            setHistory(JSON.parse(saved));
        } catch (e) {
            console.error('Failed to parse history', e);
        }
    }
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      
      rec.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        if (generatedPlan) {
             setRefineInput((prev) => (prev ? prev + ' ' + transcript : transcript));
        } else {
             setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
        }
        setIsListening(false);
      };
      
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      
      setRecognition(rec);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
        alert("Voice recognition not supported in this browser.");
        return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;
    
    // Save to history
    const trimmed = input.trim();
    const newHistory = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem('smartcalendar_plan_history', JSON.stringify(newHistory));
    
    setIsProcessing(true);
    setGeneratedPlan(null);

    const plan = await generateSchedulePlan(input, currentDate);
    setGeneratedPlan(plan);
    setIsProcessing(false);
  };

  const handleRefine = async () => {
    if (!refineInput.trim() || !generatedPlan) return;
    
    setIsRefining(true);
    
    const updatedPlan = await generateSchedulePlan(refineInput, currentDate, generatedPlan);
    
    if (updatedPlan) {
        setGeneratedPlan(updatedPlan);
        setRefineInput('');
    }
    setIsRefining(false);
  };

  const handleConfirm = () => {
    if (!generatedPlan) return;
    
    const newEvents: CalendarEvent[] = generatedPlan.events.map(e => ({
      id: Math.random().toString(36).substr(2, 9),
      title: e.title,
      description: e.description,
      start: new Date(e.start),
      end: new Date(e.end),
      color: (e.color as any) || 'blue'
    }));

    onApplyPlan(newEvents, generatedPlan.explanation);
    handleClose();
  };

  const handleClose = () => {
    setInput('');
    setRefineInput('');
    setGeneratedPlan(null);
    setIsProcessing(false);
    setIsRefining(false);
    setShowHistory(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-2 text-indigo-700">
            <Sparkles size={20} />
            <h2 className="font-semibold text-lg">AI Plan Creator</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!generatedPlan ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-medium text-gray-800">What do you want to achieve?</h3>
                <p className="text-gray-500 text-sm">Describe your goal, and I'll build a schedule for you.</p>
              </div>

              {/* Input Section */}
              <div className="relative group">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., 'Plan a comprehensive study schedule for my biology exam over the next 3 days, focusing on genetics in the morning and ecology in the afternoon.'"
                  className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-gray-700"
                />
                
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                     <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="p-2 rounded-full bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                        title="History"
                    >
                        <History size={18} />
                    </button>

                    <button
                      onClick={toggleListening}
                      className={`p-2 rounded-full transition-all shadow-sm ${
                        isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                      }`}
                      title="Voice Input"
                    >
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                </div>

                {/* History Overlay */}
                {showHistory && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 rounded-xl border border-gray-200 flex flex-col animate-in fade-in zoom-in-95 duration-200 shadow-lg">
                        <div className="flex items-center justify-between p-3 border-b border-gray-100">
                            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-2">
                                <Clock size={14} /> Recent Plans
                            </span>
                            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {history.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                    <History size={24} className="mb-2 opacity-20" />
                                    No history yet
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {history.map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setInput(item);
                                                setShowHistory(false);
                                            }}
                                            className="w-full text-left p-3 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 text-sm text-gray-600 transition-colors group border border-transparent hover:border-indigo-100 flex items-start gap-2"
                                        >
                                           <div className="mt-0.5 opacity-50 flex-shrink-0"><History size={12} /></div>
                                           <p className="line-clamp-2 leading-relaxed">{item}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={!input.trim() || isProcessing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-200"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Creating Plan...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Plan
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Plan Explanation Overlay */}
              <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
                <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-800 mb-2 flex items-center gap-2">
                    <Sparkles size={14} /> The Plan
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {generatedPlan.explanation}
                </p>
              </div>

              {/* Events Preview */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Proposed Events ({generatedPlan.events.length})</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {generatedPlan.events.map((event, idx) => {
                      const colorStyle = COLORS[event.color as keyof typeof COLORS] || COLORS.blue;
                      return (
                        <div key={idx} className={`flex gap-3 p-3 rounded-lg border bg-white ${colorStyle.border}`}>
                          <div className={`w-1 self-stretch rounded-full ${colorStyle.bg.replace('bg-', 'bg-')}-500`}></div>
                          <div className="flex-1">
                             <div className="flex justify-between items-start">
                                <span className="font-medium text-gray-800">{event.title}</span>
                                <span className="text-[10px] uppercase font-bold text-gray-400 border border-gray-200 px-1 rounded">
                                    {event.color}
                                </span>
                             </div>
                             <div className="text-xs text-gray-500 mt-1">
                                {new Date(event.start).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} - 
                                {new Date(event.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                             </div>
                             {event.description && (
                                 <p className="text-xs text-gray-400 mt-1 truncate">{event.description}</p>
                             )}
                          </div>
                        </div>
                      )
                  })}
                </div>
              </div>

              {/* Refinement Section */}
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <label className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-2">
                     <RefreshCcw size={12} /> Refine Plan
                 </label>
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input 
                          type="text"
                          className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm" 
                          placeholder="e.g., Break down the recording session, add a lunch break..."
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isRefining && refineInput.trim()) {
                                  handleRefine();
                              }
                          }}
                        />
                         <button
                            onClick={toggleListening}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                                isListening ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'
                            }`}
                        >
                            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                    </div>
                    <button 
                        onClick={handleRefine}
                        disabled={!refineInput.trim() || isRefining}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        {isRefining ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        Update
                    </button>
                 </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer Actions (Only visible when plan generated) */}
        {generatedPlan && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
            <button
              onClick={() => {
                  setGeneratedPlan(null);
                  setRefineInput('');
              }}
              className="px-5 py-2 text-gray-600 hover:bg-gray-200 font-medium rounded-lg transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md flex items-center gap-2 transition-colors"
            >
              <CalendarCheck size={18} />
              Add to Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanCreator;