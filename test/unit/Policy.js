const Policy = artifacts.require('Policy.sol');
const MockTracker = artifacts.require('MockTracker.sol');
const MockOracle = artifacts.require('MockOracle.sol');

const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const BN = web3.utils.BN;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bn')(BN))
  .should();

let policy, mockTracker, mockMarketOracle, mockCpiOracle;
let r, prevEpoch, prevTime;
let deployer, user, orchestrator;

const DECIMALS = new BN(18);
const SCALE = new BN(10).pow(DECIMALS);
const MAX_RATE = (new BN(1)).mul(new BN(10).pow(new BN(6)).mul(SCALE));
const MAX_SUPPLY = (new BN(2).pow(new BN(255)).sub(new BN(1))).div(MAX_RATE);
const BASE_CPI = new BN(100).mul(SCALE);
const INITIAL_CPI = new BN('251.712').mul(SCALE);
const INITIAL_CPI_25P_MORE = INITIAL_CPI.mul(new BN(1.25)).divRound(new BN(1));
const INITIAL_CPI_25P_LESS = INITIAL_CPI.mul(new BN(0.77)).divRound(new BN(1));
const INITIAL_RATE = INITIAL_CPI.mul(new BN(1).pow(new BN(18))).divRound(BASE_CPI);
const INITIAL_RATE_30P_MORE = INITIAL_RATE.mul(new BN(1.3)).divRound(new BN(1));
const INITIAL_RATE_30P_LESS = INITIAL_RATE.mul(new BN(0.7)).divRound(new BN(1));
const INITIAL_RATE_5P_MORE = INITIAL_RATE.mul(new BN(1.05)).divRound(new BN(1));
const INITIAL_RATE_5P_LESS = INITIAL_RATE.mul(new BN(0.95)).divRound(new BN(1));
const INITIAL_RATE_60P_MORE = INITIAL_RATE.mul(new BN(1.6)).divRound(new BN(1));
const INITIAL_RATE_2X = INITIAL_RATE.mul(new BN(2));

async function setupContracts () {
  const accounts = await web3.eth.getAccounts();
  deployer = accounts[0];
  user = accounts[1];
  orchestrator = accounts[2];
  mockTracker = await MockTracker.new();
  mockMarketOracle = await MockOracle.new('MarketOracle');
  mockCpiOracle = await MockOracle.new('CpiOracle');
  policy = await Policy.new();
  await policy.initialize(mockTracker.address);
  await policy.setOrchestrator(orchestrator);
}

async function setupContractsWithOpenRebaseWindow () {
  await setupContracts();
  await policy.setRebaseTimingParameters(60, 0, 60);
}

async function mockExternalData (rate, cpi, uFragSupply, rateValidity = true, cpiValidity = true) {
  await mockMarketOracle.storeData(rate);
  await mockMarketOracle.storeValidity(rateValidity);
  await mockCpiOracle.storeData(cpi);
  await mockCpiOracle.storeValidity(cpiValidity);
  await mockTracker.storeSupply(uFragSupply);
}

contract('Policy', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    expect(
      await chain.isEthException(policy.sendTransaction({ from: user, value: 1 }))
    ).to.be.true;
  });
});

contract('Policy:initialize', async function (accounts) {
  describe.only('initial values set correctly', function () {
    beforeEach('setup Policy contract', setupContracts);

    it('deviationThreshold', async function () {
      console.log('await policy.deviationThreshold.call()', await policy.deviationThreshold.call());
      (await policy.deviationThreshold.call()).should.be.bignumber.eq(new BN('0.05').mul(SCALE));
    });
    it('rebaseLag', async function () {
      (await policy.rebaseLag.call()).should.be.bignumber.eq('4');
    });
    it('minRebaseTimeIntervalSec', async function () {
      (await policy.minRebaseTimeIntervalSec.call()).should.be.bignumber.eq('86400');
    });
    it('epoch', async function () {
      (await policy.epoch.call()).should.be.bignumber.eq('0');
    });
    it('rebaseWindowOffsetSec', async function () {
      (await policy.rebaseWindowOffsetSec.call()).should.be.bignumber.eq('0');
    });
    it('rebaseWindowLengthSec', async function () {
      (await policy.rebaseWindowLengthSec.call()).should.be.bignumber.eq('86400');
    });
    it('should set owner', async function () {
      expect(await policy.owner.call()).to.eq(deployer);
    });
    it('should set reference to tracker', async function () {
      expect(await policy.uFrags.call()).to.eq(mockTracker.address);
    });
  });
});

contract('Policy:setMarketOracle', async function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should set marketOracle', async function () {
    await policy.setMarketOracle(deployer);
    expect(await policy.marketOracle.call()).to.eq(deployer);
  });
});

contract('Tracker:setMarketOracle:accessControl', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(policy.setMarketOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(policy.setMarketOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('Policy:setCpiOracle', async function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should set cpiOracle', async function () {
    await policy.setCpiOracle(deployer);
    expect(await policy.cpiOracle.call()).to.eq(deployer);
  });
});

contract('Tracker:setCpiOracle:accessControl', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(policy.setCpiOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(policy.setCpiOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('Policy:setOrchestrator', async function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should set orchestrator', async function () {
    await policy.setOrchestrator(user, {from: deployer});
    expect(await policy.orchestrator.call()).to.eq(user);
  });
});

contract('Tracker:setOrchestrator:accessControl', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(policy.setOrchestrator(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(policy.setOrchestrator(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('Policy:setDeviationThreshold', async function (accounts) {
  let prevThreshold, threshold;
  beforeEach('setup Policy contract', async function () {
    await setupContracts();
    prevThreshold = await policy.deviationThreshold.call();
    threshold = prevThreshold.plus(0.01e18);
    await policy.setDeviationThreshold(threshold);
  });

  it('should set deviationThreshold', async function () {
    (await policy.deviationThreshold.call()).should.be.bignumber.eq(threshold);
  });
});

contract('Tracker:setDeviationThreshold:accessControl', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(policy.setDeviationThreshold(0, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(policy.setDeviationThreshold(0, { from: user }))
    ).to.be.true;
  });
});

contract('Policy:setRebaseLag', async function (accounts) {
  let prevLag;
  beforeEach('setup Policy contract', async function () {
    await setupContracts();
    prevLag = await policy.rebaseLag.call();
  });

  describe('when rebaseLag is more than 0', async function () {
    it('should setRebaseLag', async function () {
      const lag = prevLag.plus(1);
      await policy.setRebaseLag(lag);
      (await policy.rebaseLag.call()).should.be.bignumber.eq(lag);
    });
  });

  describe('when rebaseLag is 0', async function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(policy.setRebaseLag(0))
      ).to.be.true;
    });
  });
});

contract('Tracker:setRebaseLag:accessControl', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(policy.setRebaseLag(1, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(policy.setRebaseLag(1, { from: user }))
    ).to.be.true;
  });
});

contract('Policy:setRebaseTimingParameters', async function (accounts) {
  beforeEach('setup Policy contract', async function () {
    await setupContracts();
  });

  describe('when interval=0', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(policy.setRebaseTimingParameters(0, 0, 0))
      ).to.be.true;
    });
  });

  describe('when offset > interval', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(policy.setRebaseTimingParameters(300, 3600, 300))
      ).to.be.true;
    });
  });

  describe('when params are valid', function () {
    it('should setRebaseTimingParameters', async function () {
      await policy.setRebaseTimingParameters(600, 60, 300);
      (await policy.minRebaseTimeIntervalSec.call()).should.be.bignumber.eq('600');
      (await policy.rebaseWindowOffsetSec.call()).should.be.bignumber.eq('60');
      (await policy.rebaseWindowLengthSec.call()).should.be.bignumber.eq('300');
    });
  });
});

contract('Tracker:setRebaseTimingParameters:accessControl', function (accounts) {
  beforeEach('setup Policy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(policy.setRebaseTimingParameters(600, 60, 300, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(policy.setRebaseTimingParameters(600, 60, 300, { from: user }))
    ).to.be.true;
  });
});

contract('Policy:Rebase:accessControl', async function (accounts) {
  beforeEach('setup Policy contract', async function () {
    await setupContractsWithOpenRebaseWindow();
    await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
    await chain.waitForSomeTime(60);
  });

  describe('when rebase called by orchestrator', function () {
    it('should succeed', async function () {
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });

  describe('when rebase called by non-orchestrator', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(policy.rebase({from: user}))
      ).to.be.true;
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when minRebaseTimeIntervalSec has NOT passed since the previous rebase', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1010);
      await chain.waitForSomeTime(60);
      await policy.rebase({from: orchestrator});
    });

    it('should fail', async function () {
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is within deviationThreshold', function () {
    beforeEach(async function () {
      await policy.setRebaseTimingParameters(60, 0, 60);
    });

    it('should return 0', async function () {
      await mockExternalData(INITIAL_RATE.sub(1), INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq('0');
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE.plus(1), INITIAL_CPI, 1000);
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq('0');
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE_5P_MORE.sub(2), INITIAL_CPI, 1000);
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq('0');
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE_5P_LESS.plus(2), INITIAL_CPI, 1000);
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq('0');
      await chain.waitForSomeTime(60);
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is more than MAX_RATE', function () {
    it('should return same supply delta as delta for MAX_RATE', async function () {
      // Any exchangeRate >= (MAX_RATE=100x) would result in the same supply increase
      await mockExternalData(MAX_RATE, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await policy.rebase({from: orchestrator});
      const supplyChange = r.logs[0].args.requestedSupplyAdjustment;

      await chain.waitForSomeTime(60);

      await mockExternalData(MAX_RATE.add(1e17), INITIAL_CPI, 1000);
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(supplyChange);

      await chain.waitForSomeTime(60);

      await mockExternalData(MAX_RATE.mul(2), INITIAL_CPI, 1000);
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(supplyChange);
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when tracker grows beyond MAX_SUPPLY', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY.sub(1));
      await chain.waitForSomeTime(60);
    });

    it('should apply SupplyAdjustment {MAX_SUPPLY - totalSupply}', async function () {
      // Supply is MAX_SUPPLY-1, exchangeRate is 2x; resulting in a new supply more than MAX_SUPPLY
      // However, supply is ONLY increased by 1 to MAX_SUPPLY
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq('1');
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when tracker supply equals MAX_SUPPLY and rebase attempts to grow', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY);
      await chain.waitForSomeTime(60);
    });

    it('should not grow', async function () {
      r = await policy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq('0');
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when the market oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the market oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when the cpi oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the cpi oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('positive rate and no change CPI', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000);
      await policy.setRebaseTimingParameters(60, 0, 60);
      await chain.waitForSomeTime(60);
      await policy.rebase({from: orchestrator});
      await chain.waitForSomeTime(59);
      prevEpoch = await policy.epoch.call();
      prevTime = await policy.lastRebaseTimestampSec.call();
      await mockExternalData(INITIAL_RATE_60P_MORE, INITIAL_CPI, 1010);
      r = await policy.rebase({from: orchestrator});
    });

    it('should increment epoch', async function () {
      const epoch = await policy.epoch.call();
      expect(prevEpoch.plus(1).eq(epoch));
    });

    it('should update lastRebaseTimestamp', async function () {
      const time = await policy.lastRebaseTimestampSec.call();
      expect(time.sub(prevTime).eq(60)).to.be.true;
    });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.eq(prevEpoch.plus(1))).to.be.true;
      log.args.exchangeRate.should.be.bignumber.eq(INITIAL_RATE_60P_MORE);
      log.args.cpi.should.be.bignumber.eq(INITIAL_CPI);
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq('20');
    });

    it('should call getData from the market oracle', async function () {
      const fnCalled = mockMarketOracle.FunctionCalled().formatter(r.receipt.logs[2]);
      expect(fnCalled.args.instanceName).to.eq('MarketOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(policy.address);
    });

    it('should call getData from the cpi oracle', async function () {
      const fnCalled = mockCpiOracle.FunctionCalled().formatter(r.receipt.logs[0]);
      expect(fnCalled.args.instanceName).to.eq('CpiOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(policy.address);
    });

    it('should call uFrag Rebase', async function () {
      prevEpoch = await policy.epoch.call();
      const fnCalled = mockTracker.FunctionCalled().formatter(r.receipt.logs[4]);
      expect(fnCalled.args.instanceName).to.eq('Tracker');
      expect(fnCalled.args.functionName).to.eq('rebase');
      expect(fnCalled.args.caller).to.eq(policy.address);
      const fnArgs = mockTracker.FunctionArguments().formatter(r.receipt.logs[5]);
      const parsedFnArgs = Object.keys(fnArgs.args).reduce((m, k) => {
        return fnArgs.args[k].map(d => d.toNumber()).concat(m);
      }, [ ]);
      expect(parsedFnArgs).to.include.members([prevEpoch.toNumber(), 20]);
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('negative rate', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE_30P_LESS, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await policy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(-10);
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi increases', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_MORE, 1000);
      await chain.waitForSomeTime(60);
      await policy.setDeviationThreshold(0);
      r = await policy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(-6);
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi decreases', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_LESS, 1000);
      await chain.waitForSomeTime(60);
      await policy.setDeviationThreshold(0);
      r = await policy.rebase({from: orchestrator});
    });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq('9');
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  beforeEach('setup Policy contract', setupContractsWithOpenRebaseWindow);

  describe('rate=TARGET_RATE', function () {
    beforeEach(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      await policy.setDeviationThreshold(0);
      await chain.waitForSomeTime(60);
      r = await policy.rebase({from: orchestrator});
    });

    it('should emit Rebase with 0 requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq('0');
    });
  });
});

contract('Policy:Rebase', async function (accounts) {
  let rbTime, rbWindow, minRebaseTimeIntervalSec, now, prevRebaseTime, nextRebaseWindowOpenTime,
    timeToWait, lastRebaseTimestamp;

  beforeEach('setup Policy contract', async function () {
    await setupContracts();
    await policy.setRebaseTimingParameters(86400, 72000, 900);
    rbTime = await policy.rebaseWindowOffsetSec.call();
    rbWindow = await policy.rebaseWindowLengthSec.call();
    minRebaseTimeIntervalSec = await policy.minRebaseTimeIntervalSec.call();
    now = new BN(await chain.currentTime());
    prevRebaseTime = now.sub(now.mod(minRebaseTimeIntervalSec)).plus(rbTime);
    nextRebaseWindowOpenTime = prevRebaseTime.plus(minRebaseTimeIntervalSec);
  });

  describe('when its 5s after the rebase window closes', function () {
    it('should fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).plus(rbWindow).plus(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await policy.inRebaseWindow.call()).to.be.false;
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when its 5s before the rebase window opens', function () {
    it('should fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).sub(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await policy.inRebaseWindow.call()).to.be.false;
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when its 5s after the rebase window opens', function () {
    it('should NOT fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).plus(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await policy.inRebaseWindow.call()).to.be.true;
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.false;
      lastRebaseTimestamp = await policy.lastRebaseTimestampSec.call();
      expect(lastRebaseTimestamp.eq(nextRebaseWindowOpenTime)).to.be.true;
    });
  });

  describe('when its 5s before the rebase window closes', function () {
    it('should NOT fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.sub(now).plus(rbWindow).sub(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await policy.inRebaseWindow.call()).to.be.true;
      expect(
        await chain.isEthException(policy.rebase({from: orchestrator}))
      ).to.be.false;
      lastRebaseTimestamp = await policy.lastRebaseTimestampSec.call();
      expect(lastRebaseTimestamp.eq(nextRebaseWindowOpenTime)).to.be.true;
    });
  });
});
