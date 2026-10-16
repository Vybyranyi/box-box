"use client";

import { useState, type ReactNode } from "react";

/**
 * Hotlinked image from the formula1.com CDN with a fallback when it fails to load.
 * Deliberately a plain <img>: next/image would proxy and re-host it on our domain.
 */
export function RemoteImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
