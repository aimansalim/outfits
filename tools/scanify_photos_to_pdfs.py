#!/usr/bin/env python3
import argparse
import os
import sys
import time
from pathlib import Path

try:
    from PIL import Image, ImageOps, ImageFilter, ImageEnhance
except Exception as e:  # pragma: no cover
    sys.stderr.write(
        "Pillow (PIL) is required. Install with: pip install pillow\n"
    )
    raise


def list_images(input_dir: Path) -> list[Path]:
    valid_exts = {".jpg", ".jpeg", ".png", ".heic"}
    files = []
    for p in sorted(input_dir.iterdir()):
        if p.is_file() and p.suffix.lower() in valid_exts:
            files.append(p)
    return files


def looks_like_carta_id(filename: str) -> bool:
    name = filename.lower()
    tokens = ["carta", "id", "carta-id"]
    return any(t in name for t in tokens)


def open_and_fix_orientation(image_path: Path) -> Image.Image:
    img = Image.open(image_path)
    # Respect EXIF rotation if present
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    return img


def scanify(img: Image.Image) -> Image.Image:
    # Convert to grayscale for a document look
    gray = img.convert("L")
    # Auto contrast to stretch histogram
    gray = ImageOps.autocontrast(gray, cutoff=1)
    # Slight median filter to reduce color noise before sharpening
    gray = gray.filter(ImageFilter.MedianFilter(size=3))
    # Unsharp mask to improve text/edge definition
    gray = gray.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
    # Increase contrast a touch more
    enhancer = ImageEnhance.Contrast(gray)
    gray = enhancer.enhance(1.15)
    return gray


def scanify_color(img: Image.Image) -> Image.Image:
    # Keep color but enhance like a scanned document
    rgb = img.convert("RGB")
    rgb = ImageOps.autocontrast(rgb, cutoff=1)
    rgb = rgb.filter(ImageFilter.MedianFilter(size=3))
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.8, percent=130, threshold=3))
    rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
    rgb = ImageEnhance.Color(rgb).enhance(1.05)
    return rgb


def to_pdf_pages(images: list[Image.Image]) -> list[Image.Image]:
    pages: list[Image.Image] = []
    for im in images:
        if im.mode != "RGB":
            pages.append(im.convert("RGB"))
        else:
            pages.append(im)
    return pages


def save_pdf(pages: list[Image.Image], output_path: Path) -> None:
    if not pages:
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    first, rest = pages[0], pages[1:]
    first.save(output_path, "PDF", resolution=300.0, save_all=True, append_images=rest)


def main() -> None:
    ap = argparse.ArgumentParser(description="Apply a scanned look to photos and merge into PDFs")
    ap.add_argument("--input", required=True, help="Input directory with photos")
    ap.add_argument("--outdir", required=True, help="Output directory for PDFs")
    ap.add_argument("--carta_prefix", default="carta-id", help="Filename prefix for Carta-ID PDF")
    ap.add_argument("--docs_prefix", default="docs", help="Filename prefix for other docs PDF")
    args = ap.parse_args()

    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.outdir).expanduser().resolve()
    ts = time.strftime("%Y%m%d-%H%M%S")

    all_images = list_images(input_dir)
    if not all_images:
        print(f"No images found in {input_dir}")
        return

    carta_imgs: list[Image.Image] = []
    docs_imgs: list[Image.Image] = []

    for p in all_images:
        try:
            img = open_and_fix_orientation(p)
            if looks_like_carta_id(p.name):
                carta_imgs.append(scanify_color(img))
            else:
                docs_imgs.append(scanify(img))
        except Exception as e:
            print(f"Skipping {p.name}: {e}")

    carta_out = output_dir / f"{args.carta_prefix}-{ts}.pdf"
    docs_out = output_dir / f"{args.docs_prefix}-{ts}.pdf"

    if carta_imgs:
        save_pdf(to_pdf_pages(carta_imgs), carta_out)
        print(f"Wrote {carta_out}")
    else:
        print("No Carta-ID images detected.")

    if docs_imgs:
        save_pdf(to_pdf_pages(docs_imgs), docs_out)
        print(f"Wrote {docs_out}")
    else:
        print("No other documents detected.")


if __name__ == "__main__":
    main()


