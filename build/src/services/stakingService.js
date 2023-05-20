"use strict";
// src/services/stakingService.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveStakingSnapshot = exports.getLatestStakingSnapshot = void 0;
const mongodb_1 = require("mongodb");
function getLatestStakingSnapshot(stakingContractAddress, tokenContractAddress, chainId, dbName, dbCollection, connectionString) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new mongodb_1.MongoClient(connectionString);
        let snapshot = null;
        try {
            yield client.connect();
            const database = client.db(dbName);
            const collection = database.collection(dbCollection);
            const filter = {
                stakingContractAddress,
                tokenContractAddress,
                chainId
            };
            snapshot = yield collection.findOne(filter);
        }
        catch (err) {
            console.error("Error fetching the latest staking snapshot from the database:", err);
        }
        finally {
            yield client.close();
        }
        return snapshot;
    });
}
exports.getLatestStakingSnapshot = getLatestStakingSnapshot;
function saveStakingSnapshot(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, latestBlockCaptured, uniqueStakers, dbName, dbCollection, connectionString) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new mongodb_1.MongoClient(connectionString);
        try {
            yield client.connect();
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
            yield collection.updateOne(filter, update, options);
        }
        catch (err) {
            console.error("Error saving staking snapshot to the database:", err);
        }
        finally {
            yield client.close();
        }
    });
}
exports.saveStakingSnapshot = saveStakingSnapshot;
