// src/utils/getRpcUrl.ts

import { MongoClient } from "mongodb";

export const getRpcUrl = async (chainId: string, appName: string = "snapshot", DB_CONNECTION_STRING: string, DB_NAME: string, DB_COLLECTION: string): Promise<string | undefined> => {

  const client = new MongoClient(DB_CONNECTION_STRING);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(DB_COLLECTION);

    const document = await collection.findOne({ appName });

    if (document) {
      const chainIdToNetworkMap = document.chainIdToNetworkMap;
      const rpcDetails = chainIdToNetworkMap.find((item: any) => item.chainId === chainId);

      if (rpcDetails) {
        return rpcDetails.jsonRpcUrl;
      }
    }
  } catch (error) {
    console.error("Error fetching RPC URL:", error);
  } finally {
    await client.close();
  }

  return undefined;
};