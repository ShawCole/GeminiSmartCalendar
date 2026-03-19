import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Menu,
  Plus,
  Sparkles,
  Search,
  Settings,
  Wand2
} from 'lucide-react';
import { COLORS, HOURS, INITIAL_EVENTS, MOCK_USER } from './constants';
import { CalendarEvent, ViewMode, ChatSession, ChatMessage, AIUpdateEvent } from './types';
import {
  getWeekDays,
  formatDate,
  isSameDay,
  getPositionStyles,
  formatTime,
  formatHour,
  getSnappedDateFromY,
  getPositionStylesFromDates,
  organizeEvents,
  FormattedEvent
} from './services/calendarService';
import EventModal from './components/EventModal';
import AIChat from './components/AIChat';
import PlanCreator from './components/PlanCreator';
import useLocalStorage from './hooks/useLocalStorage';

interface DragOperation {
  type: 'create' | 'move' | 'resize';
  // For 'create'
  start?: Date;
  end?: Date;
  day?: Date;
  // For 'move' or 'resize'
  event?: CalendarEvent;
  // For 'move'
  originalStart?: Date;
  offsetMinutes?: number; // Distance from cursor to event start
  // For 'resize'
  edge?: 'start' | 'end';
  
  startX?: number;
  startY?: number;
}

function App() {
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date();
  });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>(
    'smartcalendar_events',
    INITIAL_EVENTS,
    (parsed: any[]) => parsed.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPlanCreatorOpen, setIsPlanCreatorOpen] = useState(false);
  
  // State to store the context/explanation from the last Magic Plan generated
  const [magicPlanContext, setMagicPlanContext] = useLocalStorage<string>('smartcalendar_plan_context', '');

  // Chat Sessions State
  const [chatSessions, setChatSessions] = useLocalStorage<ChatSession[]>(
    'smartcalendar_chat_sessions',
    [],
    (parsed: any[]) => parsed.map((s: any) => ({
      ...s,
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }))
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Unified Drag State
  const [dragOp, setDragOp] = useState<DragOperation | null>(null);
  
  // Ref to track if a drag actually moved significantly (to distinguish click from drag)
  const isDraggingRef = useRef(false);

  // Ref for the day columns container to calculate day switches during drag
  const columnsContainerRef = useRef<HTMLDivElement>(null);

  // Scroll Accumulator for Wheel
  const scrollAccumulatorX = useRef(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | undefined>(undefined);

  // Derived state
  const weekDays = useMemo(() => getWeekDays(currentDate, viewMode), [currentDate, viewMode]);

  // Handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (viewMode === ViewMode.Week ? 7 : 3));
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (viewMode === ViewMode.Week ? 7 : 3));
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleSaveEvent = (event: CalendarEvent) => {
    setEvents(prev => {
      // Check if we are editing an existing event (by checking selectedEvent)
      // OR check if the event ID already exists in the array
      const exists = prev.some(e => e.id === event.id);
      if (exists) {
        return prev.map(e => e.id === event.id ? event : e);
      }
      return [...prev, event];
    });
  };

  const handleAddMultipleEvents = (newEvents: CalendarEvent[]) => {
      setEvents(prev => [...prev, ...newEvents]);
  };

  // New handler for AI-driven event updates
  const handleUpdateEventsFromAI = (updatedEvents: AIUpdateEvent[]) => {
    setEvents(prev => prev.map(existingEvent => {
      const updated = updatedEvents.find(ue => ue.id === existingEvent.id);
      if (updated) {
        return {
          ...existingEvent,
          title: updated.title,
          description: updated.description,
          start: new Date(updated.start),
          end: new Date(updated.end),
          color: updated.color as CalendarEvent['color'],
        };
      }
      return existingEvent;
    }));
  };

  // New handler for AI-driven event deletions
  const handleDeleteEventsFromAI = (eventIds: string[]) => {
    setEvents(prev => prev.filter(e => !eventIds.includes(e.id)));
  };

  // Specific handler for Plan Creator which provides context/explanation
  const handleApplyPlan = (newEvents: CalendarEvent[], explanation: string) => {
    setEvents(prev => [...prev, ...newEvents]);
    setMagicPlanContext(explanation);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // Chat Session Handlers
  const handleCreateSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [{
        id: 'welcome',
        role: 'model',
        text: 'Hi! I can help you manage your schedule. You can ask me to "Schedule a meeting for tomorrow at 2pm" or "Plan my Friday".',
        timestamp: new Date(),
      }],
      updatedAt: new Date(),
    };
    setChatSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleUpdateSession = (sessionId: string, newMessages: ChatMessage[]) => {
    setChatSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        // Update title if it's the first user message being added to a generic titled session
        let title = session.title;
        if (session.title === 'New Conversation') {
             const firstUserMsg = newMessages.find(m => m.role === 'user');
             if (firstUserMsg) {
                 title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
             }
        }
        
        return {
          ...session,
          messages: [...session.messages, ...newMessages],
          title,
          updatedAt: new Date()
        };
      }
      return session;
    }));
  };

  const handleDeleteSession = (id: string) => {
      setChatSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
          setActiveSessionId(null);
      }
  };

  // --- Wheel / Scroll Handler ---
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Only handle horizontal scroll if no drag operation is active
    if (dragOp) return;

    // We prioritize horizontal scroll if deltaX is significant
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        scrollAccumulatorX.current += e.deltaX;
        
        // Threshold for switching days. 
        // 30px is a sensitive threshold for trackpads.
        const threshold = 30; 
        
        if (Math.abs(scrollAccumulatorX.current) > threshold) {
            const direction = Math.sign(scrollAccumulatorX.current);
            const daysToMove = 1; // Slide by 1 day for smooth feeling
            
            // Debounce/limit: reset accumulator but keep a bit of momentum or strict reset
            // Strict reset allows controlled steps
            scrollAccumulatorX.current = 0;

            const d = new Date(currentDate);
            d.setDate(d.getDate() + (direction * daysToMove));
            setCurrentDate(d);
        }
    }
  };

  // --- Pointer/Drag Handlers ---

  // 1. Create New Event (Click on Grid)
  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>, day: Date) => {
    if (e.button !== 0) return; // Only left click
    
    // Check if we clicked on an event (event handling stops propagation, but just in case)
    if ((e.target as HTMLElement).closest('[data-event-id]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startTime = getSnappedDateFromY(y, day);
    
    e.currentTarget.setPointerCapture(e.pointerId);

    // Creating always counts as a "drag" operation effectively, but we don't need the threshold logic 
    // as much as moving. However, to stay consistent:
    isDraggingRef.current = false;

    setDragOp({
      type: 'create',
      start: startTime,
      end: startTime,
      day: day,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  // 2. Resize Event (Click on Edge)
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, event: CalendarEvent, edge: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;

    const container = e.currentTarget.closest('.day-column') as HTMLElement;
    if (!container) return;

    container.setPointerCapture(e.pointerId);
    isDraggingRef.current = true; // Resize is immediately considered a drag

    setDragOp({
      type: 'resize',
      event: event,
      edge: edge,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  // 3. Move Existing Event (Click on Event Body)
  const handleEventPointerDown = (e: React.PointerEvent<HTMLDivElement>, event: CalendarEvent) => {
    e.preventDefault(); // Prevent text selection
    e.stopPropagation(); // Stop grid click
    if (e.button !== 0) return;

    const container = e.currentTarget.closest('.day-column') as HTMLElement;
    if (!container) return;
    
    // Capture pointer on the container so we can drag outside the small event div easily
    container.setPointerCapture(e.pointerId);
    
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickTime = getSnappedDateFromY(y, event.start); // Using event.start day as base
    
    // Calculate offset: difference in minutes between click time and event start time
    const offsetMinutes = (clickTime.getTime() - event.start.getTime()) / 60000;

    isDraggingRef.current = false;

    setDragOp({
      type: 'move',
      event: event,
      originalStart: event.start,
      offsetMinutes: offsetMinutes,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, day: Date) => {
    if (!dragOp) return;
    
    // If not yet marked as dragging (for move op), check threshold
    if (!isDraggingRef.current && dragOp.type === 'move' && dragOp.startX !== undefined && dragOp.startY !== undefined) {
        const dx = e.clientX - dragOp.startX;
        const dy = e.clientY - dragOp.startY;
        // 5px threshold
        if (Math.hypot(dx, dy) < 5) {
            return;
        }
        isDraggingRef.current = true;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    // Time projected on the CURRENT/CAPTURED day (used for resize and create to lock column)
    const timeOnCapturedDay = getSnappedDateFromY(y, day);

    if (dragOp.type === 'create') {
        setDragOp(prev => {
            if (!prev) return null;
            return { ...prev, end: timeOnCapturedDay };
        });
    } else if (dragOp.type === 'move' && dragOp.event) {
        // Only update if we are actually dragging
        if (!isDraggingRef.current) return;

        // Determine target day based on X position to allow moving between days
        let targetDay = day;
        if (columnsContainerRef.current) {
             const containerRect = columnsContainerRef.current.getBoundingClientRect();
             // Check if within bounds
             if (e.clientX >= containerRect.left && e.clientX <= containerRect.right) {
                 const colWidth = containerRect.width / weekDays.length;
                 const colIndex = Math.floor((e.clientX - containerRect.left) / colWidth);
                 
                 if (colIndex >= 0 && colIndex < weekDays.length) {
                     targetDay = weekDays[colIndex];
                 }
             }
        }

        // Calculate time on the target day
        const timeOnTargetDay = getSnappedDateFromY(y, targetDay);

        // Calculate new start time based on target time - initial offset
        const newStart = new Date(timeOnTargetDay.getTime() - (dragOp.offsetMinutes || 0) * 60000);
        
        // Calculate duration
        const duration = dragOp.event.end.getTime() - dragOp.event.start.getTime();
        const newEnd = new Date(newStart.getTime() + duration);
        
        // Create a temporary event object with new times
        const updatedEvent = {
            ...dragOp.event,
            start: newStart,
            end: newEnd
        };

        setDragOp(prev => ({ ...prev!, event: updatedEvent }));
    } else if (dragOp.type === 'resize' && dragOp.event && dragOp.edge) {
        let newStart = new Date(dragOp.event.start);
        let newEnd = new Date(dragOp.event.end);

        if (dragOp.edge === 'start') {
            // New Start cannot be after (End - 15min)
            const maxStart = new Date(newEnd.getTime() - 15 * 60000);
            newStart = timeOnCapturedDay < maxStart ? timeOnCapturedDay : maxStart;
        } else {
            // New End cannot be before (Start + 15min)
            const minEnd = new Date(newStart.getTime() + 15 * 60000);
            newEnd = timeOnCapturedDay > minEnd ? timeOnCapturedDay : minEnd;
        }

        const updatedEvent = {
            ...dragOp.event,
            start: newStart,
            end: newEnd
        };

        setDragOp(prev => ({ ...prev!, event: updatedEvent }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOp) return;
    
    try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    } catch (err) {
        // Ignore errors if capture was already released
    }
    
    if (dragOp.type === 'create') {
        const { start, end } = dragOp;
        if (start && end) {
            // Normalize range
            const finalStart = start < end ? start : end;
            let finalEnd = start < end ? end : start;
            
            // If click (start === end), set default +1 hour
            if (finalStart.getTime() === finalEnd.getTime()) {
              finalEnd = new Date(finalStart);
              finalEnd.setHours(finalStart.getHours() + 1);
            }
            
            setSelectedDate(finalStart);
            setSelectedEndDate(finalEnd);
            setSelectedEvent(undefined);
            setIsModalOpen(true);
        }
    } else if ((dragOp.type === 'move' || dragOp.type === 'resize') && dragOp.event) {
        // If it was a resize (always valid) or a move that passed threshold
        if (dragOp.type === 'resize' || isDraggingRef.current) {
            const finalEvent = dragOp.event;
            setEvents(prev => prev.map(ev => ev.id === finalEvent.id ? finalEvent : ev));
        } else if (dragOp.type === 'move') {
            // Click event: No dragging happened, so it's a click.
            setSelectedEvent(dragOp.event);
            setSelectedDate(undefined);
            setSelectedEndDate(undefined);
            setIsModalOpen(true);
        }
    }

    setDragOp(null);
    isDraggingRef.current = false;
  };

  // Scroll to 8 AM on load
  useEffect(() => {
    const scrollContainer = document.getElementById('scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTop = 8 * 64; // 8 AM * 64px
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden relative overscroll-none">
      {/* --- Top Navigation Bar --- */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-700">
            <div className="p-2 hover:bg-gray-100 rounded-full cursor-pointer transition-colors">
                 <Menu size={24} />
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
                <CalendarIcon size={18} />
            </div>
            <span className="text-xl font-medium tracking-tight text-gray-700 hidden sm:block">Calendar</span>
          </div>
          
          <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden md:block"></div>

          <button 
            onClick={handleToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors hidden sm:block"
          >
            Today
          </button>

          <div className="flex items-center gap-1">
            <button onClick={handlePrev} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleNext} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
              <ChevronRight size={20} />
            </button>
          </div>

          <h2 className="text-lg font-medium text-gray-800 ml-2">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPlanCreatorOpen(true)}
            className="p-2 px-3 rounded-full transition-all flex items-center gap-2 bg-gradient-to-r from-purple-100 to-indigo-100 text-indigo-700 hover:shadow-md border border-indigo-200"
          >
            <Wand2 size={18} />
            <span className="text-sm font-bold hidden md:inline">Magic Plan</span>
          </button>

           <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2 rounded-full transition-all flex items-center gap-2 px-4 ${isChatOpen ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 'bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600'}`}
          >
            <Sparkles size={18} />
            <span className="text-sm font-medium hidden md:inline">Ask AI</span>
          </button>
          
          <select 
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={ViewMode.ThreeDay}>3 Days</option>
            <option value={ViewMode.Week}>Week</option>
          </select>

          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-gray-200">
             <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <Search size={20} />
             </button>
             <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <Settings size={20} />
             </button>
             <img src={MOCK_USER.avatar} alt="User" className="w-8 h-8 rounded-full border border-gray-200" />
          </div>
        </div>
      </header>

      {/* --- Main Calendar Area --- */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-16 flex-none border-r border-gray-200 bg-white hidden md:flex flex-col items-center py-4 gap-4">
             <button onClick={() => {
                 setSelectedDate(new Date());
                 setSelectedEndDate(undefined);
                 setSelectedEvent(undefined);
                 setIsModalOpen(true);
             }} className="w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center text-blue-600 hover:scale-105 transition-transform mb-4">
                 <Plus size={24} />
             </button>
             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">12</div>
             <div className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-xs text-gray-400">13</div>
             <div className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-xs text-gray-400">14</div>
        </div>

        {/* Scrollable Grid */}
        <div 
            id="scroll-container" 
            className="flex-1 overflow-y-auto overflow-x-hidden relative bg-white touch-action-none overscroll-none"
            onWheel={handleWheel}
        >
          <div className="flex flex-col min-w-[600px]">
             {/* Days Header */}
             <div className="flex sticky top-0 bg-white z-10 border-b border-gray-200 shadow-sm">
                <div className="w-16 flex-none border-r border-gray-100"></div> {/* Time Label Spacer */}
                <div className="flex flex-1">
                  {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div key={i} className={`flex-1 flex flex-col items-center justify-center py-3 border-r border-gray-100 ${isToday ? 'bg-blue-50/30' : ''}`}>
                         <span className={`text-xs font-medium uppercase mb-1 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                           {day.toLocaleDateString('en-US', { weekday: 'short' })}
                         </span>
                         <div className={`w-8 h-8 flex items-center justify-center rounded-full text-lg ${isToday ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                           {day.getDate()}
                         </div>
                      </div>
                    );
                  })}
                </div>
                <div className="w-2 flex-none"></div>
             </div>

             {/* Time Grid */}
             <div className="flex relative">
                {/* Time Labels */}
                <div className="w-16 flex-none border-r border-gray-100 bg-white z-10">
                   {HOURS.map(hour => (
                     <div key={hour} className="h-16 relative">
                        <span className="absolute -top-3 right-3 text-xs text-gray-400">
                          {hour === 0 ? '' : formatHour(new Date(0, 0, 0, hour))}
                        </span>
                     </div>
                   ))}
                </div>

                {/* Day Columns */}
                <div className="flex flex-1 relative" ref={columnsContainerRef}>
                  {/* Background Grid Lines */}
                  <div className="absolute inset-0 z-0 pointer-events-none">
                     {HOURS.map(hour => (
                       <div key={hour} className="h-16 border-b border-gray-100 w-full"></div>
                     ))}
                  </div>

                  {/* Columns */}
                  {weekDays.map((day, i) => {
                    // Filter events for this day
                    const dayEvents = events.filter(e => isSameDay(e.start, day));
                    
                    // If moving or resizing an event within this day, replace the original with the active version for layout
                    let eventsToRender = [...dayEvents];
                    
                    if ((dragOp?.type === 'move' || dragOp?.type === 'resize') && dragOp.event) {
                        // Remove the static version of the interacting event
                        eventsToRender = eventsToRender.filter(e => e.id !== dragOp.event!.id);
                        
                        // Add the dynamic version if it belongs to this day
                        if (isSameDay(dragOp.event.start, day)) {
                            eventsToRender.push(dragOp.event);
                        }
                    }

                    // Organize events for overlap layout
                    const organizedEvents = organizeEvents(eventsToRender);

                    return (
                    <div 
                        key={i} 
                        className="day-column flex-1 relative border-r border-gray-100 min-h-[1536px] group select-none"
                        onPointerDown={(e) => handleGridPointerDown(e, day)}
                        onPointerMove={(e) => handlePointerMove(e, day)}
                        onPointerUp={handlePointerUp}
                    >
                        {/* Current Time Line */}
                        {isSameDay(day, new Date()) && (
                          <div 
                             className="absolute z-20 w-full border-t-2 border-red-500 pointer-events-none flex items-center"
                             style={{ top: `${(new Date().getHours() + new Date().getMinutes() / 60) * 64}px` }}
                          >
                             <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 shadow-sm"></div>
                          </div>
                        )}

                        {/* Render Organized Events */}
                        {organizedEvents.map(event => {
                             const colorStyles = COLORS[event.color];
                             const isDragging = dragOp?.type === 'move' && dragOp.event?.id === event.id;
                             const isResizing = dragOp?.type === 'resize' && dragOp.event?.id === event.id;
                             const isInteracting = isDragging || isResizing;
                             
                             // Calculate duration to decide layout
                             const durationMins = (event.end.getTime() - event.start.getTime()) / 60000;
                             const isVeryShort = durationMins <= 20;

                             return (
                               <div
                                 key={event.id}
                                 data-event-id={event.id}
                                 onPointerDown={(e) => handleEventPointerDown(e, event)}
                                 style={{
                                    top: event.style.top,
                                    height: event.style.height,
                                    left: event.style.left,
                                    width: event.style.width,
                                    zIndex: isInteracting ? 50 : event.style.zIndex
                                 }}
                                 className={`absolute rounded-lg border-l-4 text-xs cursor-pointer shadow-sm transition-all flex flex-col overflow-hidden
                                   ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text} border-l-[4px] border-l-${colorStyles.text}
                                   ${isInteracting ? 'shadow-xl opacity-90 scale-[1.02] ring-2 ring-blue-400' : 'hover:scale-[1.01] hover:shadow-md'}
                                 `}
                               >
                                {/* Resize Handles */}
                                <div 
                                    className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-50 hover:bg-gray-400/20 active:bg-blue-400/40" 
                                    onPointerDown={(e) => handleResizePointerDown(e, event, 'start')} 
                                />
                                <div 
                                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-50 hover:bg-gray-400/20 active:bg-blue-400/40" 
                                    onPointerDown={(e) => handleResizePointerDown(e, event, 'end')} 
                                />

                                {/* Event Content */}
                                {isVeryShort ? (
                                    <div className={`px-1.5 h-full flex items-center gap-1.5 text-[11px] font-bold truncate leading-none ${colorStyles.header} w-full`}>
                                        <span className="truncate">{event.title}</span>
                                        <span className="opacity-75 text-[10px] font-normal hidden sm:inline-block whitespace-nowrap">
                                            , {formatTime(event.start)}
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`px-1.5 py-0.5 text-[11px] font-bold truncate leading-4 ${colorStyles.header} w-full`}>
                                            {event.title}
                                        </div>
                                        <div className="px-1.5 py-0.5 text-[10px] truncate opacity-90 flex-1 leading-tight">
                                            {formatTime(event.start)} - {formatTime(event.end)}
                                            {event.description && <span className="block mt-0.5 opacity-75">{event.description}</span>}
                                        </div>
                                    </>
                                )}
                               </div>
                             );
                          })}
                          
                        {/* Render "New Event" Drag Preview */}
                        {dragOp?.type === 'create' && isSameDay(dragOp.day!, day) && dragOp.start && dragOp.end && (() => {
                            const previewStart = dragOp.start < dragOp.end ? dragOp.start : dragOp.end;
                            const previewEnd = dragOp.start < dragOp.end ? dragOp.end : dragOp.start;
                            const previewDurationMins = (previewEnd.getTime() - previewStart.getTime()) / 60000;
                            const isPreviewVeryShort = previewDurationMins <= 20;

                            return (
                                <div
                                    style={getPositionStylesFromDates(previewStart, previewEnd)}
                                    className="absolute left-1 right-2 z-30 rounded-lg bg-blue-50 border-l-4 border-l-blue-700 pointer-events-none flex flex-col overflow-hidden shadow-lg opacity-80"
                                >
                                    {isPreviewVeryShort ? (
                                         <div className="px-1.5 h-full flex items-center text-[11px] font-bold truncate leading-none bg-blue-200 text-blue-700 w-full gap-2">
                                            <span className="truncate">New Event</span>
                                            <span className="opacity-75 text-[10px] font-normal whitespace-nowrap">
                                                {formatTime(previewStart)}
                                            </span>
                                         </div>
                                    ) : (
                                        <>
                                            <div className="px-1.5 py-0.5 text-[11px] font-bold truncate leading-4 bg-blue-200 text-blue-700 w-full">
                                                New Event
                                            </div>
                                            <div className="px-1.5 py-0.5 text-[10px] text-blue-700 font-medium truncate">
                                                {formatTime(previewStart)} - 
                                                {formatTime(previewEnd)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                  );
                })}
                </div>
             </div>
          </div>
        </div>

        {/* AI Chat Sidebar Overlay */}
        {isChatOpen && (
           <AIChat 
             events={events} 
             currentDate={currentDate} 
             onClose={() => setIsChatOpen(false)} 
             onAddEvents={handleAddMultipleEvents}
             onUpdateEvents={handleUpdateEventsFromAI}
             onDeleteEvents={handleDeleteEventsFromAI}
             planContext={magicPlanContext}
             sessions={chatSessions}
             activeSessionId={activeSessionId}
             onSelectSession={setActiveSessionId}
             onCreateSession={handleCreateSession}
             onUpdateSession={handleUpdateSession}
             onDeleteSession={handleDeleteSession}
           />
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-8 right-8 z-30 md:hidden flex flex-col gap-3">
         <button 
           onClick={() => setIsPlanCreatorOpen(true)}
           className="w-14 h-14 bg-indigo-600 rounded-full shadow-xl flex items-center justify-center text-white ring-1 ring-indigo-400 hover:bg-indigo-700"
        >
           <Wand2 className="w-6 h-6" />
        </button>
        <button 
           onClick={() => {
               setSelectedDate(new Date());
               setSelectedEndDate(undefined);
               setSelectedEvent(undefined);
               setIsModalOpen(true);
           }}
           className="w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center text-blue-600 ring-1 ring-blue-100"
        >
           <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialDate={selectedDate}
        initialEndDate={selectedEndDate}
        existingEvent={selectedEvent}
      />

      {/* Plan Creator Modal */}
      <PlanCreator 
        isOpen={isPlanCreatorOpen}
        onClose={() => setIsPlanCreatorOpen(false)}
        onApplyPlan={handleApplyPlan}
        currentDate={currentDate}
      />
    </div>
  );
}

export default App;