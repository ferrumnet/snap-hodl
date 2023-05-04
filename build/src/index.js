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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const web3_1 = __importDefault(require("web3"));
const mongodb_1 = require("mongodb");
const bignumber_js_1 = require("bignumber.js");
const tokenContractAbi_json_1 = __importDefault(require("../ABI/tokenContractAbi.json"));
const standardStaking_1 = require("./standardStaking");
const openStaking_1 = require("./openStaking");
dotenv_1.default.config();
const DB_CONNECTION_STRING = (_a = process.env.DB_CONNECTION_STRING) !== null && _a !== void 0 ? _a : "";
const DB_NAME = (_b = process.env.DB_NAME) !== null && _b !== void 0 ? _b : "";
const DB_COLLECTION = (_c = process.env.DB_COLLECTION) !== null && _c !== void 0 ? _c : "";
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
    // {
    //   stakingPoolName: "GC - VIP Pool - FRM Arbitrum",
    //   stakingContractAddress: "0x2bE7904c81dd3535f31B2C7B524a6ed91FDb37EC",
    //   stakingPoolType: "standard",
    //   tokenContractAddress: "0x9f6abbf0ba6b5bfa27f4deb6597cc6ec20573fda",
    //   chainId: "42161",
    // },
    {
        stakingPoolName: "cFRM Arbitrum Open Staking",
        stakingContractAddress: "0xb4927895cbee88e651e0582893051b3b0f8d7db8",
        stakingPoolType: "open",
        tokenContractAddress: "0xe685d3cc0be48bd59082ede30c3b64cbfc0326e2",
        chainId: "42161",
    }
];
const getRpcUrl = (chainId, appName = "snapshot") => __awaiter(void 0, void 0, void 0, function* () {
    const client = new mongodb_1.MongoClient(DB_CONNECTION_STRING);
    try {
        yield client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(DB_COLLECTION);
        const document = yield collection.findOne({ appName });
        if (document) {
            const chainIdToNetworkMap = document.chainIdToNetworkMap;
            const rpcDetails = chainIdToNetworkMap.find((item) => item.chainId === chainId);
            if (rpcDetails) {
                return rpcDetails.jsonRpcUrl;
            }
        }
    }
    catch (error) {
        console.error("Error fetching RPC URL:", error);
    }
    finally {
        yield client.close();
    }
    return undefined;
});
function getTokenDecimals(tokenContractAddress, web3) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching token decimals...");
        let decimals = 18;
        try {
            const tokenContract = new web3.eth.Contract(tokenContractAbi_json_1.default, tokenContractAddress);
            decimals = parseInt(yield tokenContract.methods.decimals().call());
        }
        catch (error) {
            console.error("Error fetching token decimals:", error);
        }
        console.log("Token decimals fetched.");
        return decimals;
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    let totalStakedBalances = {};
    let finalResults = [];
    for (const item of data) {
        const stakingContractAddress = item.stakingContractAddress;
        const tokenContractAddress = item.tokenContractAddress;
        const chainId = item.chainId;
        const rpcUrl = yield getRpcUrl(chainId);
        try {
            const web3Instance = getWeb3Instance(rpcUrl);
            const decimals = yield getTokenDecimals(tokenContractAddress, web3Instance);
            console.log("Token decimals:", decimals);
            if (item.stakingPoolType === "standard") {
                const stakers = yield (0, standardStaking_1.getUniqueStakers)(stakingContractAddress, web3Instance);
                console.log("Unique staker addresses:", stakers);
                const stakedBalances = yield (0, standardStaking_1.getStakedBalances)(stakers, decimals, stakingContractAddress, web3Instance);
                console.log("Staked balances:", stakedBalances);
                const stakingPoolName = item.stakingPoolName;
                console.log("Staking pool name:", stakingPoolName);
                const result = {
                    stakingPoolName: stakingPoolName,
                    stakedBalances: Object.fromEntries(stakedBalances),
                };
                console.log("Result:", JSON.stringify(result, null, 2));
                // Update the totalStakedBalances object
                stakedBalances.forEach((value, key) => {
                    if (totalStakedBalances[key]) {
                        const existingBalance = new bignumber_js_1.BigNumber(totalStakedBalances[key]);
                        const newBalance = existingBalance.plus(value);
                        totalStakedBalances[key] = newBalance.toString();
                    }
                    else {
                        totalStakedBalances[key] = value;
                    }
                });
                // Add the result to the finalResults array
                finalResults.push(result);
            }
            else if (item.stakingPoolType === "open") {
                const uniqueStakers = yield (0, openStaking_1.getUniqueStakersFromOpenStaking)(web3Instance, stakingContractAddress, tokenContractAddress);
                console.log("Unique staker addresses from open staking:", uniqueStakers);
                const stakedBalances = yield (0, openStaking_1.getOpenStakingStakedBalances)(web3Instance, stakingContractAddress, tokenContractAddress, uniqueStakers, decimals);
                console.log("Staked balances from open staking:", stakedBalances);
                // Rest of the logic to store and display results for open staking
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
}))();
