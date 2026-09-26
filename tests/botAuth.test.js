const test = require('node:test');
const assert = require('node:assert/strict');

const { getSignedMessage, isFreshRequestTimestamp } = require('../netlify/functions/utils/bot-auth');

test('signed bot requests include timestamp and request id in the HMAC input', () => {
  const event = {
    headers: {
      'x-sns-timestamp': '1700000000000',
      'x-sns-request-id': 'request-123',
    },
  };

  assert.equal(getSignedMessage(event, '{"incidentId":"INC-1"}'), '1700000000000.request-123.{"incidentId":"INC-1"}');
});

test('replay timestamps outside the five-minute window are rejected', () => {
  const now = 1700000000000;
  assert.equal(isFreshRequestTimestamp(String(now - 5 * 60 * 1000), now), true);
  assert.equal(isFreshRequestTimestamp(String(now - (5 * 60 * 1000 + 1)), now), false);
  assert.equal(isFreshRequestTimestamp('not-a-timestamp', now), false);
});