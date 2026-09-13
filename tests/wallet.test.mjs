import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function sourceModule(path){const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const {parseRefundWallet,isStablecoinPayment,explorerUrl,shortAddress}=await sourceModule('../lib/wallet.ts');

const BASE_USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',SOLANA_USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

test('refund wallets are accepted only in the right format for their network',()=>{
  assert.deepEqual(parseRefundWallet('base',` ${BASE_USDC} `),{network:'base',address:BASE_USDC});
  assert.deepEqual(parseRefundWallet('ethereum',BASE_USDC.toLowerCase()),{network:'ethereum',address:BASE_USDC.toLowerCase()});
  assert.deepEqual(parseRefundWallet('solana',SOLANA_USDC),{network:'solana',address:SOLANA_USDC});
  for(const [network,address] of [['solana',BASE_USDC],['base',SOLANA_USDC],['polygon','0x123'],['base','0x'+'0'.repeat(40)],['base','0x000000000000000000000000000000000000dEaD'],['solana','1'.repeat(32)],['solana',SOLANA_USDC.slice(0,-3)],['solana',SOLANA_USDC.replace('E','0')],['toString',BASE_USDC],['tron',BASE_USDC],['base',42]])
    assert.equal(parseRefundWallet(network,address),null,`${network} ${address}`);
});

test('stablecoin payments are recognised from Dodo payment method fields',()=>{
  assert.equal(isStablecoinPayment({payment_method_type:'crypto_currency'}),true);
  assert.equal(isStablecoinPayment({payment_method:'crypto_currency:usdc'}),true);
  assert.equal(isStablecoinPayment({payment_method_type:'credit',payment_method:'card'}),false);
  assert.equal(isStablecoinPayment({}),false);
});

test('payout references link to the matching explorer only when they look like a transaction',()=>{
  const evm='0x'+'ab'.repeat(32);
  assert.equal(explorerUrl('base',evm),`https://basescan.org/tx/${evm}`);
  assert.equal(explorerUrl('solana',evm),null);
  assert.equal(explorerUrl('solana','5'.repeat(88)),`https://solscan.io/tx/${'5'.repeat(88)}`);
  assert.equal(explorerUrl('base','manual-transfer-1'),null);
  assert.equal(explorerUrl(null,evm),null);
  assert.equal(shortAddress(BASE_USDC),'0x8335…2913');
});
