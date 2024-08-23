import BN from "bn.js";
import { MintInfo, u64 } from "@solana/spl-token";

export type Truthy<T> = T extends false | "" | 0 | null | undefined ? never : T; // from lodash

export const truthy = <T>(value: any): any => !!value;

export function toNumber(numberOrBn: any, mint: any): any {
  if (BN.isBN(numberOrBn)) {
    // @ts-ignore
    return amountAsNum(numberOrBn, mint);
  } else {
    return numberOrBn;
  }
}

export function amountAsNum(amount: any, mint: any): any {
  const decimals = new u64(Math.pow(10, mint.decimals).toString());
  const decimal = amount.mod(decimals).toNumber() / decimals.toNumber();
  return amount.div(decimals).toNumber() + decimal;
}

export function toBN(
  numberOrBn: any,
  mintOrDecimals: any
): any {
  const decimals: number =
    typeof mintOrDecimals === "number"
      ? mintOrDecimals
      : (mintOrDecimals as MintInfo).decimals;

  if (BN.isBN(numberOrBn)) {
    return numberOrBn;
  } else {
    return new BN(
      Math.ceil(Number(numberOrBn) * Math.pow(10, decimals)).toLocaleString(
        "fullwide",
        { useGrouping: false }
      )
    );
  }
}

export function supplyAsNum(mint: any): any {
  return amountAsNum(mint.supply, mint);
}

export function numberWithCommas(x: any, decimals: any = 4): any {
  return roundToDecimals(x, decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
}

export function roundToDecimals(num: any, decimals: any): any {
  return Math.trunc(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function humanReadable(bn: any, mint: any): any {
  return numberWithCommas(
    roundToDecimals(toNumber(bn, mint), mint.decimals)
  );
}
