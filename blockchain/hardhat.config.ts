import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";

const sepoliaUrl = process.env.SEPOLIA_RPC_URL ?? "";
const deployerKey = process.env.BLOCKCHAIN_PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: sepoliaUrl,
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
};

export default config;
