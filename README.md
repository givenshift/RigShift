```
═══════════════════════════════════════════════════════════════
 RIGSHIFT  ·  SHIFT LOG & HANDOVER SHEET           SHEET v0.1
───────────────────────────────────────────────────────────────
 RIG ......... on-chain timekeeping for field & oilfield crews
 CREW ........ any hand holding a wallet on the chain below
 TOUR ........ clock on · work the tour · clock off · draw pay
 PAPER ....... none — the sheet is a contract, ink is immutable
═══════════════════════════════════════════════════════════════
```

This is the doghouse sheet, except the sheet can't be re-pencilled and the
totals can't be quietly fixed before Monday. A hand punches on at the head of
tour and punches off at the end. The contract keeps the count. The boss makes a
pay run and a flat bonus drops to every hand for each closed shift they're still
owed on. Two punches for the crew, one run for the foreman. That's the rig.

---

## Log entry — how a tour gets written down

Used to be: a pad in the doghouse, a pencil tied to a string, somebody's
initials, a number the foreman keys into a sheet later and squints at. Lose the
pad, lose the tour.

Here the punch IS the record. `clockIn()` writes `block.timestamp` against your
address — and on your very first punch it adds you to `workerList` so the crew
roster builds itself, one new hand at a time. `clockOut()` reads back the gap,
clears the start, and ticks two tallies up by one: your own `shiftsCompleted`
and the rig-wide `totalShiftsClosed`. Nothing to re-key, nothing to lose off the
string.

Per hand the sheet carries three numbers (the `Worker` struct):

```
shiftStart        clock time of the open tour    · 0 means OFF the clock
shiftsCompleted   tours closed, all-time
shiftsPaid        of those, how many drew the bonus
```

The line that still owes you is just the subtraction: `shiftsCompleted` minus
`shiftsPaid`. `getWorkerInfo(addr)` hands back all of it plus that figure as
`unpaidShifts`, so anyone can read a hand's standing without asking the office.

---

## Clocking a shift — the two crew punches

No arguments, no approvals, no role. A hand signs from their own wallet and the
punch lands.

```
ON   clockIn()    open a tour          · reverts AlreadyClockedIn if still on
OFF  clockOut()   close it, count it   · reverts NotClockedIn if never on
```

The site front (`app/page.tsx`) is a single switch: a green CLOCK IN while
you're off the clock, a black CLOCK OUT while you're on, and a tour timer
ticking off `shiftStart`. Status reads ON SHIFT / OFF SHIFT pulled straight from
`getWorkerInfo`. Each punch fires `ClockedIn(worker, timestamp)` and
`ClockedOut(worker, duration)`, so the whole handover stands up to audit off the
log alone.

---

## Pay run — settling the sheet

The bonus is flat and it does not move. `REWARD_PER_SHIFT = 300_000` — that is
0.30 USDC at six decimals, identical for every closed shift. No grades, no
overtime math, no argument at the window.

The foreman signs `distributeRewards()`. It walks `workerList`; for each hand
carrying unpaid tours it figures `unpaidShifts × 0.30 USDC`, pays it from the
contract's own USDC pool, stamps those tours paid, adds the amount to
`totalUSDCDistributed`, and logs `RewardsDistributed(worker, amount, shifts)`.
If the pool can't cover a hand the call reverts `InsufficientPool` — the sheet
doesn't hand out half a bonus. Settling one hand on their own? `distributeRewardTo(address)`
runs the same arithmetic for a single worker.

Now the reason the pay run lives on a chain instead of a card terminal or a bank
file. Run the numbers on the run itself: thirty cents, times one hand, times
every tour on the sheet, paid again next cycle and the cycle after. A reward that
small only earns its keep if moving it costs a sliver of the thirty cents and the
money is real the instant it's sent. Send 0.30 over card rails and the
processing fee eats the bonus outright; route it through a bank and "weekly pay"
slides into "pay clears whenever the bank gets to it." Arc settles USDC payments
for a fraction of a cent and clears them on the spot — so one signed run can
sweep the whole crew, every hand's thirty cents arrives as spendable money the
same moment, and the cost of the transfer stays well below what's being
transferred. Drop beneath that line and a tiny, repeated per-shift reward simply
isn't worth doing. Staying above it is why the sheet is kept here.

---

## Roles — foreman

`foreman` is the deployer's address — a job title held by a person, not a
machine, not a scheduler. It's the only privileged seat on the rig, and one
modifier guards it: `onlyForeman` (revert `OnlyForeman`).

```
distributeRewards()           sweep the whole pay sheet
distributeRewardTo(address)   settle one hand
transferForeman(address)      hand the boss seat to another address
```

Plainly: there is no autonomous agent on this rig and no machine-to-machine
payment layer. A pay run is the foreman pressing the button on whatever cadence
the rig keeps — weekly does fine. Clocking and the flat bonus are live on-chain
right now; anything that automates the foreman's hand is a future tour, not a
present claim. (The site copy that says "foreman agent" is loose talk for the
same person; treat the contract as the truth.)

The crew punches take no role at all. Reading is open to everyone: `getStats()`
returns `totalShiftsClosed`, `totalUSDCDistributed`, `workerCount`, and the live
`poolBalance`; `getWorkerInfo(addr)` returns a single hand's line.

---

## Kit — what's bolted to the rig

```
contract    RigShift.sol          · Solidity ^0.8.20, MIT
compiled    solc v0.8.35 · optimizer on, 200 runs · EVM cancun
chain       Arc testnet · id 5042002
USDC        0x3600000000000000000000000000000000000000  (6 decimals)
deployed    0x3125C66983d9E9b373eE1C518eCC8b7c1eef5aEC
on-chain    https://testnet.arcscan.app/address/0x3125C66983d9E9b373eE1C518eCC8b7c1eef5aEC
front       Next.js App Router, browser-wallet signing via ethers v6
live        https://rigshift.vercel.app
```

Bring the front up locally:

```bash
npm install
npm run dev
```

Recut the contract (rewrites the ABI + bytecode under `contracts/`):

```bash
node scripts/compile.js
```

The stats and your own shift line load over a plain JSON-RPC read before you
connect anything — a wallet is wanted only to sign your own punches.

```
═══════════════════════════════════════════════════════════════
 KEPT BY    Paul Given · github.com/givenshift
 HANDOVER   sign your own punches · foreman runs the pay · the
            chain keeps the tally honest
═══════════════════════════════════════════════════════════════
```
