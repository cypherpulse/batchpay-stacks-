import { CONTRACT_PRINCIPALS, CONTRACT_NAME, HIRO_API, type NetworkMode, type BatchRecord } from '@/types/contract';
import { Cl, ClarityType, cvToJSON, fetchCallReadOnlyFunction } from '@stacks/transactions';

export function getContractId(network: NetworkMode) {
  return `${CONTRACT_PRINCIPALS[network]}.${CONTRACT_NAME}`;
}

export function stxToMicro(stx: string | number): bigint {
  return BigInt(Math.round(Number(stx) * 1_000_000));
}

export function microToStx(micro: number | bigint): number {
  return Number(micro) / 1_000_000;
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

export function isValidPrincipal(addr: string): boolean {
  return /^S[TPM][A-Z0-9]{38,50}(\.[a-zA-Z][a-zA-Z0-9-]*)?$/.test(addr);
}

export async function fetchStxBalance(address: string, network: NetworkMode): Promise<number> {
  const res = await fetch(`${HIRO_API[network]}/extended/v1/address/${address}/stx`);
  const data = await res.json();
  return microToStx(Number(data.balance));
}

export async function fetchBatchCount(payer: string, network: NetworkMode): Promise<number> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_PRINCIPALS[network],
      contractName: CONTRACT_NAME,
      functionName: 'get-batch-count',
      functionArgs: [Cl.principal(payer)],
      senderAddress: payer,
      network: network,
    });
    if (result.type === ClarityType.UInt) {
      return Number(result.value);
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function fetchBatch(payer: string, batchId: number, network: NetworkMode): Promise<BatchRecord | null> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_PRINCIPALS[network],
      contractName: CONTRACT_NAME,
      functionName: 'get-batch',
      functionArgs: [Cl.principal(payer), Cl.uint(batchId)],
      senderAddress: payer,
      network: network,
    });

    if (result.type === ClarityType.OptionalNone) return null;

    const json = cvToJSON(result);
    const val = json.value?.value;
    if (!val) return null;

    return {
      batchId,
      amounts: val.amounts.value.map((a: any) => Number(a.value)),
      fee: Number(val.fee.value),
      names: val.names.value.map((n: any) => n.value),
      recipients: val.recipients.value.map((r: any) => r.value),
      timestamp: Number(val.timestamp.value),
      total: Number(val.total.value),
    };
  } catch {
    return null;
  }
}
