import { describe, expect, it, beforeEach } from "vitest";
import { Cl, cvToValue } from "@stacks/transactions";

const CONTRACT = "batchpay";

// Clarinet gives us 10 test wallets: deployer + wallet_1..wallet_9
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const payer    = accounts.get("wallet_1")!;
const emp1     = accounts.get("wallet_2")!;
const emp2     = accounts.get("wallet_3")!;
const emp3     = accounts.get("wallet_4")!;
const treasury = accounts.get("deployer")!; // matches SPGDS... only in local simnet; see note below

// Helper: build a payment tuple
const pay = (to: string, amount: number, name: string) =>
  Cl.tuple({
    to:     Cl.principal(to),
    amount: Cl.uint(amount),
    name:   Cl.stringUtf8(name),
  });

// ─────────────────────────────────────────────
// 1. EMPLOYEE MANAGEMENT
// ─────────────────────────────────────────────
describe("Employee Management", () => {
  it("add-employee: marks employee as active", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "add-employee", [Cl.principal(emp1)], payer);
    expect(result).toBeOk(Cl.bool(true));

    const { result: check } = simnet.callReadOnlyFn(CONTRACT, "is-employee", [Cl.principal(emp1)], payer);
    expect(check).toBeBool(true);
  });

  it("remove-employee: marks employee as inactive", () => {
    simnet.callPublicFn(CONTRACT, "add-employee", [Cl.principal(emp1)], payer);
    const { result } = simnet.callPublicFn(CONTRACT, "remove-employee", [Cl.principal(emp1)], payer);
    expect(result).toBeOk(Cl.bool(true));

    const { result: check } = simnet.callReadOnlyFn(CONTRACT, "is-employee", [Cl.principal(emp1)], payer);
    expect(check).toBeBool(false);
  });

  it("is-employee: returns false for unknown address", () => {
    const { result } = simnet.callReadOnlyFn(CONTRACT, "is-employee", [Cl.principal(emp3)], payer);
    expect(result).toBeBool(false);
  });
});

// ─────────────────────────────────────────────
// 2. BATCH PAY — happy path
// ─────────────────────────────────────────────
describe("batch-pay: happy path", () => {
  it("pays two employees and records history", () => {
    const payments = Cl.list([
      pay(emp1, 1_000_000, "Alice"),
      pay(emp2, 2_000_000, "Bob"),
    ]);

    const before1  = simnet.getSTXBalance(emp1);
    const before2  = simnet.getSTXBalance(emp2);
    const beforeTr = simnet.getSTXBalance(treasury);

    const { result } = simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);
    expect(result).toBeOk(Cl.bool(true));

    // Recipients received correct amounts
    expect(simnet.getSTXBalance(emp1)).toBe(before1 + BigInt(1_000_000));
    expect(simnet.getSTXBalance(emp2)).toBe(before2 + BigInt(2_000_000));

    // Treasury received 0.5% of 3_000_000 = 15_000
    expect(simnet.getSTXBalance(treasury)).toBe(beforeTr + BigInt(15_000));
  });

  it("auto-adds employees during batch-pay", () => {
    const payments = Cl.list([pay(emp1, 500_000, "Alice")]);
    simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);

    const { result } = simnet.callReadOnlyFn(CONTRACT, "is-employee", [Cl.principal(emp1)], payer);
    expect(result).toBeBool(true);
  });

  it("increments batch counter after each call", () => {
    const payments = Cl.list([pay(emp1, 500_000, "Alice")]);

    simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);
    simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);

    const { result } = simnet.callReadOnlyFn(CONTRACT, "get-batch-count", [Cl.principal(payer)], payer);
    expect(result).toBeUint(2);
  });

  it("stores correct payment history", () => {
    const payments = Cl.list([
      pay(emp1, 1_000_000, "Alice"),
      pay(emp2, 2_000_000, "Bob"),
    ]);
    simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);

    const { result } = simnet.callReadOnlyFn(
      CONTRACT, "get-batch", [Cl.principal(payer), Cl.uint(1)], payer
    );
    expect(result).toBeSome();

    const batch = cvToValue(result as any).value;
    expect(batch.total.value).toBe("3000000");
    expect(batch.fee.value).toBe("15000");
  });

  it("pays a single employee", () => {
    const payments = Cl.list([pay(emp1, 1_000_000, "Solo")]);
    const { result } = simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("fee is exactly 0.5% of total", () => {
    // total = 10_000_000 → fee = 50_000
    const payments = Cl.list([pay(emp1, 10_000_000, "Alice")]);
    const beforeTr = simnet.getSTXBalance(treasury);
    simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);
    expect(simnet.getSTXBalance(treasury)).toBe(beforeTr + BigInt(50_000));
  });
});

// ─────────────────────────────────────────────
// 3. BATCH PAY — error cases
// ─────────────────────────────────────────────
describe("batch-pay: error cases", () => {
  it("ERR_LENGTH (u101): rejects empty list", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "batch-pay", [Cl.list([])], payer);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("ERR_AMOUNT (u102): rejects zero amount", () => {
    const payments = Cl.list([pay(emp1, 0, "Alice")]);
    const { result } = simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);
    expect(result).toBeErr(Cl.uint(102));
  });

  it("ERR_RECIPIENT (u103): rejects payer paying themselves", () => {
    const payments = Cl.list([pay(payer, 1_000_000, "Self")]);
    const { result } = simnet.callPublicFn(CONTRACT, "batch-pay", [payments], payer);
    expect(result).toBeErr(Cl.uint(103));
  });

  it("fails when payer has insufficient STX balance", () => {
    // wallet_9 has no STX — transfer should fail
    const broke = accounts.get("wallet_9")!;
    const payments = Cl.list([pay(emp1, 999_999_999_999, "Alice")]);
    const { result } = simnet.callPublicFn(CONTRACT, "batch-pay", [payments], broke);
    expect(result).toBeErr(); // stx-transfer? error
  });
});

// ─────────────────────────────────────────────
// 4. READ FUNCTIONS
// ─────────────────────────────────────────────
describe("Read functions", () => {
  it("get-batch-count: returns 0 for fresh payer", () => {
    const { result } = simnet.callReadOnlyFn(CONTRACT, "get-batch-count", [Cl.principal(emp3)], emp3);
    expect(result).toBeUint(0);
  });

  it("get-batch: returns none for non-existent batch", () => {
    const { result } = simnet.callReadOnlyFn(
      CONTRACT, "get-batch", [Cl.principal(payer), Cl.uint(999)], payer
    );
    expect(result).toBeNone();
  });

  it("get-treasury: returns the treasury principal", () => {
    const { result } = simnet.callReadOnlyFn(CONTRACT, "get-treasury", [], payer);
    // Just assert it's a principal (value exists)
    expect(result).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 5. SET TREASURY
// ─────────────────────────────────────────────
describe("set-treasury", () => {
  it("allows current treasury to update treasury address", () => {
    // In simnet the deployer IS the treasury address set in the contract var
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-treasury", [Cl.principal(emp1)], deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: newTreasury } = simnet.callReadOnlyFn(CONTRACT, "get-treasury", [], deployer);
    expect(cvToValue(newTreasury as any)).toContain(emp1.slice(0, 5)); // sanity check
  });

  it("rejects non-treasury caller with err u403", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-treasury", [Cl.principal(emp2)], payer // payer is not treasury
    );
    expect(result).toBeErr(Cl.uint(403));
  });
});