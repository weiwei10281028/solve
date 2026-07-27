const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8');
const requests = [];
const context = {
  AbortController,
  clearTimeout,
  cleanKey: (key) => key,
  console,
  setTimeout,
  fetch: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"blocks":[]}' }] }, finishReason: 'STOP' }]
      })
    };
  }
};
vm.runInNewContext(`${source}\nglobalThis.__callGemini = callGemini;`, context);

async function run() {
  const cfg = { key: 'test-key', model: 'gemini-test' };
  const messages = [{ role: 'user', content: 'test' }];

  await context.__callGemini(cfg, messages, 'system', {
    responseFormat: { text: { mimeType: 'text/html', schema: { type: 'object' } } }
  });
  if (requests[0].generationConfig.responseMimeType !== 'application/json') {
    throw new Error('JSON schema request must use Gemini-supported application/json MIME type');
  }

  await context.__callGemini(cfg, messages, 'system', { responseMimeType: 'application/json; charset=utf-8' });
  if (requests[1].generationConfig.responseMimeType !== 'application/json') {
    throw new Error('MIME parameters must be normalized before the Gemini request');
  }

  await context.__callGemini(cfg, messages, 'system', { responseMimeType: 'text/html' });
  if ('responseMimeType' in requests[2].generationConfig) {
    throw new Error('Unsupported Gemini MIME types must not be sent');
  }

  console.log('API_REQUEST_TESTS_OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
