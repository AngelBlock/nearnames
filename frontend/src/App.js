import 'regenerator-runtime/runtime';
import React, {useEffect, useMemo, useState} from 'react';
import * as nearAPI from 'near-api-js';
import localStorage from 'local-storage';
import {HashRouter as Router, NavLink, Redirect, Route, Switch} from 'react-router-dom';
import OfferProcessPage from './components/OfferProcess';
import Lots from './components/Lots';
import ProfilePage from './components/Profile';
import LogoutIcon from '@mui/icons-material/Logout';
import CreateOffer from "./components/CreateOffer";
import {nearToFloor, renderName, withTimeout, makeContractProxy} from "./utils";
import AboutPage from "./components/About";
import ConfirmContextProvider from "./Providers/ConfirmContextProvider";
import ModalConfirm from "./components/Confirm";
import {IconButton} from "@mui/material";
import { BrowserView, MobileView, isBrowser, isMobile } from 'react-device-detect';
import MobileNav from "./components/MobileNav";
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NetworkSelect from "./components/NetworkSelect";
import { useWalletSelector } from "@near-wallet-selector/react-hook";

function App (props) {

  const nearConfig = props.nearConfig;
  const legacyNear = props.legacyNear;
  const legacyWallet = props.legacyWallet;

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

  useEffect(async () => {
    await initOffer();
    setConnected(true);
  }, []);

  // Update balance when signed account changes
  useEffect(async () => {
    if (signedAccountId) {
      const balance = await getBalance(signedAccountId);
      setSignedAccountBalance(balance);
    } else {
      setSignedAccountBalance(null);
    }
  }, [signedAccountId]);

  const updateBalance = async () => {
    if (signedAccountId) {
      setSignedAccountBalance(await getBalance(signedAccountId));
    }
  }

  const getBalance = async (accountId) => {
    try {
      const account = await legacyNear.account(accountId);
      const balance = await account.getAccountBalance();
      return balance.available;
    } catch (e) {
      return null;
    }
  }

  const handleSignOut = async (withReload) => {
    await walletSelectorSignOut();
    withReload && window.location.replace(window.location.origin + window.location.pathname);
  };

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
      console.log(`failed to parse lot offer data`);
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

      console.log('all keys', accessKeys);
      console.log('all local keys', legacyWallet._authData.allKeys);
      console.log('last key', lastKey);

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
      console.log('Deploying done. Initializing contract...');
      console.log(await withTimeout(contractLock.lock(Buffer.from('{"owner_id":"' + nearConfig.contractName + '"}'))));

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'Init is done.']);
      console.log('Init is done.');

      console.log('code hash', (await withTimeout(account.state())).code_hash);

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'Create lot offer.']);

      const lot = await withTimeout(contract.lot_get({lot_id: lotAccountId}))

      if (!lot) {
        await withTimeout(contract.lot_offer(offerData));
      }

      for (let index = 0; index < accessKeys.length; index++) {
        if (accessKeys[index].public_key !== lastKey) {
          setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'deleting ' + accessKeys[index].public_key]);
          console.log('deleting ', accessKeys[index]);
          await withTimeout(account.deleteKey(accessKeys[index].public_key));
          console.log('deleting ', accessKeys[index], 'done');
        }
      }

      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'deleting last key ' + lastKey]);
      console.log('deleting last key', lastKey);
      await withTimeout(account.deleteKey(lastKey));
      setOfferProcessOutput(offerProcessOutput => [...offerProcessOutput, 'deleting done']);
      console.log('deleting ', lastKey, 'done');

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
      console.log('Error', e)
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
    } finally {
      console.log('init offer finish');
    }
  }

  const passProps = {
    connected,
    signedAccount: signedAccountId,
    signedAccountBalance,
    contract,
    nearConfig,
    near: legacyNear,
  };

  const offerProps = {
    lsPrevKeys,
    lsLotAccountId,
    wallet: legacyWallet,
    near: legacyNear,
  }

  return (
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
                  <NavLink activeClassName='active' className='nav-link' aria-current='page' to='/lots'>Lots</NavLink>
                </li>
              { signedAccountId && (<li className='nav-item'>
                  <NavLink activeClassName='active' className='nav-link' aria-current='page'
                        to='profile'>Profile</NavLink>
                </li>)}
                <li className='nav-item'>
                  <NavLink activeClassName='active' className='nav-link' aria-current='page' to='/about'>About</NavLink>
                </li>
              </ul>
            </BrowserView>}
            <CreateOffer {...{...passProps, ...offerProps, signedAccount: signedAccountId}}/>
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
              {showMobileNav && <MobileNav onClose={() => setShowMobileNav(false)} signIn={signIn} signOut={(e) => handleSignOut(e)} {...passProps} signedAccount={signedAccountId}/>}
            </MobileView> }
          </div>
        </header>
        <Switch>
          <Route exact path='/'>
            <Redirect to='/lots'/>
          </Route>
          <Route exact path='/lots'>
            <Lots {...{...passProps, signIn}}/>
          </Route>
          <Route exact path='/offerProcess'>
            <OfferProcessPage {...{...offerProcessState, offerProcessOutput}} />
          </Route>
          <Route exact path='/profile'>
            <ProfilePage {...{...passProps, updateBalance}}/>
          </Route>
          <Route exact path='/about'>
            <AboutPage/>
          </Route>
        </Switch>
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
  )
}

export default App;
