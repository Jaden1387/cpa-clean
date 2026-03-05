export default function SummaryMetrics({ metrics }) {
  return (
    <div className="summary">
      <div className="metric"><div className="k">本轮扫描账户</div><div className="v">{metrics.scanned_total}</div></div>
      <div className="metric"><div className="k">风险命中条目</div><div className="v">{metrics.matched_total}</div></div>
      <div className="metric"><div className="k">主清理完成数</div><div className="v">{metrics.deleted_main}</div></div>
      <div className="metric"><div className="k">401补清理数</div><div className="v">{metrics.deleted_401}</div></div>
      <div className="metric"><div className="k">累计清理数量</div><div className="v">{metrics.deleted_total}</div></div>
      <div className="metric"><div className="k">异常失败数量</div><div className="v">{metrics.failed_total}</div></div>
    </div>
  );
}
