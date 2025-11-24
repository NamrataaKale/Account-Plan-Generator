export interface AccountPlan {
  targetCompany: string;
  executiveSummary: string;
  financialHealth: string;
  strategicInitiatives: string;
  competitors: string;
  proposedSolution: string;
}

export type AccountPlanKey = keyof AccountPlan;

export type Persona = 'analyst' | 'hustler' | 'casual';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartProps {
  title: string;
  type: 'bar' | 'line';
  data: ChartDataPoint[];
  color?: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  base64: string; // Raw base64 string without data:image/... prefix
  url: string; // For display purposes (data:image/...)
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
  sources?: { title: string; uri: string }[];
  attachment?: Attachment;
  chartData?: ChartProps;
}

export interface ToolCallResponse {
  functionCalls: {
    name: string;
    args: Record<string, any>;
  }[];
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  accountPlan: AccountPlan;
  createdAt: number;
  lastActiveAt: number;
}