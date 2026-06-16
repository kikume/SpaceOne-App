const { ethers } = require('ethers');

const ABI = [
  'function storeItem(string memory _title, string memory _ipfsHash) public',
  'function getMyItems() public view returns (tuple(string title, string ipfsHash, uint256 timestamp)[])',
];

let provider    = null;
let masterWallet = null;
let contract    = null;

function getBlockchain() {
  if (!provider) {
    provider     = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    masterWallet = new ethers.Wallet(process.env.MASTER_PRIVATE_KEY, provider);
    contract     = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, masterWallet);
    console.log(`🔗 Blockchain conectada. Carteira mestre: ${masterWallet.address}`);
  }
  return { provider, masterWallet, contract };
}

async function storeItemOnChain(title, encryptedData) {
  const { contract } = getBlockchain();
  const tx      = await contract.storeItem(title, encryptedData, { gasLimit: 500_000 });
  const receipt = await tx.wait();
  return {
    txHash:      receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}

async function getItemsFromChain() {
  const { contract } = getBlockchain();
  const items = await contract.getMyItems();
  return items.map(item => ({
    title:         item.title,
    encryptedData: item.ipfsHash,
    // block.timestamp é em segundos; JS usa milissegundos
    timestamp:     item.timestamp.toNumber() * 1000,
  }));
}

module.exports = { storeItemOnChain, getItemsFromChain };
