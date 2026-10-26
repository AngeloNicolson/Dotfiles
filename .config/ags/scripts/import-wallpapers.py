#!/usr/bin/env python3
"""Import a folder of images as a wallpaper set for the AGS carousel.

    import-wallpapers.py SRC SET [--dry-run] [--jobs N]

SRC's sub-folders become categories (carousel sub-filter chips); loose files
at SRC's root go straight into the set. Output follows the 43pr convention:

    ~/.config/ags/wallpapers/SET/<NN-category>/SET-<category>-<name>.jpg
    ~/.config/ags/wallpapers/SET-originals/<NN-category>/...   (sources of padded images)

Images that aren't ~16:9 are fitted onto a 3840x2160 canvas over a blurred,
darkened copy of themselves (the 43pr look); their untouched source goes to
SET-originals/. 16:9 images are copied as-is. .jfif is renamed .jpg; a .gif
becomes a .jpg of its first frame. Re-running skips files already imported.
"""
import argparse, concurrent.futures as cf, json, os, re, shutil, subprocess, sys

WALL_DIR = os.path.expanduser("~/.config/ags/wallpapers")
W, H = 3840, 2160
ASPECT_TOLERANCE = 0.03
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".jfif", ".gif"}


def slug(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s.lower().replace("&", "and"))
    return re.sub(r"[\s_-]+", "-", s).strip("-")


def category_dir(name: str) -> str:
    # "1. Earth" → "01-earth"; unnumbered folders sort after the numbered ones
    m = re.match(r"^\s*(\d+)[.)\s-]+(.*)$", name)
    return f"{int(m.group(1)):02d}-{slug(m.group(2))}" if m else slug(name)


def probe(path: str):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "json", path],
                       capture_output=True, text=True)
    try:
        s = json.loads(r.stdout)["streams"][0]
        return int(s["width"]), int(s["height"])
    except (KeyError, IndexError, ValueError):
        return None


def ffmpeg(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def pad(src: str, dst: str):
    bg = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
          f"gblur=sigma=60,eq=brightness=-0.18:saturation=0.9")
    fg = f"scale={W}:{H}:force_original_aspect_ratio=decrease"
    q = ["-q:v", "2"] if dst.endswith(".jpg") else []
    ffmpeg(["-i", src, "-frames:v", "1", "-filter_complex",
            f"[0:v]split[a][b];[a]{bg}[bg];[b]{fg}[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2",
            *q, dst])


def plan(src_root: str, set_name: str):
    jobs, taken = [], set()
    for root, dirs, files in os.walk(src_root):
        dirs.sort()
        rel = os.path.relpath(root, src_root)
        cats = [] if rel == "." else [category_dir(p) for p in rel.split(os.sep)]
        for f in sorted(files):
            stem, ext = os.path.splitext(f)
            ext = ext.lower()
            if ext not in EXTS:
                continue
            out_ext = ".png" if ext == ".png" else ".webp" if ext == ".webp" else ".jpg"
            cat_slug = re.sub(r"^\d+-", "", cats[-1]) if cats else ""
            base = "-".join(x for x in (set_name, cat_slug, slug(stem)) if x)
            name, n = base, 2
            while os.path.join(*cats, name + out_ext) in taken:
                name, n = f"{base}-{n}", n + 1
            relout = os.path.join(*cats, name + out_ext)
            taken.add(relout)
            jobs.append((os.path.join(root, f), relout, ext))
    return jobs


def run(job, set_dir, orig_dir, dry):
    src, relout, ext = job
    dst = os.path.join(set_dir, relout)
    if os.path.exists(dst):
        return "skip", src
    size = probe(src)
    if not size:
        return "bad", src
    w, h = size
    needs_pad = abs(w / h - W / H) > ASPECT_TOLERANCE
    if dry:
        return ("pad" if needs_pad else "copy"), relout
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + ".part" + os.path.splitext(dst)[1]
    if needs_pad:
        orig = os.path.join(orig_dir, os.path.dirname(relout), os.path.basename(src))
        os.makedirs(os.path.dirname(orig), exist_ok=True)
        shutil.copy2(src, orig)
        pad(src, tmp)
    elif ext == ".gif":
        ffmpeg(["-i", src, "-frames:v", "1", "-q:v", "2", tmp])
    else:
        shutil.copy2(src, tmp)
    os.replace(tmp, dst)
    return ("pad" if needs_pad else "copy"), relout


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("set")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    a = ap.parse_args()

    set_name = slug(a.set)
    set_dir = os.path.join(WALL_DIR, set_name)
    orig_dir = os.path.join(WALL_DIR, f"{set_name}-originals")
    jobs = plan(a.src, set_name)
    counts = {}
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        for i, (kind, what) in enumerate(ex.map(lambda j: run(j, set_dir, orig_dir, a.dry_run), jobs), 1):
            counts[kind] = counts.get(kind, 0) + 1
            if kind == "bad":
                print(f"unreadable, skipped: {what}", file=sys.stderr)
            if i % 100 == 0:
                print(f"{i}/{len(jobs)}", flush=True)
    print(" · ".join(f"{k} {v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    main()
