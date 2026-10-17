import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';

/** Work around AppKit 2.0.6 firing getBalance without awaiting or catching it. */
export class WalletAdapter extends WagmiAdapter {
  override getBalance(
    params: Parameters<WagmiAdapter['getBalance']>[0],
  ): ReturnType<WagmiAdapter['getBalance']> {
    const request = super.getBalance(params);
    // Attach a handler to the original promise without replacing it. AppKit's
    // background refresh is handled, while callers awaiting it still get the
    // error. Failed reads emit no balance update and never invent a zero balance.
    void request.catch(() => {
      console.warn(
        `Wallet balance refresh failed on chain ${params.network.id}. Check your connection and refresh the wallet.`,
      );
    });
    return request;
  }
}
