import {getPaymentStatus} from '@base-org/account/payment/node';
import {CdpClient} from '@coinbase/cdp-sdk';
import {createPublicClient,getAddress,http,isAddress,type Hex} from 'viem';
import {base,baseSepolia} from 'viem/chains';
import {settings} from './server';
import {formatUsdc} from './usdc';

/** Base Pay settings. Payments are enabled once BASE_PAY_RECIPIENT is a valid address. */
export function baseSettings(){const e=settings();const recipient=e.BASE_PAY_RECIPIENT&&isAddress(e.BASE_PAY_RECIPIENT)?getAddress(e.BASE_PAY_RECIPIENT):null;
return {recipient,testnet:e.BASE_PAY_TESTNET==='true',bundlerUrl:e.BASE_BUNDLER_URL||undefined,
// Automatic refunds need a CDP server wallet account; it must be the same address that receives payments.
autoRefunds:!!(recipient&&e.CDP_API_KEY_ID&&e.CDP_API_KEY_SECRET&&e.CDP_WALLET_SECRET&&e.CDP_REFUND_ACCOUNT)};}

export type BaseCheck={state:'completed';payer:string}|{state:'pending'}|{state:'failed'|'mismatch'};

/**
 * Verifies a Base Pay payment against the order's exact amount and our recipient, using Base's own status check.
 * The amount comes from our database, never from the browser, so another order's payment cannot match.
 */
export async function checkBasePayment(id:string,units:bigint):Promise<BaseCheck>{const s=baseSettings();if(!s.recipient)throw new Error('Base payments are not configured');
let status;try{status=await getPaymentStatus({id,testnet:s.testnet,telemetry:false,bundlerUrl:s.bundlerUrl,expectedPayment:{amount:formatUsdc(units),recipient:s.recipient}});}
catch(e){if(e instanceof Error&&/match|exactly one|transfer/i.test(e.message))return {state:'mismatch'};throw e;}
if(status.status==='completed'){if(!status.sender||!isAddress(status.sender))return {state:'mismatch'};return {state:'completed',payer:getAddress(status.sender)};}
if(status.status==='failed')return {state:'failed'};
return {state:'pending'};}

let cdp:CdpClient|null=null;
/** Sends a USDC refund from the CDP server wallet. Returns the transaction hash; throws if the wallet is not the payment recipient. */
export async function sendBaseRefund(to:string,units:bigint){const e=settings(),s=baseSettings();if(!s.autoRefunds||!s.recipient)throw new Error('Automatic Base refunds are not configured');
cdp??=new CdpClient({apiKeyId:e.CDP_API_KEY_ID,apiKeySecret:e.CDP_API_KEY_SECRET,walletSecret:e.CDP_WALLET_SECRET});
const account=await cdp.evm.getAccount({name:e.CDP_REFUND_ACCOUNT});
if(getAddress(account.address)!==s.recipient)throw new Error('The CDP refund account is not the Base payment recipient');
const {transactionHash}=await account.transfer({to:getAddress(to),amount:units,token:'usdc',network:s.testnet?'base-sepolia':'base'});
return transactionHash;}

/** 'succeeded' | 'failed' once mined, otherwise 'pending'. */
export async function baseTransactionStatus(hash:string){const s=baseSettings();const client=createPublicClient({chain:s.testnet?baseSepolia:base,transport:http(settings().BASE_RPC_URL||undefined)});
try{const receipt=await client.getTransactionReceipt({hash:hash as Hex});return receipt.status==='success'?'succeeded':'failed';}catch{return 'pending';}}
