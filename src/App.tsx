import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, X, Edit, Sliders } from 'lucide-react';

const defaultWords = [
  "思绪理不清,前一件还没有理完,新的就出现了；",
  "睡不着的觉,睡着了却又很难醒；祝你先于春天，",
  "翻过此间铮铮山峦；",
  "",
  "通往夏天的隧道,是再见的路口；",
  "风吹拂树叶的那一刻，焦虑都消失了；",
  "打出来的字总是删删减减；",
  "",
  "夏天的燥热；",
  "让吃西瓜吹空调的我感到一丝凉爽；",
  "世界这么大，总要和朋友出去看看；",
  "在暴风雨来临时，呆在家里的自由感，让我放松；",
  "",
  "昏暗的路灯下，我牵着爸爸妈妈的手，一起走在回家的路上；"
];

const pixelCache = new Map<string, HTMLCanvasElement>();

function getPixelText(char: string, hexColor: string): HTMLCanvasElement {
  const baseFontSize = 14;
  const key = `${char}-${hexColor}`;
  if (pixelCache.has(key)) return pixelCache.get(key)!;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  canvas.width = baseFontSize * 2;
  canvas.height = baseFontSize * 2;
  ctx.font = `bold ${baseFontSize}px "SimSun", "Noto Sans SC", monospace`; 
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  ctx.fillText(char, 2, 2);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = canvas.width;
  outCanvas.height = canvas.height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return outCanvas;

  outCtx.fillStyle = hexColor;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 80) {
        outCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  pixelCache.set(key, outCanvas);
  return outCanvas;
}

class Letter {
  letter: string; x: number; y: number; dt: number; a: number = 255;
  aSpeed: number; initTime: number; dx: number; dy: number;
  image: HTMLCanvasElement; scale: number; fontStyle: string;
  hexColor: string; fontSize: number;

  constructor(letter: string, x: number, y: number, dt: number, initTime: number, hexColor: string, sizeScale: number, fontStyle: string, fontSize: number) {
    this.letter = letter; this.x = x; this.y = y; this.dt = dt;
    this.aSpeed = 1 + Math.random() * 2; this.initTime = initTime;
    this.dx = 6; this.dy = -2 + Math.random() * 4;
    this.scale = sizeScale; this.fontStyle = fontStyle;
    this.hexColor = hexColor; this.fontSize = fontSize;
    this.image = getPixelText(letter, hexColor);
  }

  display(ctx: CanvasRenderingContext2D, shadowColor: string, shadowBlur: number, shadowOffsetX: number, shadowOffsetY: number, offsetX: number, offsetY: number) {
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    ctx.globalAlpha = Math.max(0, this.a / 255);
    
    if (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowOffsetX;
      ctx.shadowOffsetY = shadowOffsetY;
    }

    if (this.fontStyle === 'pixel') {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.image, 0, -this.image.height * this.scale * 0.75, this.image.width * this.scale, this.image.height * this.scale);
    } else {
      ctx.font = `${this.fontSize}px "Long Cang", "Noto Serif SC", serif`;
      ctx.fillStyle = this.hexColor;
      ctx.fillText(this.letter, 0, 0);
    }
    ctx.restore();
  }

  update(currentTime: number, width: number, height: number) {
    if (currentTime - this.initTime > this.dt) {
      this.a -= this.aSpeed; this.x += this.dx; this.y += this.dy;
      if (this.x < 0 || this.x > width) this.dx *= -1;
      if (this.y < 0 || this.y > height) this.dy *= -1;
    }
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('large');
  const [speed, setSpeed] = useState<number>(100);
  const [textColor, setTextColor] = useState<string>('#ed225e');
  const [text, setText] = useState<string>(defaultWords.join('\n'));
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [fontstyle, setFontstyle] = useState<'handwritten' | 'pixel'>('handwritten');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(0);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(0);
  const [isShadowEnabled, setIsShadowEnabled] = useState(false);
  const [exportRes, setExportRes] = useState<'720p' | '1080p'>('1080p');
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  const saveScene = () => {
    const sceneData = {
      size, speed, textColor, text, letterSpacing, fontstyle,
      offsetX, offsetY, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY,
      isShadowEnabled, addedLines: linesConfig.current.addedLines,
      exportRes, aspectRatio, imgFormat
    };
    try {
      localStorage.setItem('notebookScene', JSON.stringify(sceneData));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e) {
      console.error('Save failed', e);
    }
  };

  const loadScene = () => {
    const saved = localStorage.getItem('notebookScene');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.size !== undefined) setSize(d.size);
        if (d.speed !== undefined) setSpeed(d.speed);
        if (d.textColor !== undefined) setTextColor(d.textColor);
        if (d.text !== undefined) setText(d.text);
        if (d.letterSpacing !== undefined) setLetterSpacing(d.letterSpacing);
        if (d.fontstyle !== undefined) setFontstyle(d.fontstyle);
        if (d.offsetX !== undefined) setOffsetX(d.offsetX);
        if (d.offsetY !== undefined) setOffsetY(d.offsetY);
        if (d.shadowColor !== undefined) setShadowColor(d.shadowColor);
        if (d.shadowBlur !== undefined) setShadowBlur(d.shadowBlur);
        if (d.shadowOffsetX !== undefined) setShadowOffsetX(d.shadowOffsetX);
        if (d.shadowOffsetY !== undefined) setShadowOffsetY(d.shadowOffsetY);
        if (d.isShadowEnabled !== undefined) setIsShadowEnabled(d.isShadowEnabled);
        if (d.addedLines !== undefined) linesConfig.current.addedLines = d.addedLines;
        if (d.exportRes !== undefined) setExportRes(d.exportRes);
        if (d.aspectRatio !== undefined) setAspectRatio(d.aspectRatio);
        if (d.imgFormat !== undefined) setImgFormat(d.imgFormat);
        setSaveStatus('loaded');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (e) {
        console.error('Load failed', e);
      }
    } else {
      setSaveStatus('no_data');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);

  const [linesToAdd, setLinesToAdd] = useState(5);
  const linesConfig = useRef({ addedLines: 0, lastAddedLines: 0 });

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const getExportDimensions = (ratio: string, res: string) => {
    const base = res === '1080p' ? 1080 : 720;
    switch (ratio) {
      case '16:9': return { w: Math.round(base * 16/9), h: base };
      case '9:16': return { w: base, h: Math.round(base * 16/9) };
      case '4:3': return { w: Math.round(base * 4/3), h: base };
      case '3:4': return { w: base, h: Math.round(base * 4/3) };
      case '1:1': return { w: base, h: base };
      case 'A4': return { w: base, h: Math.round(base * 297/210) };
      case 'A3': return res === '1080p' ? { w: 1527, h: 2160 } : { w: 1018, h: 1440 };
      default: return { w: base, h: base };
    }
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const type = imgFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = imgFormat === 'jpeg' ? 0.95 : undefined;
    const dataUrl = canvas.toDataURL(type, quality);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `notebook-${Date.now()}.${imgFormat === 'jpeg' ? 'jpg' : 'png'}`;
    a.click();
  };

  const startRecording = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setIsRecording(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const stream = canvas.captureStream(60);
      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');
      let options: MediaRecorderOptions = { mimeType };
      
      try {
        options.videoBitsPerSecond = 8000000;
        const testRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        options = { mimeType }; // fallback if bitrate causes issue
      }
      
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notebook-animation-${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        URL.revokeObjectURL(url);
      };
      
      recorder.start();
    }, 300);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const realTimeOpts = useRef({
    offsetX, offsetY, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, isShadowEnabled
  });

  useEffect(() => {
    realTimeOpts.current = { offsetX, offsetY, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, isShadowEnabled };
  }, [offsetX, offsetY, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, isShadowEnabled]);

  const [debouncedText, setDebouncedText] = useState(text);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedText(text); }, 600);
    return () => clearTimeout(handler);
  }, [text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let letters: Letter[] = [];
    
    let logicalWidth = window.innerWidth;
    let logicalHeight = window.innerHeight;
    let spaceInGrid = 60, fontSize = 32, originX = 100, originY = 100, redLineOffsetX = -30, textScale = 1;
    let dpr = window.devicePixelRatio || 1;
    const wordsArray = debouncedText.split('\n');

    const calculateSizes = () => {
      const isMobile = window.innerWidth < 640;
      originX = isMobile ? 40 : 100;
      originY = isMobile ? 60 : 100;
      redLineOffsetX = isMobile ? -20 : -30;

      let dim = { w: window.innerWidth, h: window.innerHeight };
      if (aspectRatio !== 'auto') {
        dim = getExportDimensions(aspectRatio, exportRes);
      }

      const availableWidth = dim.w - originX - (isMobile ? 16 : 40);
      const maxWordLength = Math.max(1, ...wordsArray.map(w => w.length));

      const baseSpaceInGrid = size === 'small' ? 30 : size === 'medium' ? 45 : 60;
      const baseFontSize = size === 'small' ? 18 : size === 'medium' ? 24 : 32;

      let scale = 1;
      const maxNeededWidth = maxWordLength * (baseSpaceInGrid / 2.0 + letterSpacing);
      if (maxNeededWidth > availableWidth && availableWidth > 0) scale = availableWidth / maxNeededWidth;

      spaceInGrid = baseSpaceInGrid * scale;
      fontSize = baseFontSize * Math.max(0.4, scale);
      textScale = fontSize / 14; 
      
      const numLines = wordsArray.length + 8 + linesConfig.current.addedLines;
      
      if (aspectRatio === 'auto') {
        logicalWidth = window.innerWidth;
        logicalHeight = Math.max(window.innerHeight, originY + spaceInGrid * numLines + 100);
        dpr = window.devicePixelRatio || 1;
      } else {
        logicalWidth = dim.w;
        logicalHeight = dim.h;
        dpr = 1;
      }
      
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      
      if (aspectRatio === 'auto') {
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;
        canvas.style.maxWidth = 'none';
        canvas.style.maxHeight = 'none';
        canvas.style.objectFit = 'fill';
      } else {
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.maxWidth = '90%';
        canvas.style.maxHeight = '85vh';
        canvas.style.objectFit = 'contain';
      }
    };

    const initLetters = (time: number) => {
      letters = [];
      let y = 0;
      for (let i = 0; i < wordsArray.length; i++) {
        let x = 0;
        let dt = 2000 + i * 500;
        for (let j = 0; j < wordsArray[i].length; j++) {
          dt += speed; 
          letters.push(new Letter(wordsArray[i].charAt(j), x + originX, y + originY - spaceInGrid / 6, dt, time, textColor, textScale, fontstyle, fontSize));
          x += (spaceInGrid / 2.0) + letterSpacing; 
        }
        y += spaceInGrid;
      }
    };

    let prevWidth = window.innerWidth;
    const handleResize = () => {
      if (isRecordingRef.current) return;
      if (Math.abs(window.innerWidth - prevWidth) > 10) {
        calculateSizes();
        initLetters(performance.now());
        prevWidth = window.innerWidth;
      } else {
        calculateSizes();
      }
    };

    calculateSizes();
    initLetters(performance.now());
    window.addEventListener('resize', handleResize);

    const drawBg = () => {
      ctx.fillStyle = '#fdfaf6';
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      ctx.save();
      ctx.translate(originX, originY);
      ctx.strokeStyle = '#e2e2e2'; ctx.lineWidth = 1;

      const numLines = wordsArray.length + 8 + linesConfig.current.addedLines;
      for (let i = 0; i < numLines; i++) {
        ctx.beginPath(); ctx.moveTo(-originX, spaceInGrid * i);
        ctx.lineTo(logicalWidth - originX, spaceInGrid * i); ctx.stroke();
      }
      ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(redLineOffsetX, -originY);
      ctx.lineTo(redLineOffsetX, Math.max(logicalHeight, spaceInGrid * (numLines - 1))); ctx.stroke();
      ctx.restore();
    };

    let restartTimer = 0;
    const render = (time: number) => {
      if (linesConfig.current.addedLines !== linesConfig.current.lastAddedLines) {
        linesConfig.current.lastAddedLines = linesConfig.current.addedLines;
        calculateSizes();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawBg();
      const { shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, offsetX, offsetY, isShadowEnabled } = realTimeOpts.current;
      for (let i = letters.length - 1; i >= 0; i--) {
        letters[i].display(
          ctx, 
          isShadowEnabled ? shadowColor : 'transparent', 
          isShadowEnabled ? shadowBlur : 0, 
          isShadowEnabled ? shadowOffsetX : 0, 
          isShadowEnabled ? shadowOffsetY : 0, 
          offsetX, 
          offsetY
        );
        letters[i].update(time, logicalWidth, logicalHeight);
        if (letters[i].a <= 0) letters.splice(i, 1);
      }
      if (letters.length === 0) {
        if (restartTimer === 0) restartTimer = time;
        else if (time - restartTimer > 2000) {
          initLetters(time); restartTimer = 0;
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', handleResize); };
  }, [size, debouncedText, speed, textColor, letterSpacing, fontstyle, aspectRatio, exportRes]);

  return (
    <div className={`w-screen h-screen bg-[#fdfaf6] overflow-x-hidden overflow-y-auto no-scrollbar absolute inset-0 ${aspectRatio !== 'auto' ? 'flex items-center justify-center bg-gray-900' : ''}`}>
      {isRecording && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 right-6 z-[100] flex items-center space-x-3 bg-black/80 backdrop-blur text-white px-4 py-2.5 rounded-full shadow-2xl pointer-events-auto"
        >
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-sm font-semibold tracking-wider">录制中...</span>
          </div>
          <div className="w-px h-4 bg-white/20 mx-1"></div>
          <button onClick={stopRecording} className="text-sm font-medium hover:text-red-400 transition-colors">
            结束并保存
          </button>
        </motion.div>
      )}

      <motion.div
        drag dragMomentum={false}
        initial={{ x: 0, y: 0 }}
        className="absolute top-4 right-4 z-50 flex flex-col items-end font-sans pointer-events-auto"
      >
        <motion.div 
          className="flex justify-end mb-2 cursor-grab active:cursor-grabbing"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <button 
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={() => setIsPanelOpen(!isPanelOpen)} 
            className="p-2 bg-white/90 backdrop-blur shadow-md hover:bg-gray-50 rounded-full text-gray-500 border border-gray-200 focus:outline-none"
          >
            {isPanelOpen ? <X className="w-4 h-4"/> : <Settings className="w-4 h-4"/>}
          </button>
        </motion.div>
        
        <AnimatePresence>
          {isPanelOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-gray-200 w-72 flex flex-col"
              style={{ maxHeight: 'calc(100vh - 80px)' }}
            >
              <div className="p-4 space-y-4 overflow-y-auto no-scrollbar pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase block">字体风格 (Font Style)</label>
                  <select 
                    value={fontstyle} 
                    onChange={(e) => setFontstyle(e.target.value as 'handwritten' | 'pixel')}
                    className="w-full bg-gray-50 border border-gray-200 rounded text-[12px] p-1.5 outline-none focus:ring-1"
                  >
                    <option value="handwritten">手写体 (Handwritten)</option>
                    <option value="pixel">像素风 (Pixel)</option>
                  </select>
                </div>

                <div className="flex space-x-2">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block">比例</label>
                    <div className="flex border rounded bg-gray-50 overflow-hidden">
                      {(['small', 'medium', 'large'] as const).map(s => (
                        <button key={s} onClick={() => setSize(s)} className={`flex-1 py-1 text-[11px] ${size === s ? 'bg-white shadow-sm text-black border-gray-200 m-0.5 rounded-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                          {s === 'small' ? 'S' : s === 'medium' ? 'M' : 'L'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block">颜色</label>
                    <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 p-1 rounded h-[30px]">
                      <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-5 h-5 rounded border-0 p-0 cursor-pointer" />
                      <span className="text-[11px] font-mono text-gray-600 uppercase flex-1 text-center truncate">{textColor}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between">
                    <span>速度 (Speed)</span><span className="text-gray-500">{speed}ms</span>
                  </label>
                  <input type="range" min="10" max="400" step="10" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between">
                    <span>间距 (Spacing)</span><span className="text-gray-500">{letterSpacing}px</span>
                  </label>
                  <input type="range" min="0" max="10" step="1" value={letterSpacing} onChange={(e) => setLetterSpacing(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">文字阴影 (Shadow)</label>
                    <button
                      onClick={() => setIsShadowEnabled(!isShadowEnabled)}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${isShadowEnabled ? 'bg-blue-400' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${isShadowEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  
                  {isShadowEnabled && (
                    <>
                      <div className="flex space-x-2">
                        <div className="space-y-1.5 flex-[0.5]">
                           <label className="text-[9px] text-gray-400 block">颜色</label>
                           <div className="flex items-center space-x-1 bg-gray-50 border border-gray-200 p-0.5 rounded h-[22px]">
                             <input type="color" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} className="w-5 h-5 rounded border-0 p-0 cursor-pointer" />
                           </div>
                        </div>
                        <div className="space-y-1.5 flex-1">
                           <label className="text-[9px] text-gray-400 flex justify-between">
                             <span>模糊度</span><span>{shadowBlur}</span>
                           </label>
                           <input type="range" min="0" max="30" step="1" value={shadowBlur} onChange={(e) => setShadowBlur(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <div className="space-y-1.5 flex-1">
                           <label className="text-[9px] text-gray-400 flex justify-between">
                             <span>偏移 X</span><span>{shadowOffsetX}</span>
                           </label>
                           <input type="range" min="-30" max="30" step="1" value={shadowOffsetX} onChange={(e) => setShadowOffsetX(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="space-y-1.5 flex-1">
                           <label className="text-[9px] text-gray-400 flex justify-between">
                             <span>偏移 Y</span><span>{shadowOffsetY}</span>
                           </label>
                           <input type="range" min="-30" max="30" step="1" value={shadowOffsetY} onChange={(e) => setShadowOffsetY(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                    <span>位置偏移 (Position)</span>
                    <button onClick={() => { setOffsetX(0); setOffsetY(0); }} className="px-1.5 py-0.5 border border-gray-200 rounded text-[9px] hover:bg-gray-100 text-gray-500">重置</button>
                  </label>
                  <div className="flex space-x-3 mt-1 cursor-auto">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-1.5 pl-1">
                        <span className="text-[9px] text-gray-400 w-3">X</span>
                        <input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value) || 0)} className="w-[30px] p-0 border-b border-gray-300 text-center text-[10px] bg-transparent outline-none focus:border-gray-500 font-mono" />
                      </div>
                      <input type="range" min="-150" max="150" step="1" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-1.5 pl-1">
                        <span className="text-[9px] text-gray-400 w-3">Y</span>
                        <input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value) || 0)} className="w-[30px] p-0 border-b border-gray-300 text-center text-[10px] bg-transparent outline-none focus:border-gray-500 font-mono" />
                      </div>
                      <input type="range" min="-150" max="150" step="1" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                    <span>正文 (Content)</span><Edit className="w-3 h-3 opacity-60"/>
                  </label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-24 py-1.5 px-2 border border-gray-200 rounded text-gray-700 bg-gray-50 focus:bg-white focus:ring-1 outline-none font-sans text-[12px] resize-none" />
                </div>
                
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">添加笔记本行 (Add Lines)</label>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 border border-gray-200 bg-gray-50 rounded p-1 flex-1">
                      <span className="text-[9px] text-gray-500 pl-1">行数:</span>
                      <input 
                        type="number" 
                        value={linesToAdd} 
                        onChange={(e) => setLinesToAdd(Math.max(1, parseInt(e.target.value) || 1))} 
                        className="w-full bg-transparent text-[11px] font-mono text-center outline-none" 
                      />
                    </div>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => { linesConfig.current.addedLines = Math.max(0, linesConfig.current.addedLines - linesToAdd); }} 
                        className="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] font-medium transition-colors"
                      >
                        减少
                      </button>
                      <button 
                        onClick={() => { linesConfig.current.addedLines += linesToAdd; }} 
                        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-[10px] font-medium transition-colors"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2 border-t border-gray-100">
                  <button onClick={saveScene} className="flex-1 py-1.5 border border-gray-200 rounded text-[10px] font-medium hover:bg-gray-50 text-gray-600 transition-colors flex justify-center items-center">
                    {saveStatus === 'saved' ? <span className="text-green-600">已保存!</span> : '保存场景'}
                  </button>
                  <button onClick={loadScene} className="flex-1 py-1.5 border border-gray-200 rounded text-[10px] font-medium hover:bg-gray-50 text-gray-600 transition-colors flex justify-center items-center">
                    {saveStatus === 'loaded' ? <span className="text-green-600">已加载!</span> : saveStatus === 'no_data' ? <span className="text-orange-500">无存档</span> : '加载场景'}
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">画面与导出配置 (Export Config)</label>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] text-gray-500 w-8">分辨率</span>
                    <div className="flex border border-gray-200 rounded bg-gray-50 flex-1 overflow-hidden">
                      {(['720p', '1080p'] as const).map(r => (
                        <button key={r} onClick={() => setExportRes(r)} className={`flex-1 py-1 text-[9px] font-medium ${exportRes === r ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5 pt-1">
                    <span className="text-[9px] text-gray-500">画幅比例 (Aspect Ratio)</span>
                    <div className="grid grid-cols-4 gap-1">
                      {['auto', '16:9', '9:16', '4:3', '3:4', '1:1', 'A4', 'A3'].map(r => (
                        <button key={r} onClick={() => setAspectRatio(r)} className={`py-1 text-[9px] font-medium rounded border ${aspectRatio === r ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5 pt-1">
                    <span className="text-[9px] text-gray-500">导出图片 (Export Image)</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex border border-gray-200 rounded bg-gray-50 flex-1 overflow-hidden">
                        {(['png', 'jpeg'] as const).map(f => (
                          <button key={f} onClick={() => setImgFormat(f)} className={`flex-1 py-1.5 text-[9px] font-medium ${imgFormat === f ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>
                            {f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <button onClick={exportImage} className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[10px] rounded font-medium transition-colors">
                        保存图片
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] font-bold text-gray-400 uppercase">录制视频 (Record HD)</label>
                  </div>
                  <button onClick={startRecording} className="w-full py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-[11px] font-medium flex items-center justify-center space-x-2 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-200 animate-pulse"></span>
                    <span>开始录制并隐藏面板</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

