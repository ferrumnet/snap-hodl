// src/services/stakingService.ts

import { MongoClient } from "mongodb";

export async function getLatestStakingSnapshot(
    stakingContractAddress: string,
    tokenContractAddress: string,
    chainId: string,
    dbName: string,
    dbCollection: string,
    connectionString: string
): Promise<any | null> {
    const client = new MongoClient(connectionString);
    let snapshot = null;
    try {
        await client.connect();
        const database = client.db(dbName);
        const collection = database.collection(dbCollection);

        const filter = {
            stakingContractAddress,
            tokenContractAddress,
            chainId
        };

        snapshot = await collection.findOne(filter);
    } catch (err) {
        console.error("Error fetching the latest staking snapshot from the database:", err);
    } finally {
        await client.close();
    }
    return snapshot;
}

export async function saveStakingSnapshot(
    stakingPoolName: string,
    stakingContractAddress: string,
    stakingPoolType: string,
    tokenContractAddress: string,
    chainId: string,
    latestBlockCaptured: number,
    uniqueStakers: string[],
    dbName: string,
    dbCollection: string,
    connectionString: string
) {
    const client = new MongoClient(connectionString);
    try {
        await client.connect();
        const database = client.db(dbName);
        const collection = database.collection(dbCollection);

        const snapshot = {
            stakingPoolName,
            stakingContractAddress,
            stakingPoolType,
            tokenContractAddress,
            chainId,
            latestBlockCaptured,
            uniqueStakers,
            timestamp: new Date()
        };

        const filter = {
            stakingContractAddress,
            tokenContractAddress,
            chainId
        };

        const update = {
            $set: snapshot
        };

        const options = {
            upsert: true
        };

        await collection.updateOne(filter, update, options);
    } catch (err) {
        console.error("Error saving staking snapshot to the database:", err);
    } finally {
        await client.close();
    }
}

export async function saveStakedBalances(
    stakingContractAddress: string,
    tokenContractAddress: string,
    chainId: string,
    stakedBalances: { [stakerAddress: string]: string },
    dbName: string,
    dbCollection: string,
    connectionString: string
) {
    const client = new MongoClient(connectionString);
    try {
        await client.connect();
        const database = client.db(dbName);
        const collection = database.collection(dbCollection);

        const filter = {
            stakingContractAddress,
            tokenContractAddress,
            chainId
        };

        const update = {
            $set: {
                stakedBalances,
                timestamp: new Date()
            }
        };

        const options = {
            upsert: true
        };

        await collection.updateOne(filter, update, options);
    } catch (err) {
        console.error("Error saving staked balances to the database:", err);
    } finally {
        await client.close();
    }
}
