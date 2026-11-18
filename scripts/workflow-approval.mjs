import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function assertApprovedPlan(dir) {
  const task = fs.readFileSync(path.join(dir, 'TASK.md'), 'utf8');
  const status = task.match(/^\| Status \| (.+) \|$/m)?.[1];
  if (!['implementing', 'reviewing', 'fixing', 'qa', 'testing', 'auditing', 'finishing'].includes(status)) throw new Error(`Task is not approved for execution: ${status ?? 'unknown'}`);
  const file = path.join(dir, 'artifacts/shared-context.json');
  if (!fs.existsSync(file)) throw new Error('Missing approval record; obtain explicit plan approval before execution.');
  const shared = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plan = task.match(/## Plan\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ?? '';
  const hash = crypto.createHash('sha256').update(plan).digest('hex');
  if (!plan || /^Not approved yet\.?$/i.test(plan) || !shared.approvedPlanHash || !Number.isInteger(shared.planVersion) || shared.planVersion < 1 || shared.approvedPlanHash !== hash) throw new Error('Missing or changed approved plan; explicit approval is required again.');
}
