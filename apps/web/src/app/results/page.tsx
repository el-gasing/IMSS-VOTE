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
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-white/15 bg-black/35 p-6 shadow-soft">
        <h1 className="text-3xl font-bold text-[#f2d493]">Hasil Voting On-Chain</h1>

        <h2 className="mt-6 text-lg font-semibold">Ketua Umum</h2>
        <div className="mt-2 space-y-1 text-sm text-white/85">
          {ketum.map((item) => (
            <p key={item.candidateId.toString()}>
              {ketumMap.get(item.candidateId.toString()) || `ID ${item.candidateId.toString()}`}: {item.votes.toString()} vote
            </p>
          ))}
        </div>

        <h2 className="mt-6 text-lg font-semibold">Wakil Ketua Umum</h2>
        <div className="mt-2 space-y-1 text-sm text-white/85">
          {waketum.map((item) => (
            <p key={item.candidateId.toString()}>
              {waketumMap.get(item.candidateId.toString()) || `ID ${item.candidateId.toString()}`}: {item.votes.toString()} vote
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
