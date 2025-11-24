import { 
  GoogleGenerativeAI, 
  SchemaType, 
  FunctionDeclaration, 
  Part, 
  ChatSession 
} from "@google/generative-ai";
import { AccountPlan, Persona, Message } from "../types";

// Initialize with the stable SDK
// Ensure API key is present. In Vite, usually import.meta.env.VITE_API_KEY, 
// but we stick to process.env.API_KEY as per instructions if configured, 
// or fallback to a placeholder to prevent immediate crash if env is missing.
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

// --- Tool Definitions (SchemaType format) ---

const updatePlanTool: FunctionDeclaration = {
  name: 'updateAccountPlan',
  description: 'Updates a specific section of the account plan. Call this when you have found relevant information.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      sectionKey: {
        type: SchemaType.STRING,
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
        type: SchemaType.STRING,
        description: 'The synthesized content to write into that section. Use Markdown.'
      }
    },
    required: ['sectionKey', 'content']
  }
};

const startNewResearchTool: FunctionDeclaration = {
  name: 'startNewResearch',
  description: 'Call this ONLY when the user asks to research a completely NEW and DIFFERENT company.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      companyName: {
        type: SchemaType.STRING,
        description: 'The name of the new company.'
      }
    },
    required: ['companyName']
  }
};

const generateChartTool: FunctionDeclaration = {
  name: 'generateChart',
  description: 'Call this to generate a visual chart for quantitative data.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      type: { 
        type: SchemaType.STRING, 
        enum: ['bar', 'line'] 
      },
      data: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            label: { type: SchemaType.STRING },
            value: { type: SchemaType.NUMBER }
          },
          required: ['label', 'value']
        }
      },
      color: { type: SchemaType.STRING }
    },
    required: ['title', 'type', 'data']
  }
};

// --- System Instruction ---

const getSystemInstruction = (persona: Persona): string => {
  let personaInstruction = "";
  
  switch (persona) {
    case 'hustler':
      personaInstruction = `You are a high-energy Silicon Valley Startup Founder. Tone: Enthusiastic, confident. Use terms like "moat", "10x", "ROI". Focus on growth.`;
      break;
    case 'casual':
      personaInstruction = `You are a helpful friend. Tone: Simple, plain English, jargon-free. Explain things simply.`;
      break;
    case 'analyst':
    default:
      personaInstruction = `You are a Senior Investment Analyst. Tone: Formal, critical, data-driven. Focus on risks and numbers.`;
      break;
  }

  return `
${personaInstruction}

You are helping the user build a comprehensive "Account Plan".

PROTOCOL:
1. If the user mentions a company, call 'updateAccountPlan' with sectionKey='targetCompany'.
2. Use 'updateAccountPlan' to save findings.
3. Use 'generateChart' for data visualization.
4. If the user switches topics to a new company, call 'startNewResearch'.

Sections: Executive Summary, Financial Health, Strategic Initiatives, Competitors, Proposed Solution.
`;
};

// --- Helpers ---

const mapMessagesToHistory = (messages: Message[]): { role: string, parts: Part[] }[] => {
  return messages.map(m => {
    const parts: Part[] = [{ text: m.text }];
    
    if (m.attachment) {
      parts.push({
        inlineData: {
          data: m.attachment.base64,
          mimeType: m.attachment.mimeType
        }
      });
    }

    return {
      role: m.role === 'model' ? 'model' : 'user',
      parts: parts
    };
  });
};

// --- Main Factory ---

export const createChatSession = (persona: Persona = 'analyst', previousMessages: Message[] = []): ChatSession => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Stable model to avoid 429
    systemInstruction: getSystemInstruction(persona),
    tools: [
      { functionDeclarations: [updatePlanTool, startNewResearchTool, generateChartTool] },
      // Note: googleSearch is omitted to ensure stability with standard SDK types, 
      // as it requires specific grounding config usually not present in basic types.
    ]
  });

  return model.startChat({
    history: mapMessagesToHistory(previousMessages),
    generationConfig: {
      temperature: persona === 'hustler' ? 0.9 : 0.4,
      maxOutputTokens: 2000,
    }
  });
};
