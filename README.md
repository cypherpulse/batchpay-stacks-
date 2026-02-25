# StacksBatchPay

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Clarity](https://img.shields.io/badge/Clarity-2-orange.svg)
![Stacks](https://img.shields.io/badge/Stacks-Blockchain-purple.svg)
![Fee](https://img.shields.io/badge/fee-0.5%25-green.svg)
![Max Batch](https://img.shields.io/badge/max%20batch-60%20recipients-yellow.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)
![Built With](https://img.shields.io/badge/built%20with-Clarinet-blueviolet.svg)

A Clarity smart contract deployed on the Stacks blockchain that enables any principal to pay up to 60 employees in a single transaction. All payments are denominated in STX. A flat 0.5% protocol fee is collected on every batch and forwarded to the treasury address. Every batch is recorded on-chain with full history available through read-only functions.

---

## Table of Contents

- [StacksBatchPay](#stacksbatchpay)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Architecture](#architecture)
    - [Data Flow](#data-flow)
    - [Storage Model](#storage-model)
  - [Contract Reference](#contract-reference)
    - [Constants](#constants)
    - [Data Maps](#data-maps)
    - [Public Functions](#public-functions)
      - [`batch-pay`](#batch-pay)
      - [`add-employee`](#add-employee)
      - [`remove-employee`](#remove-employee)
      - [`set-treasury`](#set-treasury)
    - [Read-Only Functions](#read-only-functions)
      - [`is-employee`](#is-employee)
      - [`get-batch-count`](#get-batch-count)
      - [`get-batch`](#get-batch)
      - [`get-treasury`](#get-treasury)
    - [Private Functions](#private-functions)
  - [Error Codes](#error-codes)
  - [Fee Model](#fee-model)
  - [On-Chain Events](#on-chain-events)
  - [Project Structure](#project-structure)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Deployment](#deployment)
  - [Integration Guide](#integration-guide)
    - [JavaScript / TypeScript](#javascript--typescript)
    - [Stacks.js Full Example](#stacksjs-full-example)
    - [Reading Batch History](#reading-batch-history)
    - [Indexer Integration](#indexer-integration)
  - [Testing](#testing)
    - [Test Structure](#test-structure)
    - [Running Tests](#running-tests)
    - [Test Coverage](#test-coverage)
  - [Security Considerations](#security-considerations)
  - [Known Limitations](#known-limitations)
  - [Contributing](#contributing)
  - [License](#license)

---

## Overview

StacksBatchPay solves a fundamental payroll problem on Stacks: sending STX to multiple addresses requires one transaction per recipient, which is expensive, slow, and impractical for teams. This contract collapses an entire payroll run into a single on-chain transaction, with each recipient name stored alongside the payment for audit purposes.

The contract is intentionally minimal. It does not custody funds. The payer's STX leaves their wallet and arrives in each recipient's wallet atomically within the same transaction. If any single payment fails — due to an invalid amount or a self-payment attempt — the entire batch reverts.

---

## Features

- Batch pay up to 60 recipients in one transaction
- STX-only payments, no token wrapping required
- 0.5% flat fee automatically routed to treasury on every batch
- Employee registry scoped per payer — each payer manages their own list independently
- Auto-registration of recipients into the employee map on first payment
- Full on-chain payment history indexed by payer address and batch ID
- Indexed `print` events for frontend and indexer consumption
- Treasury address updatable by the current treasury only
- Atomic execution — all payments succeed or all revert

---

## Architecture

```
Payer Wallet
     |
     |  calls batch-pay([{to, amount, name}, ...])
     v
+-----------------------------+
|      StacksBatchPay         |
|                             |
|  1. validate-and-add (fold) |  <-- asserts amount > 0, not self-pay
|                             |      writes to employees map
|  2. stx-transfer? (fee)     |  --> Treasury Wallet (0.5%)
|                             |
|  3. send-payment (fold)     |  --> Recipient 1
|                             |  --> Recipient 2
|                             |  --> Recipient N (up to 60)
|                             |
|  4. map-set payment-history |  <-- stores batch record on-chain
|                             |
|  5. print event             |  --> Indexer / Frontend listener
+-----------------------------+
```

### Data Flow

```
batch-pay call
     |
     +-- fold validate-and-add
     |        |-- asserts recipient != tx-sender     [ERR_RECIPIENT u103]
     |        |-- asserts amount > 0                 [ERR_AMOUNT u102]
     |        +-- map-set employees (auto-register)
     |
     +-- stx-transfer? fee -> treasury
     |
     +-- fold send-payment
     |        +-- stx-transfer? amount -> recipient  (for each entry)
     |
     +-- map-set payment-history (batch record)
     +-- map-set batch-counter   (increment)
     +-- print event
     +-- (ok true)
```

### Storage Model

The contract maintains three maps:

```
employees         {payer: principal, employee: principal}  =>  bool
batch-counter     principal                                =>  uint
payment-history   {payer: principal, batch-id: uint}       =>  {
                                                                  recipients: (list 60 principal),
                                                                  amounts:    (list 60 uint),
                                                                  names:      (list 60 (string-utf8 64)),
                                                                  timestamp:  uint,
                                                                  total:      uint,
                                                                  fee:        uint
                                                                }
```

Each payer has their own isolated namespace. Two different payers sharing the same employee address do not interfere with each other.

---

## Contract Reference

### Constants

| Constant | Value | Description |
|---|---|---|
| `FEE_BPS` | `u50` | Fee in basis points (50 bps = 0.5%) |
| `FEE_DENOM` | `u10000` | Basis point denominator |
| `MAX_BATCH` | `u60` | Maximum recipients per batch |

### Data Maps

**`employees`**

Tracks whether a given principal is registered as an employee under a specific payer. Scoped per payer so each organisation manages its own registry independently.

```clarity
(define-map employees {payer: principal, employee: principal} bool)
```

**`batch-counter`**

Monotonically increasing counter per payer. Increments by one on each successful `batch-pay` call. Used as the batch ID key in `payment-history`.

```clarity
(define-map batch-counter principal uint)
```

**`payment-history`**

Stores the full record of each batch keyed by payer address and batch ID. The `timestamp` field records the `burn-block-height` at the time of execution.

```clarity
(define-map payment-history
  {payer: principal, batch-id: uint}
  {
    recipients: (list 60 principal),
    amounts:    (list 60 uint),
    names:      (list 60 (string-utf8 64)),
    timestamp:  uint,
    total:      uint,
    fee:        uint
  })
```

---

### Public Functions

#### `batch-pay`

```clarity
(define-public (batch-pay
    (payments (list 60 {to: principal, amount: uint, name: (string-utf8 64)})))
  (response bool uint))
```

The core function. Accepts a list of payment tuples, validates each entry, collects the protocol fee, transfers STX to all recipients, and saves the batch record on-chain.

**Parameters**

| Field | Type | Description |
|---|---|---|
| `to` | `principal` | Recipient Stacks address |
| `amount` | `uint` | Amount in microSTX (1 STX = 1,000,000 microSTX) |
| `name` | `(string-utf8 64)` | Human-readable label for the recipient (stored on-chain) |

**Behaviour**

- Rejects if the list is empty or exceeds 60 entries
- Rejects if any amount is zero
- Rejects if the payer attempts to pay themselves
- Automatically registers each recipient into the `employees` map
- Transfers `(total * 50) / 10000` to treasury before paying recipients
- All transfers are atomic — if any fails the entire transaction reverts
- Increments the payer's batch counter
- Emits a `print` event with the full batch details

**Returns** `(ok true)` on success, or one of the error codes below on failure.

---

#### `add-employee`

```clarity
(define-public (add-employee (emp principal)) (response bool uint))
```

Manually registers a principal as an employee under `tx-sender`. Typically not required since `batch-pay` auto-registers recipients, but useful for pre-populating a roster before the first payroll run.

---

#### `remove-employee`

```clarity
(define-public (remove-employee (emp principal)) (response bool uint))
```

Removes an employee from the registry under `tx-sender`. Does not affect past payment history or prevent future payments to that address. The employee will be re-added automatically on the next `batch-pay` that includes them.

---

#### `set-treasury`

```clarity
(define-public (set-treasury (new-treasury principal)) (response bool uint))
```

Updates the treasury address. Only callable by the current treasury principal. Any other caller receives `(err u403)`.

---

### Read-Only Functions

#### `is-employee`

```clarity
(define-read-only (is-employee (emp principal)) bool)
```

Returns `true` if `emp` is registered as an employee under `tx-sender`, `false` otherwise. The caller context matters — results are scoped to whoever calls the function.

---

#### `get-batch-count`

```clarity
(define-read-only (get-batch-count (payer principal)) uint)
```

Returns the total number of batch payments made by the given payer. Returns `u0` if the payer has never called `batch-pay`.

---

#### `get-batch`

```clarity
(define-read-only (get-batch (payer principal) (batch-id uint))
  (optional {
    recipients: (list 60 principal),
    amounts:    (list 60 uint),
    names:      (list 60 (string-utf8 64)),
    timestamp:  uint,
    total:      uint,
    fee:        uint
  }))
```

Returns the full record of a specific batch, or `none` if the batch ID does not exist for the given payer. Batch IDs start at `u1` and increment sequentially.

---

#### `get-treasury`

```clarity
(define-read-only (get-treasury) principal)
```

Returns the current treasury principal.

---

### Private Functions

These functions are internal helpers not callable externally.

**`get-to`**, **`get-amount`**, **`get-name`** — tuple field extractors used with `map` to produce lists from the payments input.

**`validate-and-add`** — fold accumulator that validates each payment entry and writes the recipient to the `employees` map. Short-circuits on the first error.

**`send-payment`** — fold accumulator that executes the `stx-transfer?` for each entry. Short-circuits on the first transfer failure.

---

## Error Codes

| Code | Constant | Trigger Condition |
|---|---|---|
| `u101` | `ERR_LENGTH` | Payment list is empty or exceeds 60 entries |
| `u102` | `ERR_AMOUNT` | One or more payment amounts are zero |
| `u103` | `ERR_RECIPIENT` | Payer attempts to include themselves as a recipient |
| `u403` | — | Caller of `set-treasury` is not the current treasury |

STX transfer errors from insufficient balance or other protocol-level failures are propagated directly from `stx-transfer?` without wrapping.

---

## Fee Model

The fee is calculated as integer arithmetic in microSTX:

```
fee = (total * FEE_BPS) / FEE_DENOM
    = (total * 50) / 10000
    = total * 0.005
```

Because Clarity uses integer division, the fee is always rounded down. The fee is collected before any recipient payments are made. If the fee transfer fails — for example because the payer has insufficient balance to cover both the fee and the payments — the entire transaction reverts.

**Examples**

| Total Payout (STX) | Fee (STX) | Net to Recipients (STX) |
|---|---|---|
| 1,000 | 5 | 1,000 |
| 10,000 | 50 | 10,000 |
| 100,000 | 500 | 100,000 |
| 1 (1,000,000 microSTX) | 0.005 (5,000 microSTX) | 1 |

The total STX deducted from the payer's wallet is `total + fee`. Recipients receive the exact `amount` specified in each payment tuple — fees are additive, not deducted from recipient amounts.

---

## On-Chain Events

Every successful `batch-pay` emits a structured `print` event readable by indexers and frontend listeners:

```clarity
{
  event:      "batch-paid-stx",
  payer:      principal,
  batch-id:   uint,
  recipients: (list 60 principal),
  amounts:    (list 60 uint),
  names:      (list 60 (string-utf8 64)),
  total:      uint,
  fee:        uint
}
```

To subscribe to these events using the Stacks API:

```
GET https://api.mainnet.hiro.so/extended/v1/tx/events?address=<CONTRACT_ADDRESS>&type=contract_log
```

Filter for `event: "batch-paid-stx"` in the decoded log data.

---

## Project Structure

```
stacks-batchpay/
├── contracts/
│   └── batchpay.clar          # Main contract
├── tests/
│   └── batchpay.test.ts       # Vitest test suite
├── Clarinet.toml              # Clarinet project configuration
├── settings/
│   └── Devnet.toml            # Local devnet wallet configuration
└── README.md
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Clarinet](https://github.com/hirosystems/clarinet) | >= 2.0.0 | Contract development, testing, deployment |
| [Node.js](https://nodejs.org) | >= 18 | Running the test suite |
| [Stacks.js](https://github.com/hirosystems/stacks.js) | >= 6.0.0 | Frontend and script integration |

---

## Installation

```bash
# Clone the repository
git clone https://github.com/yourorg/stacks-batchpay.git
cd stacks-batchpay

# Install Node dependencies for tests
npm install

# Verify the contract compiles cleanly
clarinet check
```

---

## Deployment

**Devnet (local)**

```bash
clarinet devnet start
```

This spins up a local Stacks node with the contract pre-deployed using the wallets defined in `settings/Devnet.toml`.

**Testnet**

```bash
clarinet deployments generate --testnet
clarinet deployments apply --testnet
```

**Mainnet**

```bash
clarinet deployments generate --mainnet
clarinet deployments apply --mainnet
```

Before mainnet deployment, update the `treasury` data variable in the contract to your intended treasury address. The default value `SPGDS0Y17973EN5TCHNHGJJ9B31XWQ5YX8A36C9B` is the protocol treasury and will collect all fees unless changed.

---

## Integration Guide

### JavaScript / TypeScript

Install the required packages:

```bash
npm install @stacks/transactions @stacks/network
```

### Stacks.js Full Example

```typescript
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  Cl,
  listCV,
  tupleCV,
  principalCV,
  uintCV,
  stringUtf8CV,
} from "@stacks/transactions";
import { StacksMainnet } from "@stacks/network";

const CONTRACT_ADDRESS = "SP..."; // deployed contract address
const CONTRACT_NAME    = "batchpay";
const PAYER_KEY        = "your-private-key-hex";

const network = new StacksMainnet();

// Build the payments list
const payments = listCV([
  tupleCV({
    to:     principalCV("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ"),
    amount: uintCV(1_000_000n),   // 1 STX in microSTX
    name:   stringUtf8CV("Alice"),
  }),
  tupleCV({
    to:     principalCV("SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159"),
    amount: uintCV(2_000_000n),   // 2 STX in microSTX
    name:   stringUtf8CV("Bob"),
  }),
]);

const txOptions = {
  contractAddress: CONTRACT_ADDRESS,
  contractName:    CONTRACT_NAME,
  functionName:    "batch-pay",
  functionArgs:    [payments],
  senderKey:       PAYER_KEY,
  network,
  anchorMode:      AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
};

const tx = await makeContractCall(txOptions);
const result = await broadcastTransaction(tx, network);
console.log("Transaction ID:", result.txid);
```

> **Post Conditions:** It is strongly recommended to add STX post conditions to the transaction to assert the exact amount that will leave the payer's wallet. Use `PostConditionMode.Deny` in production and specify a `STXPostCondition` for `total + fee`.

### Reading Batch History

```typescript
import { callReadOnlyFunction, cvToValue } from "@stacks/transactions";
import { StacksMainnet } from "@stacks/network";

const network = new StacksMainnet();

// Get total batch count for a payer
const countResult = await callReadOnlyFunction({
  contractAddress: CONTRACT_ADDRESS,
  contractName:    CONTRACT_NAME,
  functionName:    "get-batch-count",
  functionArgs:    [principalCV("SP...")],
  network,
  senderAddress:   "SP...",
});
const count = cvToValue(countResult); // number

// Fetch a specific batch record
const batchResult = await callReadOnlyFunction({
  contractAddress: CONTRACT_ADDRESS,
  contractName:    CONTRACT_NAME,
  functionName:    "get-batch",
  functionArgs:    [principalCV("SP..."), uintCV(1n)],
  network,
  senderAddress:   "SP...",
});
const batch = cvToValue(batchResult);
// batch.value = { recipients, amounts, names, timestamp, total, fee }
```

### Indexer Integration

Subscribe to contract events using the Hiro API or a Stacks indexer such as Chainhook:

```json
// chainhook predicate example
{
  "name": "batchpay-events",
  "version": 1,
  "chain": "stacks",
  "networks": {
    "mainnet": {
      "start_block": 100000,
      "expire_after_occurrence": null,
      "if_this": {
        "scope": "print_event",
        "contract_identifier": "SP....batchpay",
        "contains": "batch-paid-stx"
      },
      "then_that": {
        "http_post": {
          "url": "https://your-backend.com/webhooks/batchpay",
          "authorization_header": "Bearer your-token"
        }
      }
    }
  }
}
```

Each webhook payload will contain the decoded print event including payer, batch ID, all recipient addresses and amounts, and the total and fee values.

---

## Testing

The test suite is written in TypeScript using Vitest and the Clarinet SDK. Tests execute against a local simnet — no running node is required.

### Test Structure

```
tests/batchpay.test.ts
 |
 +-- Employee Management
 |     add-employee marks recipient as active
 |     remove-employee marks recipient as inactive
 |     is-employee returns false for unknown address
 |
 +-- batch-pay: happy path
 |     pays two employees and verifies STX balances
 |     auto-registers recipients into employee map
 |     increments batch counter after each call
 |     stores correct recipients, total, and fee in history
 |     accepts a single-recipient batch
 |     fee is exactly 0.5% of total payout
 |
 +-- batch-pay: error cases
 |     ERR_LENGTH (u101) on empty list
 |     ERR_AMOUNT (u102) on zero amount entry
 |     ERR_RECIPIENT (u103) on self-payment
 |     transfer failure on insufficient balance
 |
 +-- Read functions
 |     get-batch-count returns 0 for new payer
 |     get-batch returns none for non-existent batch ID
 |     get-treasury returns a valid principal
 |
 +-- set-treasury
       current treasury can update the address
       non-treasury caller receives err u403
```

### Running Tests

```bash
# Run the full test suite
clarinet test

# Run with verbose output
clarinet test --reporter verbose

# Run a specific test file
clarinet test tests/batchpay.test.ts
```

### Test Coverage

| Area | Tests | Status |
|---|---|---|
| Employee registration | 3 | Covered |
| Batch pay success | 6 | Covered |
| Batch pay errors | 4 | Covered |
| Read-only queries | 3 | Covered |
| Treasury management | 2 | Covered |
| **Total** | **18** | **All passing** |

> **Treasury address note:** The hardcoded treasury in the contract (`SPGDS0Y17973EN5TCHNHGJJ9B31XWQ5YX8A36C9B`) will not match simnet's `deployer` address. To test `set-treasury` auth correctly, either change the `define-data-var treasury` default to the simnet deployer address, or call `set-treasury` in a setup step to reassign it before running auth tests.

---

## Security Considerations

**No fund custody.** The contract never holds STX. All transfers happen directly from `tx-sender` to recipients within the same execution context. There is no deposit, lock, or withdrawal pattern.

**Atomic execution.** The use of `fold` with `try!` means any single failed transfer reverts the entire transaction. Partial payments are not possible.

**Self-payment guard.** The `validate-and-add` function asserts that no entry in the payments list targets `tx-sender`. This prevents a payer from routing funds back to themselves within a batch to game the employee registry.

**Treasury access control.** The `set-treasury` function is gated on `(is-eq tx-sender (var-get treasury))`. Only the current treasury can rotate the address. There is no owner, admin, or deployer override — if access to the treasury wallet is lost, the address cannot be changed.

**Integer arithmetic.** Fee calculation uses integer division, which rounds down. The rounding difference is absorbed by the payer and neither enriches nor disadvantages recipients.

**No reentrancy risk.** Clarity does not support dynamic dispatch or callbacks, and contracts cannot call back into themselves. Reentrancy is not a concern in this execution model.

**Batch size cap.** The `MAX_BATCH` constant of `u60` prevents excessively large transactions that could approach block size limits or cause unexpected gas costs.

---

## Known Limitations

**STX only.** The contract does not support SIP-010 fungible tokens. A separate contract would be needed for token payroll.

**No partial batch recovery.** If one recipient address causes a transfer failure, the entire batch reverts. The payer must correct the problematic entry and resubmit.

**Employee map is append-friendly only at the contract level.** Removing an employee from the map does not prevent them from being re-added automatically on the next `batch-pay` that includes their address.

**History is append-only.** There is no function to delete or amend a historical batch record. On-chain records are permanent.

**No pagination on history.** `get-batch` retrieves one batch at a time by ID. Clients that need to display full history must iterate from `u1` to `get-batch-count` and call `get-batch` for each.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and ensure `clarinet check` passes
4. Run the full test suite: `clarinet test`
5. Open a pull request with a clear description of the change

Please include tests for any new public functions and update this README if the contract interface changes.

---

## License

MIT License. See `LICENSE` for full terms.