// src/index.ts

import dotenv from "dotenv";
import Web3 from "web3";
import { AbiItem, AbiInput } from "web3-utils";
import { BigNumber } from "bignumber.js";
import stakingContractAbi from "../ABI/standardStakingContractAbi.json";
import tokenContractAbi from "../ABI/tokenContractAbi.json";

dotenv.config();

const rpcUrl = process.env.RPC_URL || "";
const web3 = new Web3(rpcUrl);

console.log("Web3 instance created.");

const tokenContractAddress = "0x9f6abbf0ba6b5bfa27f4deb6597cc6ec20573fda";
const tokenContract = new web3.eth.Contract(
  tokenContractAbi as unknown as AbiItem[],
  tokenContractAddress
);

console.log("Token contract instance created.");

async function getTokenDecimals(tokenContractAddress: string): Promise<number> {
  console.log("Fetching token decimals...");

  let decimals = 18;

  try {
    const tokenContract = new web3.eth.Contract(tokenContractAbi as unknown as AbiItem[], tokenContractAddress);
    decimals = parseInt(await tokenContract.methods.decimals().call());
  } catch (error) {
    console.error("Error fetching token decimals:", error);
  }

  console.log("Token decimals fetched.");
  return decimals;
}


const stakingContractAddress = "0x2bE7904c81dd3535f31B2C7B524a6ed91FDb37EC";
const stakingContract = new web3.eth.Contract(
  stakingContractAbi as unknown as AbiItem[],
  stakingContractAddress
);

console.log("Staking contract instance created.");

async function getUniqueStakers(): Promise<string[]> {
  console.log("Fetching unique stakers...");

  const uniqueStakers = new Set<string>();

  const stakedEventFilter = {
    fromBlock: 70124014,
    toBlock: "latest",
    address: stakingContractAddress,
    topics: [stakingContract.events.Staked.signature],
  };

  try {
    const logs = await web3.eth.getPastLogs(stakedEventFilter);

    logs.forEach((log) => {
        const eventInterface = stakingContract.options.jsonInterface.find(
          (i: any) => i.signature === log.topics[0]
        );
      
        if (!eventInterface) {
          console.error("Event interface not found for signature:", log.topics[0]);
          return;
        }
      
        const inputs = eventInterface.inputs as AbiInput[];
      
        const event = web3.eth.abi.decodeLog(
          inputs,
          log.data,
          log.topics.slice(1)
        );
        const stakerAddress = event["staker_"];
        uniqueStakers.add(stakerAddress);
      });
      
    console.log("Unique stakers fetched.");
  } catch (error) {
    console.error("Error fetching unique stakers:", error);
  }

  return Array.from(uniqueStakers);
}

async function getStakedBalances(stakers: string[], decimals: number): Promise<Map<string, string>> {
  console.log("Fetching staked balances...");

  const stakedBalances = new Map<string, string>();

  for (const staker of stakers) {
    try {
      const balance = await stakingContract.methods.stakeOf(staker).call();
      const convertedBalance = new BigNumber(balance).dividedBy(new BigNumber(10).pow(decimals)).toString();
      stakedBalances.set(staker, convertedBalance);
    } catch (error) {
      console.error(`Error fetching staked balance for ${staker}:`, error);
    }
  }

  console.log("Staked balances fetched.");
  return stakedBalances;
}


async function getStakingPoolName(): Promise<string> {
  console.log("Fetching staking pool name...");

  let poolName = "";

  try {
    poolName = await stakingContract.methods.name().call();
  } catch (error) {
    console.error("Error fetching staking pool name:", error);
  }

  console.log("Staking pool name fetched.");
  return poolName;
}

(async () => {
  const decimals = await getTokenDecimals(tokenContractAddress);
  console.log("Token decimals:", decimals);

  const stakers = await getUniqueStakers();
  console.log("Unique staker addresses:", stakers);

  const stakedBalances = await getStakedBalances(stakers, decimals);
  console.log("Staked balances:", stakedBalances);

  const stakingPoolName = await getStakingPoolName();
  console.log("Staking pool name:", stakingPoolName);

  const result = {
    stakingPoolName: stakingPoolName,
    stakedBalances: Object.fromEntries(stakedBalances),
  };

  console.log("Result:", JSON.stringify(result, null, 2));
})();