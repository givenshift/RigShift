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

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', color: "#000" }}>

      {/* ─── TOP NAV ─── */}
      <nav style={{
        borderBottom: "2px solid #000",
        padding: "0 32px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "#fafafa",
        zIndex: 100,
      }}>
        <div style={{ fontWeight: 900, fontSize: "18px", letterSpacing: "-0.03em" }}>RIGSHIFT</div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {connected && (
            <span style={{
              fontSize: "11px",
              fontFamily: '"Courier New", monospace',
              background: chainOk ? "#00ff41" : "#ffcc00",
              color: "#000",
              padding: "3px 9px",
              fontWeight: 700,
            }}>
              {chainOk ? "Arc Testnet ✓" : "Wrong Network ⚠"}
            </span>
          )}

          {connected ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#000",
              color: "#00ff41",
              padding: "6px 14px",
              fontFamily: '"Courier New", monospace',
              fontSize: "12px",
              fontWeight: 700,
            }}>
              <span>{account.slice(0, 6)}…{account.slice(-4)}</span>
              {arcBalance && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{arcBalance} ARC</span>
                </>
              )}
            </div>
          ) : (
            <button onClick={connect} style={{
              background: "#000",
              color: "#00ff41",
              border: "none",
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <div style={{ borderBottom: "2px solid #000", padding: "48px 32px 40px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ fontWeight: 900, fontSize: "clamp(48px, 8vw, 96px)", lineHeight: "0.88", letterSpacing: "-0.04em", marginBottom: "16px" }}>
          CLOCK IN.<br /><span style={{ color: "#00ff41" }}>GET PAID.</span>
        </div>
        <p style={{ fontSize: "15px", color: "#555", maxWidth: "480px", lineHeight: "1.5" }}>
          On-chain shift tracking for oilfield workers. Every closed shift earns 0.30 USDC — distributed weekly by the foreman agent.
        </p>
      </div>

      {/* ─── MAIN GRID ─── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: connected ? "1fr 1fr" : "1fr",
          gap: "0",
          borderBottom: "2px solid #000",
        }}>

          {/* LEFT: ACTION PANEL */}
          <div style={{ padding: "40px 0", borderRight: connected ? "1.5px solid #000" : undefined, paddingRight: connected ? "40px" : undefined }}>
            {!connected ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: "15px", color: "#555", marginBottom: "24px", lineHeight: "1.6" }}>
                  Connect your wallet to start tracking shifts on Arc Testnet.
                </div>
                <button onClick={connect} style={{
                  background: "#000",
                  color: "#00ff41",
                  border: "none",
                  padding: "16px 48px",
                  fontSize: "15px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                  Connect Wallet →
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: "8px" }}>
                    Shift Status
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px 20px",
                    background: cIn ? "#000" : "#f0f0f0",
                    color: cIn ? "#00ff41" : "#666",
                    marginBottom: "8px",
                  }}>
                    <div style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: cIn ? "#00ff41" : "#999",
                      boxShadow: cIn ? "0 0 8px #00ff41" : "none",
                    }} />
                    <span style={{ fontWeight: 700, fontSize: "14px", fontFamily: '"Courier New", monospace' }}>
                      {cIn ? "ON SHIFT" : "OFF SHIFT"}
                    </span>
                    {cIn && elapsed > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: "13px", opacity: 0.8 }}>
                        {formatDuration(elapsed)}
                      </span>
                    )}
                  </div>
                </div>

                {/* MAIN BUTTON */}
                <button
                  onClick={cIn ? clockOut : clockIn}
                  disabled={txLoading}
                  style={{
                    width: "100%",
                    background: txLoading ? "#ccc" : cIn ? "#000" : "#00ff41",
                    color: txLoading ? "#888" : cIn ? "#00ff41" : "#000",
                    border: cIn ? "2px solid #000" : "2px solid #00ff41",
                    padding: "20px",
                    fontSize: "16px",
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    cursor: txLoading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    marginBottom: "12px",
                  }}
                >
                  {txLoading ? "PROCESSING..." : cIn ? "CLOCK OUT →" : "CLOCK IN →"}
                </button>

                {txStatus && (
                  <div style={{
                    padding: "10px 14px",
                    background: txStatus.includes("✓") ? "#f0fff4" : "#f5f5f5",
                    border: `1px solid ${txStatus.includes("✓") ? "#00ff41" : "#ddd"}`,
                    fontFamily: '"Courier New", monospace',
                    fontSize: "12px",
                    color: txStatus.includes("✓") ? "#007a20" : "#333",
                    wordBreak: "break-all",
                    marginBottom: "16px",
                  }}>
                    {txStatus}
                  </div>
                )}

                {/* Worker stats */}
                {workerInfo && (
                  <div style={{ borderTop: "1.5px solid #eee", paddingTop: "20px", marginTop: "8px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: "12px" }}>
                      My Stats
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {[
                        ["Shifts completed", workerInfo.shiftsCompleted.toString()],
                        ["Unpaid shifts", workerInfo.unpaidShifts.toString()],
                        ["Shifts paid", workerInfo.shiftsPaid.toString()],
                        ["Earned (est.)", `$${(workerInfo.shiftsPaid * 0.30).toFixed(2)}`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ padding: "12px", background: "#f8f8f8", borderLeft: "3px solid #00ff41" }}>
                          <div style={{ fontSize: "10px", color: "#999", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>{k}</div>
                          <div style={{ fontWeight: 900, fontSize: "20px", fontFamily: '"Courier New", monospace', letterSpacing: "-0.02em" }}>{v}</div>
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
            <div style={{ padding: "40px 0 40px 40px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: "20px" }}>
                Protocol Stats
              </div>

              {globalStats ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
                  {[
                    ["Total Shifts", globalStats.totalShiftsClosed.toString()],
                    ["Workers", globalStats.workerCount.toString()],
                    ["USDC Distributed", `$${globalStats.totalUSDCDistributed.toFixed(2)}`],
                    ["Pool Balance", `$${globalStats.poolBalance.toFixed(2)}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ padding: "16px", border: "1.5px solid #e8e8e8" }}>
                      <div style={{ fontSize: "10px", color: "#999", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{k}</div>
                      <div style={{ fontWeight: 900, fontSize: "28px", fontFamily: '"Courier New", monospace', letterSpacing: "-0.03em" }}>{v}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#999", fontSize: "13px", marginBottom: "32px" }}>Loading stats...</div>
              )}

              {/* Contract info */}
              <div style={{ borderTop: "1.5px solid #eee", paddingTop: "20px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: "12px" }}>
                  Contract
                </div>
                <div style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: "11px",
                  background: "#000",
                  color: "#00ff41",
                  padding: "10px 12px",
                  wordBreak: "break-all",
                  marginBottom: "10px",
                }}>
                  {CONTRACT_ADDRESS}
                </div>
                <a
                  href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#000",
                    textDecoration: "none",
                    letterSpacing: "0.06em",
                    borderBottom: "1.5px solid #000",
                  }}
                >
                  View on ArcScan ↗
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ─── HOW IT WORKS (compact) ─── */}
        <div style={{ padding: "40px 0", borderBottom: "2px solid #000" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: "24px" }}>
            How It Works
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0" }}>
            {[
              { n: "01", title: "Clock In", body: "Hit the button. Contract records your shift start on Arc Testnet." },
              { n: "02", title: "Clock Out", body: "End your shift. Duration and count stored permanently on-chain." },
              { n: "03", title: "Get Paid", body: "Foreman agent distributes 0.30 USDC per closed shift, weekly." },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "24px 24px 24px 0",
                paddingLeft: i > 0 ? "24px" : "0",
                borderLeft: i > 0 ? "1.5px solid #e8e8e8" : undefined,
              }}>
                <div style={{ fontWeight: 900, fontSize: "40px", color: "#00ff41", lineHeight: "1", marginBottom: "12px", fontFamily: '"Courier New", monospace' }}>{s.n}</div>
                <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>{s.title}</div>
                <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.5" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{
        borderTop: "2px solid #000",
        padding: "24px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "12px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}>
        <div style={{ fontWeight: 900, fontSize: "14px", letterSpacing: "-0.02em" }}>RIGSHIFT</div>
        <div style={{ display: "flex", gap: "24px", color: "#666" }}>
          <span>Arc Testnet · Chain ID 5042002</span>
          <a
            href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#000", fontWeight: 700, textDecoration: "none" }}
          >
            Contract ↗
          </a>
          <a
            href="https://github.com/givenshift/RigShift"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#000", fontWeight: 700, textDecoration: "none" }}
          >
            GitHub ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
