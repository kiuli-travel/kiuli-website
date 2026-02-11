/**
 * Content Decompose Lambda
 *
 * Analyses an itinerary and decomposes it into content project candidates:
 * authority articles, destination pages, property pages, designer insights,
 * and itinerary enhancements.
 */

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;
  console.log(`[content-decompose] Invoked, requestId=${requestId}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'not_implemented',
      job: 'content-decompose',
      requestId,
    }),
  };
};
