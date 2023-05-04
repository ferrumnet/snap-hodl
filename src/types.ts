// src/types.ts

export type StakingContractDataItem = {
    stakingPoolName: string;
    stakingContractAddress: string;
    stakingPoolType: string;
    tokenContractAddress: string;
    chainId: string;
    fromBlock: number | "latest";
    toBlock: number | "latest";
  };
  