const express = require('express');
const {
  addCartOffer,
  updateCartOffer,
  deleteCartOffer,
  searchCartOffers,
  cartOffers,
  previewCartOffers
} = require('../controllers/cartOfferController');

// Cart offers. Panel set-up is staff-only; app/cartOffers serves the app
// (logged in or, through the gateway's /public/getCartOffers, guest).
const router = express.Router();
router.post('/addCartOffer', addCartOffer);
router.post('/updateCartOffer', updateCartOffer);
router.post('/deleteCartOffer', deleteCartOffer);
router.post('/searchCartOffers', searchCartOffers);
router.post('/previewCartOffers', previewCartOffers);
router.post('/app/cartOffers', cartOffers);
module.exports = router;
