export type ProviderPreset = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  note?: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    note: "在 DeepSeek 开放平台创建 API Key",
  },
  {
    id: "dashscope",
    name: "阿里云百炼 DashScope（兼容模式）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max"],
    note: "需在百炼控制台开通并创建 API Key",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini"],
    note: "浏览器直连被拦截时会自动尝试经转发服务请求",
  },
  {
    id: "moonshot",
    name: "Moonshot（Kimi）",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k"],
    note: "在 Moonshot 开放平台创建 API Key",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow 硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
    note: "聚合多家开源模型，国内可直连",
  },
  {
    id: "gemini",
    name: "Gemini（OpenAI 兼容）",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.0-flash"],
    note: "在 Google AI Studio 获取 API Key",
  },
  {
    id: "ollama",
    name: "Ollama 本地",
    baseUrl: "http://localhost:11434/v1",
    models: ["llama3.1"],
    note: "本地服务无需 API Key，需以 OLLAMA_ORIGINS 允许浏览器跨域",
  },
  {
    id: "custom",
    name: "自定义",
    baseUrl: "",
    models: [],
    note: "填写任意 OpenAI 兼容的 chat/completions 端点",
  },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
