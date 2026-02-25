import { useState, useEffect, useCallback } from 'react';
import type { NetworkMode, BatchRecord } from '@/types/contract';
import { fetchBatchCount, fetchBatch } from '@/lib/stacks-client';

export function useContractReads(address: string | null, network: NetworkMode) {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchCount, setBatchCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!address) {
      setBatches([]);
      setBatchCount(0);
      return;
    }
    setLoading(true);
    try {
      const count = await fetchBatchCount(address, network);
      setBatchCount(count);
      const limit = Math.min(count, 10);
      const promises: Promise<BatchRecord | null>[] = [];
      for (let i = count; i > count - limit && i > 0; i--) {
        promises.push(fetchBatch(address, i, network));
      }
      const results = await Promise.all(promises);
      setBatches(results.filter((b): b is BatchRecord => b !== null));
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { batches, batchCount, loading, refresh };
}
