'use client';

import { useRef, useState } from 'react';
import Webcam from 'react-webcam';

export default function CameraTest() {
  const webcamRef = useRef<Webcam>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Camera permission denied:', err);
      setHasPermission(false);
    }
  };

  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setPhoto(imageSrc);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-4">Camera Test Page</h1>
      
      {hasPermission === null && (
        <button
          onClick={requestCamera}
          className="px-6 py-3 bg-[#3d2b1a] text-white rounded-full"
        >
          Request Camera Permission
        </button>
      )}

      {hasPermission === false && (
        <div className="text-red-500 text-center">
          <p>Camera permission denied.</p>
          <p>Please check your browser settings and reload.</p>
        </div>
      )}

      {hasPermission === true && (
        <>
          <div className="relative bg-black rounded-xl overflow-hidden mb-4">
            <Webcam
              ref={webcamRef}
              mirrored
              screenshotFormat="image/jpeg"
              className="w-80 rounded-xl"
            />
          </div>
          
          <button
            onClick={capturePhoto}
            className="px-6 py-2 bg-[#3d2b1a] text-white rounded-full"
          >
            Capture Photo
          </button>
          
          {photo && (
            <div className="mt-4">
              <p className="mb-2">Captured Photo:</p>
              <img src={photo} alt="Captured" className="w-40 rounded-lg shadow-md" />
            </div>
          )}
        </>
      )}
    </div>
  );
}