import type { Metadata } from "next";
import { Fraunces, Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

const candyFont = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-candy" });
const bodyFont = Nunito({ subsets: ["latin"], variable: "--font-body" });
// Serifada "macia" pros títulos do CakeBet (eixos SOFT/WONK dão o ar artesanal)
const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "CakeBet",
  description: "Cassino de mentirinha com créditos fictícios — jogue Sugar Rush e mais.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${candyFont.variable} ${bodyFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
