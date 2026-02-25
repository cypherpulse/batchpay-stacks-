import { useState } from 'react';
import { Clock, Loader2, ChevronRight, RefreshCw } from 'lucide-react';
import type { BatchRecord } from '@/types/contract';
import { microToStx } from '@/lib/stacks-client';
import BatchDetailModal from './BatchDetailModal';

interface Props {
  batches: BatchRecord[];
  loading: boolean;
  batchCount: number;
  onRefresh: () => void;
}

export default function HistoryList({ batches, loading, batchCount, onRefresh }: Props) {
  const [selected, setSelected] = useState<BatchRecord | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Payment History</h2>
          <p className="text-sm text-muted-foreground">
            {batchCount} total batch{batchCount !== 1 ? 'es' : ''}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && batches.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading history…
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Clock className="mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No batches yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <button
              key={b.batchId}
              onClick={() => setSelected(b)}
              className="flex w-full items-center justify-between rounded-lg border border-border p-4 text-left transition-all hover:shadow-card-hover hover:border-primary/30"
            >
              <div>
                <p className="font-semibold text-foreground">Batch #{b.batchId}</p>
                <p className="text-sm text-muted-foreground">
                  {b.recipients.length} recipient{b.recipients.length !== 1 ? 's' : ''} · Block {b.timestamp}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground">
                  {microToStx(b.total).toFixed(2)} STX
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <BatchDetailModal batch={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
