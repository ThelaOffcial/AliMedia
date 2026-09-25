import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './config';

const functions = getFunctions(app, 'us-central1');

export type StoryDraftKind = 'facts' | 'history' | 'story';
export type StoryDraftLanguage = 'en' | 'si';

export interface StoryDraftRequest {
  elephantId: string;
  kind: StoryDraftKind;
  language: StoryDraftLanguage;
  topic?: string;
}

export interface StoryDraftResponse {
  title: string;
  caption: string;
  imagePrompt: string;
  sources: Array<{ title: string; publisher?: string; url?: string }>;
}

export async function generateElephantPostDraft(
  request: StoryDraftRequest,
): Promise<StoryDraftResponse> {
  const callable = httpsCallable<StoryDraftRequest, StoryDraftResponse>(functions, 'generateElephantPostDraft');
  const response = await callable(request);
  return response.data;
}

export interface StoryImageRequest {
  elephantId: string;
  prompt: string;
}

export interface StoryImageResponse {
  base64: string;
  mimeType: string;
}

export async function generateElephantPostImage(
  request: StoryImageRequest,
): Promise<StoryImageResponse> {
  const callable = httpsCallable<StoryImageRequest, StoryImageResponse>(functions, 'generateElephantPostImage');
  const response = await callable(request);
  return response.data;
}
