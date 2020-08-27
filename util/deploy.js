// Required by @openzeppelin/upgrades when running from truffle
global.artifacts = artifacts;
global.web3 = web3;

// Import dependencies from OpenZeppelin SDK programmatic library
const { Contracts, ProxyAdminProject, SimpleProject, ZWeb3 } = require('@openzeppelin/upgrades');

async function main() {
  /* Initialize OpenZeppelin's Web3 provider. */
  ZWeb3.initialize(web3.currentProvider);

  /* Retrieve a couple of addresses to interact with the contracts. */
  const [creatorAddress] = await ZWeb3.eth.getAccounts();

  /* Create a SimpleProject to interact with OpenZeppelin programmatically. */
  const project = new ProxyAdminProject('MyProject', null, null, { from: creatorAddress });

  const UFragments = Contracts.getFromLocal('UFragments');
  const UFragmentsPolicy = Contracts.getFromLocal('UFragmentsPolicy');

  // cpiOracle should provide cpi as [desired rate] * 1000000000000000000
  const baseCpi = 1000000000000000000;

  const UFragmentsInstance = await project.createProxy(UFragments, { initArgs: [creatorAddress] });
  console.log('UFragmentsInstance.address', Object.keys(UFragmentsInstance._address));
  const UFragmentsPolicyInstance = await project.createProxy(UFragmentsPolicy, { initArgs: [creatorAddress, UFragmentsInstance.options.address, baseCpi] });

  console.log('UFragments\'s name:', (await UFragmentsInstance.methods.name().call({ from: creatorAddress })).toString());
}

// For truffle exec
module.exports = function (callback) {
  const argv = process.argv;
  main().then(() => callback()).catch(err => callback(err));
};
