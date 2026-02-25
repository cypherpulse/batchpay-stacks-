import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { truncateAddress } from '@/lib/stacks-client';

interface Props {
  address: string | null;
  balance: number | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function ConnectWallet({ address, balance, loading, onConnect, onDisconnect }: Props) {
  if (!address) {
    return (
      <button
        onClick={onConnect}
        className="gradient-orange flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
        <span className="font-mono text-muted-foreground">{truncateAddress(address)}</span>
        {loading ? (
          <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
        ) : balance !== null ? (
          <span className="ml-2 font-semibold text-foreground">{balance.toFixed(2)} STX</span>
        ) : null}
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-lg border border-border bg-card p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Disconnect"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
