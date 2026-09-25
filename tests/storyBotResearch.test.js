import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractResearchDraft,
  normalizeResearchUrls,
  normalizeYoutubeUrl,
  outputImage,
} from '../src/server/storyBotServer.js';

const validDraft = JSON.stringify({
  title: 'A forest elephant',
  caption: 'Elephants shape forest habitats and need room to roam.',
  imagePrompt: 'A respectful editorial illustration of a Sri Lankan elephant in a forest.',
});

test('parses Gemini REST steps and extracts Google grounding citations', () => {
  const interaction = {
    status: 'completed',
    steps: [
      { type: 'google_search_call', arguments: { queries: ['Sri Lankan elephant habitat'] } },
      {
        type: 'model_output',
        content: [{
          type: 'text',
          text: validDraft,
          annotations: [
            { type: 'url_citation', title: 'Wildlife Conservation Society', url: 'https://www.wcs.org/elephants' },
            { type: 'url_citation', title: 'Wildlife Conservation Society', url: 'https://www.wcs.org/elephants' },
            { type: 'url_citation', title: 'Unsafe source', url: 'javascript:alert(1)' },
          ],
        }],
      },
    ],
  };
  assert.deepEqual(extractResearchDraft(interaction), {
    title: 'A forest elephant',
    caption: 'Elephants shape forest habitats and need room to roam.',
    imagePrompt: 'A respectful editorial illustration of a Sri Lankan elephant in a forest.',
    sources: [{
      title: 'Wildlife Conservation Society',
      publisher: 'wcs.org',
      url: 'https://www.wcs.org/elephants',
    }],
  });
});

test('supports SDK-style output_text while still reading citations from steps', () => {
  const interaction = {
    output_text: validDraft,
    steps: [{ type: 'model_output', content: [{ type: 'text', text: validDraft, annotations: [{
      type: 'url_citation', title: 'Asian Elephant Specialist Group', url: 'https://www.iucn.org/example',
    }] }] }],
  };
  assert.equal(extractResearchDraft(interaction).sources[0].publisher, 'iucn.org');
});

test('rejects a completed response with no final text instead of returning an empty draft', () => {
  assert.throws(() => extractResearchDraft({ status: 'completed', steps: [{ type: 'google_search_call' }] }), {
    message: 'The AI returned no draft. Please try again.',
    status: 502,
  });
});

test('rejects incomplete JSON drafts', () => {
  assert.throws(() => extractResearchDraft({ output_text: '{"title":"Missing fields"}' }), {
    message: 'The AI draft was incomplete. Please try again.',
    status: 502,
  });
});

test('accepts and de-duplicates only public http(s) research websites', () => {
  assert.deepEqual(normalizeResearchUrls([
    'https://www.elephantconservation.org/field-notes',
    'https://www.elephantconservation.org/field-notes',
    'https://doi.org/10.0000/example',
  ]), [
    'https://www.elephantconservation.org/field-notes',
    'https://doi.org/10.0000/example',
  ]);
  assert.throws(() => normalizeResearchUrls(['file:///etc/passwd']), { status: 400 });
  assert.throws(() => normalizeResearchUrls(['https://www.youtube.com/watch?v=abcdefghijk']), { status: 400 });
});

test('normalizes public YouTube video URLs and rejects non-YouTube links', () => {
  assert.equal(normalizeYoutubeUrl('https://youtu.be/abcdefghijk?t=42'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(normalizeYoutubeUrl('https://www.youtube.com/shorts/abcdefghijk'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(normalizeYoutubeUrl(''), '');
  assert.throws(() => normalizeYoutubeUrl('https://example.com/video'), { status: 400 });
});

test('extracts generated image data from the raw Interactions API model-output step', () => {
  assert.deepEqual(outputImage({
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'image', data: 'aGVsbG8=', mime_type: 'image/png' }] }],
  }), { base64: 'aGVsbG8=', mimeType: 'image/png' });
});
