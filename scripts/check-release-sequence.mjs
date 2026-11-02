import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function latestPublishedRunNumber(releases) {
  if (!Array.isArray(releases)) throw new TypeError('Release list must be an array.');

  let latest = 0;
  for (const release of releases) {
    if (release?.draft !== false) continue;

    const tag = typeof release.tag_name === 'string'
      ? release.tag_name
      : typeof release.tagName === 'string'
        ? release.tagName
        : '';
    const match = /^v1\\.0\\.(0|[1-9]\\d*)$/.exec(tag);
    if (!match) continue;

    const runNumber = Number(match[1]);
    if (!Number.isSafeInteger(runNumber)) {
      throw new Error(`Published release tag has an unsafe run number: ${tag}`);
    }
    latest = Math.max(latest, runNumber);
  }

  return latest;
}

export function shouldPublishRelease(candidateRunNumber, releases) {
  const candidate = typeof candidateRunNumber === 'number'
    ? candidateRunNumber
    : Number(candidateRunNumber);
  if (!Number.isSafeInteger(candidate) || candidate < 1) {
    throw new TypeError('Candidate run number must be a positive safe integer.');
  }
  return candidate > latestPublishedRunNumber(releases);
}

async function fetchPublishedReleases(env) {
  const repository = env.GITHUB_REPOSITORY;
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  const apiBase = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\\/$/, '');
  if (!repository || !/^[^/]+\\/[^/]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY must be set to owner/name.');
  }
  if (!token) throw new Error('A GitHub token is required to inspect published releases.');

  const [owner, name] = repository.split('/');
  const releases = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases?per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub releases API returned HTTP ${response.status}; refusing to publish without a sequence check.`);
    }

    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('GitHub releases API returned an unexpected response.');
    releases.push(...batch);
    if (batch.length < 100) return releases;
  }

  throw new Error('More than 10,000 releases found; refusing to publish without a complete sequence check.');
}

export async function main(env = process.env) {
  const candidate = env.CANDIDATE_RUN_NUMBER;
  const releases = await fetchPublishedReleases(env);
  const latest = latestPublishedRunNumber(releases);
  const ready = shouldPublishRelease(candidate, releases);
  const output = `release_ready=${ready ? 'true' : 'false'}\\nlatest_published_run_number=${latest}\\n`;

  if (!env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required to record the release-sequence decision.');
  appendFileSync(env.GITHUB_OUTPUT, output);

  const summary = ready
    ? `Release sequence check passed: candidate v1.0.${candidate} is newer than the latest published v1.0.${latest}.\\n`
    : `Release skipped: candidate v1.0.${candidate} is not newer than the latest published v1.0.${latest}; this prevents an older workflow run from moving the latest release backwards.\\n`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary.trim());
  return { ready, latest };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
