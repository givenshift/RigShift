const solc = require("solc");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "../contracts/RigShift.sol"),
  "utf8"
);

const input = {
  language: "Solidity",
  sources: {
    "RigShift.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  output.errors.forEach((e) => {
    if (e.severity === "error") {
      console.error(e.formattedMessage);
      process.exit(1);
    } else {
      console.warn(e.formattedMessage);
    }
  });
}

const contract = output.contracts["RigShift.sol"]["RigShift"];
const bytecode = "0x" + contract.evm.bytecode.object;
const abi = contract.abi;

console.log("=== BYTECODE ===");
console.log(bytecode);
console.log("\n=== ABI ===");
console.log(JSON.stringify(abi, null, 2));

// Write to file for easy copy
fs.writeFileSync(
  path.join(__dirname, "../contracts/RigShift.bytecode.txt"),
  bytecode
);
fs.writeFileSync(
  path.join(__dirname, "../contracts/RigShift.abi.json"),
  JSON.stringify(abi, null, 2)
);

console.log("\nWritten to contracts/RigShift.bytecode.txt and RigShift.abi.json");
