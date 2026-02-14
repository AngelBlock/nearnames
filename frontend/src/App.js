import 'regenerator-runtime/runtime';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as nearAPI from 'near-api-js';
import localStorage from 'local-storage';
import {HashRouter as Router, NavLink, Navigate, Route, Routes} from 'react-router-dom';
import OfferProcessPage from './components/OfferProcess';
import Lots from './components/Lots';
import ProfilePage from './components/Profile';
import LogoutIcon from '@mui/icons-material/Logout';
import CreateOffer from "./components/CreateOffer";
import {nearToFloor, renderName, withTimeout, makeContractProxy} from "./utils";
import AboutPage from "./components/About";
import ConfirmContextProvider from "./Providers/ConfirmContextProvider";
import NearContextProvider from "./Providers/NearContextProvider";
import AuthContextProvider from "./Providers/AuthContextProvider";
import ModalConfirm from "./components/Confirm";
import {IconButton} from "@mui/material";
import { BrowserView, MobileView, isBrowser, isMobile } from 'react-device-detect';
import MobileNav from "./components/MobileNav";
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NetworkSelect from "./components/NetworkSelect";
import { useWalletSelector } from "@near-wallet-selector/react-hook";

function App (props) {

  const nearConfig = props.nearConfig;

  // Legacy near-api-js connection state (initialized async on mount).
  // Only needed for the Offer flow (requires full access key sign-in).
  const [legacyNear, setLegacyNear] = useState(null);
  const [legacyWallet, setLegacyWallet] = useState(null);

  const {
    signedAccountId,
    signIn,
    signOut: walletSelectorSignOut,
    viewFunction,
    callFunction,
    getBalance: wsGetBalance,
  } = useWalletSelector();

  const lsPrevKeys = nearConfig.contractName + ':v01:' + 'prevKeys';
  const lsLotAccountId = nearConfig.contractName + ':v01:' + 'lotAccountId';

  const [connected, setConnected] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [signedAccountBalance, setSignedAccountBalance] = useState(null);

  const [offerProcessState, setOfferProcessState] = useState({
    offerFinished: false,
    offerSuccess: false,
    offerActive: true,
    offerFailureReason: '',
    offerSuccessMessage: '',
  })

  const [offerProcessOutput, setOfferProcessOutput] = useState([]);

  // Build contract proxy using wallet-selector functions
  const contract = useMemo(
    () => makeContractProxy(nearConfig.contractName, viewFunction, callFunction),
    [nearConfig.contractName, viewFunction, callFunction]
  );

  // Phase 1: Initialize legacy near-api-js connection
  useEffect(() => {
    (async () => {
      const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
      const near = await nearAPI.connect({ keyStore, ...nearConfig });
      const walletConnection = new nearAPI.WalletConnection(near, nearConfig.contractName);
      setLegacyNear(near);
      setLegacyWallet(walletConnection);
    })();
  }, []);

  // Phase 2: Run offer init once legacy NEAR is ready
  useEffect(() => {
    if (!legacyNear || !legacyWallet) return;
    (async () => {
      await initOffer();
      setConnected(true);
    })();
  }, [legacyNear, legacyWallet]);

  // Update balance when signed account changes
  useEffect(() => {
    (async () => {
      if (signedAccountId) {
        const balance = await getBalance(signedAccountId);
        setSignedAccountBalance(balance);
      } else {
        setSignedAccountBalance(null);
      }
    })();
  }, [signedAccountId]);

  const updateBalance = useCallback(async () => {
    if (signedAccountId) {
      setSignedAccountBalance(await getBalance(signedAccountId));
    }
  }, [signedAccountId]);

  const getBalance = async (accountId) => {
    try {
      const account = await legacyNear.account(accountId);
      const balance = await account.getAccountBalance();
      return balance.available;
    } catch (e) {
      return null;
    }
  }

  const handleSignOut = useCallback(async (withReload) => {
    await walletSelectorSignOut();
    withReload && window.location.replace(window.location.origin + window.location.pathname);
  }, [walletSelectorSignOut]);

  const initOffer = async() => {

    // Check if there's a legacy wallet signed in for the offer flow
    const legacySignedAccount = legacyWallet.getAccountId();

    if (!legacySignedAccount) {
      setOfferProcessState(offerProcessState => ({...offerProcessState, ...{offerActive: false}}));
      return;
    }

    const lotAccountId = localStorage.get(lsLotAccountId);
    if (!lotAccountId) {
      setOfferProcessState(offerProcessState => ({...offerProcessState, ...{offerActive: false}}));
      return;
    }

    if (legacySignedAccount !== lotAccountId) {
      localStorage.remove(lsLotAccountId);
      const newState = {
        offerFinished: true,
        offerSuccess: false,
        offerActive: true,
        offerFailureReason: `wrong account authenticated, expected ${lotAccountId}, please try lot offer again`,
      };
      setOfferProcessState(offerProcessState => ({...offerProcessState, ...newState}));
      legacyWallet.signOut();
      return;
    }

    // should never happen
    const offerData = JSON.parse(localStorage.get(nearConfig.contractName + ':lotOffer: ' + legacySignedAccount));
    if (!offerData) {
      localStorage.remove(lsLotAccountId);
      const newState = {
        offerFinished: true,
        offerSuccess: false,
        offerActive: true,
        offerFailureReason: 'failed to parse lot offer data, please try lot offer again',
      };
      setOfferProcessState(offerProcessState => ({...offerProcessState, ...newState}));
      legacyWallet.signOut();
      return;
    }

    try {

      const account = await withTimeout(legacyNear.account(legacySignedAccount));

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'geting access keys']);

      const lastKey = (await withTimeout(legacyWallet._keyStore.getKey(nearConfig.networkId, legacySignedAccount))).getPublicKey().toString();

      const accessKeys = await withTimeout(legacyWallet.account().getAccessKeys());

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'fetching contract']);

      const data = await withTimeout(fetch('/lock_unlock_account_latest.wasm'));
      const buf = await withTimeout(data.arrayBuffer());

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'Deploying contract']);

      await withTimeout(account.deployContract(new Uint8Array(buf)));

      const contractLock = await withTimeout(new nearAPI.Contract(account, legacySignedAccount, {
        viewMethods: [],
        changeMethods: ['lock'],
        sender: legacySignedAccount
      }));

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'Deploying done. Initializing contract...']);
      await withTimeout(contractLock.lock(Buffer.from('{"owner_id":"' + nearConfig.contractName + '"}')));

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'Init is done.']);

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'Create lot offer.']);

      const lot = await withTimeout(contract.lot_get({lot_id: lotAccountId}))

      if (!lot) {
        await withTimeout(contract.lot_offer(offerData));
      }

      for (let index = 0; index < accessKeys.length; index++) {
        if (accessKeys[index].public_key !== lastKey) {
          setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'deleting ' + accessKeys[index].public_key]);
          await withTimeout(account.deleteKey(accessKeys[index].public_key));
        }
      }

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'deleting last key ' + lastKey]);
      await withTimeout(account.deleteKey(lastKey));
      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'deleting done']);

      localStorage.remove(nearConfig.contractName + ':lotOffer: ' + legacySignedAccount);
      localStorage.remove(lsLotAccountId);
      const newState = {
        offerFinished: true,
        offerSuccess: true,
        offerActive: true,
        offerSuccessMessage: `Account ${legacySignedAccount} is now on sale. Log in as ${offerData.seller_id} to see it on your profile and be able collect rewards as soon as the first bid is made.`
      };
      setOfferProcessState(offerProcessState => ({...offerProcessState, ...newState}));
      legacyWallet.signOut();
    } catch (e) {
      let offerFailureReason = '';
      e = e.toString();
      if (e === 'timeout_reached' || e === 'TypeError: NetworkError when attempting to fetch resource.') {
        offerFailureReason = 'timeout on network operation reached, try reloading the page';
      }
      const newState = {
        offerFinished: true,
        offerSuccess: false,
        offerActive: true,
        offerFailureReason
      };
      setOfferProcessState(offerProcessState => ({...offerProcessState, ...newState}));
    }
  }

  const nearValue = useMemo(() => ({
    nearConfig,
    contract,
    legacyNear,
    legacyWallet,
    lsPrevKeys,
    lsLotAccountId,
  }), [nearConfig, contract, legacyNear, legacyWallet, lsPrevKeys, lsLotAccountId]);

  const authValue = useMemo(() => ({
    signedAccountId,
    signedAccountBalance,
    connected,
    signIn,
    signOut: handleSignOut,
    updateBalance,
  }), [signedAccountId, signedAccountBalance, connected, signIn, handleSignOut, updateBalance]);

  return (
    <NearContextProvider value={nearValue}>
    <AuthContextProvider value={authValue}>
    <ConfirmContextProvider>
    <main>
      <Router basename='/'>
        <div className='beta-warning'>
          Beta software. Not audited. Use at your own risk!
        </div>
        <header>
          <div className="container">
            <h1><NavLink aria-current='page' to='/'>Near names</NavLink></h1>
            { isBrowser && <NetworkSelect/> }
            { !offerProcessState.offerActive && <BrowserView>
              <ul className='nav'>
                <li className='nav-item'>
                  <NavLink className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')} aria-current='page' to='/lots'>Lots</NavLink>
                </li>
              { signedAccountId && (<li className='nav-item'>
                  <NavLink className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')} aria-current='page'
                        to='profile'>Profile</NavLink>
                </li>)}
                <li className='nav-item'>
                  <NavLink className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')} aria-current='page' to='/about'>About</NavLink>
                </li>
              </ul>
            </BrowserView>}
            <CreateOffer/>
            { <BrowserView>
              { !connected ? (
                  <div className="auth">
                    <span className='spinner' role='status' aria-hidden='true'>Connecting...</span>
                  </div>
                ) : signedAccountId && !offerProcessState.offerActive
                ? <div className="auth">
                    <strong className="balance near-icon">{nearToFloor(signedAccountBalance) || '-'}</strong>
                    {renderName(signedAccountId)}
                    <a className="icon logout" onClick={() => handleSignOut(true)}><LogoutIcon/></a>
                  </div>
                : <div className="auth"><button className="login" onClick={signIn}>Log in</button></div>
              }
            </BrowserView>}
            { !offerProcessState.offerActive && <MobileView>
              <IconButton
                aria-label="open"
                onClick={() => setShowMobileNav(true)}
                className="button-icon"
              >
                <MenuRoundedIcon />
              </IconButton>
              {showMobileNav && <MobileNav onClose={() => setShowMobileNav(false)}/>}
            </MobileView> }
          </div>
        </header>
        <Routes>
          <Route path='/' element={<Navigate to='/lots' replace/>}/>
          <Route path='/lots' element={<Lots/>}/>
          <Route path='/offerProcess' element={<OfferProcessPage {...{...offerProcessState, offerProcessOutput}} />}/>
          <Route path='/profile' element={<ProfilePage/>}/>
          <Route path='/about' element={<AboutPage/>}/>
        </Routes>
      </Router>
      <ModalConfirm/>
    </main>
    <footer>
      <div className="container legal-notice">
        WE RECOMMEND YOU CONSULT LEGAL, FINANCIAL, TAX AND OTHER PROFESSIONAL ADVISORS OR EXPERTS FOR FURTHER GUIDANCE
        BEFORE SELLING/BUYING ANY NAMES AT <a href="https://nearnames.io">https://nearnames.io</a>. <br/>
        YOU ARE STRONGLY ADVISED TO TAKE INDEPENDENT LEGAL ADVICE IN RESPECT OF THE LEGALITY IN YOUR JURISDICTION OF
        ANY PARTICIPATION AND OPERATIONS OF THE SITE OR ITS SMART CONTRACTS.
      </div>
    </footer>
  </ConfirmContextProvider>
  </AuthContextProvider>
  </NearContextProvider>
  )
}

export default App;
