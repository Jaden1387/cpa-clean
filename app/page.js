"use client";

import { useEffect, useState } from "react";

const initialMetrics = {
  scanned_total: "-",
  matched_total: "-",
  deleted_main: "-",
  deleted_401: "-",
  deleted_total: "-",
  failed_total: "-",
};

function toNum(value) {
  return Number.isFinite(value) ? String(value) : "-";
}

function parseNum(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function HomePage() {
  const [form, setForm] = useState({
    management_url: "",
    management_token: "",
    management_timeout: "15",
    probe_timeout: "8",
    probe_workers: "12",
    delete_workers: "8",
    max_active_probes: "120",
    active_probe: true,
  });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState({ text: "等待执行", kind: "" });
  const [logs, setLogs] = useState("(暂无日志)");
  const [metrics, setMetrics] = useState(initialMetrics);

  const apiUrl = (path) => path;

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadDefaults = async () => {
    try {
      const resp = await fetch(apiUrl("/api/defaults"));
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      const d = data.defaults || {};
      setForm((prev) => ({
        ...prev,
        management_url: d.management_url || "",
        management_token: d.management_token || "",
        management_timeout: String(d.management_timeout ?? 15),
        probe_timeout: String(d.probe_timeout ?? 8),
        probe_workers: String(d.probe_workers ?? 12),
        delete_workers: String(d.delete_workers ?? 8),
        max_active_probes: String(d.max_active_probes ?? 120),
        active_probe: !!d.active_probe,
      }));
    } catch (err) {
      setStatus({ text: `加载默认配置失败: ${err.message}`, kind: "err" });
    }
  };

  const runCleanup = async () => {
    if (running) return;
    setRunning(true);
    setMetrics(initialMetrics);
    setLogs("(服务端执行中，请稍候...)");
    setStatus({ text: "执行中...", kind: "" });

    try {
      const payload = {
        management_url: form.management_url.trim(),
        management_token: form.management_token.trim(),
        management_timeout: parseNum(form.management_timeout, 15),
        probe_timeout: parseNum(form.probe_timeout, 8),
        probe_workers: parseNum(form.probe_workers, 12),
        delete_workers: parseNum(form.delete_workers, 8),
        max_active_probes: parseNum(form.max_active_probes, 120),
        active_probe: !!form.active_probe,
      };

      const resp = await fetch(apiUrl("/api/cleanup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      setLogs(typeof data.logs === "string" ? data.logs || "(无日志)" : "(无日志)");

      const summary = data.summary || {};
      const failCount = Array.isArray(summary.failures) ? summary.failures.length : NaN;
      setMetrics({
        scanned_total: toNum(summary.scanned_total),
        matched_total: toNum(summary.matched_total),
        deleted_main: toNum(summary.deleted_main),
        deleted_401: toNum(summary.deleted_401),
        deleted_total: toNum(summary.deleted_total),
        failed_total: toNum(failCount),
      });

      setStatus({ text: "清理完成", kind: "ok" });
    } catch (err) {
      setStatus({ text: `执行失败: ${err.message}`, kind: "err" });
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    loadDefaults();
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <h1>CPA Cleanup Console</h1>
        <p>Next.js 美化版控制台，保留原有清理能力，优化视觉与交互。</p>
      </section>

      <section className="grid">
        <section className="panel">
          <h2>执行配置</h2>

          <div className="field">
            <label htmlFor="management_url">Management URL</label>
            <input
              id="management_url"
              type="text"
              value={form.management_url}
              onChange={(e) => onChange("management_url", e.target.value)}
              placeholder="http://127.0.0.1:8317/management.html"
            />
          </div>

          <div className="field">
            <label htmlFor="management_token">Management Token</label>
            <input
              id="management_token"
              type="password"
              value={form.management_token}
              onChange={(e) => onChange("management_token", e.target.value)}
              placeholder="不带 Bearer"
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="management_timeout">管理接口超时（秒）</label>
              <input
                id="management_timeout"
                type="number"
                min="1"
                value={form.management_timeout}
                onChange={(e) => onChange("management_timeout", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="probe_timeout">探测超时（秒）</label>
              <input
                id="probe_timeout"
                type="number"
                min="1"
                value={form.probe_timeout}
                onChange={(e) => onChange("probe_timeout", e.target.value)}
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="probe_workers">探测并发</label>
              <input
                id="probe_workers"
                type="number"
                min="1"
                value={form.probe_workers}
                onChange={(e) => onChange("probe_workers", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="delete_workers">删除并发</label>
              <input
                id="delete_workers"
                type="number"
                min="1"
                value={form.delete_workers}
                onChange={(e) => onChange("delete_workers", e.target.value)}
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="max_active_probes">最大探测数量（0=不探测）</label>
              <input
                id="max_active_probes"
                type="number"
                min="0"
                value={form.max_active_probes}
                onChange={(e) => onChange("max_active_probes", e.target.value)}
              />
            </div>
            <div className="field inline">
              <input
                id="active_probe"
                type="checkbox"
                checked={form.active_probe}
                onChange={(e) => onChange("active_probe", e.target.checked)}
              />
              <label htmlFor="active_probe">开启主动探测</label>
            </div>
          </div>

          <div className="actions">
            <button type="button" disabled={running} onClick={runCleanup}>
              {running ? "执行中..." : "执行清理"}
            </button>
            <button type="button" disabled={running} onClick={loadDefaults}>
              载入默认值
            </button>
            <span className={`status ${status.kind}`}>{status.text}</span>
          </div>

          <div className="summary">
            <div className="metric"><div className="k">扫描总数</div><div className="v">{metrics.scanned_total}</div></div>
            <div className="metric"><div className="k">命中数量</div><div className="v">{metrics.matched_total}</div></div>
            <div className="metric"><div className="k">主流程删除</div><div className="v">{metrics.deleted_main}</div></div>
            <div className="metric"><div className="k">401 补删</div><div className="v">{metrics.deleted_401}</div></div>
            <div className="metric"><div className="k">总删除</div><div className="v">{metrics.deleted_total}</div></div>
            <div className="metric"><div className="k">失败数</div><div className="v">{metrics.failed_total}</div></div>
          </div>

          <div className="hint">当前为 Next 全栈模式，前后端同域部署。</div>
        </section>

        <section className="panel">
          <h2>执行日志</h2>
          <pre>{logs}</pre>
        </section>
      </section>
    </main>
  );
}
