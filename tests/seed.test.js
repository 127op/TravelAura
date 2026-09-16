import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { destinations, packages } from '../src/data/demo.js';
import { seedCatalog } from '../scripts/lib/seedCatalog.js';

let env, adminDb;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-travelaura', firestore: {
    host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8'),
  } });
  adminDb = env.authenticatedContext('seed-admin').firestore();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users', 'seed-admin'), { role: 'admin', active: true }));
});
after(async () => { await env?.cleanup(); });

test('seeds the full original catalog and makes it readable by public UI queries', async () => {
  const original = JSON.stringify({ destinations, packages });
  const result = await seedCatalog(adminDb, 'seed-admin');
  assert.equal(result.destinations.created, 8);
  assert.equal(result.packages.created, 10);
  for (const [name, items] of Object.entries({ destinations, packages })) {
    for (const item of items) {
      const snapshot = await getDoc(doc(adminDb, name, item.id));
      assert.equal(snapshot.id, item.id);
      assert.deepEqual(snapshot.data(), { ...item, active: item.active ?? true });
    }
    const publicDb = env.unauthenticatedContext().firestore();
    assert.equal((await getDocs(query(collection(publicDb, name), where('active', '==', true)))).size, items.length);
  }
  assert.equal(JSON.stringify({ destinations, packages }), original, 'demo exports remain unchanged');
  assert.equal((await getDocs(collection(adminDb, 'users'))).size, 1);
  for (const name of ['bookings', 'reviews', 'coupons', 'contacts']) assert.equal((await getDocs(collection(adminDb, name))).size, 0);
});

test('reruns skip existing IDs and preserve later admin edits and unpublished records', async () => {
  await seedCatalog(adminDb, 'seed-admin');
  const packageRef = doc(adminDb, 'packages', packages[0].id);
  const destinationRef = doc(adminDb, 'destinations', destinations[0].id);
  await updateDoc(packageRef, { name: 'Admin-edited package', pricePerAdult: 123, active: false });
  await updateDoc(destinationRef, { description: 'Admin-edited description', active: false });
  const savedPackage = (await getDoc(packageRef)).data();
  const savedDestination = (await getDoc(destinationRef)).data();
  const result = await seedCatalog(adminDb, 'seed-admin');
  assert.deepEqual(result, { dryRun: false, destinations: { created: 0, skipped: 8, wouldCreate: 0 }, packages: { created: 0, skipped: 10, wouldCreate: 0 } });
  assert.deepEqual((await getDoc(packageRef)).data(), savedPackage);
  assert.deepEqual((await getDoc(destinationRef)).data(), savedDestination);
  assert.equal((await getDocs(collection(adminDb, 'destinations'))).size, 8);
  assert.equal((await getDocs(collection(adminDb, 'packages'))).size, 10);
});

test('dry run reports missing/existing documents and writes nothing', async () => {
  await setDoc(doc(adminDb, 'destinations', 'manali'), { name: 'Existing Manali', active: true });
  const result = await seedCatalog(adminDb, 'seed-admin', { dryRun: true });
  assert.equal(result.destinations.wouldCreate, 7);
  assert.equal(result.destinations.skipped, 1);
  assert.equal(result.packages.wouldCreate, 10);
  assert.equal(result.destinations.created + result.packages.created, 0);
  assert.equal((await getDocs(collection(adminDb, 'destinations'))).size, 1);
  assert.equal((await getDocs(collection(adminDb, 'packages'))).size, 0);
});

test('concurrent seeds create one copy of every record', async () => {
  const secondDb = env.authenticatedContext('seed-admin').firestore();
  const results = await Promise.all([seedCatalog(adminDb, 'seed-admin'), seedCatalog(secondDb, 'seed-admin')]);
  assert.equal(results.reduce((sum, result) => sum + result.destinations.created, 0), 8);
  assert.equal(results.reduce((sum, result) => sum + result.packages.created, 0), 10);
  assert.equal((await getDocs(collection(adminDb, 'destinations'))).size, 8);
  assert.equal((await getDocs(collection(adminDb, 'packages'))).size, 10);
});

test('ordinary users, missing profiles and inactive admins cannot seed', async () => {
  for (const [uid, profile] of [['normal', { role: 'user', active: true }], ['inactive', { role: 'admin', active: false }], ['missing', null]]) {
    if (profile) await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users', uid), profile));
    await assert.rejects(seedCatalog(env.authenticatedContext(uid).firestore(), uid), /Seeding requires/);
  }
  await assert.rejects(seedCatalog(env.unauthenticatedContext().firestore(), null), /Sign in/);
  assert.equal((await getDocs(collection(adminDb, 'destinations'))).size, 0);
  assert.equal((await getDocs(collection(adminDb, 'packages'))).size, 0);
});
