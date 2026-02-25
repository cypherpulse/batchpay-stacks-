import { X } from 'lucide-react';
import type { BatchRecord } from '@/types/contract';
import { microToStx, truncateAddress } from '@/lib/stacks-client';

interface Props {
  batch: BatchRecord;
  onClose: () => void;
}

export default function BatchDetailModal({ batch, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Batch #{batch.batchId}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-muted-foreground">Total Sent</p>
            <p className="font-mono font-bold">{microToStx(batch.total).toFixed(6)} STX</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-muted-foreground">Fee Paid</p>
            <p className="font-mono font-bold">{microToStx(batch.fee).toFixed(6)} STX</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-muted-foreground">Recipients</p>
            <p className="font-bold">{batch.recipients.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-muted-foreground">Block Height</p>
            <p className="font-mono font-bold">{batch.timestamp}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Recipients</h4>
          {batch.recipients.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-mono text-foreground">{truncateAddress(r)}</p>
                {batch.names[i] && (
                  <p className="text-xs text-muted-foreground">{batch.names[i]}</p>
                )}
              </div>
              <span className="font-mono font-semibold text-foreground">
                {microToStx(batch.amounts[i]).toFixed(6)} STX
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
