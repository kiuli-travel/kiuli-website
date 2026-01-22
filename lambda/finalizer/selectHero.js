/**
 * Hero Image Selection Logic
 */

/**
 * Select the best hero image from media records
 *
 * Priority:
 * 1. Images explicitly marked as isHero
 * 2. High quality wildlife images
 * 3. High quality landscape images
 * 4. Any wildlife or landscape
 * 5. First available image
 */
function selectHeroImage(mediaRecords) {
  if (!mediaRecords || mediaRecords.length === 0) {
    return null;
  }

  // 1. Look for explicitly marked hero images
  const heroImages = mediaRecords.filter(m => m.isHero === true);
  if (heroImages.length > 0) {
    // Prefer high quality among hero images
    const highQualityHero = heroImages.find(m => m.quality === 'high');
    if (highQualityHero) return highQualityHero.id;
    return heroImages[0].id;
  }

  // 2. High quality wildlife
  const highQualityWildlife = mediaRecords.find(m =>
    m.quality === 'high' && m.imageType === 'wildlife'
  );
  if (highQualityWildlife) return highQualityWildlife.id;

  // 3. High quality landscape
  const highQualityLandscape = mediaRecords.find(m =>
    m.quality === 'high' && m.imageType === 'landscape'
  );
  if (highQualityLandscape) return highQualityLandscape.id;

  // 4. Any high quality image
  const anyHighQuality = mediaRecords.find(m => m.quality === 'high');
  if (anyHighQuality) return anyHighQuality.id;

  // 5. Any wildlife or landscape
  const wildlife = mediaRecords.find(m => m.imageType === 'wildlife');
  if (wildlife) return wildlife.id;

  const landscape = mediaRecords.find(m => m.imageType === 'landscape');
  if (landscape) return landscape.id;

  // 6. Fallback to first image
  return mediaRecords[0].id;
}

/**
 * Select the best hero video from media records
 *
 * Priority:
 * 1. Videos with videoContext 'hero'
 * 2. First available video
 */
function selectHeroVideo(mediaRecords) {
  if (!mediaRecords || mediaRecords.length === 0) {
    return null;
  }

  // Filter to only videos
  const videos = mediaRecords.filter(m => m.mediaType === 'video');

  if (videos.length === 0) {
    return null;
  }

  // 1. Look for videos marked as hero context
  const heroVideo = videos.find(v => v.videoContext === 'hero');
  if (heroVideo) return heroVideo.id;

  // 2. Fallback to first video
  return videos[0].id;
}

module.exports = { selectHeroImage, selectHeroVideo };
