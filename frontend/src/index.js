import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import getConfig from './config.js';
import * as nearAPI from 'near-api-js';

import { WalletSelectorProvider } from "@near-wallet-selector/react-hook";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHotWallet } from "@near-wallet-selector/hot-wallet";
import "@near-wallet-selector/modal-ui/styles.css";

const nearConfig = getConfig(process.env.NODE_ENV || 'testnet');

console.log('contractName ' + nearConfig.contractName);

const walletSelectorConfig = {
  network: nearConfig.networkId,
  modules: [
    setupMyNearWallet(),
    setupHereWallet(),
    setupMeteorWallet(),
    setupSender(),
    setupHotWallet(),
  ],
};

// Legacy near-api-js connection kept for the Offer flow only
// (requires full access key sign-in which wallet-selector doesn't support)
async function initLegacyNear() {
  const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
  const near = await nearAPI.connect({ keyStore, ...nearConfig });
  const walletConnection = new nearAPI.WalletConnection(near, nearConfig.contractName);
  return { near, walletConnection };
}

window.nearInitPromise = initLegacyNear().then(({ near, walletConnection }) => {
  ReactDOM.render(
    <ErrorBoundary>
      <WalletSelectorProvider config={walletSelectorConfig}>
        <App
          nearConfig={nearConfig}
          legacyNear={near}
          legacyWallet={walletConnection}
        />
      </WalletSelectorProvider>
    </ErrorBoundary>,
    document.getElementById('root')
  );
});
