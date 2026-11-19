import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderPreset } from "./presets";
import { getPreset } from "./presets";

type LLMSettingsState = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  setProvider: (preset: ProviderPreset) => void;
  setBaseUrl: (baseUrl: string) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  clear: () => void;
};

const DEFAULT_PROVIDER_ID = "deepseek";

function initialFor(id: string): Pick<LLMSettingsState, "providerId" | "baseUrl" | "model"> {
  const preset = getPreset(id);
  return {
    providerId: preset ? preset.id : DEFAULT_PROVIDER_ID,
    baseUrl: preset ? preset.baseUrl : "",
    model: preset?.models[0] ?? "",
  };
}

// API Key 仅保存在浏览器 localStorage，无任何上传逻辑
export const useLLMSettings = create<LLMSettingsState>()(
  persist(
    (set) => ({
      ...initialFor(DEFAULT_PROVIDER_ID),
      apiKey: "",
      setProvider: (preset) =>
        set({
          providerId: preset.id,
          baseUrl: preset.baseUrl,
          model: preset.models[0] ?? "",
        }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      clear: () => set({ ...initialFor(DEFAULT_PROVIDER_ID), apiKey: "" }),
    }),
    { name: "lecturecast.llm.v1" },
  ),
);
