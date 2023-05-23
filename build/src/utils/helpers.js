"use strict";
// src/utils/helpers.ts
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
exports.getSnapHodlConfigBalance = exports.processStakingContractDataItem = exports.getWeb3Instance = void 0;
const config_1 = require("../config");
const mongodb_1 = require("mongodb");
const web3_1 = __importDefault(require("web3"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const getRpcUrl_1 = require("./getRpcUrl");
const openStaking_1 = require("../openStaking");
const standardStaking_1 = require("../standardStaking");
const getTokenDecimals_1 = require("./getTokenDecimals");
const updateTotalStakedBalances_1 = require("./updateTotalStakedBalances");
const getWeb3Instance = (rpcUrl) => {
    if (!rpcUrl) {
        throw new Error("RPC URL is undefined.");
    }
    return new web3_1.default(rpcUrl);
};
exports.getWeb3Instance = getWeb3Instance;
const processStakingContractDataItem = (item, dbName, collectionName, connectionString, appName) => __awaiter(void 0, void 0, void 0, function* () {
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
    const rpcUrl = yield (0, getRpcUrl_1.getRpcUrl)(chainId, config_1.APP_NAME, config_1.DB_CONNECTION_STRING, config_1.DB_NAME, config_1.DB_COLLECTION);
    try {
        const web3Instance = (0, exports.getWeb3Instance)(rpcUrl);
        const decimals = yield (0, getTokenDecimals_1.getTokenDecimals)(tokenContractAddress, web3Instance);
        console.log("Token decimals:", decimals);
        if (stakingPoolType === "standard") {
            const stakers = yield (0, standardStaking_1.getUniqueStakers)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, web3Instance, fromBlock, toBlock, blockIterationSize, config_1.DB_NAME, config_1.DB_COLLECTION_STAKING_SNAPSHOT, config_1.DB_CONNECTION_STRING);
            console.log("Unique staker addresses:", stakers);
            const stakedBalances = yield (0, standardStaking_1.getStakedBalances)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, stakers, decimals, web3Instance, config_1.DB_NAME, config_1.DB_COLLECTION_STAKING_SNAPSHOT, config_1.DB_CONNECTION_STRING);
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
            const uniqueStakers = yield (0, openStaking_1.getUniqueStakersFromOpenStaking)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, web3Instance, fromBlock, toBlock, blockIterationSize, config_1.DB_NAME, config_1.DB_COLLECTION_STAKING_SNAPSHOT, config_1.DB_CONNECTION_STRING);
            console.log("Unique staker addresses from open staking:", uniqueStakers);
            const stakedBalances = yield (0, openStaking_1.getOpenStakingStakedBalances)(stakingPoolName, stakingContractAddress, tokenContractAddress, chainId, uniqueStakers, decimals, web3Instance, config_1.DB_NAME, config_1.DB_COLLECTION_STAKING_SNAPSHOT, config_1.DB_CONNECTION_STRING);
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
exports.processStakingContractDataItem = processStakingContractDataItem;
const getSnapHodlConfigBalance = (snapHodlConfig) => __awaiter(void 0, void 0, void 0, function* () {
    if (!snapHodlConfig.isActive) {
        return;
    }
    const client = new mongodb_1.MongoClient(config_1.DB_CONNECTION_STRING);
    yield client.connect();
    console.log(`${snapHodlConfig.snapShotConfigName} isActive:`, snapHodlConfig.isActive);
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
        const snapshots = yield client.db(config_1.DB_NAME).collection(config_1.DB_COLLECTION_STAKING_SNAPSHOT).find(query).toArray();
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
    const collection = client.db(config_1.DB_NAME).collection(config_1.DB_COLLECTION_SNAP_CONFIG_BALANCE);
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
exports.getSnapHodlConfigBalance = getSnapHodlConfigBalance;
