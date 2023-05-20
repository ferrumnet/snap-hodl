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
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const web3_1 = __importDefault(require("web3"));
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
// The data array containing staking contract and token contract addresses
const data = [
    {
        stakingPoolName: "GC - VIP Pool - FRM Arbitrum",
        stakingContractAddress: "0x2bE7904c81dd3535f31B2C7B524a6ed91FDb37EC",
        stakingPoolType: "standard",
        tokenContractAddress: "0x9f6abbf0ba6b5bfa27f4deb6597cc6ec20573fda",
        chainId: "42161",
        fromBlock: 70124014,
        toBlock: 72509478,
        blockIterationSize: 100000
    },
    {
        stakingPoolName: "cFRM Arbitrum Open Staking",
        stakingContractAddress: "0xb4927895cbee88e651e0582893051b3b0f8d7db8",
        stakingPoolType: "open",
        tokenContractAddress: "0xe685d3cc0be48bd59082ede30c3b64cbfc0326e2",
        chainId: "42161",
        fromBlock: 66553295,
        toBlock: "latest",
        blockIterationSize: 100000
    },
    {
        stakingPoolName: "cFRM BSC Open Staking",
        stakingContractAddress: "0x35e15ff9ebb37d8c7a413fd85bad515396dc8008",
        stakingPoolType: "open",
        tokenContractAddress: "0xaf329a957653675613d0d98f49fc93326aeb36fc",
        chainId: "56",
        fromBlock: 17333067,
        toBlock: "latest",
        blockIterationSize: 10000
    }
];
node_cron_1.default.schedule('*/5 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running the job every hour');
    let totalStakedBalances = {};
    let finalResults = [];
    for (const item of data) {
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
                const stakedBalances = yield (0, standardStaking_1.getStakedBalances)(stakingPoolName, stakingContractAddress, stakers, decimals, web3Instance);
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
                const stakedBalances = yield (0, openStaking_1.getOpenStakingStakedBalances)(stakingPoolName, stakingContractAddress, tokenContractAddress, uniqueStakers, decimals, web3Instance);
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
}));
app.get('/runScript', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
}));
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send('Server running');
}));
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
