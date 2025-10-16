#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

try:
    from PIL import Image
except Exception:
    Image = None


CATEGORY_TITLES = {
    "top_base": "Tops — Base",
    "top_overshirt": "Tops — Overshirt / Midlayer",
    "outerwear": "Jackets / Outerwear",
    "bottom": "Bottoms",
    "shoes": "Shoes",
    "accessory": "Accessories",
}


def read_manifest(manifest_path: Path) -> list[dict]:
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def rgba_average_color(image_path: Path) -> tuple[float, float, float]:
    if Image is None:
        # Fallback: neutral mid-gray if Pillow not available
        return (0.5, 0.5, 0.5)
    im = Image.open(image_path).convert("RGBA")
    # Downsample for speed
    im = im.copy()
    im.thumbnail((128, 128))
    px = im.getdata()
    r_sum = g_sum = b_sum = n = 0
    for r, g, b, a in px:
        if a == 0:
            continue
        r_sum += r
        g_sum += g
        b_sum += b
        n += 1
    if n == 0:
        return (0.5, 0.5, 0.5)
    return (r_sum / (255 * n), g_sum / (255 * n), b_sum / (255 * n))


def rgb_to_hsv(r: float, g: float, b: float) -> tuple[float, float, float]:
    mx = max(r, g, b)
    mn = min(r, g, b)
    diff = mx - mn
    if diff == 0:
        h = 0.0
    elif mx == r:
        h = (60 * ((g - b) / diff) + 360) % 360
    elif mx == g:
        h = (60 * ((b - r) / diff) + 120) % 360
    else:
        h = (60 * ((r - g) / diff) + 240) % 360
    s = 0.0 if mx == 0 else diff / mx
    v = mx
    return (h, s, v)


def color_bucket_name(rgb: tuple[float, float, float]) -> str:
    r, g, b = rgb
    h, s, v = rgb_to_hsv(r, g, b)
    # neutrals
    if v < 0.18:
        return "black"
    if s < 0.12 and v > 0.9:
        return "white"
    if s < 0.12:
        return "grey"
    # buckets by hue
    if 30 <= h < 70:
        return "yellow"
    if 0 <= h < 20 or 340 <= h <= 360:
        return "red"
    if 70 <= h < 170:
        # greens
        return "green"
    if 170 <= h < 255:
        return "blue"
    if 255 <= h < 290:
        return "purple"
    if 290 <= h < 340:
        return "magenta"
    return "other"


COLOR_ORDER = [
    "white",
    "beige",
    "tan",
    "brown",
    "green",
    "blue",
    "navy",
    "denim",
    "grey",
    "black",
    "yellow",
    "orange",
    "red",
    "purple",
    "magenta",
    "other",
]


def best_color_label(item: dict, assets_root: Path) -> tuple[str, tuple[float, float, float]]:
    # Prefer explicit colorHints if present (first known in COLOR_ORDER)
    hints = [c.lower() for c in (item.get("colorHints") or [])]
    for c in COLOR_ORDER:
        if c in hints:
            return c, None
    # Otherwise sample average color of the image
    img_path = assets_root / Path(item["file"])  # already assets/... relative
    rgb = rgba_average_color(img_path)
    bucket = color_bucket_name(rgb)
    return bucket, rgb


def categorize_items(items: list[dict]) -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {
        "top_base": [],
        "top_overshirt": [],
        "outerwear": [],
        "bottom": [],
        "shoes": [],
        "accessory": [],
    }
    for it in items:
        if it["category"] == "top":
            if it.get("topLayer") == "overshirt":
                buckets["top_overshirt"].append(it)
            else:
                buckets["top_base"].append(it)
        elif it["category"] in buckets:
            buckets[it["category"]].append(it)
    return buckets


def tex_escape(s: str) -> str:
    return (
        s.replace("\\", r"\textbackslash{}")
        .replace("_", r"\_")
        .replace("%", r"\%")
        .replace("#", r"\#")
        .replace("&", r"\&")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("$", r"\$")
    )


def build_latex(buckets: dict[str, list[dict]], assets_root: Path) -> str:
    # Landscape, white, mono; fixed square cells grid per category page
    pre = r"""
\documentclass[10pt]{article}
\usepackage[landscape,margin=10mm]{geometry}
\usepackage{graphicx}
\usepackage{float}
\usepackage{array}
\renewcommand{\familydefault}{\ttdefault}
\setlength{\parindent}{0pt}
\pagestyle{empty}
\graphicspath{{./}{../}}
\begin{document}
"""
    body_parts = []

    def sort_by_color(items: list[dict]) -> list[dict]:
        enriched = []
        for it in items:
            label, rgb = best_color_label(it, assets_root.parent)
            order = COLOR_ORDER.index(label) if label in COLOR_ORDER else len(COLOR_ORDER)
            enriched.append((order, label, it))
        enriched.sort(key=lambda x: (x[0], x[1], x[2]["name"]))
        return [it for _, _, it in enriched]

    # Compute optimal square grid per page (A4 landscape), using symmetric spacing
    gap_mm = 6.0
    textwidth_mm = 297.0 - 2 * 10.0
    textheight_mm = 210.0 - 2 * 10.0

    def best_grid(n_items: int) -> tuple[int, int, float]:
        best: tuple[int, int, float] | None = None
        # Expand search space so everything can fit on one slide
        for cols in range(2, 11):
            for rows in range(1, 9):
                cap = cols * rows
                if cap < n_items:
                    continue
                cw = (textwidth_mm - gap_mm * (cols - 1)) / cols
                ch = (textheight_mm - gap_mm * (rows - 1)) / rows
                cell = min(cw, ch)
                if cell <= 0:
                    continue
                if best is None or cell > best[2]:
                    best = (cols, rows, cell)
        if best is None:
            # fallback 5x3
            fallback = min((textwidth_mm - gap_mm * 4) / 5, (textheight_mm - gap_mm * 2) / 3)
            return (5, 3, fallback)
        return best

    for key in ["top_base", "top_overshirt", "outerwear", "bottom", "shoes", "accessory"]:
        items = buckets.get(key, [])
        if not items:
            continue
        title = CATEGORY_TITLES.get(key, key.title())
        # Minimal title line (monospace), much lower vertical footprint than \section*
        body_parts.append(f"\\noindent\\small\\texttt{{{tex_escape(title)}}}\\par\\vspace*{{2mm}}\n")
        ordered = sort_by_color(items)
        # Single page per category: pick a grid that fits all items
        cols, rows, cell_mm_raw = best_grid(len(ordered))
        cell_mm = max(1.0, cell_mm_raw - 1.5)  # reduce to account for title line as well
        header_mm = 6.0
        used_h = rows * cell_mm + (rows - 1) * gap_mm + header_mm
        top_pad = max(0.0, (textheight_mm - used_h) / 2)
        body_parts.append(f"\\vspace*{{{top_pad:.2f}mm}}\\\n")
        # Render grid rows centered horizontally
        for r in range(rows):
            row_items = ordered[r * cols:(r + 1) * cols]
            if not row_items:
                break
            line_cells: list[str] = []
            for it in row_items:
                path = tex_escape(it["file"])  # assets/... relative to public
                # Small description under each image (name, hyphens turned to spaces)
                label = tex_escape(it["name"].replace('-', ' '))
                line_cells.append(
                    f"\\begin{{minipage}}[c][{cell_mm:.2f}mm][c]{{{cell_mm:.2f}mm}}\\centering\n"
                    f"\\includegraphics[width={cell_mm:.2f}mm,height={cell_mm:.2f}mm,keepaspectratio]{{{path}}}\\\\\n"
                    f"\\vspace*{{0.8mm}}\\tiny {label}\\\n"
                    f"\\end{{minipage}}"
                )
            row_tex = (f" \\hspace*{{{gap_mm:.2f}mm}} ").join(line_cells)
            body_parts.append(f"\\makebox[\\textwidth][c]{{{row_tex}}}\\\n")
            if r < rows - 1:
                body_parts.append(f"\\vspace*{{{gap_mm:.2f}mm}}\\\n")
        body_parts.append("\\newpage\n")

    post = "\\end{document}\n"
    return pre + "".join(body_parts) + post


def compile_pdf(tex_content: str, output_dir: Path) -> Path:
    ts = time.strftime("%Y%m%d-%H%M%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    tex_path = output_dir / f"catalog-{ts}.tex"
    pdf_path = output_dir / f"catalog-{ts}.pdf"
    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(tex_content)
    # Compile with pdflatex (twice not necessary here)
    proc = subprocess.run(["pdflatex", "-interaction=nonstopmode", tex_path.name], cwd=str(output_dir))
    # Even if returncode != 0, keep going if PDF exists (warnings sometimes set non-zero)
    if not pdf_path.exists():
        raise SystemExit(f"pdflatex failed (code {proc.returncode}) and no PDF generated")
    return pdf_path


def main():
    ap = argparse.ArgumentParser(description="Generate a PDF catalog from manifest.json")
    ap.add_argument("--manifest", required=True, help="Path to manifest.json")
    ap.add_argument("--public", required=True, help="Path to public directory (for assets)")
    ap.add_argument("--outdir", required=True, help="Output directory for the PDF")
    args = ap.parse_args()

    manifest_path = Path(args.manifest).expanduser().resolve()
    public_dir = Path(args.public).expanduser().resolve()
    out_dir = Path(args.outdir).expanduser().resolve()

    items = read_manifest(manifest_path)
    buckets = categorize_items(items)
    tex = build_latex(buckets, public_dir / "assets")
    pdf = compile_pdf(tex, out_dir)
    print(f"Wrote {pdf}")


if __name__ == "__main__":
    main()


