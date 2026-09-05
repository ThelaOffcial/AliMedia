import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { GalleryPost } from '../types';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Camera, 
  MapPin, 
  Filter, 
  Sparkles, 
  X,
  Send,
  User,
  Plus
} from 'lucide-react';

interface GalleryViewProps {
  onOpenSubmitModal: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ onOpenSubmitModal }) => {
  const { lang, t } = useLanguage();
  const { posts, likePost, comments, addComment, elephants, setSelectedElephant } = useRegistry();
  
  const [selectedElephantFilter, setSelectedElephantFilter] = useState<string>('all');
  const [activeStoryPost, setActiveStoryPost] = useState<GalleryPost | null>(null);
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commenterName, setCommenterName] = useState<string>('');

  const stories = posts.filter(p => p.isStory);
  
  const filteredPosts = posts.filter(p => {
    if (selectedElephantFilter === 'all') return true;
    return p.elephantId === selectedElephantFilter || p.elephantName?.toLowerCase() === selectedElephantFilter.toLowerCase();
  });

  const handleCommentSubmit = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    addComment(postId, newCommentText.trim(), commenterName.trim() || 'Perahera Admirer');
    setNewCommentText('');
  };

  const currentPostComments = commentingPostId 
    ? comments.filter(c => c.postId === commentingPostId)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Header & Submit Button */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold uppercase mb-3.5 shadow-xs">
            <Camera className="w-4 h-4 text-amber-700" />
            <span>ප්‍රජා ඡායාරූප සහ කථා • Community Gallery & Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display tracking-tight mb-2">
            ලක්බිමේ පූජනීය ඇත් රජුන්ගේ ඡායාරූප
          </h2>
          <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-medium">
            සැදැහැවත් ජනතාව සහ සංස්කෘතික ගවේෂකයන් විසින් ලබාගත් උසස් තත්ත්වයේ ඓතිහාසික හා පෙරහැර මංගල්‍ය ඡායාරූප එකතුව.
          </p>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('submitPhoto')}</span>
        </button>
      </div>

      {/* Stories Carousel */}
      {stories.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>විශේෂිත සංස්කෘතික කථා (Ceremonial Stories)</span>
          </div>
          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
            {stories.map(story => (
              <button
                key={story.id}
                onClick={() => setActiveStoryPost(story)}
                className="flex flex-col items-center gap-2 group shrink-0 focus:outline-none cursor-pointer"
              >
                <div className="w-20 h-20 rounded-2xl p-0.5 bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-700 group-hover:scale-105 transition-transform shadow-xs">
                  <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-100 border border-white">
                    <img src={story.photoUrl} alt={story.elephantName} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-amber-800 max-w-[80px] truncate text-center">
                  {story.elephantName && !/^unknown\s+elephant$/i.test(String(story.elephantName).trim())
                    ? story.elephantName
                    : story.authorName || 'Post'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter by Elephant */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Filter className="w-3.5 h-3.5 text-amber-700" /> ඇතුන් අනුව තේරීම:
        </span>
        <button
          onClick={() => setSelectedElephantFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            selectedElephantFilter === 'all'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          සියලුම ඇතුන් (All)
        </button>
        {elephants.map(e => (
          <button
            key={e.id}
            onClick={() => setSelectedElephantFilter(e.name)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedElephantFilter === e.name
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {e.sinhalaName ? `${e.sinhalaName} (${e.name})` : e.name}
          </button>
        ))}
      </div>

      {/* Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map(post => {
          const isLiked = post.likedBy?.includes('browser_user');
          return (
            <div
              key={post.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all"
            >
              <div>
                {/* Author Info Bar */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 font-bold text-xs">
                      {post.authorPhotoURL ? (
                        <img src={post.authorPhotoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-amber-700" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{post.authorName}</div>
                      <div className="text-[11px] text-slate-500">{post.authorUsername}</div>
                    </div>
                  </div>

                  {post.elephantName && !/^unknown\s+elephant$/i.test(post.elephantName.trim()) && (
                    <button
                      onClick={() => {
                        const el = elephants.find(e => e.name.toLowerCase() === post.elephantName.toLowerCase() || e.id === post.elephantId);
                        if (el) setSelectedElephant(el);
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-bold hover:bg-amber-200 transition-colors truncate max-w-[140px] cursor-pointer shadow-xs"
                    >
                      🐘 {post.elephantName}
                    </button>
                  )}
                </div>

                {/* Photo Media */}
                <div className="relative aspect-[4/3] w-full bg-slate-100">
                  <img
                    src={post.photoUrl}
                    alt={post.caption}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {post.location && (
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>{post.location}</span>
                    </div>
                  )}
                </div>

                {/* Caption */}
                <div className="p-4 space-y-2">
                  <p className="text-sm text-slate-700 font-sans leading-relaxed font-normal">
                    {post.caption}
                  </p>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </div>
                </div>
              </div>

              {/* Interaction Bar */}
              <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Like */}
                  <button
                    onClick={() => likePost(post.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      isLiked ? 'text-rose-600' : 'text-slate-600 hover:text-rose-600'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    <span>{post.likesCount}</span>
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => setCommentingPostId(post.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.commentsCount || comments.filter(c => c.postId === post.id).length}</span>
                  </button>
                </div>

                {/* Share */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("ඡායාරූප සබැඳිය පිටපත් කරගන්නා ලදී (Link copied to clipboard)!");
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Story Fullscreen Modal */}
      {activeStoryPost && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveStoryPost(null)}
        >
          <div 
            className="relative max-w-md w-full aspect-[9/16] bg-slate-950 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            <img src={activeStoryPost.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60" />

            {/* Top Bar */}
            <div className="relative z-10 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                  🐘
                </div>
                <div>
                  <div className="text-xs font-bold">
                    {activeStoryPost.elephantName &&
                    !/^unknown\s+elephant$/i.test(String(activeStoryPost.elephantName).trim())
                      ? activeStoryPost.elephantName
                      : activeStoryPost.authorName || 'Post'}
                  </div>
                  <div className="text-[10px] text-slate-300">{activeStoryPost.authorName}</div>
                </div>
              </div>

              <button
                onClick={() => setActiveStoryPost(null)}
                className="p-1.5 rounded-full bg-black/60 text-white hover:bg-white hover:text-slate-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Caption */}
            <div className="relative z-10 p-5 space-y-2 text-white">
              <p className="text-sm font-medium">{activeStoryPost.caption}</p>
              {activeStoryPost.location && (
                <div className="text-xs text-amber-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{activeStoryPost.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments Drawer / Modal */}
      {commentingPostId && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCommentingPostId(null)}
        >
          <div 
            className="relative w-full max-w-lg bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-700" />
                <span>අදහස් සහ මතක සටහන් (Discussion)</span>
              </h3>
              <button
                onClick={() => setCommentingPostId(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {currentPostComments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs font-medium">
                  තවම අදහස් පළ වී නොමැත. ඔබේ මතකය මෙහි සටහන් කරන්න!
                </div>
              ) : (
                currentPostComments.map(c => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-800">{c.authorName}</span>
                      <span className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-slate-700">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* New Comment Input */}
            <form onSubmit={e => handleCommentSubmit(commentingPostId, e)} className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
              <input
                type="text"
                placeholder="ඔබගේ නම (උදා: නුවන් - මහනුවර)..."
                value={commenterName}
                onChange={e => setCommenterName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="අදහස හෝ මතක සටහන ලියන්න..."
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-lg hover:bg-amber-700 flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>එවන්න</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
