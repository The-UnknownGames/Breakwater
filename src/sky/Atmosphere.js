// Combines time of day + weather into every lighting input: sun/moon light,
// sky ambient, fog colour/density, cloud look, exposure and colour grade.

import * as THREE from 'three';
import { fogUniforms } from '../render/fogGLSL.js';
import { WORLD } from '../config/palette.js';
import { LIGHT, FOG, OCEAN } from '../config/render.js';
import { windTravelVector } from '../ocean/Waves.js';

const clearSky = new THREE.Color(0.42, 0.55, 0.72);
const overcast = new THREE.Color(WORLD.overcastSky);
const stormSky = new THREE.Color(WORLD.stormSky);
const nightSky = new THREE.Color(WORLD.nightSky);
const moon = new THREE.Color(WORLD.moonlight);
const hazeClear = new THREE.Color(0.62, 0.7, 0.78);
const tmp = new THREE.Color();

function luminance(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class Atmosphere {
  constructor(scene) {
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x223038, 0.5);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);
    scene.add(this.hemi);
    this.lightDir = new THREE.Vector3();
    this.sunRadiance = new THREE.Color();
    this.skyAmbient = new THREE.Color();
    this.exposure = LIGHT.exposureBase;
    this.saturation = 1;
    this.contrast = 1;
    this.windTravel = { x: 1, z: 0 };
  }

  apply(dayNight, weather, flash, targets, dt = 0) {
    const p = weather.params;
    const cover = p.cloudCover;
    const dark = p.cloudDark;
    this.windTravel = windTravelVector(p.windDirectionDeg);

    // Direct light: the sun by day, the moon by night, dimmed by clouds.
    const cloudTrans = 1 - cover * 0.88;
    const sunI = LIGHT.sunIntensity * dayNight.sunFactor * cloudTrans;
    const night = 1 - dayNight.dayFactor;
    const moonI = LIGHT.moonIntensity * night * (1 - cover * 0.7);
    const useMoon = dayNight.sunFactor < 0.05;
    this.lightDir.copy(useMoon ? dayNight.moonDir : dayNight.sunDir);
    if (useMoon) {
      this.sunRadiance.copy(moon).multiplyScalar(moonI);
    } else {
      this.sunRadiance.copy(dayNight.sunColor).multiplyScalar(sunI);
    }

    // Sky ambient: clear blue -> overcast grey -> storm slate, scaled by daylight.
    tmp.copy(clearSky).lerp(overcast, Math.min(1, cover * 1.15)).lerp(stormSky, dark);
    // Low sun tints the whole sky dome, even through broken cloud.
    const golden = dayNight.goldenFactor * dayNight.sunFactor;
    tmp.lerp(dayNight.sunColor, golden * LIGHT.goldenSkyTint * (0.4 + 0.6 * cloudTrans));
    const day = lerp(LIGHT.skyAmbientNight, LIGHT.skyAmbientDay, dayNight.dayFactor);
    this.skyAmbient.copy(tmp).multiplyScalar(day * (1 - dark * 0.55));
    this.skyAmbient.lerp(nightSky, night * 0.6);
    // Exposure adapts slowly and ignores lightning, like a real camera.
    const lum = luminance(this.skyAmbient) + 0.2 * luminance(this.sunRadiance);
    const maxExp = lerp(LIGHT.exposureMaxNight, LIGHT.exposureMaxDay, dayNight.dayFactor);
    const comp = Math.min(Math.max(Math.sqrt(LIGHT.exposureRefLum / Math.max(lum, 1e-4)), 1), maxExp);
    const target = LIGHT.exposureBase * comp;
    const k = dt > 0 ? Math.min(1, dt / LIGHT.exposureAdaptSeconds) : 1;
    this.exposure += (target - this.exposure) * k;
    this.skyAmbient.r += flash * LIGHT.flashAmbient * 0.9;
    this.skyAmbient.g += flash * LIGHT.flashAmbient * 0.95;
    this.skyAmbient.b += flash * LIGHT.flashAmbient;

    // Fog: haze colour follows the sky, density from visibility.
    const fu = fogUniforms;
    fu.uFogColor.value.copy(hazeClear).multiplyScalar(lerp(LIGHT.fogBrightClear, 1, cover));
    fu.uFogColor.value.lerp(overcast, cover).lerp(stormSky, dark * 0.45);
    fu.uFogColor.value.multiplyScalar(day * (1 - dark * 0.5) * 0.9);
    fu.uFogColor.value.lerp(nightSky, night * 0.7);
    fu.uFogColor.value.addScalar(flash * LIGHT.flashAmbient * 0.6);
    fu.uFogDensity.value = FOG.koschmieder / p.visibility;
    fu.uFogFalloff.value = FOG.heightFalloff;
    fu.uFogSunDir.value.copy(dayNight.sunDir);
    fu.uFogSunColor.value.copy(dayNight.sunColor).multiplyScalar(sunI * 0.35 * (1 - dark));

    this.sunLight.position.copy(this.lightDir).multiplyScalar(100);
    this.sunLight.intensity = useMoon ? moonI : sunI;
    this.sunLight.color.copy(useMoon ? moon : dayNight.sunColor);
    this.hemi.color.copy(this.skyAmbient);
    this.hemi.groundColor.copy(this.skyAmbient).multiplyScalar(0.35);
    this.hemi.intensity = 1;

    this.saturation = p.saturation * lerp(0.75, 1, dayNight.dayFactor) * (1 + golden * 0.3);
    this.contrast = p.contrast;

    this.applyOcean(targets.ocean, p);
    this.applyClouds(targets.clouds, p, dayNight, flash);
  }

  applyOcean(ocean, p) {
    const u = ocean.uniforms;
    u.uSunDir.value.copy(this.lightDir);
    u.uSunColor.value.copy(this.sunRadiance);
    u.uSkyColor.value.copy(this.skyAmbient);
    u.uFoamThreshold.value = p.foam;
    u.uClarity.value = p.clarity ?? 0.5;
    const w = Math.min(1, p.windKn / 50);
    u.uDetailStrength.value = lerp(OCEAN.detailStrengthCalm, OCEAN.detailStrengthStorm, w);
    u.uRoughPow.value = lerp(OCEAN.roughSpecPower, OCEAN.roughSpecPower * 0.35, w);
    u.uWindDir.value.set(this.windTravel.x, this.windTravel.z);
    u.uWindSpeed.value = p.windKn;
  }

  applyClouds(clouds, p, dayNight, flash) {
    const u = clouds.uniforms;
    u.uCover.value = p.cloudCover;
    u.uDark.value = p.cloudDark;
    u.uFlash.value = flash;
    u.uSunDir.value.copy(dayNight.sunDir);
    u.uSunColor.value.copy(dayNight.sunColor).multiplyScalar(LIGHT.sunIntensity * dayNight.sunFactor);
    u.uSkyColor.value.copy(this.skyAmbient);
    u.uCloudDark.value.copy(stormSky).multiplyScalar(0.3 * Math.max(dayNight.dayFactor, 0.05));
  }
}
