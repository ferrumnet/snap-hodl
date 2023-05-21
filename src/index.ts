// src/index.ts

import express from 'express';
import dotenv from 'dotenv';
import web3 from "web3";
import axios from "axios";
import { getUniqueStakers, getStakedBalances } from "./standardStaking";
import { getUniqueStakersFromOpenStaking, getOpenStakingStakedBalances } from "./openStaking";
import { StakingContractDataItem, SnapHodlConfig, SnapHodlConfigBalance } from "./types";
import { getRpcUrl } from "./utils/getRpcUrl";
import { getTokenDecimals } from "./utils/getTokenDecimals";
import { updateTotalStakedBalances } from "./utils/updateTotalStakedBalances";
import cron from 'node-cron';
import _ from 'lodash';
import fs from 'fs';
import { MongoClient, ObjectId } from "mongodb";
import BigNumber from "bignumber.js";

dotenv.config();
const APP_NAME = process.env.APP_NAME;
const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING;
const DB_NAME = process.env.DB_NAME;
const DB_COLLECTION = process.env.DB_COLLECTION;
const DB_COLLECTION_STAKING_SNAPSHOT = process.env.DB_COLLECTION_STAKING_SNAPSHOT;
const DB_COLLECTION_SNAP_CONFIG_BALANCE = process.env.DB_COLLECTION_SNAP_CONFIG_BALANCE;
const ADMIN_AND_SNAP_CONFIG_API = process.env.ADMIN_AND_SNAP_CONFIG_API;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const PORT = process.env.PORT;

// An array to hold the environment variables
const envVariables = [
  { name: 'APP_NAME', value: APP_NAME },
  { name: 'DB_CONNECTION_STRING', value: DB_CONNECTION_STRING },
  { name: 'DB_NAME', value: DB_NAME },
  { name: 'DB_COLLECTION', value: DB_COLLECTION },
  { name: 'DB_COLLECTION_STAKING_SNAPSHOT', value: DB_COLLECTION_STAKING_SNAPSHOT },
  { name: 'DB_COLLECTION_SNAP_CONFIG_BALANCE', value: DB_COLLECTION_SNAP_CONFIG_BALANCE },
  { name: 'ADMIN_AND_SNAP_CONFIG_API', value: ADMIN_AND_SNAP_CONFIG_API },
  { name: 'CRON_SCHEDULE', value: CRON_SCHEDULE },
  { name: 'PORT', value: PORT }
];

// Check if each environment variable is set
envVariables.forEach(envVar => {
  if (!envVar.value) {
    throw new Error(`${envVar.name} is not set. Please set this environment variable.`);
  }
});

const app = express();


if (!DB_CONNECTION_STRING || !DB_NAME || !DB_COLLECTION) {
  throw new Error("DB_CONNECTION_STRING, DB_NAME, or DB_COLLECTION is not defined.");
}

const getWeb3Instance = (rpcUrl: string | undefined): web3 => {
  if (!rpcUrl) {
    throw new Error("RPC URL is undefined.");
  }
  return new web3(rpcUrl);
};

async function getSnapHodlConfigBalance(snapHodlConfig: SnapHodlConfig) {
  const client = new MongoClient(DB_CONNECTION_STRING!);
  await client.connect();

  const stakingContractObjects = snapHodlConfig.stakingContractData;
  const stakingContractDataBalances = [];
  const totalStakedBalance: { [address: string]: BigNumber } = {};

  for (const stakingContractObject of stakingContractObjects) {
    const { stakingContractAddress, tokenContractAddress, chainId } = stakingContractObject;

    const query = {
      stakingContractAddress,
      tokenContractAddress,
      chainId,
    };

    const snapshots = await client.db(DB_NAME).collection(DB_COLLECTION_STAKING_SNAPSHOT!).find(query).toArray();
    let totalBalance = new BigNumber(0);

    snapshots.forEach((snapshot) => {
      Object.entries<string>(snapshot.stakedBalances).forEach(([address, balance]) => {
        const balanceBN = new BigNumber(balance);
        totalBalance = totalBalance.plus(balanceBN);

        if (totalStakedBalance[address]) {
          totalStakedBalance[address] = totalStakedBalance[address].plus(balanceBN);
        } else {
          totalStakedBalance[address] = balanceBN;
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
}

const processStakingContractDataItem = async (
  item: StakingContractDataItem,
  DB_NAME: string,
  DB_COLLECTION_STAKING_SNAPSHOT: string,
  DB_CONNECTION_STRING: string,
  APP_NAME: string
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
  const rpcUrl = await getRpcUrl(chainId, APP_NAME, DB_CONNECTION_STRING, DB_NAME, DB_COLLECTION);

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
        DB_NAME,
        DB_COLLECTION_STAKING_SNAPSHOT,
        DB_CONNECTION_STRING
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
        DB_NAME,
        DB_COLLECTION_STAKING_SNAPSHOT,
        DB_CONNECTION_STRING
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
        DB_NAME,
        DB_COLLECTION_STAKING_SNAPSHOT,
        DB_CONNECTION_STRING
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
        DB_NAME,
        DB_COLLECTION_STAKING_SNAPSHOT,
        DB_CONNECTION_STRING
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
  finalResults.push({ stakingPoolName: "totalStakedBalances", stakedBalances: totalStakedBalances });

  console.log("Final Results:", JSON.stringify(finalResults, null, 2));

  return finalResults;
};



// Schedule cron job
cron.schedule(CRON_SCHEDULE!, async () => {
  console.log('Running the job every 5 minutes');
  try {
    // Fetch data from the API
    const response = await axios.get(`${ADMIN_AND_SNAP_CONFIG_API}/snapHodlConfig`);
    const data = response.data;
    const snapHodlConfigs: SnapHodlConfig[] = response.data;

    let uniqueStakingContractDataItems: StakingContractDataItem[] = [];
    for (const item of data) {
      const { stakingContractData, isActive } = item;
      if (isActive) {
        uniqueStakingContractDataItems = [
          ...uniqueStakingContractDataItems,
          ...stakingContractData
        ];
      }
    }

    // Filter unique stakingContractData based on stakingContractAddress, tokenContractAddress, and chainId
    uniqueStakingContractDataItems = _.uniqBy(uniqueStakingContractDataItems, ({ stakingContractAddress, tokenContractAddress, chainId }) => {
      return `${stakingContractAddress}-${tokenContractAddress}-${chainId}`;
    });

    // Start processing uniqueStakingContractDataItems concurrently
    await Promise.all(uniqueStakingContractDataItems.map(item => processStakingContractDataItem(
      item,
      DB_NAME,
      DB_COLLECTION_STAKING_SNAPSHOT!,
      DB_CONNECTION_STRING,
      APP_NAME!
    )));

    // After processStakingContractDataItem function calls
    await Promise.all(snapHodlConfigs.map(getSnapHodlConfigBalance));

    const utcStr = new Date().toUTCString();
    console.log(`Cron finished at:`, utcStr);

  } catch (error) {
    console.error("Error fetching data from the API or processing data:", error);
  }
});

app.get('/', async (req, res) => {
  res.send('Server running');
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});