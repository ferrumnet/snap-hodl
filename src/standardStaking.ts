// src/standardStaking.ts

import { AbiItem, AbiInput } from "web3-utils";
import web3 from "web3";
import standardStakingContractAbi from "../ABI/standardStakingContractAbi.json";
import { MongoClient } from "mongodb";
import { BigNumber } from "bignumber.js";
import { saveStakingSnapshot, getLatestStakingSnapshot } from "./services/stakingService";

export async function getUniqueStakers(
  stakingPoolName: string,
  stakingContractAddress: string,
  stakingPoolType: string,
  tokenContractAddress: string,
  chainId: string,
  web3Instance: web3,
  fromBlock: number | "latest",
  toBlock: number | "latest",
  blockIterationSize: number,
  dbName: string,
  dbCollection: string,
  connectionString: string
): Promise<string[]> {
  console.log(`Fetching unique stakers from Staking Contract: `, stakingPoolName, " | ", stakingContractAddress);

  const existingSnapshot = await getLatestStakingSnapshot(
    stakingContractAddress,
    tokenContractAddress,
    chainId,
    dbName,
    dbCollection,
    connectionString
  );

  const uniqueStakers = new Set<string>(
    existingSnapshot ? existingSnapshot.uniqueStakers : []
  );
  const step = blockIterationSize;

  // Convert block identifiers to actual block numbers
  const currentBlockNumber = await web3Instance.eth.getBlockNumber();
  const resolvedFromBlock = fromBlock === "latest" ? currentBlockNumber : fromBlock;
  const resolvedToBlock = toBlock === "latest" ? currentBlockNumber : toBlock;

  const stakingContract = new web3Instance.eth.Contract(
    standardStakingContractAbi as unknown as AbiItem[],
    stakingContractAddress
  );

  let startBlock = resolvedFromBlock;
  if (existingSnapshot && existingSnapshot.latestBlockCaptured >= resolvedFromBlock) {
    startBlock = existingSnapshot.latestBlockCaptured + 1;
  }

  for (let currentBlock = startBlock; currentBlock < resolvedToBlock; currentBlock += step) {
    const endBlock = Math.min(currentBlock + step - 1, resolvedToBlock);
  
    const stakedEventFilter = {
      fromBlock: currentBlock,
      toBlock: endBlock,
      address: stakingContractAddress,
      topics: [stakingContract.events.Staked.signature],
    };

    try {
      const logs = await web3Instance.eth.getPastLogs(stakedEventFilter);
      console.log("Fetched logs:", logs);

      logs.forEach((log) => {
        const eventInterface = stakingContract.options.jsonInterface.find(
          (i: any) => i.signature === log.topics[0]
        );

        if (!eventInterface) {
          console.error("Event interface not found for signature:", log.topics[0]);
          return;
        }

        const inputs = eventInterface.inputs as AbiInput[];

        const event = web3Instance.eth.abi.decodeLog(
          inputs,
          log.data,
          log.topics.slice(1)
        );
        console.log("Decoded event:", event);
        const stakerAddress = event["staker_"].toLowerCase();
        uniqueStakers.add(stakerAddress);
      });

      console.log("Unique stakers fetched for blocks", currentBlock, "to", endBlock);

      await saveStakingSnapshot(
        stakingPoolName,
        stakingContractAddress,
        stakingPoolType,
        tokenContractAddress,
        chainId,
        endBlock,
        Array.from(uniqueStakers),
        dbName,
        dbCollection,
        connectionString
      );
    } catch (error) {
      console.error("Error fetching unique stakers:", error);
    }
  }

  return Array.from(uniqueStakers);
}

export async function getStakedBalances(
  stakingPoolName: string,
  stakingContractAddress: string,
  stakers: string[],
  decimals: number,
  web3Instance: web3
): Promise<{ [stakerAddress: string]: string }> {
  console.log(`Fetching staked balances: `, stakingPoolName, " | ", stakingContractAddress);

  const stakedBalances: { [stakerAddress: string]: string } = {};

  const stakingContract = new web3Instance.eth.Contract(
    standardStakingContractAbi as unknown as AbiItem[],
    stakingContractAddress
  );

  for (const staker of stakers) {
    try {
      const balance = await stakingContract.methods.stakeOf(staker).call();
      const convertedBalance = new BigNumber(balance)
        .dividedBy(new BigNumber(10).pow(decimals))
        .toString();
      stakedBalances[staker] = convertedBalance;
    } catch (error) {
      console.error(`Error fetching staked balance for ${staker}:`, error);
    }
  }

  console.log("Staked balances fetched.");
  return stakedBalances;
}
