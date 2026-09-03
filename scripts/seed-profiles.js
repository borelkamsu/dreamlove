require('dotenv').config();
const https = require('https');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { uploadBuffer } = require('../config/cloudinary');

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchImage(res.headers.location).then(resolve, reject);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function birthdateForAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(0);
  d.setDate(15);
  return d;
}

const PROFILES = [
  {
    email: 'emma.dreamlove@example.com',
    name: 'Emma',
    age: 26,
    gender: 'femme',
    seeking: 'homme',
    location: 'Paris',
    bio: "Passionnée de voyages et de cuisine italienne. À la recherche de quelqu'un qui aime rire autant que moi.",
    verified: true,
  },
  {
    email: 'lucas.dreamlove@example.com',
    name: 'Lucas',
    age: 29,
    gender: 'homme',
    seeking: 'femme',
    location: 'Lyon',
    bio: 'Sportif dans l\'âme, j\'adore la randonnée et les concerts. Je cherche une complice pour explorer la vie.',
    verified: true,
  },
  {
    email: 'chloe.dreamlove@example.com',
    name: 'Chloé',
    age: 24,
    gender: 'femme',
    seeking: 'tous',
    location: 'Marseille',
    bio: "Étudiante en art, fan de séries et de plage. Ouverte d'esprit et toujours partante pour une nouvelle aventure.",
    verified: false,
  },
  {
    email: 'nathan.dreamlove@example.com',
    name: 'Nathan',
    age: 31,
    gender: 'homme',
    seeking: 'femme',
    location: 'Bordeaux',
    bio: 'Ingénieur le jour, musicien le soir. Amateur de bon vin et de belles discussions.',
    verified: true,
  },
  {
    email: 'lea.dreamlove@example.com',
    name: 'Léa',
    age: 27,
    gender: 'femme',
    seeking: 'homme',
    location: 'Lille',
    bio: "Vétérinaire, amoureuse des animaux et de la nature. Je cherche quelqu'un de sincère pour construire quelque chose de beau.",
    verified: false,
  },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecte a MongoDB');

  for (const p of PROFILES) {
    const existing = await User.findOne({ email: p.email });
    if (existing) {
      console.log(`Deja present, ignore: ${p.name} (${p.email})`);
      continue;
    }

    console.log(`Recuperation de la photo pour ${p.name}...`);
    const buffer = await fetchImage('https://thispersondoesnotexist.com/random-person.jpeg');

    const hash = await bcrypt.hash('DreamLove2024!', 10);
    const user = new User({
      email: p.email,
      password: hash,
      name: p.name,
      birthdate: birthdateForAge(p.age),
      gender: p.gender,
      seeking: p.seeking,
      bio: p.bio,
      location: p.location,
      verified: p.verified,
      verificationStatus: p.verified ? 'approved' : 'none',
    });

    const publicId = `${user._id}_seed`;
    const result = await uploadBuffer(buffer, 'dreamlove/photos', publicId);
    user.photos.push({ url: result.secure_url, publicId: result.public_id });

    await user.save();
    console.log(`Cree: ${p.name} <${p.email}> - ${result.secure_url}`);
  }

  console.log('Termine.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
