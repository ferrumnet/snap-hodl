Snapshot by Ferrum Network
=============

A simple tool to extract a snapshot of balances across staking contracts.

Getting Started
---------------

These instructions will help you set up and run the project on your local machine.

### Prerequisites

You need to have the following installed on your machine:

-   Node.js (v14 or later): <https://nodejs.org/en/download/>
-   npm (v6 or later): <https://www.npmjs.com/get-npm>
-   TypeScript (v4 or later): <https://www.typescriptlang.org/download>

### Installing Dependencies

After cloning the repository, navigate to the project directory and run the following command to install the necessary dependencies:


```bash
npm install
```

This command will install all dependencies listed in the `package.json` file.

### Configuration

Before running the project, you need to set up the RPC URL for your Ethereum node. Open the `./index.ts` file and replace the following line with the correct RPC URL:

```javascript

const rpcUrl = "https://nd-499-825-018.p2pify.com/5d8bab30e1462f48144c36f18d2ee958";
```

### Building the Project

To build the project, run the following command in the project directory:

```bash
tsc
```

This will compile the TypeScript code into JavaScript in the `./dist` directory.

### Running the Project

To run the project, execute the following command in the project directory:

```bash
node dist/index.js
```

This command will run the compiled JavaScript code, and the output will display the unique staker addresses for the specified staking pool.

License
-------

This project is licensed under the MIT License - see the [LICENSE.md](./LICENSE) file for details.