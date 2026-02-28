import { GoogleGenAI, Type } from '@google/genai';
import { CalendarEvent, AIPlanResponse, AIChatResponse } from '../types';

// Initialize Gemini Client
const apiKey = process.env.API_KEY || ''; 
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const processChatRequest = async (
  query: string,
  events: CalendarEvent[],
  currentDate: Date,
  planContext?: string
): Promise<AIChatResponse> => {
  if (!ai) {
    return { text: "API Key is missing. Please configure process.env.API_KEY.", eventsToAdd: [], eventsToUpdate: [], eventIdsToDelete: [] };
  }

  // Serialize events for context, including the ID
  const eventContext = events.map(e => ({
    id: e.id, // Include event ID for AI to reference
    title: e.title,
    start: e.start.toLocaleString(),
    end: e.end.toLocaleString(),
    description: e.description || 'No description',
  }));

  const systemPrompt = `
    You are a smart calendar assistant capable of managing schedules.
    Current Date: ${currentDate.toLocaleString()} (${currentDate.toLocaleDateString('en-US', { weekday: 'long' })})
    
    ${planContext ? `
    IMPORTANT CONTEXT - RECENTLY CREATED PLAN:
    The user recently used the "Magic Plan" feature to generate a schedule. 
    The goal/explanation for this plan was:
    "${planContext}"
    
    If the user asks about "the plan", "what I just added", or "magic plan", refer to the text above to explain the strategy or logic behind the events.
    ` : ''}

    User's Current Schedule (including IDs for modification):
    ${JSON.stringify(eventContext, null, 2)}
    
    Instructions:
    1. If the user asks a question about the schedule, answer it in the 'text' field and leave 'eventsToAdd', 'eventsToUpdate', 'eventIdsToDelete' empty.
    2. If the user asks to create, schedule, or add events, provide a polite confirmation in 'text' and include new event details in the 'eventsToAdd' array.
    3. If the user asks to edit or modify an existing event (e.g., "change the start time for X event"), provide a polite confirmation in 'text' and include the FULL updated event object (including its 'id') in the 'eventsToUpdate' array. All fields for the updated event should be present, even if unchanged.
    4. If the user asks to delete an existing event (e.g., "delete the Y event"), provide a polite confirmation in 'text' and include the 'id' of the event to be deleted in the 'eventIdsToDelete' array.
    5. Infer missing details (e.g., if duration isn't specified, assume 1 hour).
    6. For 'color', choose a relevant color (blue, red, green, yellow, purple, indigo) based on the context (e.g., red for urgent, green for personal).
    7. Always use ISO 8601 format for start and end times for all event objects.
    8. Prioritize using existing event IDs from "User's Current Schedule" when making updates or deletions.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "The conversational response to the user."
            },
            eventsToAdd: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  start: { type: Type.STRING, description: "ISO 8601 Start Time" },
                  end: { type: Type.STRING, description: "ISO 8601 End Time" },
                  color: { type: Type.STRING, enum: ['blue', 'red', 'green', 'yellow', 'purple', 'indigo'] }
                },
                required: ['title', 'start', 'end', 'color']
              },
              description: "A list of events to be created. Empty if no creation requested."
            },
            eventsToUpdate: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID of the event to update, must exist in current schedule." },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  start: { type: Type.STRING, description: "ISO 8601 Start Time" },
                  end: { type: Type.STRING, description: "ISO 8601 End Time" },
                  color: { type: Type.STRING, enum: ['blue', 'red', 'green', 'yellow', 'purple', 'indigo'] }
                },
                required: ['id', 'title', 'start', 'end', 'color']
              },
              description: "A list of existing events to be updated. Each event must include its ID."
            },
            eventIdsToDelete: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of event IDs to be deleted."
            }
          },
          required: ['text', 'eventsToAdd', 'eventsToUpdate', 'eventIdsToDelete']
        }
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as AIChatResponse;
    }
    return { text: "I couldn't process that request.", eventsToAdd: [], eventsToUpdate: [], eventIdsToDelete: [] };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "Sorry, I encountered an error communicating with the AI service.", eventsToAdd: [], eventsToUpdate: [], eventIdsToDelete: [] };
  }
};

export const generateEventDescription = async (title: string): Promise<string> => {
  if (!ai) return "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a professional, short description (1-2 sentences) for a calendar event titled: "${title}".`,
    });
    return response.text || "";
  } catch (e) {
    console.error(e);
    return "";
  }
};

export const generateSchedulePlan = async (
  prompt: string, 
  currentDate: Date,
  previousPlan?: AIPlanResponse
): Promise<AIPlanResponse | null> => {
  if (!ai) return null;

  const systemPrompt = `
    You are an expert scheduler. You will receive a request to plan a schedule.
    Current Date and Time: ${currentDate.toISOString()} (${currentDate.toLocaleDateString('en-US', { weekday: 'long' })})
    
    ${previousPlan ? `
    CONTEXT - PREVIOUS PLAN:
    The user wants to modify or refine this existing plan:
    Explanation: ${previousPlan.explanation}
    Events: ${JSON.stringify(previousPlan.events)}
    
    CRITICAL: You are refining the existing events. Return the FULL set of events for the schedule, not just the changes. 
    If breaking down events, ensure the total time remains similar but split into specific tasks.
    If the user asks to "get more granular", break large blocks into specific actionable items.
    ` : ''}

    Create a logical plan and corresponding calendar events.
    For the events:
    1. Ensure timestamps are valid ISO 8601 strings (YYYY-MM-DDTHH:mm:ss).
    2. 'color' must be one of: 'blue', 'red', 'green', 'yellow', 'purple', 'indigo'.
    3. Infer durations based on the activity (e.g., workouts 1h, meetings 30m-1h).
    4. If the user says "tomorrow", calculate the date based on the Current Date provided above.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: "A friendly, text-based summary of the plan you created, explaining your logic."
            },
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  start: { type: Type.STRING, description: "ISO 8601 Start Time" },
                  end: { type: Type.STRING, description: "ISO 8601 End Time" },
                  color: { type: Type.STRING, enum: ['blue', 'red', 'green', 'yellow', 'purple', 'indigo'] }
                },
                required: ['title', 'start', 'end', 'color']
              }
            }
          },
          required: ['explanation', 'events']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIPlanResponse;
    }
    return null;
  } catch (e) {
    console.error("Plan Generation Error", e);
    return null;
  }
};