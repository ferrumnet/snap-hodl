// src/types.ts

import { ObjectId } from "mongodb";

export type StakingContractDataItem = {
  stakingPoolName: string;
  stakingContractAddress: string;
  stakingPoolType: string;
  tokenContractAddress: string;
  chainId: string;
  fromBlock: number | "latest";
  toBlock: number | "latest";
  blockIterationSize: number
};

export type SnapHodlConfig = {
  _id: string;
  snapShotConfigName: string;
  stakingContractData: StakingContractDataItem[];
  __v?: number;
  isActive: boolean;
};

export type SnapHodlConfigFullDb = {
  _id: string;
  chainId: string;
  stakingContractAddress: string;
  tokenContractAddress: string;
  latestBlockCaptured: number;
  stakingPoolName: string;
  stakingPoolType: string;
  uniqueStakers: string[];
  stakedBalances: { [address: string]: string };
}

export type SnapHodlConfigBalance = {
  snapHodlConfigId: ObjectId;
  snapShotConfigName: string;
  stakingContractDataBalances: {
    stakingContractAddress: string;
    tokenContractAddress: string;
    chainId: string;
    totalStakedBalance: string;
  }[];
  totalStakedBalance: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};
