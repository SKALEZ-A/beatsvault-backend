// backend/src/routes/download.js
// Validates download token → generates short-lived signed Supabase URLs
// This is the ONLY way to get the full beat files — no token, no download

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role — can sign private bucket URLs
);

const PRIVATE_BUCKET = 'beat-fulls';
const SIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes — short-lived, single-use style

// GET /api/download/:token
// Returns list of downloadable files for the order
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: { items: { include: { beat: true } } },
  });

  if (!order) {
    return res.status(404).json({ error: 'Invalid or expired download link' });
  }

  if (order.paystackStatus !== 'success') {
    return res.status(403).json({ error: 'Payment not confirmed' });
  }

  if (order.downloadExpiry && new Date() > order.downloadExpiry) {
    return res.status(410).json({
      error: 'Download link expired (48 hours). Contact support to renew.',
    });
  }

  // Build signed URLs for each item
  const files = [];

  for (const item of order.items) {
    const { beat, license } = item;

    const pathMap = {
      MP3: beat.fullMP3Path,
      WAV: beat.fullWAVPath,
      STEMS: beat.stemZipPath,
    };

    const filePath = pathMap[license];
    if (!filePath) continue;

    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRES_IN);

    if (error) {
      console.error(`Failed to sign URL for ${filePath}:`, error.message);
      files.push({ title: beat.title, license, error: 'File temporarily unavailable' });
      continue;
    }

    files.push({
      title: beat.title,
      license,
      filename: `${beat.title.replace(/\s+/g, '_')}_${license}.${license === 'STEMS' ? 'zip' : license.toLowerCase()}`,
      url: data.signedUrl,
      expiresIn: SIGNED_URL_EXPIRES_IN,
    });
  }

  // Increment download count
  await prisma.order.update({
    where: { id: order.id },
    data: { downloadCount: { increment: 1 } },
  });

  res.json({
    orderId: order.id,
    email: order.email,
    files,
    downloadsUsed: order.downloadCount + 1,
    expiresAt: order.downloadExpiry,
  });
});

module.exports = router;
