"use client";

import { useEffect, useRef, useState } from "react";

type SubmitPayload = {
  username: string | null;
  capturedAt: string; // ISO
  imageBytes: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBytes, setCapturedBytes] = useState<number | null>(null);
  const [capturedMime, setCapturedMime] = useState<string | null>(null);
  const [capturedSize, setCapturedSize] = useState<{ w: number; h: number } | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [submitted, setSubmitted] = useState(false);
  const [submitJson, setSubmitJson] = useState<SubmitPayload | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    async function initCamera() {
      try {
        setCameraError(null);
        const isSecure = typeof window !== "undefined" && (window.isSecureContext || window.location.hostname === "localhost");
        if (!isSecure) {
          setCameraError("Camera requires HTTPS or localhost.");
          return;
        }
        const navAny = typeof navigator !== "undefined" ? (navigator as any) : undefined;
        const mediaDevices: MediaDevices | undefined = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
        if (!mediaDevices || !mediaDevices.getUserMedia) {
          if (navAny && typeof navAny.webkitGetUserMedia === "function") {
            const stream: MediaStream = await new Promise((resolve, reject) => {
              navAny.webkitGetUserMedia({ video: { facingMode }, audio: false }, (s: MediaStream) => resolve(s), (e: any) => reject(e));
            });
            if (cancelled) return;
            streamRef.current = stream;
          } else {
            setCameraError("Camera API not available on this browser.");
            return;
          }
        } else {
          const stream = await mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
          if (cancelled) return;
          streamRef.current = stream;
        }
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          try { await videoRef.current.play(); } catch {}
        }
      } catch (err: any) {
        console.error("Camera access error", err);
        setCameraError(err?.message || "Failed to access camera");
      }
    }
    initCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };
  }, [mounted, facingMode]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    let canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      const url = URL.createObjectURL(blob);
      setCapturedUrl(url);
      setCapturedMime(blob.type || "image/jpeg");
      const buf = await blob.arrayBuffer();
      setCapturedBytes(buf.byteLength);
      setCapturedSize({ w: width, h: height });
      setSubmitted(false);
      setSubmitJson(null);
    }, "image/jpeg", 0.9);
  };

  const handleSubmit = () => {
    const username = (() => {
      try {
        return sessionStorage.getItem("username");
      } catch {
        return null;
      }
    })();
    const payload: SubmitPayload = {
      username,
      capturedAt: new Date().toISOString(),
      imageBytes: capturedBytes,
      mimeType: capturedMime,
      width: capturedSize?.w ?? null,
      height: capturedSize?.h ?? null,
    };
    setSubmitted(true);
    setSubmitJson(payload);
  };

  const handleFlipCamera = async () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };
  

  if (!mounted) {
    return (
      <div className="center">
        <div className="card stack">
          <h2 className="title">Capture Meter</h2>
          <div className="media" />
        </div>
      </div>
    );
  }

  return (
    <div className="center">
      <div className="card stack">
        <h2 className="title">Capture Meter</h2>
        <div className="media">
          <video
            key={facingMode}
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="mediaInner"
          />
        </div>
        <div className="actions">
          <button onClick={handleCapture} className="btn btnPrimary" style={{ borderRadius: 999 }}>
            Capture
          </button>
          <button onClick={handleFlipCamera} className="btn btnPrimary">
            {facingMode === "environment" ? "Use Front Camera" : "Use Back Camera"}
          </button>
          <button onClick={handleSubmit} disabled={!capturedUrl} className={`btn ${capturedUrl ? "btnAccent" : "btnDisabled"}`}>
            Submit
          </button>
        </div>
        {cameraError && (<div className="stack" style={{ gap: 6 }}><small style={{ color: "#b00" }}>{cameraError}</small></div>)}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {capturedUrl && (
          <div className="stack" style={{ gap: 8 }}>
            <strong>Captured Image:</strong>
            <img src={capturedUrl} alt="Captured" className="imgPreview" />
            {capturedBytes != null && (
              <span>Size: {capturedBytes} bytes{capturedSize ? ` • ${capturedSize.w}×${capturedSize.h}` : ""}</span>
            )}
          </div>
        )}

        {submitted && submitJson && (
          <div className="stack" style={{ gap: 8 }}>
            <strong>Submitted</strong>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
{JSON.stringify(submitJson, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}


