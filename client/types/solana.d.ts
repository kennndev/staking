// Solana wallet types
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isConnected?: boolean;
      connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
      disconnect: () => Promise<void>;
      on: (event: string, callback: (args: any) => void) => void;
      off: (event: string, callback: (args: any) => void) => void;
      signTransaction: (transaction: any) => Promise<any>;
      signAllTransactions: (transactions: any[]) => Promise<any[]>;
    };
  }
}

export {};
