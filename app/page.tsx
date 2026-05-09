'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const FRAME_STYLES = ['Classic', 'Vintage', 'Minimal', 'Film'];

export default function Home() {
  // Main screen state
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'modeSelect' | 'camera' | 'upload' | 'strip'>('landing');
  
  // Frame selection
  const [selectedFrame, setSelectedFrame] = useState(0);
  
  // Photos state
  const [photos, setPhotos] = useState<string[]>([]);
  
  // Camera states
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  
  // Upload states
  const [uploadStep, setUploadStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Frame navigation
  const nextFrame = () => setSelectedFrame((prev) => (prev + 1) % FRAME_STYLES.length);
  const prevFrame = () => setSelectedFrame((prev) => (prev - 1 + FRAME_STYLES.length) % FRAME_STYLES.length);

  // Force camera re-initialization when screen becomes camera
  useEffect(() => {
    if (currentScreen === 'camera') {
      setIsCameraReady(false);
      setPhotos([]);
      setCountdown(null);
      setIsCapturing(false);
      
      // Small delay to ensure Webcam component mounts
      const timer = setTimeout(() => {
        setIsCameraReady(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Capture photo from webcam - Fixed with proper error handling
  const capturePhoto = () => {
    if (webcamRef.current && isCameraReady) {
      try {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          const newPhotos = [...photos, imageSrc];
          setPhotos(newPhotos);
          if (newPhotos.length === 4) {
            setCurrentScreen('strip');
          }
          return true;
        } else {
          console.error('Failed to capture: screenshot is null');
          return false;
        }
      } catch (err) {
        console.error('Error capturing photo:', err);
        return false;
      }
    }
    console.error('Camera not ready yet');
    return false;
  };

  // Countdown then capture
  const startCountdown = async () => {
    setIsCapturing(true);
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);
    
    // Small delay to ensure countdown animation finishes
    await new Promise(r => setTimeout(r, 100));
    
    const success = capturePhoto();
    if (!success) {
      alert('Camera error. Please make sure camera is accessible and try again.');
    }
    setIsCapturing(false);
  };

  const handleCapture = () => {
    if (photos.length >= 4) {
      return;
    }
    if (!isCameraReady) {
      alert('Camera is initializing. Please wait a moment.');
      return;
    }
    if (!isCapturing) {
      startCountdown();
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageSrc = e.target?.result as string;
      const newPhotos = [...photos, imageSrc];
      setPhotos(newPhotos);
      setUploadStep(newPhotos.length);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (newPhotos.length === 4) {
        setCurrentScreen('strip');
      }
    };
    reader.readAsDataURL(file);
  };

  const startUpload = () => {
    setPhotos([]);
    setUploadStep(0);
    setCurrentScreen('upload');
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  // Download functions
  const downloadPNG = async () => {
    if (stripRef.current) {
      const canvas = await html2canvas(stripRef.current);
      const link = document.createElement('a');
      link.download = 'photostrip.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const downloadPDF = async () => {
    if (stripRef.current) {
      const canvas = await html2canvas(stripRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('photostrip.pdf');
    }
  };

  const reset = () => {
    setPhotos([]);
    setCurrentScreen('modeSelect');
    setCountdown(null);
    setIsCameraReady(false);
    setIsCapturing(false);
  };

  // ========== LANDING SCREEN ==========
  if (currentScreen === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf6f0] px-4">
        <h1 className="text-5xl md:text-6xl font-light italic text-center text-[#3d2b1a] mb-12 tracking-wide"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
          Photobooth Studio
        </h1>
        <button
          onClick={() => setCurrentScreen('modeSelect')}
          className="px-10 py-3 bg-[#3d2b1a] text-[#faf6f0] rounded-full
                     hover:bg-[#5a3d2a] hover:scale-105 transition-all duration-300 shadow-md text-lg"
        >
          ENTER
        </button>
      </div>
    );
  }

  // ========== MODE SELECTION SCREEN ==========
  if (currentScreen === 'modeSelect') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf6f0] px-4 py-8">
        
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        
        <div className="double-lined-box max-w-md w-full">
          <div className="double-lined-box-inner">
            <div className="space-y-2 mb-4">
              {[1, 2, 3, 4].map((num) => (
                <div key={num} className="w-40 h-28 bg-gray-100 rounded-sm mx-auto flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300">
                  {photos.length >= num ? (
                    <img src={photos[num-1]} alt={`Photo ${num}`} className="w-full h-full object-cover rounded-sm" />
                  ) : (
                    <div className="text-center"><div>📷</div><div>Photo {num}</div></div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-center gap-4 mt-2">
              <button onClick={prevFrame} className="w-8 h-8 rounded-full bg-[#3d2b1a] text-white flex items-center justify-center hover:bg-[#5a3d2a] transition text-sm">←</button>
              <span className="text-[#3d2b1a] font-medium min-w-[70px] text-center text-sm">{FRAME_STYLES[selectedFrame]}</span>
              <button onClick={nextFrame} className="w-8 h-8 rounded-full bg-[#3d2b1a] text-white flex items-center justify-center hover:bg-[#5a3d2a] transition text-sm">→</button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button
            onClick={() => {
              setPhotos([]);
              setCountdown(null);
              setIsCameraReady(false);
              setIsCapturing(false);
              setCurrentScreen('camera');
            }}
            className="px-6 py-2 bg-[#3d2b1a] text-[#faf6f0] rounded-full hover:bg-[#5a3d2a] hover:scale-105 transition-all shadow-md min-w-[150px] text-sm"
          >
            USE CAMERA
          </button>
          <button
            onClick={startUpload}
            className="px-6 py-2 border-2 border-[#3d2b1a] text-[#3d2b1a] rounded-full hover:bg-[#3d2b1a] hover:text-[#faf6f0] transition-all min-w-[150px] text-sm"
          >
            BROWSE PICTURES
          </button>
        </div>
      </div>
    );
  }

  // ========== CAMERA SCREEN ==========
  if (currentScreen === 'camera') {
    return (
      <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-4">
        <div className="relative bg-black rounded-xl overflow-hidden shadow-xl">
          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <span className="text-6xl text-white font-bold countdown-number">{countdown}</span>
            </div>
          )}
          <Webcam
            ref={webcamRef}
            mirrored
            screenshotFormat="image/jpeg"
            className="w-80 rounded-xl"
            videoConstraints={{ facingMode: "user" }}
            onUserMedia={() => {
              console.log('Camera ready');
              setIsCameraReady(true);
            }}
            onUserMediaError={(err) => {
              console.error('Camera error:', err);
              alert('Could not access camera. Please check permissions.');
            }}
          />
          {!isCameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
              <div className="text-white text-center">
                <div className="animate-pulse">📷</div>
                <p className="text-sm mt-2">Starting camera...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium
              ${photos.length >= num ? 'bg-green-500 border-green-400 text-white' : 'bg-white border-[#3d2b1a]/30 text-[#3d2b1a]/50'}`}>
              {photos.length >= num ? '✓' : num}
            </div>
          ))}
        </div>

        <button
          onClick={handleCapture}
          disabled={photos.length >= 4 || !isCameraReady || isCapturing}
          className={`mt-4 px-6 py-2 rounded-full text-base font-medium transition-all
            ${(photos.length >= 4 || !isCameraReady || isCapturing) 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-[#3d2b1a] text-[#faf6f0] hover:scale-105 hover:bg-[#5a3d2a] shadow-md'}`}
        >
          {!isCameraReady ? 'Loading Camera...' : isCapturing ? 'Capturing...' : photos.length >= 4 ? 'Complete!' : 'Take Photo'}
        </button>

        <button
          onClick={() => {
            setPhotos([]);
            setCountdown(null);
            setIsCameraReady(false);
            setIsCapturing(false);
            setCurrentScreen('modeSelect');
          }}
          className="mt-3 text-[#3d2b1a]/60 underline text-xs hover:text-[#3d2b1a] transition"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ========== UPLOAD SCREEN ==========
  if (currentScreen === 'upload') {
    return (
      <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-4">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        
        <div className="flex gap-3 mt-6">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-sm font-medium overflow-hidden
              ${photos.length >= num ? 'border-green-500 bg-white' : 'bg-white border-[#3d2b1a]/30 text-[#3d2b1a]/50'}`}>
              {photos.length >= num ? <img src={photos[num-1]} alt={`Photo ${num}`} className="w-full h-full object-cover" /> : num}
            </div>
          ))}
        </div>

        <p className="mt-4 text-[#3d2b1a] text-center text-sm">
          {uploadStep === 0 && "Click below to select Photo 1"}
          {uploadStep === 1 && "Select Photo 2"}
          {uploadStep === 2 && "Select Photo 3"}
          {uploadStep === 3 && "Select Photo 4"}
        </p>

        {uploadStep < 4 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 px-6 py-2 bg-[#3d2b1a] text-[#faf6f0] rounded-full text-sm hover:bg-[#5a3d2a] hover:scale-105 transition-all"
          >
            {uploadStep === 0 ? "Select Photo 1" : `Select Photo ${uploadStep + 1}`}
          </button>
        )}

        <button
          onClick={() => {
            setPhotos([]);
            setUploadStep(0);
            setCurrentScreen('modeSelect');
          }}
          className="mt-3 text-[#3d2b1a]/60 underline text-xs hover:text-[#3d2b1a] transition"
        >
          ← Back to Mode Selection
        </button>
      </div>
    );
  }

  // ========== STRIP SCREEN ==========
  if (currentScreen === 'strip' && photos.length === 4) {
    const frameStyles = {
      0: 'border-4 border-[#3d2b1a]',
      1: 'border-8 border-[#8B7355]',
      2: 'border-2 border-gray-400',
      3: 'border-4 border-black',
    };
    
    return (
      <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-4">
        <div ref={stripRef} className="bg-white p-4 shadow-xl rounded-sm">
          <div className="space-y-2">
            {photos.map((photo, idx) => (
              <div key={idx} className={`${frameStyles[selectedFrame as keyof typeof frameStyles]} overflow-hidden rounded-sm`}>
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-40 h-32 object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={downloadPNG} className="px-5 py-2 bg-[#3d2b1a] text-[#faf6f0] rounded-full text-sm hover:bg-[#5a3d2a] transition">Download PNG</button>
          <button onClick={downloadPDF} className="px-5 py-2 bg-[#3d2b1a] text-[#faf6f0] rounded-full text-sm hover:bg-[#5a3d2a] transition">Download PDF</button>
          <button onClick={reset} className="px-5 py-2 border border-[#3d2b1a] text-[#3d2b1a] rounded-full text-sm hover:bg-[#3d2b1a]/10 transition">Take New Photos</button>
        </div>
      </div>
    );
  }

  return null;
}