import { useState } from "react";
import { testConnection, type TestConnectionResult } from "./client";
import { PROVIDER_PRESETS, getPreset } from "./presets";
import { useLLMSettings } from "./settings";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-accent/70 focus:ring-1 focus:ring-accent/40";

const labelClass = "block space-y-1.5";
const labelTextStyle = "text-xs font-medium text-slate-400";

export default function SettingsPanel() {
  const { providerId, baseUrl, apiKey, model, setProvider, setBaseUrl, setApiKey, setModel, clear } =
    useLLMSettings();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectionResult | null>(null);

  const preset = getPreset(providerId);

  async function handleTest(): Promise<void> {
    if (!baseUrl.trim() || !model.trim()) {
      setResult({ ok: false, error: "请先填写 Base URL 和模型名称" });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const r = await testConnection({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      });
      setResult(r);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-ink-800 p-5 text-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">模型接入设置</h2>
        <button
          type="button"
          onClick={() => {
            clear();
            setResult(null);
          }}
          className="text-xs text-slate-500 transition hover:text-slate-300"
        >
          清空配置
        </button>
      </div>

      <label className={labelClass}>
        <span className={labelTextStyle}>供应商预设</span>
        <select
          className={inputClass}
          value={providerId}
          onChange={(e) => {
            const p = PROVIDER_PRESETS.find((x) => x.id === e.target.value);
            if (p) {
              setProvider(p);
              setResult(null);
            }
          }}
        >
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {preset?.note && <p className="-mt-2 text-xs text-slate-500">{preset.note}</p>}

      <label className={labelClass}>
        <span className={labelTextStyle}>Base URL</span>
        <input
          className={inputClass}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          spellCheck={false}
        />
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={labelTextStyle}>API Key</span>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-xs text-accent-soft transition hover:text-accent"
          >
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
        <input
          className={inputClass}
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-slate-500">
          API Key 仅保存在你的浏览器本地，不会上传到任何服务器
        </p>
      </div>

      <label className={labelClass}>
        <span className={labelTextStyle}>模型</span>
        <input
          className={inputClass}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          list="llm-model-suggestions"
          placeholder="model-name"
          spellCheck={false}
        />
        <datalist id="llm-model-suggestions">
          {(preset?.models ?? []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? "测试中…" : "测试连接"}
        </button>
        {result &&
          (result.ok ? (
            <p className="text-xs text-emerald-400">
              ✓ 连接成功，延迟 {result.latencyMs} ms（{result.model}）
            </p>
          ) : (
            <p className="break-all text-xs text-red-400">✗ {result.error}</p>
          ))}
      </div>
    </div>
  );
}
