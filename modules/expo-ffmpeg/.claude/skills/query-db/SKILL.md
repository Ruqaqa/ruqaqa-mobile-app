---
name: query-db
description: Query MongoDB database in the ruqaqa Docker container. Use when the user asks to search, check, inspect, or debug data in the database.
argument-hint: [collection] [query description]
---

# Query MongoDB Database

Run MongoDB queries against the ruqaqa database via the Docker container.

## Connection

The MongoDB instance runs in Docker container `ruqaqa-website-mongo-1`. Always connect using:

```bash
docker exec ruqaqa-website-mongo-1 mongosh --quiet -u root -p "$(docker exec ruqaqa-website-mongo-1 printenv MONGO_INITDB_ROOT_PASSWORD)" --authenticationDatabase admin "ruqaqa-website" --eval "<QUERY>"
```

## How to Query

### Step 1: Identify the collection

If the user doesn't specify a collection, list them first:

```js
db.getCollectionNames()
```

Common collections:
- `financial-reconciliations` — Reconciliation records
- `transactions` — Financial transactions
- `employees` — Employee records
- `clients` — Client records
- `projects` — Project records
- `media` — Uploaded media files
- `finance-channels` — Finance channels (bank accounts, wallets)
- `pages` — CMS pages
- `posts` — Blog posts

### Step 2: Explore the schema if needed

To understand a collection's fields, sample a document:

```js
db['collection-name'].findOne()
```

### Step 3: Run the query

Always use projections to limit output — don't dump entire documents:

```js
db['collection-name'].find(
  { /* filter */ },
  { field1: 1, field2: 1 }  // projection
).limit(10).toArray()
```

### Step 4: Report results clearly

Present results in a readable format. If the user is debugging, explain what the data means in context.

## Query Patterns

### Find by ObjectId
```js
db['collection-name'].find({ _id: ObjectId('...') }).toArray()
```

### Find by relationship (populated field)
Relationship fields store ObjectIds:
```js
db['financial-reconciliations'].find({ fromEmployee: ObjectId('...') }).toArray()
```

### Text search (regex)
```js
db['employees'].find({ firstName: { $regex: 'باسل', $options: 'i' } }).toArray()
```

### Count documents
```js
db['collection-name'].countDocuments({ /* filter */ })
```

### Distinct values
```js
db['collection-name'].distinct('fieldName')
```

### Date range
```js
db['transactions'].find({
  createdAt: {
    $gte: ISODate('2026-01-01'),
    $lt: ISODate('2026-04-01')
  }
}).limit(10).toArray()
```

### Aggregation
```js
db['financial-reconciliations'].aggregate([
  { $match: { approvalStatus: 'Approved' } },
  { $group: { _id: '$currency', total: { $sum: '$totalAmount' } } }
]).toArray()
```

## Important Notes

- **Never modify data** (no `updateOne`, `deleteOne`, `insertOne`, etc.) unless the user explicitly asks
- **Always limit results** — use `.limit()` and projections to avoid dumping huge result sets
- **ObjectIds** — Wrap string IDs with `ObjectId('...')` when querying `_id` or relationship fields
- **Collection names use hyphens** — Always wrap in `db['collection-name']` syntax, not `db.collection`
- **Virtual fields** — Some fields like `name` on employees are virtual (computed from `firstName` + `lastName`). They exist in API responses but NOT in MongoDB. Query `firstName`/`lastName` instead
- The database name is `ruqaqa-website`
