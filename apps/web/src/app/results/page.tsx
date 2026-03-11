"use client";

import { useEffect, useState } from "react";
import { electionAbi, electionAddress } from "@/lib/contract";
import { publicClient } from "@/lib/evm";

interface ResultItem {
  candidateId: bigint;
  votes: bigint;
}

interface Candidate {
  id: bigint;
  name: string;
}

export default function ResultsPage() {
  const [ketum, setKetum] = useState<ResultItem[]>([]);
  const [waketum, setWaketum] = useState<ResultItem[]>([]);
  const [ketumMap, setKetumMap] = useState<Map<string, string>>(new Map());
  const [waketumMap, setWaketumMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function load(): Promise<void> {
      const ketumCandidates = (await publicClient.readContract({
        address: electionAddress,
        abi: electionAbi,
        functionName: "getKetumCandidates"
      })) as Candidate[];

      const waketumCandidates = (await publicClient.readContract({
        address: electionAddress,
        abi: electionAbi,
        functionName: "getWaketumCandidates"
      })) as Candidate[];

      const [ketumResult, waketumResult] = (await publicClient.readContract({
        address: electionAddress,
        abi: electionAbi,
        functionName: "getResults"
      })) as [ResultItem[], ResultItem[]];

      setKetum(ketumResult);
      setWaketum(waketumResult);
      setKetumMap(new Map(ketumCandidates.map((c) => [c.id.toString(), c.name])));
      setWaketumMap(new Map(waketumCandidates.map((c) => [c.id.toString(), c.name])));
    }

    load().catch(() => undefined);
  }, []);

  return (
    <div className="card">
      <h1>Hasil Voting On-Chain</h1>

      <h2>Ketua Umum</h2>
      {ketum.map((item) => (
        <p key={item.candidateId.toString()}>
          {ketumMap.get(item.candidateId.toString()) || `ID ${item.candidateId.toString()}`}: {item.votes.toString()} vote
        </p>
      ))}

      <h2>Wakil Ketua Umum</h2>
      {waketum.map((item) => (
        <p key={item.candidateId.toString()}>
          {waketumMap.get(item.candidateId.toString()) || `ID ${item.candidateId.toString()}`}: {item.votes.toString()} vote
        </p>
      ))}
    </div>
  );
}
