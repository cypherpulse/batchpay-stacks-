export interface PaymentEntry {
  to: string;
  amount: string; // decimal STX
  name: string;
}

export interface BatchRecord {
  batchId: number;
  amounts: number[]; // microSTX values
  fee: number;
  names: string[];
  recipients: string[];
  timestamp: number;
  total: number;
}

export type NetworkMode = 'mainnet' | 'testnet';

export const CONTRACT_PRINCIPALS: Record<NetworkMode, string> = {
  mainnet: 'SPGDS0Y17973EN5TCHNHGJJ9B31XWQ5YX8A36C9B',
  testnet: 'STGDS0Y17973EN5TCHNHGJJ9B31XWQ5YXBQ0KQ2Y',
};

export const CONTRACT_NAME = 'batchpay';

export const HIRO_API: Record<NetworkMode, string> = {
  mainnet: 'https://api.mainnet.hiro.so',
  testnet: 'https://api.testnet.hiro.so',
};

export const EXPLORER_URL = 'https://explorer.hiro.so';
