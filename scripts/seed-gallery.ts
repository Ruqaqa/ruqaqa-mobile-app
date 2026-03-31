/**
 * Gallery test data seed script for Phase 5A development.
 *
 * Seeds MongoDB directly with gallery-tags, gallery-albums, and gallery items
 * that match the Payload CMS document shapes.
 *
 * Usage:
 *   pnpm seed:gallery          # seed data (idempotent — cleans first)
 *   pnpm seed:gallery:clean    # remove seeded data only
 *
 * Requires: MONGODB_URI env var (defaults to mongodb://localhost:27017/payload)
 */

import { MongoClient, ObjectId } from 'mongodb';

const SEED_MARKER = 'gallery-phase5a';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payload';

// Collection names as Payload stores them (slug-based)
const TAGS_COLLECTION = 'gallery-tags';
const ALBUMS_COLLECTION = 'gallery-albums';
const GALLERY_COLLECTION = 'gallery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function oid(): ObjectId {
  return new ObjectId();
}

function now(): string {
  return new Date().toISOString();
}

/** Payload stores localized fields as { en: ..., ar: ... } */
function localized(en: string, ar: string) {
  return { en, ar };
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const TAG_DEFS = [
  { en: 'site-visit', ar: 'زيارة ميدانية' },
  { en: 'warehouse', ar: 'مستودع' },
  { en: 'office', ar: 'مكتب' },
  { en: 'event', ar: 'فعالية' },
  { en: 'marketing', ar: 'تسويق' },
  { en: 'maintenance', ar: 'صيانة' },
  { en: 'delivery', ar: 'توصيل' },
  { en: 'inspection', ar: 'فحص' },
];

interface AlbumDef {
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  isDefault: boolean;
  itemCount: number;
}

const ALBUM_DEFS: AlbumDef[] = [
  {
    titleEn: 'Default Album',
    titleAr: 'الألبوم الافتراضي',
    descEn: 'System default album for uncategorized items',
    descAr: 'الألبوم الافتراضي للعناصر غير المصنفة',
    isDefault: true,
    itemCount: 8,
  },
  {
    titleEn: 'Office Events',
    titleAr: 'فعاليات المكتب',
    descEn: 'Photos from office events and gatherings',
    descAr: 'صور من فعاليات وتجمعات المكتب',
    isDefault: false,
    itemCount: 5,
  },
  {
    titleEn: 'Product Photos',
    titleAr: 'صور المنتجات',
    descEn: 'Product photography for catalog and marketing',
    descAr: 'تصوير المنتجات للكتالوج والتسويق',
    isDefault: false,
    itemCount: 4,
  },
  {
    titleEn: 'Branding',
    titleAr: 'الهوية البصرية',
    descEn: 'Brand assets and identity materials',
    descAr: 'أصول العلامة التجارية ومواد الهوية',
    isDefault: false,
    itemCount: 2,
  },
  {
    titleEn: 'Social Media',
    titleAr: 'وسائل التواصل',
    descEn: 'Content prepared for social media channels',
    descAr: 'محتوى معد لقنوات التواصل الاجتماعي',
    isDefault: false,
    itemCount: 1,
  },
  {
    titleEn: 'Empty Album',
    titleAr: 'ألبوم فارغ',
    descEn: 'An empty album for testing',
    descAr: 'ألبوم فارغ للاختبار',
    isDefault: false,
    itemCount: 0,
  },
];

// Mime types to cycle through for variety
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime'];

// ---------------------------------------------------------------------------
// Build documents
// ---------------------------------------------------------------------------

function buildTags() {
  const timestamp = now();
  return TAG_DEFS.map((t) => ({
    _id: oid(),
    name: localized(t.en, t.ar),
    _seedMarker: SEED_MARKER,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function buildGalleryItems(tagIds: ObjectId[]) {
  const timestamp = now();
  const items: Record<string, unknown>[] = [];
  let itemIndex = 0;

  // Total 20 items distributed: 8 + 5 + 4 + 2 + 1 + 0 = 20
  const totalItems = ALBUM_DEFS.reduce((sum, a) => sum + a.itemCount, 0);

  for (let i = 0; i < totalItems; i++) {
    // Every 4th item is a video
    const isVideo = i % 4 === 3;
    const mimeType = isVideo
      ? VIDEO_MIMES[i % VIDEO_MIMES.length]
      : IMAGE_MIMES[i % IMAGE_MIMES.length];
    const ext = isVideo ? 'mp4' : mimeType === 'image/png' ? 'png' : 'jpg';
    const filename = `seed-gallery-${String(i + 1).padStart(2, '0')}.${ext}`;
    const thumbnailFilename = `seed-gallery-${String(i + 1).padStart(2, '0')}-thumb.jpg`;

    // Assign 1-3 random tags per item
    const tagCount = 1 + (i % 3); // cycles 1, 2, 3
    const assignedTags = tagIds.slice(i % tagIds.length, (i % tagIds.length) + tagCount);
    // Wrap around if we went past the end
    const finalTags =
      assignedTags.length < tagCount
        ? [...assignedTags, ...tagIds.slice(0, tagCount - assignedTags.length)]
        : assignedTags;

    items.push({
      _id: oid(),
      filename,
      mimeType,
      // Payload upload collections store filesize and dimensions
      filesize: isVideo ? 5_000_000 + i * 100_000 : 200_000 + i * 50_000,
      width: isVideo ? 1920 : 1200 + (i % 3) * 200,
      height: isVideo ? 1080 : 800 + (i % 3) * 200,
      thumbnailFilename,
      noWatermarkNeeded: i % 5 === 0, // every 5th item needs no watermark
      tags: finalTags,
      // Some items have watermark overrides to test the group field
      watermarkOverrides:
        i % 7 === 0
          ? { x: 50, y: 50, width: 30, opacity: 40 }
          : {},
      _seedMarker: SEED_MARKER,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    itemIndex++;
  }

  return items;
}

function buildAlbums(galleryItemIds: ObjectId[]) {
  const timestamp = now();
  let cursor = 0;

  return ALBUM_DEFS.map((albumDef) => {
    const albumItemIds = galleryItemIds.slice(cursor, cursor + albumDef.itemCount);
    cursor += albumDef.itemCount;

    return {
      _id: oid(),
      title: localized(albumDef.titleEn, albumDef.titleAr),
      description: localized(albumDef.descEn, albumDef.descAr),
      isDefault: albumDef.isDefault,
      items: albumItemIds,
      _seedMarker: SEED_MARKER,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

// ---------------------------------------------------------------------------
// Seed & Clean
// ---------------------------------------------------------------------------

async function clean(client: MongoClient) {
  const db = client.db();
  const filter = { _seedMarker: SEED_MARKER };

  const tagResult = await db.collection(TAGS_COLLECTION).deleteMany(filter);
  console.log(`  Removed ${tagResult.deletedCount} tags`);

  const galleryResult = await db.collection(GALLERY_COLLECTION).deleteMany(filter);
  console.log(`  Removed ${galleryResult.deletedCount} gallery items`);

  const albumResult = await db.collection(ALBUMS_COLLECTION).deleteMany(filter);
  console.log(`  Removed ${albumResult.deletedCount} albums`);
}

async function seed(client: MongoClient) {
  const db = client.db();

  // Step 1: Tags
  console.log('Seeding 8 tags...');
  const tags = buildTags();
  await db.collection(TAGS_COLLECTION).insertMany(tags);
  console.log('  Done.');

  // Step 2: Gallery items (need tag IDs for relationship)
  console.log('Seeding 20 gallery items...');
  const tagIds = tags.map((t) => t._id);
  const galleryItems = buildGalleryItems(tagIds);
  await db.collection(GALLERY_COLLECTION).insertMany(galleryItems);
  console.log('  Done.');

  // Step 3: Albums (need gallery item IDs for relationship)
  console.log('Seeding 6 albums...');
  const galleryItemIds = galleryItems.map((g) => g._id);
  const albums = buildAlbums(galleryItemIds);
  await db.collection(ALBUMS_COLLECTION).insertMany(albums);
  console.log('  Done.');

  // Summary
  console.log('\nSeed summary:');
  console.log(`  Tags:          ${tags.length}`);
  console.log(`  Gallery items: ${galleryItems.length}`);
  console.log(`  Albums:        ${albums.length}`);
  albums.forEach((a) => {
    const title = a.title.en;
    const count = Array.isArray(a.items) ? a.items.length : 0;
    console.log(`    - "${title}" (${count} items${a.isDefault ? ', default' : ''})`);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isClean = process.argv.includes('--clean');

  console.log(`Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//<credentials>@')}`);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected.\n');

    if (isClean) {
      console.log('Cleaning seeded gallery data...');
      await clean(client);
      console.log('\nClean complete.');
    } else {
      // Idempotent: clean first, then seed
      console.log('Cleaning previous seed data (if any)...');
      await clean(client);
      console.log('');
      await seed(client);
      console.log('\nSeed complete.');
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().then(() => process.exit(0));
