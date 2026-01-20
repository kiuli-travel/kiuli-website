'use client';

import React from 'react';
import { FieldPairEditor } from './FieldPairEditor';

/**
 * Wrapper components for Stay segment fields.
 * Each receives a `path` prop from Payload (e.g., "days.0.segments.1.descriptionEditor")
 * and derives the actual field paths for the FieldPairEditor.
 */

interface FieldEditorProps {
  path: string; // Payload provides this automatically
}

/**
 * Helper to derive base path from UI field path.
 * Example: "days.0.segments.1.descriptionEditor" → "days.0.segments.1"
 */
function getBasePath(uiFieldPath: string): string {
  const parts = uiFieldPath.split('.');
  // Remove the last part (the UI field name)
  return parts.slice(0, -1).join('.');
}

// Accommodation Name Editor
export const AccommodationNameEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.accommodationNameItrvl`}
      enhancedPath={`${basePath}.accommodationNameEnhanced`}
      reviewedPath={`${basePath}.accommodationNameReviewed`}
      voiceConfig="segment-accommodation-name"
      label="Accommodation Name"
      isRichText={false}
      context={{ segmentType: 'stay' }}
    />
  );
};

// Description Editor
export const StayDescriptionEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.descriptionItrvl`}
      enhancedPath={`${basePath}.descriptionEnhanced`}
      reviewedPath={`${basePath}.descriptionReviewed`}
      voiceConfig="segment-description"
      label="Description"
      isRichText={true}
      context={{ segmentType: 'stay' }}
    />
  );
};

// Inclusions Editor
export const InclusionsEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.inclusionsItrvl`}
      enhancedPath={`${basePath}.inclusionsEnhanced`}
      reviewedPath={`${basePath}.inclusionsReviewed`}
      voiceConfig="investment-includes"
      label="Inclusions"
      isRichText={true}
      context={{ segmentType: 'stay' }}
    />
  );
};
