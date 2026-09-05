import React, { useState } from 'react';
import { useRegistry } from '../context/RegistryContext';
import { useLanguage } from '../context/LanguageContext';
import { uploadImageToCloudinary, CLOUDINARY_CONFIG } from '../services/cloudinary';
import { Camera, X, Upload, Check, AlertCircle, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';

interface SubmitPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubmitPhotoModal: React.FC<SubmitPhotoModalProps> = ({ isOpen, onClose }) => {
  const { elephants, addPost } = useRegistry();
  const { t } = useLanguage();

  const [selectedElephantId, setSelectedElephantId] = useState<string>(elephants[0]?.id || '');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('');
  const [authorUsername, setAuthorUsername] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isStory, setIsStory] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  
  // Cloudinary upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      const secureUrl = await uploadImageToCloudinary(file, (percent) => {
        setUploadProgress(percent);
      });
      setPhotoUrl(secureUrl);
      setIsUploading(false);
      setUploadProgress(100);
    } catch (err: unknown) {
      setIsUploading(false);
      setUploadError((err as Error)?.message || 'Failed to upload image to Cloudinary.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl || !authorName) return;

    const matchedElephant = elephants.find(el => el.id === selectedElephantId);

    await addPost({
      elephantId: selectedElephantId,
      elephantName: matchedElephant?.name || 'Venerated Tusker',
      elephantSinhalaName: matchedElephant?.sinhalaName || 'පූජනීය ඇත් රජුන්',
      photoUrl,
      caption,
      authorUid: 'community_member',
      authorName,
      authorUsername: authorUsername ? (authorUsername.startsWith('@') ? authorUsername : `@${authorUsername}`) : '@cultural_preserver',
      authorPhotoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      isStory,
      isStoryOnly: false,
      location: location || 'Sri Lanka'
    });

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="relative w-full max-w-lg bg-white border border-slate-300 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                {t('submitPhoto')}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Cloudinary Storage ({CLOUDINARY_CONFIG.cloudName}) & Realtime Firebase
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">ඡායාරූපය සාර්ථකව පළ කරන ලදී!</h4>
            <p className="text-xs text-slate-600 font-medium">ශ්‍රී ලංකාවේ සජීවී ඇත් ලේඛනාගාරයට දායක වීම ගැන ස්තුතියි.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Direct Cloudinary File Upload Box */}
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold">
                ඡායාරූපය උඩුගත කරන්න (Cloudinary Upload) *
              </label>
              
              <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-4 text-center transition-colors bg-slate-50 relative group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                />
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-7 h-7 text-amber-600 animate-spin" />
                      <span className="text-xs font-bold text-slate-800">
                        Cloudinary වෙත උඩුගත කරමින්... {uploadProgress}%
                      </span>
                      <div className="w-48 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div 
                          className="bg-amber-600 h-1.5 transition-all duration-200" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-amber-600 transition-colors" />
                      <span className="text-xs font-bold text-slate-800">
                        ඡායාරූපය මෙතැනින් තෝරන්න (Drag & Drop or Click)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cloudinary &bull; Preset: {CLOUDINARY_CONFIG.uploadPreset} &bull; Max 20MB
                      </span>
                    </>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Or manual URL */}
              <div className="pt-1">
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                  හෝ සෘජු HTTPS Image URL එකක් ඇතුළත් කරන්න:
                </span>
                <input
                  type="text"
                  required
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/drmmn0xp3/image/upload/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-[11px]"
                />
              </div>

              {photoUrl && (
                <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mt-2 shadow-xs">
                  <img 
                    src={photoUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover" 
                    onError={(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80'} 
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shadow-xs">
                    ✓ Image Loaded
                  </div>
                </div>
              )}
            </div>

            {/* Elephant Tag */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">ඡායාරූපයේ සිටින ඇතා තෝරන්න *</label>
              <select
                value={selectedElephantId}
                onChange={e => setSelectedElephantId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
              >
                {elephants.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.sinhalaName ? `(${e.sinhalaName})` : ''} - {e.organization || e.location}
                  </option>
                ))}
              </select>
            </div>

            {/* Photographer Credits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ඔබේ නම (Photographer) *</label>
                <input
                  type="text"
                  required
                  placeholder="උදා: කසුන් ප්‍රනාන්දු"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">සමාජ මාධ්‍ය නාමය (Social Handle)</label>
                <input
                  type="text"
                  placeholder="@kasun_clicks"
                  value={authorUsername}
                  onChange={e => setAuthorUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>
            </div>

            {/* Location & Caption */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">ස්ථානය / පෙරහැර</label>
              <input
                type="text"
                placeholder="උදා: මහනුවර ඇසළ පෙරහැර"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">විස්තරය (Caption)</label>
              <textarea
                rows={3}
                placeholder="මෙම ඡායාරූපය සහ ඇත් රජුන් පිළිබඳ සටහන..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>

            {/* Feature as story */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isStoryCheck"
                checked={isStory}
                onChange={e => setIsStory(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="isStoryCheck" className="text-slate-700 text-xs font-medium cursor-pointer">
                ප්‍රධාන කථා පුවරුවට එක් කරන්න (Featured highlight story)
              </label>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                අවලංගු කරන්න
              </button>
              <button
                type="submit"
                disabled={isUploading || !photoUrl}
                className="px-5 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ඡායාරූපය පළ කරන්න
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
};
