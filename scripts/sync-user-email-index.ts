import connectDB from '@/lib/db';
import User from '@/lib/models/User';

type DuplicateEmailRow = {
  _id: string;
  count: number;
  users: Array<{ _id: unknown; tenantId?: unknown; role?: string }>;
};

async function main() {
  await connectDB();

  const collection = User.collection;
  const indexes = await collection.indexes();
  const compoundIndex = indexes.find((index) => {
    const key = index.key as Record<string, number>;
    return key.tenantId === 1 && key.email === 1;
  });

  const duplicateEmails = await User.aggregate<DuplicateEmailRow>([
    { $match: { email: { $type: 'string' } } },
    {
      $group: {
        _id: { $toLower: '$email' },
        count: { $sum: 1 },
        users: { $push: { _id: '$_id', tenantId: '$tenantId', role: '$role' } },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

  if (duplicateEmails.length > 0) {
    console.error('Duplicate emails found. Resolve these before rebuilding the unique index:');
    for (const row of duplicateEmails) {
      console.error(`- ${row._id} (${row.count} users)`);
      for (const user of row.users) {
        console.error(`  - userId=${String(user._id)} tenantId=${String(user.tenantId ?? 'none')} role=${String(user.role ?? 'unknown')}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (compoundIndex?.name) {
    console.log(`Dropping old index: ${compoundIndex.name}`);
    await collection.dropIndex(compoundIndex.name);
  }

  console.log('Syncing user indexes...');
  await User.syncIndexes();
  console.log('User email index updated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to sync user email index:', error);
    process.exit(1);
  });