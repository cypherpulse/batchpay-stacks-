import type { NetworkMode } from '@/types/contract';

interface Props {
  network: NetworkMode;
  onChange: (n: NetworkMode) => void;
}

export default function NetworkSwitcher({ network, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
      {(['mainnet', 'testnet'] as const).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`rounded-md px-3 py-1.5 font-medium capitalize transition-all ${
            network === n
              ? 'gradient-orange text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
