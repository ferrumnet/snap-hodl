"use strict";
// src/cronJobs.ts
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
exports.scheduleJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const lodash_1 = __importDefault(require("lodash"));
const helpers_1 = require("./utils/helpers");
const config_1 = require("./config");
const scheduleJobs = () => {
    // Schedule cron job
    node_cron_1.default.schedule(config_1.CRON_SCHEDULE, () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('Running the job every 5 minutes');
        try {
            // Fetch data from the API
            const response = yield axios_1.default.get(`${config_1.ADMIN_AND_SNAP_CONFIG_API}/snapHodlConfig`);
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
            yield Promise.all(uniqueStakingContractDataItems.map(item => (0, helpers_1.processStakingContractDataItem)(item, config_1.DB_NAME, config_1.DB_COLLECTION_STAKING_SNAPSHOT, config_1.DB_CONNECTION_STRING, config_1.APP_NAME)));
            // After processStakingContractDataItem function calls
            yield Promise.all(snapHodlConfigs.map(helpers_1.getSnapHodlConfigBalance));
            const utcStr = new Date().toUTCString();
            console.log(`Cron finished at:`, utcStr);
        }
        catch (error) {
            console.error("Error fetching data from the API or processing data:", error);
        }
    }));
};
exports.scheduleJobs = scheduleJobs;
