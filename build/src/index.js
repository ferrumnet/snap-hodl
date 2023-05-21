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
var _a, _b, _c, _d, _e;
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
dotenv_1.default.config();
const APP_NAME = process.env.APP_NAME;
const DB_CONNECTION_STRING = (_a = process.env.DB_CONNECTION_STRING) !== null && _a !== void 0 ? _a : "";
const DB_NAME = (_b = process.env.DB_NAME) !== null && _b !== void 0 ? _b : "";
const DB_COLLECTION = (_c = process.env.DB_COLLECTION) !== null && _c !== void 0 ? _c : "";
const DB_COLLECTION_STAKING_SNAPSHOT = (_d = process.env.DB_COLLECTION_STAKING_SNAPSHOT) !== null && _d !== void 0 ? _d : "";
const ADMIN_AND_SNAP_CONFIG_API = (_e = process.env.ADMIN_AND_SNAP_CONFIG_API) !== null && _e !== void 0 ? _e : "";
const app = (0, express_1.default)();
const port = process.env.PORT || 8081;
if (!DB_CONNECTION_STRING || !DB_NAME || !DB_COLLECTION) {
    throw new Error("DB_CONNECTION_STRING, DB_NAME, or DB_COLLECTION is not defined.");
}
const getWeb3Instance = (rpcUrl) => {
    if (!rpcUrl) {
        throw new Error("RPC URL is undefined.");
    }
    return new web3_1.default(rpcUrl);
};
// Schedule cron job
node_cron_1.default.schedule('*/5 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running the job every hour');
    try {
        // Fetch data from the API
        const response = yield axios_1.default.get(`${ADMIN_AND_SNAP_CONFIG_API}/snapHodlConfig`);
        const data = response.data;
        for (const item of data) {
            let totalStakedBalances = {};
            let finalResults = [];
            const stakingContractData = item.stakingContractData;
            console.log(`Staking Contract Data Received:`, stakingContractData);
            if (item.isActive) {
                for (const item of stakingContractData) {
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
                        continue;
                    }
                }
                // Add the total staked balances to the finalResults array
                finalResults.push({ stakingPoolName: "totalStakedBalances", stakedBalances: totalStakedBalances });
                console.log("Final Results:", JSON.stringify(finalResults, null, 2));
            }
        }
    }
    catch (error) {
        console.error("Error fetching data from the API or processing data:", error);
    }
}));
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send('Server running');
}));
app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
