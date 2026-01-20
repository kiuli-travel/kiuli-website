'use client';

import React from 'react';
import { FieldPairEditor } from './FieldPairEditor';

/**
 * Wrapper components for FAQ item fields.
 * Each receives a `path` prop from Payload (e.g., "faqItems.0.questionEditor")
 * and derives the actual field paths for the FieldPairEditor.
 */

interface FieldEditorProps {
  path: string; // Payload provides this automatically
}

/**
 * Helper to derive base path from UI field path.
 * Example: "faqItems.0.questionEditor" → "faqItems.0"
 */
function getBasePath(uiFieldPath: string): string {
  const parts = uiFieldPath.split('.');
  // Remove the last part (the UI field name)
  return parts.slice(0, -1).join('.');
}

// FAQ Question Editor
export const FAQQuestionEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.questionItrvl`}
      enhancedPath={`${basePath}.questionEnhanced`}
      reviewedPath={`${basePath}.questionReviewed`}
      voiceConfig="faq-answer"
      label="Question"
      isRichText={false}
    />
  );
};

// FAQ Answer Editor
export const FAQAnswerEditor: React.FC<FieldEditorProps> = ({ path }) => {
  const basePath = getBasePath(path);

  return (
    <FieldPairEditor
      itrvlPath={`${basePath}.answerItrvl`}
      enhancedPath={`${basePath}.answerEnhanced`}
      reviewedPath={`${basePath}.answerReviewed`}
      voiceConfig="faq-answer"
      label="Answer"
      isRichText={true}
    />
  );
};
