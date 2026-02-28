import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { COLORS } from '../constants';
import { generateEventDescription } from '../services/geminiService';
import { X, Wand2, Loader2, Trash2 } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  initialDate?: Date;
  initialEndDate?: Date;
  existingEvent?: CalendarEvent;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialEndDate,
  existingEvent,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState<CalendarEvent['color']>('blue');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingEvent) {
        setTitle(existingEvent.title);
        setDescription(existingEvent.description || '');
        setStartDate(existingEvent.start.toISOString().split('T')[0]);
        setStartTime(existingEvent.start.toTimeString().slice(0, 5));
        setEndTime(existingEvent.end.toTimeString().slice(0, 5));
        setColor(existingEvent.color);
      } else if (initialDate) {
        setTitle('');
        setDescription('');
        setStartDate(initialDate.toISOString().split('T')[0]);
        const startH = initialDate.getHours().toString().padStart(2, '0');
        const startM = initialDate.getMinutes().toString().padStart(2, '0');
        setStartTime(`${startH}:${startM}`);
        
        // Use initialEndDate if provided, otherwise default to +1 hour
        let endD = initialEndDate ? new Date(initialEndDate) : new Date(initialDate);
        if (!initialEndDate) {
           endD.setHours(endD.getHours() + 1);
        }
        
        const endH = endD.getHours().toString().padStart(2, '0');
        const endM = endD.getMinutes().toString().padStart(2, '0');
        setEndTime(`${endH}:${endM}`);
        
        setColor('blue');
      }
    }
  }, [isOpen, existingEvent, initialDate, initialEndDate]);

  const handleGenerateDescription = async () => {
    if (!title) return;
    setIsGenerating(true);
    const desc = await generateEventDescription(title);
    if (desc) setDescription(desc.trim());
    setIsGenerating(false);
  };

  const handleSave = () => {
    if (!title || !startDate || !startTime || !endTime) return;

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);
    
    // Basic validation
    if (end <= start) {
        alert("End time must be after start time");
        return;
    }

    onSave({
      id: existingEvent?.id || Math.random().toString(36).substr(2, 9),
      title,
      description,
      start,
      end,
      color,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {existingEvent ? 'Edit Event' : 'Create Event'}
          </h2>
          <div className="flex gap-2">
            {existingEvent && (
              <button 
                onClick={() => { onDelete(existingEvent.id); onClose(); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Delete event"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Add title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-2xl font-medium border-b-2 border-gray-200 focus:border-blue-500 outline-none pb-2 transition-colors placeholder:text-gray-300"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <button
                onClick={handleGenerateDescription}
                disabled={!title || isGenerating}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                AI Enhance
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Add description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-3">
              {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full ${COLORS[c].bg} border-2 ${
                    color === c ? 'border-gray-600 scale-110' : 'border-transparent'
                  } transition-all`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
