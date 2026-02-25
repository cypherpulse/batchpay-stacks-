import { useState, useMemo } from 'react';
import { Plus, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { openContractCall } from '@stacks/connect';
import { Cl, Pc, PostConditionMode } from '@stacks/transactions';
import RecipientInputRow from './RecipientInputRow';
import type { PaymentEntry, NetworkMode } from '@/types/contract';
import { CONTRACT_PRINCIPALS, CONTRACT_NAME, EXPLORER_URL } from '@/types/contract';
import { stxToMicro, isValidPrincipal } from '@/lib/stacks-client';

interface Props {
  address: string;
  network: NetworkMode;
  onSuccess: () => void;
}

const emptyEntry = (): PaymentEntry => ({ to: '', amount: '', name: '' });

export default function BatchPaymentForm({ address, network, onSuccess }: Props) {
  const [entries, setEntries] = useState<PaymentEntry[]>([emptyEntry()]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (index: number, entry: PaymentEntry) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? entry : e)));
  };

  const handleRemove = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    if (entries.length >= 60) {
      toast.error('Maximum 60 recipients per batch');
      return;
    }
    setEntries((prev) => [...prev, emptyEntry()]);
  };

  const validEntries = useMemo(
    () => entries.filter((e) => isValidPrincipal(e.to) && Number(e.amount) > 0),
    [entries]
  );

  const subtotal = useMemo(
    () => validEntries.reduce((sum, e) => sum + Number(e.amount), 0),
    [validEntries]
  );

  const fee = subtotal * 0.005;
  const total = subtotal + fee;

  const hasDuplicates = useMemo(() => {
    const principals = validEntries.map((e) => e.to);
    return new Set(principals).size !== principals.length;
  }, [validEntries]);

  const canSubmit = validEntries.length > 0 && validEntries.length === entries.length && !hasDuplicates;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Please fix all rows before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const payments = validEntries.map((e) =>
        Cl.tuple({
          to: Cl.principal(e.to),
          amount: Cl.uint(stxToMicro(e.amount)),
          name: Cl.stringUtf8(e.name || ' '),
        })
      );

      const totalMicro = stxToMicro(total);

      await openContractCall({
        contractAddress: CONTRACT_PRINCIPALS[network],
        contractName: CONTRACT_NAME,
        functionName: 'batch-pay',
        functionArgs: [Cl.list(payments)],
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          Pc.principal(address).willSendLte(totalMicro).ustx(),
        ],
        network: network,
        onFinish: (data) => {
          toast.success(
            <span>
              Transaction sent!{' '}
              <a
                href={`${EXPLORER_URL}/txid/${data.txId}?chain=${network}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                View →
              </a>
            </span>,
            { duration: 8000 }
          );
          setEntries([emptyEntry()]);
          onSuccess();
        },
        onCancel: () => {
          toast('Transaction cancelled', { icon: '✋' });
        },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
      <h2 className="mb-1 text-xl font-bold text-foreground">Batch Payment</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Send STX to up to 60 recipients in a single transaction
      </p>

      <div className="space-y-2">
        {entries.map((entry, i) => (
          <RecipientInputRow
            key={i}
            index={i}
            entry={entry}
            onChange={handleChange}
            onRemove={handleRemove}
            canRemove={entries.length > 1}
          />
        ))}
      </div>

      {hasDuplicates && (
        <p className="mt-2 text-sm text-destructive">Duplicate recipients detected</p>
      )}

      <button
        onClick={addRow}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Add recipient
      </button>

      {/* Summary */}
      <div className="mt-6 space-y-1.5 rounded-lg bg-muted/50 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal ({validEntries.length} recipients)</span>
          <span className="font-mono font-medium">{subtotal.toFixed(6)} STX</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fee (0.5%)</span>
          <span className="font-mono font-medium">{fee.toFixed(6)} STX</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <span className="font-semibold text-foreground">Total</span>
          <span className="font-mono font-bold text-foreground">{total.toFixed(6)} STX</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="gradient-orange mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
        {submitting ? 'Submitting…' : 'Send Batch Payment'}
      </button>
    </div>
  );
}
