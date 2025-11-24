import { GoogleGenAI, Type, FunctionDeclaration, Content, Part, Chat } from "@google/genai";
import { AccountPlan, Persona, Message } from "../types";

/**
 * GEMINI API SERVICE
 * 
 * This service handles all interactions with Google's GenAI SDK.
 * It encapsulates tool definitions, prompt engineering, and message history mapping.
 * 
 * Technical Decision:
 * We use 'gemini-2.5-flash' because it offers the optimal balance between 
 * latency (critical for voice interactions) and reasoning capability (needed for tool calling).
 */

// --- 1. Tool Definitions ---

/**
 * Tool: updateAccountPlan
 * Allows the agent to persistently store structured findings.
 * This effectively gives the agent "Long Term Memory" within the session context.
 */
const updatePlanTool: FunctionDeclaration = {
  name: 'updateAccountPlan',
  description: 'Updates a specific section of the account plan. Call this when you have found relevant information to fill or refine a section.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sectionKey: {
        type: Type.STRING,
        enum: [
          'targetCompany',
          'executiveSummary',
          'financialHealth',
          'strategicInitiatives',
          'competitors',
          'proposedSolution'
        ],
        description: 'The key of the section to update.'
      },
      content: {
        type: Type.STRING,
        description: 'The synthesized content to write into that section. Use Markdown formatting.'
      }
    },
    required: ['sectionKey', 'content']
  }
};

/**
 * Tool: startNewResearch
 * Enables "Agentic Context Switching".
 * If the user changes the subject entirely, the agent autonomously calls this to reset state.
 */
const startNewResearchTool: FunctionDeclaration = {
  name: 'startNewResearch',
  description: 'Call this tool ONLY when the user explicitly asks to research a completely NEW and DIFFERENT company than the current one. This handles context switching.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      companyName: {
        type: Type.STRING,
        description: 'The name of the new company the user wants to research.'
      }
    },
    required: ['companyName']
  }
};

/**
 * Tool: generateChart
 * Powers the "Generative UI" capabilities.
 * Instead of describing data, the agent returns a structured JSON payload that the frontend renders as SVG.
 */
const generateChartTool: FunctionDeclaration = {
  name: 'generateChart',
  description: 'Call this tool when the user asks for data that is best presented visually (e.g. "Show me revenue growth", "Compare competitors", "Stock price trend").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The title of the chart.'
      },
      type: {
        type: Type.STRING,
        enum: ['bar', 'line'],
        description: 'The type of chart to render. Use "line" for time-series/trends, "bar" for comparisons.'
      },
      data: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            value: { type: Type.NUMBER }
          }
        },
        description: 'Array of data points with labels and values.'
      },
      color: {
        type: Type.STRING,
        description: 'Optional hex color code for the chart (e.g. #6366f1). Defaults to indigo.'
      }
    },
    required: ['title', 'type', 'data']
  }
};

// --- 2. Initialization ---

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 3. Prompt Engineering ---

/**
 * Generates the System Instruction based on the selected User Persona.
 * This demonstrates "Dynamic Prompting" - adapting the AI's behavior at runtime.
 * 
 * @param persona The user-selected persona ('analyst', 'hustler', 'casual')
 * @returns A robust system prompt string with Chain-of-Thought guidance.
 */
const getSystemInstruction = (persona: Persona): string => {
  let personaInstruction = "";
  
  switch (persona) {
    case 'hustler':
      personaInstruction = `
*** PERSONA: STARTUP HUSTLER (The "Growth Hacker") ***
You are a high-energy Silicon Valley Startup Founder/Investor.
Tone: Enthusiastic, confident, fast-paced. Use terms like "unicorn", "moat", "10x", "ROI", "flywheel", "low-hanging fruit".
Attitude: Focus entirely on growth, scale, and disruption. Call the user "Founder".
Objective: Find the "killer angle" to sell to this company.
`;
      break;
    case 'casual':
      personaInstruction = `
*** PERSONA: CASUAL FRIEND (The "EL15") ***
You are a smart but chill friend helping out.
Tone: Simple, plain English, jargon-free, emoji-friendly but professional.
Attitude: Helpful and patient. Explain complex financial things like "EBITDA" in simple terms (e.g., "profit before the extra costs").
Objective: Make the research easy to understand without a headache.
`;
      break;
    case 'analyst':
    default:
      personaInstruction = `
*** PERSONA: SENIOR INVESTMENT ANALYST (The "Skeptic") ***
You are a veteran Enterprise Account Executive and Market Analyst.
Tone: Formal, critical, skeptical, and data-driven.
Attitude: Focus on risks, market headwinds, and financial stability. Be concise and professional.
Objective: Build a rock-solid business case based on hard data.
`;
      break;
  }

  return `
${personaInstruction}

You are helping the user build a comprehensive "Account Plan" for a target company.

*** CRITICAL FIRST TURN PROTOCOL ***
If the user's input contains a company name (e.g., "Research Google", "I want to look at Nike", "Analyze Microsoft"), you MUST:
1. IMMEDIATELY call the 'updateAccountPlan' tool with sectionKey='targetCompany' and content='[Company Name]'.
2. Do NOT ask "What company would you like to research?".
3. IMMEDIATELY proceed to call 'googleSearch' to find the Executive Summary and Financial Health for that company.
4. Synthesize the findings and update the respective sections using 'updateAccountPlan'.

*** STANDARD OPERATING PROCEDURES ***
1. Use the 'googleSearch' tool to find real-time, accurate information about the company.
2. When you find information relevant to a section of the plan, use the 'updateAccountPlan' tool to save it.
3. Keep the user informed. E.g., "I've set the target company to Tesla. Now researching their recent financial reports..."
4. Be proactive. Never wait for the user to ask for the next step. If you have the company name, fill out the Executive Summary, then Financials, then Strategic Initiatives automatically.

*** DATA VISUALIZATION ***
- If you have quantitative data (e.g., revenue over years, market share percentage, stock price history), ALWAYS try to visualize it using the 'generateChart' tool in addition to summarizing it textually.
- Use 'bar' charts for comparing categories (e.g., Competitor Market Share).
- Use 'line' charts for trends over time (e.g., Revenue 2020-2024).

*** CONTEXT SWITCHING ***
- If the user asks to research a DIFFERENT company (e.g., current plan is for "Nike" and user says "What about Adidas?"), you MUST call the 'startNewResearch' tool.
- Do NOT just overwrite the current plan. Call 'startNewResearch' with the new company name.
- If the user is just refining the current company (e.g. "Find competitors"), continue using 'updateAccountPlan'.

*** SECTION GUIDELINES ***
- Executive Summary: Brief overview of the company, size, industry, headquarters.
- Financial Health: Revenue, stock performance, recent earnings calls, profitability.
- Strategic Initiatives: What is the company focusing on? (AI, Sustainability, Expansion).
- Competitors: Who are they fighting against?
- Proposed Solution: (Initially empty, ask the user what they want to sell or suggest a solution based on their strategic initiatives).
`;
};

/**
 * Maps internal application message format to the SDK's expected format.
 * Crucially, this handles Multi-Modal inputs (Images) by converting
 * Base64 attachments into the `inlineData` part expected by the Flash model.
 * 
 * @param messages The internal state message array
 * @returns An array of Content objects compatible with GoogleGenAI SDK
 */
const mapMessagesToHistory = (messages: Message[]): Content[] => {
  return messages.map(m => {
    const parts: Part[] = [{ text: m.text }];
    
    // Check if the message has an attachment
    if (m.attachment) {
        parts.push({
            inlineData: {
                data: m.attachment.base64,
                mimeType: m.attachment.mimeType
            }
        });
    }

    return {
      role: m.role,
      parts: parts
    };
  });
};

/**
 * Creates a new Chat Session with the Gemini API.
 * 
 * @param persona The selected persona for system instruction generation
 * @param previousMessages Existing message history to hydrate the chat context
 * @returns A configured Chat instance ready to send messages
 */
export const createChatSession = (persona: Persona = 'analyst', previousMessages: Message[] = []): Chat => {
  const history = mapMessagesToHistory(previousMessages);
  
  // Adjust temperature based on persona to control creativity vs determinism
  let temperature = 0.5;
  if (persona === 'hustler') temperature = 0.9; // More creative
  if (persona === 'analyst') temperature = 0.2; // More deterministic

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: getSystemInstruction(persona),
      temperature,
      tools: [
        { functionDeclarations: [updatePlanTool, startNewResearchTool, generateChartTool] },
        { googleSearch: {} }
      ]
    },
    history: history
  });
};