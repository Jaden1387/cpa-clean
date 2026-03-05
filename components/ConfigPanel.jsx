import SummaryMetrics from "@/components/SummaryMetrics";

export default function ConfigPanel({ form, onChange, running, runCleanup, status, metrics }) {
  return (
    <section className="panel panel-config">
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
        <span className={`status ${status.kind}`}>{status.text}</span>
      </div>

      <SummaryMetrics metrics={metrics} />
    </section>
  );
}
