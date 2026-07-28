"use client";

import { Camera, ScanFace } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CameraKitImage = {
  image: Blob | string;
  width: number;
  height: number;
};

type CameraKitApi = {
  init(options: Record<string, unknown>): void;
  openCameraKit(): void;
  close(): void;
  addEventListener(event: string, callback: (payload: unknown) => void): unknown;
  removeEventListener(identifier: unknown): void;
};

declare global {
  interface Window {
    YMK?: CameraKitApi;
    YMKAsyncInit?: () => void;
  }
}

async function cameraKitImageToFile(image: CameraKitImage) {
  if (image.image instanceof Blob) {
    return new File([image.image], "skincause-camera-kit.jpg", {
      type: image.image.type || "image/jpeg"
    });
  }
  const response = await fetch(image.image);
  const blob = await response.blob();
  return new File([blob], "skincause-camera-kit.jpg", { type: blob.type || "image/jpeg" });
}

export function YouCamCameraKit({
  onCapture
}: {
  onCapture(file: File): void | Promise<void>;
}) {
  const enabled = process.env.NEXT_PUBLIC_YOUCAM_CAMERA_KIT_ENABLED === "true";
  const scriptUrl = process.env.NEXT_PUBLIC_YOUCAM_CAMERA_KIT_SCRIPT_URL;
  const captureRef = useRef(onCapture);
  const [ready, setReady] = useState(false);
  const [quality, setQuality] = useState("Waiting for camera");
  const [error, setError] = useState("");

  useEffect(() => {
    captureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    if (!enabled || !scriptUrl) return;
    let cancelled = false;
    const listeners: unknown[] = [];

    const initialize = () => {
      const cameraKit = window.YMK;
      if (!cameraKit || cancelled) return;
      cameraKit.init({
        faceDetectionMode: "skincare",
        imageFormat: "blob",
        language: "enu",
        qualityLevel: "moderate",
        videoQuality: "720p"
      });
      listeners.push(cameraKit.addEventListener("faceQualityChanged", (payload) => {
        const qualityPayload = payload as {
          hasFace?: boolean;
          position?: string;
          frontal?: string;
          lighting?: string;
        };
        if (!qualityPayload.hasFace) {
          setQuality("Center your face in the guide");
        } else if (qualityPayload.position !== "good") {
          setQuality("Move closer and keep your full face in frame");
        } else if (qualityPayload.frontal !== "good") {
          setQuality("Look straight at the camera");
        } else if (!["good", "ok"].includes(qualityPayload.lighting ?? "")) {
          setQuality("Move to brighter, even front lighting");
        } else {
          setQuality("Quality checks passed");
        }
      }));
      listeners.push(cameraKit.addEventListener("faceDetectionCaptured", (payload) => {
        const capture = payload as { images?: CameraKitImage[] };
        const image = capture.images?.[0];
        if (!image) {
          setError("Camera Kit did not return a captured image.");
          return;
        }
        void cameraKitImageToFile(image)
          .then((file) => captureRef.current(file))
          .catch(() => setError("The guided capture could not be prepared."));
      }));
      setReady(true);
    };

    try {
      const parsedUrl = new URL(scriptUrl);
      if (parsedUrl.protocol !== "https:") throw new Error("Camera Kit requires HTTPS.");
      window.YMKAsyncInit = initialize;
      const existing = document.querySelector<HTMLScriptElement>("script[data-youcam-camera-kit]");
      if (window.YMK) {
        initialize();
      } else if (existing) {
        existing.addEventListener("load", initialize, { once: true });
      } else {
        const script = document.createElement("script");
        script.src = parsedUrl.toString();
        script.async = true;
        script.dataset.youcamCameraKit = "true";
        script.addEventListener("load", initialize, { once: true });
        script.addEventListener("error", () => setError("Guided camera capture is temporarily unavailable."), {
          once: true
        });
        document.head.appendChild(script);
      }
    } catch {
      const timer = window.setTimeout(() => {
        setError("Camera Kit configuration is invalid.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    return () => {
      cancelled = true;
      const cameraKit = window.YMK;
      if (cameraKit) {
        for (const listener of listeners) cameraKit.removeEventListener(listener);
        cameraKit.close();
      }
    };
  }, [enabled, scriptUrl]);

  if (!enabled) return null;

  return (
    <div className="camera-kit-panel">
      <div id="YMK-module" />
      <button
        className="button button-secondary"
        type="button"
        disabled={!ready}
        onClick={() => window.YMK?.openCameraKit()}
      >
        {ready ? <Camera size={18} /> : <ScanFace size={18} />}
        {ready ? "Open guided camera" : "Loading guided camera..."}
      </button>
      <small>{error || quality}</small>
    </div>
  );
}
