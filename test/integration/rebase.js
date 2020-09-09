const { deployments, getNamedAccounts } = require('@nomiclabs/buidler');
const { fixture, get, read, execute } = deployments;

const BN = web3.utils.BN;

require('chai')
  .use(require('chai-bn')(BN))
  .should();

function toBN (bnish) { return new BN(bnish.toString());}

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Rebase', () => {
  beforeEach(async () => {
    await fixture();
  });

  it('should not change supply if rebase arguments are the same', async function () {
    const { deployer, user } = await getNamedAccounts();
    // const tracker = await get('Tracker');
    // const orchestrator = await get('Orchestrator');

    const totalSupplyBeforeRebase = toBN(await read('Tracker', { from: user }, 'totalSupply'));
    const rebaseResult = await execute('Orchestrator', { from: deployer }, 'rebase', '653313740501264965', '653313740501264965');
    const totalSupplyAfterRebase = toBN(await read('Tracker', { from: user }, 'totalSupply'));

    totalSupplyAfterRebase.should.be.bignumber.eq(totalSupplyBeforeRebase);
  });

  it('should change supply if rebase arguments are different', async function () {
    const { deployer, user } = await getNamedAccounts();

    const divisor = new BN('5');
    const currentRate = new BN('653313740501264965');
    const targetRate = currentRate.div(divisor);
    const totalSupplyBeforeRebase = toBN(await read('Tracker', { from: user }, 'totalSupply'));
    console.log('totalSupplyBeforeRebase', totalSupplyBeforeRebase.toString());
    const rebaseResult = await execute('Orchestrator', { from: deployer }, 'rebase', currentRate.toString(), targetRate.toString());
    const rebaseLag = toBN(await read('Policy', { from: user }, 'rebaseLag'));
    console.log('divisor', divisor.toString());
    console.log('rebaseLag', rebaseLag.toString());
    const totalSupplyAfterRebase = toBN(await read('Tracker', { from: user }, 'totalSupply'));
    console.log('totalSupplyBeforeRebase.div(divisor.div(rebaseLag))', divisor.div(rebaseLag));
    console.log('test', new BN('5').div(new BN('4')));

    totalSupplyAfterRebase.should.be.bignumber.eq(totalSupplyBeforeRebase.div(divisor.div(rebaseLag)));
  });

  /*
 * it 'changes supply after rebase'
 * deploy contracts
 * rebase
 * assert totalSupply changed
 */

  /*
   * it 'upgrades contracts'
   * Change contract code
   *    Multiple totalSupply by 2 after rebase
   * Switch to the upgradable version
   * Rebase
   * assert totalSupply
   */

  /*
   * it 'doesn't change state if paused'
   * Pause
   * For every function
   *  call function
   *  assert transaction reverts
   */
});
