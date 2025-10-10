#!/usr/bin/env python3
"""
Layout Browser for Hyprland
Browse, preview, and apply saved layouts
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GdkPixbuf, GLib
import json
import os
import sys
import subprocess
from pathlib import Path


class LayoutBrowser(Gtk.Window):
    """Main window for browsing layouts"""

    def __init__(self):
        super().__init__(title="Hyprland Layout Browser")
        self.set_default_size(1000, 700)
        self.set_border_width(10)

        # Get config paths
        config_dir = os.path.expanduser("~/.config/hypr")
        self.layouts_dir = os.path.join(config_dir, "layouts")
        self.scripts_dir = os.path.join(config_dir, "scripts")
        self.apps_conf = os.path.join(config_dir, "apps.conf")

        # Ensure layouts directory exists
        os.makedirs(self.layouts_dir, exist_ok=True)

        self.selected_layout = None
        self.setup_ui()
        self.load_layouts()

    def setup_ui(self):
        """Set up the UI"""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(main_box)

        # Toolbar
        toolbar = self.create_toolbar()
        main_box.pack_start(toolbar, False, False, 0)

        # Main content
        paned = Gtk.Paned(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.pack_start(paned, True, True, 0)

        # Left side - layout list
        left_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)

        search_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        search_label = Gtk.Label(label="Search:")
        self.search_entry = Gtk.SearchEntry()
        self.search_entry.connect('search-changed', self.on_search_changed)
        search_box.pack_start(search_label, False, False, 0)
        search_box.pack_start(self.search_entry, True, True, 0)
        left_box.pack_start(search_box, False, False, 0)

        # Layout list
        self.layout_store = Gtk.ListStore(str, str)  # name, path
        self.layout_view = Gtk.TreeView(model=self.layout_store)

        renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Layout Name", renderer, text=0)
        column.set_sort_column_id(0)
        self.layout_view.append_column(column)

        self.layout_view.connect('cursor-changed', self.on_layout_selected)
        self.layout_view.connect('row-activated', self.on_layout_activated)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_size_request(300, -1)
        scrolled.add(self.layout_view)
        left_box.pack_start(scrolled, True, True, 0)

        paned.pack1(left_box, False, True)

        # Right side - preview and details
        right_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)

        # Preview canvas
        preview_frame = Gtk.Frame(label="Preview")
        self.preview_canvas = Gtk.DrawingArea()
        self.preview_canvas.set_size_request(600, 400)
        self.preview_canvas.connect('draw', self.on_preview_draw)
        preview_frame.add(self.preview_canvas)
        right_box.pack_start(preview_frame, True, True, 0)

        # Details
        details_frame = Gtk.Frame(label="Details")
        details_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        details_box.set_border_width(10)

        self.details_label = Gtk.Label(label="No layout selected", xalign=0)
        self.details_label.set_line_wrap(True)
        details_box.pack_start(self.details_label, False, False, 0)

        details_frame.add(details_box)
        right_box.pack_start(details_frame, False, False, 0)

        # Action buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        apply_btn = Gtk.Button(label="Apply Layout")
        apply_btn.connect('clicked', self.on_apply_layout)
        button_box.pack_start(apply_btn, True, True, 0)

        edit_btn = Gtk.Button(label="Edit Layout")
        edit_btn.connect('clicked', self.on_edit_layout)
        button_box.pack_start(edit_btn, True, True, 0)

        delete_btn = Gtk.Button(label="Delete Layout")
        delete_btn.connect('clicked', self.on_delete_layout)
        button_box.pack_start(delete_btn, True, True, 0)

        right_box.pack_start(button_box, False, False, 0)

        paned.pack2(right_box, True, True)

    def create_toolbar(self):
        """Create toolbar"""
        toolbar = Gtk.Toolbar()
        toolbar.set_style(Gtk.ToolbarStyle.BOTH)

        # New layout button
        new_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_NEW)
        new_btn.set_label("New Layout")
        new_btn.connect('clicked', self.on_new_layout)
        toolbar.insert(new_btn, -1)

        # Refresh button
        refresh_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_REFRESH)
        refresh_btn.connect('clicked', lambda w: self.load_layouts())
        toolbar.insert(refresh_btn, -1)

        return toolbar

    def load_layouts(self):
        """Load all layouts from the layouts directory"""
        self.layout_store.clear()

        if not os.path.exists(self.layouts_dir):
            return

        # Scan for JSON files
        for root, dirs, files in os.walk(self.layouts_dir):
            for file in files:
                if file.endswith('.json'):
                    path = os.path.join(root, file)
                    name = os.path.splitext(file)[0]
                    # Make name more readable
                    name = name.replace('_', ' ').title()
                    self.layout_store.append([name, path])

    def on_search_changed(self, entry):
        """Filter layouts based on search"""
        search_text = entry.get_text().lower()
        # Simple search - would need proper filtering in production
        self.load_layouts()

    def on_layout_selected(self, tree_view):
        """Handle layout selection"""
        selection = tree_view.get_selection()
        model, tree_iter = selection.get_selected()

        if tree_iter:
            path = model[tree_iter][1]
            self.selected_layout = path
            self.update_preview()
            self.update_details()

    def on_layout_activated(self, tree_view, path, column):
        """Handle double-click on layout"""
        self.on_apply_layout(None)

    def update_preview(self):
        """Update the preview canvas"""
        self.preview_canvas.queue_draw()

    def update_details(self):
        """Update the details panel"""
        if not self.selected_layout:
            self.details_label.set_text("No layout selected")
            return

        try:
            with open(self.selected_layout, 'r') as f:
                layout = json.load(f)

            # Count windows
            window_count = self.count_windows(layout)

            details = f"Layout: {os.path.basename(self.selected_layout)}\n"
            details += f"Path: {self.selected_layout}\n"
            details += f"Windows: {window_count}\n"

            self.details_label.set_text(details)

        except Exception as e:
            self.details_label.set_text(f"Error loading layout: {e}")

    def count_windows(self, node):
        """Count the number of windows in a layout"""
        if node.get('type') == 'window':
            return 1
        elif node.get('type') == 'container':
            count = 0
            for child in node.get('children', []):
                count += self.count_windows(child)
            return count
        return 0

    def on_preview_draw(self, widget, cr):
        """Draw the layout preview"""
        if not self.selected_layout:
            return False

        try:
            with open(self.selected_layout, 'r') as f:
                layout = json.load(f)

            allocation = widget.get_allocation()
            width = allocation.width
            height = allocation.height

            # Clear background
            cr.set_source_rgb(0.95, 0.95, 0.95)
            cr.rectangle(0, 0, width, height)
            cr.fill()

            # Draw layout
            self.draw_preview_node(cr, layout, 10, 10, width - 20, height - 20)

        except Exception as e:
            print(f"Error drawing preview: {e}", file=sys.stderr)

        return False

    def draw_preview_node(self, cr, node, x, y, width, height):
        """Recursively draw a layout node for preview"""
        # Draw border
        cr.set_source_rgb(0.3, 0.3, 0.3)
        cr.set_line_width(1)
        cr.rectangle(x, y, width, height)
        cr.stroke()

        if node.get('type') == 'window':
            # Draw window
            cr.set_source_rgb(0.9, 0.9, 1.0)
            cr.rectangle(x + 2, y + 2, width - 4, height - 4)
            cr.fill()

            # Draw app name
            app = node.get('app', 'No app')
            cr.set_source_rgb(0, 0, 0)
            cr.select_font_face("Sans", 0, 0)
            cr.set_font_size(12)

            if app:
                # Get just the command name
                app_name = app.split()[0] if ' ' in app else app
                x_bearing, y_bearing, text_width, text_height, x_advance, y_advance = cr.text_extents(app_name)
                cr.move_to(x + width/2 - text_width/2, y + height/2 + text_height/2)
                cr.show_text(app_name)

        elif node.get('type') == 'container':
            split = node.get('split')
            ratio = node.get('ratio', 0.5)
            children = node.get('children', [])

            if len(children) >= 2:
                if split == 'horizontal':
                    split_x = x + width * ratio
                    self.draw_preview_node(cr, children[0], x, y, width * ratio, height)
                    self.draw_preview_node(cr, children[1], split_x, y, width * (1 - ratio), height)
                else:  # vertical
                    split_y = y + height * ratio
                    self.draw_preview_node(cr, children[0], x, y, width, height * ratio)
                    self.draw_preview_node(cr, children[1], x, split_y, width, height * (1 - ratio))

    def on_new_layout(self, widget):
        """Create a new layout"""
        designer_path = os.path.join(self.scripts_dir, 'visual_layout_designer.py')
        subprocess.Popen([designer_path])

    def on_apply_layout(self, widget):
        """Apply the selected layout"""
        if not self.selected_layout:
            return

        apply_script = os.path.join(self.scripts_dir, 'apply_layout.py')
        subprocess.Popen([apply_script, self.selected_layout])

        # Show confirmation
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.INFO,
            buttons=Gtk.ButtonsType.OK,
            text="Layout Applied"
        )
        dialog.format_secondary_text(f"Applying layout: {os.path.basename(self.selected_layout)}")
        dialog.run()
        dialog.destroy()

    def on_edit_layout(self, widget):
        """Edit the selected layout"""
        if not self.selected_layout:
            return

        designer_path = os.path.join(self.scripts_dir, 'visual_layout_designer.py')
        subprocess.Popen([designer_path, self.selected_layout])

    def on_delete_layout(self, widget):
        """Delete the selected layout"""
        if not self.selected_layout:
            return

        # Confirm deletion
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text="Delete Layout?"
        )
        dialog.format_secondary_text(
            f"Are you sure you want to delete {os.path.basename(self.selected_layout)}?"
        )

        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            try:
                os.remove(self.selected_layout)
                self.load_layouts()
                self.selected_layout = None
                self.update_preview()
                self.update_details()
            except Exception as e:
                error_dialog = Gtk.MessageDialog(
                    transient_for=self,
                    flags=0,
                    message_type=Gtk.MessageType.ERROR,
                    buttons=Gtk.ButtonsType.OK,
                    text="Error Deleting Layout"
                )
                error_dialog.format_secondary_text(str(e))
                error_dialog.run()
                error_dialog.destroy()


def main():
    win = LayoutBrowser()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()


if __name__ == '__main__':
    main()
