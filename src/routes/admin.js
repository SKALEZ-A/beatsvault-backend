// backend/src/routes/admin.js
// Protected by ADMIN_SECRET header
// Handles beat uploads to Supabase + DB management

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

// Multer — store in memory, then pipe to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.zip', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
});

// ── Auth middleware ───────────────────────────────────────
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
router.use(adminAuth);

// ── Upload helper ─────────────────────────────────────────
async function uploadToSupabase(bucket, filePath, buffer, mimetype) {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: mimetype,
      upsert: true,
    });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return data.path;
}

async function getPublicUrl(bucket, filePath) {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

// ── POST /api/admin/beats — upload new beat ───────────────
// Form fields: title, genre, bpm, key, duration, description, moods (comma-sep),
//              priceMP3, priceWAV, priceStems, tag, published, featured
// Files: artwork, preview (60s MP3), fullMP3, fullWAV (optional), stems (optional)
router.post(
  '/beats',
  upload.fields([
    { name: 'artwork', maxCount: 1 },
    { name: 'preview', maxCount: 1 },   // public 60s watermarked MP3
    { name: 'fullMP3', maxCount: 1 },
    { name: 'fullWAV', maxCount: 1 },
    { name: 'stems', maxCount: 1 },     // ZIP file
  ]),
  async (req, res) => {
    const {
      title, genre, bpm, key, duration, description,
      moods, priceMP3, priceWAV, priceStems,
      tag, published, featured,
    } = req.body;

    if (!title || !genre || !bpm || !key) {
      return res.status(400).json({ error: 'title, genre, bpm, key are required' });
    }

    const beatId = uuidv4();
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const basePath = `beats/${slug}-${beatId.slice(0, 8)}`;

    const files = req.files || {};
    let artworkUrl, previewUrl, fullMP3Path, fullWAVPath, stemZipPath;

    // Upload artwork (public bucket)
    if (files.artwork?.[0]) {
      const f = files.artwork[0];
      const ext = path.extname(f.originalname);
      const p = `${basePath}/artwork${ext}`;
      await uploadToSupabase('beat-previews', p, f.buffer, f.mimetype);
      artworkUrl = await getPublicUrl('beat-previews', p);
    } else {
      artworkUrl = `https://placehold.co/600x600/0a0a2a/ffffff?text=${encodeURIComponent(title)}`;
    }

    // Upload preview MP3 (public bucket)
    if (files.preview?.[0]) {
      const f = files.preview[0];
      const p = `${basePath}/preview.mp3`;
      await uploadToSupabase('beat-previews', p, f.buffer, f.mimetype);
      previewUrl = await getPublicUrl('beat-previews', p);
    } else {
      return res.status(400).json({ error: 'preview MP3 is required' });
    }

    // Upload full files (private bucket)
    if (files.fullMP3?.[0]) {
      const f = files.fullMP3[0];
      fullMP3Path = `${basePath}/full.mp3`;
      await uploadToSupabase('beat-fulls', fullMP3Path, f.buffer, f.mimetype);
    } else {
      return res.status(400).json({ error: 'full MP3 is required' });
    }

    if (files.fullWAV?.[0]) {
      const f = files.fullWAV[0];
      fullWAVPath = `${basePath}/full.wav`;
      await uploadToSupabase('beat-fulls', fullWAVPath, f.buffer, f.mimetype);
    }

    if (files.stems?.[0]) {
      const f = files.stems[0];
      stemZipPath = `${basePath}/stems.zip`;
      await uploadToSupabase('beat-fulls', stemZipPath, f.buffer, f.mimetype);
    }

    const beat = await prisma.beat.create({
      data: {
        id: beatId,
        title,
        genre,
        bpm: parseInt(bpm),
        key,
        duration: duration || '0:00',
        description: description || '',
        moods: moods ? moods.split(',').map(m => m.trim()) : [],
        priceMP3: parseInt(priceMP3),
        priceWAV: parseInt(priceWAV || priceMP3),
        priceStems: parseInt(priceStems || priceMP3),
        artworkUrl,
        previewUrl,
        fullMP3Path,
        fullWAVPath: fullWAVPath || null,
        stemZipPath: stemZipPath || null,
        tag: tag || null,
        published: published === 'true',
        featured: featured === 'true',
      },
    });

    res.status(201).json(beat);
  }
);

// ── GET /api/admin/beats — list all beats (including unpublished) ─────────
router.get('/beats', async (req, res) => {
  const beats = await prisma.beat.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orders: true } } },
  });
  res.json(beats);
});

// ── PATCH /api/admin/beats/:id — update beat metadata ────────────────────
router.patch('/beats/:id', async (req, res) => {
  const allowed = ['title', 'genre', 'bpm', 'key', 'duration', 'description',
    'moods', 'priceMP3', 'priceWAV', 'priceStems', 'tag', 'published', 'featured'];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (data.bpm) data.bpm = parseInt(data.bpm);
  if (data.priceMP3) data.priceMP3 = parseInt(data.priceMP3);
  if (data.priceWAV) data.priceWAV = parseInt(data.priceWAV);
  if (data.priceStems) data.priceStems = parseInt(data.priceStems);

  const beat = await prisma.beat.update({ where: { id: req.params.id }, data });
  res.json(beat);
});

// ── DELETE /api/admin/beats/:id — remove beat ────────────────────────────
router.delete('/beats/:id', async (req, res) => {
  await prisma.beat.update({
    where: { id: req.params.id },
    data: { published: false },
  });
  res.json({ success: true, message: 'Beat unpublished (soft delete)' });
});

// ── GET /api/admin/orders — view all orders ───────────────────────────────
router.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { beat: { select: { title: true } } } } },
    take: 100,
  });
  res.json(orders);
});

module.exports = router;
