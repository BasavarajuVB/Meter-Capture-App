"use client";

import { useEffect, useRef, useState } from "react";

type SubmitPayload = {
  username: string | null;
  capturedAt: string; // ISO
  imageBytes: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  qrData: string | null;
};

type Mode = "qr" | "photo";

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrScannerRef = useRef<any>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBytes, setCapturedBytes] = useState<number | null>(null);
  const [capturedMime, setCapturedMime] = useState<string | null>(null);
  const [capturedSize, setCapturedSize] = useState<{ w: number; h: number } | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [submitted, setSubmitted] = useState(false);
  const [submitJson, setSubmitJson] = useState<SubmitPayload | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrScanning, setQrScanning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize QR Scanner
  useEffect(() => {
    if (!mounted || mode !== "qr") return;

    let cancelled = false;
    async function initQRScanner() {
      // Wait for container to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (cancelled || !qrContainerRef.current) return;

      try {
        setCameraError(null);
        setQrScanning(true);
        setQrData(null);

        // Dynamically import html5-qrcode
        const { Html5Qrcode } = await import("html5-qrcode");
        
        const qrCode = new Html5Qrcode(qrContainerRef.current.id);
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await qrCode.start(
          { facingMode: facingMode },
          config,
          (decodedText) => {
            if (cancelled) return;
            setQrData(decodedText);
            setQrScanning(false);
            qrCode.stop().then(() => {
              qrScannerRef.current = null;
            }).catch(() => {});
          },
          (errorMessage) => {
            // Ignore scanning errors, just keep scanning
          }
        );

        if (!cancelled) {
          qrScannerRef.current = qrCode;
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error("QR Scanner error", err);
        setCameraError(err?.message || "Failed to initialize QR scanner. Please install html5-qrcode: npm install html5-qrcode");
        setQrScanning(false);
      }
    }

    initQRScanner();

    return () => {
      cancelled = true;
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
        qrScannerRef.current = null;
      }
    };
  }, [mounted, mode, facingMode]);

  // Initialize Camera for Photo mode
  useEffect(() => {
    if (!mounted || mode !== "photo") return;
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
  }, [mounted, mode, facingMode]);

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
      imageBytes: mode === "photo" ? capturedBytes : null,
      mimeType: mode === "photo" ? capturedMime : null,
      width: mode === "photo" ? capturedSize?.w ?? null : null,
      height: mode === "photo" ? capturedSize?.h ?? null : null,
      qrData: mode === "qr" ? qrData : null,
    };
    setSubmitted(true);
    setSubmitJson(payload);
  };

  const handleFlipCamera = async () => {
    if (mode === "photo" && streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (mode === "qr" && qrScannerRef.current) {
      await qrScannerRef.current.stop().catch(() => {});
      qrScannerRef.current = null;
    }
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setQrData(null);
    setCapturedUrl(null);
    setSubmitted(false);
    setSubmitJson(null);
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
        
        {/* Radio buttons for mode selection */}
        <div className="stack" style={{ gap: 8, flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="radio"
              name="mode"
              value="qr"
              checked={mode === "qr"}
              onChange={(e) => handleModeChange(e.target.value as Mode)}
              style={{ cursor: "pointer" }}
            />
            <span>QR</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="radio"
              name="mode"
              value="photo"
              checked={mode === "photo"}
              onChange={(e) => handleModeChange(e.target.value as Mode)}
              style={{ cursor: "pointer" }}
            />
            <span>Photo</span>
          </label>
        </div>

        {/* QR Scanner View */}
        {mode === "qr" && (
          <>
            <div className="media" style={{ position: "relative" }}>
              <div
                id="qr-reader"
                ref={qrContainerRef}
                style={{ width: "100%", minHeight: "300px" }}
              />
              {qrScanning && (
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.7)",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  color: "white",
                  fontSize: "18px",
                  fontWeight: "bold"
                }}>
                  <span>Scanning</span>
                  <span className="qr-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              )}
            </div>
            {qrData && (
              <div className="stack" style={{ gap: 8, background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
                <strong>Scanned QR Data:</strong>
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                  {qrData}
                </pre>
              </div>
            )}
          </>
        )}

        {/* Photo Capture View */}
        {mode === "photo" && (
          <>
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
            {capturedUrl && (
              <div className="stack" style={{ gap: 8 }}>
                <strong>Captured Image:</strong>
                <img src={capturedUrl} alt="Captured" className="imgPreview" />
                {capturedBytes != null && (
                  <span>Size: {capturedBytes} bytes{capturedSize ? ` • ${capturedSize.w}×${capturedSize.h}` : ""}</span>
                )}
              </div>
            )}
          </>
        )}

        <div className="actions">
          {mode === "photo" && (
            <button onClick={handleCapture} className="btn btnPrimary" style={{ borderRadius: 999 }}>
              Capture
            </button>
          )}
          <button onClick={handleFlipCamera} className="btn btnPrimary flip-camera-btn">
            {facingMode === "environment" ? "Use Front Camera" : "Use Back Camera"}
          </button>
          {mode === "photo" && (
            <button onClick={handleSubmit} disabled={!capturedUrl} className={`btn ${capturedUrl ? "btnAccent" : "btnDisabled"}`}>
              Submit
            </button>
          )}
          {mode === "qr" && (
            <button onClick={handleSubmit} disabled={!qrData} className={`btn ${qrData ? "btnAccent" : "btnDisabled"}`}>
              Submit
            </button>
          )}
        </div>
        {cameraError && (<div className="stack" style={{ gap: 6 }}><small style={{ color: "#b00" }}>{cameraError}</small></div>)}
        <canvas ref={canvasRef} style={{ display: "none" }} />

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


