// src/index.ts

import express from 'express';
import dotenv from 'dotenv';
import web3 from "web3";
import fs from "fs";
import { getUniqueStakers, getStakedBalances } from "./standardStaking";
import { getUniqueStakersFromOpenStaking, getOpenStakingStakedBalances } from "./openStaking";
import { StakingContractDataItem } from "./types";
import { getRpcUrl } from "./utils/getRpcUrl";
import { getTokenDecimals } from "./utils/getTokenDecimals";
import { updateTotalStakedBalances } from "./utils/updateTotalStakedBalances";
import cron from 'node-cron';

dotenv.config();
const APP_NAME = process.env.APP_NAME;
const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING ?? "";
const DB_NAME = process.env.DB_NAME ?? "";
const DB_COLLECTION = process.env.DB_COLLECTION ?? "";
const DB_COLLECTION_STAKING_SNAPSHOT = process.env.DB_COLLECTION_STAKING_SNAPSHOT ?? "";
const app = express();
const port = process.env.PORT || 8081;

if (!DB_CONNECTION_STRING || !DB_NAME || !DB_COLLECTION) {
  throw new Error("DB_CONNECTION_STRING, DB_NAME, or DB_COLLECTION is not defined.");
}

const getWeb3Instance = (rpcUrl: string | undefined): web3 => {
  if (!rpcUrl) {
    throw new Error("RPC URL is undefined.");
  }
  return new web3(rpcUrl);
};

// The data array containing staking contract and token contract addresses
const data: StakingContractDataItem[] = [
  {
    stakingPoolName: "GC - VIP Pool - FRM Arbitrum",
    stakingContractAddress: "0x2bE7904c81dd3535f31B2C7B524a6ed91FDb37EC",
    stakingPoolType: "standard",
    tokenContractAddress: "0x9f6abbf0ba6b5bfa27f4deb6597cc6ec20573fda",
    chainId: "42161",
    fromBlock: 70124014,
    toBlock: 72509478,
    blockIterationSize: 100000
  },
  {
    stakingPoolName: "cFRM Arbitrum Open Staking",
    stakingContractAddress: "0xb4927895cbee88e651e0582893051b3b0f8d7db8",
    stakingPoolType: "open",
    tokenContractAddress: "0xe685d3cc0be48bd59082ede30c3b64cbfc0326e2",
    chainId: "42161",
    fromBlock: 66553295,
    toBlock: "latest",
    blockIterationSize: 100000
  },
  {
    stakingPoolName: "cFRM BSC Open Staking",
    stakingContractAddress: "0x35e15ff9ebb37d8c7a413fd85bad515396dc8008",
    stakingPoolType: "open",
    tokenContractAddress: "0xaf329a957653675613d0d98f49fc93326aeb36fc",
    chainId: "56",
    fromBlock: 17333067,
    toBlock: "latest",
    blockIterationSize: 10000
  }
];

cron.schedule('*/5 * * * *', async () => {
  console.log('Running the job every hour');
  let totalStakedBalances: { [address: string]: string } = {};
  let finalResults: any[] = [];

  for (const item of data) {
    const stakingPoolName = item.stakingPoolName;
    const stakingContractAddress = item.stakingContractAddress;
    const stakingPoolType = item.stakingPoolType
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
          stakers,
          decimals,
          web3Instance
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
          uniqueStakers,
          decimals,
          web3Instance
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
      continue;
    }
  }

  // Add the total staked balances to the finalResults array
  finalResults.push({ stakingPoolName: "totalStakedBalances", stakedBalances: totalStakedBalances });

  console.log("Final Results:", JSON.stringify(finalResults, null, 2));
});

app.get('/', async (req, res) => {
  res.send('Server running');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});