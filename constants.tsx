import React from 'react';
import { CalendarEvent } from './types';

export const COLORS = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', header: 'bg-blue-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', header: 'bg-red-200' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500', header: 'bg-green-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500', header: 'bg-yellow-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', header: 'bg-purple-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', header: 'bg-indigo-200' },
};

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

const today = new Date();
today.setHours(0, 0, 0, 0);

const createDate = (daysAdd: number, hours: number, minutes: number = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysAdd);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

// Start with a blank calendar as requested
export const INITIAL_EVENTS: CalendarEvent[] = [];

export const MOCK_USER = {
  id: 'u1',
  name: 'Alex Developer',
  avatar: 'https://picsum.photos/100/100',
};