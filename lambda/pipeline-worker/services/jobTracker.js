class JobTracker {
  constructor(jobId) {
    this.jobId = jobId;
    this.startTime = Date.now();
    this.phaseStartTime = null;
    this.timing = {};
    this.currentPhase = null;
  }

  async startPhase(phase) {
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();
    console.log(`[JobTracker] Starting phase: ${phase}`);
    await this.updateJob({
      currentPhase: phase,
      status: 'processing'
    });
  }

  async completePhase(phase, extra = {}) {
    const duration = (Date.now() - this.phaseStartTime) / 1000;
    this.timing[phase] = duration;
    console.log(`[JobTracker] Completed phase: ${phase} in ${duration}s`);
    await this.updateJob({
      ...extra
    });
  }

  async updateProgress(processed, total, failed = 0) {
    const progress = Math.round((processed / total) * 100);
    console.log(`[JobTracker] Progress: ${processed}/${total} (${progress}%)`);
    await this.updateJob({
      progress,
      processedImages: processed,
      totalImages: total,
      failedImages: failed
    });
  }

  async complete(payloadId) {
    const duration = (Date.now() - this.startTime) / 1000;
    console.log(`[JobTracker] Job completed in ${duration}s`);
    await this.updateJob({
      status: 'completed',
      progress: 100,
      currentPhase: 'complete',
      payloadId,
      completedAt: new Date().toISOString(),
      duration,
      timing: this.timing
    });
  }

  async fail(error, phase) {
    console.error(`[JobTracker] Job failed at ${phase}: ${error}`);
    await this.updateJob({
      status: 'failed',
      errorMessage: error,
      errorPhase: phase || this.currentPhase,
      failedAt: new Date().toISOString()
    });
  }

  async updateJob(data) {
    try {
      const response = await fetch(
        `${process.env.PAYLOAD_API_URL}/api/itinerary-jobs/${this.jobId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}`
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        console.error('[JobTracker] Failed to update job:', await response.text());
      }
    } catch (err) {
      console.error('[JobTracker] Error updating job:', err.message);
    }
  }
}

module.exports = { JobTracker };
