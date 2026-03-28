import { useCallback, useEffect, useRef, useState } from "react";
import { PlaybackEngine } from "../lib/playbackEngine";

export function usePlayback() {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const engine = new PlaybackEngine();
    engine.setTimeCallback((t) => setCurrentTime(t));
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  const loadAudio = useCallback(async (url: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const dur = await engine.loadAudio(url);
    setDuration(dur);
    setIsLoaded(true);
  }, []);

  const play = useCallback(() => {
    engineRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (engineRef.current?.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
    setCurrentTime(time);
  }, []);

  return {
    currentTime,
    isPlaying,
    duration,
    isLoaded,
    loadAudio,
    play,
    pause,
    togglePlay,
    seek,
  };
}
