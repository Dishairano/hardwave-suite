'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  className?: string;
}

export default function SignatureCanvas({ onSave, className = '' }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    context.scale(window.devicePixelRatio, window.devicePixelRatio);

    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    setCtx(context);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctx) return;
    setIsDrawing(true);
    setIsEmpty(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!ctx) return;
    setIsDrawing(false);
    ctx.closePath();
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const saveSignature = () => {
    if (!canvasRef.current || isEmpty) return;
    const signatureData = canvasRef.current.toDataURL('image/png');
    onSave(signatureData);
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Draw your signature below
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
            <canvas
              ref={canvasRef}
              className="w-full h-48 touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Use your mouse or touchscreen to sign above
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={clearCanvas} className="flex-1">
            Clear
          </Button>
          <Button
            type="button"
            onClick={saveSignature}
            disabled={isEmpty}
            className="flex-1 bg-orange-500 hover:bg-orange-600"
          >
            Save Signature
          </Button>
        </div>
      </div>
    </Card>
  );
}
