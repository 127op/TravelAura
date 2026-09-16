import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { loadEnv } from 'vite';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, terminate } from 'firebase/firestore';
import { catalogCounts, seedCatalog } from './lib/seedCatalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));

function options(args) {
  const result = { mode: 'development', dryRun: false, help: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--dry-run') result.dryRun = true;
    else if (argument === '--help' || argument === '-h') result.help = true;
    else if (argument === '--mode' && args[index + 1] && !args[index + 1].startsWith('-')) result.mode = args[++index];
    else throw new Error(`Unknown or incomplete option: ${argument}. Use npm run seed:firebase -- --help.`);
  }
  return result;
}

async function askCredentials() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Run this command in an interactive terminal to enter your admin email and hidden password. Do not put passwords in command arguments.');
  }
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (muted) callback();
      else process.stdout.write(chunk, encoding, callback);
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const controller = new AbortController();
  terminal.on('SIGINT', () => controller.abort());
  terminal.on('close', () => controller.abort());
  try {
    const email = (await terminal.question('Firebase admin email: ', { signal: controller.signal })).trim();
    process.stdout.write('Firebase admin password (hidden): ');
    muted = true;
    const password = await terminal.question('', { signal: controller.signal });
    if (!email || !password) throw new Error('Email and password are required.');
    return { email, password };
  } finally {
    muted = false;
    process.stdout.write('\n');
    terminal.close();
  }
}

async function main() {
  const { mode, dryRun, help } = options(process.argv.slice(2));
  if (help) {
    console.log(`Usage: npm run seed:firebase -- [--dry-run] [--mode development|production]

Reads the same VITE_FIREBASE_* values as Vite (.env, .env.local, mode files,
and shell overrides). Prompts for an existing Firebase admin email/password.
Creates only missing records from src/data/demo.js using their original IDs:
${catalogCounts.destinations} destinations and ${catalogCounts.packages} packages.
Existing documents are skipped without changes. --dry-run performs no writes.
No deployments, demo/localStorage changes, or credential files are created.`);
    return;
  }

  const env = loadEnv(mode, root, 'VITE_FIREBASE_');
  const keys = {
    apiKey: 'VITE_FIREBASE_API_KEY', authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID', storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID', appId: 'VITE_FIREBASE_APP_ID',
  };
  const missing = Object.values(keys).filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing Firebase configuration: ${missing.join(', ')}. Fill your existing .env file first.`);
  const config = Object.fromEntries(Object.entries(keys).map(([key, name]) => [key, env[name].trim()]));
  console.log(`Firebase project: ${config.projectId} (Vite mode: ${mode})`);
  console.log(`${dryRun ? 'Preview' : 'Seed'}: ${catalogCounts.destinations} destinations and ${catalogCounts.packages} packages. Existing IDs will be skipped.`);

  const credentials = await askCredentials();
  const app = initializeApp(config, 'travelaura-catalog-seed');
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  try {
    const { user } = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    credentials.password = '';
    const result = await seedCatalog(db, user.uid, { dryRun });
    for (const collection of ['destinations', 'packages']) {
      const counts = result[collection];
      console.log(`${collection}: ${dryRun ? `${counts.wouldCreate} would be created` : `${counts.created} created`}, ${counts.skipped} existing records skipped.`);
    }
    console.log(dryRun ? 'Preview complete. No Firestore documents were changed.' : 'Seed complete. Refresh the website to load the catalog.');
  } finally {
    credentials.password = '';
    await signOut(auth).catch(() => {});
    await terminate(db).catch(() => {});
    await deleteApp(app);
  }
}

main().catch(error => {
  if (error.name === 'AbortError') {
    console.error('Seed cancelled.');
    process.exitCode = 130;
  } else {
    const message = error.code?.startsWith('auth/')
      ? `Firebase sign-in failed (${error.code}). Use the email/password of an existing Firebase admin account.`
      : error.code === 'permission-denied'
        ? 'Firestore denied access. Check that your users/{uid} profile is active with role "admin" and your deployed rules permit admin catalog reads/writes.'
        : error.message;
    console.error(`Seed failed: ${message}`);
    process.exitCode = 1;
  }
});
