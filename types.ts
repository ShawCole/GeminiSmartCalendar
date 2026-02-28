

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  color: 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'indigo';
}

export enum ViewMode {
  ThreeDay = '3-day',
  Week = 'week',
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

export interface AIPlanEvent {
  title: string;
  description: string;
  start: string; // ISO String from JSON
  end: string;   // ISO String from JSON
  color: string;
}

export interface AIUpdateEvent extends AIPlanEvent {
  id: string; // ID is required for updating
}

export interface AIChatResponse {
  text: string;
  eventsToAdd: AIPlanEvent[];
  eventsToUpdate: AIUpdateEvent[];
  eventIdsToDelete: string[];
}

// Add AIPlanResponse interface
export interface AIPlanResponse {
  explanation: string;
  events: AIPlanEvent[];
}