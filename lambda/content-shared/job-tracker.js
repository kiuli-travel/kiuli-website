/**
 * Job tracking helpers for content system Lambdas.
 *
 * Updates ContentJobs records with progress, status, and timing information.
 */

const { update } = require('./payload-client');

async function startJob(jobId) {
  return update('content-jobs', jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });
}

async function updateProgress(jobId, progress) {
  return update('content-jobs', jobId, {
    progress,
  });
}

async function completeJob(jobId, result = {}) {
  return update('content-jobs', jobId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    progress: { ...result, completed: true },
  });
}

async function failJob(jobId, error) {
  return update('content-jobs', jobId, {
    status: 'failed',
    completedAt: new Date().toISOString(),
    error: typeof error === 'string' ? error : error.message,
  });
}

module.exports = { startJob, updateProgress, completeJob, failJob };
