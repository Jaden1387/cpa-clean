"use client";

import { useEffect, useState } from "react";
import ConfigPanel from "@/components/ConfigPanel";
import HeroHeader from "@/components/HeroHeader";
import LogPanel from "@/components/LogPanel";

const STORAGE_KEYS = {
  management_url: "cpa_cleanup_management_url",
  management_token: "cpa_cleanup_management_token",
};

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
      const savedUrl = localStorage.getItem(STORAGE_KEYS.management_url) || "";
      const savedToken = localStorage.getItem(STORAGE_KEYS.management_token) || "";

      const resp = await fetch(apiUrl("/api/defaults"));
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      const d = data.defaults || {};
      setForm((prev) => ({
        ...prev,
        management_url: savedUrl || "",
        management_token: savedToken || d.management_token || "",
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.management_url, form.management_url);
    localStorage.setItem(STORAGE_KEYS.management_token, form.management_token);
  }, [form.management_url, form.management_token]);

  return (
    <main className="shell">
      <HeroHeader />

      <section className="grid">
        <ConfigPanel
          form={form}
          onChange={onChange}
          running={running}
          runCleanup={runCleanup}
          status={status}
          metrics={metrics}
        />
        <LogPanel logs={logs} />
      </section>
    </main>
  );
}
