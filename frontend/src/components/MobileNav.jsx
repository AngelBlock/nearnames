import React from 'react';
import {NavLink} from "react-router-dom";
import {IconButton} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {nearToFloor, renderName} from "../utils";
import LogoutIcon from "@mui/icons-material/Logout";
import NetworkSelect from "./NetworkSelect";
import { useAuth } from "../Hooks/useAuth";

function MobileNav(props) {

  const { signedAccountId, signedAccountBalance, connected, signIn, signOut } = useAuth();

  return (
    <div className="mobile-header">
      <h1><NavLink aria-current='page' to='/' onClick={props.onClose}>Near names</NavLink></h1>
      <IconButton
        aria-label="close"
        onClick={props.onClose}
        className="button-icon"
        sx={{
          position: 'absolute',
          right: 20,
          top: 20,
          color: 'var(--gray)',
        }}
      >
        <CloseIcon />
      </IconButton>
      <NetworkSelect/>
      <ul className='nav'>
        <li className='nav-item'>
          <NavLink className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')} aria-current='page'
                   onClick={props.onClose} to='/lots'>Lots</NavLink>
        </li>
        { signedAccountId && (<li className='nav-item'>
          <NavLink className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')} aria-current='page'
                   onClick={props.onClose} to='profile'>Profile</NavLink>
        </li>)}
        <li className='nav-item'>
          <NavLink className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')} aria-current='page'
                   onClick={props.onClose} to='/about'>About</NavLink>
        </li>
      </ul>
      { !connected ? (
        <div className="auth">
          <span className='spinner' role='status' aria-hidden='true'>Connecting...</span>
        </div>
      ) : signedAccountId
        ? <div className="auth">
          <strong className="balance near-icon">{nearToFloor(signedAccountBalance) || '-'}</strong>
          {renderName(signedAccountId)}
          <a className="icon logout" onClick={() => signOut(true)}><LogoutIcon/></a>
        </div>
        : <div className="auth"><button className="login" onClick={signIn}>Log in</button></div>
      }
    </div>
  )
}

export default MobileNav;
