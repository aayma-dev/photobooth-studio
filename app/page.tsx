'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';

const FRAME_STYLES = [
  { name: 'Classic', borderClass: 'border-4 border-[#2c1a0e]', shadowClass: 'shadow-md' },
  { name: 'Vintage', borderClass: 'border-8 border-[#8B7355]', shadowClass: 'shadow-lg' },
  { name: 'Minimal', borderClass: 'border-2 border-gray-400', shadowClass: 'shadow-sm' },
  { name: 'Film', borderClass: 'border-4 border-black', shadowClass: 'shadow-xl' },
];

const FILTERS = [
  { name: 'NORMAL', value: 'normal' },
  { name: 'B&W', value: 'bw' },
  { name: 'VINTAGE', value: 'vintage' },
];

const CAT_PHOTO = 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=80&h=100&fit=crop';

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
            
            tr = tr * 0.85 + 25;
            tg = tg * 0.85 + 20;
            tb = tb * 0.85 + 15;
            
            tr = tr * 0.95;
            tg = tg * 0.92;
            tb = tb * 0.88;
            
            data[i] = Math.min(235, Math.max(20, tr));
            data[i+1] = Math.min(215, Math.max(15, tg));
            data[i+2] = Math.min(180, Math.max(10, tb));
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
    const noiseNode = ctx.createScriptProcessor(4096, 1, 1);
    const gainNode = ctx.createGain();
    noiseNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < 4096; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.15;
      }
    };
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    setTimeout(() => noiseNode.disconnect(), 200);
  };

  const playPrintSound = () => {
    const ctx = initAudio();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 200;
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  };

  return { playShutter, playPrintSound, initAudio };
};

const CropModal = ({ image, onCropComplete, onClose }: { image: string; onCropComplete: (croppedImage: string) => void; onClose: () => void }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const getCroppedImage = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = image;
      await new Promise((resolve) => { img.onload = resolve; });
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      ctx!.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0, 0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      onCropComplete(canvas.toDataURL('image/jpeg'));
    } catch (e) {
      onCropComplete(image);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-lg max-w-md w-full mx-auto overflow-hidden">
        <div className="p-4 border-b"><h3 className="text-lg font-light">Crop Photo</h3></div>
        <div className="relative w-full h-64">
          <Cropper image={image} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_: any, pixels: any) => setCroppedAreaPixels(pixels)} />
        </div>
        <div className="p-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1 border rounded-full text-sm">Cancel</button>
          <button onClick={getCroppedImage} className="px-4 py-1 bg-[#2c1a0e] text-white rounded-full text-sm">Apply</button>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'modeSelect' | 'camera' | 'upload' | 'printing' | 'strip'>('landing');
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [photos, setPhotos] = useState<string[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [printingComplete, setPrintingComplete] = useState(false);
  const [landingFrames, setLandingFrames] = useState<number[]>([]);
  const [showLandingNote, setShowLandingNote] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStep, setUploadStep] = useState(0);
  const { playShutter, playPrintSound, initAudio } = usePhotoboothSounds();
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    if (currentScreen === 'landing') {
      setLandingFrames([]);
      setShowLandingNote(false);
      const handleFirstClick = () => { initAudio(); document.removeEventListener('click', handleFirstClick); };
      document.addEventListener('click', handleFirstClick);
      setTimeout(() => { playPrintSound(); setLandingFrames([1]); }, 800);
      setTimeout(() => { playPrintSound(); setLandingFrames([1, 2]); }, 1600);
      setTimeout(() => { playPrintSound(); setLandingFrames([1, 2, 3]); }, 2400);
      setTimeout(() => { playPrintSound(); setLandingFrames([1, 2, 3, 4]); }, 3200);
      setTimeout(() => { setShowLandingNote(true); playPrintSound(); }, 4000);
      return () => document.removeEventListener('click', handleFirstClick);
    }
  }, [currentScreen]);

  useEffect(() => {
    const applyFilters = async () => {
      if (photos.length === 4) {
        const filtered = await Promise.all(photos.map(p => applyFilterToImage(p, selectedFilter)));
        setFilteredPhotos(filtered);
      }
    };
    applyFilters();
  }, [selectedFilter, photos]);

  useEffect(() => {
    if (currentScreen === 'printing') {
      setPrintingComplete(false);
      playPrintSound();
      const timer = setTimeout(() => { setPrintingComplete(true); playPrintSound(); }, 3000);
      return () => clearTimeout(timer);
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
          Promise.all(newPhotos.map(p => applyFilterToImage(p, selectedFilter))).then(filtered => setFilteredPhotos(filtered));
          setCurrentScreen('printing');
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
    if (!isCameraReady) { alert('Camera is initializing. Please wait.'); return; }
    if (!isCapturing) startCountdown();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage(e.target?.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedImage: string) => {
    const newPhotos = [...photos, croppedImage];
    setPhotos(newPhotos);
    setUploadStep(newPhotos.length);
    setShowCropModal(false);
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (newPhotos.length === 4) {
      Promise.all(newPhotos.map(p => applyFilterToImage(p, selectedFilter))).then(filtered => setFilteredPhotos(filtered));
      setCurrentScreen('printing');
    }
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
      const canvas = await html2canvas(stripRef.current, { scale: 3, backgroundColor: '#f5efe8' });
      const link = document.createElement('a');
      link.download = 'photostrip.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const downloadPDF = async () => {
    if (stripRef.current) {
      const canvas = await html2canvas(stripRef.current, { scale: 3, backgroundColor: '#f5efe8' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let finalWidth = pdfWidth - 30;
      let finalHeight = finalWidth / ratio;
      if (finalHeight > pdfHeight - 30) { finalHeight = pdfHeight - 30; finalWidth = finalHeight * ratio; }
      pdf.addImage(imgData, 'PNG', (pdfWidth - finalWidth) / 2, (pdfHeight - finalHeight) / 2, finalWidth, finalHeight);
      pdf.save('photostrip.pdf');
    }
  };

  const reset = () => {
    setPhotos([]);
    setFilteredPhotos([]);
    setPrintingComplete(false);
    setCurrentScreen('modeSelect');
    setCountdown(null);
    setIsCameraReady(false);
    setIsCapturing(false);
  };

  const PrivacyModal = () => (
    <AnimatePresence>
      {showPrivacy && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrivacy(false)}>
          <motion.div className="bg-[#f5efe8] rounded-lg shadow-xl max-w-md w-full mx-auto max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-[#e0d5c5] p-4 sticky top-0 bg-[#f5efe8]"><h2 className="text-xl font-light text-[#2c1a0e]">Privacy & Safety</h2></div>
            <div className="p-5 space-y-4 text-[#2c1a0e]/80 text-sm leading-relaxed">
              <p><strong className="text-[#2c1a0e]">No Data Storage</strong><br />This application does not store, save, or upload any of your photos. All images exist only in your browser's temporary memory and are permanently deleted when you close the page.</p>
              <p><strong className="text-[#2c1a0e]">No Backend Server</strong><br />There is no backend server, no database, and no third-party API calls. Everything runs locally in your browser.</p>
              <p><strong className="text-[#2c1a0e]">Camera Access</strong><br />Camera access is requested only when you click "USE CAMERA" and is handled by your browser's native permission system.</p>
              <p><strong className="text-[#2c1a0e]">No Tracking</strong><br />This app uses no cookies, no analytics, no tracking pixels, and no advertising.</p>
              <p><strong className="text-[#2c1a0e]">Downloads Stay on Your Device</strong><br />When you download your photostrip, the file is saved directly to your device. It is never transmitted anywhere.</p>
              <p><strong className="text-[#2c1a0e]">Deployment</strong><br />This application is deployed on Vercel, a secure hosting platform. Vercel does not have access to your photos or data.</p>
              <p><strong className="text-[#2c1a0e]">Open Source</strong><br />The complete source code is available on GitHub for transparency.</p>
              <div className="pt-4 text-center italic text-[#8B7355]">build with love, amo</div>
            </div>
            <div className="border-t border-[#e0d5c5] p-4 sticky bottom-0 bg-[#f5efe8] flex justify-end"><button onClick={() => setShowPrivacy(false)} className="px-5 py-1.5 bg-[#2c1a0e] text-white rounded-full text-sm">Close</button></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // LANDING SCREEN - Mobile responsive
  if (currentScreen === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5efe8] px-4 py-8 relative">
        <button onClick={() => setShowPrivacy(true)} className="fixed top-4 right-4 text-[#8B7355] text-xs tracking-wider hover:text-[#2c1a0e] transition-colors z-30">Privacy</button>
        <PrivacyModal />
        <div className="mb-8 w-48 sm:w-60">
          <div className="bg-[#f0e8dc] rounded-lg shadow-md p-3 sm:p-4 border border-[#e0d5c5] min-h-[200px] sm:min-h-[240px] flex flex-col items-center justify-center">
            <div className="bg-white p-1.5 sm:p-2 rounded-sm shadow-sm">
              <div className="flex flex-col gap-0.5 sm:gap-1">
                {[1, 2, 3, 4].map((num) => (
                  <motion.div key={num} initial={{ opacity: 0, y: 20 }} animate={{ opacity: landingFrames.includes(num) ? 1 : 0, y: landingFrames.includes(num) ? 0 : 20 }} transition={{ duration: 0.5 }}>
                    {landingFrames.includes(num) && (
                      <div className="relative overflow-hidden">
                        <img src={CAT_PHOTO} alt="" className="w-10 h-12 sm:w-14 sm:h-16 object-cover rounded-sm" style={{ filter: 'grayscale(0.8) sepia(0.2) contrast(1.1)' }} />
                        <motion.div className="absolute inset-0 bg-white" initial={{ x: 0 }} animate={{ x: '100%' }} transition={{ duration: 0.4, delay: 0.1 }} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            <AnimatePresence>
              {showLandingNote && (
                <motion.div className="mt-2 sm:mt-3 bg-[#fef8e8] p-1.5 sm:p-2 rounded-sm shadow-sm max-w-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  <p className="text-[#2c1a0e] text-[7px] sm:text-[8px] font-serif italic text-center leading-relaxed">welcome to photobooth-studio,<br />a place where you can create memories,<br />build with love, amo</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-light text-center text-[#2c1a0e] mb-4 sm:mb-6 tracking-wide px-2" style={{ fontFamily: "'Times New Roman', 'Georgia', serif" }}>Photobooth Studio</h1>
        <button onClick={() => { initAudio(); setCurrentScreen('modeSelect'); }} className="px-6 sm:px-8 py-2 sm:py-2.5 bg-[#2c1a0e] text-[#f5efe8] rounded-full text-sm tracking-wider hover:bg-[#4a3020] transition-all">ENTER</button>
      </div>
    );
  }

  // MODE SELECTION SCREEN - Mobile responsive
  if (currentScreen === 'modeSelect') {
    const currentFrame = FRAME_STYLES[selectedFrame];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5efe8] px-3 sm:px-4 py-6 sm:py-8 relative">
        <button onClick={() => setShowPrivacy(true)} className="fixed top-4 right-4 text-[#8B7355] text-xs z-30">Privacy</button>
        <PrivacyModal />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        {showCropModal && pendingImage && <CropModal image={pendingImage} onCropComplete={handleCropComplete} onClose={() => setShowCropModal(false)} />}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          {FILTERS.map(f => <button key={f.value} onClick={() => setSelectedFilter(f.value)} className={`px-3 sm:px-5 py-1 rounded-full text-[10px] sm:text-xs ${selectedFilter === f.value ? 'bg-[#2c1a0e] text-white' : 'bg-white/80 text-[#2c1a0e] border border-[#e0d5c5]'}`}>{f.name}</button>)}
        </div>
        <div className="border-2 border-[#2c1a0e] p-1.5 sm:p-2 rounded-lg w-full max-w-md">
          <div className="border border-[#2c1a0e]/40 p-2 sm:p-4 rounded-md bg-white/80">
            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="mx-auto flex justify-center">
                  {photos.length >= num ? (
                    <div className={`${currentFrame.borderClass} ${currentFrame.shadowClass} overflow-hidden rounded-sm w-24 sm:w-32`}>
                      <img src={photos[num-1]} className="w-24 h-20 sm:w-32 sm:h-28 object-cover" />
                    </div>
                  ) : (
                    <div className={`${currentFrame.borderClass} ${currentFrame.shadowClass} w-24 h-20 sm:w-32 sm:h-28 bg-gray-100 rounded-sm flex items-center justify-center text-gray-400 text-xs sm:text-sm`}>
                      Photo {num}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4">
              <button onClick={prevFrame} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2c1a0e] text-white text-sm sm:text-lg">←</button>
              <div className="bg-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-md border border-[#e0d5c5]"><span className="text-[#2c1a0e] text-xs sm:text-base">{currentFrame.name}</span></div>
              <button onClick={nextFrame} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2c1a0e] text-white text-sm sm:text-lg">→</button>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-3">
              {FRAME_STYLES.map((frame, idx) => <div key={idx} onClick={() => setSelectedFrame(idx)} className={`w-3 h-3 sm:w-5 sm:h-5 rounded-sm cursor-pointer ${frame.borderClass} ${selectedFrame === idx ? 'ring-1 ring-[#2c1a0e]' : 'opacity-50'}`} />)}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full max-w-md px-2">
          <button onClick={() => { setPhotos([]); setFilteredPhotos([]); setCountdown(null); setIsCameraReady(false); setIsCapturing(false); setCurrentScreen('camera'); }} className="px-4 py-2 sm:px-6 sm:py-2.5 bg-[#2c1a0e] text-white rounded-full text-xs sm:text-sm w-full">USE CAMERA</button>
          <button onClick={startUpload} className="px-4 py-2 sm:px-6 sm:py-2.5 bg-[#2c1a0e] text-white rounded-full text-xs sm:text-sm w-full">BROWSE PICTURES</button>
        </div>
      </div>
    );
  }

  // CAMERA SCREEN - Mobile responsive
  if (currentScreen === 'camera') {
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-3 sm:p-4 relative">
        <button onClick={() => setShowPrivacy(true)} className="fixed top-4 right-4 text-[#8B7355] text-xs z-30">Privacy</button>
        <PrivacyModal />
        <div className="relative bg-black rounded-xl overflow-hidden shadow-xl w-full max-w-sm">
          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <span className="text-5xl sm:text-6xl text-white font-bold">{countdown}</span>
            </div>
          )}
          <Webcam ref={webcamRef} mirrored screenshotFormat="image/jpeg" className="w-full rounded-xl" onUserMedia={() => setIsCameraReady(true)} onUserMediaError={() => alert('Could not access camera.')} />
          {!isCameraReady && <div className="absolute inset-0 flex items-center justify-center bg-black z-20"><div className="text-white text-center text-sm px-4">Starting camera...</div></div>}
        </div>
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          {[1,2,3,4].map(num => <div key={num} className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-medium ${photos.length >= num ? 'bg-green-500 border-green-400 text-white' : 'bg-white border-[#2c1a0e]/30 text-[#2c1a0e]/50'}`}>{photos.length >= num ? '✓' : num}</div>)}
        </div>
        <button onClick={handleCapture} disabled={photos.length >= 4 || !isCameraReady || isCapturing} className={`mt-4 sm:mt-6 px-6 sm:px-8 py-2 rounded-full text-sm transition-all ${(photos.length >= 4 || !isCameraReady || isCapturing) ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#2c1a0e] text-white hover:scale-105 shadow-md'}`}>{!isCameraReady ? 'Loading...' : isCapturing ? 'Capturing...' : photos.length >= 4 ? 'Complete!' : 'Take Photo'}</button>
        <button onClick={() => { setPhotos([]); setFilteredPhotos([]); setCountdown(null); setIsCameraReady(false); setIsCapturing(false); setCurrentScreen('modeSelect'); }} className="mt-3 text-gray-400 underline text-xs">← Back</button>
      </div>
    );
  }

  // UPLOAD SCREEN - Mobile responsive
  if (currentScreen === 'upload') {
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-3 sm:p-4 relative">
        <button onClick={() => setShowPrivacy(true)} className="fixed top-4 right-4 text-[#8B7355] text-xs z-30">Privacy</button>
        <PrivacyModal />
        {showCropModal && pendingImage && <CropModal image={pendingImage} onCropComplete={handleCropComplete} onClose={() => setShowCropModal(false)} />}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        <div className="flex gap-3 sm:gap-4 mb-4 sm:mb-6 flex-wrap justify-center">
          {[1,2,3,4].map(num => <div key={num} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 flex items-center justify-center text-sm overflow-hidden ${photos.length >= num ? 'border-green-500 bg-white' : 'bg-white border-gray-300 text-[#2c1a0e]/50'}`}>{photos.length >= num ? <img src={photos[num-1]} className="w-full h-full object-cover" /> : num}</div>)}
        </div>
        <p className="text-[#2c1a0e] text-sm mb-4 text-center px-4">{uploadStep < 4 ? `Select Photo ${uploadStep + 1}` : 'Complete!'}</p>
        {uploadStep < 4 && <button onClick={() => fileInputRef.current?.click()} className="px-5 sm:px-6 py-2 bg-[#2c1a0e] text-white rounded-full text-sm">Choose Photo</button>}
        <button onClick={() => { setPhotos([]); setFilteredPhotos([]); setUploadStep(0); setCurrentScreen('modeSelect'); }} className="mt-3 text-gray-400 underline text-xs">← Back</button>
      </div>
    );
  }

  // PRINTING SCREEN - Mobile responsive
  if (currentScreen === 'printing') {
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-4 relative">
        <button onClick={() => setShowPrivacy(true)} className="fixed top-4 right-4 text-[#8B7355] text-xs z-30">Privacy</button>
        <PrivacyModal />
        <div className="text-center w-full max-w-sm px-4">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6">
            <motion.div className="absolute bottom-0 left-0 right-0 bg-white rounded-sm shadow-md overflow-hidden" initial={{ height: 0 }} animate={{ height: printingComplete ? 100 : [0, 30, 60, 100] }} transition={{ duration: 3 }}>
              <div className="p-2 sm:p-3"><div className="w-full h-1 bg-[#e0d5c5] mb-1 sm:mb-2" /><div className="w-3/4 h-1 bg-[#e0d5c5] mb-1 sm:mb-2" /><div className="w-1/2 h-1 bg-[#e0d5c5]" /></div>
            </motion.div>
          </div>
          <h2 className="text-xl sm:text-2xl font-light text-[#2c1a0e] mb-2 tracking-wide">Photo is printing</h2>
          <p className="text-[#8B7355] text-xs sm:text-sm mb-4 sm:mb-6">{currentDate}</p>
          {printingComplete && (
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} onClick={() => setCurrentScreen('strip')} className="px-6 sm:px-8 py-2 sm:py-2.5 bg-[#2c1a0e] text-white rounded-full text-sm hover:bg-[#4a3020] transition-all">Collect Photo</motion.button>
          )}
        </div>
      </div>
    );
  }

  // STRIP SCREEN - Mobile responsive
  if (currentScreen === 'strip' && photos.length === 4) {
    const frameStyle = FRAME_STYLES[selectedFrame];
    const imagesToShow = filteredPhotos.length === 4 ? filteredPhotos : photos;
    return (
      <div className="min-h-screen bg-[#f5efe8] flex flex-col items-center justify-center p-3 sm:p-4 relative">
        <button onClick={() => setShowPrivacy(true)} className="fixed top-4 right-4 text-[#8B7355] text-xs z-30">Privacy</button>
        <PrivacyModal />
        <div ref={stripRef} className="bg-white p-3 sm:p-4 shadow-md rounded-sm">
          <div className="space-y-1.5 sm:space-y-2">
            {imagesToShow.map((photo, idx) => (
              <div key={idx} className={`${frameStyle.borderClass} ${frameStyle.shadowClass} overflow-hidden rounded-sm`}>
                <img src={photo} className="w-32 h-28 sm:w-40 sm:h-32 object-cover" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-4 sm:mt-6 px-2">
          <button onClick={downloadPNG} className="px-3 sm:px-5 py-1.5 sm:py-2 bg-[#2c1a0e] text-white rounded-full text-xs sm:text-sm">Download PNG</button>
          <button onClick={downloadPDF} className="px-3 sm:px-5 py-1.5 sm:py-2 bg-[#2c1a0e] text-white rounded-full text-xs sm:text-sm">Download PDF</button>
          <button onClick={reset} className="px-3 sm:px-5 py-1.5 sm:py-2 border border-[#2c1a0e] text-[#2c1a0e] rounded-full text-xs sm:text-sm">New Photos</button>
        </div>
      </div>
    );
  }

  return null;
}