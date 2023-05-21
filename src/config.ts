// src/config.ts

import dotenv from 'dotenv';

dotenv.config();

export const APP_NAME = process.env.APP_NAME;
export const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING;
export const DB_NAME = process.env.DB_NAME;
export const DB_COLLECTION = process.env.DB_COLLECTION;
export const DB_COLLECTION_STAKING_SNAPSHOT = process.env.DB_COLLECTION_STAKING_SNAPSHOT;
export const DB_COLLECTION_SNAP_CONFIG_BALANCE = process.env.DB_COLLECTION_SNAP_CONFIG_BALANCE;
export const ADMIN_AND_SNAP_CONFIG_API = process.env.ADMIN_AND_SNAP_CONFIG_API;
export const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
export const PORT = process.env.PORT;

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