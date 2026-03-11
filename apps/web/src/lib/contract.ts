import { getAddress } from "viem";

export const electionAbi = [
  {
    type: "function",
    name: "voteKetum",
    stateMutability: "nonpayable",
    inputs: [{ name: "candidateId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "voteWaketum",
    stateMutability: "nonpayable",
    inputs: [{ name: "candidateId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "getKetumCandidates",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getWaketumCandidates",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getResults",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "ketumResult",
        type: "tuple[]",
        components: [
          { name: "candidateId", type: "uint256" },
          { name: "votes", type: "uint256" }
        ]
      },
      {
        name: "waketumResult",
        type: "tuple[]",
        components: [
          { name: "candidateId", type: "uint256" },
          { name: "votes", type: "uint256" }
        ]
      }
    ]
  }
] as const;

export const electionAddress = getAddress(
  process.env.NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000001"
);
