"use strict";
// src/config.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = exports.CRON_SCHEDULE = exports.ADMIN_AND_SNAP_CONFIG_API = exports.DB_COLLECTION_SNAP_CONFIG_BALANCE = exports.DB_COLLECTION_STAKING_SNAPSHOT = exports.DB_COLLECTION = exports.DB_NAME = exports.DB_CONNECTION_STRING = exports.APP_NAME = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.APP_NAME = process.env.APP_NAME;
exports.DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING;
exports.DB_NAME = process.env.DB_NAME;
exports.DB_COLLECTION = process.env.DB_COLLECTION;
exports.DB_COLLECTION_STAKING_SNAPSHOT = process.env.DB_COLLECTION_STAKING_SNAPSHOT;
exports.DB_COLLECTION_SNAP_CONFIG_BALANCE = process.env.DB_COLLECTION_SNAP_CONFIG_BALANCE;
exports.ADMIN_AND_SNAP_CONFIG_API = process.env.ADMIN_AND_SNAP_CONFIG_API;
exports.CRON_SCHEDULE = process.env.CRON_SCHEDULE;
exports.PORT = process.env.PORT;
// An array to hold the environment variables
const envVariables = [
    { name: 'APP_NAME', value: exports.APP_NAME },
    { name: 'DB_CONNECTION_STRING', value: exports.DB_CONNECTION_STRING },
    { name: 'DB_NAME', value: exports.DB_NAME },
    { name: 'DB_COLLECTION', value: exports.DB_COLLECTION },
    { name: 'DB_COLLECTION_STAKING_SNAPSHOT', value: exports.DB_COLLECTION_STAKING_SNAPSHOT },
    { name: 'DB_COLLECTION_SNAP_CONFIG_BALANCE', value: exports.DB_COLLECTION_SNAP_CONFIG_BALANCE },
    { name: 'ADMIN_AND_SNAP_CONFIG_API', value: exports.ADMIN_AND_SNAP_CONFIG_API },
    { name: 'CRON_SCHEDULE', value: exports.CRON_SCHEDULE },
    { name: 'PORT', value: exports.PORT }
];
// Check if each environment variable is set
envVariables.forEach(envVar => {
    if (!envVar.value) {
        throw new Error(`${envVar.name} is not set. Please set this environment variable.`);
    }
});
