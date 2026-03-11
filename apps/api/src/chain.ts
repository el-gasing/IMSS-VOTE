import { createPublicClient, createWalletClient, defineChain, http, isAddress, getAddress, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env.js";

const abi = [
  {
    type: "function",
    name: "setWhitelistBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "voters", type: "address[]" },
      { name: "allowed", type: "bool" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "voteByKey",
    stateMutability: "nonpayable",
    inputs: [
      { name: "voterKey", type: "bytes32" },
      { name: "ketumCandidateId", type: "uint256" },
      { name: "waketumCandidateId", type: "uint256" }
    ],
    outputs: []
  }
] as const;

const account = privateKeyToAccount(env.ADMIN_SIGNER_KEY as `0x${string}`);
const transport = http(env.RPC_URL);
const chain = defineChain({
  id: env.CHAIN_ID,
  name: `evm-${env.CHAIN_ID}`,
  network: `evm-${env.CHAIN_ID}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [env.RPC_URL] },
    public: { http: [env.RPC_URL] }
  }
});

const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ chain, transport, account });

export async function whitelistOnChain(wallets: string[]): Promise<string> {
  if (!wallets.length) {
    throw new Error("No wallets to whitelist");
  }

  const normalized = wallets.map((w) => {
    if (!isAddress(w)) {
      throw new Error(`Invalid wallet address: ${w}`);
    }
    return getAddress(w);
  });

  const hash = await walletClient.writeContract({
    address: getAddress(env.ELECTION_CONTRACT_ADDRESS),
    abi,
    functionName: "setWhitelistBatch",
    args: [normalized, true],
    account,
    chain
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function castVoteByUserSubOnChain(
  userSub: string,
  ketumCandidateId: bigint,
  waketumCandidateId: bigint
): Promise<string> {
  const normalizedSub = userSub.trim().toLowerCase();
  if (!normalizedSub) {
    throw new Error("Invalid user subject");
  }

  const voterKey = keccak256(stringToHex(normalizedSub));
  const hash = await walletClient.writeContract({
    address: getAddress(env.ELECTION_CONTRACT_ADDRESS),
    abi,
    functionName: "voteByKey",
    args: [voterKey, ketumCandidateId, waketumCandidateId],
    account,
    chain
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
