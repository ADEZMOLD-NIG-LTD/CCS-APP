/**
 * Publishes firestore.rules and checks firestore.indexes.json against the live database.
 *
 *   npm run deploy:firestore              # publish rules, then verify/create indexes
 *   npm run deploy:firestore -- --dry-run # report what would change, write nothing
 *
 * Why not `firebase deploy --only firestore`? The CLI calls serviceusage.services.get to
 * confirm the Firestore API is enabled, which service accounts usually may not do, so CI fails
 * with "Permission denied to get service [firestore.googleapis.com]" before it deploys anything.
 * Publishing through the Firebase Rules REST API needs only firebaserules permissions.
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT (JSON) or GOOGLE_APPLICATION_CREDENTIALS.
 * Target: FIREBASE_PROJECT_ID and FIREBASE_FIRESTORE_DATABASE_ID, falling back to
 * firebase.json's firestore.database.
 */

import { readFileSync } from 'node:fs';
import { applicationDefault, cert, type Credential } from 'firebase-admin/app';
import dotenv from 'dotenv';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const RULES_FILE = 'firestore.rules';
const INDEXES_FILE = 'firestore.indexes.json';

interface IndexField {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
}
interface IndexSpec {
  collectionGroup: string;
  queryScope?: string;
  fields: IndexField[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function target(): { projectId: string; databaseId: string } {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID to the target Firebase project.');
  let databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '';
  if (!databaseId) {
    const config = readJson<{ firestore?: { database?: string } | { database?: string }[] }>('firebase.json');
    const firestore = Array.isArray(config.firestore) ? config.firestore[0] : config.firestore;
    databaseId = firestore?.database || '(default)';
  }
  return { projectId, databaseId };
}

async function accessToken(): Promise<string> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credential: Credential = json ? cert(JSON.parse(json)) : applicationDefault();
  const token = await credential.getAccessToken();
  if (!token?.access_token) throw new Error('Could not obtain an access token for the service account.');
  return token.access_token;
}

async function call<T>(token: string, url: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text.slice(0, 400);
    const error = new Error(`${method} ${url.split('/v1/')[1] ?? url} -> ${response.status}: ${detail}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Same index if it covers the same collection, scope and ordered field list. */
function signature(index: IndexSpec): string {
  const fields = index.fields
    .filter(f => f.fieldPath !== '__name__')
    .map(f => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? ''}`)
    .join(',');
  return `${index.collectionGroup}|${index.queryScope ?? 'COLLECTION'}|${fields}`;
}

async function publishRules(token: string, projectId: string, databaseId: string): Promise<void> {
  const source = readFileSync(RULES_FILE, 'utf8');
  const releaseName = databaseId === '(default)'
    ? `projects/${projectId}/releases/cloud.firestore`
    : `projects/${projectId}/releases/cloud.firestore/${databaseId}`;

  let liveRulesetName: string | null = null;
  try {
    const release = await call<{ rulesetName: string }>(token, `https://firebaserules.googleapis.com/v1/${releaseName}`, 'GET');
    liveRulesetName = release.rulesetName;
    const live = await call<{ source: { files: { content: string }[] } }>(token, `https://firebaserules.googleapis.com/v1/${liveRulesetName}`, 'GET');
    if ((live.source.files ?? []).map(f => f.content).join('\n').trim() === source.trim()) {
      console.log('rules: already up to date');
      return;
    }
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    console.log('rules: no existing release for this database, creating one');
  }

  if (DRY_RUN) {
    console.log(`rules: would publish ${RULES_FILE} to ${releaseName}`);
    return;
  }

  const ruleset = await call<{ name: string }>(token, `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, 'POST', {
    source: { files: [{ name: RULES_FILE, content: source }] },
  });
  if (liveRulesetName) {
    await call(token, `https://firebaserules.googleapis.com/v1/${releaseName}`, 'PATCH', {
      release: { name: releaseName, rulesetName: ruleset.name },
    });
  } else {
    await call(token, `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, 'POST', {
      name: releaseName, rulesetName: ruleset.name,
    });
  }
  console.log(`rules: published ${ruleset.name.split('/').pop()} to ${releaseName}`);
}

async function syncIndexes(token: string, projectId: string, databaseId: string): Promise<boolean> {
  const wanted = readJson<{ indexes: IndexSpec[] }>(INDEXES_FILE).indexes ?? [];
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/collectionGroups`;
  // The listing identifies the collection group in the resource name, not as a field:
  // projects/{p}/databases/{db}/collectionGroups/{group}/indexes/{id}
  const live = await call<{ indexes?: { name: string; queryScope?: string; fields: IndexField[]; state?: string }[] }>(token, `${base}/-/indexes`, 'GET');
  const groupOf = (name: string) => name.split('/collectionGroups/')[1]?.split('/indexes/')[0] ?? '';
  const existing = new Set(
    (live.indexes ?? []).map(index => signature({ collectionGroup: groupOf(index.name), queryScope: index.queryScope, fields: index.fields }))
  );

  const missing = wanted.filter(index => !existing.has(signature(index)));
  if (missing.length === 0) {
    console.log(`indexes: ${wanted.length} declared, all present`);
    return true;
  }
  if (DRY_RUN) {
    missing.forEach(index => console.log(`indexes: would create ${signature(index)}`));
    return true;
  }

  let failed = false;
  for (const index of missing) {
    try {
      await call(token, `${base}/${index.collectionGroup}/indexes`, 'POST', {
        queryScope: index.queryScope ?? 'COLLECTION',
        fields: index.fields.filter(f => f.fieldPath !== '__name__'),
      });
      console.log(`indexes: created ${signature(index)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists/i.test(message)) {
        console.log(`indexes: ${signature(index)} already exists`);
        continue;
      }
      failed = true;
      console.error(`indexes: FAILED ${signature(index)}`);
      console.error(`  ${message}`);
    }
  }
  if (failed) {
    console.error('\nThe deploy service account cannot create indexes (needs Cloud Datastore Index Admin).');
    console.error('Apply them from a machine signed in with `firebase login`:');
    console.error('  firebase deploy --only firestore:indexes --project <project-id>');
  }
  return !failed;
}

async function main() {
  const { projectId, databaseId } = target();
  console.log(`${DRY_RUN ? '[dry run] ' : ''}project ${projectId}, database ${databaseId}`);
  const token = await accessToken();
  await publishRules(token, projectId, databaseId);
  const indexesOk = await syncIndexes(token, projectId, databaseId);
  if (!indexesOk) process.exit(1);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
