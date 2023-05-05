// src/utils/updateTotalStakedBalances.ts

import { BigNumber } from "bignumber.js";

export function updateTotalStakedBalances(stakedBalances: { [address: string]: string }, totalStakedBalances: { [address: string]: string }): void {
    for (const key in stakedBalances) {
      const value = stakedBalances[key];
      if (totalStakedBalances[key]) {
        const existingBalance = new BigNumber(totalStakedBalances[key]);
        const newBalance = existingBalance.plus(value);
        totalStakedBalances[key] = newBalance.toString();
      } else {
        totalStakedBalances[key] = value;
      }
    }
  }