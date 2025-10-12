#!/usr/bin/env python3
"""
Unified Layout Manager for Hyprland
Provides a single interface for all layout management operations
"""

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Gdk', '4.0')
from gi.repository import Gtk, Gdk, Gio
import json
import os
import sys
import subprocess
from pathlib import Path
import cairo


class BSPNode:
    """Represents a node in the BSP tree"""
    def __init__(self, x, y, w, h, app=None):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.app = app  # If None, this is a container
        self.split_type = None  # 'horizontal' or 'vertical'
        self.ratio = 0.5
        self.children = []  # [left/top, right/bottom]

    def is_leaf(self):
        return len(self.children) == 0

    def contains_point(self, px, py):
        """Check if point is inside this node"""
        return self.x <= px <= self.x + self.w and self.y <= py <= self.y + self.h

    def split(self):
        """Split this node based on longest dimension"""
        if not self.is_leaf():
            return False

        # Minimum size check (in normalized coords)
        MIN_SIZE = 0.1  # 10% of canvas
        if self.w < MIN_SIZE * 2 or self.h < MIN_SIZE * 2:
            print(f"Cannot split: block too small (w={self.w}, h={self.h})")
            return False

        print(f"Splitting node: w={self.w}, h={self.h}, w>h={self.w > self.h}")

        # Split along the longest edge:
        # If height > width (vertical edges are longest), split vertically (top/bottom)
        # If width > height (horizontal edges are longest), split horizontally (left/right)
        if self.h > self.w:
            print("  -> Creating VERTICAL split (top/bottom) - tall block")
            self.split_type = 'vertical'
            # Split top/bottom
            left = BSPNode(self.x, self.y, self.w, self.h * 0.5, self.app)
            right = BSPNode(self.x, self.y + self.h * 0.5, self.w, self.h * 0.5)
        else:
            print("  -> Creating HORIZONTAL split (left/right) - wide block")
            self.split_type = 'horizontal'
            # Split left/right
            left = BSPNode(self.x, self.y, self.w * 0.5, self.h, self.app)
            right = BSPNode(self.x + self.w * 0.5, self.y, self.w * 0.5, self.h)

        self.children = [left, right]
        self.app = None  # Container nodes don't have apps
        return True

    def to_dict(self):
        """Convert to layout JSON format"""
        if self.is_leaf():
            return {
                'type': 'window',
                'app': self.app or 'app'
            }
        else:
            return {
                'type': 'container',
                'split': self.split_type,
                'ratio': self.ratio,
                'children': [child.to_dict() for child in self.children]
            }


class BSPDesigner(Gtk.Box):
    """Simple BSP layout designer widget"""

    def __init__(self, on_back, on_save):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)

        self.on_back_callback = on_back
        self.on_save_callback = on_save
        self.root = None  # Will be initialized when canvas is realized
        self.selected_node = None

        self.setup_ui()

        # Initialize root after canvas is created
        self.canvas.connect('resize', self.on_canvas_resize)

    def setup_ui(self):
        """Set up the designer UI"""
        # Header
        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        header.set_margin_start(20)
        header.set_margin_end(20)
        header.set_margin_top(15)
        header.set_margin_bottom(15)

        back_btn = Gtk.Button(label="← Back")
        back_btn.connect('clicked', lambda w: self.on_back_callback())
        header.append(back_btn)

        title = Gtk.Label()
        title.set_markup("<big><b>Layout Designer</b></big>")
        title.set_hexpand(True)
        header.append(title)

        clear_btn = Gtk.Button(label="Clear")
        clear_btn.connect('clicked', self.on_clear)
        header.append(clear_btn)

        save_btn = Gtk.Button(label="Save Layout")
        save_btn.connect('clicked', lambda w: self.on_save_callback(self.root))
        header.append(save_btn)

        self.append(header)

        # Instructions
        instructions = Gtk.Label()
        instructions.set_markup("<i>Shift+Click on a block to split it</i>")
        instructions.set_margin_bottom(10)
        self.append(instructions)

        # Canvas
        self.canvas = Gtk.DrawingArea()
        self.canvas.set_vexpand(True)
        self.canvas.set_hexpand(True)
        self.canvas.set_draw_func(self.on_draw)

        # Add click handler
        click_gesture = Gtk.GestureClick.new()
        click_gesture.connect('pressed', self.on_canvas_click)
        self.canvas.add_controller(click_gesture)

        self.append(self.canvas)

    def on_canvas_resize(self, widget, width, height):
        """Initialize root when canvas size is known"""
        if self.root is None:
            # Use actual aspect ratio for normalized coordinates
            aspect = width / height if height > 0 else 1
            self.root = BSPNode(0, 0, 1, 1)  # Keep 1x1, logic should work

    def on_draw(self, area, cr, width, height):
        """Draw the BSP tree"""
        # Initialize root if not done yet
        if self.root is None:
            self.root = BSPNode(0, 0, 1, 1)

        # Background
        cr.set_source_rgb(0.1, 0.1, 0.1)
        cr.rectangle(0, 0, width, height)
        cr.fill()

        # Draw all nodes
        self.draw_node(cr, self.root, width, height)

    def draw_node(self, cr, node, canvas_w, canvas_h):
        """Recursively draw a BSP node"""
        # Convert normalized coords to canvas coords
        x = node.x * canvas_w
        y = node.y * canvas_h
        w = node.w * canvas_w
        h = node.h * canvas_h

        if node.is_leaf():
            # Draw leaf node (window)
            cr.set_source_rgb(0.2, 0.2, 0.2)
            cr.rectangle(x + 2, y + 2, w - 4, h - 4)
            cr.fill()

            # Border
            if node == self.selected_node:
                cr.set_source_rgb(0.8, 0.6, 0.2)
                cr.set_line_width(3)
            else:
                cr.set_source_rgb(0.5, 0.5, 0.5)
                cr.set_line_width(2)
            cr.rectangle(x + 2, y + 2, w - 4, h - 4)
            cr.stroke()

            # App label
            app_name = node.app or "window"
            cr.set_source_rgb(0.8, 0.8, 0.8)
            cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            cr.set_font_size(12)
            extents = cr.text_extents(app_name)
            cr.move_to(x + (w - extents.width) / 2, y + (h + extents.height) / 2)
            cr.show_text(app_name)
        else:
            # Draw children
            for child in node.children:
                self.draw_node(cr, child, canvas_w, canvas_h)

    def on_canvas_click(self, gesture, n_press, x, y):
        """Handle canvas clicks"""
        # Check for Shift modifier
        modifiers = gesture.get_current_event_state()
        is_shift = modifiers & Gdk.ModifierType.SHIFT_MASK

        if is_shift:
            # Find which node was clicked
            width = self.canvas.get_width()
            height = self.canvas.get_height()

            # Normalize coordinates
            nx = x / width
            ny = y / height

            clicked_node = self.find_leaf_at(self.root, nx, ny)
            if clicked_node:
                clicked_node.split()
                self.canvas.queue_draw()
        else:
            # Select node for editing app name
            width = self.canvas.get_width()
            height = self.canvas.get_height()
            nx = x / width
            ny = y / height

            self.selected_node = self.find_leaf_at(self.root, nx, ny)
            if self.selected_node:
                self.show_app_dialog(self.selected_node)
            self.canvas.queue_draw()

    def find_leaf_at(self, node, x, y):
        """Find the leaf node at normalized coordinates"""
        if not node.contains_point(x, y):
            return None

        if node.is_leaf():
            return node

        for child in node.children:
            result = self.find_leaf_at(child, x, y)
            if result:
                return result

        return None

    def show_app_dialog(self, node):
        """Show dialog to set app name for a node"""
        dialog = Gtk.Window()
        dialog.set_transient_for(self.get_root())
        dialog.set_modal(True)
        dialog.set_title("Set Application")
        dialog.set_default_size(400, 150)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        box.set_margin_start(20)
        box.set_margin_end(20)
        box.set_margin_top(20)
        box.set_margin_bottom(20)
        dialog.set_child(box)

        label = Gtk.Label(label="Application command:")
        box.append(label)

        entry = Gtk.Entry()
        entry.set_text(node.app or "")
        entry.set_placeholder_text("e.g., firefox, kitty, code")
        box.append(entry)

        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        button_box.set_halign(Gtk.Align.END)

        cancel_btn = Gtk.Button(label="Cancel")
        cancel_btn.connect('clicked', lambda w: dialog.close())
        button_box.append(cancel_btn)

        ok_btn = Gtk.Button(label="OK")
        def on_ok(w):
            node.app = entry.get_text()
            dialog.close()
            self.canvas.queue_draw()
        ok_btn.connect('clicked', on_ok)
        button_box.append(ok_btn)

        box.append(button_box)

        dialog.present()

    def on_clear(self, widget):
        """Clear the layout and start fresh"""
        self.root = BSPNode(0, 0, 1, 1)
        self.selected_node = None
        self.canvas.queue_draw()


class LayoutCard(Gtk.Box):
    """A card widget representing a single layout with preview"""

    def __init__(self, name, path, on_apply, on_edit, on_delete):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.path = path
        self.name = name

        # Card styling
        self.add_css_class('layout-card')
        self.set_size_request(280, 320)

        # Layout name
        title = Gtk.Label()
        title.set_markup(f"<b>{name}</b>")
        title.set_wrap(True)
        title.set_max_width_chars(30)
        self.append(title)

        # Layout preview
        preview = self.create_preview(path)
        self.append(preview)

        # Action buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        button_box.set_halign(Gtk.Align.CENTER)

        apply_btn = Gtk.Button(label="Apply")
        apply_btn.connect('clicked', lambda w: on_apply(path, name))
        button_box.append(apply_btn)

        edit_btn = Gtk.Button(label="Edit")
        edit_btn.connect('clicked', lambda w: on_edit(path))
        button_box.append(edit_btn)

        delete_btn = Gtk.Button(label="Delete")
        delete_btn.connect('clicked', lambda w: on_delete(path, name))
        button_box.append(delete_btn)

        self.append(button_box)

    def create_preview(self, layout_path):
        """Create a visual preview of the layout"""
        drawing_area = Gtk.DrawingArea()
        drawing_area.set_size_request(240, 180)
        drawing_area.set_draw_func(self.draw_layout, layout_path)
        return drawing_area

    def draw_layout(self, area, cr, width, height, layout_path):
        """Draw the layout preview using Cairo"""
        try:
            # Load layout JSON
            with open(layout_path, 'r') as f:
                layout_data = json.load(f)

            # Set background
            cr.set_source_rgb(0.15, 0.15, 0.15)
            cr.rectangle(0, 0, width, height)
            cr.fill()

            # Draw the layout recursively
            self.draw_node(cr, layout_data, 0, 0, width, height)

        except Exception as e:
            # Draw error placeholder
            cr.set_source_rgb(0.3, 0.3, 0.3)
            cr.rectangle(0, 0, width, height)
            cr.fill()

    def draw_node(self, cr, node, x, y, w, h):
        """Recursively draw a layout node"""
        if node.get('type') == 'window':
            # Draw window rectangle
            cr.set_source_rgb(0.25, 0.25, 0.25)
            cr.rectangle(x + 2, y + 2, w - 4, h - 4)
            cr.fill()

            # Draw border
            cr.set_source_rgb(0.5, 0.5, 0.5)
            cr.set_line_width(2)
            cr.rectangle(x + 2, y + 2, w - 4, h - 4)
            cr.stroke()

            # Draw app name
            app_name = node.get('app', 'App')
            cr.set_source_rgb(0.8, 0.8, 0.8)
            cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            cr.set_font_size(10)

            # Center text
            extents = cr.text_extents(app_name)
            text_x = x + (w - extents.width) / 2
            text_y = y + (h + extents.height) / 2
            cr.move_to(text_x, text_y)
            cr.show_text(app_name)

        elif node.get('type') == 'container':
            split = node.get('split', 'horizontal')
            ratio = node.get('ratio', 0.5)
            children = node.get('children', [])

            if split == 'horizontal':
                # Split horizontally (left/right)
                split_pos = w * ratio
                if len(children) > 0:
                    self.draw_node(cr, children[0], x, y, split_pos, h)
                if len(children) > 1:
                    self.draw_node(cr, children[1], x + split_pos, y, w - split_pos, h)
            else:
                # Split vertically (top/bottom)
                split_pos = h * ratio
                if len(children) > 0:
                    self.draw_node(cr, children[0], x, y, w, split_pos)
                if len(children) > 1:
                    self.draw_node(cr, children[1], x, y + split_pos, w, h - split_pos)


class LayoutManagerUnified(Gtk.Window):
    """Unified layout manager window"""

    def __init__(self):
        super().__init__(title="Hyprland Layout Manager")
        self.set_default_size(900, 600)
        self.set_decorated(False)  # Remove title bar and window decorations

        # Paths
        config_dir = os.path.expanduser("~/.config/hypr")
        self.layouts_dir = os.path.join(config_dir, "layouts")
        self.scripts_dir = os.path.join(config_dir, "scripts")
        self.apps_conf = os.path.join(config_dir, "apps.conf")

        # Ensure directories exist
        os.makedirs(self.layouts_dir, exist_ok=True)
        os.makedirs(os.path.join(self.layouts_dir, "projects"), exist_ok=True)
        os.makedirs(os.path.join(self.layouts_dir, "saved"), exist_ok=True)

        # Load CSS
        self.load_css()

        self.setup_ui()

    def load_css(self):
        """Load custom CSS for card styling"""
        css_provider = Gtk.CssProvider()
        css = """
        .layout-card {
            background: rgba(40, 40, 40, 0.95);
            border-radius: 12px;
            padding: 15px;
            margin: 5px;
            border: 1px solid rgba(80, 80, 80, 0.5);
        }

        .layout-card:hover {
            background: rgba(50, 50, 50, 0.95);
            border: 1px solid rgba(100, 100, 100, 0.7);
        }
        """
        css_provider.load_from_data(css.encode())
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

    def setup_ui(self):
        """Set up the main UI"""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        main_box.set_vexpand(True)
        main_box.set_hexpand(True)
        self.set_child(main_box)

        # Header
        header = Gtk.Label()
        header.set_markup("<big><b>Hyprland Layout Manager</b></big>")
        main_box.append(header)

        # Notebook for different sections
        self.notebook = Gtk.Notebook()
        self.notebook.set_vexpand(True)
        self.notebook.set_hexpand(True)
        main_box.append(self.notebook)

        # Tab 1: Quick Actions
        quick_actions_page = self.create_quick_actions_page()
        self.notebook.append_page(quick_actions_page, Gtk.Label(label="Quick Actions"))

        # Tab 2: Manage Layouts
        manage_page = self.create_manage_layouts_page()
        self.notebook.append_page(manage_page, Gtk.Label(label="Manage Layouts"))

        # Tab 3: Workspace Manager
        workspace_page = self.create_workspace_page()
        self.notebook.append_page(workspace_page, Gtk.Label(label="Workspaces"))

        # Tab 4: Settings
        settings_page = self.create_settings_page()
        self.notebook.append_page(settings_page, Gtk.Label(label="Settings"))

        # Tab 5: Designer
        self.designer_widget = BSPDesigner(
            on_back=self.on_designer_back,
            on_save=self.on_designer_save
        )
        self.designer_tab_index = self.notebook.append_page(self.designer_widget, Gtk.Label(label="Designer"))
        # Hide designer tab by default
        self.notebook.get_page(self.designer_widget).set_property("tab-expand", False)

    def create_quick_actions_page(self):
        """Create the quick actions page"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_margin_start(20)
        page.set_margin_end(20)
        page.set_margin_top(20)
        page.set_margin_bottom(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<b>Quick Actions</b>")
        page.append(title)

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

        page.append(grid)

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
        box.append(title_label)

        desc_label = Gtk.Label(label=description)
        desc_label.set_wrap(True)
        desc_label.set_max_width_chars(30)
        box.append(desc_label)

        button.set_child(box)
        button.connect('clicked', callback)

        return button

    def create_manage_layouts_page(self):
        """Create the manage layouts page with card view"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_margin_start(20)
        page.set_margin_end(20)
        page.set_margin_top(20)
        page.set_margin_bottom(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<b>Saved Layouts</b>")
        page.append(title)

        # Scrollable cards area
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_vexpand(True)

        # FlowBox for card layout
        self.layouts_flowbox = Gtk.FlowBox()
        self.layouts_flowbox.set_valign(Gtk.Align.START)
        self.layouts_flowbox.set_max_children_per_line(3)
        self.layouts_flowbox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.layouts_flowbox.set_row_spacing(15)
        self.layouts_flowbox.set_column_spacing(15)

        scrolled.set_child(self.layouts_flowbox)
        page.append(scrolled)

        # Load layouts
        self.load_saved_layouts()

        return page

    def create_workspace_page(self):
        """Create the workspace management page with drag and drop"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_margin_start(20)
        page.set_margin_end(20)
        page.set_margin_top(20)
        page.set_margin_bottom(20)

        # Title and refresh button
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        title = Gtk.Label()
        title.set_markup("<b>Workspace Management</b>")
        header_box.append(title)

        refresh_btn = Gtk.Button(label="Refresh")
        refresh_btn.connect('clicked', self.on_refresh_workspaces)
        header_box.prepend(refresh_btn)

        page.append(header_box)

        # Instructions
        instructions = Gtk.Label()
        instructions.set_markup("<i>Drag workspaces between monitors to move them</i>")
        page.append(instructions)

        # Scrollable area for monitors
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        # Container for monitor boxes
        self.monitors_container = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=20)
        self.monitors_container.set_halign(Gtk.Align.CENTER)
        scrolled.set_child(self.monitors_container)

        page.append(scrolled)

        # Load initial data
        self.refresh_workspace_data()

        return page

    def get_monitors(self):
        """Get list of monitors from hyprctl"""
        try:
            result = subprocess.run(
                ['hyprctl', '-j', 'monitors'],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                return json.loads(result.stdout)
        except Exception as e:
            print(f"Error getting monitors: {e}")
        return []

    def get_workspaces(self):
        """Get list of workspaces from hyprctl"""
        try:
            result = subprocess.run(
                ['hyprctl', '-j', 'workspaces'],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                return json.loads(result.stdout)
        except Exception as e:
            print(f"Error getting workspaces: {e}")
        return []

    def refresh_workspace_data(self):
        """Refresh workspace and monitor data with visual layout"""
        # Clear existing monitor boxes
        child = self.monitors_container.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.monitors_container.remove(child)
            child = next_child

        # Get data
        monitors = self.get_monitors()
        workspaces = self.get_workspaces()

        # Group workspaces by monitor
        ws_by_monitor = {}
        for ws in workspaces:
            monitor_name = ws.get('monitor', 'Unknown')
            if monitor_name not in ws_by_monitor:
                ws_by_monitor[monitor_name] = []
            ws_by_monitor[monitor_name].append(ws)

        # Create a visual box for each monitor
        for monitor in monitors:
            monitor_name = monitor['name']
            monitor_box = self.create_monitor_box(monitor_name, ws_by_monitor.get(monitor_name, []))
            self.monitors_container.append(monitor_box)

    def create_monitor_box(self, monitor_name, workspaces):
        """Create a visual box representing a monitor with its workspaces"""
        # Main frame for the monitor
        frame = Gtk.Frame()
        frame.set_label(monitor_name)

        # Box to hold workspaces
        ws_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        ws_box.set_margin_start(10)
        ws_box.set_margin_end(10)
        ws_box.set_margin_top(10)
        ws_box.set_margin_bottom(10)
        ws_box.set_size_request(200, 300)

        # Monitor label
        label = Gtk.Label()
        label.set_markup(f"<b>{monitor_name}</b>")
        ws_box.append(label)

        # Add workspaces as draggable buttons
        for ws in workspaces:
            ws_button = self.create_workspace_button(ws)
            ws_box.append(ws_button)

        # Set up as drop destination (GTK4)
        drop_target = Gtk.DropTarget.new(type=str, actions=Gdk.DragAction.MOVE)
        drop_target.connect('drop', self.on_workspace_dropped, monitor_name)
        ws_box.add_controller(drop_target)

        frame.set_child(ws_box)
        return frame

    def create_workspace_button(self, workspace):
        """Create a draggable button for a workspace"""
        ws_id = workspace.get('id', 0)
        ws_name = workspace.get('name', f"Workspace {ws_id}")

        button = Gtk.Button(label=f"WS {ws_id}")
        button.set_size_request(150, 40)

        # Set up as drag source (GTK4)
        drag_source = Gtk.DragSource.new()
        drag_source.set_actions(Gdk.DragAction.MOVE)

        # Prepare drag data
        def on_prepare(source, x, y):
            value = str(ws_id)
            return Gdk.ContentProvider.new_for_value(value)

        drag_source.connect('prepare', on_prepare)
        button.add_controller(drag_source)

        return button

    def on_workspace_dropped(self, drop_target, value, x, y, target_monitor):
        """Handle workspace drop on a monitor (GTK4)"""
        workspace_id = value
        if workspace_id:
            try:
                # Move workspace to target monitor
                subprocess.run([
                    'hyprctl',
                    'dispatch',
                    'moveworkspacetomonitor',
                    workspace_id,
                    target_monitor
                ], check=True)

                # Refresh the display
                self.refresh_workspace_data()
                return True
            except subprocess.CalledProcessError as e:
                self.show_error_dialog("Move Failed", f"Failed to move workspace: {e}")
                return False
        return False

    def on_refresh_workspaces(self, widget):
        """Refresh button clicked"""
        self.refresh_workspace_data()

    def create_settings_page(self):
        """Create the settings page"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.set_margin_start(20)
        page.set_margin_end(20)
        page.set_margin_top(20)
        page.set_margin_bottom(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<b>Settings</b>")
        page.append(title)

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

        page.append(grid)

        return page

    def load_saved_layouts(self):
        """Load saved layouts as cards"""
        # Clear existing cards
        child = self.layouts_flowbox.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.layouts_flowbox.remove(child)
            child = next_child

        if not os.path.exists(self.layouts_dir):
            return

        # Load all layout files
        for root, dirs, files in os.walk(self.layouts_dir):
            for file in files:
                if file.endswith('.json'):
                    path = os.path.join(root, file)
                    name = os.path.splitext(file)[0].replace('_', ' ').title()

                    card = LayoutCard(
                        name,
                        path,
                        self.on_apply_layout,
                        self.on_edit_layout,
                        self.on_delete_layout
                    )
                    self.layouts_flowbox.append(card)

    def on_new_layout(self, widget):
        """Create a new layout"""
        # Reset designer and switch to it
        self.designer_widget.on_clear(None)
        self.current_layout_path = None
        self.notebook.set_current_page(self.designer_tab_index)

    def on_browse_layouts(self, widget):
        """Switch to the Manage Layouts tab"""
        self.notebook.set_current_page(1)  # Tab index 1 is Manage Layouts

    def on_save_current_layout(self, widget):
        """Save the current window layout"""
        # TODO: Implement actual layout capture
        self.show_info_dialog("Not Implemented", "Layout capture feature coming soon!")

    def on_apply_last_layout(self, widget):
        """Apply the most recently used layout"""
        # TODO: Track and apply last used layout
        self.show_info_dialog("Not Implemented", "This feature will apply your most recently used layout.")

    def on_apply_layout(self, path, name):
        """Apply a layout"""
        apply_script = os.path.join(self.scripts_dir, 'apply_layout.py')
        subprocess.Popen([apply_script, path])
        print(f"[Layout Manager] Applying: {name}")

    def on_edit_layout(self, path):
        """Edit a layout"""
        # TODO: Load the layout into the designer
        self.current_layout_path = path
        self.designer_widget.on_clear(None)  # For now, just clear
        self.notebook.set_current_page(self.designer_tab_index)

    def on_delete_layout(self, path, name):
        """Delete a layout"""
        dialog = Gtk.AlertDialog.new(f"Delete {name}?")
        dialog.set_detail("This action cannot be undone.")
        dialog.set_buttons(["Cancel", "Delete"])
        dialog.set_cancel_button(0)
        dialog.set_default_button(0)

        def on_response(dialog, result):
            try:
                response = dialog.choose_finish(result)
                if response == 1:  # Delete button
                    try:
                        os.remove(path)
                        self.load_saved_layouts()
                    except Exception as e:
                        self.show_error_dialog("Delete Failed", str(e))
            except:
                pass

        dialog.choose(self, None, on_response)

    def show_info_dialog(self, title, message):
        """Show an info dialog"""
        dialog = Gtk.AlertDialog.new(title)
        dialog.set_detail(message)
        dialog.set_buttons(["OK"])
        dialog.set_default_button(0)
        dialog.show(self)

    def show_error_dialog(self, title, message):
        """Show an error dialog"""
        dialog = Gtk.AlertDialog.new(title)
        dialog.set_detail(message)
        dialog.set_buttons(["OK"])
        dialog.set_default_button(0)
        dialog.show(self)

    def on_designer_back(self):
        """Go back from designer to manage layouts"""
        self.notebook.set_current_page(1)  # Manage Layouts tab

    def on_designer_save(self, root_node):
        """Save the layout from the designer"""
        # Show save dialog
        dialog = Gtk.Window()
        dialog.set_transient_for(self)
        dialog.set_modal(True)
        dialog.set_title("Save Layout")
        dialog.set_default_size(400, 150)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        box.set_margin_start(20)
        box.set_margin_end(20)
        box.set_margin_top(20)
        box.set_margin_bottom(20)
        dialog.set_child(box)

        label = Gtk.Label(label="Layout name:")
        box.append(label)

        entry = Gtk.Entry()
        entry.set_placeholder_text("my_layout")
        if self.current_layout_path:
            # Pre-fill with current name
            name = os.path.splitext(os.path.basename(self.current_layout_path))[0]
            entry.set_text(name)
        box.append(entry)

        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        button_box.set_halign(Gtk.Align.END)

        cancel_btn = Gtk.Button(label="Cancel")
        cancel_btn.connect('clicked', lambda w: dialog.close())
        button_box.append(cancel_btn)

        save_btn = Gtk.Button(label="Save")
        def on_save(w):
            name = entry.get_text()
            if name:
                # Save to file
                layout_data = root_node.to_dict()
                filename = f"{name}.json"
                filepath = os.path.join(self.layouts_dir, "saved", filename)

                try:
                    with open(filepath, 'w') as f:
                        json.dump(layout_data, f, indent=2)

                    dialog.close()
                    self.load_saved_layouts()
                    self.notebook.set_current_page(1)  # Go back to Manage Layouts
                except Exception as e:
                    self.show_error_dialog("Save Failed", str(e))
        save_btn.connect('clicked', on_save)
        button_box.append(save_btn)

        box.append(button_box)

        dialog.present()


class LayoutManagerApp(Gtk.Application):
    """GTK4 Application wrapper"""

    def __init__(self):
        super().__init__(application_id='com.hyprland.layoutmanager')

    def do_activate(self):
        win = LayoutManagerUnified()
        win.set_application(self)
        win.present()


def main():
    app = LayoutManagerApp()
    app.run(None)


if __name__ == '__main__':
    main()
