import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";

const deployerKey = process.env.BLOCKCHAIN_PRIVATE_KEY ?? "";
const accounts = deployerKey ? [deployerKey] : [];

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
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts,
      chainId: 11155111,
    },
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL ?? "",
      accounts,
      chainId: 80002,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL ?? "",
      accounts,
      chainId: 137,
    },
  },
};

export default config;
