// src/openStaking.ts

import fs from "fs";
import web3 from "web3";
import { BigNumber } from "bignumber.js";
import { AbiItem, AbiInput } from "web3-utils";
import tokenContractAbi from "../ABI/tokenContractAbi.json";
import openStakingContractAbi from "../ABI/openStakingContractAbi.json";

export async function getUniqueStakersFromOpenStaking(
    web3Instance: web3,
    stakingContractAddress: string,
    tokenContractAddress: string,
    fromBlock: number | "latest",
    toBlock: number | "latest"
): Promise<Set<string>> {
    console.log("Fetching Unique Stakers from Open Staking Contract...");

    const tokenContract = new web3Instance.eth.Contract(tokenContractAbi as unknown as AbiItem[], tokenContractAddress);
    const transferEventSignature = tokenContract.events.Transfer.signature;

    const transferEventFilter = {
        fromBlock: fromBlock,
        toBlock: toBlock,
        address: tokenContractAddress,
        topics: [transferEventSignature, null, web3Instance.eth.abi.encodeParameter("address", stakingContractAddress)],
    };

    const uniqueStakers = new Set<string>();

    try {
        const logs = await web3Instance.eth.getPastLogs(transferEventFilter);
        console.log("Fetched logs:", logs);

        logs.forEach((log) => {
            console.log("Log:", log);

            const eventInterface = tokenContract.options.jsonInterface.find(
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

            // Check if the destination address matches the staking contract address
            if (event.dst.toLowerCase() === stakingContractAddress.toLowerCase()) {
                uniqueStakers.add(event.src);
            }
        });
    } catch (error) {
        console.error("Error fetching ERC20 transfers to Staking Contract:", error);
    }

    return uniqueStakers;
}

export async function getOpenStakingStakedBalances(
    web3Instance: web3,
    stakingContractAddress: string,
    tokenContractAddress: string,
    uniqueStakers: Set<string>,
    decimals: number
  ): Promise<{ [stakerAddress: string]: string }> {
    console.log("Fetching staked balances from Open Staking Contract...");
  
    const stakingContract = new web3Instance.eth.Contract(openStakingContractAbi as unknown as AbiItem[], stakingContractAddress);
    const stakedBalances: { [stakerAddress: string]: string } = {};
  
    try {
      for (const stakerAddress of uniqueStakers) {
        const stakedBalanceRaw = await stakingContract.methods.stakeOf(tokenContractAddress, stakerAddress).call();
        const stakedBalance = new BigNumber(stakedBalanceRaw).dividedBy(new BigNumber(10).pow(decimals)).toString();
        stakedBalances[stakerAddress] = stakedBalance;
      }
    } catch (error) {
      console.error("Error fetching staked balances from Open Staking Contract:", error);
    }
  
    return stakedBalances;
  }
  