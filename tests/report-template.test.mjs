import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const readTemplate = (path) => readFileSync(join(root, path), 'utf-8');

test('advanced analytics uses grouped navigation with shareable tab state hooks', () => {
  const template = readTemplate('templates/report-sections/02-advanced.html');
  const script = [
    'templates/report-scripts/01-core.html',
    'templates/report-scripts/00-report-controls.html',
    'templates/report-scripts/07-collab-debt-ai.html',
    'templates/report-scripts/10-runtime.html',
  ].map(readTemplate).join('\n');

  for (const group of ['health', 'quality', 'collaboration', 'ai']) {
    assert.match(template, new RegExp(`data-tab-group="${group}"`));
  }

  assert.match(script, /function activateAdvancedTab/);
  assert.match(script, /function updateReportHash/);
  assert.match(script, /advancedGroup/);
});

test('overview exposes report summary, global filters, and export controls', () => {
  const template = readTemplate('templates/report-sections/01-overview.html');
  const coreScript = [
    'templates/report-scripts/01-core.html',
    'templates/report-scripts/00-filter-state.html',
    'templates/report-scripts/00-advanced-derived.html',
    'templates/report-scripts/00-report-controls.html',
  ].map(readTemplate).join('\n');

  for (const id of [
    'health-summary',
    'health-summary-grade',
    'health-summary-highlights',
    'health-summary-risks',
    'global-author-filter',
    'global-directory-filter',
    'export-json',
    'export-csv',
  ]) {
    assert.match(template, new RegExp(`id="${id}"`));
  }

  assert.match(coreScript, /function renderHealthSummary/);
  assert.match(coreScript, /function buildFilteredStats/);
  assert.match(coreScript, /function exportReportJson/);
  assert.match(coreScript, /function exportReportCsv/);
});

test('single-repository only empty states provide next-step guidance', () => {
  const scripts = [
    'templates/report-scripts/01-core.html',
    'templates/report-scripts/00-report-controls.html',
    'templates/report-scripts/05-tables-team-stability.html',
    'templates/report-scripts/06-pressure-churn.html',
    'templates/report-scripts/07-collab-debt-ai.html',
    'templates/report-scripts/08-engineering.html',
    'templates/report-scripts/09-extensions.html',
  ].map(readTemplate).join('\n');

  assert.match(scripts, /renderSingleRepoOnlyEmptyState/);
  assert.match(scripts, /重新选择单个仓库/);
  assert.match(scripts, /--depth/);
});

test('AI usage analysis exposes author and directory ranking views', () => {
  const template = readTemplate('templates/report-sections/02-advanced.html');
  const script = readTemplate('templates/report-scripts/07-collab-debt-ai.html');
  const derivedScript = readTemplate('templates/report-scripts/00-advanced-derived.html');

  assert.match(template, /id="top-ai-dirs-body"/);
  assert.match(template, /id="author-ai-stats-body"/);
  assert.match(script, /function renderTopAIDirs/);
  assert.match(script, /function renderAuthorAIStats/);
  assert.match(script, /stats\.authorAIStats/);
  assert.match(derivedScript, /estimatedAILines/);
});
