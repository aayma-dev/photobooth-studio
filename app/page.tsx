'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';

const FRAME_STYLES = ['Classic', 'Vintage', 'Minimal', 'Film'];

// Same cat photo for all 4 frames (vintage aesthetic)
const CAT_PHOTO = 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=80&h=100&fit=crop';

// Sound effects using Web Audio API (no external files needed)
const usePhotoboothSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playShutter = () => {
    const ctx = initAudio();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    
    // Short noise burst for shutter sound
    const bufferSize = 4096;
    const noiseNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    noiseNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.15;
      }
    };
    noiseNode.connect(gainNode);
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    setTimeout(() => noiseNode.disconnect(), 200);
  };

  const playPrintSound = () => {
    const ctx = initAudio();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    
    // Whirring/printing sound
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = 200;
    oscillator.connect(gainNode);
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.start();
    oscillator.stop(now + 0.3);
  };

  return { playShutter, playPrintSound, initAudio };
};

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'modeSelect' | 'camera' | 'upload' | 'strip'>('landing');
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  
  // Box animation states
  const [visibleFrames, setVisibleFrames] = useState<number[]>([]);
  const [showNote, setShowNote] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const { playShutter, playPrintSound, initAudio } = usePhotoboothSounds();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStep, setUploadStep] = useState(0);

  // Improved: Faster animation with sound effects (like real photobooth)
  useEffect(() => {
    if (currentScreen === 'landing') {
      setVisibleFrames([]);
      setShowNote(false);
      
      // Pre-initialize audio context on user interaction
      const handleFirstClick = () => {
        initAudio();
        document.removeEventListener('click', handleFirstClick);
      };
      document.addEventListener('click', handleFirstClick);
      
      // Faster animation sequence (real photobooth speed)
      // Frame 1 at 0.5s with shutter sound
      setTimeout(() => {
        playShutter();
        setVisibleFrames([1]);
      }, 500);
      
      // Frame 2 at 1.0s with print sound
      setTimeout(() => {
        playPrintSound();
        setVisibleFrames([1, 2]);
      }, 1000);
      
      // Frame 3 at 1.5s with shutter sound
      setTimeout(() => {
        playShutter();
        setVisibleFrames([1, 2, 3]);
      }, 1500);
      
      // Frame 4 at 2.0s with print sound
      setTimeout(() => {
        playPrintSound();
        setVisibleFrames([1, 2, 3, 4]);
      }, 2000);
      
      // Note appears at 2.8s
      setTimeout(() => {
        setShowNote(true);
        playPrintSound(); // Final print sound when complete
      }, 2800);
      
      return () => {
        document.removeEventListener('click', handleFirstClick);
      };
    }
  }, [currentScreen]);

  const nextFrame = () => setSelectedFrame((prev) => (prev + 1) % FRAME_STYLES.length);
  const prevFrame = () => setSelectedFrame((prev) => (prev - 1 + FRAME_STYLES.length) % FRAME_STYLES.length);

  useEffect(() => {
    if (currentScreen === 'camera') {
      setIsCameraReady(false);
      setPhotos([]);
      setCountdown(null);
      setIsCapturing(false);
      const timer = setTimeout(() => setIsCameraReady(true), 500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const capturePhoto = () => {
    if (webcamRef.current && isCameraReady) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const newPhotos = [...photos, imageSrc];
        setPhotos(newPhotos);
        if (newPhotos.length === 4) setCurrentScreen('strip');
        return true;
      }
    }
    return false;
  };

  const startCountdown = async () => {
    setIsCapturing(true);
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);
    await new Promise(r => setTimeout(r, 100));
    const success = capturePhoto();
    if (!success) alert('Camera error. Please check permissions.');
    setIsCapturing(false);
  };

  const handleCapture = () => {
    if (photos.length >= 4) return;
    if (!isCameraReady) {
      alert('Camera is initializing. Please wait.');
      return;
    }
    if (!isCapturing) startCountdown();
  };

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
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (newPhotos.length === 4) setCurrentScreen('strip');
    };
    reader.readAsDataURL(file);
  };

  const startUpload = () => {
    setPhotos([]);
    setUploadStep(0);
    setCurrentScreen('upload');
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5efe8] px-4">
        
        {/* Small Minimal Rectangular Box - Above Title */}
        <div className="mb-10 w-60">
          <div className="bg-[#f0e8dc] rounded-lg shadow-md p-4 border border-[#e0d5c5] min-h-[240px] flex flex-col items-center justify-center">
            
            {/* Printing indicator while generating */}
            {visibleFrames.length < 4 && visibleFrames.length > 0 && (
              <div className="absolute top-2 right-2">
                <div className="text-[8px] text-[#8B7355] animate-pulse">🎞️ printing...</div>
              </div>
            )}
            
            {/* Photostrip - Gentle developing animation */}
            <div className="bg-white p-2 rounded-sm shadow-sm">
              <div className="flex flex-col gap-1">
                {[1, 2, 3, 4].map((frameNum) => (
                  <motion.div 
                    key={frameNum}
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: visibleFrames.includes(frameNum) ? 1 : 0
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    {visibleFrames.includes(frameNum) && (
                      <motion.img 
                        src={CAT_PHOTO} 
                        alt={`Photobooth frame ${frameNum}`} 
                        className="w-14 h-16 object-cover rounded-sm"
                        style={{ filter: 'grayscale(0.8) sepia(0.2) contrast(1.1)' }}
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Handwritten Note - Appears after all frames */}
            <AnimatePresence>
              {showNote && (
                <motion.div 
                  className="mt-3 bg-[#fef8e8] p-2 rounded-sm shadow-sm max-w-full"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <p className="text-[#2c1a0e] text-[8px] font-serif italic text-center leading-relaxed">
                    welcome to photobooth-studio,<br />
                    a place where you can create memories,<br />
                    build with love, amo
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Title */}
        <h1 
          className="text-5xl md:text-6xl font-light text-center text-[#2c1a0e] mb-6 tracking-wide"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Photobooth Studio
        </h1>
        
        {/* Enter Button */}
        <button
          onClick={() => {
            initAudio();
            setCurrentScreen('modeSelect');
          }}
          className="px-8 py-2.5 bg-[#2c1a0e] text-[#f5efe8] rounded-full text-sm tracking-wider hover:bg-[#4a3020] transition-all duration-300 shadow-sm"
        >
          ENTER
        </button>
      </div>
    );
  }

  // ========== MODE SELECTION SCREEN ==========
  if (currentScreen === 'modeSelect') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5efe8] px-4 py-8">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 max-w-md w-full shadow-sm border border-[#e0d5c5]">
          <div className="space-y-3 mb-6">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="w-40 h-28 bg-gray-100 rounded-md mx-auto flex items-center justify-center text-gray-400 text-sm border border-gray-200">
                {photos.length >= num ? (
                  <img src={photos[num-1]} alt={`Photo ${num}`} className="w-full h-full object-cover rounded-md" />
                ) : (
                  <div className="text-center text-[#8B7355]">Photo {num}</div>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-6 mt-4">
            <button onClick={prevFrame} className="w-8 h-8 rounded-full bg-[#2c1a0e] text-white hover:bg-[#4a3020] transition">←</button>
            <span className="text-[#2c1a0e] font-light min-w-[70px] text-center">{FRAME_STYLES[selectedFrame]}</span>
            <button onClick={nextFrame} className="w-8 h-8 rounded-full bg-[#2c1a0e] text-white hover:bg-[#4a3020] transition">→</button>
          </div>
        </div>
        
        <div className="flex gap-4 mt-8">
          <button onClick={() => { setPhotos([]); setCountdown(null); setIsCameraReady(false); setIsCapturing(false); setCurrentScreen('camera'); }} className="px-6 py-2 bg-[#2c1a0e] text-white rounded-full text-sm hover:bg-[#4a3020] transition">USE CAMERA</button>
          <button onClick={startUpload} className="px-6 py-2 border border-[#2c1a0e] text-[#2c1a0e] rounded-full text-sm hover:bg-[#2c1a0e] hover:text-white transition">BROWSE PICTURES</button>
        </div>
      </div>
    );
  }

  // ========== CAMERA SCREEN ==========
  if (currentScreen === 'camera') {
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4">
        <div className="relative bg-black rounded-xl overflow-hidden shadow-xl">
          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <span className="text-6xl text-white font-light">{countdown}</span>
            </div>
          )}
          <Webcam ref={webcamRef} mirrored screenshotFormat="image/jpeg" className="w-80 rounded-xl" onUserMedia={() => setIsCameraReady(true)} onUserMediaError={() => alert('Could not access camera.')} />
          {!isCameraReady && <div className="absolute inset-0 flex items-center justify-center bg-black"><div className="text-white text-center">Starting camera...</div></div>}
        </div>
        <div className="flex gap-3 mt-6">
          {[1,2,3,4].map(num => <div key={num} className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm ${photos.length >= num ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>{photos.length >= num ? '✓' : num}</div>)}
        </div>
        <button onClick={handleCapture} disabled={photos.length >= 4 || !isCameraReady || isCapturing} className={`mt-6 px-8 py-2 rounded-full text-sm transition ${(photos.length >= 4 || !isCameraReady || isCapturing) ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#2c1a0e] text-white hover:bg-[#4a3020]'}`}>{!isCameraReady ? 'Loading...' : isCapturing ? 'Capturing...' : photos.length >= 4 ? 'Complete!' : 'Take Photo'}</button>
        <button onClick={() => { setPhotos([]); setCountdown(null); setIsCameraReady(false); setIsCapturing(false); setCurrentScreen('modeSelect'); }} className="mt-4 text-gray-400 underline text-xs">← Back</button>
      </div>
    );
  }

  // ========== UPLOAD SCREEN ==========
  if (currentScreen === 'upload') {
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        <div className="flex gap-4 mb-6">
          {[1,2,3,4].map(num => <div key={num} className={`w-16 h-16 rounded-lg border flex items-center justify-center text-sm overflow-hidden ${photos.length >= num ? 'border-green-500' : 'bg-white border-gray-300'}`}>{photos.length >= num ? <img src={photos[num-1]} className="w-full h-full object-cover" /> : num}</div>)}
        </div>
        <p className="text-[#2c1a0e] text-sm mb-4">{uploadStep < 4 ? `Select Photo ${uploadStep + 1}` : 'Complete!'}</p>
        {uploadStep < 4 && <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-[#2c1a0e] text-white rounded-full text-sm">Choose Photo</button>}
        <button onClick={() => { setPhotos([]); setUploadStep(0); setCurrentScreen('modeSelect'); }} className="mt-4 text-gray-400 underline text-xs">← Back</button>
      </div>
    );
  }

  // ========== STRIP SCREEN ==========
  if (currentScreen === 'strip' && photos.length === 4) {
    const frameStyles = { 0: 'border-4 border-[#2c1a0e]', 1: 'border-8 border-[#8B7355]', 2: 'border-2 border-gray-400', 3: 'border-4 border-black' };
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4">
        <div ref={stripRef} className="bg-white p-4 shadow-md rounded-sm">
          <div className="space-y-2">
            {photos.map((photo, idx) => <div key={idx} className={`${frameStyles[selectedFrame as keyof typeof frameStyles]} overflow-hidden rounded-sm`}><img src={photo} className="w-40 h-32 object-cover" /></div>)}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={downloadPNG} className="px-5 py-2 bg-[#2c1a0e] text-white rounded-full text-sm">Download PNG</button>
          <button onClick={downloadPDF} className="px-5 py-2 bg-[#2c1a0e] text-white rounded-full text-sm">Download PDF</button>
          <button onClick={reset} className="px-5 py-2 border border-[#2c1a0e] text-[#2c1a0e] rounded-full text-sm">New Photos</button>
        </div>
      </div>
    );
  }

  return null;
}