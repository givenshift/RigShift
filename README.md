# RigShift

**On-chain shift tracking for oilfield workers, built on Arc Network.**

---

## Why Arc

Arc Network is built for real-world applications — fast finality, low fees, and EVM compatibility that just works. For a use case like shift tracking, where transactions need to be cheap enough that a $0.30 USDC reward per shift actually makes sense, Arc is the only chain where the economics hold. Ethereum mainnet gas would eat the reward before it reaches the worker. Arc doesn't.

The testnet RPC is stable, ArcScan gives clear transaction visibility, and the EVM compatibility meant zero friction with ethers.js and standard Solidity tooling.

---

## What It Does

RigShift replaces the paper logbook. One smart contract. One button.

- Worker hits **Clock In** → contract records `block.timestamp` as shift start
- Worker hits **Clock Out** → contract calculates duration, increments their shift count
- Foreman agent runs weekly → calls `distributeRewards()` → 0.30 USDC from the pool flows to each worker per closed shift

No spreadsheets. No manager sign-off. No paper. Immutable record on Arc Testnet.

---

## Background

Built by a field mechanic who spent nearly an entire career on Baker Hughes rigs, logging shifts by hand in a notebook. Started programming out of boredom on the rig. Realized the whole timekeeping system could be replaced by a contract with two functions. So it was.

RigShift is the result.

---

## Contract

| Field | Value |
|-------|-------|
| Address | `0x3125C66983d9E9b373eE1C518eCC8b7c1eef5aEC` |
| Network | Arc Testnet |
| Chain ID | 5042002 |
| Compiler | Solidity 0.8.34 |
| Optimizer | Enabled, 200 runs |
| License | MIT |
| USDC | `0x3600000000000000000000000000000000000000` |
| Reward/shift | 300,000 (0.30 USDC, 6 decimals) |

[View on ArcScan →](https://testnet.arcscan.app/address/0x3125C66983d9E9b373eE1C518eCC8b7c1eef5aEC)

---

## Contract Interface

```solidity
// Worker functions
function clockIn() external;
function clockOut() external;

// Foreman only
function distributeRewards() external;
function distributeRewardTo(address worker) external;
function transferForeman(address newForeman) external;

// View
function getWorkerInfo(address worker) external view returns (
    bool clockedIn,
    uint256 shiftStart,
    uint256 shiftsCompleted,
    uint256 shiftsPaid,
    uint256 unpaidShifts
);
function getStats() external view returns (
    uint256 totalShiftsClosed,
    uint256 totalUSDCDistributed,
    uint256 workerCount,
    uint256 poolBalance
);
```

---

## Stack

- **Frontend** — Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Web3** — ethers.js v6 (no wagmi, no wallet connectors — just the library)
- **Contract** — Solidity 0.8.35, compiled with solc, deployed via browser wallet
- **Network** — Arc Testnet (Chain ID: 5042002)
- **Deploy** — Vercel

---

## Local Development

```bash
npm install
npm run dev
```

Compile contract:
```bash
node scripts/compile.js
```

Deploy page (hidden): `/deploy`

---

## Live

**https://rigshift.vercel.app**
