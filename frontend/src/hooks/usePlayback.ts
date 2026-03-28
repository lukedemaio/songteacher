import { useCallback, useEffect, useRef, useState } from "react";
import { PlaybackEngine } from "../lib/playbackEngine";

export function usePlayback() {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  useEffect(() => {
    const engine = new PlaybackEngine();
    // Throttle React state updates to ~10fps (every 6th frame at 60fps)
    let frameCount = 0;
    engine.setTimeCallback((t) => {
      frameCount++;
      if (frameCount % 6 === 0) {
        setCurrentTime(t);
      }
    });
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  const subscribe = useCallback((cb: (time: number) => void) => {
    return engineRef.current?.subscribe(cb) ?? (() => {});
  }, []);

  const unsubscribe = useCallback((cb: (time: number) => void) => {
    engineRef.current?.unsubscribe(cb);
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

  const setPlaybackRate = useCallback((rate: number) => {
    engineRef.current?.setPlaybackRate(rate);
    setPlaybackRateState(rate);
  }, []);

  const loadStemAudio = useCallback(async (url: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.loadStemAudio(url);
    setIsPlaying(engine.isPlaying);
  }, []);

  return {
    currentTime,
    isPlaying,
    duration,
    isLoaded,
    playbackRate,
    loadAudio,
    loadStemAudio,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
    subscribe,
    unsubscribe,
  };
}
