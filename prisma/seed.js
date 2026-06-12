// prisma/seed.js — Sample beats for development
// Run: node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLE_BEATS = [
  {
    title: "My Love",
    genre: "Afrobeats",
    bpm: 98,
    key: "C# min",
    duration: "2:47",
    description: "A smooth Afrobeats instrumental with warm guitar tones and a gentle percussive groove. Perfect for melodic vocals.",
    moods: ["Romantic", "Chill"],
    priceMP3: 34500,
    priceWAV: 39500,
    priceStems: 49500,
    artworkUrl: "https://placehold.co/600x600/0a0a2a/ffffff?text=My+Love",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    fullMP3Path: "beats/my-love/full.mp3",
    fullWAVPath: "beats/my-love/full.wav",
    stemZipPath: "beats/my-love/stems.zip",
    published: true,
    featured: true,
    tag: "New",
  },
  {
    title: "Lagos Nights",
    genre: "Afrobeats",
    bpm: 104,
    key: "F maj",
    duration: "3:12",
    description: "Infectious Afrobeats with punchy drums, talking drum accents, and a hypnotic bass line.",
    moods: ["Energetic", "Vibes"],
    priceMP3: 28000,
    priceWAV: 33000,
    priceStems: 43000,
    artworkUrl: "https://placehold.co/600x600/0a1a2a/ffffff?text=Lagos+Nights",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    fullMP3Path: "beats/lagos-nights/full.mp3",
    fullWAVPath: "beats/lagos-nights/full.wav",
    stemZipPath: null,
    published: true,
    featured: false,
    tag: "Hot",
  },
  {
    title: "Afro Drill",
    genre: "Drill",
    bpm: 142,
    key: "A min",
    duration: "2:40",
    description: "Dark Afro Drill fusion with sliding 808s and an orchestral arrangement.",
    moods: ["Hype", "Dark"],
    priceMP3: 38000,
    priceWAV: 43000,
    priceStems: 53000,
    artworkUrl: "https://placehold.co/600x600/1a0a0a/ffffff?text=Afro+Drill",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    fullMP3Path: "beats/afro-drill/full.mp3",
    fullWAVPath: "beats/afro-drill/full.wav",
    stemZipPath: "beats/afro-drill/stems.zip",
    published: true,
    featured: false,
    tag: "New",
  },
  {
    title: "Slow Burn",
    genre: "R&B",
    bpm: 72,
    key: "D min",
    duration: "3:30",
    description: "Smooth late-night R&B with warm pads, muted guitar, and silky 808s.",
    moods: ["Chill", "Late Night"],
    priceMP3: 25000,
    priceWAV: 30000,
    priceStems: 40000,
    artworkUrl: "https://placehold.co/600x600/1a0a1a/ffffff?text=Slow+Burn",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    fullMP3Path: "beats/slow-burn/full.mp3",
    fullWAVPath: "beats/slow-burn/full.wav",
    stemZipPath: null,
    published: true,
    featured: false,
    tag: null,
  },
];

async function main() {
  console.log('Seeding database...');
  for (const beat of SAMPLE_BEATS) {
    await prisma.beat.upsert({
      where: { id: beat.title.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: beat,
    });
  }
  console.log(`Seeded ${SAMPLE_BEATS.length} beats.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
