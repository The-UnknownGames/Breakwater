# Boat models: dropping in downloaded ones

Every boat has a built-in procedural model. A downloaded `.glb` replaces it
when `public/models/manifest.json` lists it. The game fits it for you:

- turns it bow-forward (its longest horizontal side; override with `yawDeg`),
- scales it to the boat's hull length and centres it,
- sits its keel at the design draft (nudge with `lift`, metres),
- adds the attachment points it lacks (tow point, helm camera, bow cleat,
  searchlight, propeller, rudder) from the built-in model, so towing, the
  helm view and physics line up.

## Steps

1. Download the model as **glTF** (Sketchfab: *Download 3D Model → glTF*,
   or *Autoconverted format (glb)*). Check the licence: CC0 or CC BY only;
   CC BY needs the credit line below.
2. Save it as `public/models/<name>.glb`.
3. Add it to `public/models/manifest.json`:

```json
{
  "models": [
    { "id": "bulwark", "file": "tug.glb", "yawDeg": 180, "scale": 1, "lift": 0, "credit": "\"Tug Boat\" by gogiart (CC BY 4.0)" }
  ]
}
```

`id` is the boat (`marlin`, `kestrel`, `bulwark`, `kittiwake`, `solace`,
`islander`, `northfarer`). If the boat faces backwards use `yawDeg: 180`;
if it sits too low or high, `lift`. Credits show on the Controls screen.

## Keep it phone-friendly

A Pixel-class phone copes with roughly 100k triangles and 2K textures per
boat. Heavier downloads can be shrunk with glTF-Transform (on npm):

```
npx @gltf-transform/cli optimize in.glb public/models/<name>.glb --texture-size 2048 --simplify-ratio 0.5
```

## Candidates (free on Sketchfab, check each licence)

| Boat | Model |
|---|---|
| Bulwark (tug) | [Tug Boat by gogiart](https://sketchfab.com/3d-models/tug-boat-2260a148c83c41c0b9ffc491f8ee7863), [Tug Boat by Rat](https://sketchfab.com/3d-models/tug-boat-f139f10ec0a54d07a24700fb96e0809a), [Rastar 3200 tugboat](https://sketchfab.com/3d-models/rastar-3200-tugboat-1bbadbe4ab0a4b2599cd3f450942e6fe) |
| Kittiwake / traffic trawlers | [Salt-Beaten Fishing Trawler (Game-Ready)](https://sketchfab.com/3d-models/salt-beaten-fishing-trawler-game-ready-fd28c35b76754c9386b32aa281a0e238), [Smal Fishing Trawler by gogiart](https://sketchfab.com/3d-models/smal-fishing-trawler-e3175ce6f47d47f6ac3dfd7fc5122789), [Fishing Boat by CharlieCatling](https://sketchfab.com/3d-models/fishing-boat-a3f138089e164200b34bfb1bebb978c2) |
| Islander (ferry) | [Ferry Vehicle Carrier by gogiart](https://sketchfab.com/3d-models/ferry-vehicle-carrier-67659321a0184551a6e247cfdb0d21e3), [Ferry by saurabh.buradkar7](https://sketchfab.com/3d-models/ferry-578b1b795ee94e94a2bdaec9371fc3e3) |
| Northfarer (freighter) | [Fishing Trawler 44.2m by gogiart](https://sketchfab.com/3d-models/fishing-trawler-442m-856589e1b5ec4099a0d3f4ca95da1901) as a stand-in; browse the [cargo ship tag](https://sketchfab.com/tags/cargo-ship) |
| Marlin / Kestrel / Solace | browse [speedboat](https://sketchfab.com/tags/speedboat), [motor-boat](https://sketchfab.com/tags/motor-boat), [yacht](https://sketchfab.com/tags/yacht), filtered to *Downloadable* |
