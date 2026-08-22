# Wallpapers

Images and live (mp4) wallpapers for the AGS wallpaper selector live here, but
they are **not tracked in git** (2 GB) — `./install.sh wallpapers` downloads
them from the `wallpapers-v1` GitHub release of this repo and skips files that
are already present. Drop your own files in here too; anything added can be
published with:

    gh release upload wallpapers-v1 .config/ags/wallpapers/* --clobber

This keeps `git clone --depth 1` small.
