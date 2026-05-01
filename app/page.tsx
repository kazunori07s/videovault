"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

type VideoFile = { name: string; file: File; error?: boolean };

const GOLD = "#D4AF37";
const PAGE_SIZE = 100;

const BlurIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const EyeIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const AddIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

export default function Home() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isBlurred, setIsBlurred] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pagedVideos = useMemo(() => {
    const start = page * PAGE_SIZE;
    return videos.slice(start, start + PAGE_SIZE);
  }, [videos, page]);

  const totalPages = Math.ceil(videos.length / PAGE_SIZE);

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/'));
    if (files.length === 0) return;
    setIsLoading(true);
    const CHUNK = 1000;
    let i = 0;
    const processChunk = () => {
      const chunk = files.slice(i, i + CHUNK).map(f => ({ name: f.name, file: f }));
      setVideos(prev => [...prev, ...chunk]);
      i += CHUNK;
      if (i < files.length) setTimeout(processChunk, 0);
      else { setIsLoading(false); setPage(0); }
    };
    setTimeout(processChunk, 0);
    e.target.value = '';
  }, []);

  const openPlayer = useCallback((globalIndex: number) => {
    const v = videos[globalIndex];
    if (!v || v.error) return;
    setPlayerUrl(URL.createObjectURL(v.file));
    setPlayingIndex(globalIndex);
  }, [videos]);

  const closePlayer = useCallback(() => {
    fullscreenVideoRef.current?.pause();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (playerUrl) URL.revokeObjectURL(playerUrl);
    setPlayerUrl(null);
    setPlayingIndex(null);
  }, [playerUrl]);

  useEffect(() => {
    if (playingIndex === null) return;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      const el = fullscreenVideoRef.current;
      if (!el) return;
      try {
        if (el.requestFullscreen) el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        else if ((el as any).webkitEnterFullscreen) (el as any).webkitEnterFullscreen();
      } catch (_) {}
    }, 100);
    return () => { clearTimeout(timer); document.body.style.overflow = ''; };
  }, [playingIndex]);

  const handleVideoError = useCallback(() => {
    if (playingIndex === null) return;
    setVideos(prev => { const u = [...prev]; u[playingIndex] = { ...u[playingIndex], error: true }; return u; });
    closePlayer();
  }, [playingIndex, closePlayer]);

  const iconBtn: React.CSSProperties = {
    backgroundColor: '#1e1e1e', border: 'none', borderRadius: '50%',
    width: 48, height: 48, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  };

  return (
    <>
      <main style={{ padding: 20, backgroundColor: '#121212', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          {videos.length > 0 && (
            <span style={{ color: '#666', fontSize: 12, marginRight: 'auto' }}>
              {isLoading ? '読み込み中...' : `${videos.length.toLocaleString()} 本`}
            </span>
          )}
          <button onClick={() => setIsBlurred(b => !b)} style={{ ...iconBtn, border: isBlurred ? `2px solid ${GOLD}` : '1px solid #333' }} className="icon-btn">
            {isBlurred ? <EyeIcon color={GOLD} /> : <BlurIcon color={GOLD} />}
          </button>
          <button onClick={handleAddClick} style={iconBtn} className="icon-btn">
            <AddIcon color={GOLD} />
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </header>

        {isLoading && (
          <div style={{ marginBottom: 16, height: 3, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', backgroundColor: GOLD, width: '30%', borderRadius: 2, animation: 'loading 1s ease-in-out infinite alternate' }} />
          </div>
        )}

        {videos.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {pagedVideos.map((video, i) => {
                const globalIndex = page * PAGE_SIZE + i;
                return (
                  <div key={globalIndex} className="video-card"
                    style={{ backgroundColor: '#1e1e1e', borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2a2a', transition: 'all 0.3s ease', cursor: video.error ? 'default' : 'pointer' }}
                    onClick={() => openPlayer(globalIndex)}>
                    <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {video.error ? <span style={{ fontSize: 12, color: '#ff4444' }}>再生不可</span>
                        : !isBlurred ? (
                          <svg width="56" height="56" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="28" fill="rgba(255,255,255,0.08)" />
                            <polygon points="22,16 44,28 22,40" fill={GOLD} />
                          </svg>
                        ) : null}
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      <p style={{ fontSize: 13, color: '#bbb', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', filter: isBlurred ? 'blur(6px)' : 'none' }}>
                        {video.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 32, paddingBottom: 24 }}>
                <button onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }} disabled={page === 0}
                  style={{ background: page === 0 ? '#222' : '#2a2a2a', border: `1px solid ${page === 0 ? '#333' : GOLD}`, color: page === 0 ? '#444' : GOLD, borderRadius: 8, padding: '8px 16px', cursor: page === 0 ? 'default' : 'pointer', fontSize: 14 }}>← 前</button>
                <span style={{ color: '#888', fontSize: 13 }}>{page + 1} / {totalPages}（{videos.length.toLocaleString()} 本）</span>
                <button onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0); }} disabled={page >= totalPages - 1}
                  style={{ background: page >= totalPages - 1 ? '#222' : '#2a2a2a', border: `1px solid ${page >= totalPages - 1 ? '#333' : GOLD}`, color: page >= totalPages - 1 ? '#444' : GOLD, borderRadius: 8, padding: '8px 16px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 14 }}>次 →</button>
              </div>
            )}
          </>
        )}
      </main>

      {playerUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={closePlayer} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <video ref={fullscreenVideoRef} src={playerUrl} controls autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: isBlurred ? 'blur(30px)' : 'none' }}
            onError={handleVideoError} />
        </div>
      )}

      <style jsx>{`
        @keyframes loading { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
        .icon-btn:hover { background-color: #2a2a2a !important; transform: translateY(-2px) scale(1.05); }
        .icon-btn:active { transform: scale(0.95); }
        .video-card:hover { border-color: ${GOLD} !important; transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
      `}</style>
    </>
  );
}
