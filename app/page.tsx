'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';

const FRAME_STYLES = [
  { name: 'Classic', borderClass: 'border-4 border-[#2c1a0e]', shadowClass: 'shadow-md' },
  { name: 'Vintage', borderClass: 'border-8 border-[#8B7355]', shadowClass: 'shadow-lg' },
  { name: 'Minimal', borderClass: 'border-2 border-gray-400', shadowClass: 'shadow-sm' },
  { name: 'Film', borderClass: 'border-4 border-black', shadowClass: 'shadow-xl' },
];

// Filter options
const FILTERS = [
  { name: 'NORMAL', value: 'normal' },
  { name: 'B&W', value: 'bw' },
  { name: 'VINTAGE', value: 'vintage' },
];

// Cat photo for landing page
const CAT_PHOTO = 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=80&h=100&fit=crop';

// Apply filter to image
const applyFilterToImage = (imageSrc: string, filterType: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      switch (filterType) {
        case 'bw':
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11;
            data[i] = gray;
            data[i+1] = gray;
            data[i+2] = gray;
          }
          break;
        case 'vintage':
          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i+1];
            let b = data[i+2];
            
            let tr = r * 0.393 + g * 0.769 + b * 0.189;
            let tg = r * 0.349 + g * 0.686 + b * 0.168;
            let tb = r * 0.272 + g * 0.534 + b * 0.131;
            
            tr = Math.min(255, tr * 1.05);
            tg = Math.min(255, tg * 0.98);
            tb = Math.min(255, tb * 0.85);
            
            tr = tr * 0.92 + 20;
            tg = tg * 0.92 + 15;
            tb = tb * 0.92 + 10;
            
            data[i] = Math.min(255, tr);
            data[i+1] = Math.min(255, tg);
            data[i+2] = Math.min(255, tb);
          }
          break;
        default:
          break;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.src = imageSrc;
  });
};

// Sound effects using Web Audio API
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
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [photos, setPhotos] = useState<string[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  
  const [visibleFrames, setVisibleFrames] = useState<number[]>([]);
  const [showNote, setShowNote] = useState(false);
  
  const { playShutter, playPrintSound, initAudio } = usePhotoboothSounds();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStep, setUploadStep] = useState(0);

  useEffect(() => {
    const applyFilters = async () => {
      if (photos.length === 4) {
        const filtered = await Promise.all(
          photos.map(photo => applyFilterToImage(photo, selectedFilter))
        );
        setFilteredPhotos(filtered);
      }
    };
    applyFilters();
  }, [selectedFilter, photos]);

  useEffect(() => {
    if (currentScreen === 'landing') {
      setVisibleFrames([]);
      setShowNote(false);
      
      const handleFirstClick = () => {
        initAudio();
        document.removeEventListener('click', handleFirstClick);
      };
      document.addEventListener('click', handleFirstClick);
      
      setTimeout(() => { playShutter(); setVisibleFrames([1]); }, 500);
      setTimeout(() => { playPrintSound(); setVisibleFrames([1, 2]); }, 1000);
      setTimeout(() => { playShutter(); setVisibleFrames([1, 2, 3]); }, 1500);
      setTimeout(() => { playPrintSound(); setVisibleFrames([1, 2, 3, 4]); }, 2000);
      setTimeout(() => { setShowNote(true); playPrintSound(); }, 2800);
      
      return () => document.removeEventListener('click', handleFirstClick);
    }
  }, [currentScreen]);

  const nextFrame = () => setSelectedFrame((prev) => (prev + 1) % FRAME_STYLES.length);
  const prevFrame = () => setSelectedFrame((prev) => (prev - 1 + FRAME_STYLES.length) % FRAME_STYLES.length);

  useEffect(() => {
    if (currentScreen === 'camera') {
      setIsCameraReady(false);
      setPhotos([]);
      setFilteredPhotos([]);
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
        if (newPhotos.length === 4) {
          Promise.all(newPhotos.map(p => applyFilterToImage(p, selectedFilter)))
            .then(filtered => setFilteredPhotos(filtered));
          setCurrentScreen('strip');
        }
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
      if (newPhotos.length === 4) {
        Promise.all(newPhotos.map(p => applyFilterToImage(p, selectedFilter)))
          .then(filtered => setFilteredPhotos(filtered));
        setCurrentScreen('strip');
      }
    };
    reader.readAsDataURL(file);
  };

  const startUpload = () => {
    setPhotos([]);
    setFilteredPhotos([]);
    setUploadStep(0);
    setCurrentScreen('upload');
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const downloadPNG = async () => {
    if (stripRef.current) {
      const canvas = await html2canvas(stripRef.current, {
        scale: 3,
        backgroundColor: '#f5efe8',
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = 'photostrip.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const downloadPDF = async () => {
    if (stripRef.current) {
      const canvas = await html2canvas(stripRef.current, {
        scale: 3,
        backgroundColor: '#f5efe8',
        logging: false,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      
      let finalWidth = pdfWidth - 30;
      let finalHeight = finalWidth / ratio;
      
      if (finalHeight > pdfHeight - 30) {
        finalHeight = pdfHeight - 30;
        finalWidth = finalHeight * ratio;
      }
      
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save('photostrip.pdf');
    }
  };

  const reset = () => {
    setPhotos([]);
    setFilteredPhotos([]);
    setCurrentScreen('modeSelect');
    setCountdown(null);
    setIsCameraReady(false);
    setIsCapturing(false);
  };

  // Privacy Policy Modal Component
  const PrivacyModal = () => (
    <AnimatePresence>
      {showPrivacy && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowPrivacy(false)}
        >
          <motion.div 
            className="bg-[#f5efe8] rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-[#e0d5c5] p-4">
              <h2 className="text-xl font-light text-[#2c1a0e] tracking-wide" style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}>
                Privacy & Safety
              </h2>
            </div>
            
            {/* Modal Content */}
            <div className="p-5 space-y-4 text-[#2c1a0e]/80 text-sm leading-relaxed">
              <p>
                <strong className="text-[#2c1a0e]">Your Privacy Matters</strong><br />
                Photobooth Studio is designed with your privacy as the highest priority.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">No Data Storage</strong><br />
                This application does not store, save, or upload any of your photos. 
                All images exist only in your browser's temporary memory and are 
                permanently deleted when you close the page or refresh.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">No Backend Server</strong><br />
                There is no backend server, no database, and no third-party API calls. 
                Everything runs locally in your browser.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">Camera Access</strong><br />
                Camera access is requested only when you click "USE CAMERA" and is 
                handled by your browser's native permission system. We never have 
                access to your camera feed outside this session.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">No Tracking</strong><br />
                This app uses no cookies, no analytics, no tracking pixels, and no 
                advertising. Your activity is completely private.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">Downloads Stay on Your Device</strong><br />
                When you download your photostrip as PNG or PDF, the file is saved 
                directly to your device. It is never transmitted anywhere.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">Deployment</strong><br />
                This application is deployed on Vercel, a secure and trusted hosting 
                platform. Vercel does not have access to your photos or data.
              </p>
              
              <p>
                <strong className="text-[#2c1a0e]">Open Source</strong><br />
                The complete source code is available on GitHub for transparency and 
                verification.
              </p>
              
              <div className="pt-4 text-center italic text-[#8B7355]">
                <p>build with love, amo</p>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-[#e0d5c5] p-4 flex justify-end">
              <button
                onClick={() => setShowPrivacy(false)}
                className="px-5 py-1.5 bg-[#2c1a0e] text-white rounded-full text-sm hover:bg-[#4a3020] transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ========== LANDING SCREEN ==========
  if (currentScreen === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5efe8] px-4 relative">
        
        {/* Privacy Button - Top Right Corner */}
        <button
          onClick={() => setShowPrivacy(true)}
          className="fixed top-4 right-4 text-[#8B7355] text-xs tracking-wider hover:text-[#2c1a0e] transition-colors duration-200"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Privacy
        </button>
        
        <PrivacyModal />
        
        <div className="mb-10 w-60">
          <div className="bg-[#f0e8dc] rounded-lg shadow-md p-4 border border-[#e0d5c5] min-h-[240px] flex flex-col items-center justify-center">
            {visibleFrames.length < 4 && visibleFrames.length > 0 && (
              <div className="absolute top-2 right-2">
                <div className="text-[8px] text-[#8B7355] animate-pulse">printing...</div>
              </div>
            )}
            <div className="bg-white p-2 rounded-sm shadow-sm">
              <div className="flex flex-col gap-1">
                {[1, 2, 3, 4].map((frameNum) => (
                  <motion.div 
                    key={frameNum}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: visibleFrames.includes(frameNum) ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    {visibleFrames.includes(frameNum) && (
                      <motion.img 
                        src={CAT_PHOTO} 
                        alt="" 
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
        
        <h1 
          className="text-5xl md:text-6xl font-light text-center text-[#2c1a0e] mb-6 tracking-wide"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Photobooth Studio
        </h1>
        
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
    const currentFrame = FRAME_STYLES[selectedFrame];
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5efe8] px-4 py-8 relative">
        
        {/* Privacy Button - Top Right Corner */}
        <button
          onClick={() => setShowPrivacy(true)}
          className="fixed top-4 right-4 text-[#8B7355] text-xs tracking-wider hover:text-[#2c1a0e] transition-colors duration-200 z-20"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Privacy
        </button>
        
        <PrivacyModal />
        
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        
        {/* Filter Toggle */}
        <div className="flex gap-3 mb-6">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedFilter(filter.value)}
              className={`px-5 py-1.5 rounded-full text-xs tracking-wide transition-all duration-200
                ${selectedFilter === filter.value 
                  ? 'bg-[#2c1a0e] text-white shadow-sm' 
                  : 'bg-white/80 text-[#2c1a0e] border border-[#e0d5c5] hover:bg-[#2c1a0e]/5'}`}
            >
              {filter.name}
            </button>
          ))}
        </div>
        
        {/* DOUBLE-LINED BOX */}
        <div className="relative max-w-md w-full">
          <div className="border-2 border-[#2c1a0e] p-2 rounded-lg">
            <div className="border border-[#2c1a0e]/40 p-4 rounded-md bg-white/80">
              
              {/* Photo Slots with Frame Borders */}
              <div className="space-y-3 mb-6">
                {[1, 2, 3, 4].map((num) => (
                  <div key={num} className="w-40 mx-auto flex items-center justify-center">
                    {photos.length >= num ? (
                      <div className={`${currentFrame.borderClass} ${currentFrame.shadowClass} overflow-hidden rounded-sm`}>
                        <img 
                          src={photos[num-1]} 
                          alt={`Photo ${num}`} 
                          className="w-32 h-28 object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`${currentFrame.borderClass} ${currentFrame.shadowClass} w-32 h-28 bg-gray-100 rounded-sm flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300`}>
                        <div className="text-center">
                          <div className="text-xs">Photo {num}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Frame Selection Controls */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <button 
                  onClick={prevFrame} 
                  className="w-10 h-10 rounded-full bg-[#2c1a0e] text-white flex items-center justify-center hover:bg-[#4a3020] transition text-lg"
                >
                  ←
                </button>
                
                <div className="bg-white px-6 py-2 rounded-md shadow-sm border border-[#e0d5c5]">
                  <span className="text-[#2c1a0e] font-light text-base tracking-wide">
                    {currentFrame.name}
                  </span>
                </div>
                
                <button 
                  onClick={nextFrame} 
                  className="w-10 h-10 rounded-full bg-[#2c1a0e] text-white flex items-center justify-center hover:bg-[#4a3020] transition text-lg"
                >
                  →
                </button>
              </div>
              
              {/* Small frame preview indicators */}
              <div className="flex justify-center gap-2 mt-3">
                {FRAME_STYLES.map((frame, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setSelectedFrame(idx)}
                    className={`w-5 h-5 rounded-sm cursor-pointer transition-all ${frame.borderClass} ${selectedFrame === idx ? 'ring-1 ring-[#2c1a0e] ring-offset-1' : 'opacity-50'}`}
                    title={frame.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={() => {
              setPhotos([]);
              setFilteredPhotos([]);
              setCountdown(null);
              setIsCameraReady(false);
              setIsCapturing(false);
              setCurrentScreen('camera');
            }}
            className="px-6 py-2.5 bg-[#2c1a0e] text-white rounded-full text-sm hover:bg-[#4a3020] transition-all duration-300 shadow-sm min-w-[150px]"
          >
            USE CAMERA
          </button>
          <button
            onClick={startUpload}
            className="px-6 py-2.5 bg-[#2c1a0e] text-white rounded-full text-sm hover:bg-[#4a3020] transition-all duration-300 shadow-sm min-w-[150px]"
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
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4 relative">
        
        {/* Privacy Button - Top Right Corner */}
        <button
          onClick={() => setShowPrivacy(true)}
          className="fixed top-4 right-4 text-[#8B7355] text-xs tracking-wider hover:text-[#2c1a0e] transition-colors duration-200 z-20"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Privacy
        </button>
        
        <PrivacyModal />
        
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
        <button onClick={() => { setPhotos([]); setFilteredPhotos([]); setCountdown(null); setIsCameraReady(false); setIsCapturing(false); setCurrentScreen('modeSelect'); }} className="mt-4 text-gray-400 underline text-xs">← Back</button>
      </div>
    );
  }

  // ========== UPLOAD SCREEN ==========
  if (currentScreen === 'upload') {
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4 relative">
        
        {/* Privacy Button - Top Right Corner */}
        <button
          onClick={() => setShowPrivacy(true)}
          className="fixed top-4 right-4 text-[#8B7355] text-xs tracking-wider hover:text-[#2c1a0e] transition-colors duration-200 z-20"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Privacy
        </button>
        
        <PrivacyModal />
        
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        <div className="flex gap-4 mb-6">
          {[1,2,3,4].map(num => <div key={num} className={`w-16 h-16 rounded-lg border flex items-center justify-center text-sm overflow-hidden ${photos.length >= num ? 'border-green-500' : 'bg-white border-gray-300'}`}>{photos.length >= num ? <img src={photos[num-1]} className="w-full h-full object-cover" /> : num}</div>)}
        </div>
        <p className="text-[#2c1a0e] text-sm mb-4">{uploadStep < 4 ? `Select Photo ${uploadStep + 1}` : 'Complete!'}</p>
        {uploadStep < 4 && <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-[#2c1a0e] text-white rounded-full text-sm">Choose Photo</button>}
        <button onClick={() => { setPhotos([]); setFilteredPhotos([]); setUploadStep(0); setCurrentScreen('modeSelect'); }} className="mt-4 text-gray-400 underline text-xs">← Back</button>
      </div>
    );
  }

  // ========== STRIP SCREEN ==========
  if (currentScreen === 'strip' && photos.length === 4) {
    const frameStyle = FRAME_STYLES[selectedFrame];
    const imagesToShow = filteredPhotos.length === 4 ? filteredPhotos : photos;
    
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4 relative">
        
        {/* Privacy Button - Top Right Corner */}
        <button
          onClick={() => setShowPrivacy(true)}
          className="fixed top-4 right-4 text-[#8B7355] text-xs tracking-wider hover:text-[#2c1a0e] transition-colors duration-200 z-20"
          style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}
        >
          Privacy
        </button>
        
        <PrivacyModal />
        
        <div ref={stripRef} className="bg-white p-4 shadow-md rounded-sm">
          <div className="space-y-2">
            {imagesToShow.map((photo, idx) => (
              <div key={idx} className={`${frameStyle.borderClass} ${frameStyle.shadowClass} overflow-hidden rounded-sm`}>
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-40 h-32 object-cover" />
              </div>
            ))}
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