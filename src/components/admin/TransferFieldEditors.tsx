'use client';

import React from 'react';
import { FieldPairEditor } from './FieldPairEditor';

/**
 * Wrapper components for Transfer segment fields.
 * Each receives a `path` prop from Payload (e.g., "days.0.segments.1.titleEditor")
 * and derives the actual field paths for the FieldPairEditor.
 */

interface FieldEditorProps {
  path: string; // Payload provides this automatically
}

/**
 * Helper to derive base path from UI field path.
 * Example: "days.0.segments.1.titleEditor" → "days.0.segments.1"
 */
function getBasePath(uiFieldPath: string): string {
  const parts = uiFieldPath.split('.');
  // Remove the last part (the UI field name)
  return parts.slice(0, -1).join('.');
}

// Transfer Title Editor
export const TransferTitleEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.titleItrvl`}
      enhancedPath={`${basePath}.titleEnhanced`}
      reviewedPath={`${basePath}.titleReviewed`}
      voiceConfig="day-title"
      label="Transfer Title"
      isRichText={false}
      context={{ segmentType: 'transfer' }}
    />
  );
};

// Transfer Description Editor
export const TransferDescriptionEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.descriptionItrvl`}
      enhancedPath={`${basePath}.descriptionEnhanced`}
      reviewedPath={`${basePath}.descriptionReviewed`}
      voiceConfig="segment-description"
      label="Description"
      isRichText={true}
      context={{ segmentType: 'transfer' }}
    />
  );
};
