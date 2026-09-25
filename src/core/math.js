// Small allocation-free vector/quaternion helpers for the physics code, which
// must run headless (no three.js). Vectors are {x, y, z}; quats {x, y, z, w}.

export function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

// out = q * v * q^-1
export function rotate(q, v, out = vec()) {
  const { x, y, z } = v;
  const tx = 2 * (q.y * z - q.z * y);
  const ty = 2 * (q.z * x - q.x * z);
  const tz = 2 * (q.x * y - q.y * x);
  out.x = x + q.w * tx + (q.y * tz - q.z * ty);
  out.y = y + q.w * ty + (q.z * tx - q.x * tz);
  out.z = z + q.w * tz + (q.x * ty - q.y * tx);
  return out;
}

// out = q^-1 * v * q (world -> local)
export function rotateInv(q, v, out = vec()) {
  const inv = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  return rotate(inv, v, out);
}

export function cross(a, b, out = vec()) {
  const x = a.y * b.z - a.z * b.y;
  const y = a.z * b.x - a.x * b.z;
  const z = a.x * b.y - a.y * b.x;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function quatFromAxisAngle(ax, ay, az, angle) {
  const s = Math.sin(angle / 2);
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(angle / 2) };
}

export function quatMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

// Heel (roll about the boat's forward axis) and pitch from a body quaternion,
// in radians. Heel > 0 = starboard (local +X) side down.
export function heelPitch(q) {
  const up = rotate(q, vec(0, 1, 0));
  const fwd = rotate(q, vec(0, 0, 1));
  const right = rotate(q, vec(1, 0, 0));
  const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
  const heel = Math.atan2(-right.y, up.y);
  return { heel, pitch, upY: up.y };
}

export function headingOf(q) {
  const fwd = rotate(q, vec(0, 0, 1));
  // Compass bearing: +X east, -Z north.
  const b = Math.atan2(fwd.x, -fwd.z);
  return (b + Math.PI * 2) % (Math.PI * 2);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
