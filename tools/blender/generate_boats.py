"""Blender generator for Breakwater boats (spec 2.6).

Run headless:
    blender --background --python tools/blender/generate_boats.py
Reads tools/blender/boats.json (written by scripts/export-boat-params.mjs),
builds each hull from the same parametric sections the physics uses, adds a
bevelled deckhouse, rails, bitt and fenders, the named empties (towPoint,
bowCleat, propeller, rudder, searchlight, helmCamera), exports
public/models/<id>.glb and adds the id to public/models/manifest.json.
Units: metres, +Z forward in game space (glTF export converts Blender Z-up).
"""
import json
import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARAMS = json.load(open(os.path.join(ROOT, "tools", "blender", "boats.json")))


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def station(h, s):
    """Port of hullStation() in src/physics/HullShape.js."""
    if s < h["maxBeamAt"]:
        w = h["transomWidth"] + (1 - h["transomWidth"]) * math.sin(math.pi / 2 * s / h["maxBeamAt"])
    else:
        t = (s - h["maxBeamAt"]) / (1 - h["maxBeamAt"])
        w = math.pow(math.cos(t * math.pi / 2), 0.7)
    half = max(h["beam"] / 2 * w, 0.004)
    deck = h["freeboard"] + h["sheerRise"] * s * s
    keel = -h["draft"] * (1 - h["forefootRise"] * smoothstep(0.55, 1, s))
    n = h["fullness"] + (h["bowFullness"] - h["fullness"]) * smoothstep(0.45, 1, s)
    return dict(z=(s - 0.5) * h["length"], half=half, deck=deck, keel=keel, n=n)


def section_point(st, u):
    th = u * math.pi / 2
    e = 2 / st["n"]
    x = st["half"] * math.pow(math.sin(th), e)
    y = st["keel"] + (st["deck"] - st["keel"]) * (1 - math.pow(math.cos(th), e))
    return x, y


def game_to_blender(x, y, z):
    # Game: +Y up, +Z forward. Blender: +Z up, -Y forward (glTF exporter maps back).
    return (x, -z, y)


def material(name, hex_color, rough=0.5, metal=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    r = ((hex_color >> 16) & 255) / 255
    g = ((hex_color >> 8) & 255) / 255
    b = (hex_color & 255) / 255
    bsdf.inputs["Base Color"].default_value = (r ** 2.2, g ** 2.2, b ** 2.2, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return mat


def build_hull(h, pal, stations=48, per_side=18):
    verts = []
    faces = []
    ring = per_side * 2 + 1
    for i in range(stations + 1):
        st = station(h, i / stations)
        for j in range(per_side, -per_side - 1, -1):
            x, y = section_point(st, abs(j) / per_side)
            verts.append(game_to_blender(x if j >= 0 else -x, y, st["z"]))
    for i in range(stations):
        for j in range(ring - 1):
            a = i * ring + j
            faces.append((a, a + 1, a + ring + 1, a + ring))
    mesh = bpy.data.meshes.new("hull")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("hull", mesh)
    bpy.context.collection.objects.link(obj)
    white = material("hull_white", pal["hullWhite"], 0.42)
    red = material("antifouling", pal["antifouling"], 0.6)
    navy = material("navy", pal["workboatNavy"], 0.5)
    for m in (white, red, navy):
        obj.data.materials.append(m)
    for poly in obj.data.polygons:
        zc = sum(obj.data.vertices[v].co.z for v in poly.vertices) / len(poly.vertices)
        poly.material_index = 1 if zc < 0.06 else (2 if zc < 0.2 else 0)
        poly.use_smooth = True
    return obj


def box(name, size, loc, mat, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=game_to_blender(*loc))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new("bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 2
    o.data.materials.append(mat)
    return o


def empty(name, loc):
    o = bpy.data.objects.new(name, None)
    o.location = game_to_blender(*loc)
    bpy.context.collection.objects.link(o)
    return o


def build_boat(boat_id, spec, pal):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    h = spec["hull"]
    build_hull(h, pal)
    white = material("house_white", pal["hullWhite"], 0.45)
    navy = material("navy", pal["workboatNavy"], 0.5)
    orange = material("rescue_orange", pal["rescueOrange"], 0.6)
    steel = material("steel", 0x2A2E31, 0.6, 0.5)
    deck_y = station(h, 0.625)["deck"]
    box("deckhouse", (2.9, 1.95, 3.6), (0, deck_y + 0.975, 1.2), white)
    box("roof", (3.1, 0.1, 4.0), (0, deck_y + 2.0, 1.3), navy, 0.02)
    stern = station(h, 0.1)
    box("bitt", (0.9, 0.12, 0.2), (0, stern["deck"] + 0.45, -h["length"] / 2 + 1.3), steel, 0.02)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.07, location=game_to_blender(1.5, deck_y + 0.9, 0.3))
    bpy.context.active_object.data.materials.append(orange)
    bow = station(h, 0.95)
    empty("towPoint", (0, stern["deck"] + 0.45, -h["length"] / 2 + 1.3))
    empty("bowCleat", (0, bow["deck"] + 0.1, h["length"] / 2 - 0.6))
    empty("propeller", tuple(spec["prop"]["pos"]))
    empty("rudder", tuple(spec["rudder"]["pos"]))
    empty("searchlight", (0.6, deck_y + 2.2, 2.9))
    empty("helmCamera", (0.55, deck_y + 1.58, 1.8))
    out = os.path.join(ROOT, "public", "models", f"{boat_id}.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_yup=True)
    print("exported", out)
    return out


def main():
    manifest_path = os.path.join(ROOT, "public", "models", "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {"models": []}
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(PARAMS["boats"].keys())
    for boat_id in only:
        build_boat(boat_id, PARAMS["boats"][boat_id], PARAMS["palette"])
        if boat_id not in manifest["models"]:
            manifest["models"].append(boat_id)
    json.dump(manifest, open(manifest_path, "w"), indent=2)


main()
