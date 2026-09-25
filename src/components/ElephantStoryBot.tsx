import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  BookOpenText,
  Bot,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  PawPrint,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import type { Elephant, ElephantPost } from '../types/elephant';
import { addElephantPost } from '../firebase/postService';
import { generateElephantPostDraft, generateElephantPostImage } from '../firebase/storyBotService';

interface Props {
  elephants: Elephant[];
  adminUser: User;
}

type DraftKind = 'facts' | 'history' | 'story';
type ContentLanguage = 'en' | 'si';

interface StoryDraft {
  title: string;
  caption: string;
  imagePrompt: string;
}

interface DraftSource {
  title: string;
  publisher?: string;
  url?: string;
}

const fieldClass =
  'w-full rounded-xl border border-parchment-300 bg-white px-3 py-2.5 text-sm text-ink-950 placeholder:text-ink-400 focus:border-pine-600 focus:outline-none focus:ring-2 focus:ring-pine-500/20';
const actionClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';

function profileImage(elephant?: Elephant | null): string {
  return elephant?.profilePhoto || elephant?.photos?.[0] || elephant?.cloudinaryPhotos?.[0]?.url || '';
}

function referencesForCaption(sources: DraftSource[]) {
  return sources
    .filter((source) => source.url && /^https?:\/\//i.test(source.url))
    .map((source) => `- ${source.title}${source.publisher ? ` — ${source.publisher}` : ''}: ${source.url}`);
}

export const ElephantStoryBot: React.FC<Props> = ({ elephants, adminUser }) => {
  const sortedElephants = useMemo(
    () => [...elephants].sort((a, b) => a.name.localeCompare(b.name)),
    [elephants],
  );
  const [elephantId, setElephantId] = useState('');
  const [kind, setKind] = useState<DraftKind>('facts');
  const [language, setLanguage] = useState<ContentLanguage>('en');
  const [topic, setTopic] = useState('');
  const [researchUrlsText, setResearchUrlsText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [draftSources, setDraftSources] = useState<Array<{ title: string; publisher?: string; url?: string }>>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageIsGenerated, setImageIsGenerated] = useState(false);
  const [storyOnly, setStoryOnly] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'image' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedElephant = sortedElephants.find((elephant) => elephant.id === elephantId) || null;
  const defaultImage = profileImage(selectedElephant);
  const activePreview = generatedImageUrl || imageUrl || defaultImage;
  const safeSources = useMemo(() => referencesForCaption(draftSources), [draftSources]);

  useEffect(() => {
    if (!elephantId && sortedElephants.length > 0) setElephantId(sortedElephants[0].id || '');
  }, [elephantId, sortedElephants]);

  useEffect(() => {
    if (!generatedImageUrl) {
      setImageUrl(defaultImage);
      setImageIsGenerated(false);
    }
  }, [defaultImage, generatedImageUrl]);

  const clearNotices = () => {
    setError('');
    setSuccess('');
  };

  const createDraft = async () => {
    if (!selectedElephant?.id) return;
    clearNotices();
    setBusy('draft');
    setGeneratedImageUrl('');
    try {
      const result = await generateElephantPostDraft({
        elephantId: selectedElephant.id,
        kind,
        language,
        topic: topic.trim(),
        researchUrls: researchUrlsText.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean).slice(0, 5),
        youtubeUrl: youtubeUrl.trim(),
      });
      setDraft({ title: result.title, caption: result.caption, imagePrompt: result.imagePrompt });
      setDraftSources(result.sources || []);
      setImageUrl(defaultImage);
      setImageIsGenerated(false);
      setSuccess('Draft ready. Check every fact and make any edits before publishing.');
    } catch (err: any) {
      setError(err?.message || 'Could not generate a draft. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const createImage = async () => {
    if (!selectedElephant?.id || !draft) return;
    clearNotices();
    setBusy('image');
    try {
      const result = await generateElephantPostImage({
        elephantId: selectedElephant.id,
        prompt: draft.imagePrompt,
      });
      setGeneratedImageUrl(result.url);
      setImageIsGenerated(true);
      setSuccess('AI illustration ready and uploaded. Review it before publishing.');
    } catch (err: any) {
      setError(err?.message || 'Could not generate an illustration.');
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!selectedElephant?.id || !draft || !adminUser.uid) return;
    clearNotices();
    if (!generatedImageUrl && !imageUrl) {
      setError('This feed needs an image. Generate an illustration or select an elephant with a profile photo.');
      return;
    }
    setBusy('publish');
    try {
      const hostedImageUrl = generatedImageUrl || imageUrl;
      if (!hostedImageUrl || !/^https:\/\//i.test(hostedImageUrl)) {
        throw new Error('The selected image is not available as a secure hosted image.');
      }

      const referenceBlock = safeSources.length ? `\n\nResearch sources:\n${safeSources.join('\n')}` : '';
      const imageDisclosure = imageIsGenerated ? '\n\nAI-generated illustration; this is not a documentary photograph.' : '';
      const caption = `${draft.title.trim()}\n\n${draft.caption.trim()}${imageDisclosure}${referenceBlock}`.trim();

      const post: Omit<ElephantPost, 'id' | 'createdAt' | 'updatedAt'> = {
        elephantId: selectedElephant.id,
        elephantName: selectedElephant.name,
        elephantSinhalaName: selectedElephant.sinhalaName || '',
        photoUrl: hostedImageUrl,
        caption,
        authorUid: adminUser.uid,
        authorName: 'AliMedia Story Bot',
        authorUsername: '@alimedia',
        authorPhotoURL: '',
        authorIsAliMedia: true,
        likesCount: 0,
        likedBy: [],
        isStory: true,
        isStoryOnly: storyOnly,
        aspectRatio: '3:4',
      };
      await addElephantPost(post);
      setSuccess('Published to the AliMedia community feed.');
      setDraft(null);
      setDraftSources([]);
      setGeneratedImageUrl('');
      setTopic('');
      setResearchUrlsText('');
      setYoutubeUrl('');
      setImageUrl(defaultImage);
      setImageIsGenerated(false);
    } catch (err: any) {
      setError(err?.message || 'Publishing failed. Your draft is still here so you can retry.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-fadeIn">
      <header>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-ink-950">
          <Bot className="h-5 w-5 text-pine-700" /> Elephant Story Bot
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Research elephants online, create an editable post with source links, then review it and choose Publish to add it to the AliMedia feed.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <section className="space-y-4 rounded-2xl border border-parchment-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-950">
            <PawPrint className="h-4 w-4 text-pine-700" /> Build a draft
          </div>
          {sortedElephants.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Add an elephant record to the registry before creating a story.
            </div>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Elephant</span>
                <select className={fieldClass} value={elephantId} onChange={(event) => {
                  setElephantId(event.target.value);
                  setDraft(null);
                  setDraftSources([]);
                  setGeneratedImageUrl('');
                  setImageIsGenerated(false);
                }}>
                  {sortedElephants.map((elephant) => (
                    <option key={elephant.id} value={elephant.id}>{elephant.name}{elephant.sinhalaName ? ` · ${elephant.sinhalaName}` : ''}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Draft type</span>
                  <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as DraftKind)}>
                    <option value="facts">Elephant facts</option>
                    <option value="history">History and heritage</option>
                    <option value="story">Short imaginative story</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Writing language</span>
                  <select className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value as ContentLanguage)}>
                    <option value="en">English</option>
                    <option value="si">Sinhala (සිංහල)</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Topic or angle (optional)</span>
                <input className={fieldClass} value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} placeholder="For example: this elephant’s Perahera role or conservation" />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Research websites (optional)</span>
                <textarea className={`${fieldClass} min-h-20 resize-y`} value={researchUrlsText} onChange={(event) => setResearchUrlsText(event.target.value)} maxLength={8000} placeholder="Paste up to 5 public elephant-related article or reference URLs; one per line" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Public YouTube video (optional)</span>
                <input className={fieldClass} type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} maxLength={1000} placeholder="https://www.youtube.com/watch?v=…" />
                <span className="block text-[10px] text-ink-500">Live Google Search requires a paid Gemini API tier; usage limits and charges may apply. Only public YouTube videos are supported. <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer" className="font-semibold underline">See current pricing</a>.</span>
              </label>

              <div className="rounded-xl border border-pine-100 bg-pine-50 p-3 text-xs leading-relaxed text-pine-950">
                <strong>Research safeguard:</strong> drafts search live web sources and include available citations. Check every factual claim and source before publishing; fiction is labeled as fiction.
              </div>

              <button
                className={`${actionClass} bg-pine-700 text-white hover:bg-pine-800`}
                onClick={createDraft}
                disabled={!selectedElephant?.id || busy !== null}
              >
                {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy === 'draft' ? 'Writing draft…' : draft ? 'Generate another draft' : 'Generate draft'}
              </button>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-parchment-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-950">
            <ImagePlus className="h-4 w-4 text-pine-700" /> Post image
          </div>
          {activePreview ? (
            <div className="overflow-hidden rounded-xl border border-parchment-200 bg-parchment-100">
              <img src={activePreview} alt={`${selectedElephant?.name || 'Elephant'} post preview`} className="max-h-72 w-full object-cover" />
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-parchment-300 bg-parchment-50 p-4 text-center text-xs text-ink-500">
              No image on this elephant profile yet. Generate an illustration after drafting.
            </div>
          )}
          <p className="text-xs leading-relaxed text-ink-500">
            {imageIsGenerated ? 'AI-generated image selected. The published caption will disclose that it is an illustration.' : 'Using the elephant’s existing profile photo when available; you can optionally create a new AI illustration.'}
          </p>
          <button
            className={`${actionClass} w-full border border-parchment-300 bg-white text-ink-800 hover:bg-parchment-50`}
            onClick={createImage}
            disabled={!draft || busy !== null}
          >
            {busy === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {busy === 'image' ? 'Creating illustration…' : 'Generate AI illustration (optional)'}
          </button>
        </section>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {draft && (
        <section className="space-y-4 rounded-2xl border border-parchment-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-ink-950"><BookOpenText className="h-4 w-4 text-pine-700" /> Review and edit</h2>
              <p className="mt-1 text-xs text-ink-500">This preview is not public. Publishing uses your signed-in admin account.</p>
            </div>
            {selectedElephant?.verified ? <span className="w-fit rounded-full bg-pine-50 px-2.5 py-1 text-[10px] font-bold text-pine-800">Verified registry record</span> : <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">Unverified registry record</span>}
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Post title</span>
            <input className={fieldClass} value={draft.title} maxLength={180} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Caption / story</span>
            <textarea className={`${fieldClass} min-h-52 resize-y leading-relaxed`} value={draft.caption} maxLength={12000} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} />
          </label>

          {draftSources.length > 0 ? (
            <div className="rounded-xl border border-parchment-200 bg-parchment-50 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-600">Research sources for this draft</p>
              <ul className="space-y-1.5">
                {draftSources.map((source, index) => (
                  <li key={`${source.title}-${index}`} className="text-xs text-ink-700">
                    {source.url && /^https?:\/\//i.test(source.url) ? (
                      <a className="inline-flex items-center gap-1 font-semibold text-pine-800 underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}<ExternalLink className="h-3 w-3" /></a>
                    ) : <span>{source.title}</span>}
                    {source.publisher && <span className="text-ink-500"> · {source.publisher}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-ink-500">Available links are included in the published caption so readers can check the source.</p>
            </div>
          ) : kind !== 'story' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              This registry record does not list source links. Please independently verify historical claims before publishing.
            </div>
          ) : null}

          {imageIsGenerated && (
            <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
              <strong>Disclosure:</strong> The caption will say the image is AI-generated and not a documentary photograph.
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-parchment-200 bg-parchment-50 p-3 text-xs text-ink-700">
            <input className="mt-0.5 accent-pine-700" type="checkbox" checked={storyOnly} onChange={(event) => setStoryOnly(event.target.checked)} />
            <span><strong>Story-only post</strong><br />If checked, AliMedia automatically removes it after 24 hours. Otherwise it stays in the community feed and is also shared to stories.</span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-relaxed text-ink-500">By publishing, you confirm you have reviewed the wording and image for accuracy and suitability.</p>
            <button
              className={`${actionClass} shrink-0 bg-ink-950 text-white hover:bg-ink-800`}
              onClick={publish}
              disabled={busy !== null || !draft.title.trim() || !draft.caption.trim() || (!activePreview && !imageUrl)}
            >
              {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy === 'publish' ? 'Publishing…' : 'Publish to AliMedia'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
