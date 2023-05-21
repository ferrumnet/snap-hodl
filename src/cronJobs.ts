// src/cronJobs.ts

import cron from 'node-cron';
import axios from "axios";
import _ from 'lodash';
import { SnapHodlConfig, StakingContractDataItem } from "./types";
import { processStakingContractDataItem, getSnapHodlConfigBalance } from "./utils/helpers";
import {
    APP_NAME,
    DB_CONNECTION_STRING,
    DB_NAME,
    DB_COLLECTION_STAKING_SNAPSHOT,
    CRON_SCHEDULE,
    ADMIN_AND_SNAP_CONFIG_API
} from './config';

export const scheduleJobs = () => {
    // Schedule cron job
    cron.schedule(CRON_SCHEDULE!, async () => {
        console.log('Running the job every 5 minutes');
        try {
            // Fetch data from the API
            const response = await axios.get(`${ADMIN_AND_SNAP_CONFIG_API}/snapHodlConfig`);
            const data = response.data;
            const snapHodlConfigs: SnapHodlConfig[] = response.data;

            let uniqueStakingContractDataItems: StakingContractDataItem[] = [];
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
            uniqueStakingContractDataItems = _.uniqBy(uniqueStakingContractDataItems, ({ stakingContractAddress, tokenContractAddress, chainId }) => {
                return `${stakingContractAddress}-${tokenContractAddress}-${chainId}`;
            });

            // Start processing uniqueStakingContractDataItems concurrently
            await Promise.all(uniqueStakingContractDataItems.map(item => processStakingContractDataItem(
                item,
                DB_NAME!,
                DB_COLLECTION_STAKING_SNAPSHOT!,
                DB_CONNECTION_STRING!,
                APP_NAME!
            )));

            // After processStakingContractDataItem function calls
            await Promise.all(snapHodlConfigs.map(getSnapHodlConfigBalance));

            const utcStr = new Date().toUTCString();
            console.log(`Cron finished at:`, utcStr);

        } catch (error) {
            console.error("Error fetching data from the API or processing data:", error);
        }
    });
};
