"use client";

import { useEffect, useState } from "react";

export function ApprovedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [src]);

  if (missing) return <span className={`approved-asset-missing ${className ?? ""}`} role="img" aria-label={`${alt}: Approved asset missing`}>Approved asset missing</span>;
  return <img src={src} alt={alt} className={className} onError={() => setMissing(true)} />;
}
