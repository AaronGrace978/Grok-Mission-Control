/** Shared GLSL. All custom materials support the logarithmic depth buffer. */

export const planetVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

export const earthFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D cloudMap;
  uniform sampler2D specMap;
  uniform vec3 sunDir;
  uniform float cloudShift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 L = normalize(sunDir);
    float NdL = dot(N, L);

    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;
    float ocean = texture2D(specMap, vUv).r;
    float cloudShadow = texture2D(cloudMap, vec2(vUv.x + cloudShift + 0.0012, vUv.y)).r;

    float light = smoothstep(-0.08, 0.6, NdL) * max(NdL + 0.08, 0.0);
    vec3 col = day * (1.0 - 0.42 * cloudShadow) * light * 2.1;

    // Warm the terminator band.
    float term = smoothstep(-0.12, 0.05, NdL) * (1.0 - smoothstep(0.05, 0.35, NdL));
    col *= mix(vec3(1.0), vec3(1.35, 0.85, 0.6), term * 0.6);

    // Sun glint on oceans.
    vec3 H = normalize(L + V);
    float glint = pow(max(dot(N, H), 0.0), 90.0) * 2.6 + pow(max(dot(N, H), 0.0), 12.0) * 0.12;
    col += vec3(1.0, 0.93, 0.82) * glint * ocean * (1.0 - cloudShadow) * smoothstep(0.0, 0.15, NdL);

    // City lights on the night side.
    float nightMask = 1.0 - smoothstep(-0.18, 0.06, NdL);
    vec3 lights = pow(night, vec3(1.4)) * vec3(1.0, 0.72, 0.42) * 3.2;
    col += lights * nightMask * (1.0 - 0.8 * cloudShadow);

    // Rayleigh-tinted limb haze.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 atmo = mix(vec3(1.0, 0.45, 0.2), vec3(0.32, 0.62, 1.0), smoothstep(-0.1, 0.35, NdL));
    col += atmo * fres * smoothstep(-0.3, 0.4, NdL) * 1.6;
    col = mix(col, col * vec3(0.82, 0.9, 1.08) + vec3(0.01, 0.025, 0.06) * light, 0.5);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const cloudFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float cloudShift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float NdL = dot(N, normalize(sunDir));
    float c = texture2D(cloudMap, vec2(vUv.x + cloudShift, vUv.y)).r;
    c = smoothstep(0.08, 0.9, c);
    float light = smoothstep(-0.1, 0.5, NdL) * max(NdL + 0.1, 0.0);
    vec3 tint = mix(vec3(1.0, 0.6, 0.4), vec3(1.0), smoothstep(0.0, 0.3, NdL));
    float edge = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    vec3 col = tint * light * 2.0 + vec3(0.002);
    float a = c * (0.92 - 0.35 * edge);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const rockyFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map;
  uniform vec3 sunDir;
  uniform float exposure;
  uniform vec3 hazeColor;
  uniform float haze;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 L = normalize(sunDir);
    float NdL = dot(N, L);
    float NdV = max(dot(N, V), 0.0);
    vec3 albedo = texture2D(map, vUv).rgb;
    // Lommel-Seeliger blend keeps airless bodies bright at the limb like the real Moon.
    float ls = max(NdL, 0.0) / (max(NdL, 0.0) + NdV + 1e-3);
    float lambert = max(NdL, 0.0);
    float diffuse = mix(lambert, ls * 2.0, 0.45);
    vec3 col = albedo * diffuse * exposure + albedo * 0.004;
    float fres = pow(1.0 - NdV, 2.5);
    col += hazeColor * fres * haze * smoothstep(-0.2, 0.4, NdL);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Back-side shell glow peaking at the planet limb. limb = sqrt(1 - (R/Rshell)^2). */
export const atmosphereFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDir;
  uniform vec3 dayColor;
  uniform vec3 duskColor;
  uniform float limb;
  uniform float intensity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float d = -dot(N, V);
    float g = pow(clamp(d / limb, 0.0, 1.0), 3.5) * (1.0 - smoothstep(limb, limb + 0.35, d));
    float NdL = dot(N, normalize(sunDir));
    float lit = smoothstep(-0.35, 0.3, NdL);
    vec3 col = mix(duskColor, dayColor, smoothstep(-0.05, 0.45, NdL));
    gl_FragColor = vec4(col * g * lit * intensity, 1.0);
  }
`;

export const skyVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vDir;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vDir = normalize(mat3(modelMatrix) * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

export const skyFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map;
  uniform float brightness;
  uniform float skyAmount;
  uniform vec3 camUp;
  uniform vec3 sunDir;
  varying vec3 vDir;
  varying vec2 vUv;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 stars = texture2D(map, vUv).rgb;
    float lum = dot(stars, vec3(0.299, 0.587, 0.114));
    stars = mix(vec3(lum), stars, 0.55) * brightness;
    vec3 dir = normalize(vDir);
    float h = dot(dir, camUp);
    float sunElev = dot(camUp, sunDir);
    vec3 zenith = vec3(0.012, 0.055, 0.2);
    vec3 horizon = vec3(0.2, 0.33, 0.52);
    vec3 sky = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.38));
    sky = mix(sky, horizon * 0.6, smoothstep(0.02, -0.06, h));
    float mu = max(dot(dir, sunDir), 0.0);
    sky += vec3(1.0, 0.86, 0.68) * (pow(mu, 10.0) * 0.22 + pow(mu, 400.0) * 2.5);
    sky *= smoothstep(-0.15, 0.25, sunElev) * 0.95;
    vec3 col = mix(stars, sky, skyAmount);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const starVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float size;
  attribute vec3 color;
  uniform float pixelRatio;
  uniform float time;
  uniform float fade;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.85 + 0.15 * sin(time * (0.6 + fract(size * 31.7) * 2.0) + size * 97.0);
    vColor = color * tw * fade;
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

export const starFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = exp(-d * d * 18.0) + 0.25 * exp(-d * d * 4.0);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

export const plumeVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uLength;
  uniform float uR0;
  uniform float uR1;
  uniform float uCurve;
  uniform float uTime;
  varying float vV;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vAngle;
  void main() {
    float v = clamp(-position.y, 0.0, 1.0);
    float r = mix(uR0, uR1, pow(v, uCurve));
    vec3 p = vec3(position.x * r, -v * uLength, position.z * r);
    vV = v;
    vAngle = atan(position.z, position.x);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

export const plumeFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  uniform float uThrottle;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uDiamonds;
  uniform float uIntensity;
  uniform float uFalloff;
  varying float vV;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vAngle;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 V = normalize(-vViewPos);
    float facing = abs(dot(normalize(vNormalV), V));
    float body = pow(facing, 1.6);
    float along = pow(1.0 - vV, uFalloff);
    float n = noise(vec2(vAngle * 3.0, vV * 9.0 - uTime * 14.0)) * 0.55 + noise(vec2(vAngle * 7.0, vV * 23.0 - uTime * 31.0)) * 0.45;
    float flicker = 0.78 + 0.32 * n;
    float diamonds = 1.0 + uDiamonds * 0.65 * pow(0.5 + 0.5 * cos(vV * 46.0), 6.0) * (1.0 - smoothstep(0.0, 0.45, vV));
    float start = smoothstep(0.0, 0.035, vV);
    float a = body * along * flicker * diamonds * start * uThrottle;
    vec3 col = mix(uEdge, uCore, pow(along * body, 1.4));
    gl_FragColor = vec4(col * a * uIntensity, 1.0);
  }
`;

export const puffVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha;
    gl_PointSize = min(aSize * uScale / max(-mv.z, 1e-6), 1600.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

export const puffFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = smoothstep(1.0, 0.15, d);
    if (a * vAlpha < 0.003) discard;
    gl_FragColor = vec4(uColor * (0.82 + 0.18 * (1.0 - d)), a * vAlpha);
  }
`;

export const sparkVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uLength;
  uniform float uSpread;
  uniform float uSize;
  uniform float uScale;
  uniform float uThrottle;
  varying float vLife;
  void main() {
    float life = fract(uTime * (1.2 + aSeed.w * 0.9) + aSeed.x);
    float ang = aSeed.y * 6.2831853;
    float rad = sqrt(aSeed.z) * uSpread * (0.15 + life * 1.1);
    vec3 p = vec3(cos(ang) * rad, -life * uLength * (0.6 + aSeed.w * 0.6), sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vLife = life;
    gl_PointSize = uSize * uScale * (1.0 - life * 0.5) * uThrottle / max(-mv.z, 1e-6);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

export const sparkFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform float uThrottle;
  varying float vLife;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c)) * (1.0 - vLife) * uThrottle;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

export const plasmaFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  uniform float uIntensity;
  varying float vV;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vAngle;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 V = normalize(-vViewPos);
    float facing = abs(dot(normalize(vNormalV), V));
    float rim = pow(1.0 - facing, 1.5) * 0.7 + pow(facing, 2.0) * 0.5;
    float n = noise(vec2(vAngle * 4.0, vV * 6.0 - uTime * 6.0));
    float along = pow(1.0 - vV, 1.6);
    vec3 hot = vec3(1.0, 0.82, 0.95);
    vec3 warm = vec3(1.0, 0.36, 0.16);
    vec3 col = mix(warm, hot, pow(along, 3.0));
    float a = rim * along * (0.6 + 0.6 * n) * uIntensity;
    gl_FragColor = vec4(col * a * 3.0, 1.0);
  }
`;
