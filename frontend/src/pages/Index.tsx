import { Toaster } from 'react-hot-toast';
import { Zap } from 'lucide-react';
import { useStacksWallet } from '@/hooks/useStacksWallet';
import { useContractReads } from '@/hooks/useContractReads';
import ConnectWallet from '@/components/ConnectWallet';
import NetworkSwitcher from '@/components/NetworkSwitcher';
import BatchPaymentForm from '@/components/BatchPaymentForm';
import HistoryList from '@/components/HistoryList';

const Index = () => {
  const { address, balance, network, setNetwork, connect, disconnect, loading } = useStacksWallet();
  const { batches, batchCount, loading: historyLoading, refresh } = useContractReads(address, network);

  return (
    <div className="min-h-screen bg-background">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-display)',
            borderRadius: '0.75rem',
          },
        }}
      />

      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="gradient-orange flex h-8 w-8 items-center justify-center rounded-lg">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">BatchPay</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NetworkSwitcher network={network} onChange={setNetwork} />
            <ConnectWallet
              address={address}
              balance={balance}
              loading={loading}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        {!address ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="gradient-orange mb-6 flex h-16 w-16 items-center justify-center rounded-2xl animate-pulse-orange">
              <Zap className="h-9 w-9 text-primary-foreground" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Stacks BatchPay</h1>
            <p className="mb-8 max-w-md text-muted-foreground">
              Send STX to multiple recipients in a single transaction. Fast, cheap, and on-chain.
            </p>
            <button
              onClick={connect}
              className="gradient-orange rounded-lg px-8 py-3 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Connect Wallet to Get Started
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <BatchPaymentForm address={address} network={network} onSuccess={refresh} />
            <HistoryList
              batches={batches}
              batchCount={batchCount}
              loading={historyLoading}
              onRefresh={refresh}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          0.5% fee collected by treasury · Built on Stacks
        </p>
      </footer>
    </div>
  );
};

export default Index;
