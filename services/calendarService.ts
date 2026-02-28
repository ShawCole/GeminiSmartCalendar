import { CalendarEvent, ViewMode } from '../types';

export const getWeekDays = (baseDate: Date, mode: ViewMode): Date[] => {
  const days: Date[] = [];
  const start = new Date(baseDate);
  
  // We remove the week-snapping logic to allow for a sliding window "sideways scrolling" effect
  // This effectively treats "Week" view as "7 Days" view starting from currentDate
  
  start.setHours(0, 0, 0, 0);
  
  const count = mode === ViewMode.Week ? 7 : 3;

  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const formatHour = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
  }).format(date);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
  }).format(date);
};

export const getEventsForDay = (events: CalendarEvent[], day: Date): CalendarEvent[] => {
  return events.filter(e => isSameDay(e.start, day));
};

export const getPositionStyles = (event: CalendarEvent) => {
  return getPositionStylesFromDates(event.start, event.end);
};

export const getPositionStylesFromDates = (start: Date, end: Date) => {
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const duration = Math.max(endHour - startHour, 0.25); // Minimum 15 min visual

  const top = startHour * 64; // 64px per hour (h-16)
  const height = duration * 64;

  return { top: `${top}px`, height: `${height}px` };
};

export const getSnappedDateFromY = (y: number, baseDate: Date): Date => {
  const pixelsPerHour = 64;
  const minutesPerPixel = 60 / pixelsPerHour;
  const totalMinutes = y * minutesPerPixel;
  
  // Snap to 15 minutes
  const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
  
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(snappedMinutes);
  return d;
};

export interface FormattedEvent extends CalendarEvent {
  style: {
    top: string;
    height: string;
    left: string;
    width: string;
    zIndex: number;
  };
}

/**
 * Organizes events into overlapping groups and assigns columns.
 */
export const organizeEvents = (events: CalendarEvent[]): FormattedEvent[] => {
  if (events.length === 0) return [];

  // Sort by start time, then duration
  const sorted = [...events].sort((a, b) => {
    if (a.start.getTime() === b.start.getTime()) {
      return b.end.getTime() - a.end.getTime();
    }
    return a.start.getTime() - b.start.getTime();
  });

  // 1. Group overlapping events
  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [];
  let groupEnd = -1;

  for (const event of sorted) {
    const start = event.start.getTime();
    const end = event.end.getTime();

    if (currentGroup.length === 0) {
      currentGroup.push(event);
      groupEnd = end;
    } else {
      // If this event starts before the current group ends, it overlaps with the group
      if (start < groupEnd) {
        currentGroup.push(event);
        groupEnd = Math.max(groupEnd, end);
      } else {
        // No overlap, seal this group and start a new one
        groups.push(currentGroup);
        currentGroup = [event];
        groupEnd = end;
      }
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // 2. Assign columns within groups
  const result: FormattedEvent[] = [];

  for (const group of groups) {
    // Columns is an array of arrays. Each inner array is a "column".
    const columns: CalendarEvent[][] = [];

    for (const event of group) {
      let placed = false;
      // Try to place event in an existing column
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const lastInCol = col[col.length - 1];
        // If event starts after the last one in this column ends, it fits
        if (event.start.getTime() >= lastInCol.end.getTime()) {
          col.push(event);
          placed = true;
          break;
        }
      }
      
      // If it didn't fit in any existing column, make a new one
      if (!placed) {
        columns.push([event]);
      }
    }

    // 3. Calculate styles
    const numColumns = columns.length;
    const colWidth = 100 / numColumns;

    columns.forEach((col, colIndex) => {
      col.forEach((event) => {
        const pos = getPositionStyles(event);
        result.push({
          ...event,
          style: {
            top: pos.top,
            height: pos.height,
            left: `${colIndex * colWidth}%`,
            width: `${colWidth}%`,
            zIndex: 10 + colIndex,
          },
        });
      });
    });
  }

  return result;
};