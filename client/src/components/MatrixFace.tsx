"use client";

import { useEffect, useRef, useState } from "react";

export default function MatrixFace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Offscreen canvas for the matrix effect
    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d");
    if (!offCtx) return;

    let animationFrameId: number;
    let drops: number[] = [];
    const fontSize = 14;
    
    // Load the mask image
    const maskImg = new Image();
    maskImg.src = "/landing/face-mask.png";
    
    // Matrix characters
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~LEADSPULSEAI";
    const charArray = chars.split("");

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      offCanvas.width = rect.width;
      offCanvas.height = rect.height;
      
      const columns = Math.floor(rect.width / fontSize);
      drops = Array(columns).fill(1);
    };

    maskImg.onload = () => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      draw();
    };

    const draw = () => {
      // 1. Draw matrix to offscreen canvas
      offCtx.fillStyle = "rgba(15, 17, 21, 0.1)"; // Dark background with trail
      offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
      
      offCtx.font = `${fontSize}px monospace`;
      offCtx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        
        // Dynamic color
        if (isHovered) {
          offCtx.fillStyle = Math.random() > 0.95 ? "#fff" : "#ef4444"; // Red
        } else {
          offCtx.fillStyle = Math.random() > 0.95 ? "#fff" : "#3b82f6"; // Blue
        }
        
        offCtx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > offCanvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      // 2. Clear main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 3. Draw mask image to center of main canvas
      const imgRatio = maskImg.width / maskImg.height;
      const canvasRatio = canvas.width / canvas.height;
      let drawWidth, drawHeight, drawX, drawY;
      
      const scaleMultiplier = 1.25; // Make the face 25% bigger

      if (canvasRatio > imgRatio) {
        drawHeight = canvas.height * scaleMultiplier;
        drawWidth = maskImg.width * (drawHeight / maskImg.height);
        drawX = (canvas.width - drawWidth) / 2;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        drawWidth = canvas.width * scaleMultiplier;
        drawHeight = maskImg.height * (drawWidth / maskImg.width);
        drawX = (canvas.width - drawWidth) / 2;
        drawY = (canvas.height - drawHeight) / 2;
      }
      
      // Draw the black/white mask image
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(maskImg, drawX, drawY, drawWidth, drawHeight);
      
      // 4. Convert white pixels to opaque, black pixels to transparent
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Setup fade gradient at the bottom so the neck blends smoothly
      const fadeStartY = canvas.height * 0.65;
      const fadeEndY = canvas.height * 0.95;
      const fadeRange = fadeEndY - fadeStartY;

      for (let i = 0; i < data.length; i += 4) {
        const brightness = data[i]; 
        const pixelIndex = i / 4;
        const y = Math.floor(pixelIndex / canvas.width);
        
        let fadeMultiplier = 1;
        if (y > fadeStartY) {
          if (y >= fadeEndY) {
            fadeMultiplier = 0;
          } else {
            fadeMultiplier = 1 - ((y - fadeStartY) / fadeRange);
          }
        }

        // If it's dark, make it transparent
        if (brightness < 50) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = brightness * fadeMultiplier; // Opaque where white, with bottom fade
        }
      }
      ctx.putImageData(imageData, 0, 0);
      
      // 5. Use source-in to draw matrix only over the opaque (white) parts
      ctx.globalCompositeOperation = "source-in";
      ctx.drawImage(offCanvas, 0, 0);
      
      animationFrameId = requestAnimationFrame(draw);
    };

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isHovered]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[400px] md:h-[500px] flex items-center justify-center cursor-crosshair group transition-transform duration-700"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block z-10 transition-transform duration-500 group-hover:scale-105"
      />
      
      {/* Glow effect behind */}
      <div 
        className={`absolute inset-0 -z-10 blur-[100px] rounded-full transition-all duration-700 opacity-40 ${isHovered ? 'bg-red-500 scale-110' : 'bg-blue-500 scale-90'}`} 
      />
    </div>
  );
}
