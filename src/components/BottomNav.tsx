import React from 'react';
import { Compass, Plus, Megaphone, CircleUser } from 'lucide-react';
import { ElephantIcon } from './ElephantIcon';
import { useAuth } from '../firebase/authContext';

interface BottomNavProps {
  currentTab: 'home' | 'elephant' | 'notifications' | 'profile';
  onSelectTab: (tab: 'home' | 'elephant' | 'notifications' | 'profile') => void;
  onOpenAdd: () => void;
  hasNewNotifications?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAdd,
  hasNewNotifications = false,
}) => {
  const { user, profile } = useAuth();
  const rawPhoto = profile?.photoURL || user?.photoURL;
  const userPhoto = rawPhoto && typeof rawPhoto === 'string' && rawPhoto.trim().length > 0 ? rawPhoto : null;
  const isLoggedIn = !!(user && !user.isAnonymous) || !!profile;
  const shortName = (() => {
    if (!isLoggedIn) return null;
    const name = (profile?.displayName || user?.displayName || '').trim();
    if (!name) return null;
    return name.split(/\s+/)[0].slice(0, 10);
  })();

  const inactive = 'text-zinc-400 dark:text-zinc-600 hover:text-black dark:hover:text-white';
  const active = 'text-[#062E22] dark:text-white scale-110';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-3 pt-1 px-4 pointer-events-none">
      <div className="relative bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-zinc-200 dark:border-white/15 shadow-2xl rounded-full px-6 py-2.5 flex items-center justify-between gap-6 sm:gap-10 pointer-events-auto max-w-md w-full transition-colors">
        {/* Discover / Feed */}
        <button
          onClick={() => onSelectTab('home')}
          aria-label="Discover Feed"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'home' ? active : inactive
          }`}
        >
          <Compass className={`w-6 h-6 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          {currentTab === 'home' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-white rounded-full mt-0.5" />
          )}
        </button>

        {/* Elephant directory — dedicated elephant mark */}
        <button
          onClick={() => onSelectTab('elephant')}
          aria-label="Elephant Registry"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'elephant' ? active : inactive
          }`}
        >
          <ElephantIcon
            className="w-6 h-6"
            fill={currentTab === 'elephant'}
          />
          {currentTab === 'elephant' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-white rounded-full mt-0.5" />
          )}
        </button>

        {/* Center + */}
        <div className="relative -top-5 flex flex-col items-center">
          <button
            onClick={onOpenAdd}
            aria-label="Add post or story"
            className="w-12 h-12 rounded-full bg-[#062E22] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer border-4 border-white dark:border-black"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Notices */}
        <button
          onClick={() => onSelectTab('notifications')}
          aria-label="Notices"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'notifications' ? active : inactive
          }`}
        >
          <div className="relative">
            <Megaphone
              className={`w-6 h-6 ${currentTab === 'notifications' ? 'stroke-[2.5]' : 'stroke-2'}`}
            />
            {hasNewNotifications && currentTab !== 'notifications' && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-black" />
              </span>
            )}
          </div>
          {currentTab === 'notifications' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-white rounded-full mt-0.5" />
          )}
        </button>

        {/* Profile */}
        <button
          onClick={() => onSelectTab('profile')}
          aria-label="User Profile"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'profile' ? active : inactive
          }`}
        >
          {userPhoto ? (
            <div
              className={`w-6 h-6 rounded-full overflow-hidden border-2 ${
                currentTab === 'profile'
                  ? 'border-[#062E22] dark:border-white'
                  : 'border-transparent'
              }`}
            >
              <img src={userPhoto} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <CircleUser
              className={`w-6 h-6 ${currentTab === 'profile' ? 'stroke-[2.5]' : 'stroke-2'}`}
            />
          )}
          {shortName ? (
            <span
              className={`text-[9px] font-bold mt-0.5 max-w-[52px] truncate leading-none ${
                currentTab === 'profile'
                  ? 'text-[#062E22] dark:text-white'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {shortName}
            </span>
          ) : currentTab === 'profile' ? (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-white rounded-full mt-0.5" />
          ) : null}
        </button>
      </div>
    </div>
  );
};
