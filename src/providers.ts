// Shared provider definitions for the multi-provider AI system
// Voice (InterviewRoom) = Google Gemini Live only
// Text generation (question sets) = any configured provider

export interface ProviderModel {
  id: string;
  name: string;
  desc: string;
  badge: string;
}

export interface ProviderDef {
  id: string;
  name: string;
  description: string;
  color: string;
  capabilities: readonly ('text' | 'voice')[];
  placeholder: string;
  helpUrl: string;
  models: ProviderModel[];
}

export const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    description: '支持题单生成 + 实时语音面试（Live API）',
    color: 'blue',
    capabilities: ['text', 'voice'] as const,
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '最强综合性能，推理更深', badge: '2.5' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: '轻量版本，配额更宽裕', badge: 'Lite' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: '最强推理，速度较慢', badge: 'Pro' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: '支持题单生成',
    color: 'green',
    capabilities: ['text'] as const,
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', desc: '最新旗舰模型', badge: '4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '轻量高效', badge: 'Mini' },
      { id: 'o3-mini', name: 'o3-mini', desc: '推理优化模型', badge: 'o3' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '支持题单生成，性价比极高',
    color: 'purple',
    capabilities: ['text'] as const,
    placeholder: 'sk-...',
    helpUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', desc: '通用对话模型', badge: 'V3' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', desc: '深度推理模型', badge: 'R1' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: '支持题单生成',
    color: 'amber',
    capabilities: ['text'] as const,
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: '最强综合能力', badge: 'S4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: '快速高效', badge: 'H' },
    ],
  },
];

// Map from provider.id -> provider
export const PROVIDER_MAP = Object.fromEntries(PROVIDER_DEFS.map(p => [p.id, p]));

// Find which provider a model belongs to
export function findProviderForModel(modelId: string): ProviderDef | undefined {
  return PROVIDER_DEFS.find(p => p.models.some(m => m.id === modelId));
}

// Get color classes for a provider
export function getProviderColorClasses(color: string) {
  const map: Record<string, { badge: string; border: string; bg: string; text: string }> = {
    blue:   { badge: 'bg-blue-100 text-blue-600',     border: 'border-blue-500', bg: 'bg-blue-50',   text: 'text-blue-600' },
    green:  { badge: 'bg-green-100 text-green-600',    border: 'border-green-500', bg: 'bg-green-50',  text: 'text-green-600' },
    purple: { badge: 'bg-purple-100 text-purple-600',  border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-600' },
    amber:  { badge: 'bg-amber-100 text-amber-600',    border: 'border-amber-500', bg: 'bg-amber-50',  text: 'text-amber-600' },
    orange: { badge: 'bg-orange-100 text-orange-600',   border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-600' },
  };
  return map[color] || map.blue;
}
