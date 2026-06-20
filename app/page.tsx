"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const CONTRACT_ADDRESS = "0x3125C66983d9E9b373eE1C518eCC8b7c1eef5aEC";
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_HEX = "0x" + ARC_CHAIN_ID.toString(16);

const ARC_NETWORK = {
  chainId: ARC_CHAIN_HEX,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: { name: "ARC", symbol: "ARC", decimals: 18 },
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const CONTRACT_ABI = [
  "function clockIn() external",
  "function clockOut() external",
  "function getWorkerInfo(address worker) external view returns (bool clockedIn, uint256 shiftStart, uint256 shiftsCompleted, uint256 shiftsPaid, uint256 unpaidShifts)",
  "function getStats() external view returns (uint256 totalShiftsClosed, uint256 totalUSDCDistributed, uint256 workerCount, uint256 poolBalance)",
  "function foreman() external view returns (address)",
  "function REWARD_PER_SHIFT() external view returns (uint256)",
];

const READ_RPC = "https://rpc.testnet.arc.network";

async function ensureArc() {
  if (!window.ethereum) throw new Error("No wallet");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_HEX }],
    });
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 4902 || err.code === -32603) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_NETWORK] });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_HEX }] });
    } else throw e;
  }
}

interface WorkerInfo {
  clockedIn: boolean;
  shiftStart: number;
  shiftsCompleted: number;
  shiftsPaid: number;
  unpaidShifts: number;
}

interface GlobalStats {
  totalShiftsClosed: number;
  totalUSDCDistributed: number;
  workerCount: number;
  poolBalance: number;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ── Bespoke wireframe-rig mark (SVG, no external art) ── */
function RigMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g stroke="var(--blush)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <path d="M6 46 L20 22 L34 40 L48 14 L58 44" />
        <path d="M6 46 L20 50 L34 46 L48 50 L58 44" opacity="0.55" />
        <path d="M20 22 L20 50 M48 14 L48 50" opacity="0.45" />
      </g>
    </svg>
  );
}

/* ── Low-poly wireframe terrain (animated swell, GPU-cheap) ── */
function Terrain() {
  return (
    <svg
      className="terrain"
      viewBox="0 0 1200 380"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* far mesh */}
      <g className="mesh-far terrain-wave tw-3">
        <polyline points="0,200 150,150 300,185 450,130 600,175 750,120 900,170 1050,125 1200,165" />
        <polyline points="0,260 150,235 300,255 450,225 600,250 750,220 900,248 1050,222 1200,245" />
        <line x1="150" y1="150" x2="150" y2="235" /><line x1="300" y1="185" x2="300" y2="255" />
        <line x1="450" y1="130" x2="450" y2="225" /><line x1="600" y1="175" x2="600" y2="250" />
        <line x1="750" y1="120" x2="750" y2="220" /><line x1="900" y1="170" x2="900" y2="248" />
        <line x1="1050" y1="125" x2="1050" y2="222" />
      </g>
      {/* mid mesh */}
      <g className="mesh-mid terrain-wave tw-2">
        <polyline points="0,300 120,255 260,295 400,240 540,290 700,235 860,285 1010,245 1200,290" />
        <polyline points="0,340 120,320 260,338 400,315 540,336 700,312 860,334 1010,318 1200,338" />
        <line x1="120" y1="255" x2="120" y2="320" /><line x1="260" y1="295" x2="260" y2="338" />
        <line x1="400" y1="240" x2="400" y2="315" /><line x1="540" y1="290" x2="540" y2="336" />
        <line x1="700" y1="235" x2="700" y2="312" /><line x1="860" y1="285" x2="860" y2="334" />
        <line x1="1010" y1="245" x2="1010" y2="318" />
        {/* triangulation diagonals */}
        <line x1="120" y1="255" x2="260" y2="338" /><line x1="400" y1="240" x2="540" y2="336" />
        <line x1="700" y1="235" x2="860" y2="334" />
      </g>
      {/* near mesh */}
      <g className="mesh-near terrain-wave">
        <polyline points="0,360 200,330 380,358 560,326 760,356 960,330 1200,360" />
        <line x1="200" y1="330" x2="380" y2="358" /><line x1="560" y1="326" x2="760" y2="356" />
        <line x1="960" y1="330" x2="1200" y2="360" />
      </g>
    </svg>
  );
}

export default function Home() {
  const [account, setAccount] = useState("");
  const [arcBalance, setArcBalance] = useState("");
  const [chainOk, setChainOk] = useState(false);
  const [workerInfo, setWorkerInfo] = useState<WorkerInfo | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [txStatus, setTxStatus] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Live shift timer
  useEffect(() => {
    if (!workerInfo?.clockedIn || !workerInfo.shiftStart) return;
    const id = setInterval(() => {
      setElapsed(Math.floor(Date.now() / 1000) - workerInfo.shiftStart);
    }, 1000);
    return () => clearInterval(id);
  }, [workerInfo?.clockedIn, workerInfo?.shiftStart]);

  // Dotted-grid parallax on scroll (presentation only)
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.style.setProperty(
        "--grid-shift",
        `${window.scrollY * 0.18}px`
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const loadStats = useCallback(async (addr?: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(READ_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const stats = await contract.getStats();
      setGlobalStats({
        totalShiftsClosed: Number(stats[0]),
        totalUSDCDistributed: Number(stats[1]) / 1e6,
        workerCount: Number(stats[2]),
        poolBalance: Number(stats[3]) / 1e6,
      });
      if (addr) {
        const info = await contract.getWorkerInfo(addr);
        setWorkerInfo({
          clockedIn: info[0],
          shiftStart: Number(info[1]),
          shiftsCompleted: Number(info[2]),
          shiftsPaid: Number(info[3]),
          unpaidShifts: Number(info[4]),
        });
        setElapsed(info[0] ? Math.floor(Date.now() / 1000) - Number(info[1]) : 0);
      }
    } catch {
      // RPC might not be reachable — silent fail
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function connect() {
    if (!window.ethereum) { setTxStatus("No wallet found. Install Rabby or MetaMask."); return; }
    try {
      await ensureArc();
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const addr = accounts[0];
      setAccount(addr);
      setChainOk(true);
      const bal = (await window.ethereum.request({ method: "eth_getBalance", params: [addr, "latest"] })) as string;
      setArcBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
      await loadStats(addr);
      setTxStatus("");
    } catch (e: unknown) { setTxStatus((e as Error).message); }
  }

  async function clockIn() {
    if (!account || !window.ethereum) return;
    setTxLoading(true);
    setTxStatus("Confirm in wallet...");
    try {
      await ensureArc();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.clockIn();
      setTxStatus("Clocking in...");
      await tx.wait();
      setTxStatus("Clocked in ✓");
      await loadStats(account);
    } catch (e: unknown) { setTxStatus((e as Error).message); }
    setTxLoading(false);
  }

  async function clockOut() {
    if (!account || !window.ethereum) return;
    setTxLoading(true);
    setTxStatus("Confirm in wallet...");
    try {
      await ensureArc();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.clockOut();
      setTxStatus("Clocking out...");
      await tx.wait();
      setTxStatus("Shift closed ✓");
      await loadStats(account);
    } catch (e: unknown) { setTxStatus((e as Error).message); }
    setTxLoading(false);
  }

  const connected = !!account;
  const cIn = workerInfo?.clockedIn ?? false;
  const ok = txStatus.includes("✓");

  return (
    <div style={{ position: "relative", minHeight: "100vh", isolation: "isolate" }}>
      {/* backdrop layers */}
      <div className="dot-grid" />
      <div className="vignette" />

      {/* extruded glitch vertical text on the right edge */}
      <div className="edge-text">FIELD OPS</div>

      {/* ─── TOP BAR ─── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px clamp(18px, 4vw, 48px)",
          borderBottom: "1px solid var(--line)",
          background: "rgba(8,9,11,0.78)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <RigMark />
          <span className="pixel" style={{ fontSize: "18px", letterSpacing: "0.04em" }}>
            RIGSHIFT
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* tiny status readout */}
          <div className="readout" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className={`status-dot ${connected ? (chainOk ? "" : "warn") : "idle"}`} />
            <span style={{ opacity: 0.85 }}>
              {connected ? (chainOk ? "SYS.ONLINE // OP.READY" : "SYS.ONLINE // NET.WARN") : "SYS.ONLINE // OP.STANDBY"}
            </span>
          </div>

          {connected ? (
            <div
              className="panel-raised mono"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 14px",
                fontSize: "12px",
                color: "var(--blush)",
              }}
            >
              <span>{account.slice(0, 6)}…{account.slice(-4)}</span>
              {arcBalance && (
                <>
                  <span style={{ color: "var(--dim)" }}>·</span>
                  <span style={{ color: "var(--text)" }}>{arcBalance} ARC</span>
                </>
              )}
            </div>
          ) : (
            <button onClick={connect} className="pill pill-primary">
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "clamp(56px, 9vw, 112px) clamp(18px, 4vw, 48px) clamp(120px, 16vw, 220px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Terrain />
        <div style={{ position: "relative", zIndex: 2, maxWidth: "1120px", margin: "0 auto" }}>
          <div className="eyebrow fade-up d1" style={{ marginBottom: "22px" }}>
            For operators, not experimenters
          </div>

          <h1 className="display-xl fade-up d2" style={{ marginBottom: "26px" }}>
            Clock in.
            <br />
            <span style={{ color: "var(--blush)" }}>Get paid.</span>
          </h1>

          <p
            className="fade-up d3"
            style={{
              maxWidth: "520px",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "var(--muted)",
              marginBottom: "32px",
            }}
          >
            On-chain shift tracking for oilfield workers. Every closed shift earns 0.30 USDC —
            distributed by the foreman agent. No timesheets, no middlemen, just verifiable field ops.
          </p>

          <div className="fade-up d4" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {connected ? (
              <button
                onClick={cIn ? clockOut : clockIn}
                disabled={txLoading}
                className="pill pill-primary"
              >
                {txLoading ? "Processing…" : cIn ? "Clock Out →" : "Clock In →"}
              </button>
            ) : (
              <button onClick={connect} className="pill pill-primary">
                Connect Wallet →
              </button>
            )}
            <a
              href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pill pill-secondary"
            >
              View Contract ↗
            </a>
          </div>
        </div>
      </section>

      {/* ─── CONSOLE GRID ─── */}
      <main style={{ position: "relative", zIndex: 2, maxWidth: "1120px", margin: "0 auto", padding: "clamp(40px, 6vw, 72px) clamp(18px, 4vw, 48px) 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: connected ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
            gap: "18px",
          }}
        >
          {/* LEFT: ACTION PANEL */}
          <div className="panel ticks" style={{ padding: "26px" }}>
            <div className="label" style={{ marginBottom: "18px" }}>
              {connected ? "// Operator Console" : "// Access"}
            </div>

            {!connected ? (
              <div style={{ padding: "20px 0 8px" }}>
                <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "22px" }}>
                  Connect your wallet to start tracking shifts on Arc Testnet. The page adds and
                  switches the network for you.
                </p>
                <button onClick={connect} className="pill pill-primary" style={{ width: "100%" }}>
                  Connect Wallet →
                </button>
              </div>
            ) : (
              <>
                {/* shift status */}
                <div
                  className="panel-raised"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px 18px",
                    marginBottom: "16px",
                  }}
                >
                  <span className={`status-dot ${cIn ? "" : "idle"}`} />
                  <span className="mono" style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", color: cIn ? "var(--blush)" : "var(--muted)" }}>
                    {cIn ? "ON SHIFT" : "OFF SHIFT"}
                  </span>
                  {cIn && elapsed > 0 && (
                    <span className="mono" style={{ marginLeft: "auto", fontSize: "13px", color: "var(--text)" }}>
                      {formatDuration(elapsed)}
                    </span>
                  )}
                </div>

                {/* main button */}
                <button
                  onClick={cIn ? clockOut : clockIn}
                  disabled={txLoading}
                  className={`pill ${cIn ? "pill-secondary" : "pill-primary"}`}
                  style={{ width: "100%", marginBottom: "14px" }}
                >
                  {txLoading ? "Processing…" : cIn ? "Clock Out →" : "Clock In →"}
                </button>

                {txStatus && (
                  <div
                    className="mono"
                    style={{
                      padding: "11px 14px",
                      border: `1px solid ${ok ? "var(--blush-dim)" : "var(--line-2)"}`,
                      background: "var(--bg-3)",
                      fontSize: "12px",
                      color: ok ? "var(--blush)" : "var(--muted)",
                      wordBreak: "break-all",
                      marginBottom: "16px",
                    }}
                  >
                    {txStatus}
                  </div>
                )}

                {/* worker stats */}
                {workerInfo && (
                  <div className="hairline" style={{ paddingTop: "18px" }}>
                    <div className="label" style={{ marginBottom: "12px" }}>My Stats</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {[
                        ["Shifts completed", workerInfo.shiftsCompleted.toString()],
                        ["Unpaid shifts", workerInfo.unpaidShifts.toString()],
                        ["Shifts paid", workerInfo.shiftsPaid.toString()],
                        ["Earned (est.)", `$${(workerInfo.shiftsPaid * 0.30).toFixed(2)}`],
                      ].map(([k, v]) => (
                        <div key={k} className="panel-raised" style={{ padding: "13px 14px", borderLeft: "2px solid var(--blush-dim)" }}>
                          <div className="label" style={{ marginBottom: "6px" }}>{k}</div>
                          <div className="mono" style={{ fontWeight: 700, fontSize: "22px", color: "var(--text)" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT: GLOBAL STATS */}
          {connected && (
            <div className="panel ticks" style={{ padding: "26px" }}>
              <div className="label" style={{ marginBottom: "18px" }}>// Rig Readout</div>

              {globalStats ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
                  {[
                    ["Total Shifts", globalStats.totalShiftsClosed.toString()],
                    ["Workers", globalStats.workerCount.toString()],
                    ["USDC Distributed", `$${globalStats.totalUSDCDistributed.toFixed(2)}`],
                    ["Pool Balance", `$${globalStats.poolBalance.toFixed(2)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="panel-raised" style={{ padding: "16px 16px" }}>
                      <div className="label" style={{ marginBottom: "8px" }}>{k}</div>
                      <div className="mono" style={{ fontWeight: 700, fontSize: "27px", color: "var(--text)", letterSpacing: "-0.01em" }}>{v}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mono" style={{ color: "var(--dim)", fontSize: "13px", marginBottom: "22px" }}>Loading rig data…</div>
              )}

              {/* contract */}
              <div className="hairline" style={{ paddingTop: "18px" }}>
                <div className="label" style={{ marginBottom: "10px" }}>Contract</div>
                <div
                  className="mono"
                  style={{
                    fontSize: "11px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-2)",
                    color: "var(--blush)",
                    padding: "10px 12px",
                    wordBreak: "break-all",
                    marginBottom: "12px",
                  }}
                >
                  {CONTRACT_ADDRESS}
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="readout link-underline"
                  style={{ color: "var(--text)" }}
                >
                  View on ArcScan ↗
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ─── HOW IT WORKS ─── */}
        <section style={{ padding: "clamp(48px, 7vw, 84px) 0 clamp(40px, 6vw, 64px)" }}>
          <div className="label" style={{ marginBottom: "26px" }}>// How It Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {[
              { n: "01", title: "Clock In", body: "Hit the button. The contract records your shift start on Arc Testnet." },
              { n: "02", title: "Clock Out", body: "End your shift. Duration and count are stored permanently on-chain." },
              { n: "03", title: "Get Paid", body: "The foreman agent distributes 0.30 USDC for every closed shift." },
            ].map((s) => (
              <div key={s.n} className="panel" style={{ padding: "22px 22px 24px" }}>
                <div className="pixel" style={{ fontSize: "34px", color: "var(--blush)", lineHeight: 1, marginBottom: "16px" }}>{s.n}</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px", letterSpacing: "0.04em" }}>{s.title}</div>
                <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer
        style={{
          position: "relative",
          zIndex: 2,
          borderTop: "1px solid var(--line)",
          padding: "26px clamp(18px, 4vw, 48px)",
        }}
      >
        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <RigMark />
            <span className="pixel" style={{ fontSize: "14px" }}>RIGSHIFT</span>
          </div>
          <div className="readout" style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
            <span style={{ color: "var(--dim)" }}>Arc Testnet · Chain ID 5042002</span>
            <a
              href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
              style={{ color: "var(--text)" }}
            >
              Contract ↗
            </a>
            <a
              href="https://github.com/givenshift/RigShift"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
              style={{ color: "var(--text)" }}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
