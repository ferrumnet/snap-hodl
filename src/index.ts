// src/index.ts

import dotenv from "dotenv";
dotenv.config();

import Web3 from "web3";
import { AbiItem, AbiInput } from "web3-utils";
import stakingContractAbi from "../ABI/stakingContractAbi.json";

const rpcUrl = process.env.RPC_URL || "";
const web3 = new Web3(rpcUrl);

console.log("Web3 instance created.");

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
    console.log("Logs fetched:", logs);

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

(async () => {
  const stakers = await getUniqueStakers();
  console.log("Unique staker addresses:", stakers);
})();