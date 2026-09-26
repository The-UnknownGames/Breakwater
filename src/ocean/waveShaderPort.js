// A line-by-line JS port of gerstnerDisplace() in waveGLSL.js, evaluated in
// float32 (Math.fround) like the GPU. Reads the packed uniform arrays, so it
// also checks Waves.packUniforms(). Used only by the agreement test (open
// water: shelters, which scale every term by Waves.shelterAt, are not set).

const f32 = Math.fround;

function smoothstep(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

export function shaderDisplace(waveA, waveB, tau, x0, z0, cell = 0) {
  let dx = f32(x0);
  let dy = 0;
  let dz = f32(z0);
  for (let i = 0; i < waveA.length; i++) {
    const a = waveA[i];
    const b = waveB[i];
    const lambda = f32(6.2831853 / b.y);
    const f = smoothstep(2.0, 4.0, lambda / Math.max(cell, 1e-4));
    const th = f32(f32(f32(a.x * f32(x0)) + f32(a.y * f32(z0))) - f32(b.x) - f32(b.z * tau));
    const c = f32(Math.cos(th));
    const s = f32(Math.sin(th));
    const dirX = f32(a.x / b.y);
    const dirZ = f32(a.y / b.y);
    dx = f32(dx + f * a.w * dirX * c);
    dz = f32(dz + f * a.w * dirZ * c);
    dy = f32(dy + f * a.z * s);
  }
  return { x: dx, y: dy, z: dz };
}
