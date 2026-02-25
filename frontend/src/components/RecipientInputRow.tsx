import { Trash2 } from 'lucide-react';
import type { PaymentEntry } from '@/types/contract';
import { isValidPrincipal } from '@/lib/stacks-client';

interface Props {
  index: number;
  entry: PaymentEntry;
  onChange: (index: number, entry: PaymentEntry) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export default function RecipientInputRow({ index, entry, onChange, onRemove, canRemove }: Props) {
  const invalidPrincipal = entry.to.length > 0 && !isValidPrincipal(entry.to);
  const invalidAmount = entry.amount.length > 0 && (isNaN(Number(entry.amount)) || Number(entry.amount) <= 0);

  return (
    <div className="flex items-start gap-2 animate-fade-in py-2 sm:py-0 border-b sm:border-b-0 border-border/50 last:border-0">
      <span className="mt-3 w-6 shrink-0 text-center text-xs font-mono text-muted-foreground hidden sm:block">
        {index + 1}
      </span>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row w-full">
        <div className="flex items-center gap-2 sm:hidden">
          <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
          <span className="text-xs text-muted-foreground">Recipient</span>
        </div>
        <input
          type="text"
          placeholder="Recipient principal (SP…)"
          value={entry.to}
          onChange={(e) => onChange(index, { ...entry, to: e.target.value.trim() })}
          className={`w-full flex-[2] rounded-lg border bg-card px-3 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring ${
            invalidPrincipal ? 'border-destructive' : 'border-border'
          }`}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Amount (STX)"
          value={entry.amount}
          onChange={(e) => onChange(index, { ...entry, amount: e.target.value })}
          className={`w-full sm:w-32 rounded-lg border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring ${
            invalidAmount ? 'border-destructive' : 'border-border'
          }`}
        />
        <input
          type="text"
          placeholder="Name / Note"
          maxLength={64}
          value={entry.name}
          onChange={(e) => onChange(index, { ...entry, name: e.target.value })}
          className="w-full sm:w-40 rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </div>
      <button
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        className="mt-2.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
