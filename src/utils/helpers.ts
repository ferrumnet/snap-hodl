// src/utils/helpers.ts

import { SnapHodlConfig, SnapHodlConfigBalance, StakingContractDataItem } from "../types";
import { APP_NAME, DB_CONNECTION_STRING, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_COLLECTION, DB_COLLECTION_SNAP_CONFIG_BALANCE } from '../config';
import { MongoClient, ObjectId } from 'mongodb';
import web3 from "web3";
import BigNumber from "bignumber.js";
import { getRpcUrl } from "./getRpcUrl";
import { getUniqueStakersFromOpenStaking, getOpenStakingStakedBalances } from "../openStaking";
import { getUniqueStakers, getStakedBalances } from "../standardStaking";
import { getTokenDecimals } from "./getTokenDecimals";
import { updateTotalStakedBalances } from "./updateTotalStakedBalances";

export const getWeb3Instance = (rpcUrl: string | undefined): web3 => {
    if (!rpcUrl) {
        throw new Error("RPC URL is undefined.");
    }
    return new web3(rpcUrl);
};

export const processStakingContractDataItem = async (
    item: StakingContractDataItem,
    dbName: string,
    collectionName: string,
    connectionString: string,
    appName: string
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
    const rpcUrl = await getRpcUrl(chainId, APP_NAME, DB_CONNECTION_STRING!, DB_NAME!, DB_COLLECTION!);

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
                DB_NAME!,
                DB_COLLECTION_STAKING_SNAPSHOT!,
                DB_CONNECTION_STRING!
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
                DB_NAME!,
                DB_COLLECTION_STAKING_SNAPSHOT!,
                DB_CONNECTION_STRING!
            );
            // console.log("Staked balances:", stakedBalances);

            const result = {
                stakingPoolName: stakingPoolName,
                stakedBalances: stakedBalances,
            };

            // console.log("Result:", JSON.stringify(result, null, 2));

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
                DB_NAME!,
                DB_COLLECTION_STAKING_SNAPSHOT!,
                DB_CONNECTION_STRING!
            );
            // console.log("Unique staker addresses from open staking:", uniqueStakers);

            const stakedBalances = await getOpenStakingStakedBalances(
                stakingPoolName,
                stakingContractAddress,
                tokenContractAddress,
                chainId,
                uniqueStakers,
                decimals,
                web3Instance,
                DB_NAME!,
                DB_COLLECTION_STAKING_SNAPSHOT!,
                DB_CONNECTION_STRING!
            );
            // console.log("Staked balances from open staking:", stakedBalances);

            const result = {
                stakingPoolName: stakingPoolName,
                stakedBalances: stakedBalances,
            };

            // console.log("Result:", JSON.stringify(result, null, 2));

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

    // console.log("Final Results:", JSON.stringify(finalResults, null, 2));

    return finalResults;
};

export const getSnapHodlConfigBalance = async (snapHodlConfig: SnapHodlConfig) => {
    if (!snapHodlConfig.isActive) {
        return;
    }
    const client = new MongoClient(DB_CONNECTION_STRING!);
    await client.connect();

    console.log(`${snapHodlConfig.snapShotConfigName} isActive:`, snapHodlConfig.isActive);
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
};
