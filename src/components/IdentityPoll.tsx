import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle, Search, Check, Loader2, Sparkles } from 'lucide-react';
import type { Elephant, ElephantPost } from '../types/elephant';
import type { Language } from '../utils/translations';
import { UNIDENTIFIED_ELEPHANT, IDENTITY_VOTE_MIN_TOTAL, IDENTITY_VOTE_MIN_SHARE } from '../types/elephant';
import {
  subscribeToIdentityVotes,
  votePostIdentity,
  type IdentityTally,
} from '../firebase/postService';
import { formatBilingualElephantName } from '../utils/translations';

type Props = {
  post: ElephantPost;
  elephants: Elephant[];
  language: Language;
  uid?: string;
  onNotify?: (msg: string) => void;
};

export function IdentityPoll({ post, elephants, language, uid, onNotify }: Props) {
  const si = language === 'si';
  const [tally, setTally] = useState<IdentityTally>({ total: 0, byElephant: [], myVote: null });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);

  const postId = post.id || '';
  const isOpen =
    !!post.isUnidentified &&
    post.identityStatus !== 'admin_confirmed';

  useEffect(() => {
    if (!postId || !isOpen) return;
    return subscribeToIdentityVotes(postId, uid, setTally);
  }, [postId, uid, isOpen]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = elephants.filter((e) => e.id);
    if (term) {
      list = list.filter((e) => {
        const hay = [e.name, e.sinhalaName, ...(e.otherNames || [])].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(term);
      });
    }
    return list.slice(0, 12);
  }, [elephants, q]);

  if (!isOpen || !postId) return null;

  const suggested = post.communitySuggestion;
  const thresholdMet =
    tally.total >= IDENTITY_VOTE_MIN_TOTAL &&
    (tally.byElephant[0]?.percent || 0) >= IDENTITY_VOTE_MIN_SHARE;

  const handleVote = async (el: Elephant) => {
    if (!uid) {
      onNotify?.(si ? 'Vote කිරීමට පිවිසෙන්න' : 'Sign in to vote');
      return;
    }
    if (!el.id) return;
    setBusy(true);
    try {
      await votePostIdentity({
        postId,
        uid,
        elephantId: el.id,
        elephantName: el.name,
        elephantSinhalaName: el.sinhalaName,
      });
      setOpenPicker(false);
      setQ('');
      onNotify?.(si ? 'ඔබේ vote එක ලැබුණා!' : 'Your vote was recorded!');
    } catch (e: any) {
      onNotify?.(e?.message || (si ? 'Vote අසාර්ථකයි' : 'Vote failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
            {si ? 'මේ කවුද?' : 'Who is this?'}
          </p>
          <p className="text-[10px] text-amber-900/70 dark:text-amber-200/70 leading-snug">
            {si
              ? 'Database එකේ අලියෙකුට vote කරන්න. Community එකේ උදව්වෙන් හඳුනා ගනිමු — අවසාන තහවුරුව Admin සතුය.'
              : 'Vote for an elephant from the registry. Community help is not final until an admin confirms.'}
          </p>
        </div>
      </div>

      {(suggested || thresholdMet) && (
        <div className="flex items-center gap-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>
            {si ? 'Community හඳුනාගැනීම' : 'Community identified'} —{' '}
            {suggested?.elephantName || tally.byElephant[0]?.elephantName}
            {suggested
              ? ` (${suggested.voteCount}/${suggested.totalVotes} · ${suggested.percent}%)`
              : tally.byElephant[0]
                ? ` (${tally.byElephant[0].count}/${tally.total} · ${Math.round(tally.byElephant[0].percent * 100)}%)`
                : ''}
          </span>
        </div>
      )}

      {tally.total > 0 && (
        <div className="space-y-1.5">
          {tally.byElephant.slice(0, 5).map((row) => (
            <div key={row.elephantId} className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                <span className="truncate">{row.elephantName}</span>
                <span>
                  {row.count} · {Math.round(row.percent * 100)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all"
                  style={{ width: `${Math.max(4, Math.round(row.percent * 100))}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-zinc-500">
            {si
              ? `මුළු votes ${tally.total} · යෝජනාවට අවම ${IDENTITY_VOTE_MIN_TOTAL} (ඉහළම ${Math.round(IDENTITY_VOTE_MIN_SHARE * 100)}%)`
              : `${tally.total} votes · need ${IDENTITY_VOTE_MIN_TOTAL}+ with top ≥${Math.round(IDENTITY_VOTE_MIN_SHARE * 100)}%`}
          </p>
        </div>
      )}

      {tally.myVote && (
        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Check className="w-3 h-3" />
          {si ? 'ඔබේ vote' : 'Your vote'}: {tally.myVote.elephantName}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpenPicker((v) => !v)}
        className="w-full py-2 rounded-xl text-xs font-bold bg-[#062E22] text-white hover:bg-emerald-900 transition-colors"
      >
        {tally.myVote
          ? si
            ? 'Vote එක වෙනස් කරන්න'
            : 'Change vote'
          : si
            ? 'අලියෙකුට vote කරන්න'
            : 'Vote for an elephant'}
      </button>

      {openPicker && (
        <div className="space-y-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={si ? 'නම සොයන්න…' : 'Search name…'}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 smooth-scroll">
            {filtered.length === 0 ? (
              <p className="text-[10px] text-zinc-500 px-1 py-2">{si ? 'ප්‍රතිඵල නැත' : 'No matches'}</p>
            ) : (
              filtered.map((el) => {
                const label = formatBilingualElephantName(el, language);
                const selected = tally.myVote?.elephantId === el.id;
                return (
                  <button
                    key={el.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleVote(el)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                      selected
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                        : 'hover:bg-white dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                      {el.photos?.[0] ? (
                        <img src={el.photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <span className="truncate flex-1">{label}</span>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : selected ? <Check className="w-3.5 h-3.5" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function unidentifiedDisplayName(language: Language): string {
  return language === 'si' ? UNIDENTIFIED_ELEPHANT.nameSi : UNIDENTIFIED_ELEPHANT.nameEn;
}
