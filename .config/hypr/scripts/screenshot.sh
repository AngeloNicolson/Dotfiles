#!/usr/bin/env sh
if [ -z "$XDG_PICTURES_DIR" ] ; then
    XDG_PICTURES_DIR="$HOME/Pictures"
fi

ScrDir=`dirname "$(realpath "$0")"`
swpy_dir="${XDG_CONFIG_HOME:-$HOME/.config}/swappy"
save_dir="${2:-$XDG_PICTURES_DIR/Screenshots}"
save_file=$(date +'%y%m%d_%Hh%Mm%Ss_screenshot.png')
temp_screenshot="/tmp/screenshot.png"

mkdir -p $save_dir
mkdir -p $swpy_dir
echo -e "[Default]\nsave_dir=$save_dir\nsave_filename_format=$save_file" > $swpy_dir/config

function print_error
{
cat << "EOF"
    ./screenshot.sh <action>
    ...valid actions are...
        p : print all screens
        s : snip current screen
        sf : snip current screen (frozen)
        m : print focused monitor
EOF
}

# Kill any stale screenshot processes before starting
pkill -x grimblast 2>/dev/null
pkill -x slurp 2>/dev/null
pkill -x swappy 2>/dev/null
pkill -x hyprpicker 2>/dev/null
rm -f "$temp_screenshot"
# Remove stale grimblast lockfile
rm -f "${XDG_RUNTIME_DIR:-/tmp}/grimblast.lock"

case $1 in
p)  # print all outputs
    grimblast copysave screen $temp_screenshot ;;
s)  # drag to manually snip an area
    grimblast copysave area $temp_screenshot ;;
sf)  # frozen screen, drag to manually snip an area
    grimblast --freeze copysave area $temp_screenshot ;;
m)  # print focused monitor
    grimblast copysave output $temp_screenshot ;;
*)  # invalid option
    print_error
    exit 1 ;;
esac

if [ -f "$temp_screenshot" ]; then
    swappy -f "$temp_screenshot"
    rm -f "$temp_screenshot"
else
    notify-send -a "Screenshot" "Screenshot cancelled or failed"
fi

if [ -f "$save_dir/$save_file" ] ; then
  notify-send -a "Screenshot" -i "${save_dir}/${save_file}" -t 2200 "Screenshot saved" "saved at ${save_dir}/${save_file}"
fi

