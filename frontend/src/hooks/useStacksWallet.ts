import { useState, useEffect, useCallback } from 'react';
import { showConnect } from '@stacks/connect';
import type { NetworkMode } from '@/types/contract';
import { fetchStxBalance } from '@/lib/stacks-client';

const NETWORK_KEY = 'stacks-batchpay-network';

// Helper to clear corrupted session data
const clearCorruptedSession = () => {
  try {
    const sessionData = localStorage.getItem('blockstack-session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      // Check if version is missing or undefined, which causes the specific error
      if (parsed.version === undefined) {
        console.warn('Clearing corrupted session data (missing version)');
        localStorage.removeItem('blockstack-session');
      }
    }
  } catch (e) {
    // If JSON parse fails, data is corrupted
    console.warn('Clearing corrupted session data (parse error)');
    localStorage.removeItem('blockstack-session');
  }
};

export function useStacksWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [network, setNetworkState] = useState<NetworkMode>(() => {
    return (localStorage.getItem(NETWORK_KEY) as NetworkMode) || 'mainnet';
  });
  const [loading, setLoading] = useState(false);

  // Check for corrupted session on mount
  useEffect(() => {
    clearCorruptedSession();
  }, []);

  const setNetwork = useCallback((n: NetworkMode) => {
    setNetworkState(n);
    localStorage.setItem(NETWORK_KEY, n);
    setBalance(null);
  }, []);

  const connect = useCallback(() => {
    clearCorruptedSession(); // Ensure session is clean before connecting
    showConnect({
      appDetails: {
        name: 'Stacks BatchPay',
        icon: '/favicon.ico',
      },
      onFinish: (data) => {
        const addr = data.authResponsePayload.profile.stxAddress;
        const selected = network === 'mainnet' ? addr.mainnet : addr.testnet;
        setAddress(selected);
      },
      onCancel: () => {},
    });
  }, [network]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
  }, []);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetchStxBalance(address, network)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [address, network]);

  return { address, balance, network, setNetwork, connect, disconnect, loading };
}
