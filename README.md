Snapshot by Ferrum Network
==================================

Snapshot is a command-line utility designed to gather staking information from various staking contracts across multiple blockchain networks. This tool is capable of fetching unique staker addresses, calculating staked balances, and summing the staked balances from all staking contracts, regardless of the blockchain network they are deployed on.

Key Features
------------

-   Fetches unique staker addresses and staked balances from different types of staking contracts.
-   Supports standard staking contracts as well as open staking contracts.
-   Handles staking contracts deployed across multiple blockchain networks.
-   Aggregates the total staked balance from all staking contracts.
-   Retrieves the appropriate RPC URL for each blockchain network by querying a MongoDB database.
-   Modular code organization for easy maintenance and extensibility.

Prerequisites
-------------

To run and build Snapshot, you need to have the following software installed on your system:

-   [Node.js](https://nodejs.org/en/download/) (version 14.x or higher)
-   [npm](https://www.npmjs.com/get-npm) (usually bundled with Node.js)
-   [MongoDB](https://www.mongodb.com/try/download/community) (version 4.4 or higher)

Installation
------------

Clone the repository:

```sh

git clone https://github.com/yourusername/snapshot-tooling.git
```

Change to the project directory:

```sh

cd snapshot
```

Install the dependencies:

```sh

npm install
```

Configuration
-------------

Create a `.env` file in the root directory of the project and add the following environment variables:

```dotenv

DB_CONNECTION_STRING=mongodb://username:password@host:port
DB_NAME=your_database_name
DB_COLLECTION=your_collection_name
APP_NAME=snapshot
```

Replace the values with your actual MongoDB connection string, database name, and collection name. 

IMPORTANT: Leave APP_NAME value as `snapshot`.

Running the Tool
----------------

To run Snapshot, use the following command:

```sh

npm start
```

The tool will then fetch the staking data from the specified contracts and display the results in the terminal.

Building the Tool
-----------------

To build the tool, use the following command:

```sh

npm run build
```

This will compile the TypeScript files into JavaScript and output them in the `build` directory.

Contributing
------------

We welcome contributions to the Snapshot project. If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

License
-------

Snapshot by Ferrum Network is released under the [MIT License](./LICENSE).