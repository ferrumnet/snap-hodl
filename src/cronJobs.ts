// src/cronJobs.ts

import cron from 'node-cron';
import axios from "axios";
import _ from 'lodash';
import { SnapHodlConfig, StakingContractDataItem, TradingVolumeContractDataItem } from "./types";
import { retrieveSnapHodlConfigs } from './controllers/snapHodlConfigController';
import {
    processStakingContractDataItem,
    getSnapHodlConfigBalance,
    processTradingContractDataItem,
    getSnapHodlConfigTradingVolumeBalance,
    getSnapShotBySnapShotUserVolumeAndReward,
  } from "./utils/helpers";
import {
    APP_NAME,
    DB_CONNECTION_STRING,
    DB_NAME,
    DB_COLLECTION_STAKING_SNAPSHOT,
    CRON_SCHEDULE
} from './config';

export const scheduleJobs = () => {
    // Schedule cron job
    cron.schedule(CRON_SCHEDULE!, async () => {
        console.log('Running the job every 5 minutes');
        try {
            // Fetch data from the API
            
            const snapHodlConfigs: SnapHodlConfig[] = await retrieveSnapHodlConfigs();

            let uniqueStakingContractDataItems: StakingContractDataItem[] = [];
            let uniqueTradingContractDataItems: TradingVolumeContractDataItem[] = [];
            for (const item of snapHodlConfigs) {
                const { stakingContractData, tradingVolumeContractData, isActive } = item;
                if (isActive) {
                    uniqueStakingContractDataItems = [
                        ...uniqueStakingContractDataItems,
                        ...stakingContractData
                    ];
                    uniqueTradingContractDataItems = [
                        ...uniqueTradingContractDataItems,
                        ...tradingVolumeContractData,
                      ];
                }
            }

            // Filter unique stakingContractData based on stakingContractAddress, tokenContractAddress, and chainId
            uniqueStakingContractDataItems = _.uniqBy(uniqueStakingContractDataItems, ({ stakingContractAddress, tokenContractAddress, chainId }) => {
                return `${stakingContractAddress}-${tokenContractAddress}-${chainId}`;
            });

            // Filter unique tradingVolumeContractData based on liquidityPoolAddress, tokenContractAddress, and chainId
            uniqueTradingContractDataItems = _.uniqBy(uniqueTradingContractDataItems, ({ liquidityPoolAddress, tokenContractAddress, chainId }) => {
                return `${liquidityPoolAddress}-${tokenContractAddress}-${chainId}`;
                }
            );

            // Start processing uniqueTradingContractDataItems concurrently
            await Promise.all(
                uniqueTradingContractDataItems.map((item) =>
                  processTradingContractDataItem(item)
                )
              );

            // Start processing uniqueStakingContractDataItems concurrently
            await Promise.all(uniqueStakingContractDataItems.map(item => processStakingContractDataItem(
                item,
                DB_NAME!,
                DB_COLLECTION_STAKING_SNAPSHOT!,
                DB_CONNECTION_STRING!,
                APP_NAME!
            )));

            // After uniqueTradingContractDataItems function calls
            await Promise.all(snapHodlConfigs.map(getSnapHodlConfigTradingVolumeBalance));

            // After processStakingContractDataItem function calls
            await Promise.all(snapHodlConfigs.map(getSnapHodlConfigBalance));

            // sum the volume of user and their reward
            await Promise.all(snapHodlConfigs.map(getSnapShotBySnapShotUserVolumeAndReward));

            const utcStr = new Date().toUTCString();
            console.log(`Cron finished at:`, utcStr);

        } catch (error) {
            console.error("Error fetching data from the API or processing data:", error);
        }
    });
};
