// src/openStaking.ts

import fs from "fs";
import web3 from "web3";
import { BigNumber } from "bignumber.js";
import { AbiItem, AbiInput } from "web3-utils";
import tokenContractAbi from "../ABI/tokenContractAbi.json";
import openStakingContractAbi from "../ABI/openStakingContractAbi.json";
import { saveStakingSnapshot, getLatestStakingSnapshot, saveStakedBalances } from "./services/stakingService";

export async function getUniqueStakersFromOpenStaking(
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
): Promise<Set<string>> {
    console.log(`Fetching Unique Stakers from Open Staking Contract: `, stakingPoolName, " | ", stakingContractAddress);

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

    // Convert block identifiers to actual block numbers
    const currentBlockNumber = await web3Instance.eth.getBlockNumber();
    const resolvedFromBlock = fromBlock === "latest" ? currentBlockNumber : fromBlock;
    const resolvedToBlock = toBlock === "latest" ? currentBlockNumber : toBlock;

    const step = blockIterationSize;

    let startBlock = resolvedFromBlock;
    if (existingSnapshot && existingSnapshot.latestBlockCaptured >= resolvedFromBlock) {
        startBlock = existingSnapshot.latestBlockCaptured + 1;
    }

    const tokenContract = new web3Instance.eth.Contract(tokenContractAbi as unknown as AbiItem[], tokenContractAddress);
    const transferEventSignature = tokenContract.events.Transfer.signature;

    for (let currentBlock = startBlock; currentBlock < resolvedToBlock; currentBlock += step) {
        const endBlock = Math.min(currentBlock + step - 1, resolvedToBlock);

        const transferEventFilter = {
            fromBlock: currentBlock,
            toBlock: endBlock,
            address: tokenContractAddress,
            topics: [transferEventSignature, null, web3Instance.eth.abi.encodeParameter("address", stakingContractAddress)],
        };


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
            console.error("Error fetching ERC20 transfers to Staking Contract:", error);
        }
    }

    return uniqueStakers;
}

export async function getOpenStakingStakedBalances(
    stakingPoolName: string,
    stakingContractAddress: string,
    tokenContractAddress: string,
    chainId: string,
    uniqueStakers: Set<string>,
    decimals: number,
    web3Instance: web3,
    dbName: string,
    dbCollection: string,
    connectionString: string
): Promise<{ [stakerAddress: string]: string }> {
    console.log(`Fetching staked balances from Open Staking Contract: `, stakingPoolName, " | ", stakingContractAddress);

    const stakingContract = new web3Instance.eth.Contract(openStakingContractAbi as unknown as AbiItem[], stakingContractAddress);
    const stakedBalances: { [stakerAddress: string]: string } = {};

    try {
        for (const stakerAddress of uniqueStakers) {
            const balanceRaw = await stakingContract.methods.stakeOf(tokenContractAddress, stakerAddress).call();
            const humanReadableBalance = new BigNumber(balanceRaw).dividedBy(new BigNumber(10).pow(decimals)).toString();
            stakedBalances[stakerAddress] = humanReadableBalance;
        }
        await saveStakedBalances(
            stakingContractAddress,
            tokenContractAddress,
            chainId,
            stakedBalances,
            dbName,
            dbCollection,
            connectionString
        );
    } catch (error) {
        console.error("Error fetching staked balances from Open Staking Contract:", error);
    }

    return stakedBalances;
}
