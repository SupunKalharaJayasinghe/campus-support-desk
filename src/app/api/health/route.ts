import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB || 'unihub';
  const db = client.db(dbName);

  const collections = await db.collections();

  return NextResponse.json({
    ok: true,
    db: dbName,
    collections: collections.map((c) => c.collectionName),
  });
}
