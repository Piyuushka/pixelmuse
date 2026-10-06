'use client';

import React, { useEffect, useRef } from 'react';

interface QRCodeDisplayProps {
  text: string;
  size?: number;
}

export function QRCodeDisplay({ text, size = 180 }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    // Draw stylized QR pattern based on input hash
    const cells = 15;
    const cellSize = size / cells;

    ctx.fillStyle = '#0F172A';

    // Simple deterministic grid pattern for visual QR representation
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        // Finder patterns (top-left, top-right, bottom-left)
        const isTopLeft = r < 4 && c < 4;
        const isTopRight = r < 4 && c >= cells - 4;
        const isBottomLeft = r >= cells - 4 && c < 4;

        if (isTopLeft || isTopRight || isBottomLeft) {
          const isBorder = r === 0 || r === 3 || c === 0 || c === 3 || r === cells - 1 || r === cells - 4 || c === cells - 1 || c === cells - 4;
          const isCenter = (r === 1.5 || r === 2) && (c === 1.5 || c === 2);
          if (isBorder || isCenter) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
          continue;
        }

        // Data pattern hash
        const val = (text.charCodeAt((r * cells + c) % text.length) * 31 + r * 17 + c * 13) % 100;
        if (val > 45) {
          ctx.fillRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize - 1);
        }
      }
    }
  }, [text, size]);

  return (
    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-md inline-block">
      <canvas ref={canvasRef} width={size} height={size} className="rounded-lg" />
    </div>
  );
}
