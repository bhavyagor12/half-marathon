export type PaymentFee = {amount:number;is_credit:boolean;currency:string;reference_object_id?:string|null};
export function refundAfterFees(total:number,paymentId:string,entries:PaymentFee[]){
 if(!Number.isSafeInteger(total)||total<=0)throw new Error('Invalid payment total');
 if(entries.length===0)throw new Error('Payment fees are not available yet');
 let fee=0;
 for(const entry of entries){
  if(entry.reference_object_id!==paymentId||entry.currency!=='USD'||!Number.isSafeInteger(entry.amount))throw new Error('Fee requires reconciliation');
  fee+=entry.is_credit?-Math.abs(entry.amount):Math.abs(entry.amount);
 }
 if(!Number.isSafeInteger(fee)||fee<0||fee>=total)throw new Error('Invalid refund fee');
 return {amount:total-fee,fee};
}
