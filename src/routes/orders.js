// backend/src/routes/orders.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const LICENSE_ADDONS = {
  MP3: 0,
  WAV: parseInt(process.env.PRICE_WAV_ADDON || 5000),
  STEMS: parseInt(process.env.PRICE_STEMS_ADDON || 15000),
};

// POST /api/orders/initialize
// Body: { email, name, items: [{ beatId, license }] }
// Returns: { authorizationUrl, reference } — redirect/popup to Paystack
router.post('/initialize', async (req, res) => {
  const { email, name, items } = req.body;

  if (!email || !name || !items || !items.length) {
    return res.status(400).json({ error: 'email, name, and items are required' });
  }

  // Validate and price items
  const pricedItems = [];
  let totalNaira = 0;

  for (const item of items) {
    const beat = await prisma.beat.findUnique({
      where: { id: item.beatId, published: true },
    });
    if (!beat) return res.status(404).json({ error: `Beat ${item.beatId} not found` });

    const licKey = item.license?.toUpperCase();
    if (!['MP3', 'WAV', 'STEMS'].includes(licKey)) {
      return res.status(400).json({ error: `Invalid license: ${item.license}` });
    }

    // Check if stem zip exists when STEMS ordered
    if (licKey === 'STEMS' && !beat.stemZipPath) {
      return res.status(400).json({ error: `Stems not available for: ${beat.title}` });
    }

    const priceMap = { MP3: beat.priceMP3, WAV: beat.priceWAV, STEMS: beat.priceStems };
    const price = priceMap[licKey];
    pricedItems.push({ beat, license: licKey, price });
    totalNaira += price;
  }

  // Create a pending order in DB first
  const reference = `BV-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      email,
      name,
      paystackRef: reference,
      paystackStatus: 'pending',
      amountPaid: totalNaira,
      items: {
        create: pricedItems.map(i => ({
          beatId: i.beat.id,
          license: i.license,
          price: i.price,
        })),
      },
    },
  });

  // Initialize Paystack transaction
  const paystackRes = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email,
      amount: totalNaira * 100, // Paystack uses kobo
      reference,
      currency: 'NGN',
      metadata: {
        orderId: order.id,
        customerName: name,
        custom_fields: [
          { display_name: 'Customer Name', variable_name: 'name', value: name },
          { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
        ],
      },
      callback_url: `${process.env.FRONTEND_URL}/order/confirm?ref=${reference}`,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const { authorization_url, access_code } = paystackRes.data.data;

  res.json({
    authorizationUrl: authorization_url,
    accessCode: access_code,
    reference,
    orderId: order.id,
    amount: totalNaira,
  });
});

// GET /api/orders/verify/:reference — called after Paystack redirect
router.get('/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  const order = await prisma.order.findUnique({
    where: { paystackRef: reference },
    include: { items: { include: { beat: true } } },
  });

  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Already confirmed — return existing data
  if (order.paystackStatus === 'success') {
    return res.json({ status: 'success', order: sanitizeOrder(order) });
  }

  // Verify with Paystack
  const paystackRes = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  );

  const { status, amount } = paystackRes.data.data;

  if (status === 'success' && amount >= order.amountPaid * 100) {
    // Payment confirmed — generate download token
    const downloadToken = uuidv4();
    const downloadExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await prisma.order.update({
      where: { id: order.id },
      data: { paystackStatus: 'success', downloadToken, downloadExpiry },
    });

    // Send email
    const { sendDownloadEmail } = require('../lib/email');
    await sendDownloadEmail({
      to: order.email,
      name: order.name,
      items: order.items,
      downloadToken,
    });

    return res.json({ status: 'success', downloadToken, order: sanitizeOrder(order) });
  }

  res.json({ status: paystackRes.data.data.status });
});

function sanitizeOrder(order) {
  return {
    id: order.id,
    email: order.email,
    name: order.name,
    amountPaid: order.amountPaid,
    createdAt: order.createdAt,
    items: order.items.map(i => ({
      title: i.beat.title,
      license: i.license,
      price: i.price,
      artworkUrl: i.beat.artworkUrl,
    })),
  };
}

module.exports = router;
