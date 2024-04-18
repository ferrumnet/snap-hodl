// src/utils/helpers.ts

import { SnapHodlConfig, SnapHodlConfigBalance, StakingContractDataItem, TradingVolumeContractDataItem } from "../types";
import { APP_NAME, DB_CONNECTION_STRING, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_COLLECTION, DB_COLLECTION_SNAP_CONFIG_BALANCE, DB_COLLECTION_TRADING_SNAPSHOT } from '../config';
import { MongoClient, ObjectId } from 'mongodb';
import web3 from "web3";
import BigNumber from "bignumber.js";
import { getRpcUrl } from "./getRpcUrl";
import { AbiItem } from "web3-utils";
import { getUniqueStakersFromOpenStaking, getOpenStakingStakedBalances } from "../openStaking";
import { getUniqueStakers, getStakedBalances } from "../standardStaking";
import { getTokenDecimals } from "./getTokenDecimals";
import { updateTotalStakedBalances } from "./updateTotalStakedBalances";
import tokenContractAbi from "../../ABI/tokenContractAbi.json";
import {
  getLatestTradingSnapshot,
  saveTradedBalances,
  saveTradingSnapshot,
} from "../services/tradingService";
import { add } from "lodash";

export const getWeb3Instance = (rpcUrl: string | undefined): web3 => {
  if (!rpcUrl) {
    throw new Error("RPC URL is undefined.");
  }
  return new web3(rpcUrl);
};

export const processTradingContractDataItem = async (
  item: TradingVolumeContractDataItem
) => {
  console.log("processTradingContractDataItem : start")
  // console.log({ item });
  const rpcUrl = await getRpcUrl(
    item.chainId,
    APP_NAME,
    DB_CONNECTION_STRING!,
    DB_NAME!,
    DB_COLLECTION!
  );
  // console.log({ chainId: item.chainId, rpcUrl });
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

  let buyByWalletAddress: { [key: string]: any } = {};

  // console.log(existingTradingSnapshot);

  if(existingTradingSnapshot && 
    existingTradingSnapshot.tradesVolumeBalances){
    buyByWalletAddress = existingTradingSnapshot.tradesVolumeBalances;
  }

  // console.log(buyByWalletAddress)
  
  let alreadyProcessedBuyTransactionHashes:string[] = [];
  let alreadyProcessedSellTransactionHashes:string[] = [];

  for (
    let currentBlock = startBlock;
    currentBlock < resolvedToBlock;
    currentBlock += step
  ) {
    const endBlock = Math.min(currentBlock + step - 1, resolvedToBlock);

    // console.log(currentBlock);
    // console.log(endBlock);

    const transferEventSignature = (tokenContract as any)._jsonInterface.find(
      (event: any) => {
        return event.name === "Transfer";
      }
    ).signature;
    const buyTransferEventFilter = {
      fromBlock: currentBlock,
      toBlock: endBlock,
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
    

    // console.log("Buy Transfer event filter:", buyTransferEventFilter);
    const buyLogs = await web3Instance.eth.getPastLogs(buyTransferEventFilter);
    // console.log(buyLogs);
    console.log("buyLogs : "+buyLogs.length);
    for(let i=0;i<buyLogs.length;i++){
      if(!alreadyProcessedBuyTransactionHashes.includes(buyLogs[i].transactionHash)){
        alreadyProcessedBuyTransactionHashes.push(buyLogs[i].transactionHash)
        const receipt = await web3Instance.eth.getTransactionReceipt(buyLogs[i].transactionHash);
        // Initialize an array to store the matching events
        const buyMatchingEvents = [];

        // Iterate through the logs in the transaction receipt
        for (const log of receipt.logs) {
            // Check if the log's address matches the token address and if the event topic is present in the log's topics
            if (log.address.toLowerCase() === item.tokenContractAddress.toLowerCase() && log.topics.includes(buyLogs[i].topics[0])) {
                // Add the log to the matching events array
                buyMatchingEvents.push(log);
            }
        }

        // console.log("buyMatchingEvents : ",buyMatchingEvents );
        // console.log("buyMatchingEvents : "+buyMatchingEvents.length);
        
        // console.log("buyLogs: ", buyLogs);
        buyMatchingEvents.forEach((log: any) => {
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
            ? typeof buyByWalletAddress[`${walletAddress}`] === "string" || buyByWalletAddress[`${walletAddress}`] instanceof String 
            ? buyByWalletAddress[`${walletAddress}`] = new BigNumber(buyByWalletAddress[`${walletAddress}`]).plus(humanReadableBalance) 
            : buyByWalletAddress[`${walletAddress}`].plus(humanReadableBalance)
            : new BigNumber(humanReadableBalance);
          // console.log(buyByWalletAddress[`${walletAddress}`]);
        });
      }
    }

    const sellTransferEventFilter = {
      fromBlock: currentBlock,
      toBlock: endBlock,
      address: item.tokenContractAddress,
      topics: [
        transferEventSignature,
        null,
        web3Instance.eth.abi.encodeParameter(
          "address",
          item.liquidityPoolAddress
        ),
      ],
    };
    // console.log("Transfer event filter:", sellTransferEventFilter);
    const sellLogs = await web3Instance.eth.getPastLogs(
      sellTransferEventFilter
    );
    // console.log(sellLogs);
    console.log("sellLogs : "+sellLogs.length);
    for(let i=0;i<sellLogs.length;i++){
      if(!alreadyProcessedSellTransactionHashes.includes(sellLogs[i].transactionHash)){
        alreadyProcessedSellTransactionHashes.push(sellLogs[i].transactionHash);
        const receipt = await web3Instance.eth.getTransactionReceipt(sellLogs[i].transactionHash);
          // Initialize an array to store the matching events
          const sellMatchingEvents = [];

          // Iterate through the logs in the transaction receipt
          for (const log of receipt.logs) {
              // Check if the log's address matches the token address and if the event topic is present in the log's topics
              if (log.address.toLowerCase() === item.tokenContractAddress.toLowerCase() && log.topics.includes(sellLogs[i].topics[0])) {
                  // Add the log to the matching events array
                  sellMatchingEvents.push(log);
              }
          }

        // console.log("sellMatchingEvents : "+sellMatchingEvents.length);

        // console.log("sellLogs: ", sellLogs);
        sellMatchingEvents.forEach((log: any) => {
          // console.log("sell log: ", log);
          const walletAddress = web3Instance.eth.abi.decodeParameter(
            "address",
            log.topics[1]
          );
          // console.log(`Wallet Address: ${walletAddress}`);
          uniqueTraders.add(walletAddress.toString());
          const value = web3.utils.hexToNumberString(log.data);
          const humanReadableBalance = new BigNumber(value)
            .dividedBy(new BigNumber(10).pow(decimals))
            .toString();
          buyByWalletAddress[`${walletAddress}`] = buyByWalletAddress[
            `${walletAddress}`
          ]
            ? typeof buyByWalletAddress[`${walletAddress}`] === "string" || buyByWalletAddress[`${walletAddress}`] instanceof String 
            ? buyByWalletAddress[`${walletAddress}`] = new BigNumber(buyByWalletAddress[`${walletAddress}`]).plus(humanReadableBalance) 
            : buyByWalletAddress[`${walletAddress}`].plus(humanReadableBalance)
            : new BigNumber(humanReadableBalance);
          // console.log(buyByWalletAddress[`${walletAddress}`].toFixed());
        });
      }
    }
    // console.log(buyByWalletAddress, "buyByWalletAddress");
    // uniqueTraders = new Set([...Object.keys(buyByWalletAddress)]);
    Object.keys(buyByWalletAddress).forEach((address) => {
      buyByWalletAddress[address] = buyByWalletAddress[address].toString();
    });
    // console.log("Unique traders:", uniqueTraders);
    // console.log("Buy and sell value:", buyByWalletAddress);

    // console.log("endBlock : ",endBlock)
    // console.log("currentBlock : ",currentBlock)
    // console.log("buyByWalletAddress : ",buyByWalletAddress);
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
  console.log("processTradingContractDataItem : completed")
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
  const rpcUrl = await getRpcUrl(chainId, APP_NAME, DB_CONNECTION_STRING!, DB_NAME!, DB_COLLECTION!);

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
      // console.log("Unique staker addresses:", stakers);

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
      // console.log("Staked balances:", stakedBalances);

      const result = {
        stakingPoolName: stakingPoolName,
        stakedBalances: stakedBalances,
      };

      // console.log("Result:", JSON.stringify(result, null, 2));

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
      // console.log("Unique staker addresses from open staking:", uniqueStakers);

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
      // console.log("Staked balances from open staking:", stakedBalances);

      const result = {
        stakingPoolName: stakingPoolName,
        stakedBalances: stakedBalances,
      };

      // console.log("Result:", JSON.stringify(result, null, 2));

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
  finalResults.push({ stakingPoolName: "totalStakedBalances", stakedBalances: totalStakedBalances });

  // console.log("Final Results:", JSON.stringify(finalResults, null, 2));

  return finalResults;
};

export const getSnapHodlConfigBalance = async (snapHodlConfig: SnapHodlConfig) => {
  if (!snapHodlConfig.isActive) {
    return;
  }
  const client = new MongoClient(DB_CONNECTION_STRING!);
  await client.connect();

  console.log(`${snapHodlConfig.snapShotConfigName} isActive:`, snapHodlConfig.isActive);
  const stakingContractObjects = snapHodlConfig.stakingContractData;
  const stakingContractDataBalances = [];
  const totalStakedBalance: { [address: string]: BigNumber } = {};

  for (const stakingContractObject of stakingContractObjects) {
    const { stakingContractAddress, tokenContractAddress, chainId, excludedWalletAddresses } = stakingContractObject;

    const query = {
      stakingContractAddress,
      tokenContractAddress,
      chainId,
    };

    const snapshots = await client.db(DB_NAME).collection(DB_COLLECTION_STAKING_SNAPSHOT!).find(query).toArray();
    let totalBalance = new BigNumber(0);

    snapshots.forEach((snapshot) => {
      Object.entries<string>(snapshot.stakedBalances).forEach(([address, balance]) => {
          if(!excludedWalletAddresses || excludedWalletAddresses.length === 0 || !excludedWalletAddresses.includes(address)){
            const balanceBN = new BigNumber(balance);
            totalBalance = totalBalance.plus(balanceBN);

            if (totalStakedBalance[address]) {
              totalStakedBalance[address] = totalStakedBalance[address].plus(balanceBN);
            } else {
              totalStakedBalance[address] = balanceBN;
            }
          }
      });
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
      Object.entries(totalStakedBalance).map(([address, balance]) => [address, balance.toString()])
    ),
    createdAt: new Date(), // add this
    updatedAt: new Date(), // add this
  };

  // Reconnect to the database to insert the result
  await client.connect();
  const collection = client.db(DB_NAME).collection(DB_COLLECTION_SNAP_CONFIG_BALANCE!);
  const existingDoc = await collection.findOne({ snapHodlConfigId: new ObjectId(snapHodlConfig._id) });

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
    const { liquidityPoolAddress, tokenContractAddress, chainId , excludedWalletAddresses, minimumTradingBalance } =
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

    console.log("excludedWalletAddresses : ", excludedWalletAddresses)

    snapshots.forEach((snapshot) => {
      Object.entries<string>(snapshot.tradesVolumeBalances).forEach(
        ([address, balance]) => {
          if(!excludedWalletAddresses || excludedWalletAddresses.length === 0 || !excludedWalletAddresses.includes(address)){
            const balanceBN = new BigNumber(balance);
            

            if(!minimumTradingBalance || minimumTradingBalance === 0 || balanceBN.isGreaterThanOrEqualTo(minimumTradingBalance)){
              totalBalance = totalBalance.plus(balanceBN);
              if (totalTradingVolume[address]) {
                if(typeof totalTradingVolume[address] === "string" || totalTradingVolume[address] instanceof String){
                  totalTradingVolume[address] = new BigNumber(totalTradingVolume[address]);
                }
                totalTradingVolume[address] =
                  totalTradingVolume[address].plus(balanceBN);
              } else {
                totalTradingVolume[address] = balanceBN;
              }
            }
          }else{
            console.log("address was avoided because it was excluded : ", address)
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
  const reward = 25000;
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
        let refactoredAddress = address.toLowerCase();
        if (totalUserVolume[refactoredAddress]) {
          totalUserVolume[refactoredAddress] = totalUserVolume[refactoredAddress].plus(balance);
        } else {
          totalUserVolume[refactoredAddress] = balance;
        }
      }
    );

    Object.entries(snapHodlConfigBalance.totalTradingVolume).forEach(
      ([address, balance]) => {
        totalVolume = totalVolume + Number(balance);
        let refactoredAddress = address.toLowerCase();
        if (totalUserVolume[refactoredAddress]) {
          totalUserVolume[refactoredAddress] = totalUserVolume[refactoredAddress].plus(balance);
        } else {
          totalUserVolume[refactoredAddress] = balance;
        }
      }
    );

    Object.entries(totalUserVolume).forEach(([address, balance]: any) => {

      let userVolumePercentageOutOfTotalVolumne =  new BigNumber(balance).dividedBy(totalVolume).multipliedBy(100);
      let userReward = new BigNumber(reward).multipliedBy(userVolumePercentageOutOfTotalVolumne.dividedBy(100));
      totalUserReward[address] = userReward.toString();
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
