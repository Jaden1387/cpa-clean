export default function HeroHeader() {
  return (
    <section className="hero">
      <span className="brand-chip">DAIJIU LAB</span>
      <h1>小呆- CPA -账户清理工具</h1>
      <p className="promo-copy">维护不易，请求打赏支持。公益站提供无限codex，响应速度快、报错低、可无限登。</p>
      <div className="promo-row">
        <a className="promo-link" href="https://ldc.daiju.live/" target="_blank" rel="noreferrer">
          <span className="promo-title">小呆ldc小店</span>
          <span className="promo-desc">常用资源与工具合集</span>
        </a>
        <a className="promo-link" href="https://api.daiju.live/" target="_blank" rel="noreferrer">
          <span className="promo-title">小呆公益站</span>
          <span className="promo-desc">无限codex · 响应快 · 报错低 · 无限登</span>
        </a>
        <a className="promo-link" href="https://credit.linux.do/paying/online?token=95be6aa2be29b3b33711cc90778f68c6f89bf1121d73e95674d3e65059226a4e" target="_blank" rel="noreferrer">
          <span className="promo-title">打赏支持</span>
          <span className="promo-desc">维护不易，感谢支持</span>
        </a>
      </div>
    </section>
  );
}
