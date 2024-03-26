// src/controllers/snapHodlConfigController.ts

import { Request, Response } from 'express';
import SnapHodlConfigModel from '../models/SnapHodlConfig';
import SnapHodlConfigBalanceModel from '../models/SnapHodlConfigBalance';
import { SnapHodlConfig } from '../types';
import mongoose from 'mongoose';


function sortStakingContractData(data: any[]) {
  return data.sort((a, b) => a.stakingPoolName.localeCompare(b.stakingPoolName));
}

function toLowerCaseStakingContractData(data: any[]) {
  return data.map(item => ({
    ...item,
    stakingContractAddress: item.stakingContractAddress.toLowerCase(),
    tokenContractAddress: item.tokenContractAddress.toLowerCase(),
    stakingPoolType: item.stakingPoolType.toLowerCase(),
}));
}


export const retrieveSnapHodlConfigs = async (): Promise<SnapHodlConfig[]> => {
  try {
    return await SnapHodlConfigModel.find();
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message);
    } else {
      throw new Error('An error occurred when attempting to fetch SnapHodlConfigs');
  }
  }
};



export const getSnapHodlConfigs = async (req: Request, res: Response) => {
  try {
    const snapHodlConfigs = await retrieveSnapHodlConfigs();
    res.json(snapHodlConfigs);
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ message: err.message });
    } else {
      res.status(500).json({ message: 'An error occurred when attempting to request SnapHodlConfigs to be retrieved' });
  }
  }
};


export const createSnapHodlConfig = async (req: Request, res: Response) => {
  const { snapShotConfigName, isActive, stakingContractData } = req.body;

    // Convert stakingContractData values to lower case
    const lowerCaseStakingContractData = toLowerCaseStakingContractData(stakingContractData);

    // Sort stakingContractData by stakingPoolName for consistent comparison
    const sortedStakingContractData = sortStakingContractData(lowerCaseStakingContractData);

  // Check for duplicate stakingContractData
  const duplicateConfig = await SnapHodlConfigModel.findOne({
    stakingContractData: { $eq: sortedStakingContractData },
  });

  if (duplicateConfig) {
    return res.status(400).json({
      message: `Duplicate stakingContractData detected. Please use the ${duplicateConfig.snapShotConfigName} config, which has the same stakingContractData, or change the stakingContractData for the new config.`
    });
  }

  const newSnapHodlConfig = new SnapHodlConfigModel({
    snapShotConfigName,
    isActive,
    stakingContractData: sortedStakingContractData,
  });

  try {
    const savedSnapHodlConfig = await newSnapHodlConfig.save();
    res.json(savedSnapHodlConfig);
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ message: err.message });
    } else {
      res.status(500).json({ message: 'An error occurred' });
    }
  }
};

export const getSnapShotBySnapShotIdAndAddress = async (req: Request, res: Response) => {
  try {
    let { snapShotId, address } = req.params;
    const { raw } = req.query;

    address = address.toLowerCase();

    const snapHodlConfigBalance = await SnapHodlConfigBalanceModel.findOne({ snapHodlConfigId: snapShotId });

    if (!snapHodlConfigBalance) {
      return res.status(404).json({ message: 'SnapShot not found' });
    }

    const snapShotBalance = snapHodlConfigBalance.totalStakedBalance.get(address);

    if (!snapShotBalance) {
      return res.status(404).json({ message: 'Address not found in SnapShot' });
    }

    if (raw === 'true') {
      return res.send(snapShotBalance.toString());
    } else {
      const result = {
        snapShotConfigName: snapHodlConfigBalance.snapShotConfigName,
        address: address,
        snapShotBalance: snapShotBalance,
        updatedAt: snapHodlConfigBalance.updatedAt,
      };

      return res.json(result);
    }
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    } else {
      return res.status(500).json({ message: "An unexpected error occurred." });
    }
  }
};

// New function to retrieve all documents from DB_COLLECTION_SNAP_CONFIG_BALANCE
export const getAllSnapShots = async (req: Request, res: Response) => {
  try {
    const query: { [key: string]: any } = {};
    if(req.query.snapHodlConfigId){
      query.snapHodlConfigId = req.query.snapHodlConfigId;
    }
    const page = parseInt(req.query.page as string) || 1; // defaults to 1 if not provided
    const limit = parseInt(req.query.limit as string) || 10; // defaults to 10 if not provided
    const skip = (page - 1) * limit;

    // Find all documents in the collection with pagination
    const snapHodlConfigBalances = await SnapHodlConfigBalanceModel.find(query).skip(skip).limit(limit);

    // Send the result as a JSON response
    return res.json(snapHodlConfigBalances);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    } else {
      return res.status(500).json({ message: "An unexpected error occurred." });
    }
  }
};

// export async function saveBulkUserTransactionVolume(
//   data: any
// ): Promise<any | null> {
//   // const client = new MongoClient(connectionString);
//   //   let leaderboard = null;
//   try {
//     //   await client.connect();
//     //   const database = client.db(dbName);
//     //   console.log('database: ', database);
//     //   const collection = database.collection(dbCollection);

//     //   console.log('collection: ', collection);

//     const bulkOperations: any = [];

//     // Prepare update operations for existing documents
//     Object.keys(data).forEach((item) => {
//       bulkOperations.push({
//         updateOne: {
//           filter: { walletAddress: item }, // Filter by unique key
//           update: {
//             $set: { walletAddress: item, totalVolume: data[item] },
//           }, // Update all fields in the document
//           upsert: true, // Insert a new document if no match is found
//         },
//       });
//     });

//     // You can add additional insertOne operations for new documents here
//     console.log('bulkOperations: ', bulkOperations);
//     const result = await LeaderboardModel.bulkWrite(bulkOperations);
//     console.log('result: ', result);
//   } catch (err) {
//     console.error(
//       'Error while saving the data against address the database:',
//       err
//     );
//   }
//   //   return leaderboard;
// }
