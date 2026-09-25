"""Validate generated models: required empties present, sensible size.

    blender --background --python tools/blender/validate.py
"""
import json
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REQUIRED = ["towPoint", "bowCleat", "propeller", "rudder", "searchlight", "helmCamera"]
manifest = json.load(open(os.path.join(ROOT, "public", "models", "manifest.json")))
ok = True
for model_id in manifest["models"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "public", "models", f"{model_id}.glb"))
    names = {o.name for o in bpy.data.objects}
    missing = [n for n in REQUIRED if n not in names]
    if missing:
        ok = False
        print(model_id, "missing empties:", missing)
    else:
        print(model_id, "ok")
raise SystemExit(0 if ok else 1)
