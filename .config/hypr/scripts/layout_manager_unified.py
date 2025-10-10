#!/usr/bin/env python3
"""
Unified Layout Manager for Hyprland
Provides a single interface for all layout management operations
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk
import json
import os
import sys
import subprocess
from pathlib import Path


class LayoutManagerUnified(Gtk.Window):
    """Unified layout manager window"""

    def __init__(self):
        super().__init__(title="Hyprland Layout Manager")
        self.set_default_size(900, 600)
        self.set_border_width(10)

        # Paths
        config_dir = os.path.expanduser("~/.config/hypr")
        self.layouts_dir = os.path.join(config_dir, "layouts")
        self.scripts_dir = os.path.join(config_dir, "scripts")
        self.apps_conf = os.path.join(config_dir, "apps.conf")

        # Ensure directories exist
        os.makedirs(self.layouts_dir, exist_ok=True)
        os.makedirs(os.path.join(self.layouts_dir, "projects"), exist_ok=True)
        os.makedirs(os.path.join(self.layouts_dir, "saved"), exist_ok=True)

        self.setup_ui()

    def setup_ui(self):
        """Set up the main UI"""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.add(main_box)

        # Header
        header = Gtk.Label()
        header.set_markup("<big><b>Hyprland Layout Manager</b></big>")
        main_box.pack_start(header, False, False, 0)

        # Notebook for different sections
        notebook = Gtk.Notebook()
        main_box.pack_start(notebook, True, True, 0)

        # Tab 1: Quick Actions
        quick_actions_page = self.create_quick_actions_page()
        notebook.append_page(quick_actions_page, Gtk.Label(label="Quick Actions"))

        # Tab 2: Manage Layouts
        manage_page = self.create_manage_layouts_page()
        notebook.append_page(manage_page, Gtk.Label(label="Manage Layouts"))

        # Tab 3: Settings
        settings_page = self.create_settings_page()
        notebook.append_page(settings_page, Gtk.Label(label="Settings"))

    def create_quick_actions_page(self):
        """Create the quick actions page"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_border_width(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<b>Quick Actions</b>")
        page.pack_start(title, False, False, 0)

        # Grid of action buttons
        grid = Gtk.Grid()
        grid.set_row_spacing(10)
        grid.set_column_spacing(10)
        grid.set_halign(Gtk.Align.CENTER)

        # Create new layout
        new_btn = self.create_action_button(
            "New Layout",
            "Create a new window layout",
            self.on_new_layout
        )
        grid.attach(new_btn, 0, 0, 1, 1)

        # Browse layouts
        browse_btn = self.create_action_button(
            "Browse Layouts",
            "View and apply saved layouts",
            self.on_browse_layouts
        )
        grid.attach(browse_btn, 1, 0, 1, 1)

        # Save current layout
        save_current_btn = self.create_action_button(
            "Save Current Layout",
            "Save the current window arrangement",
            self.on_save_current_layout
        )
        grid.attach(save_current_btn, 0, 1, 1, 1)

        # Apply last layout
        apply_last_btn = self.create_action_button(
            "Apply Last Layout",
            "Reapply the most recently used layout",
            self.on_apply_last_layout
        )
        grid.attach(apply_last_btn, 1, 1, 1, 1)

        page.pack_start(grid, True, False, 0)

        return page

    def create_action_button(self, title, description, callback):
        """Create a styled action button"""
        button = Gtk.Button()
        button.set_size_request(250, 120)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        box.set_halign(Gtk.Align.CENTER)
        box.set_valign(Gtk.Align.CENTER)

        title_label = Gtk.Label()
        title_label.set_markup(f"<big><b>{title}</b></big>")
        box.pack_start(title_label, False, False, 0)

        desc_label = Gtk.Label(label=description)
        desc_label.set_line_wrap(True)
        desc_label.set_max_width_chars(30)
        box.pack_start(desc_label, False, False, 0)

        button.add(box)
        button.connect('clicked', callback)

        return button

    def create_manage_layouts_page(self):
        """Create the manage layouts page"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_border_width(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<b>Saved Layouts</b>")
        page.pack_start(title, False, False, 0)

        # Layouts list
        self.layouts_store = Gtk.ListStore(str, str)  # name, path
        self.layouts_view = Gtk.TreeView(model=self.layouts_store)

        renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Layout Name", renderer, text=0)
        self.layouts_view.append_column(column)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_min_content_height(300)
        scrolled.add(self.layouts_view)
        page.pack_start(scrolled, True, True, 0)

        # Action buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        apply_btn = Gtk.Button(label="Apply")
        apply_btn.connect('clicked', self.on_apply_selected_layout)
        button_box.pack_start(apply_btn, True, True, 0)

        edit_btn = Gtk.Button(label="Edit")
        edit_btn.connect('clicked', self.on_edit_selected_layout)
        button_box.pack_start(edit_btn, True, True, 0)

        delete_btn = Gtk.Button(label="Delete")
        delete_btn.connect('clicked', self.on_delete_selected_layout)
        button_box.pack_start(delete_btn, True, True, 0)

        page.pack_start(button_box, False, False, 0)

        # Load layouts
        self.load_saved_layouts()

        return page

    def create_settings_page(self):
        """Create the settings page"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_border_width(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<b>Settings</b>")
        page.pack_start(title, False, False, 0)

        # Settings grid
        grid = Gtk.Grid()
        grid.set_row_spacing(10)
        grid.set_column_spacing(10)

        # Layouts directory
        row = 0
        label = Gtk.Label(label="Layouts Directory:", xalign=0)
        grid.attach(label, 0, row, 1, 1)

        dir_label = Gtk.Label(label=self.layouts_dir, xalign=0)
        grid.attach(dir_label, 1, row, 1, 1)

        open_dir_btn = Gtk.Button(label="Open")
        open_dir_btn.connect('clicked', lambda w: subprocess.Popen(['xdg-open', self.layouts_dir]))
        grid.attach(open_dir_btn, 2, row, 1, 1)

        # Apps config
        row += 1
        label = Gtk.Label(label="Apps Config:", xalign=0)
        grid.attach(label, 0, row, 1, 1)

        apps_label = Gtk.Label(label=self.apps_conf, xalign=0)
        grid.attach(apps_label, 1, row, 1, 1)

        edit_apps_btn = Gtk.Button(label="Edit")
        edit_apps_btn.connect('clicked', lambda w: subprocess.Popen(['xdg-open', self.apps_conf]))
        grid.attach(edit_apps_btn, 2, row, 1, 1)

        page.pack_start(grid, False, False, 0)

        return page

    def load_saved_layouts(self):
        """Load saved layouts into the list"""
        self.layouts_store.clear()

        if not os.path.exists(self.layouts_dir):
            return

        for root, dirs, files in os.walk(self.layouts_dir):
            for file in files:
                if file.endswith('.json'):
                    path = os.path.join(root, file)
                    name = os.path.splitext(file)[0].replace('_', ' ').title()
                    self.layouts_store.append([name, path])

    def on_new_layout(self, widget):
        """Create a new layout"""
        designer_path = os.path.join(self.scripts_dir, 'visual_layout_designer.py')
        subprocess.Popen([designer_path])

    def on_browse_layouts(self, widget):
        """Open the layout browser"""
        browser_path = os.path.join(self.scripts_dir, 'layout_browser.py')
        subprocess.Popen([browser_path])

    def on_save_current_layout(self, widget):
        """Save the current window layout"""
        # Get layout name from user
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.INFO,
            buttons=Gtk.ButtonsType.OK,
            text="Save Current Layout"
        )
        dialog.format_secondary_text(
            "This feature captures the current window arrangement.\n"
            "Enter a name for this layout:"
        )

        entry = Gtk.Entry()
        dialog.get_content_area().pack_start(entry, False, False, 0)
        dialog.show_all()

        response = dialog.run()
        layout_name = entry.get_text()
        dialog.destroy()

        if response == Gtk.ResponseType.OK and layout_name:
            # TODO: Implement actual layout capture
            self.show_info_dialog("Not Implemented", "Layout capture feature coming soon!")

    def on_apply_last_layout(self, widget):
        """Apply the most recently used layout"""
        # TODO: Track and apply last used layout
        self.show_info_dialog("Not Implemented", "This feature will apply your most recently used layout.")

    def on_apply_selected_layout(self, widget):
        """Apply the selected layout"""
        selection = self.layouts_view.get_selection()
        model, tree_iter = selection.get_selected()

        if tree_iter:
            path = model[tree_iter][1]
            apply_script = os.path.join(self.scripts_dir, 'apply_layout.py')
            subprocess.Popen([apply_script, path])
            self.show_info_dialog("Layout Applied", f"Applying: {model[tree_iter][0]}")

    def on_edit_selected_layout(self, widget):
        """Edit the selected layout"""
        selection = self.layouts_view.get_selection()
        model, tree_iter = selection.get_selected()

        if tree_iter:
            path = model[tree_iter][1]
            designer_path = os.path.join(self.scripts_dir, 'visual_layout_designer.py')
            subprocess.Popen([designer_path, path])

    def on_delete_selected_layout(self, widget):
        """Delete the selected layout"""
        selection = self.layouts_view.get_selection()
        model, tree_iter = selection.get_selected()

        if not tree_iter:
            return

        path = model[tree_iter][1]
        name = model[tree_iter][0]

        # Confirm
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=f"Delete {name}?"
        )
        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            try:
                os.remove(path)
                self.load_saved_layouts()
            except Exception as e:
                self.show_error_dialog("Delete Failed", str(e))

    def show_info_dialog(self, title, message):
        """Show an info dialog"""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.INFO,
            buttons=Gtk.ButtonsType.OK,
            text=title
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()

    def show_error_dialog(self, title, message):
        """Show an error dialog"""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.OK,
            text=title
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()


def main():
    win = LayoutManagerUnified()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()


if __name__ == '__main__':
    main()
