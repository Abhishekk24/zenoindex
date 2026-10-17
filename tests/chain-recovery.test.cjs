const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const viem = require('viem');

// Run the actual chain module with an RPC stub, without loading Expo native modules.
function loadChain(client) {
  const source = readFileSync(join(__dirname, '../src/lib/chain.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const requireStub = name => {
    if (name === 'viem') return { ...viem, createPublicClient: () => client };
    if (name === '../config/chains')
      return {
        robinhood: {
          id: 4663,
          rpcUrls: { default: { http: ['http://rpc.test'] } },
        },
      };
    if (name === './api') return { listChains: async () => [] };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function('require', 'module', 'exports', outputText)(
    requireStub,
    module,
    module.exports,
  );
  return module.exports;
}

const vault = '0x1111111111111111111111111111111111111111';
const user = '0x2222222222222222222222222222222222222222';
const other = '0x3333333333333333333333333333333333333333';
const draft = '0xaabbccdd';

test('captures a fresh block before sending, bypassing the RPC client cache', async () => {
  const chain = loadChain({
    getBlockNumber: async options => {
      assert.equal(options.cacheTime, 0);
      return 10n;
    },
  });
  assert.equal(await chain.blockNumber(4663), 10n);
});

test('recovers only the current draft, excluding previous redeem steps, other senders and targets', async () => {
  const transactions = {
    '0x01': { from: user, to: vault, input: '0xdeadbeef' }, // previous leg
    '0x02': { from: other, to: vault, input: draft },
    '0x03': { from: user, to: other, input: draft },
    '0x04': { from: user, to: vault, input: draft.toUpperCase() },
  };
  const chain = loadChain({
    getLogs: async query => {
      assert.equal(query.fromBlock, 11n); // do not include the block already mined before send
      assert.equal(query.address, vault);
      return Object.keys(transactions).map(transactionHash => ({
        transactionHash,
        args: { user },
      }));
    },
    getTransaction: async ({ hash }) => transactions[hash],
  });
  assert.equal(await chain.findVaultTx(4663, vault, user, 10n, draft), '0x04');
});

test('keeps waiting when only an earlier step or another user has appeared', async () => {
  const chain = loadChain({
    getLogs: async () => [
      { transactionHash: '0x01', args: { user } },
      { transactionHash: '0x02', args: { user: other } },
    ],
    getTransaction: async ({ hash }) => {
      assert.equal(hash, '0x01');
      return { from: user, to: vault, input: '0xdeadbeef' };
    },
  });
  assert.equal(await chain.findVaultTx(4663, vault, user, 10n, draft), null);
});
