"use client";

import { useEffect, useState } from "react";

const FIXED_CONFIG = {
  management_timeout: 15,
  probe_timeout: 8,
  probe_workers: 12,
  delete_workers: 8,
  max_active_probes: 120,
  active_probe: true,
};

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

export default function HomePage() {
  const [form, setForm] = useState({
    management_url: "",
    management_token: "",
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
        management_url: "",
        management_token: d.management_token || "",
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
        management_timeout: FIXED_CONFIG.management_timeout,
        probe_timeout: FIXED_CONFIG.probe_timeout,
        probe_workers: FIXED_CONFIG.probe_workers,
        delete_workers: FIXED_CONFIG.delete_workers,
        max_active_probes: FIXED_CONFIG.max_active_probes,
        active_probe: FIXED_CONFIG.active_probe,
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
        <h1>小呆- CPA -账户清理工具</h1>
      </section>

      <section className="grid">
        <section className="panel">
          <h2>执行配置</h2>

          <div className="field">
            <label htmlFor="management_url">cpa 入口（例如 http://127.0.0.1:8317/management.html）</label>
            <input
              id="management_url"
              type="text"
              value={form.management_url}
              onChange={(e) => onChange("management_url", e.target.value)}
              placeholder="必填"
            />
          </div>

          <div className="field">
            <label htmlFor="management_token">cpa登录密码</label>
            <input
              id="management_token"
              type="text"
              value={form.management_token}
              onChange={(e) => onChange("management_token", e.target.value)}
              placeholder="不带 Bearer"
            />
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
          <div className="hint">系统固定参数：管理超时15秒、探测超时8秒、探测并发12、删除并发8、最大探测120、主动探测开启。</div>
        </section>

        <section className="panel">
          <h2>执行日志</h2>
          <pre>{logs}</pre>
        </section>
      </section>
    </main>
  );
}
