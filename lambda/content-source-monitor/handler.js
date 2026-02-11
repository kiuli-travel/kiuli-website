/**
 * Content Source Monitor Lambda
 *
 * Checks registered external sources (RSS feeds, APIs) for new items
 * and creates content project candidates from relevant discoveries.
 */

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;
  console.log(`[content-source-monitor] Invoked, requestId=${requestId}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'not_implemented',
      job: 'content-source-monitor',
      requestId,
    }),
  };
};
