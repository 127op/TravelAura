import { doc, runTransaction } from 'firebase/firestore';
import { destinations, packages } from '../../src/data/demo.js';

// Read the original catalog directly; do not duplicate or mutate the demo data.
const catalog = Object.entries({ destinations, packages }).flatMap(([collection, items]) =>
  items.map(item => ({ collection, data: { ...item, active: item.active ?? true } })),
);

const paths = catalog.map(({ collection, data }) => `${collection}/${data.id}`);
if (new Set(paths).size !== paths.length || catalog.some(({ data }) => !data.id || data.id.includes('/'))) {
  throw new Error('Demo catalog IDs must be nonempty, unique within each collection, and contain no slashes.');
}
if (packages.some(item => !destinations.some(destination => destination.id === item.destinationId))) {
  throw new Error('Every demo package must reference an existing demo destination.');
}

export const catalogCounts = { destinations: destinations.length, packages: packages.length };

/** Create missing catalog documents atomically, preserving every existing document. */
export async function seedCatalog(db, uid, { dryRun = false } = {}) {
  if (!uid) throw new Error('Sign in with an existing active Firebase admin account before seeding.');

  return runTransaction(db, async transaction => {
    const profile = await transaction.get(doc(db, 'users', uid));
    if (!profile.exists() || profile.data().role !== 'admin' || profile.data().active !== true) {
      throw new Error('Seeding requires users/{your UID} to have role: "admin" and active: true. Update your own profile in Firebase Console first.');
    }

    const references = catalog.map(({ collection, data }) => doc(db, collection, data.id));
    // Complete all reads before writes. Concurrent seeds/edits trigger a transaction retry.
    const snapshots = await Promise.all(references.map(reference => transaction.get(reference)));
    const result = { dryRun, destinations: { created: 0, skipped: 0, wouldCreate: 0 }, packages: { created: 0, skipped: 0, wouldCreate: 0 } };

    catalog.forEach(({ collection, data }, index) => {
      if (snapshots[index].exists()) {
        result[collection].skipped++;
      } else if (dryRun) {
        result[collection].wouldCreate++;
      } else {
        transaction.set(references[index], data);
        result[collection].created++;
      }
    });
    return result;
  });
}
