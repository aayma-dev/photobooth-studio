'use client';

import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Frame styles options
const FRAME_STYLES = ['Classic', 'Vintage', 'Minimal', 'Film'];

export default function Home() {
  // Screen state: 'landing' or 'modeSelect'
  const [screen, setScreen] = useState<'landing' | 'modeSelect'>('landing');
  
  // Mode selection state
  const [selectedFrame, setSelectedFrame] = useState(0);
  
  // Camera/Photo states
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showStrip, setShowStrip] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Frame navigation
  const nextFrame = () => {
    setSelectedFrame((prev) => (prev + 1) % FRAME_STYLES.length);
  };

  const prevFrame = () => {
    setSelectedFrame((prev) => (prev - 1 + FRAME_STYLES.length) % FRAME_STYLES.length);
  };

  // Capture one photo
  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const newPhotos = [...photos, imageSrc];
        setPhotos(newPhotos);
        if (newPhotos.length === 4) {
          setShowStrip(true);
        }
      }
    }
  };

  // Countdown before capture
  const startCountdown = async () => {
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);
    capturePhoto();
  };

  const handleCapture = async () => {
    if (photos.length >= 4) return;
    await startCountdown();
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
    setShowStrip(false);
    setShowCamera(false);
  };

  // Landing Page
  if (screen === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf6f0] px-4">
        {/* Main Title */}
        <h1 
          className="text-5xl md:text-6xl font-light italic text-center text-[#3d2b1a] mb-12 tracking-wide"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >
          Photobooth Studio
        </h1>
        
        {/* Enter Button */}
        <button
          onClick={() => setScreen('modeSelect')}
          className="px-10 py-3 bg-[#3d2b1a] text-[#faf6f0] rounded-full
                     hover:bg-[#5a3d2a] hover:scale-105 transition-all duration-300
                     shadow-md text-lg tracking-wide"
        >
          ENTER
        </button>
      </div>
    );
  }

  // Mode Selection Page with Photo Strip
  if (screen === 'modeSelect' && !showCamera && !showStrip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf6f0] px-4 py-8">
        
        {/* Double-lined Box */}
        <div className="double-lined-box max-w-md w-full">
          <div className="double-lined-box-inner">
            
            {/* Vertical 4-Photo Strip Preview */}
            <div className="space-y-3 mb-6">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className="w-48 h-32 bg-gray-100 rounded-sm mx-auto flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300"
                >
                  📷 Photo {num}
                </div>
              ))}
            </div>
            
            {/* Frame Selection Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={prevFrame}
                className="w-10 h-10 rounded-full bg-[#3d2b1a] text-white flex items-center justify-center hover:bg-[#5a3d2a] transition"
              >
                ←
              </button>
              <span className="text-[#3d2b1a] font-medium min-w-[80px] text-center">
                {FRAME_STYLES[selectedFrame]}
              </span>
              <button
                onClick={nextFrame}
                className="w-10 h-10 rounded-full bg-[#3d2b1a] text-white flex items-center justify-center hover:bg-[#5a3d2a] transition"
              >
                →
              </button>
            </div>
          </div>
        </div>
        
        {/* Two Buttons Below */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={() => setShowCamera(true)}
            className="px-8 py-3 bg-[#3d2b1a] text-[#faf6f0] rounded-full
                       hover:bg-[#5a3d2a] hover:scale-105 transition-all duration-300
                       shadow-md min-w-[180px]"
          >
            USE CAMERA
          </button>
          <button
            className="px-8 py-3 border-2 border-[#3d2b1a] text-[#3d2b1a] rounded-full
                       hover:bg-[#3d2b1a] hover:text-[#faf6f0] transition-all duration-300
                       min-w-[180px]"
          >
            BROWSE PICTURES
          </button>
        </div>
      </div>
    );
  }

  // Camera Page (taking 4 photos)
  if (showCamera && !showStrip) {
    return (
      <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-6">
        {/* Camera Container */}
        <div className="relative bg-black rounded-xl overflow-hidden shadow-xl">
          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <span className="text-8xl text-white font-bold countdown-number">{countdown}</span>
            </div>
          )}
          <Webcam
            ref={webcamRef}
            mirrored
            screenshotFormat="image/jpeg"
            className="w-80 rounded-xl"
          />
        </div>

        {/* Photo Slots */}
        <div className="flex gap-3 mt-6">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-medium
                ${photos.length >= num
                  ? 'bg-green-500 border-green-400 text-white'
                  : 'bg-white border-[#3d2b1a]/30 text-[#3d2b1a]/50'}`}
            >
              {photos.length >= num ? '✓' : num}
            </div>
          ))}
        </div>

        {/* Capture Button */}
        <button
          onClick={handleCapture}
          disabled={photos.length >= 4}
          className={`mt-6 px-8 py-3 rounded-full text-lg font-medium transition-all
            ${photos.length >= 4
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#3d2b1a] text-[#faf6f0] hover:scale-105 hover:bg-[#5a3d2a] shadow-md'}`}
        >
          {photos.length >= 4 ? 'Complete!' : 'Take Photo'}
        </button>

        {/* Back Button */}
        <button
          onClick={() => {
            setShowCamera(false);
            setPhotos([]);
          }}
          className="mt-4 text-[#3d2b1a]/60 underline text-sm hover:text-[#3d2b1a] transition"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Photo Strip Result Page
  if (showStrip && photos.length === 4) {
    return (
      <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-6">
        {/* Photo Strip */}
        <div ref={stripRef} className="bg-white p-6 shadow-xl">
          <div className="space-y-4">
            {photos.map((photo, idx) => (
              <img
                key={idx}
                src={photo}
                alt={`Photo ${idx + 1}`}
                className="w-64 rounded-sm shadow-md"
              />
            ))}
          </div>
        </div>

        {/* Download Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={downloadPNG}
            className="px-6 py-2 bg-[#3d2b1a] text-[#faf6f0] rounded-full hover:bg-[#5a3d2a] transition"
          >
            Download PNG
          </button>
          <button
            onClick={downloadPDF}
            className="px-6 py-2 bg-[#3d2b1a] text-[#faf6f0] rounded-full hover:bg-[#5a3d2a] transition"
          >
            Download PDF
          </button>
          <button
            onClick={reset}
            className="px-6 py-2 border border-[#3d2b1a] text-[#3d2b1a] rounded-full hover:bg-[#3d2b1a]/10 transition"
          >
            Take New Photos
          </button>
        </div>
      </div>
    );
  }

  return null;
}