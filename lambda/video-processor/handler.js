/**
 * Video Processor Lambda - V6 Video Support
 *
 * Converts HLS streams to MP4 and uploads to S3
 * Requires FFmpeg Lambda layer attached
 *
 * Invoked by image-processor for each pending video
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const payload = require('./shared/payload');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-north-1' });
const BUCKET = process.env.S3_BUCKET;
const IMGIX_DOMAIN = process.env.IMGIX_DOMAIN || 'kiuli.imgix.net';

/**
 * Generate imgix URL for video
 * Videos don't need image transformation params
 */
function getVideoImgixUrl(s3Key) {
  return `https://${IMGIX_DOMAIN}/${s3Key}`;
}

exports.handler = async (event) => {
  console.log('[VideoProcessor] Invoked');

  const { jobId, itineraryId, hlsUrl, videoContext, statusId } = event;

  if (!jobId || !itineraryId || !hlsUrl) {
    console.error('[VideoProcessor] Missing required parameters');
    return { success: false, error: 'Missing jobId, itineraryId, or hlsUrl' };
  }

  console.log(`[VideoProcessor] Job: ${jobId}, HLS: ${hlsUrl}`);

  const outputFile = `/tmp/video_${Date.now()}.mp4`;

  try {
    // 1. Update status to processing
    if (statusId) {
      await updateVideoStatus(statusId, 'processing', null, new Date().toISOString());
    }

    // 2. Dedup check using HLS URL as source key
    const sourceKey = hlsUrl;
    const existing = await payload.findMediaBySourceS3Key(sourceKey);

    if (existing) {
      console.log(`[VideoProcessor] Dedup hit: ${existing.id}`);

      // Update status to skipped
      if (statusId) {
        await updateVideoStatus(statusId, 'skipped', existing.id, null, new Date().toISOString());
      }

      // Note: usedInItineraries is readOnly, video will be linked via itinerary.videos
      // Link video to itinerary if not already linked
      const itineraryIdNum = typeof itineraryId === 'number' ? itineraryId : parseInt(itineraryId, 10);
      const itinerary = await payload.getItinerary(itineraryIdNum);
      const currentVideos = itinerary.videos || [];
      const videoIds = currentVideos.map(v => typeof v === 'object' ? v.id : v);

      if (!videoIds.includes(existing.id)) {
        const updateData = { videos: [...videoIds, existing.id] };
        if (videoContext === 'hero' && !itinerary.heroVideo) {
          updateData.heroVideo = existing.id;
        }
        await payload.updateItinerary(itineraryIdNum, updateData);
        console.log(`[VideoProcessor] Linked existing video ${existing.id} to itinerary ${itineraryIdNum}`);
      }

      return {
        success: true,
        mediaId: existing.id,
        skipped: true
      };
    }

    // 3. Download HLS and convert to MP4 using FFmpeg
    console.log(`[VideoProcessor] Converting HLS to MP4...`);

    // FFmpeg command: download HLS stream and convert to MP4
    // -i: input URL
    // -c copy: copy streams without re-encoding (fast)
    // -bsf:a aac_adtstoasc: fix audio for MP4 container
    // -y: overwrite output
    const ffmpegCmd = `/opt/bin/ffmpeg -i "${hlsUrl}" -c copy -bsf:a aac_adtstoasc "${outputFile}" -y 2>&1`;

    try {
      const output = execSync(ffmpegCmd, {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        encoding: 'utf8'
      });
      console.log(`[VideoProcessor] FFmpeg output: ${output.slice(-500)}`);
    } catch (ffmpegError) {
      // FFmpeg outputs to stderr even on success, check if file exists
      if (!fs.existsSync(outputFile)) {
        throw new Error(`FFmpeg failed: ${ffmpegError.message}`);
      }
      console.log('[VideoProcessor] FFmpeg completed (non-zero exit but file created)');
    }

    // 4. Read the converted file
    const videoBuffer = fs.readFileSync(outputFile);
    const fileSize = videoBuffer.length;
    console.log(`[VideoProcessor] Converted video: ${fileSize} bytes`);

    if (fileSize < 1000) {
      throw new Error('Converted video too small, likely failed');
    }

    // 5. Upload to S3
    const filename = `hero_video_${itineraryId}.mp4`;
    const s3Key = `media/originals/${itineraryId}/videos/${filename}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable'
    }));

    console.log(`[VideoProcessor] Uploaded to S3: ${s3Key}`);

    // 6. Create Media record via Payload API
    const imgixUrl = getVideoImgixUrl(s3Key);
    const itineraryIdNum = typeof itineraryId === 'number' ? itineraryId : parseInt(itineraryId, 10);

    const mediaData = {
      filename,
      alt: `Hero video for itinerary ${itineraryId}`,
      sourceS3Key: sourceKey, // HLS URL for dedup
      originalS3Key: s3Key,
      url: imgixUrl, // Use imgix URL for CDN delivery
      imgixUrl: imgixUrl, // Also set imgixUrl for frontend components
      mimeType: 'video/mp4',
      filesize: fileSize,
      mediaType: 'video',
      videoContext: videoContext || 'hero',
      processingStatus: 'complete',
      labelingStatus: 'skipped', // Videos don't need AI labeling
      // Note: usedInItineraries is readOnly in schema, managed via itinerary.videos relationship
    };

    const mediaResponse = await payload.create('media', mediaData);
    const mediaId = mediaResponse.doc?.id || mediaResponse.id;

    console.log(`[VideoProcessor] Created Media record: ${mediaId}`);

    // 7. Update ImageStatus record
    if (statusId) {
      await updateVideoStatus(statusId, 'complete', mediaId, null, new Date().toISOString());
    }

    // 8. Link video to itinerary's videos field and set as heroVideo if applicable
    console.log(`[VideoProcessor] Linking video ${mediaId} to itinerary ${itineraryId}`);

    // Get current itinerary to check existing videos
    const itinerary = await payload.getItinerary(itineraryIdNum);
    const currentVideos = itinerary.videos || [];
    const videoIds = currentVideos.map(v => typeof v === 'object' ? v.id : v);

    // Add video to videos array if not already present
    if (!videoIds.includes(mediaId)) {
      const updateData = {
        videos: [...videoIds, mediaId]
      };

      // If this is a hero video and no heroVideo is set, set it
      if (videoContext === 'hero' && !itinerary.heroVideo) {
        updateData.heroVideo = mediaId;
        console.log(`[VideoProcessor] Setting video ${mediaId} as heroVideo`);
      }

      await payload.updateItinerary(itineraryIdNum, updateData);
      console.log(`[VideoProcessor] Added video to itinerary videos array`);
    }

    // 9. Cleanup temp file
    fs.unlinkSync(outputFile);

    console.log(`[VideoProcessor] Complete`);

    return {
      success: true,
      mediaId,
      s3Key,
      fileSize,
      skipped: false
    };

  } catch (error) {
    console.error('[VideoProcessor] Failed:', error);

    // Cleanup on error
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }

    // Update status to failed
    if (statusId) {
      await updateVideoStatus(statusId, 'failed', null, null, new Date().toISOString(), error.message);
    }

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update video status in image-statuses collection
 */
async function updateVideoStatus(statusId, status, mediaId = null, startedAt = null, completedAt = null, error = null) {
  const updateData = { status };
  if (mediaId) updateData.mediaId = String(mediaId);
  if (startedAt) updateData.startedAt = startedAt;
  if (completedAt) updateData.completedAt = completedAt;
  if (error) updateData.error = error;

  await payload.update('image-statuses', statusId, updateData);
}
