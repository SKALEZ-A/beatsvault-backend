// backend/src/routes/beats.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/beats — list all published beats
// Query params: genre, search, featured
router.get('/', async (req, res) => {
  const { genre, search, featured } = req.query;

  const where = { published: true };

  if (genre && genre !== 'All') {
    where.genre = genre;
  }
  if (featured === 'true') {
    where.featured = true;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { genre: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const beats = await prisma.beat.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      genre: true,
      bpm: true,
      key: true,
      duration: true,
      description: true,
      moods: true,
      priceMP3: true,
      priceWAV: true,
      priceStems: true,
      artworkUrl: true,
      previewUrl: true,  // safe — this is the public preview
      tag: true,
      featured: true,
      createdAt: true,
      // NOTE: fullMP3Path, fullWAVPath, stemZipPath are NOT included here
      // Those only come out via /api/download after payment verification
    },
  });

  res.json(beats);
});

// GET /api/beats/genres — unique genre list
router.get('/genres', async (req, res) => {
  const genres = await prisma.beat.findMany({
    where: { published: true },
    select: { genre: true },
    distinct: ['genre'],
    orderBy: { genre: 'asc' },
  });
  res.json(['All', ...genres.map(g => g.genre)]);
});

// GET /api/beats/:id — single beat detail
router.get('/:id', async (req, res) => {
  const beat = await prisma.beat.findUnique({
    where: { id: req.params.id, published: true },
    select: {
      id: true,
      title: true,
      genre: true,
      bpm: true,
      key: true,
      duration: true,
      description: true,
      moods: true,
      priceMP3: true,
      priceWAV: true,
      priceStems: true,
      artworkUrl: true,
      previewUrl: true,
      tag: true,
      featured: true,
      // private file paths excluded intentionally
    },
  });

  if (!beat) return res.status(404).json({ error: 'Beat not found' });
  res.json(beat);
});

module.exports = router;
