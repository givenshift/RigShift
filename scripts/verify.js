const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "../contracts/RigShift.sol"),
  "utf8"
);

// Standard JSON input for verification
const standardJson = {
  language: "Solidity",
  sources: {
    "RigShift.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"] },
    },
  },
};

fs.writeFileSync(
  path.join(__dirname, "../contracts/standard-input.json"),
  JSON.stringify(standardJson, null, 2)
);

console.log("Written contracts/standard-input.json");
console.log("\n--- Verification details ---");
console.log("Contract address: 0x97DF7183cd38d1c95D2bE8491382373AF8D883aF");
console.log("Contract name:    RigShift");
console.log("Compiler:         v0.8.35+commit.47b9dedd");
console.log("Optimizer:        enabled, 200 runs");
console.log("EVM version:      default (cancun)");
console.log("License:          MIT");
