// src/utils/helpers.ts

import {
  SnapHodlConfig,
  SnapHodlConfigBalance,
  StakingContractDataItem,
  TradingVolumeContractDataItem,
} from "../types";
import {
  APP_NAME,
  DB_CONNECTION_STRING,
  DB_NAME,
  DB_COLLECTION_STAKING_SNAPSHOT,
  DB_COLLECTION,
  DB_COLLECTION_SNAP_CONFIG_BALANCE,
  DB_COLLECTION_TRADING_SNAPSHOT,
} from "../config";
import { MongoClient, ObjectId } from "mongodb";
import web3 from "web3";
import BigNumber from "bignumber.js";
import { getRpcUrl } from "./getRpcUrl";
import { AbiItem } from "web3-utils";
import {
  getUniqueStakersFromOpenStaking,
  getOpenStakingStakedBalances,
} from "../openStaking";
import { getUniqueStakers, getStakedBalances } from "../standardStaking";
import { getTokenDecimals } from "./getTokenDecimals";
import { updateTotalStakedBalances } from "./updateTotalStakedBalances";
import tokenContractAbi from "../../ABI/tokenContractAbi.json";
import {
  getLatestTradingSnapshot,
  saveTradedBalances,
  saveTradingSnapshot,
} from "../services/tradingService";

export const getWeb3Instance = (rpcUrl: string | undefined): web3 => {
  if (!rpcUrl) {
    throw new Error("RPC URL is undefined.");
  }
  return new web3(rpcUrl);
};

export const processTradingContractDataItem = async (
  item: TradingVolumeContractDataItem
) => {
  // console.log({ item });
  const rpcUrl = await getRpcUrl(
    item.chainId,
    APP_NAME,
    DB_CONNECTION_STRING!,
    DB_NAME!,
    DB_COLLECTION!
  );
  console.log({ chainId: item.chainId, rpcUrl });
  const web3Instance = getWeb3Instance(rpcUrl);
  const tokenContract = new web3Instance.eth.Contract(
    tokenContractAbi as unknown as AbiItem[],
    item.tokenContractAddress
  );
  const decimals = await tokenContract.methods.decimals().call();
  const existingTradingSnapshot = await getLatestTradingSnapshot(
    item.liquidityPoolAddress,
    item.tokenContractAddress,
    item.chainId
  );
  // console.log({ existingTradingSnapshot });
  let uniqueTraders = new Set<string>(
    existingTradingSnapshot ? existingTradingSnapshot.uniqueTraders : []
  );
  const step = item.blockIterationSize;

  // Convert block identifiers to actual block numbers
  const currentBlockNumber = await web3Instance.eth.getBlockNumber();
  const resolvedFromBlock =
    item.fromBlock === "latest" ? currentBlockNumber : item.fromBlock;
  const resolvedToBlock =
    item.toBlock === "latest" ? currentBlockNumber : item.toBlock;

  let startBlock = resolvedFromBlock;
  if (
    existingTradingSnapshot &&
    existingTradingSnapshot.latestBlockCaptured >= resolvedFromBlock
  ) {
    startBlock = existingTradingSnapshot.latestBlockCaptured + 1;
  }

  for (
    let currentBlock = startBlock;
    currentBlock < resolvedToBlock;
    currentBlock += step
  ) {
    const endBlock = Math.min(currentBlock + step - 1, resolvedToBlock);

    const transferEventSignature = (tokenContract as any)._jsonInterface.find(
      (event: any) => {
        return event.name === "Transfer";
      }
    ).signature;
    const buyTransferEventFilter = {
      fromBlock: 191971146,
      toBlock: currentBlock,
      address: item.tokenContractAddress,
      topics: [
        transferEventSignature,
        web3Instance.eth.abi.encodeParameter(
          "address",
          item.liquidityPoolAddress
        ),
        null,
      ],
    };

    const buyByWalletAddress: { [key: string]: any } = {};

    // console.log("Buy Transfer event filter:", buyTransferEventFilter);
    const buyLogs = await web3Instance.eth.getPastLogs(buyTransferEventFilter);
    // console.log("buyLogs: ", buyLogs);
    buyLogs.forEach((log: any) => {
      // console.log("buy log: ", log);
      const walletAddress = web3Instance.eth.abi.decodeParameter(
        "address",
        log.topics[2]
      );
      uniqueTraders.add(walletAddress.toString());
      // console.log(`Wallet Address: ${walletAddress}`);
      const value = web3.utils.hexToNumberString(log.data);
      // console.log(`Transfer Amount: ${value}`);
      const humanReadableBalance = new BigNumber(value)
        .dividedBy(new BigNumber(10).pow(decimals))
        .toString();
      buyByWalletAddress[`${walletAddress}`] = buyByWalletAddress[
        `${walletAddress}`
      ]
        ? buyByWalletAddress[`${walletAddress}`].plus(humanReadableBalance)
        : new BigNumber(humanReadableBalance);
      // console.log(buyByWalletAddress[`${walletAddress}`]);
    });

    const sellTransferEventFilter = {
      fromBlock: 191971146,
      toBlock: currentBlock,
      address: item.tokenContractAddress,
      topics: [
        transferEventSignature,
        null,
        web3Instance.eth.abi.encodeParameter(
          "address",
          "0x20dDbFd14F316D417f5B1a981B5Dc926a4dFd4D1"
        ),
      ],
    };
    // console.log("Transfer event filter:", sellTransferEventFilter);
    const sellLogs = await web3Instance.eth.getPastLogs(
      sellTransferEventFilter
    );
    // console.log("sellLogs: ", sellLogs);
    sellLogs.forEach((log: any) => {
      // console.log("sell log: ", log);
      const walletAddress = web3Instance.eth.abi.decodeParameter(
        "address",
        log.topics[1]
      );
      console.log(`Wallet Address: ${walletAddress}`);
      uniqueTraders.add(walletAddress.toString());
      const value = web3.utils.hexToNumberString(log.data);
      const humanReadableBalance = new BigNumber(value)
        .dividedBy(new BigNumber(10).pow(decimals))
        .toString();
      buyByWalletAddress[`${walletAddress}`] = buyByWalletAddress[
        `${walletAddress}`
      ]
        ? buyByWalletAddress[`${walletAddress}`].plus(humanReadableBalance)
        : new BigNumber(humanReadableBalance);
      console.log(buyByWalletAddress[`${walletAddress}`].toFixed());
    });
    // console.log(buyByWalletAddress, "buyByWalletAddress");
    // uniqueTraders = new Set([...Object.keys(buyByWalletAddress)]);
    Object.keys(buyByWalletAddress).forEach((address) => {
      buyByWalletAddress[address] = buyByWalletAddress[address].toString();
    });
    // console.log("Unique traders:", uniqueTraders);
    // console.log("Buy and sell value:", buyByWalletAddress);

    await saveTradingSnapshot(
      item.tradingPoolName,
      item.liquidityPoolAddress,
      item.tradingPoolType,
      item.tokenContractAddress,
      item.chainId,
      endBlock,
      Array.from(uniqueTraders),
      buyByWalletAddress
    );
  }
};

export const processStakingContractDataItem = async (
  item: StakingContractDataItem,
  dbName: string,
  collectionName: string,
  connectionString: string,
  appName: string
) => {
  let totalStakedBalances: { [address: string]: string } = {};
  let finalResults: any[] = [];

  const stakingPoolName = item.stakingPoolName;
  const stakingContractAddress = item.stakingContractAddress;
  const stakingPoolType = item.stakingPoolType;
  const tokenContractAddress = item.tokenContractAddress;
  const chainId = item.chainId;
  const fromBlock = item.fromBlock;
  const toBlock = item.toBlock;
  const blockIterationSize = item.blockIterationSize;
  const rpcUrl = await getRpcUrl(
    chainId,
    APP_NAME,
    DB_CONNECTION_STRING!,
    DB_NAME!,
    DB_COLLECTION!
  );

  try {
    const web3Instance = getWeb3Instance(rpcUrl);
    const decimals = await getTokenDecimals(tokenContractAddress, web3Instance);
    console.log("Token decimals:", decimals);

    if (stakingPoolType === "standard") {
      const stakers = await getUniqueStakers(
        stakingPoolName,
        stakingContractAddress,
        stakingPoolType,
        tokenContractAddress,
        chainId,
        web3Instance,
        fromBlock,
        toBlock,
        blockIterationSize,
        DB_NAME!,
        DB_COLLECTION_STAKING_SNAPSHOT!,
        DB_CONNECTION_STRING!
      );
      console.log("Unique staker addresses:", stakers);

      const stakedBalances = await getStakedBalances(
        stakingPoolName,
        stakingContractAddress,
        stakingPoolType,
        tokenContractAddress,
        chainId,
        stakers,
        decimals,
        web3Instance,
        DB_NAME!,
        DB_COLLECTION_STAKING_SNAPSHOT!,
        DB_CONNECTION_STRING!
      );
      console.log("Staked balances:", stakedBalances);

      const result = {
        stakingPoolName: stakingPoolName,
        stakedBalances: stakedBalances,
      };

      console.log("Result:", JSON.stringify(result, null, 2));

      // Update the totalStakedBalances object
      updateTotalStakedBalances(stakedBalances, totalStakedBalances);

      // Add the result to the finalResults array
      finalResults.push(result);
    } else if (stakingPoolType === "open") {
      const uniqueStakers = await getUniqueStakersFromOpenStaking(
        stakingPoolName,
        stakingContractAddress,
        stakingPoolType,
        tokenContractAddress,
        chainId,
        web3Instance,
        fromBlock,
        toBlock,
        blockIterationSize,
        DB_NAME!,
        DB_COLLECTION_STAKING_SNAPSHOT!,
        DB_CONNECTION_STRING!
      );
      console.log("Unique staker addresses from open staking:", uniqueStakers);

      const stakedBalances = await getOpenStakingStakedBalances(
        stakingPoolName,
        stakingContractAddress,
        tokenContractAddress,
        chainId,
        uniqueStakers,
        decimals,
        web3Instance,
        DB_NAME!,
        DB_COLLECTION_STAKING_SNAPSHOT!,
        DB_CONNECTION_STRING!
      );
      console.log("Staked balances from open staking:", stakedBalances);

      const result = {
        stakingPoolName: stakingPoolName,
        stakedBalances: stakedBalances,
      };

      console.log("Result:", JSON.stringify(result, null, 2));

      // Update the totalStakedBalances object
      updateTotalStakedBalances(stakedBalances, totalStakedBalances);

      // Add the result to the finalResults array
      finalResults.push(result);
    }

    // Add logic for other staking pool types here if needed
  } catch (error) {
    console.error("Error processing data item:", error);
  }

  // Add the total staked balances to the finalResults array
  finalResults.push({
    stakingPoolName: "totalStakedBalances",
    stakedBalances: totalStakedBalances,
  });

  console.log("Final Results:", JSON.stringify(finalResults, null, 2));

  return finalResults;
};

export const getSnapHodlConfigBalance = async (
  snapHodlConfig: SnapHodlConfig
) => {
  if (!snapHodlConfig.isActive) {
    return;
  }
  const client = new MongoClient(DB_CONNECTION_STRING!);
  await client.connect();

  console.log(
    `${snapHodlConfig.snapShotConfigName} isActive:`,
    snapHodlConfig.isActive
  );
  const stakingContractObjects = snapHodlConfig.stakingContractData;
  const stakingContractDataBalances = [];
  const totalStakedBalance: { [address: string]: BigNumber } = {};

  for (const stakingContractObject of stakingContractObjects) {
    const { stakingContractAddress, tokenContractAddress, chainId } =
      stakingContractObject;

    const query = {
      stakingContractAddress,
      tokenContractAddress,
      chainId,
    };

    const snapshots = await client
      .db(DB_NAME)
      .collection(DB_COLLECTION_STAKING_SNAPSHOT!)
      .find(query)
      .toArray();
    let totalBalance = new BigNumber(0);

    snapshots.forEach((snapshot) => {
      Object.entries<string>(snapshot.stakedBalances).forEach(
        ([address, balance]) => {
          const balanceBN = new BigNumber(balance);
          totalBalance = totalBalance.plus(balanceBN);

          if (totalStakedBalance[address]) {
            totalStakedBalance[address] =
              totalStakedBalance[address].plus(balanceBN);
          } else {
            totalStakedBalance[address] = balanceBN;
          }
        }
      );
    });

    stakingContractDataBalances.push({
      stakingContractAddress,
      tokenContractAddress,
      chainId,
      totalStakedBalance: totalBalance.toString(),
    });
  }

  await client.close();

  const result: SnapHodlConfigBalance = {
    snapHodlConfigId: new ObjectId(snapHodlConfig._id),
    snapShotConfigName: snapHodlConfig.snapShotConfigName,
    stakingContractDataBalances,
    totalStakedBalance: Object.fromEntries(
      Object.entries(totalStakedBalance).map(([address, balance]) => [
        address,
        balance.toString(),
      ])
    ),
    createdAt: new Date(), // add this
    updatedAt: new Date(), // add this
  };

  // Reconnect to the database to insert the result
  await client.connect();
  const collection = client
    .db(DB_NAME)
    .collection(DB_COLLECTION_SNAP_CONFIG_BALANCE!);
  const existingDoc = await collection.findOne({
    snapHodlConfigId: new ObjectId(snapHodlConfig._id),
  });

  if (existingDoc) {
    await collection.updateOne(
      { snapHodlConfigId: new ObjectId(snapHodlConfig._id) },
      {
        $set: {
          ...result,
          updatedAt: new Date(),
          createdAt: existingDoc.createdAt ? existingDoc.createdAt : new Date(),
        },
      }
    );
  } else {
    await collection.insertOne({
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await client.close();
  return result;
};

export const getSnapHodlConfigTradingVolumeBalance = async (
  snapHodlConfig: SnapHodlConfig
) => {
  if (!snapHodlConfig.isActive) {
    return;
  }
  const client = new MongoClient(DB_CONNECTION_STRING!);
  await client.connect();

  console.log(
    `${snapHodlConfig.snapShotConfigName} isActive:`,
    snapHodlConfig.isActive
  );
  const tradingContractObjects = snapHodlConfig.tradingVolumeContractData;
  const totalTradingVolumeBalance: any = [];
  const totalTradingVolume: { [address: string]: BigNumber } = {};
  let totalBalance = new BigNumber(0);

  for (const tradingContractObject of tradingContractObjects) {
    const { liquidityPoolAddress, tokenContractAddress, chainId } =
      tradingContractObject;

    const query = {
      liquidityPoolAddress,
      tokenContractAddress,
      chainId,
    };

    const snapshots = await client
      .db(DB_NAME)
      .collection(DB_COLLECTION_TRADING_SNAPSHOT!)
      .find(query)
      .toArray();

    snapshots.forEach((snapshot) => {
      Object.entries<string>(snapshot.tradesVolumeBalances).forEach(
        ([address, balance]) => {
          const balanceBN = new BigNumber(balance);
          totalBalance = totalBalance.plus(balanceBN);

          if (totalTradingVolume[address]) {
            totalTradingVolume[address] =
              totalTradingVolume[address].plus(balanceBN);
          } else {
            totalTradingVolume[address] = balanceBN;
          }
        }
      );
    });

    Object.keys(totalTradingVolume).forEach((address) => {
      (totalTradingVolume as any)[address] =
        totalTradingVolume[address].toString();
    });

    totalTradingVolumeBalance.push({
      liquidityPoolAddress,
      tokenContractAddress,
      chainId,
      totalTradingVolume: totalBalance.toString(),
    });
  }

  await client.close();
  // console.log("Total Trading Volume Balance:", totalTradingVolumeBalance);
  // console.log("Total Trading Volume:", totalTradingVolume);
  let result: any = {
    snapHodlConfigId: new ObjectId(snapHodlConfig._id),
    snapShotConfigName: snapHodlConfig.snapShotConfigName,
    totalTradingVolumeBalance,
    totalTradingVolume: totalTradingVolume,
    createdAt: new Date(), // add this
    updatedAt: new Date(), // add this
  };

  // Reconnect to the database to insert the result
  await client.connect();
  const collection = client
    .db(DB_NAME)
    .collection(DB_COLLECTION_SNAP_CONFIG_BALANCE!);
  const existingDoc = await collection.findOne({
    snapHodlConfigId: new ObjectId(snapHodlConfig._id),
  });

  if (existingDoc) {
    await collection.updateOne(
      { snapHodlConfigId: new ObjectId(snapHodlConfig._id) },
      {
        $set: {
          ...result,
          updatedAt: new Date(),
          createdAt: existingDoc.createdAt ? existingDoc.createdAt : new Date(),
        },
      }
    );
  } else {
    await collection.insertOne({
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await client.close();
  return result;
};

export const getSnapShotBySnapShotUserVolumeAndReward = async (
  snapHodlConfig: SnapHodlConfig
) => {
  const client = new MongoClient(DB_CONNECTION_STRING!);
  await client.connect();
  const collection = client
    .db(DB_NAME)
    .collection(DB_COLLECTION_SNAP_CONFIG_BALANCE!);
  const snapHodlConfigBalance = await collection.findOne({
    snapHodlConfigId: new ObjectId(snapHodlConfig._id),
  });
  const reward = 250000;
  let totalVolume = 0;
  let totalUserVolume: any = {};
  let totalUserReward: any = {};
  if (snapHodlConfigBalance) {
    console.log({
      snapHodlConfigBalance: snapHodlConfigBalance,
    });
    Object.entries<string>(snapHodlConfigBalance.totalStakedBalance).forEach(
      ([address, balance]) => {
        totalVolume = totalVolume + Number(balance);
        if (totalUserVolume[address]) {
          totalUserVolume[address] = totalUserVolume[address].plus(balance);
        } else {
          totalUserVolume[address] = balance;
        }
      }
    );

    Object.entries(snapHodlConfigBalance.totalTradingVolume).forEach(
      ([address, balance]) => {
        totalVolume = totalVolume + Number(balance);
        if (totalUserVolume[address]) {
          totalUserVolume[address] = totalUserVolume[address].plus(balance);
        } else {
          totalUserVolume[address] = balance;
        }
      }
    );

    Object.entries(totalUserVolume).forEach(([address, balance]: any) => {
      totalUserReward[address] = new BigNumber(balance)
        .dividedBy(totalVolume)
        .multipliedBy(reward)
        .toString();
    });
    // console.log("totalUserVolume:", totalUserVolume);
    // console.log("totalVolume:", totalVolume.toString());
    console.log(
      "length of totalUserVolume:",
      Object.keys(totalUserVolume).length
    );
    console.log(
      "length of totalUserReward:",
      Object.keys(totalUserReward).length
    );
    console.log(
      "length of totalTradingVolume",
      Object.keys(snapHodlConfigBalance.totalTradingVolume).length
    );
    console.log(
      "length of totalStakedBalance",
      Object.keys(snapHodlConfigBalance.totalStakedBalance).length
    );
    let result = {
      ...snapHodlConfigBalance,
      totalUserVolume,
      totalVolume: totalVolume.toString(),
      totalUserReward,
    };
    await collection.updateOne(
      { snapHodlConfigId: new ObjectId(snapHodlConfig._id) },
      {
        $set: {
          ...result,
          updatedAt: new Date(),
          createdAt: snapHodlConfigBalance.createdAt
            ? snapHodlConfigBalance.createdAt
            : new Date(),
        },
      }
    );
  }
};
// export function updateTotalTradesVolumeBalances(
//   balances: { [address: string]: string },
//   totalStakedBalances: { [address: string]: string }
// ): void {
//   for (const key in balances) {
//     const value = balances[key];
//     if (totalStakedBalances[key]) {
//       const existingBalance = new BigNumber(totalStakedBalances[key]);
//       const newBalance = existingBalance.plus(value);
//       totalStakedBalances[key] = newBalance.toString();
//     } else {
//       totalStakedBalances[key] = value;
//     }
//   }
// }
