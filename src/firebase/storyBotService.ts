import { auth } from './config';

export type StoryDraftKind = 'facts' | 'history' | 'story';
export type StoryDraftLanguage = 'en' | 'si';

export interface StoryDraftRequest {
  elephantId: string;
  kind: StoryDraftKind;
  language: StoryDraftLanguage;
  topic?: string;
  researchUrls?: string[];
  youtubeUrl?: string;
}

export interface StoryDraftResponse {
  title: string;
  caption: string;
  imagePrompt: string;
  sources: Array<{ title: string; publisher?: string; url?: string }>;
}

export interface StoryImageRequest {
  elephantId: string;
  prompt: string;
}

export interface StoryImageResponse {
  url: string;
}

type StoryBotEndpoint = '/api/story-bot-draft' | '/api/story-bot-image';

async function postToStoryBot<TInput, TOutput>(endpoint: StoryBotEndpoint, body: TInput): Promise<TOutput> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Please sign in as an AliMedia admin.');
  const idToken = await user.getIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'Story Bot request failed.');
  return result as TOutput;
}

export function generateElephantPostDraft(request: StoryDraftRequest): Promise<StoryDraftResponse> {
  return postToStoryBot<StoryDraftRequest, StoryDraftResponse>('/api/story-bot-draft', request);
}

export function generateElephantPostImage(request: StoryImageRequest): Promise<StoryImageResponse> {
  return postToStoryBot<StoryImageRequest, StoryImageResponse>('/api/story-bot-image', request);
}
