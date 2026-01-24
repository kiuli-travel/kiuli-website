/**
 * Notification Helper for V6 Pipeline
 */

const { create } = require('./payload');

/**
 * Create a notification
 * @param {Object} options
 * @param {string} options.type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} options.message - Notification message
 * @param {string} [options.jobId] - Related job ID
 * @param {string} [options.itineraryId] - Related itinerary ID
 */
async function createNotification({ type, message, jobId, itineraryId }) {
  try {
    const data = {
      type: type || 'info',
      message,
      read: false
    };

    if (jobId) {
      data.job = jobId;
    }

    if (itineraryId) {
      data.itinerary = itineraryId;
    }

    await create('notifications', data);
    console.log(`[Notification] Created: ${type} - ${message}`);

  } catch (error) {
    // Don't fail pipeline on notification errors
    console.error(`[Notification] Failed to create: ${error.message}`);
  }
}

/**
 * Notify job started
 */
async function notifyJobStarted(jobId, itineraryTitle) {
  await createNotification({
    type: 'info',
    message: `Started processing: ${itineraryTitle}`,
    jobId
  });
}

/**
 * Notify job completed
 */
async function notifyJobCompleted(jobId, itineraryId, itineraryTitle) {
  await createNotification({
    type: 'success',
    message: `Completed: ${itineraryTitle} is ready for review`,
    jobId,
    itineraryId
  });
}

/**
 * Notify job failed
 */
async function notifyJobFailed(jobId, error) {
  await createNotification({
    type: 'error',
    message: `Failed: ${error}`,
    jobId
  });
}

/**
 * Notify image processing complete
 */
async function notifyImagesProcessed(jobId, processed, failed) {
  const type = failed > 0 ? 'warning' : 'success';
  const message = failed > 0
    ? `Image processing complete: ${processed} processed, ${failed} failed`
    : `Image processing complete: ${processed} images processed`;

  await createNotification({
    type,
    message,
    jobId
  });
}

module.exports = {
  createNotification,
  notifyJobStarted,
  notifyJobCompleted,
  notifyJobFailed,
  notifyImagesProcessed
};
