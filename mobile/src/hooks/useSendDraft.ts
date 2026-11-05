/**
 * Signs and sends a prepared manager transaction (TxDraft) with the signed-in
 * wallet, then reports it on the operations flow the API tracks: submit →
 * wait for the receipt → confirm or fail. A genesis draft names a token to
 * approve first (the 1 USDG seed genesisDeposit pulls), like invest does.
 */
import { encodeFunctionData, erc20Abi, type Hex } from 'viem';

import * as api from '../lib/api';
import { erc20Allowance, waitForReceipt } from '../lib/chain';
import type { Operation, TxDraft } from '../lib/types';
import { useWallet } from '../lib/wallet';

export function useSendDraft() {
  const { address, sendTransaction } = useWallet();

  return async (draft: TxDraft): Promise<Operation> => {
    if (!address) throw new Error('Connect the wallet you signed in with.');
    const { chainId, to, data, value, gas } = draft.transaction;

    const extra = (draft.data ?? {}) as {
      approveToken?: string;
      approveAmountRaw?: string;
    };
    if (extra.approveToken && extra.approveAmountRaw) {
      const amount = BigInt(extra.approveAmountRaw);
      const allowance = await erc20Allowance(
        chainId,
        extra.approveToken,
        address,
        to,
      );
      if (allowance < amount) {
        const approveHash = await sendTransaction({
          chainId,
          to: extra.approveToken as Hex,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [to as Hex, amount],
          }),
        });
        const approved = await waitForReceipt(chainId, approveHash);
        if (approved.status !== 'success') {
          throw new Error('The spend approval transaction failed on-chain.');
        }
      }
    }

    const txHash = await sendTransaction({
      chainId,
      to: to as Hex,
      data,
      value: BigInt(value || '0'),
      ...(gas ? { gas: BigInt(gas) } : {}),
    });
    await api.submitOperation(draft.requestId, txHash);
    const receipt = await waitForReceipt(chainId, txHash);
    if (receipt.status === 'success') {
      return api.confirmOperation(draft.requestId, txHash);
    }
    await api.failOperation(draft.requestId, txHash, 'transaction reverted');
    throw new Error('The transaction reverted on-chain.');
  };
}
