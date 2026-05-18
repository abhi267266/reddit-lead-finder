"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface HoverMaskRevealProps {
  imageSrc: string;
  width?: string | number;
  height?: string | number;
}

const baseVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const splatShader = `
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main() {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const advectionShader = `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    gl_FragColor = result * dissipation;
  }
`;

const divergenceShader = `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;
  void main() {
    float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
    float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const jacobiShader = `
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 texelSize;
  void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float b = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((L + R + B + T - b) * 0.25, 0.0, 0.0, 1.0);
  }
`;

const gradientSubtractShader = `
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;
  void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const finalDisplayShader = `
  varying vec2 vUv;
  uniform sampler2D uDensity;
  uniform sampler2D uBase;
  uniform float uBlend;
  uniform vec2 uResolution;
  uniform vec2 uImageResolution;
  
  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    // Calculate background-size: cover logic
    vec2 ratio = uResolution / uImageResolution;
    vec2 uv = vUv;
    if (ratio.x > ratio.y) {
      uv.y = (vUv.y - 0.5) * (ratio.y / ratio.x) + 0.5;
    } else {
      uv.x = (vUv.x - 0.5) * (ratio.x / ratio.y) + 0.5;
    }
    
    vec4 baseColor = texture2D(uBase, uv);
    
    vec3 densityInfo = texture2D(uDensity, vUv).xyz;
    float density = max(max(densityInfo.r, densityInfo.g), densityInfo.b);
    
    // Create a perfectly matching sinister effect dynamically from the base image
    vec2 glitchUv = uv + vec2(snoise(vUv * 20.0 + density * 5.0) * 0.03, 0.0) * density;
    vec4 glitchColor = texture2D(uBase, glitchUv);
    
    float lum = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 sinister = vec3(lum * 0.3); // Darken and desaturate
    sinister += glitchColor.rgb * vec3(1.5, 0.1, 0.5); // Add heavy red/purple tint
    sinister += vec3(1.0, 0.0, 0.0) * density * 0.5; // Add extra red glow where fluid is
    
    vec4 hoverColor = vec4(sinister, baseColor.a);
    
    float noise = snoise(vUv * 8.0 + density) * 0.15;
    // Only apply noise where there is actual fluid density
    float activeNoise = noise * min(density * 10.0, 1.0);
    float mask = smoothstep(0.02, 0.4, density + activeNoise) * uBlend;
    
    // Mix the two textures using the fluid mask
    gl_FragColor = mix(baseColor, hoverColor, clamp(mask, 0.0, 1.0));
    
    // Make dark backgrounds transparent so it blends perfectly into the hero section
    float brightness = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
    float alphaMask = smoothstep(0.04, 0.15, brightness);
    gl_FragColor.a *= alphaMask;
    
    // Make the bottom edge (neck) fade out smoothly into the page
    // In Three.js, vUv.y is 0.0 at the bottom and 1.0 at the top.
    float bottomFade = smoothstep(0.0, 0.35, vUv.y);
    gl_FragColor.a *= bottomFade;
    
    // Pre-multiply alpha for transparent regions
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

class FBO {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;

  constructor(w: number, h: number, type: THREE.TextureDataType) {
    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: type,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.read = new THREE.WebGLRenderTarget(w, h, options);
    this.write = new THREE.WebGLRenderTarget(w, h, options);
  }

  swap() {
    const temp = this.read;
    this.read = this.write;
    this.write = temp;
  }
  
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

export default function HoverMaskReveal({
  imageSrc,
  width = "100%",
  height = "100%",
}: HoverMaskRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Three.js setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setClearColor(0x000000, 0); // Transparent
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // Texture Loading
    const textureLoader = new THREE.TextureLoader();
    const baseTex = textureLoader.load(imageSrc);

    // Simulation resolutions
    const simRes = 128;
    const dyeRes = 512;
    
    // Fallback type if FloatType is not supported
    const ext = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.FloatType;
    
    // FBOs
    const velocityFBO = new FBO(simRes, simRes, ext);
    const densityFBO = new FBO(dyeRes, dyeRes, ext);
    const pressureFBO = new FBO(simRes, simRes, ext);
    const divergenceFBO = new FBO(simRes, simRes, ext);
    
    // Shaders
    const createMaterial = (fragShader: string, uniforms: any) => {
      return new THREE.ShaderMaterial({
        vertexShader: baseVertexShader,
        fragmentShader: fragShader,
        uniforms,
        depthWrite: false,
        depthTest: false,
      });
    };

    const splatMat = createMaterial(splatShader, {
      uTarget: { value: null },
      aspectRatio: { value: 1.0 },
      color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() },
      radius: { value: 0.005 } // Smaller radius for sharp ink
    });

    const advectionMat = createMaterial(advectionShader, {
      uVelocity: { value: null },
      uSource: { value: null },
      texelSize: { value: new THREE.Vector2(1 / simRes, 1 / simRes) },
      dt: { value: 0.016 },
      dissipation: { value: 0.98 }
    });

    const divergenceMat = createMaterial(divergenceShader, {
      uVelocity: { value: null },
      texelSize: { value: new THREE.Vector2(1 / simRes, 1 / simRes) }
    });

    const jacobiMat = createMaterial(jacobiShader, {
      uPressure: { value: null },
      uDivergence: { value: null },
      texelSize: { value: new THREE.Vector2(1 / simRes, 1 / simRes) }
    });

    const gradSubMat = createMaterial(gradientSubtractShader, {
      uPressure: { value: null },
      uVelocity: { value: null },
      texelSize: { value: new THREE.Vector2(1 / simRes, 1 / simRes) }
    });

    const displayMat = createMaterial(finalDisplayShader, {
      uDensity: { value: densityFBO.read.texture },
      uBase: { value: baseTex },
      uBlend: { value: 0.0 },
      uResolution: { value: new THREE.Vector2() },
      uImageResolution: { value: new THREE.Vector2(1, 1) } // Default to 1:1, will be updated when texture loads
    });

    // Update image resolution when base texture loads
    if (baseTex.image) {
      displayMat.uniforms.uImageResolution.value.set(baseTex.image.width, baseTex.image.height);
    } else {
      baseTex.generateMipmaps = true;
      const loader = new THREE.ImageLoader();
      loader.load(imageSrc, (image) => {
        displayMat.uniforms.uImageResolution.value.set(image.width, image.height);
      });
    }

    const mesh = new THREE.Mesh(geometry, displayMat);
    scene.add(mesh);

    // Helpers
    const renderFBO = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      mesh.material = material;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    };

    const splat = (x: number, y: number, dx: number, dy: number, color: THREE.Vector3) => {
      splatMat.uniforms.uTarget.value = velocityFBO.read.texture;
      splatMat.uniforms.aspectRatio.value = renderer.domElement.width / renderer.domElement.height;
      splatMat.uniforms.point.value.set(x, y);
      splatMat.uniforms.color.value.set(dx, dy, 0.0);
      splatMat.uniforms.radius.value = 0.005; // Increased from 0.002
      renderFBO(splatMat, velocityFBO.write);
      velocityFBO.swap();

      splatMat.uniforms.uTarget.value = densityFBO.read.texture;
      splatMat.uniforms.color.value.copy(color);
      splatMat.uniforms.radius.value = 0.015; // Increased from 0.005 to make the face reveal bigger/clearer
      renderFBO(splatMat, densityFBO.write);
      densityFBO.swap();
    };

    // Interaction state
    let targetBlend = 0;
    const pointer = {
      x: 0.5, y: 0.5, dx: 0, dy: 0,
      moved: false,
      down: false,
      color: new THREE.Vector3(25.0, 25.0, 25.0) // Increased density injection
    };

    const updatePointer = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const x = (clientX - rect.left) / rect.width;
      const y = 1.0 - (clientY - rect.top) / rect.height;
      
      pointer.dx = (x - pointer.x) * 15.0; // Increased velocity factor
      pointer.dy = (y - pointer.y) * 15.0;
      pointer.x = x;
      pointer.y = y;
      pointer.moved = true;
    };

    const onMove = (e: MouseEvent | TouchEvent) => { updatePointer(e); };
    const onEnter = () => { targetBlend = 1.0; };
    const onLeave = () => { targetBlend = 0.0; };

    container.addEventListener('mousemove', onMove);
    container.addEventListener('touchmove', onMove);
    container.addEventListener('mouseenter', onEnter);
    container.addEventListener('mouseleave', onLeave);

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height);
        displayMat.uniforms.uResolution.value.set(width, height);
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let lastTime = performance.now();
    let animId: number;

    const step = () => {
      const now = performance.now();
      let dt = Math.min((now - lastTime) / 1000, 0.016);
      lastTime = now;

      // Update blend value smoothly
      displayMat.uniforms.uBlend.value += (targetBlend - displayMat.uniforms.uBlend.value) * 0.05;

      // Add splat if moved
      if (pointer.moved && targetBlend > 0) {
        splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
        pointer.moved = false;
      }

      // Advect velocity
      advectionMat.uniforms.uVelocity.value = velocityFBO.read.texture;
      advectionMat.uniforms.uSource.value = velocityFBO.read.texture;
      advectionMat.uniforms.dissipation.value = 0.98; // Velocity dissipates slowly
      renderFBO(advectionMat, velocityFBO.write);
      velocityFBO.swap();

      // Advect density
      advectionMat.uniforms.uVelocity.value = velocityFBO.read.texture;
      advectionMat.uniforms.uSource.value = densityFBO.read.texture;
      advectionMat.uniforms.dissipation.value = 0.95; // Density dissipates faster
      renderFBO(advectionMat, densityFBO.write);
      densityFBO.swap();

      // Divergence
      divergenceMat.uniforms.uVelocity.value = velocityFBO.read.texture;
      renderFBO(divergenceMat, divergenceFBO.write);
      divergenceFBO.swap();

      // Pressure solve (Jacobi iterations)
      jacobiMat.uniforms.uDivergence.value = divergenceFBO.read.texture;
      for (let i = 0; i < 20; i++) {
        jacobiMat.uniforms.uPressure.value = pressureFBO.read.texture;
        renderFBO(jacobiMat, pressureFBO.write);
        pressureFBO.swap();
      }

      // Gradient subtract
      gradSubMat.uniforms.uPressure.value = pressureFBO.read.texture;
      gradSubMat.uniforms.uVelocity.value = velocityFBO.read.texture;
      renderFBO(gradSubMat, velocityFBO.write);
      velocityFBO.swap();

      // Final display
      mesh.material = displayMat;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      animId = requestAnimationFrame(step);
    };
    
    animId = requestAnimationFrame(step);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('mouseenter', onEnter);
      container.removeEventListener('mouseleave', onLeave);
      
      velocityFBO.dispose();
      densityFBO.dispose();
      pressureFBO.dispose();
      divergenceFBO.dispose();
      
      splatMat.dispose();
      advectionMat.dispose();
      divergenceMat.dispose();
      jacobiMat.dispose();
      gradSubMat.dispose();
      displayMat.dispose();
      
      baseTex.dispose();
      geometry.dispose();
      
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [imageSrc]);

  return (
    <div 
      ref={containerRef} 
      style={{ width, height, overflow: 'hidden', position: 'relative' }}
      className="HoverMaskReveal-container"
    >
      {/* Fallback image if JS/WebGL fails or loads slow */}
      <img 
        src={imageSrc} 
        alt="Base" 
        style={{ 
          position: 'absolute', 
          top: 0, left: 0, 
          width: '100%', height: '100%', 
          objectFit: 'cover',
          zIndex: -1 
        }} 
      />
    </div>
  );
}
