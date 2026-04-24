import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const REPORT_ARTIFACTS = ['playwright-report', 'test-results'];

export default async function globalSetup() {
  for (const artifactPath of REPORT_ARTIFACTS) {
    rmSync(resolve(process.cwd(), artifactPath), {
      recursive: true,
      force: true,
    });
  }
}
