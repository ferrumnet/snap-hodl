// src/standardStaking.ts

import { AbiItem, AbiInput } from "web3-utils";
import web3 from "web3";
import standardStakingContractAbi from "../ABI/standardStakingContractAbi.json";
import { BigNumber } from "bignumber.js";

export async function getUniqueStakers(
  stakingContractAddress: string,
  web3Instance: web3,
  fromBlock: number | "latest",
  toBlock: number | "latest"
): Promise<string[]> {
  console.log("Fetching unique stakers...");

  const uniqueStakers = new Set<string>();

  const stakingContract = new web3Instance.eth.Contract(
    standardStakingContractAbi as unknown as AbiItem[],
    stakingContractAddress
  );

  const stakedEventFilter = {
    fromBlock: fromBlock,
    toBlock: toBlock,
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
      const stakerAddress = event["staker_"];
      uniqueStakers.add(stakerAddress);
    });

    console.log("Unique stakers fetched.");
  } catch (error) {
    console.error("Error fetching unique stakers:", error);
  }

  return Array.from(uniqueStakers);
}

export async function getStakedBalances(
    stakers: string[],
    decimals: number,
    stakingContractAddress: string,
    web3Instance: web3
  ): Promise<{ [stakerAddress: string]: string }> {
    console.log("Fetching staked balances...");
  
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
