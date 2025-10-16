#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def stable_id(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def tokenize_path(path: Path) -> list[str]:
    parts = []
    for p in path.parts:
        base = os.path.splitext(p)[0]
        parts.extend(re.split(r"[^a-zA-Z0-9]+", base))
    return [t.lower() for t in parts if t]


CATEGORY_KEYWORDS = {
    "outerwear": [
        "jacket",
        "blazer",
        "coat",
        "parka",
        "puffer",
        "gilet",
        "vest",
        "windbreaker",
        "shell",
        "overcoat",
        "trench",
        "montone",
        "shearling",
    ],
    "bottom": [
        "jean",
        "jeans",
        "pant",
        "pants",
        "trouser",
        "trousers",
        "short",
        "shorts",
        "chino",
        "cargos",
        "cargo",
        "skirt",
    ],
    "shoes": [
        "sneaker",
        "sneakers",
        "runner",
        "trainers",
        "shoe",
        "shoes",
        "boot",
        "boots",
        "loafer",
        "loafers",
        "chelsea",
        "derby",
        "oxford",
        "mocassino",
        "samba",
    ],
    "accessory": [
        "belt",
        "hat",
        "cap",
        "beanie",
        "bag",
        "watch",
        "scarf",
        "glove",
        "gloves",
        "sunglass",
        "sunglasses",
    ],
}


TOP_BASE_KEYWORDS = [
    "tee",
    "tshirt",
    "t-shirt",
    "polo",
    "henley",
    "tank",
    "crew",
    "crewneck",
]

TOP_OVERSHIRT_KEYWORDS = [
    "shirt",
    "button",
    "oxford",
    "overshirt",
    "flannel",
    "camp",
    "cabana",
    "hoodie",
    "crewneck",
    "sweater",
    "knit",
    "jumper",
    "sweatshirt",
]


STYLE_KEYWORDS = {
    "sport": [
        "nike",
        "adidas",
        "new",
        "balance",
        "salomon",
        "runner",
        "training",
        "track",
        "gym",
        "samba",
    ],
    "street": [
        "street",
        "graphic",
        "cargo",
        "oversized",
        "salomon",
        "samba",
        "golden",
        "goose",
        "hoodie",
        "denim",
    ],
    "formal": [
        "blazer",
        "trouser",
        "oxford",
        "derby",
        "loafer",
        "loafers",
        "chelsea",
        "suit",
        "mocassino",
        "pleated",
    ],
    "casual": [
        "tee",
        "tshirt",
        "polo",
        "henley",
        "jean",
        "jeans",
        "chino",
        "sneaker",
        "sneakers",
        "linen",
        "denim",
    ],
}


COLOR_KEYWORDS = [
    "black",
    "white",
    "navy",
    "beige",
    "green",
    "brown",
    "denim",
    "blue",
    "grey",
    "gray",
    "tan",
    "cream",
    "khaki",
    "olive",
    "red",
    "yellow",
    "purple",
    "orange",
]


MID_LAYER_HINTS = {"mid", "midlayer", "mid-layer", "midlayers", "knit", "sweater", "crewneck", "jumper", "sweatshirt", "hoodie"}


def detect_category_and_toplayer(tokens: list[str]) -> tuple[str | None, str | None]:
    # Prioritize mid-layer / overshirt regardless of tee-like keywords
    if any(t in tokens for t in TOP_OVERSHIRT_KEYWORDS) or any(t in tokens for t in MID_LAYER_HINTS):
        return "top", "overshirt"
    # Otherwise treat as base top
    if any(t in tokens for t in TOP_BASE_KEYWORDS):
        return "top", "base"
    # Other categories
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(t in tokens for t in kws):
            return cat, None
    return None, None


def detect_style_hints(tokens: list[str]) -> list[str]:
    hints: set[str] = set()
    for style, kws in STYLE_KEYWORDS.items():
        if any(t in tokens for t in kws):
            hints.add(style)
    # Basic type-to-style fallbacks
    if "tee" in tokens or "tshirt" in tokens or "polo" in tokens or "henley" in tokens:
        hints.add("casual")
    if "blazer" in tokens or "trouser" in tokens or "loafer" in tokens or "loafers" in tokens or "chelsea" in tokens or "mocassino" in tokens:
        hints.add("formal")
    if "cargo" in tokens or "denim" in tokens or "samba" in tokens or "salomon" in tokens:
        hints.add("street")
    if "nike" in tokens or "adidas" in tokens or "new" in tokens and "balance" in tokens:
        hints.add("sport")
    return sorted(hints)


def detect_color_hints(tokens: list[str]) -> list[str]:
    colors: set[str] = set()
    for c in COLOR_KEYWORDS:
        if c in tokens:
            colors.add(c)
    # Normalize gray/grey
    if "gray" in colors or "grey" in colors:
        colors.add("grey")
        colors.discard("gray")
    return sorted(colors)


def build_manifest(src_root: Path, dest_assets: Path) -> list[dict]:
    records: list[dict] = []
    for root, _, files in os.walk(src_root):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in IMAGE_EXTS:
                continue
            abs_path = Path(root) / fname
            rel = abs_path.relative_to(src_root)
            tokens = tokenize_path(rel)

            category, top_layer = detect_category_and_toplayer(tokens)
            if category is None:
                # Skip completely unrecognized items to keep generator stable
                continue

            style_hints = detect_style_hints(tokens)
            color_hints = detect_color_hints(tokens)

            # Compute destination path preserving folder structure
            dest_path = dest_assets / rel
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            # Copy file (no downscale)
            if not dest_path.exists() or os.path.getmtime(abs_path) > os.path.getmtime(dest_path):
                shutil.copy2(abs_path, dest_path)

            item_id = stable_id(str(rel))
            name = rel.stem

            rec = {
                "id": item_id,
                "name": name,
                "category": category,
                "topLayer": top_layer,  # base | overshirt for category==top
                "file": f"assets/{rel.as_posix()}",
                "colorHints": color_hints,
                "styleHints": style_hints,
            }
            records.append(rec)
    return records


def main():
    ap = argparse.ArgumentParser(description="Build outfit manifest and copy assets")
    ap.add_argument("--source", required=True, help="Source folder with images")
    ap.add_argument("--dest", required=True, help="Destination assets folder under public")
    ap.add_argument("--manifest", required=True, help="Path to output manifest.json")
    args = ap.parse_args()

    src_root = Path(args.source).expanduser().resolve()
    dest_assets = Path(args.dest).expanduser().resolve()
    manifest_path = Path(args.manifest).expanduser().resolve()

    if not src_root.exists():
        raise SystemExit(f"Source folder not found: {src_root}")

    dest_assets.mkdir(parents=True, exist_ok=True)
    records = build_manifest(src_root, dest_assets)

    # Sort records by category then name for determinism
    records.sort(key=lambda r: (r["category"], r.get("topLayer") or "", r["name"]))

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    print(f"Wrote manifest with {len(records)} items -> {manifest_path}")


if __name__ == "__main__":
    main()


