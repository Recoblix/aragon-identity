const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { encodeCallScript, EMPTY_SCRIPT } = require('@aragon/test-helpers/evmScript')
const ExecutionTarget = artifacts.require('ExecutionTarget')

const Delay = artifacts.require('Delay')
const MiniMeToken = artifacts.require('@aragon/os/contracts/lib/minime/MiniMeToken')
const DAOFactory = artifacts.require('@aragon/os/contracts/factory/DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('@aragon/os/contracts/factory/EVMScriptRegistryFactory')
const ACL = artifacts.require('@aragon/os/contracts/acl/ACL')
const Kernel = artifacts.require('@aragon/os/contracts/kernel/Kernel')

const getContract = name => artifacts.require(name)
const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))
const createdActionId = receipt => receipt.logs.filter(x => x.event == 'StartAction')[0].args.actionId

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

const VOTER_STATE = ['ABSENT', 'YEA', 'NAY'].reduce((state, key, index) => {
    state[key] = index;
    return state;
}, {})


contract('Delay App', accounts => {
    let daoFact, app, token, executionTarget = {}

    const delayTime = 5
    const root = accounts[0]

    before(async () => {
        const kernelBase = await getContract('Kernel').new()
        const aclBase = await getContract('ACL').new()
        const regFact = await EVMScriptRegistryFactory.new()
        daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)
    })

    beforeEach(async () => {
        const r = await daoFact.newDAO(root)
        const dao = Kernel.at(r.logs.filter(l => l.event == 'DeployDAO')[0].args.dao)
        const acl = ACL.at(await dao.acl())

        await acl.createPermission(root, dao.address, await dao.APP_MANAGER_ROLE(), root, { from: root })

        const receipt = await dao.newAppInstance('0x1234', (await Delay.new()).address, { from: root })
        app = Delay.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)

        await acl.createPermission(ANY_ADDR, app.address, await app.INITIATE_ROLE(), root, { from: root })
        await acl.createPermission(ANY_ADDR, app.address, await app.ACTIVATE_ROLE(), root, { from: root })
        await acl.createPermission(ANY_ADDR, app.address, await app.CANCEL_ROLE(), root, { from: root })
    })

    context('withoutDelay', () => {
        const account = accounts[0]


        beforeEach(async () => {
            await app.initialize(0)

            executionTarget = await ExecutionTarget.new()
        })

        it('fails on reinitialization', async () => {
            return assertRevert(async () => {
                await app.initialize(delayTime)
            })
        })

        it('can execute action', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])
            const actionId = createdActionId(await app.forward(script, { from: account }))
            await app.activate(actionId, { from: account })
            assert.equal(await executionTarget.counter(), 1, 'should have received execution call')
        })
    })

    context('withDelay', () => {
        const account = accounts[0]


        beforeEach(async () => {
            await app.initialize(delayTime)

            executionTarget = await ExecutionTarget.new()
        })

        it('cannot immediately execute action', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])
            const actionId = createdActionId(await app.forward(script, { from: account }))
            return assertRevert(async () => {
                await app.activate(actionId, { from: account })
            })
        })
    })

    context('cancel', () => {
        const account = accounts[0]

        beforeEach(async () => {
            await app.initialize(0)

            executionTarget = await ExecutionTarget.new()
        })

        it('cannot activate canceled action', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])
            const actionId = createdActionId(await app.forward(script, { from: account }))
            await app.cancel(actionId, { from: account })
            return assertRevert(async () => {
                await app.activate(actionId, { from: account })
            })
        })
    })
})
