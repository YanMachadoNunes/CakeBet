"use client";

// Carteira do CakeBet: um saldo fictício único para todos os jogos,
// salvo no navegador. Nenhum dinheiro real entra ou sai.

import { useEffect, useState } from "react";

const WALLET_KEY = "cakebet:wallet";
const LEGACY_KEY = "sugar-rush:balance"; // saldo antigo do Sugar Rush sozinho
const DAILY_KEY = "cakebet:daily";
const CHANGE_EVENT = "cakebet:wallet";

export const START_BALANCE = 1000;
export const DAILY_BONUS = 500;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function readBalance(): number {
  try {
    let raw = localStorage.getItem(WALLET_KEY);
    // Migra o saldo de quem já jogava o Sugar Rush antes do lobby existir
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        localStorage.setItem(WALLET_KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        raw = legacy;
      }
    }
    const n = Number(raw);
    return raw !== null && Number.isFinite(n) && n >= 0 ? n : START_BALANCE;
  } catch {
    return START_BALANCE;
  }
}

export function writeBalance(n: number) {
  try {
    localStorage.setItem(WALLET_KEY, String(Math.round(n * 100) / 100));
    // Avisa outros componentes da mesma aba (o evento "storage" só chega em outras abas)
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {}
}

export function addBalance(delta: number) {
  writeBalance(readBalance() + delta);
}

/** Saldo reativo: atualiza se mudar nesta aba ou em outra. `null` antes de montar. */
export function useWallet() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setBalance(readBalance());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);
  return balance;
}

/** Milissegundos até o bônus diário liberar (0 = já pode resgatar) */
export function dailyBonusWait(): number {
  try {
    const last = Number(localStorage.getItem(DAILY_KEY) ?? 0);
    return Math.max(0, last + DAY_MS - Date.now());
  } catch {
    return 0;
  }
}

export function claimDailyBonus(): boolean {
  if (dailyBonusWait() > 0) return false;
  try {
    localStorage.setItem(DAILY_KEY, String(Date.now()));
  } catch {
    return false;
  }
  addBalance(DAILY_BONUS);
  return true;
}
