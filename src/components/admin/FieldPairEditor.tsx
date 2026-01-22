'use client';

import React, { useState, useCallback } from 'react';
import { useDocumentInfo, useField } from '@payloadcms/ui';

// Styles
const styles = {
  container: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '16px',
    marginBottom: '16px',
    backgroundColor: '#fafafa',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
    display: 'block',
    color: '#333',
  },
  section: {
    marginBottom: '12px',
  },
  sectionLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
    display: 'block',
  },
  originalText: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#555',
    maxHeight: '200px',
    overflow: 'auto',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    marginBottom: '12px',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  },
  copyButton: {
    backgroundColor: '#e3e3e3',
    color: '#333',
  },
  enhanceButton: {
    backgroundColor: '#486A6A',
    color: 'white',
  },
  enhanceButtonLoading: {
    backgroundColor: '#6a8a8a',
    cursor: 'not-allowed',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '14px',
    lineHeight: '1.5',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
  },
  error: {
    color: '#dc3545',
    fontSize: '13px',
    marginTop: '8px',
  },
  success: {
    color: '#28a745',
    fontSize: '13px',
    marginTop: '8px',
  },
};

// Helper to extract text from RichText
function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== 'object') return '';

  const root = (richText as { root?: unknown }).root;
  if (!root || typeof root !== 'object') return '';

  function extractText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';

    const n = node as { type?: string; text?: string; children?: unknown[] };

    if (n.type === 'text' && typeof n.text === 'string') {
      return n.text;
    }

    if (Array.isArray(n.children)) {
      return n.children.map(extractText).join(' ');
    }

    return '';
  }

  return extractText(root).trim();
}

interface FieldPairEditorProps {
  itrvlPath: string;
  enhancedPath: string;
  reviewedPath: string;
  voiceConfig: string;
  label: string;
  isRichText?: boolean;
  context?: Record<string, string>;
}

export const FieldPairEditor: React.FC<FieldPairEditorProps> = ({
  itrvlPath,
  enhancedPath,
  reviewedPath,
  voiceConfig,
  label,
  isRichText = false,
  context = {},
}) => {
  const { id: documentId } = useDocumentInfo();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get field values using useField - more reliable than useFormFields dispatch
  const { value: itrvlValue } = useField<unknown>({ path: itrvlPath });
  const { value: enhancedValue, setValue: setEnhancedValue } = useField<unknown>({ path: enhancedPath });
  const { value: reviewedValue, setValue: setReviewedValue } = useField<boolean>({ path: reviewedPath });

  // Helper to convert plain text to RichText format
  const toRichText = (text: string): object => ({
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: text.split('\n\n').filter(p => p.trim()).map(paragraph => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [{ type: 'text', text: paragraph.trim(), format: 0, version: 1 }],
        direction: 'ltr',
      })),
      direction: 'ltr',
    },
  });

  // Wrapper functions for setting values
  const setEnhanced = useCallback((value: string) => {
    if (isRichText) {
      setEnhancedValue(toRichText(value));
    } else {
      setEnhancedValue(value);
    }
  }, [isRichText, setEnhancedValue]);

  const setReviewed = useCallback((value: boolean) => {
    setReviewedValue(value);
  }, [setReviewedValue]);

  // Extract display text from iTrvl value
  const originalText = isRichText
    ? extractTextFromRichText(itrvlValue)
    : ((itrvlValue as string) || '');

  // Get enhanced text for display
  const enhancedText = isRichText
    ? extractTextFromRichText(enhancedValue)
    : ((enhancedValue as string) || '');

  // Handle copy button
  const handleCopy = useCallback(() => {
    setEnhanced(originalText);
    setMessage({ type: 'success', text: 'Copied to enhanced field' });
    setTimeout(() => setMessage(null), 3000);
  }, [originalText, setEnhanced]);

  // Handle AI enhance button
  const handleEnhance = useCallback(async () => {
    if (!documentId) {
      setMessage({ type: 'error', text: 'Document must be saved first' });
      return;
    }

    setIsEnhancing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itineraryId: documentId,
          fieldPath: itrvlPath.replace('Itrvl', ''), // Convert descriptionItrvl → description
          voiceConfig,
          context,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Enhancement failed');
      }

      // The API updates the document directly, but we also update the form
      const enhancedContent = isRichText
        ? extractTextFromRichText(data.enhanced)
        : data.enhanced;

      setEnhanced(enhancedContent);
      setMessage({ type: 'success', text: `Enhanced! (${data.tokensUsed} tokens)` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Enhancement failed',
      });
    } finally {
      setIsEnhancing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  }, [documentId, itrvlPath, voiceConfig, context, isRichText, setEnhanced]);

  // Handle enhanced text change
  const handleEnhancedChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEnhanced(e.target.value);
    },
    [setEnhanced]
  );

  // Handle reviewed checkbox
  const handleReviewedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReviewed(e.target.checked);
    },
    [setReviewed]
  );

  return (
    <div style={styles.container}>
      <label style={styles.label}>{label}</label>

      {/* Original (iTrvl) */}
      <div style={styles.section}>
        <span style={styles.sectionLabel}>Original (from iTrvl)</span>
        <div style={styles.originalText}>
          {originalText || <em style={{ color: '#999' }}>No original content</em>}
        </div>
      </div>

      {/* Action buttons */}
      <div style={styles.buttonRow}>
        <button
          type="button"
          style={{ ...styles.button, ...styles.copyButton }}
          onClick={handleCopy}
          disabled={!originalText}
        >
          Copy to Enhanced
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...styles.enhanceButton,
            ...(isEnhancing ? styles.enhanceButtonLoading : {}),
          }}
          onClick={handleEnhance}
          disabled={isEnhancing || !originalText}
        >
          {isEnhancing ? 'Enhancing...' : 'AI Enhance'}
        </button>
      </div>

      {/* Enhanced field */}
      <div style={styles.section}>
        <span style={styles.sectionLabel}>Enhanced (editable)</span>
        <textarea
          style={styles.textarea}
          value={enhancedText}
          onChange={handleEnhancedChange}
          placeholder="Enhanced content will appear here..."
        />
      </div>

      {/* Status message */}
      {message && (
        <div style={message.type === 'error' ? styles.error : styles.success}>{message.text}</div>
      )}

      {/* Reviewed checkbox */}
      <div style={styles.checkboxRow}>
        <input
          type="checkbox"
          id={`${reviewedPath}-checkbox`}
          style={styles.checkbox}
          checked={reviewedValue || false}
          onChange={handleReviewedChange}
        />
        <label htmlFor={`${reviewedPath}-checkbox`} style={styles.checkboxLabel}>
          Reviewed
        </label>
      </div>
    </div>
  );
};

export default FieldPairEditor;
