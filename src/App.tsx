import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, X, Edit, Sliders } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const defaultWords = {
  en: [
    "When I was little, Grandma often tucked the forest",
    "into a small basket.",
    "",
    "Rain boots stepped through the soft, wet mud.",
    "Wildflowers, leaves, and little berries",
    "lay quietly at the bottom of the basket,",
    "like glowing secrets.",
    "",
    "At dusk, we went home.",
    "Mist gathered on the window.",
    "Behind me, the fireplace slowly began to glow.",
    "",
    "The water in the fish tank swayed gently,",
    "and the waves on the wall turned pink.",
    "I opened my diary,",
    "and the typewriter wrote only one sentence:",
    "",
    "Today,",
    "we gathered many tender things.",
    "",
    "They were only hiding in the mist, the firelight, and the old paper,",
    "waiting for me to come close again,",
    "and recognize them once more."
  ]
};

const pixelCache = new Map<string, HTMLCanvasElement>();

let patternCanvas: HTMLCanvasElement | null = null;
let paperTexturePattern: CanvasPattern | null = null;

const getPaperPattern = (ctx: CanvasRenderingContext2D) => {
  if (!patternCanvas) {
    patternCanvas = document.createElement('canvas');
    patternCanvas.width = 512;
    patternCanvas.height = 512;
    const pCtx = patternCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#fdfaf6';
      pCtx.fillRect(0, 0, 512, 512);

      // Crumpled folds
      pCtx.save();
      for (let i = 0; i < 40; i++) {
        pCtx.beginPath();
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = Math.random() * 120 + 40;
        const grad = pCtx.createRadialGradient(x, y, 0, x, y, r);
        
        if (Math.random() > 0.5) {
            grad.addColorStop(0, 'rgba(0,0,0,0.04)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
            grad.addColorStop(0, 'rgba(255,255,255,0.06)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
        }
        
        pCtx.fillStyle = grad;
        pCtx.arc(x, y, r, 0, Math.PI * 2);
        pCtx.fill();

        if (Math.random() > 0.6) {
           pCtx.beginPath();
           pCtx.moveTo(x - r, y - r);
           pCtx.lineTo(x + r, y + r);
           pCtx.strokeStyle = 'rgba(0,0,0,0.02)';
           pCtx.lineWidth = Math.random() * 2 + 1;
           pCtx.stroke();
        }
      }
      pCtx.restore();

      // Noise
      const imgData = pCtx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 10;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
      }
      pCtx.putImageData(imgData, 0, 0);

      // Faint Ink Stains
      pCtx.save();
      pCtx.globalAlpha = 0.05;
      for (let i = 0; i < 6; i++) {
        pCtx.beginPath();
        pCtx.fillStyle = '#2c3e50';
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const cr = Math.random() * 25 + 5;
        pCtx.arc(cx, cy, cr, 0, Math.PI * 2);
        pCtx.fill();
        
        pCtx.beginPath();
        pCtx.fillStyle = '#1a252f';
        pCtx.arc(cx + Math.random()*cr*0.5, cy + Math.random()*cr*0.5, cr * 0.4, 0, Math.PI * 2);
        pCtx.fill();
      }
      pCtx.restore();
    }
  }
  
  if (!paperTexturePattern && patternCanvas) {
    paperTexturePattern = ctx.createPattern(patternCanvas, 'repeat');
  }
  return paperTexturePattern;
};

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
  letter: string; startX: number; startY: number; x: number; y: number; dt: number; a: number = 255;
  aSpeed: number; initTime: number; dx: number; dy: number;
  image: HTMLCanvasElement; scale: number; fontStyle: string;
  hexColor: string; fontSize: number;

  constructor(letter: string, x: number, y: number, dt: number, initTime: number, hexColor: string, sizeScale: number, fontStyle: string, fontSize: number) {
    this.letter = letter; this.startX = x; this.startY = y; this.x = x; this.y = y; this.dt = dt;
    this.aSpeed = 1 + Math.random() * 2; this.initTime = initTime;
    this.dx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4);
    this.dy = -2 + Math.random() * 4;
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

  update(currentTime: number, width: number, height: number, blowTriggerTime: number | null, appState: string) {
    if (appState === 'BLOWING' && blowTriggerTime !== null && currentTime - blowTriggerTime > this.dt) {
      this.a = Math.max(0, this.a - this.aSpeed);
      this.x += this.dx;
      this.y += this.dy;
      if (this.x < 0 || this.x > width) this.dx *= -1;
      if (this.y < 0 || this.y > height) this.dy *= -1;
    } else if (appState === 'RETURNING') {
      this.x += (this.startX - this.x) * 0.02;
      this.y += (this.startY - this.y) * 0.02;
      this.a = Math.min(255, this.a + 2);
      if (this.a >= 255 && Math.abs(this.x - this.startX) < 1 && Math.abs(this.y - this.startY) < 1) {
         this.x = this.startX;
         this.y = this.startY;
         this.a = 255;
         this.dx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4); 
         this.dy = -2 + Math.random() * 4;
      }
    } else if (appState === 'WAITING') {
      this.x = this.startX;
      this.y = this.startY;
      this.a = 255;
    }
  }
}

const translations = {
  en: {
    font_style: "Font Style", handwritten: "Handwritten", pixel: "Pixel",
    size: "Size", size_s: "S", size_m: "M", size_l: "L", color: "Color", speed: "Speed", spacing: "Spacing",
    shadow: "Text Shadow", shadow_color: "Color", shadow_blur: "Blur",
    offset_x: "Offset X", offset_y: "Offset Y", position: "Position Offset", reset: "Reset",
    content: "Content", add_lines: "Add Notebook Lines", lines_count: "Lines:",
    reduce: "Reduce", add: "Add", save_scene: "Save Scene", load_scene: "Load Scene", saved: "Saved!",
    loaded: "Loaded!", no_data: "No Data", export_config: "Export Config",
    resolution: "Resolution", aspect_ratio: "Aspect Ratio", export_image: "Export Image",
    save_image: "Save Image", record_video: "Record Video HD", start_record: "Start Recording & Hide",
    recording: "Recording...", stop_record: "Stop & Save", lang: "Language",
    bg_image: "Background Image", upload_bg: "Upload Image", remove_bg: "Remove"
  }
};

export default function App() {
  const [isExperienceStarted, setIsExperienceStarted] = useState(false);
  const isExperienceStartedRef = useRef(false);
  useEffect(() => {
    isExperienceStartedRef.current = isExperienceStarted;
  }, [isExperienceStarted]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blowTriggerTimeRef = useRef<number | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const [isFaceReady, setIsFaceReady] = useState(false);
  const t = translations.en;
  
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('large');
  const [speed, setSpeed] = useState<number>(100);
  const [textColor, setTextColor] = useState<string>('#ed225e');
  const [text, setText] = useState<string>(defaultWords.en.join('\n'));
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

  const [bgImageSrc, setBgImageSrc] = useState<string | null>("https://raw.githubusercontent.com/shiy92928-sketch/picture/main/05f9f9f1fab2a38b38b31fdb2dc11ef5.png");
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (bgImageSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bgImageRef.current = img;
      };
      img.src = bgImageSrc;
    } else {
      bgImageRef.current = null;
    }
  }, [bgImageSrc]);

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBgImageSrc(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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

  useEffect(() => {
    let active = true;
    const initTask = async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      if (active) {
        faceLandmarkerRef.current = faceLandmarker;
        setIsFaceReady(true);
      }
    };
    initTask();
    
    // Video Setup
    let streamRef: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (active) {
          streamRef = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      });
    }
    
    return () => {
      active = false;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

      if (bgImageRef.current && bgImageRef.current.complete) {
        let estLogicalWidth = aspectRatio === 'auto' ? window.innerWidth : dim.w;
        let estLogicalHeight = aspectRatio === 'auto' ? Math.max(window.innerHeight, 1000) : dim.h;
        
        const img = bgImageRef.current;
        const imgRatio = img.width / img.height;
        const canvasRatio = estLogicalWidth / estLogicalHeight;
        let drawWidth = estLogicalWidth;
        let drawX = 0;
        
        if (imgRatio > canvasRatio) {
           drawWidth = img.width * (estLogicalHeight / img.height);
           drawX = (estLogicalWidth - drawWidth) / 2;
        }
        
        const imageLineX = drawX + (124 / 1214) * drawWidth + 15;
        originX = imageLineX - redLineOffsetX;
      }

      const availableWidth = dim.w - originX - (isMobile ? 16 : 40);

      const baseSpaceInGrid = size === 'small' ? 30 : size === 'medium' ? 45 : 60;
      const baseFontSize = size === 'small' ? 18 : size === 'medium' ? 24 : 32;

      const tctx = document.createElement('canvas').getContext('2d')!;
      tctx.font = `${baseFontSize}px ${fontstyle === 'pixel' ? '"JetBrains Mono", monospace' : '"Long Cang", cursive'}`;

      let scale = 1;
      let maxNeededWidth = 0;
      
      wordsArray.forEach(line => {
        let lineWidth = 0;
        for (let i = 0; i < line.length; i++) {
          const char = line.charAt(i);
          const isSpace = char === ' ';
          if (isSpace) {
            lineWidth += baseFontSize * 0.4 + letterSpacing * 3;
          } else {
            lineWidth += tctx.measureText(char).width + letterSpacing * 0.5;
          }
        }
        if (lineWidth > maxNeededWidth) maxNeededWidth = lineWidth;
      });
      
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
      
      const tctx = canvas.getContext('2d')!;
      tctx.font = `${fontSize}px ${fontstyle === 'pixel' ? '"JetBrains Mono", monospace' : '"Long Cang", cursive'}`;
      
      for (let i = 0; i < wordsArray.length; i++) {
        let x = 0;
        let dt = i * 150;
        for (let j = 0; j < wordsArray[i].length; j++) {
          const char = wordsArray[i].charAt(j);
          const isSpace = char === ' ';
          dt += speed; 
          letters.push(new Letter(char, x + originX, y + originY - spaceInGrid / 6, dt, time, textColor, textScale, fontstyle, fontSize));
          
          if (isSpace) {
            x += fontSize * 0.4 + letterSpacing * 3;
          } else {
            x += tctx.measureText(char).width + letterSpacing * 0.5;
          }
        }
        y += spaceInGrid;
      }
    };

    let prevWidth = window.innerWidth;
    let lastVideoTime = -1;
    let lastProcessedTimeMs = -1;
    let blowFrames = 0;
    let appState: 'WAITING' | 'BLOWING' | 'RETURNING' = 'WAITING';
    let blowTriggerTime: number | null = null;
    let allDisappearedTime = 0;
    let cooldownUntil = 0;

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
      if (bgImageRef.current && bgImageRef.current.complete) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        
        const img = bgImageRef.current;
        const imgRatio = img.width / img.height;
        const canvasRatio = logicalWidth / logicalHeight;
        let drawWidth = logicalWidth;
        let drawHeight = logicalHeight;
        let drawX = 0;
        let drawY = 0;
        
        if (imgRatio > canvasRatio) {
           drawHeight = logicalHeight;
           drawWidth = img.width * (logicalHeight / img.height);
           drawX = (logicalWidth - drawWidth) / 2;
        } else {
           drawWidth = logicalWidth;
           drawHeight = img.height * (logicalWidth / img.width);
           drawY = 0;
        }
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } else {
        ctx.fillStyle = getPaperPattern(ctx) || '#fdfaf6';
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        
        // Paper border effect from reference
        ctx.save();
        ctx.strokeStyle = 'rgba(50, 50, 50, 0.15)';
        ctx.lineWidth = 1.6;
        ctx.translate(logicalWidth / 2, logicalHeight / 2);
        ctx.beginPath();
        ctx.roundRect(-logicalWidth * 0.49, -logicalHeight * 0.49, logicalWidth * 0.98, logicalHeight * 0.98, [15, 5, 20, 25]);
        ctx.stroke();
        ctx.rotate(0.01);
        ctx.beginPath();
        ctx.roundRect(-logicalWidth * 0.49, -logicalHeight * 0.49, logicalWidth * 0.98, logicalHeight * 0.98, [15, 5, 20, 25]);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(originX, originY);
      ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1;

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
      
      if (faceLandmarkerRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        if (videoRef.current.currentTime !== lastVideoTime) {
          lastVideoTime = videoRef.current.currentTime;
          let nowMs = performance.now();
          if (nowMs <= lastProcessedTimeMs) nowMs = lastProcessedTimeMs + 1;
          lastProcessedTimeMs = nowMs;
          
          try {
            const result = faceLandmarkerRef.current.detectForVideo(videoRef.current, nowMs);
            if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
              const pucker = result.faceBlendshapes[0].categories.find(c => c.categoryName === "mouthPucker");
              const funnel = result.faceBlendshapes[0].categories.find(c => c.categoryName === "mouthFunnel");
              const puckerScore = pucker ? pucker.score : 0;
              const funnelScore = funnel ? funnel.score : 0;
              
              if (isExperienceStartedRef.current && appState === 'WAITING' && time > cooldownUntil) {
                if (puckerScore > 0.45 || funnelScore > 0.45) {
                  blowFrames++;
                  if (blowFrames > 10) {
                    appState = 'BLOWING';
                    blowTriggerTime = time;
                    blowFrames = 0;
                  }
                } else {
                  blowFrames = 0;
                }
              } else {
                blowFrames = 0;
              }
            } else {
              blowFrames = 0;
            }
          } catch (e) {
            console.error("MediaPipe inference error", e);
          }
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawBg();
      const { shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, offsetX, offsetY, isShadowEnabled } = realTimeOpts.current;
      
      let allDisappeared = true;
      let allReturned = true;

      for (let i = 0; i < letters.length; i++) {
        letters[i].display(
          ctx, 
          isShadowEnabled ? shadowColor : 'transparent', 
          isShadowEnabled ? shadowBlur : 0, 
          isShadowEnabled ? shadowOffsetX : 0, 
          isShadowEnabled ? shadowOffsetY : 0, 
          offsetX, 
          offsetY
        );
        letters[i].update(time, logicalWidth, logicalHeight, blowTriggerTime, appState);
        if (letters[i].a > 0) allDisappeared = false;
        if (letters[i].a < 255 || Math.abs(letters[i].x - letters[i].startX) > 1 || Math.abs(letters[i].y - letters[i].startY) > 1) {
          allReturned = false;
        }
      }

      if (appState === 'BLOWING' && allDisappeared) {
        if (allDisappearedTime === 0) allDisappearedTime = time;
        else if (time - allDisappearedTime > 2000) {
          appState = 'RETURNING';
          allDisappearedTime = 0;
        }
      }

      if (appState === 'RETURNING' && allReturned) {
        appState = 'WAITING';
        blowTriggerTime = null;
        cooldownUntil = time + 1500;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', handleResize); };
  }, [size, debouncedText, speed, textColor, letterSpacing, fontstyle, aspectRatio, exportRes]);

  return (
    <div className={`w-screen h-screen bg-[#fdfaf6] overflow-x-hidden overflow-y-auto no-scrollbar absolute inset-0 ${aspectRatio !== 'auto' ? 'flex items-center justify-center bg-gray-900' : ''}`}>
      {!isExperienceStarted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-10 max-w-md w-full flex flex-col items-center justify-between text-center relative"
            style={{ 
              backgroundImage: 'url("https://raw.githubusercontent.com/shiy92928-sketch/picture/main/1006163e-72df-4875-aea2-a2ae625c73a2.png")',
              backgroundSize: '146.9% 121.14%',
              backgroundPosition: '46.66% 59.52%',
              backgroundRepeat: 'no-repeat',
              aspectRatio: '1723/1367'
            }}
          >
            <h1 className="text-4xl font-['Pixelify_Sans',sans-serif] text-gray-800 mb-2 mt-4 tracking-wider">Memory Letter</h1>
            
            <div className="space-y-4 text-gray-700 text-base mb-4 font-['Pixelify_Sans',sans-serif]">
              <div>
                <div className="text-lg mb-1">🌬 Blow gently toward the screen</div>
                <div className="text-gray-500">Let the memories drift away.</div>
              </div>
              <div>
                <div className="text-lg mb-1">📝 Watch the words disappear slowly,</div>
                <div className="text-gray-500">like a letter carried by the wind.</div>
              </div>
            </div>
            
            <button 
              onClick={() => setIsExperienceStarted(true)}
              className="px-8 py-3 bg-gray-900 text-white rounded-full text-sm font-['Pixelify_Sans',sans-serif] tracking-wider hover:bg-gray-800 transition-colors shadow-lg flex flex-col items-center justify-center mx-auto mb-4"
            >
              <span>Start Experience</span>
            </button>
          </motion.div>
        </div>
      )}

      {isRecording && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 right-6 z-[100] flex items-center space-x-3 bg-black/80 backdrop-blur text-white px-4 py-2.5 rounded-full shadow-2xl pointer-events-auto"
        >
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-sm font-semibold tracking-wider">{t.recording}</span>
          </div>
          <div className="w-px h-4 bg-white/20 mx-1"></div>
          <button onClick={stopRecording} className="text-sm font-medium hover:text-red-400 transition-colors">
            {t.stop_record}
          </button>
        </motion.div>
      )}

      {!isRecording && (
        <div className="fixed top-8 right-8 z-[40] pointer-events-none">
        </div>
      )}

      <canvas ref={canvasRef} className="block" />
      <div className="fixed bottom-4 right-4 z-50 rounded overflow-hidden shadow-sm pointer-events-none opacity-50 outline outline-1 outline-gray-200">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-24 h-auto scale-x-[-1]" 
        />
        <div className="absolute inset-x-0 bottom-0 bg-black/30 backdrop-blur-[2px] p-1 text-[8px] text-white text-center flex items-center justify-center space-x-1">
           {isFaceReady ? (
             <>
               <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
               <span>Face Tracking On</span>
             </>
           ) : (
             <>
               <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
               <span>Camera</span>
             </>
           )}
        </div>
      </div>
    </div>
  );
}

