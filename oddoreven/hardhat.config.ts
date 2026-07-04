import type { HardhatUserConfig } from "hardhat/config";

// Importa o plugin necessário para o runner do Mocha/TypeScript no Hardhat v3
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  // ATENÇÃO: É obrigatório declarar o plugin aqui no Hardhat v3 para mapear os arquivos .test.ts
  plugins: [hardhatToolboxMochaEthersPlugin],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: false, 
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      allowBlocksWithSameTimestamp: true,
      blockGasLimit: 1099511627775n,
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
      allowBlocksWithSameTimestamp: true,
      blockGasLimit: 1099511627775n,
    },
    local: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
    bscTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.BSCTEST_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: process.env.PVK_ACCOUNT1 ? [process.env.PVK_ACCOUNT1] : [],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },
};

export default config;