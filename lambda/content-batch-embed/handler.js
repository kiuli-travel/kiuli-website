/**
 * Content Batch Embed Lambda
 *
 * Processes content in batches: chunks text, generates embeddings via
 * OpenAI text-embedding-3-large, and stores vectors for similarity search.
 */

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;
  console.log(`[content-batch-embed] Invoked, requestId=${requestId}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'not_implemented',
      job: 'content-batch-embed',
      requestId,
    }),
  };
};
