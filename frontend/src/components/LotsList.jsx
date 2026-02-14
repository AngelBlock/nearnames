import React, {useEffect, useState} from 'react';
import Lot from "./Lot";
import ModalClaim from "./Claim";
import ModalBid from "./Bid";
import {
  BOATLOAD_OF_GAS,
  toNear,
  getBuyNowPrice,
  getNextBidAmount,
} from "../utils";
import ModalAlert from "./Alert";
import { useNavigate } from "react-router-dom";
import useConfirm from "../Hooks/useConfirm";
import Loader from "./Loader";
import ModalOffer from "./ReOffer";
import { useNear } from "../Hooks/useNear";
import { useAuth } from "../Hooks/useAuth";

function LotsList(props) {
  const navigate = useNavigate();
  const { contract, nearConfig } = useNear();
  const { signedAccountId } = useAuth();
  const { isConfirmed } = useConfirm();

  const [modalClaimShow, setModalClaimShow] = useState(false);
  const [modalBidShow, setModalBidShow] = useState(false);
  const [modalOfferShow, setModalOfferShow] = useState(false);
  const [modalAlertShow, setModalAlertShow] = useState(false);
  const [alertContent, setAlertContent] = useState('');
  const [selectedLot, setSelectedLot] = useState('');
  const [withdrawingLotId, setWithdrawingLotId] = useState(null);
  const [biddingLotId, setBiddingLotId] = useState(null);

  const withdraw = async (lot) => {
    try {
      setWithdrawingLotId(lot.lot_id);
      await contract.lot_withdraw({'lot_id': lot.lot_id}, BOATLOAD_OF_GAS);
      navigate("/profile");
    } catch (err) {
      let errorMessage = err.message;
      if (err.message.includes('expected no bids')) {
        errorMessage = "You can't withdraw because the lot had already bids";
      }
      if (err.message.includes('already withdrawn')) {
        errorMessage = "The lot has already been withdrawn";
      }
      alertOpen(errorMessage);
      console.error(err);
    } finally {
      await getLot(lot.lot_id);
      setWithdrawingLotId(null);
    }
  };

  const alertOpen = (text) => {
    setModalAlertShow(true);
    setAlertContent(text);
  };

  const alertHide = () => {
    setModalAlertShow(false);
  };

  const claimOpen = (lot) => {
    setModalClaimShow(true);
    setSelectedLot(lot);
  };

  const claimHide = async (claimSuccess) => {
    setModalClaimShow(false);
    if (claimSuccess) {
      await getLot(selectedLot.lot_id);
    }
    setSelectedLot('');
  };

  const openBid = async (lot) => {
    setModalBidShow(true);
    const selLot = await getLot(lot.lot_id);
    setSelectedLot(selLot);
  }

  const closeBid = async () => {
    setModalBidShow(false);
    setSelectedLot('');
  }

  const openOffer = async (lot) => {
    setModalOfferShow(true);
    setSelectedLot(lot);
  }

  const closeOffer = async () => {
    setModalOfferShow(false);
    setSelectedLot('');
  }

  const getLot = async (lotId) => {
    const lot = await contract.lot_get({lot_id: lotId});
    await updateLots(lot);
    return lot;
  }

  const updateLots = async (lot) => {
    if (lot) {
      await props.putLot(lot);
      setSelectedLot(lot);
    } else {
      await props.getLots();
    }
  }

  const bid = async (e, lotId, value) => {
    setBiddingLotId(lotId);
    e.target.disabled = true;
    const lot = await getLot(lotId);
    if (lot.status !== 'OnSale') {
      alertOpen('Sorry lot no longer on sale');
      setBiddingLotId(null);
      e.target.disabled = false;
      return;
    }
    const bid_price = toNear(value);
    if (bid_price && toNear(getNextBidAmount(lot)).cmp(bid_price) > 0) {
      alertOpen('Sorry lot next bid has changed');
      setBiddingLotId(null);
      e.target.disabled = false;
      return;
    }
    if (bid_price.cmp(toNear(getBuyNowPrice(lot))) > 0) {
      const isConfirm = await isConfirmed(
        'Your bid price ' + value + ' NEAR is higher than the buy now price ' + getBuyNowPrice(lot) + ' NEAR. ' +
        'Are you sure you want to bid?'
      );
      if(!isConfirm) {
        setBiddingLotId(null);
        e.target.disabled = false;
        return;
      }
    }

    await contract.lot_bid({
      args: { lot_id: lot.lot_id },
      gas: BOATLOAD_OF_GAS,
      amount: bid_price.toFixed(),
      callbackUrl: new URL('/#/profile', window.location.origin),
    });
  };

  useEffect( () => {
    props.getLots();
  }, []);

  return (
    <div className="lots-container">
      { props.name ? <h5 className="lots-title">Lots {props.name}</h5> : ''}
      { props.loader ?
        <Loader/> :
        <ul className="lot_list">
          {props.lots.map((lot) =>
            <Lot lot={lot} key={lot.lot_id} showStatus={props.showStatus}
                 openBid={openBid} withdraw={withdraw} claim={claimOpen} offer={openOffer}
                 withdrawing={withdrawingLotId === lot.lot_id}
                 bidding={biddingLotId === lot.lot_id}/>
          )}
          {props.lots.length === 0 ? <li className='lot_item'><div className="lot_info">No lots available</div></li> : ''}
        </ul>
      }
      <ModalClaim
        open={modalClaimShow}
        lot={selectedLot}
        onClose={(claimSuccess) => claimHide(claimSuccess)}
      />
      <ModalBid
        open={modalBidShow}
        lot={selectedLot}
        bid={bid}
        onClose={() => closeBid()}
      />
      <ModalOffer
        lot={selectedLot}
        open={modalOfferShow}
        getLot={getLot}
        onClose={() => closeOffer()}
      />
      <ModalAlert
        open={modalAlertShow}
        content={alertContent}
        onClose={() => alertHide()}
      />
    </div>
  );
}

export default LotsList
