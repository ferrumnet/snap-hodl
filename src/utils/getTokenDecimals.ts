// src/utils/getTokenDecimals.ts

import web3 from "web3";
import { AbiItem } from "web3-utils";
import tokenContractAbi from "../../ABI/tokenContractAbi.json";

export async function getTokenDecimals(tokenContractAddress: string, web3: web3): Promise<number> {
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