import React, {useEffect, useState} from 'react';
import Loader from './Loader';
import {BOATLOAD_OF_GAS, nearToFloor, renderName, loadListPaginated, fetchBidSafety} from "../utils";
import LotsList from "./LotsList";
import { useNear } from "../Hooks/useNear";
import { useAuth } from "../Hooks/useAuth";

function Profile () {
  const { contract, legacyNear, nearConfig } = useNear();
  const { signedAccountId, updateBalance } = useAuth();
  const profileId = signedAccountId;

  const [profile, setProfile] = useState([]);
  const [lotsOffering, setLotsOffering] = useState([]);
  const [lotsBidding, setLotsBidding] = useState([]);
  const [lotsWon, setLotsWon] = useState([]);
  const [loader, setLoader] = useState(true);
  const [lotsOfferLoader, setLotsOfferLoader] = useState(false);
  const [lotsBidLoader, setLotsBidLoader] = useState(false);
  const [lotsWonLoader, setLotsWonLoader] = useState(false);
  const [claimLoader, setClaimLoader] = useState(false);

  const lotsChecked = async (lotsMemo) => {

    if (!lotsMemo.length) {
      return [];
    }

    await Promise.all(lotsMemo.map(async (l) => {
      const isSafe = await fetchBidSafety(l.lot_id, legacyNear, nearConfig);
      l.notSafe = !isSafe;
    }));

    return lotsMemo;

  }

  const getLotsOffering = async () => {

    let lotsMemo = [];

    setLotsOfferLoader(true);

    await loadListPaginated(
      args => contract.lot_list_offering_by({ profile_id: profileId, ...args }),
    ).then(async (lots) => {
      lotsMemo = lots;
      setLotsOffering(lotsMemo);
    });

    setLotsOfferLoader(false);

    const checked = await lotsChecked(lotsMemo);

    setLotsOffering([...checked]);

  }

  const getLotsBidding = async () => {

    let lotsMemo = [];

    setLotsBidLoader(true);

    await loadListPaginated(
      args => contract.lot_list_bidding_by({ profile_id: profileId, ...args }),
    ).then(async (lots) => {
      lotsMemo = lots.filter((lot) => {
        return lot.status === 'OnSale';
      });
      setLotsBidding(lotsMemo);
    });

    setLotsBidLoader(false);

    const checked = await lotsChecked(lotsMemo);

    setLotsBidding([...checked]);

  }

  const getLotsWon = async () => {

    let lotsMemo = [];

    setLotsWonLoader(true);

    await loadListPaginated(
      args => contract.lot_list_bidding_by({ profile_id: profileId, ...args }),
    ).then(async (lots) => {
      lotsMemo = lots.filter((lot) => {
        return lot.status === 'SaleSuccess' && profileId === lot.last_bidder_id;
      });
      setLotsWon(lotsMemo);
    });

    setLotsWonLoader(false);

    const checked = await lotsChecked(lotsMemo);

    setLotsWon([...checked]);

  }

  const putLotOffering = async (lot) => {
    const isSafe = await fetchBidSafety(lot.lot_id, legacyNear, nearConfig);
    lot.notSafe = !isSafe;
    const updatedLots = lotsOffering.map((l) => {
      if (lot && l.lot_id === lot.lot_id) {
        return lot;
      }
      return l;
    })
    setLotsOffering(updatedLots);
  }

  const putLotBidding = async (lot) => {
    const isSafe = await fetchBidSafety(lot.lot_id, legacyNear, nearConfig);
    lot.notSafe = !isSafe;
    const updatedLots = [...lotsWon, ...lotsBidding].map((l) => {
      if (l.lot_id === lot.lot_id) {
        return lot;
      }
      return l;
    });
    setLotsWon([]);
    setLotsBidding([]);
    updatedLots.forEach((lot) => {
      if (lot.status === 'SaleSuccess' && profileId === lot.last_bidder_id) {
        setLotsWon(lotsWon => [...lotsWon, lot]);
      } else {
        setLotsBidding(lotsBidding => [...lotsBidding, lot]);
      }
    })
  }

  useEffect(() => {
    (async () => {
      await contract.profile_get({profile_id: profileId}).then(setProfile);
      setLoader(false);
    })();
  }, []);

  const claim = async () => {
    setClaimLoader(true);
    try {
      await contract.profile_rewards_claim({}, BOATLOAD_OF_GAS).then(() => {
        contract.profile_get({profile_id: profileId}).then(async (profile) => {
          setProfile(profile);
          await updateBalance();
          setClaimLoader(false);
        });
      });
    } catch (e) {
      console.error(e);
      setClaimLoader(false);
    }
  };


  return (
    <div className="container">
    { loader ? <Loader/> : profile ?
      <div>
        <div className="profile-container">
          <h5 className="profile-name"><strong>{renderName(profileId)}</strong></h5>
          <div className="profile-block"><strong>Available:</strong> <span className="rewards near-icon">{nearToFloor(profile.rewards_available)}</span></div>
          <div className="profile-block"><strong>Claimed:</strong> <span className="rewards near-icon">{nearToFloor(profile.rewards_claimed)}</span></div>
          <button className="claim-rewards" disabled={!parseFloat(profile.rewards_available) || claimLoader} onClick={(e) => claim(e)}>{claimLoader ? 'Claiming...' : 'Claim rewards'}</button>
        </div>
        <LotsList lots={lotsOffering} getLots={getLotsOffering} putLot={putLotOffering} showStatus={true} loader={lotsOfferLoader} name={' you are selling'}/>
        <LotsList lots={lotsBidding} getLots={getLotsBidding} putLot={putLotBidding} showStatus={true} loader={lotsBidLoader} name={' you are bidding on'}/>
        <LotsList lots={lotsWon} getLots={getLotsWon} putLot={putLotBidding} showStatus={true} loader={lotsWonLoader} name={' you won'}/>
      </div> :
      <div className="profile-container">
        <h5 className="profile-name"><strong>Profile not found</strong></h5>
      </div>
    }
    </div>
  );


}

export default Profile
