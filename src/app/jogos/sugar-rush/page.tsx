import type { Metadata } from "next";
import Game from "@/components/Game";

export const metadata: Metadata = {
  title: "Sugar Rush · CakeBet",
};

export default function SugarRushPage() {
  return <Game />;
}
