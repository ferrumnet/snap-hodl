// src/services/stakingService.ts

import TradingSnapshot from "../models/TradingSnapshot";
import SnapHodlConfigBalanceModel from "../models/SnapHodlConfigBalance";

export async function getLatestTradingSnapshot(
  liquidityPoolAddress: string,
  tokenContractAddress: string,
  chainId: string
): Promise<any | null> {
  let snapshot = null;
  try {
    console.log(
      "Fetching the latest trading snapshot from the database",
      liquidityPoolAddress,
      tokenContractAddress,
      chainId
    );

    const filter = {
      liquidityPoolAddress,
      tokenContractAddress,
      chainId,
    };

    snapshot = await TradingSnapshot.findOne(filter);
  } catch (err) {
    console.error(
      "Error fetching the latest trading snapshot from the database:",
      err
    );
  }
  return snapshot;
}

export async function saveTradingSnapshot(
  tradingPoolName: string,
  liquidityPoolAddress: string,
  tradingPoolType: string,
  tokenContractAddress: string,
  chainId: string,
  latestBlockCaptured: number,
  uniqueTraders: string[],
  tradesVolumeBalances: { [key: string]: any }
) {
  try {
    const snapshot = {
      tradingPoolName,
      liquidityPoolAddress,
      tradingPoolType,
      tokenContractAddress,
      chainId,
      latestBlockCaptured,
      uniqueTraders,
      timestamp: new Date(),
      tradesVolumeBalances,
    };

    const filter = {
      liquidityPoolAddress,
      tokenContractAddress,
      chainId,
    };

    const update = {
      $set: snapshot,
    };

    const options = {
      upsert: true,
    };

    await TradingSnapshot.updateOne(filter, update, options);
  } catch (err) {
    console.error("Error saving staking snapshot to the database:", err);
  }
}

export async function saveTradedBalances(
  liquidityPoolAddress: string,
  tokenContractAddress: string,
  chainId: string,
  totalTradingVolumeBalance: { [stakerAddress: string]: string }
) {
  try {
    const filter = {
      liquidityPoolAddress,
      tokenContractAddress,
      chainId,
    };

    const update = {
      $set: {
        totalTradingVolumeBalance,
        timestamp: new Date(),
      },
    };

    const options = {
      upsert: true,
    };

    await SnapHodlConfigBalanceModel.updateOne(filter, update, options);
  } catch (err) {
    console.error("Error saving staked balances to the database:", err);
  }
}
