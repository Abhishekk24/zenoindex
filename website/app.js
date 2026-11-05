// Fills the page from config.js: links, contract addresses, and the live demo basket (API first, chain fallback).
(() => {
  const cfg = window.ZENO;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const colors = ["#a9844c", "#5b8fd0", "#8fae8b", "#d39a82", "#9d8fd0", "#d8bf86"];
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const fmt = (v, d = 4) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  $$(".js-apk").forEach((a) => (a.href = cfg.apkUrl));
  $$(".js-repo").forEach((a) => (a.href = cfg.repoUrl));
  $$("[data-addr]").forEach((a) => {
    const addr = a.dataset.addr;
    a.href = `${cfg.explorerUrl}/address/${addr}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = window.innerWidth < 560 ? short(addr) : addr;
  });

  const setStatus = (ok, text) => {
    const s = $(".js-status");
    s.classList.toggle("ok", ok);
    s.querySelector("span").textContent = text;
  };

  function render(d, source) {
    $(".js-name").textContent = d.name;
    $(".js-symbol").textContent = d.symbol;
    $(".js-nav").textContent = fmt(d.sharePrice);
    $(".js-aum").textContent = fmt(d.aum, 2);
    $(".js-supply").textContent = fmt(d.supply, 2);
    $(".js-exit").textContent = d.exitBps == null ? "—" : `${(d.exitBps / 100).toFixed(2)}%`;
    const bar = $(".js-bar");
    const legend = $(".js-legend");
    bar.replaceChildren();
    legend.replaceChildren();
    (d.weights || []).forEach((w, i) => {
      const c = colors[i % colors.length];
      const seg = document.createElement("span");
      seg.style.width = `${w.bps / 100}%`;
      seg.style.background = c;
      bar.append(seg);
      const li = document.createElement("li");
      li.innerHTML = `<span class="dot" style="background:${c}"></span><b></b><span class="pct">${(w.bps / 100).toFixed(1)}%</span>`;
      li.querySelector("b").textContent = w.symbol;
      legend.append(li);
    });
    $(".js-source").textContent = source;
    setStatus(true, "Live");
  }

  async function fromApi() {
    if (!cfg.apiUrl || !cfg.apiKey) throw new Error("no api");
    const get = (p) => fetch(`${cfg.apiUrl}/api/v1${p}`, { headers: { "x-api-key": cfg.apiKey } }).then((r) => {
      if (!r.ok) throw new Error(`${p} ${r.status}`);
      return r.json();
    });
    const [dtfs, assets] = await Promise.all([get("/dtfs"), get("/assets")]);
    const d = dtfs.items.find((x) => x.id.toLowerCase() === cfg.demoVault.toLowerCase()) || dtfs.items[0];
    const sym = new Map(assets.items.map((a) => [a.id.toLowerCase(), a.symbol]));
    render(
      {
        name: d.name,
        symbol: d.symbol,
        sharePrice: d.sharePrice,
        aum: d.aum,
        supply: Number(d.totalSupplyRaw) / 10 ** d.shareDecimals,
        exitBps: d.fees.exitBps,
        weights: d.weights.map((w) => ({ symbol: sym.get(w.assetId.toLowerCase()) || short(w.assetId), bps: w.weightBps })),
      },
      `Live from the ZenoIndex API · ${dtfs.items.length} basket${dtfs.items.length === 1 ? "" : "s"} on Arc testnet.`,
    );
  }

  // Fallback: two eth_calls on the vault (totalNav, totalShares), no API needed.
  async function fromChain() {
    const call = (data) =>
      fetch(cfg.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: cfg.demoVault, data }, "latest"] }),
      })
        .then((r) => r.json())
        .then((j) => BigInt(j.result));
    const [nav, shares] = await Promise.all([call("0x36f90a8c"), call("0x3a98ef39")]);
    render(
      {
        name: "Zeno Arc Demo Vault",
        symbol: "ZADV",
        sharePrice: shares > 0n ? Number(nav) / Number(shares) : 1,
        aum: Number(nav) / 1e6,
        supply: Number(shares) / 1e6,
        exitBps: 50,
        weights: [
          { symbol: "USDC", bps: 500 },
          { symbol: "NVDA", bps: 3000 },
          { symbol: "TSLA", bps: 2000 },
          { symbol: "META", bps: 2000 },
          { symbol: "MU", bps: 1500 },
          { symbol: "SPCX", bps: 1000 },
        ],
      },
      "Read straight from the vault contract on Arc testnet (API unreachable).",
    );
  }

  fromApi()
    .catch(() => fromChain())
    .catch(() => setStatus(false, "Offline"));
})();
