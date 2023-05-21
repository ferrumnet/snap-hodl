"use strict";
// src/index.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const web3_1 = __importDefault(require("web3"));
const axios_1 = __importDefault(require("axios"));
const standardStaking_1 = require("./standardStaking");
const openStaking_1 = require("./openStaking");
const getRpcUrl_1 = require("./utils/getRpcUrl");
const getTokenDecimals_1 = require("./utils/getTokenDecimals");
const updateTotalStakedBalances_1 = require("./utils/updateTotalStakedBalances");
const node_cron_1 = __importDefault(require("node-cron"));
const lodash_1 = __importDefault(require("lodash"));
const mongodb_1 = require("mongodb");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
dotenv_1.default.config();
const APP_NAME = process.env.APP_NAME;
const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING;
const DB_NAME = process.env.DB_NAME;
const DB_COLLECTION = process.env.DB_COLLECTION;
const DB_COLLECTION_STAKING_SNAPSHOT = process.env.DB_COLLECTION_STAKING_SNAPSHOT;
const DB_COLLECTION_SNAP_CONFIG_BALANCE = process.env.DB_COLLECTION_SNAP_CONFIG_BALANCE;
const ADMIN_AND_SNAP_CONFIG_API = process.env.ADMIN_AND_SNAP_CONFIG_API;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const PORT = process.env.PORT;
// An array to hold the environment variables
const envVariables = [
    { name: 'APP_NAME', value: APP_NAME },
    { name: 'DB_CONNECTION_STRING', value: DB_CONNECTION_STRING },
    { name: 'DB_NAME', value: DB_NAME },
    { name: 'DB_COLLECTION', value: DB_COLLECTION },
    { name: 'DB_COLLECTION_STAKING_SNAPSHOT', value: DB_COLLECTION_STAKING_SNAPSHOT },
    { name: 'DB_COLLECTION_SNAP_CONFIG_BALANCE', value: DB_COLLECTION_SNAP_CONFIG_BALANCE },
    { name: 'ADMIN_AND_SNAP_CONFIG_API', value: ADMIN_AND_SNAP_CONFIG_API },
    { name: 'CRON_SCHEDULE', value: CRON_SCHEDULE },
    { name: 'PORT', value: PORT }
];
// Check if each environment variable is set
envVariables.forEach(envVar => {
    if (!envVar.value) {
        throw new Error(`${envVar.name} is not set. Please set this environment variable.`);
    }
});
const app = (0, express_1.default)();
if (!DB_CONNECTION_STRING || !DB_NAME || !DB_COLLECTION) {
    throw new Error("DB_CONNECTION_STRING, DB_NAME, or DB_COLLECTION is not defined.");
}
const getWeb3Instance = (rpcUrl) => {
    if (!rpcUrl) {
        throw new Error("RPC URL is undefined.");
    }
    return new web3_1.default(rpcUrl);
};
function getSnapHodlConfigBalance(snapHodlConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new mongodb_1.MongoClient(DB_CONNECTION_STRING);
        yield client.connect();
        const stakingContractObjects = snapHodlConfig.stakingContractData;
        const stakingContractDataBalances = [];
        const totalStakedBalance = {};
        for (const stakingContractObject of stakingContractObjects) {
            const { stakingContractAddress, tokenContractAddress, chainId } = stakingContractObject;
            const query = {
                stakingContractAddress,
                tokenContractAddress,
                chainId,
            };
            const snapshots = yield client.db(DB_NAME).collection(DB_COLLECTION_STAKING_SNAPSHOT).find(query).toArray();
            let totalBalance = new bignumber_js_1.default(0);
            snapshots.forEach((snapshot) => {
                Object.entries(snapshot.stakedBalances).forEach(([address, balance]) => {
                    const balanceBN = new bignumber_js_1.default(balance);
                    totalBalance = totalBalance.plus(balanceBN);
                    if (totalStakedBalance[address]) {
                        totalStakedBalance[address] = totalStakedBalance[address].plus(balanceBN);
                    }
                    else {
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
        yield client.close();
        const result = {
            snapHodlConfigId: new mongodb_1.ObjectId(snapHodlConfig._id),
            snapShotConfigName: snapHodlConfig.snapShotConfigName,
            stakingContractDataBalances,
            totalStakedBalance: Object.fromEntries(Object.entries(totalStakedBalance).map(([address, balance]) => [address, balance.toString()])),
            createdAt: new Date(),
            updatedAt: new Date(), // add this
        };
        // Reconnect to the database to insert the result
        yield client.connect();
        const collection = client.db(DB_NAME).collection(DB_COLLECTION_SNAP_CONFIG_BALANCE);
        const existingDoc = yield collection.findOne({ snapHodlConfigId: new mongodb_1.ObjectId(snapHodlConfig._id) });
        if (existingDoc) {
            yield collection.updateOne({ snapHodlConfigId: new mongodb_1.ObjectId(snapHodlConfig._id) }, {
                $set: Object.assign(Object.assign({}, result), { updatedAt: new Date(), createdAt: existingDoc.createdAt ? existingDoc.createdAt : new Date() }),
            });
        }
        else {
            yield collection.insertOne(Object.assign(Object.assign({}, result), { createdAt: new Date(), updatedAt: new Date() }));
        }
        yield client.close();
        return result;
    });
}
const processStakingContractDataItem = (item, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_CONNECTION_STRING, APP_NAME) => __awaiter(void 0, void 0, void 0, function* () {
    let totalStakedBalances = {};
    let finalResults = [];
    const stakingPoolName = item.stakingPoolName;
    const stakingContractAddress = item.stakingContractAddress;
    const stakingPoolType = item.stakingPoolType;
    const tokenContractAddress = item.tokenContractAddress;
    const chainId = item.chainId;
    const fromBlock = item.fromBlock;
    const toBlock = item.toBlock;
    const blockIterationSize = item.blockIterationSize;
    const rpcUrl = yield (0, getRpcUrl_1.getRpcUrl)(chainId, APP_NAME, DB_CONNECTION_STRING, DB_NAME, DB_COLLECTION);
    try {
        const web3Instance = getWeb3Instance(rpcUrl);
        const decimals = yield (0, getTokenDecimals_1.getTokenDecimals)(tokenContractAddress, web3Instance);
        console.log("Token decimals:", decimals);
        if (stakingPoolType === "standard") {
            const stakers = yield (0, standardStaking_1.getUniqueStakers)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, web3Instance, fromBlock, toBlock, blockIterationSize, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_CONNECTION_STRING);
            console.log("Unique staker addresses:", stakers);
            const stakedBalances = yield (0, standardStaking_1.getStakedBalances)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, stakers, decimals, web3Instance, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_CONNECTION_STRING);
            console.log("Staked balances:", stakedBalances);
            const result = {
                stakingPoolName: stakingPoolName,
                stakedBalances: stakedBalances,
            };
            console.log("Result:", JSON.stringify(result, null, 2));
            // Update the totalStakedBalances object
            (0, updateTotalStakedBalances_1.updateTotalStakedBalances)(stakedBalances, totalStakedBalances);
            // Add the result to the finalResults array
            finalResults.push(result);
        }
        else if (stakingPoolType === "open") {
            const uniqueStakers = yield (0, openStaking_1.getUniqueStakersFromOpenStaking)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, web3Instance, fromBlock, toBlock, blockIterationSize, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_CONNECTION_STRING);
            console.log("Unique staker addresses from open staking:", uniqueStakers);
            const stakedBalances = yield (0, openStaking_1.getOpenStakingStakedBalances)(stakingPoolName, stakingContractAddress, tokenContractAddress, chainId, uniqueStakers, decimals, web3Instance, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_CONNECTION_STRING);
            console.log("Staked balances from open staking:", stakedBalances);
            const result = {
                stakingPoolName: stakingPoolName,
                stakedBalances: stakedBalances,
            };
            console.log("Result:", JSON.stringify(result, null, 2));
            // Update the totalStakedBalances object
            (0, updateTotalStakedBalances_1.updateTotalStakedBalances)(stakedBalances, totalStakedBalances);
            // Add the result to the finalResults array
            finalResults.push(result);
        }
        // Add logic for other staking pool types here if needed
    }
    catch (error) {
        console.error("Error processing data item:", error);
    }
    // Add the total staked balances to the finalResults array
    finalResults.push({ stakingPoolName: "totalStakedBalances", stakedBalances: totalStakedBalances });
    console.log("Final Results:", JSON.stringify(finalResults, null, 2));
    return finalResults;
});
// Schedule cron job
node_cron_1.default.schedule(CRON_SCHEDULE, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running the job every 5 minutes');
    try {
        // Fetch data from the API
        const response = yield axios_1.default.get(`${ADMIN_AND_SNAP_CONFIG_API}/snapHodlConfig`);
        const data = response.data;
        const snapHodlConfigs = response.data;
        let uniqueStakingContractDataItems = [];
        for (const item of data) {
            const { stakingContractData, isActive } = item;
            if (isActive) {
                uniqueStakingContractDataItems = [
                    ...uniqueStakingContractDataItems,
                    ...stakingContractData
                ];
            }
        }
        // Filter unique stakingContractData based on stakingContractAddress, tokenContractAddress, and chainId
        uniqueStakingContractDataItems = lodash_1.default.uniqBy(uniqueStakingContractDataItems, ({ stakingContractAddress, tokenContractAddress, chainId }) => {
            return `${stakingContractAddress}-${tokenContractAddress}-${chainId}`;
        });
        // Start processing uniqueStakingContractDataItems concurrently
        yield Promise.all(uniqueStakingContractDataItems.map(item => processStakingContractDataItem(item, DB_NAME, DB_COLLECTION_STAKING_SNAPSHOT, DB_CONNECTION_STRING, APP_NAME)));
        // After processStakingContractDataItem function calls
        yield Promise.all(snapHodlConfigs.map(getSnapHodlConfigBalance));
        const utcStr = new Date().toUTCString();
        console.log(`Cron finished at:`, utcStr);
    }
    catch (error) {
        console.error("Error fetching data from the API or processing data:", error);
    }
}));
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send('Server running');
}));
app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
});
