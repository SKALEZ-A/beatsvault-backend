// backend/src/routes/paystack.js — Webhook handler
// Paystack sends a POST here when payment is confirmed
// This is the authoritative payment handler (not just the redirect)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { sendDownloadEmail } = require('../lib/email');

const prisma = new PrismaClient();

// POST /api/webhooks/paystack
router.post('/paystack', async (req, res) => {
  // Verify Paystack signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body) // raw body (Buffer)
    .digest('hex');

  const signature = req.headers['x-paystack-signature'];

  if (hash !== signature) {
    console.warn('❌ Invalid Paystack webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());
  console.log(`📩 Paystack webhook: ${event.event}`);

  if (event.event === 'charge.success') {
    const { reference, amount, customer } = event.data;

    const order = await prisma.order.findUnique({
      where: { paystackRef: reference },
      include: { items: { include: { beat: true } } },
    });

    if (!order) {
      console.warn(`No order found for reference: ${reference}`);
      return res.status(200).json({ received: true }); // 200 to stop Paystack retrying
    }

    // Idempotency — skip if already processed
    if (order.paystackStatus === 'success') {
      return res.status(200).json({ received: true });
    }

    // Verify amount matches (convert from kobo)
    const paidNaira = Math.floor(amount / 100);
    if (paidNaira < order.amountPaid) {
      console.error(`Amount mismatch: expected ${order.amountPaid}, got ${paidNaira}`);
      return res.status(200).json({ received: true });
    }

    const downloadToken = uuidv4();
    const downloadExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paystackStatus: 'success',
        downloadToken,
        downloadExpiry,
      },
    });

    // Send download email
    await sendDownloadEmail({
      to: order.email,
      name: order.name,
      items: order.items,
      downloadToken,
    });

    console.log(`✅ Order ${order.id} confirmed. Email sent to ${order.email}`);
  }

  res.status(200).json({ received: true });
});

module.exports = router;
