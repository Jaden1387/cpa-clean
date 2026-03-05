export default function LogPanel({ logs }) {
  const lines = String(logs || "(暂无日志)").split("\n");

  const getLineClass = (line) => {
    const text = line.toLowerCase();
    if (text.includes("失败") || text.includes("异常") || text.includes("error")) return "log-line err";
    if (text.includes("成功") || text.includes("完成")) return "log-line ok";
    if (text.includes("进度")) return "log-line prog";
    return "log-line info";
  };

  return (
    <section className="panel panel-log">
      <h2>执行日志</h2>
      <div className="log-view">
        {lines.map((line, idx) => (
          <div className={getLineClass(line)} key={`${idx}-${line}`}>
            {line || " "}
          </div>
        ))}
      </div>
    </section>
  );
}
