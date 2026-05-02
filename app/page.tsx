"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

type VideoFile = { name: string; file: File; error?: boolean };

const GOLD = "#D4AF37";
const PAGE_SIZE = 100;
const MAX_FILES = 3000; // 1回あたりの上限

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

export default function Home() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isBlurred, setIsBlurred] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pagedVideos = useMemo(() => {
    const start = page * PAGE_SIZE;
    return videos.slice(start, start + PAGE_SIZE);
  }, [videos, page]);

  const totalPages = Math.ceil(videos.length / PAGE_SIZE);
  const progress = totalCount > 0 ? Math.min(100, Math.round((loadedCount / totalCount) * 100)) : 0;

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setElapsedMs(Date.now() - startTimeRef.current);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleAddClick = useCallback(() => {
    setWarning(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/'));
    if (files.length === 0) return;

    // 上限チェック
    if (files.length > MAX_FILES) {
      setWarning(`一度に選択できるのは ${MAX_FILES.toLocaleString()} 本までです。最初の ${MAX_FILES.toLocaleString()} 本を追加します。残りは再度追加ボタンで選択してください。`);
      files = files.slice(0, MAX_FILES);
    }

    setIsLoading(true);
    setLoadedCount(0);
    setTotalCount(files.length);
    startTimer();

    const CHUNK = 200;
    let i = 0;
    const built: VideoFile[] = [];

    const processNext = () => {
      const deadline = Date.now() + 12;
      while (i < files.length && Date.now() < deadline) {
        const end = Math.min(i + CHUNK, files.length);
        for (let j = i; j < end; j++) {
          built.push({ name: files[j].name, file: files[j] });
        }
        i = end;
      }
      setLoadedCount(i);
      if (i < files.length) {
        requestAnimationFrame(processNext);
      } else {
        setVideos(prev => [...prev, ...built]);
        setIsLoading(false);
        setPage(0);
        stopTimer();
      }
    };

    requestAnimationFrame(processNext);
    e.target.value = '';
  }, [startTimer, stopTimer]);

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

  const formatTime = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  const eta = useMemo(() => {
    if (!isLoading || loadedCount === 0 || elapsedMs === 0) return null;
    const rate = loadedCount / elapsedMs;
    const remaining = (totalCount - loadedCount) / rate;
    return formatTime(Math.round(remaining));
  }, [isLoading, loadedCount, totalCount, elapsedMs]);

  const iconBtn: React.CSSProperties = {
    backgroundColor: '#1e1e1e', border: 'none', borderRadius: '50%',
    width: 48, height: 48, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  };

  const pageBtn = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? '#222' : '#2a2a2a',
    border: `1px solid ${disabled ? '#333' : GOLD}`,
    color: disabled ? '#444' : GOLD,
    borderRadius: 8, padding: '8px 16px',
    cursor: disabled ? 'default' : 'pointer', fontSize: 14,
  });

  return (
    <>
      <main style={{ padding: 20, backgroundColor: '#121212', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          {(videos.length > 0 || isLoading) && (
            <span style={{ color: '#666', fontSize: 12, marginRight: 'auto' }}>
              {isLoading
                ? `${loadedCount.toLocaleString()} / ${totalCount.toLocaleString()} 本を処理中…`
                : `${videos.length.toLocaleString()} 本 · ${formatTime(elapsedMs)}で完了`}
            </span>
          )}
          <button onClick={()=>{}} className="icon-btn" style={{...iconBtnBase, border: false ? '2px solid #ef4444' : '1px solid #333'}} aria-label="音声検索">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={false ? '#ef4444' : GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button onClick={() => setIsBlurred(b => !b)} style={{ ...iconBtn, border: isBlurred ? `2px solid ${GOLD}` : '1px solid #333' }} className="icon-btn">
            {isBlurred ? <EyeIcon color={GOLD} /> : <BlurIcon color={GOLD} />}
          </button>
          <button onClick={()=>{}} style={iconBtn} className="icon-btn" disabled={isLoading}>
            
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </header>

        {/* 上限警告 */}
        {warning && (
          <div style={{ marginBottom: 12, padding: '10px 14px', backgroundColor: '#2a1a00', border: '1px solid #664400', borderRadius: 8, fontSize: 12, color: '#ffaa44', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span>{warning}</span>
            <button onClick={() => setWarning(null)} style={{ background: 'none', border: 'none', color: '#ffaa44', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* プログレスバー */}
        {isLoading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 4, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', backgroundColor: GOLD, borderRadius: 4, width: `${progress}%`, transition: 'width 0.1s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' }}>
              <span>{progress}% · {loadedCount.toLocaleString()} / {totalCount.toLocaleString()} 本</span>
              <span>経過 {formatTime(elapsedMs)}{eta ? ` · 残り約 ${eta}` : ''}</span>
            </div>
          </div>
        )}

        {/* 残り本数ヒント */}
        {!isLoading && videos.length > 0 && videos.length % MAX_FILES === 0 && (
          <div style={{ marginBottom: 12, padding: '8px 14px', backgroundColor: '#1a1a2a', border: '1px solid #334', borderRadius: 8, fontSize: 12, color: '#88aaff' }}>
            さらに動画を追加するには ＋ ボタンをタップしてください（3,000本ずつ追加できます）
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
                      {video.error
                        ? <span style={{ fontSize: 12, color: '#ff4444' }}>再生不可</span>
                        : !isBlurred
                          ? <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="28" fill="rgba(255,255,255,0.08)" /><polygon points="22,16 44,28 22,40" fill={GOLD} /></svg>
                          : null}
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
                <button onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }} disabled={page === 0} style={pageBtn(page === 0)}>← 前</button>
                <span style={{ color: '#888', fontSize: 13 }}>{page + 1} / {totalPages}（{videos.length.toLocaleString()} 本）</span>
                <button onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0); }} disabled={page >= totalPages - 1} style={pageBtn(page >= totalPages - 1)}>次 →</button>
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
        .icon-btn:hover { background-color: #2a2a2a !important; transform: translateY(-2px) scale(1.05); }
        .icon-btn:active { transform: scale(0.95); }
        .video-card:hover { border-color: ${GOLD} !important; transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
      `}</style>
    </>
  );
}
//touched
//v2
//v3
//voice
//mic
//fix
//v4
