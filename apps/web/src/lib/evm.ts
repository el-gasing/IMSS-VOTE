import { createPublicClient, createWalletClient, custom, defineChain, http } from "viem";
import { electionAbi, electionAddress } from "@/lib/contract";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const chainIdRaw = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
const chainId = Number.isInteger(chainIdRaw) && chainIdRaw > 0 ? chainIdRaw : 11155111;
const appChain = defineChain({
  id: chainId,
  name: `evm-${chainId}`,
  network: `evm-${chainId}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] }
  }
});

export const publicClient = createPublicClient({
  chain: appChain,
  transport: http(rpcUrl)
});

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("Wallet provider not found");
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  return accounts[0];
}

export async function currentWallet(): Promise<string | null> {
  if (!window.ethereum) return null;
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  return accounts[0] || null;
}

export async function signBindMessage(message: string, wallet: string): Promise<string> {
  if (!window.ethereum) throw new Error("Wallet provider not found");
  const sig = (await window.ethereum.request({
    method: "personal_sign",
    params: [message, wallet]
  })) as string;
  return sig;
}

export async function voteKetum(candidateId: bigint): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error("Wallet provider not found");
  const walletClient = createWalletClient({ chain: appChain, transport: custom(window.ethereum) });
  const [account] = await walletClient.getAddresses();
  return walletClient.writeContract({
    address: electionAddress,
    abi: electionAbi,
    functionName: "voteKetum",
    args: [candidateId],
    account
  });
}

export async function voteWaketum(candidateId: bigint): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error("Wallet provider not found");
  const walletClient = createWalletClient({ chain: appChain, transport: custom(window.ethereum) });
  const [account] = await walletClient.getAddresses();
  return walletClient.writeContract({
    address: electionAddress,
    abi: electionAbi,
    functionName: "voteWaketum",
    args: [candidateId],
    account
  });
}
