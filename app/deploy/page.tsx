"use client";

import { useState, useEffect } from "react";
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

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_HEX = "0x" + ARC_CHAIN_ID.toString(16);

const ARC_NETWORK = {
  chainId: ARC_CHAIN_HEX,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: { name: "ARC", symbol: "ARC", decimals: 18 },
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

// Compiled with solc 0.8.34+commit.80d5c536 — matches ArcScan verifier
const CONTRACT_BYTECODE =
  "0x6080604052348015600e575f5ffd5b505f80546001600160a01b03191633179055610a7e8061002d5f395ff3fe608060405234801561000f575f5ffd5b50600436106100f0575f3560e01c806389a3027111610093578063c59d484711610063578063c59d4847146101eb578063ce8ef7a614610213578063ed4928c814610250578063f7a94f4b14610258575f5ffd5b806389a30271146101ba57806397044ade146101c5578063a484fb7b146101ce578063c22ef14c146101e1575f5ffd5b80634d432c1d116100ce5780634d432c1d1461018257806353d6fcec146101955780635fb7c6de1461019f5780636f4a2cd0146101b2575f5ffd5b806322774e30146100f45780634041ed3b146101105780634048a2571461013a575b5f5ffd5b6100fd60045481565b6040519081526020015b60405180910390f35b5f54610122906001600160a01b031681565b6040516001600160a01b039091168152602001610107565b610167610148366004610963565b600160208190525f918252604090912080549181015460029091015483565b60408051938452602084019290925290820152606001610107565b610122610190366004610990565b610260565b61019d610288565b005b61019d6101ad366004610963565b61033b565b61019d6103be565b610122601b60991b81565b6100fd60055481565b61019d6101dc366004610963565b6105de565b6100fd620493e081565b6101f36107c9565b604080519485526020850193909352918301526060820152608001610107565b610226610221366004610963565b610845565b6040805195151586526020860194909452928401919091526060830152608082015260a001610107565b61019d610888565b6002546100fd565b6002818154811061026f575f80fd5b5f918252602090912001546001600160a01b0316905081565b335f90815260016020526040812080549091036102b857604051630540906b60e11b815260040160405180910390fd5b80545f906102c690426109bb565b90505f825f01819055506001826001015f8282546102e491906109d4565b92505081905550600160045f8282546102fd91906109d4565b909155505060405181815233907f165c0fc85e4ff10635a08c063732d2466423f825a0ce969af6de3041df42ff969060200160405180910390a25050565b5f546001600160a01b03163314610365576040516328400b2360e11b815260040160405180910390fd5b5f80546040516001600160a01b03808516939216917fff386345132ca2976cb80312edfadb16a2bcf18f6df3ddd65bdadd011a36c8fe91a35f80546001600160a01b0319166001600160a01b0392909216919091179055565b5f546001600160a01b031633146103e8576040516328400b2360e11b815260040160405180910390fd5b6002545f5b818110156105da575f60028281548110610409576104096109e7565b5f9182526020808320909101546001600160a01b0316808352600191829052604083206002810154928101549194509291610443916109bb565b905080156105cc575f610459620493e0836109fb565b6040516370a0823160e01b81523060048201529091505f90601b60991b906370a0823190602401602060405180830381865afa15801561049b573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104bf9190610a12565b9050818110156104e25760405163785eab3760e01b815260040160405180910390fd5b82846002015f8282546104f591906109d4565b925050819055508160055f82825461050d91906109d4565b909155505060405163a9059cbb60e01b81526001600160a01b038616600482015260248101839052601b60991b9063a9059cbb906044016020604051808303815f875af1158015610560573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105849190610a29565b5060408051838152602081018590526001600160a01b038716917fe4e801442ed461792c0bdfa7f5c25444d391d67d68422437bd9005796c67cb23910160405180910390a250505b8360010193505050506103ed565b5050565b5f546001600160a01b03163314610608576040516328400b2360e11b815260040160405180910390fd5b6001600160a01b0381165f9081526001602081905260408220600281015491810154909291610636916109bb565b9050805f0361064457505050565b5f610652620493e0836109fb565b6040516370a0823160e01b81523060048201529091505f90601b60991b906370a0823190602401602060405180830381865afa158015610694573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906106b89190610a12565b9050818110156106db5760405163785eab3760e01b815260040160405180910390fd5b82846002015f8282546106ee91906109d4565b925050819055508160055f82825461070691906109d4565b909155505060405163a9059cbb60e01b81526001600160a01b038616600482015260248101839052601b60991b9063a9059cbb906044016020604051808303815f875af1158015610759573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061077d9190610a29565b5060408051838152602081018590526001600160a01b038716917fe4e801442ed461792c0bdfa7f5c25444d391d67d68422437bd9005796c67cb23910160405180910390a25050505050565b600480546005546002546040516370a0823160e01b8152309481019490945291929091905f90601b60991b906370a0823190602401602060405180830381865afa158015610819573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061083d9190610a12565b905090919293565b6001600160a01b0381165f9081526001602081905260408220805491810154600282015483151594919290919061087c83856109bb565b91505091939590929450565b335f9081526001602052604090208054156108b657604051636f25b5dd60e01b815260040160405180910390fd5b428155335f9081526003602052604090205460ff1661092b57335f818152600360205260408120805460ff191660019081179091556002805491820181559091527f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace0180546001600160a01b03191690911790555b60405142815233907f9ca7efa2899e936441b70a54251e2e0c8b1292b8eaf91124a0a67e4072a7264b9060200160405180910390a250565b5f60208284031215610973575f5ffd5b81356001600160a01b0381168114610989575f5ffd5b9392505050565b5f602082840312156109a0575f5ffd5b5035919050565b634e487b7160e01b5f52601160045260245ffd5b818103818111156109ce576109ce6109a7565b92915050565b808201808211156109ce576109ce6109a7565b634e487b7160e01b5f52603260045260245ffd5b80820281158282048414176109ce576109ce6109a7565b5f60208284031215610a22575f5ffd5b5051919050565b5f60208284031215610a39575f5ffd5b81518015158114610989575f5ffdfea2646970667358221220fc254f2c75e770fedeb358090a6326aeb38ff33ac61a0dc99fde27a2c20bbbd664736f6c63430008220033";

const CONTRACT_ABI = [
  "constructor()",
  "function clockIn() external",
  "function clockOut() external",
  "function distributeRewards() external",
  "function distributeRewardTo(address worker) external",
  "function transferForeman(address newForeman) external",
  "function getWorkerInfo(address worker) external view returns (bool, uint256, uint256, uint256, uint256)",
  "function getStats() external view returns (uint256, uint256, uint256, uint256)",
  "function workerCount() external view returns (uint256)",
  "function foreman() external view returns (address)",
  "function totalShiftsClosed() external view returns (uint256)",
  "function totalUSDCDistributed() external view returns (uint256)",
  "function REWARD_PER_SHIFT() external view returns (uint256)",
  "function USDC() external view returns (address)",
];

type Step = "idle" | "deploying" | "done" | "error";

async function ensureArcNetwork() {
  if (!window.ethereum) throw new Error("No wallet detected");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_HEX }],
    });
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 4902 || err.code === -32603) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ARC_NETWORK],
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_HEX }],
      });
    } else {
      throw e;
    }
  }
}

export default function DeployPage() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [chainOk, setChainOk] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [txHash, setTxHash] = useState("");

  // Check chain on mount / account change
  useEffect(() => {
    if (!account || !window.ethereum) return;
    window.ethereum
      .request({ method: "eth_chainId" })
      .then((id) => setChainOk((id as string).toLowerCase() === ARC_CHAIN_HEX.toLowerCase()))
      .catch(() => setChainOk(false));
  }, [account]);

  async function connect() {
    if (!window.ethereum) {
      setStatusMsg("No wallet found. Install Rabby or MetaMask.");
      return;
    }
    try {
      // First add/switch to Arc Testnet
      await ensureArcNetwork();

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const addr = accounts[0];
      setAccount(addr);
      setChainOk(true);

      // Get ARC balance
      const bal = (await window.ethereum.request({
        method: "eth_getBalance",
        params: [addr, "latest"],
      })) as string;
      const arcBal = parseFloat(ethers.formatEther(bal)).toFixed(4);
      setBalance(arcBal);
      setStatusMsg("");
    } catch (e: unknown) {
      setStatusMsg((e as Error).message);
    }
  }

  async function switchToArc() {
    try {
      await ensureArcNetwork();
      setChainOk(true);
      setStatusMsg("Switched to Arc Testnet");
    } catch (e: unknown) {
      setStatusMsg((e as Error).message);
    }
  }

  async function deploy() {
    if (!account || !window.ethereum) return;
    // Re-ensure Arc network right before deploy
    try {
      await ensureArcNetwork();
      setChainOk(true);
    } catch (e: unknown) {
      setStatusMsg("Switch to Arc Testnet first: " + (e as Error).message);
      return;
    }

    setStep("deploying");
    setStatusMsg("Waiting for wallet confirmation...");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ARC_CHAIN_ID) {
        throw new Error(`Wrong network. Expected Arc Testnet (${ARC_CHAIN_ID}), got ${network.chainId}`);
      }
      const signer = await provider.getSigner();
      const factory = new ethers.ContractFactory(CONTRACT_ABI, CONTRACT_BYTECODE, signer);
      const contract = await factory.deploy();
      const hash = contract.deploymentTransaction()?.hash ?? "";
      setTxHash(hash);
      setStatusMsg("Transaction sent — waiting for confirmation...");
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      setContractAddress(addr);
      setStep("done");
      setStatusMsg("Contract deployed!");
    } catch (e: unknown) {
      setStep("error");
      setStatusMsg((e as Error).message);
    }
  }

  const connected = !!account;
  const readyToDeploy = connected && chainOk && step === "idle";

  return (
    <div style={{ position: "relative", minHeight: "100vh", isolation: "isolate" }}>
      {/* backdrop layers */}
      <div className="dot-grid" />
      <div className="vignette" />

      {/* TOP BAR */}
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
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <svg width="24" height="24" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <g stroke="var(--blush)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" fill="none">
              <path d="M6 46 L20 22 L34 40 L48 14 L58 44" />
              <path d="M6 46 L20 50 L34 46 L48 50 L58 44" opacity="0.55" />
            </g>
          </svg>
          <span className="pixel" style={{ fontSize: "17px", letterSpacing: "0.04em", color: "var(--text)" }}>
            RIGSHIFT
          </span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="readout" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className={`status-dot ${connected ? (chainOk ? "" : "warn") : "idle"}`} />
            <span style={{ opacity: 0.85 }}>
              {connected ? (chainOk ? "NET.ARC // READY" : "NET // WARN") : "DEPLOY.STANDBY"}
            </span>
          </div>
          {connected ? (
            <span
              className="panel-raised mono"
              style={{ padding: "8px 14px", fontSize: "12px", color: "var(--blush)" }}
            >
              {account.slice(0, 6)}…{account.slice(-4)}
              {balance ? `  ·  ${balance} ARC` : ""}
            </span>
          ) : (
            <button onClick={connect} className="pill pill-primary">
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "600px",
          margin: "0 auto",
          padding: "clamp(48px, 8vw, 72px) clamp(18px, 4vw, 24px) 96px",
        }}
      >
        <div className="eyebrow fade-up d1" style={{ marginBottom: "18px" }}>
          Foreman provisioning
        </div>
        <h1 className="display-xl fade-up d2" style={{ fontSize: "clamp(30px, 6vw, 52px)", marginBottom: "12px" }}>
          Deploy <span style={{ color: "var(--blush)" }}>RigShift</span>
        </h1>
        <p
          className="fade-up d3"
          style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "34px" }}
        >
          Deploys the shift-tracking contract to Arc Testnet. You become the foreman — your
          address controls reward distribution.
        </p>

        {/* Network info card */}
        <div
          className="panel"
          style={{
            padding: "18px 20px",
            marginBottom: "20px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "16px",
          }}
        >
          {[
            ["Network", "Arc Testnet"],
            ["Chain ID", "5042002"],
            ["Reward/shift", "0.30 USDC"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="label" style={{ marginBottom: "6px" }}>{k}</div>
              <div className="mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Step 1: Connect */}
        {!connected && (
          <div className="panel ticks" style={{ padding: "26px 24px", marginBottom: "16px", textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "20px", lineHeight: 1.65 }}>
              Connect your wallet. The page will automatically add and switch to{" "}
              <strong style={{ color: "var(--blush)" }}>Arc Testnet</strong> (Chain ID: 5042002).
            </p>
            <button onClick={connect} className="pill pill-primary" style={{ width: "100%" }}>
              Connect Wallet →
            </button>
          </div>
        )}

        {/* Step 2: Wrong network warning */}
        {connected && !chainOk && (
          <div
            className="panel"
            style={{
              borderColor: "var(--warn)",
              padding: "18px 22px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <div className="mono" style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px", color: "var(--warn)" }}>
                Wrong network
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                Switch to Arc Testnet to deploy
              </div>
            </div>
            <button onClick={switchToArc} className="pill pill-secondary" style={{ whiteSpace: "nowrap" }}>
              Switch Network
            </button>
          </div>
        )}

        {/* Step 3: Deploy button */}
        {connected && (
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={deploy}
              disabled={!readyToDeploy}
              className="pill pill-primary"
              style={{ width: "100%" }}
            >
              {step === "deploying"
                ? "Deploying…"
                : step === "done"
                ? "Deployed ✓"
                : "Deploy Contract →"}
            </button>
          </div>
        )}

        {/* Status message */}
        {statusMsg && step !== "done" && (
          <div
            className="mono"
            style={{
              border: `1px solid ${step === "error" ? "#b85c5c" : "var(--line-2)"}`,
              padding: "14px 16px",
              marginBottom: "16px",
              fontSize: "12px",
              color: step === "error" ? "#e3a3a3" : "var(--muted)",
              background: "var(--bg-3)",
              wordBreak: "break-all",
            }}
          >
            {statusMsg}
          </div>
        )}

        {/* Success result */}
        {step === "done" && contractAddress && (
          <div className="panel ticks" style={{ borderColor: "var(--blush-dim)", padding: "24px" }}>
            <div className="mono" style={{ fontWeight: 700, fontSize: "18px", marginBottom: "20px", color: "var(--blush)" }}>
              ✓ Contract Deployed
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div className="label" style={{ marginBottom: "6px" }}>Contract Address</div>
              <div
                className="mono"
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  background: "var(--bg)",
                  border: "1px solid var(--line-2)",
                  color: "var(--blush)",
                  padding: "10px 14px",
                  wordBreak: "break-all",
                  userSelect: "all",
                }}
              >
                {contractAddress}
              </div>
            </div>

            {txHash && (
              <div style={{ marginBottom: "20px" }}>
                <div className="label" style={{ marginBottom: "6px" }}>Transaction Hash</div>
                <a
                  href={`https://testnet.arcscan.app/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono link-underline"
                  style={{ fontSize: "12px", color: "var(--text)", wordBreak: "break-all" }}
                >
                  {txHash}
                </a>
              </div>
            )}

            <a
              href={`https://testnet.arcscan.app/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pill pill-primary"
              style={{ width: "100%" }}
            >
              View on ArcScan ↗
            </a>
          </div>
        )}

        {/* Contract specs */}
        <div className="hairline" style={{ marginTop: "40px", paddingTop: "24px" }}>
          <div className="label" style={{ marginBottom: "12px" }}>// Contract Details</div>
          {[
            ["Compiler", "Solidity 0.8.35"],
            ["Optimizer", "200 runs"],
            ["License", "MIT"],
            ["USDC", "0x3600...0000 (6 decimals)"],
            ["Reward per shift", "0.30 USDC"],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: "1px solid var(--line)",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "var(--muted)" }}>{k}</span>
              <span className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
