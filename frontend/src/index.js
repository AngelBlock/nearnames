import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import getConfig from './config.js';

import { WalletSelectorProvider } from "@near-wallet-selector/react-hook";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHotWallet } from "@near-wallet-selector/hot-wallet";
import "@near-wallet-selector/modal-ui/styles.css";

const nearConfig = getConfig(process.env.NODE_ENV || 'testnet');

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

ReactDOM.render(
  <ErrorBoundary>
    <WalletSelectorProvider config={walletSelectorConfig}>
      <App nearConfig={nearConfig} />
    </WalletSelectorProvider>
  </ErrorBoundary>,
  document.getElementById('root')
);
