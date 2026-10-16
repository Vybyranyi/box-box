"use client";

import type { RaceRunner } from "@/game/race-runner";
import { TrackRenderer, type RenderOptions } from "@/game/track-renderer";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/**
 * Canvas map of the circuit. Drawing happens in the parent's animation loop via `register`,
 * so the map never re-renders through React.
 */
export function TrackMap({
  runner,
  options,
  register,
}: {
  runner: RaceRunner;
  options: RenderOptions;
  register: (draw: (() => void) | null) => void;
}) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new TrackRenderer(canvas, runner.race);
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.resize(width, height, window.devicePixelRatio || 1);
      renderer.draw(runner, optionsRef.current);
    });
    observer.observe(canvas);
    register(() => renderer.draw(runner, optionsRef.current));
    return () => {
      observer.disconnect();
      register(null);
    };
  }, [runner, register]);

  return (
    <canvas
      ref={canvasRef}
      className="size-full"
      aria-label={t("race.mapLabel", {
        track: t(`tracks.${runner.race.track.id}` as never),
      })}
    />
  );
}
