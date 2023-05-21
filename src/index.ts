// src/index.ts

import express from 'express';
import dotenv from 'dotenv';
import web3 from "web3";
import axios from "axios";
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
const ADMIN_AND_SNAP_CONFIG_API = process.env.ADMIN_AND_SNAP_CONFIG_API ?? "";
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

// Schedule cron job
cron.schedule('*/5 * * * *', async () => {
  console.log('Running the job every hour');
  try {
    // Fetch data from the API
    const response = await axios.get(`${ADMIN_AND_SNAP_CONFIG_API}/snapHodlConfig`);
    const data = response.data;

    for (const item of data) {
      let totalStakedBalances: { [address: string]: string } = {};
      let finalResults: any[] = [];
      const stakingContractData: StakingContractDataItem[] = item.stakingContractData;
      console.log(`Staking Contract Data Received:`, stakingContractData);

      if (item.isActive) {
        for (const item of stakingContractData) {
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
            continue;
          }
        }

        // Add the total staked balances to the finalResults array
        finalResults.push({ stakingPoolName: "totalStakedBalances", stakedBalances: totalStakedBalances });

        console.log("Final Results:", JSON.stringify(finalResults, null, 2));
      }
    }
  } catch (error) {
    console.error("Error fetching data from the API or processing data:", error);
  }
});

app.get('/', async (req, res) => {
  res.send('Server running');
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});