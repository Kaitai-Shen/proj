import { useState } from "react";
import { testConnection, type TestConnectionResult } from "./client";
import { PROVIDER_PRESETS, getPreset } from "./presets";
import { useLLMSettings } from "./settings";
import { BookOpen, CheckCircle, XCircle } from "../components/ui/Icons";

const labelClass = "block space-y-1.5";
const labelTextStyle = "field-label";

export default function SettingsPanel({
  onShowTutorial,
}: {
  onShowTutorial?: () => void;
}) {
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
    <div className="card-surface space-y-4 p-5 text-ink">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">
          模型接入设置
        </h2>
        <button
          type="button"
          onClick={() => {
            clear();
            setResult(null);
          }}
          className="text-xs text-ink-muted transition hover:text-ink"
        >
          清空配置
        </button>
      </div>

      <label className={labelClass}>
        <span className={labelTextStyle}>供应商预设</span>
        <select
          className="field-input"
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
      {preset?.note && (
        <p className="-mt-2 text-xs text-ink-muted">{preset.note}</p>
      )}

      <label className={labelClass}>
        <span className={labelTextStyle}>Base URL</span>
        <input
          className="field-input"
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
            className="text-xs text-clay-deep transition hover:text-clay"
          >
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
        <input
          className="field-input"
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-ink-muted">
          API Key 仅保存在你的浏览器本地，不会上传到任何服务器
        </p>
      </div>

      <label className={labelClass}>
        <span className={labelTextStyle}>模型</span>
        <input
          className="field-input"
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

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="btn-primary px-4 py-2 text-sm"
        >
          {testing ? "测试中…" : "测试连接"}
        </button>
        {result &&
          (result.ok ? (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle size={14} /> 连接成功，延迟 {result.latencyMs} ms（
              {result.model}）
            </p>
          ) : (
            <p className="flex items-center gap-1.5 break-all text-xs text-danger">
              <XCircle size={14} /> {result.error}
            </p>
          ))}
      </div>

      {onShowTutorial ? (
        <button
          type="button"
          onClick={onShowTutorial}
          className="flex items-center gap-1.5 text-left text-xs text-clay-deep transition hover:text-clay"
        >
          <BookOpen size={13} />
          第一次配置？查看图文新手教程
        </button>
      ) : null}
    </div>
  );
}
