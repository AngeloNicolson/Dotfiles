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
import time


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
        self.parent = None  # Reference to parent node

    def is_leaf(self):
        return len(self.children) == 0

    def contains_point(self, px, py):
        """Check if point is inside this node"""
        return self.x <= px <= self.x + self.w and self.y <= py <= self.y + self.h

    def split(self):
        """Split this node based on longest dimension"""
        if not self.is_leaf():
            return False

        # Minimum size check (15% of canvas minimum per window)
        MIN_SIZE = 0.15
        if self.w < MIN_SIZE * 2 or self.h < MIN_SIZE * 2:
            return False

        # Split along the longest edge:
        # If height > width (vertical edges are longest), split vertically (top/bottom)
        # If width > height (horizontal edges are longest), split horizontally (left/right)
        if self.h > self.w:
            self.split_type = 'vertical'
            # Split top/bottom
            left = BSPNode(self.x, self.y, self.w, self.h * 0.5, self.app)
            right = BSPNode(self.x, self.y + self.h * 0.5, self.w, self.h * 0.5)
        else:
            self.split_type = 'horizontal'
            # Split left/right
            left = BSPNode(self.x, self.y, self.w * 0.5, self.h, self.app)
            right = BSPNode(self.x + self.w * 0.5, self.y, self.w * 0.5, self.h)

        self.children = [left, right]
        left.parent = self
        right.parent = self
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
        self.hovered_node = None  # Node under mouse cursor
        self.mouse_x = 0
        self.mouse_y = 0
        self.editing_path = None  # Path of layout being edited (if any)

        # Drag state
        self.drag_node = None
        self.drag_visual_x = 0
        self.drag_visual_y = 0
        self.drag_original_pos = None  # (x, y) of dragged node's original position
        self.drop_target_node = None
        self.drop_position = None  # 'top', 'bottom', 'left', 'right'
        self.visual_tree_root = None  # Tree without dragged node for visual display

        # Resize state
        self.resize_node = None
        self.resize_edge = None  # 'left', 'right', 'top', 'bottom'
        self.resize_start_x = 0
        self.resize_start_y = 0
        self.resize_node_start = {}

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
        instructions.set_markup("<i>Drag windows to swap/insert | Drag edges to resize | Double-click to set app | Shift+Click to split | Shift+D to delete</i>")
        instructions.set_margin_bottom(10)
        self.append(instructions)

        # Canvas
        self.canvas = Gtk.DrawingArea()
        self.canvas.set_vexpand(True)
        self.canvas.set_hexpand(True)
        self.canvas.set_draw_func(self.on_draw)
        self.canvas.set_focusable(True)  # Make canvas accept keyboard input
        self.canvas.set_can_focus(True)

        # Add mouse button handlers for drag
        click_gesture = Gtk.GestureClick.new()
        click_gesture.connect('pressed', self.on_mouse_press)
        click_gesture.connect('released', self.on_mouse_release)
        self.canvas.add_controller(click_gesture)

        # Add double-click handler for app assignment
        double_click = Gtk.GestureClick.new()
        double_click.set_button(1)
        double_click.connect('pressed', self.on_double_click)
        self.canvas.add_controller(double_click)

        # Add keyboard handler
        key_controller = Gtk.EventControllerKey.new()
        key_controller.connect('key-pressed', self.on_key_pressed)
        self.canvas.add_controller(key_controller)

        # Add motion handler to track mouse position
        motion_controller = Gtk.EventControllerMotion.new()
        motion_controller.connect('motion', self.on_mouse_motion)
        self.canvas.add_controller(motion_controller)

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

        # Draw tree (use visual tree if dragging, otherwise real tree)
        tree_to_draw = self.visual_tree_root if self.drag_node else self.root
        if tree_to_draw:
            self.draw_node(cr, tree_to_draw, width, height)

        # Draw dragged window on top
        if self.drag_node:
            self.draw_window(cr, self.drag_visual_x, self.drag_visual_y,
                           self.drag_node.w * width, self.drag_node.h * height,
                           self.drag_node, is_dragging=True)

    def draw_node(self, cr, node, canvas_w, canvas_h):
        """Recursively draw a BSP node"""
        # Convert normalized coords to canvas coords
        x = node.x * canvas_w
        y = node.y * canvas_h
        w = node.w * canvas_w
        h = node.h * canvas_h

        if node.is_leaf():
            # Check if this is the node that expanded into dragged node's space
            is_expanded_sibling = False
            if self.drag_original_pos:
                # Check if this node overlaps with the original dragged position
                orig_x, orig_y = self.drag_original_pos
                if (node.x <= orig_x < node.x + node.w and
                    node.y <= orig_y < node.y + node.h):
                    is_expanded_sibling = True

            # Draw leaf node (window) with rounded corners
            self.draw_window(cr, x, y, w, h, node, is_expanded_sibling=is_expanded_sibling)

            # Draw drop indicator if this is the drop target (compare by position and app)
            if (self.drop_target_node and self.drop_position and
                abs(node.x - self.drop_target_node.x) < 0.01 and
                abs(node.y - self.drop_target_node.y) < 0.01 and
                node.app == self.drop_target_node.app):
                self.draw_drop_indicator(cr, x, y, w, h, self.drop_position)
        else:
            # Draw children
            for child in node.children:
                self.draw_node(cr, child, canvas_w, canvas_h)

    def draw_window(self, cr, x, y, w, h, node, is_dragging=False, is_expanded_sibling=False):
        """Draw a window rectangle with rounded corners"""
        radius = 8
        x_inner = x + 4
        y_inner = y + 4
        w_inner = w - 8
        h_inner = h - 8

        # Rounded rectangle background
        cr.new_sub_path()
        cr.arc(x_inner + w_inner - radius, y_inner + radius, radius, -0.5 * 3.14159, 0)
        cr.arc(x_inner + w_inner - radius, y_inner + h_inner - radius, radius, 0, 0.5 * 3.14159)
        cr.arc(x_inner + radius, y_inner + h_inner - radius, radius, 0.5 * 3.14159, 3.14159)
        cr.arc(x_inner + radius, y_inner + radius, radius, 3.14159, 1.5 * 3.14159)
        cr.close_path()

        if is_dragging:
            cr.set_source_rgba(0.3, 0.3, 0.3, 0.8)  # Semi-transparent when dragging
        elif is_expanded_sibling:
            cr.set_source_rgba(0.25, 0.25, 0.35, 1.0)  # Slightly different color for expanded sibling
        else:
            cr.set_source_rgb(0.2, 0.2, 0.2)
        cr.fill_preserve()

        # Border - with different colors for selected, hovered, or normal
        if is_dragging:
            cr.set_source_rgba(0.8, 0.6, 0.2, 0.8)  # Orange when dragging
            cr.set_line_width(3)
        elif is_expanded_sibling:
            cr.set_source_rgba(0.6, 0.6, 0.8, 0.8)  # Blue-ish for expanded sibling
            cr.set_line_width(2)
        elif node == self.selected_node:
            cr.set_source_rgb(0.8, 0.6, 0.2)  # Orange for selected
            cr.set_line_width(3)
        elif node == self.hovered_node:
            cr.set_source_rgba(0.6, 0.8, 1.0, 0.6)  # Light blue for hovered
            cr.set_line_width(2)
        else:
            cr.set_source_rgb(0.5, 0.5, 0.5)  # Gray for normal
            cr.set_line_width(2)
        cr.stroke()

        # App label
        app_name = node.app or "window"
        cr.set_source_rgb(0.8, 0.8, 0.8)
        cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        cr.set_font_size(12)
        extents = cr.text_extents(app_name)
        cr.move_to(x + (w - extents.width) / 2, y + (h + extents.height) / 2)
        cr.show_text(app_name)

    def draw_drop_indicator(self, cr, x, y, w, h, position):
        """Draw indicator showing where the dragged window will be inserted"""
        cr.set_source_rgba(0.5, 0.5, 0.5, 0.4)  # Grey semi-transparent

        if position == 'top':
            cr.rectangle(x + 2, y + 2, w - 4, h / 2 - 2)
            cr.fill()
        elif position == 'bottom':
            cr.rectangle(x + 2, y + h / 2, w - 4, h / 2 - 2)
            cr.fill()
        elif position == 'left':
            cr.rectangle(x + 2, y + 2, w / 2 - 2, h - 4)
            cr.fill()
        elif position == 'right':
            cr.rectangle(x + w / 2, y + 2, w / 2 - 2, h - 4)
            cr.fill()

    def on_mouse_press(self, gesture, n_press, x, y):
        """Handle mouse button press"""
        modifiers = gesture.get_current_event_state()
        is_shift = modifiers & Gdk.ModifierType.SHIFT_MASK

        width = self.canvas.get_width()
        height = self.canvas.get_height()
        nx = x / width
        ny = y / height

        clicked_node = self.find_leaf_at(self.root, nx, ny)

        if is_shift and clicked_node:
            # Shift+Click to split
            clicked_node.split()
            self.canvas.queue_draw()
        elif clicked_node:
            # Check if clicking near an edge (12px threshold)
            edge = self.get_edge_at(clicked_node, x, y, width, height, threshold=12)

            if edge:
                # Start resize
                self.resize_node = clicked_node
                self.resize_edge = edge
                self.resize_start_x = nx
                self.resize_start_y = ny
                self.resize_node_start = {
                    'x': clicked_node.x,
                    'y': clicked_node.y,
                    'w': clicked_node.w,
                    'h': clicked_node.h
                }
            else:
                # Don't allow dragging the only window
                if clicked_node == self.root and clicked_node.is_leaf():
                    return

                # Start drag - keep node in tree, create visual tree without it
                self.drag_node = clicked_node
                self.drag_visual_x = clicked_node.x * width
                self.drag_visual_y = clicked_node.y * height
                self.drag_original_pos = (clicked_node.x, clicked_node.y)

                # Create a deep copy of the tree without the dragged node for visual display
                self.visual_tree_root = self.create_visual_tree_without_node(self.root, clicked_node)

                self.canvas.queue_draw()

    def on_mouse_release(self, gesture, n_press, x, y):
        """Handle mouse button release"""
        if self.drag_node and self.drop_target_real and self.drop_position:
            # Only allow edge drops (top, bottom, left, right)
            if self.drop_position in ['top', 'bottom', 'left', 'right']:
                # Remove from old location
                self.remove_node_from_tree(self.drag_node)
                # Insert at new location (use real target from actual tree)
                self.insert_node(self.drag_node, self.drop_target_real, self.drop_position)

        # Clear drag state (whether successful or cancelled)
        if self.drag_node:
            self.drag_node = None
            self.drag_original_pos = None
            self.drop_target_node = None
            self.drop_position = None
            self.visual_tree_root = None
            self.canvas.queue_draw()

        if self.resize_node:
            self.resize_node = None
            self.resize_edge = None

    def on_double_click(self, gesture, n_press):
        """Handle double-click to assign app"""
        if n_press == 2:  # Double-click
            x = gesture.get_current_event().get_position()[1]
            y = gesture.get_current_event().get_position()[2]

            width = self.canvas.get_width()
            height = self.canvas.get_height()
            nx = x / width
            ny = y / height

            clicked_node = self.find_leaf_at(self.root, nx, ny)
            if clicked_node:
                self.show_app_dialog(clicked_node)

    def get_edge_at(self, node, x, y, canvas_w, canvas_h, threshold=12):
        """Check if point is near an edge of the node"""
        if not node or not node.parent:
            return None

        node_x = node.x * canvas_w
        node_y = node.y * canvas_h
        node_w = node.w * canvas_w
        node_h = node.h * canvas_h

        parent = node.parent

        # Only allow resizing edges that correspond to the parent's split type
        if parent.split_type == 'horizontal':
            # Can resize left/right edges (vertical lines)
            if abs(x - node_x) < threshold and node_y - threshold <= y <= node_y + node_h + threshold:
                return 'left'
            if abs(x - (node_x + node_w)) < threshold and node_y - threshold <= y <= node_y + node_h + threshold:
                return 'right'
        elif parent.split_type == 'vertical':
            # Can resize top/bottom edges (horizontal lines)
            if abs(y - node_y) < threshold and node_x - threshold <= x <= node_x + node_w + threshold:
                return 'top'
            if abs(y - (node_y + node_h)) < threshold and node_x - threshold <= x <= node_x + node_w + threshold:
                return 'bottom'

        return None

    def find_leaf_at(self, node, x, y):
        """Find the leaf node at normalized coordinates"""
        if not node or not node.contains_point(x, y):
            return None

        if node.is_leaf():
            return node

        for child in node.children:
            result = self.find_leaf_at(child, x, y)
            if result:
                return result

        return None

    def find_node_by_app(self, node, app_name):
        """Find a leaf node in the tree by app name"""
        if not node:
            return None

        if node.is_leaf():
            return node if node.app == app_name else None

        for child in node.children:
            result = self.find_node_by_app(child, app_name)
            if result:
                return result

        return None

    def find_node_by_position(self, node, x, y):
        """Find a leaf node in the tree by position (with small tolerance)"""
        if not node:
            return None

        if node.is_leaf():
            # Check if position matches (within 0.01 tolerance)
            if abs(node.x - x) < 0.01 and abs(node.y - y) < 0.01:
                return node
            return None

        for child in node.children:
            result = self.find_node_by_position(child, x, y)
            if result:
                return result

        return None

    def show_app_dialog(self, node):
        """Show dialog to set app name for a node"""
        dialog = Gtk.Window()
        dialog.set_transient_for(self.get_root())
        dialog.set_modal(True)
        dialog.set_title("Set Application")
        dialog.set_default_size(450, 250)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        box.set_margin_start(20)
        box.set_margin_end(20)
        box.set_margin_top(20)
        box.set_margin_bottom(20)
        dialog.set_child(box)

        # Common apps dropdown
        dropdown_label = Gtk.Label(label="Select common app:", xalign=0)
        box.append(dropdown_label)

        common_apps = [
            "firefox", "chromium", "google-chrome",
            "kitty", "alacritty", "foot", "wezterm",
            "code", "nvim", "emacs",
            "thunar", "nautilus", "dolphin",
            "spotify", "discord", "slack",
            "obsidian", "gimp", "inkscape"
        ]

        # Create dropdown
        dropdown = Gtk.DropDown.new_from_strings(common_apps)
        box.append(dropdown)

        # OR separator
        or_label = Gtk.Label()
        or_label.set_markup("<i>— or —</i>")
        box.append(or_label)

        # Custom command entry
        custom_label = Gtk.Label(label="Type custom command:", xalign=0)
        box.append(custom_label)

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
            # Use custom entry if filled, otherwise use dropdown selection
            custom_text = entry.get_text().strip()
            if custom_text:
                node.app = custom_text
            else:
                selected_index = dropdown.get_selected()
                node.app = common_apps[selected_index]
            dialog.close()
            self.canvas.queue_draw()
        ok_btn.connect('clicked', on_ok)
        button_box.append(ok_btn)

        box.append(button_box)

        dialog.present()

    def on_mouse_motion(self, controller, x, y):
        """Track mouse position and update hover, handle drag and resize"""
        self.mouse_x = x
        self.mouse_y = y

        # Grab focus when mouse enters canvas
        if not self.canvas.has_focus():
            self.canvas.grab_focus()

        width = self.canvas.get_width()
        height = self.canvas.get_height()
        if width <= 0 or height <= 0:
            return

        nx = x / width
        ny = y / height

        # Handle dragging
        if self.drag_node:
            # Update visual position to follow mouse
            self.drag_visual_x = x - (self.drag_node.w * width / 2)
            self.drag_visual_y = y - (self.drag_node.h * height / 2)

            # Find drop target and position (search in visual tree)
            target_node = self.find_leaf_at(self.visual_tree_root, nx, ny) if self.visual_tree_root else None
            if target_node and target_node.is_leaf():
                # Always map back to real tree node by position (more reliable)
                real_target = self.find_node_by_position(self.root, target_node.x, target_node.y)

                if real_target and real_target != self.drag_node:
                    # Store both visual (for drawing) and real (for actual operation)
                    self.drop_target_node = target_node
                    self.drop_target_real = real_target

                    # Determine drop position based on mouse location within target
                    target_x = target_node.x * width
                    target_y = target_node.y * height
                    target_w = target_node.w * width
                    target_h = target_node.h * height

                    # Calculate relative position
                    rel_x = (x - target_x) / target_w
                    rel_y = (y - target_y) / target_h

                    # Determine which zone the mouse is in (40% edge zones - more forgiving)
                    # Only allow edge drops (no center/swap)
                    edge_threshold = 0.4
                    if rel_y < edge_threshold:
                        self.drop_position = 'top'
                    elif rel_y > (1 - edge_threshold):
                        self.drop_position = 'bottom'
                    elif rel_x < edge_threshold:
                        self.drop_position = 'left'
                    elif rel_x > (1 - edge_threshold):
                        self.drop_position = 'right'
                    else:
                        # Center zone - not allowed (only 20% center area now)
                        self.drop_position = None
                        self.drop_target_node = None
                        self.drop_target_real = None
                else:
                    self.drop_target_node = None
                    self.drop_position = None
                    self.drop_target_real = None
            else:
                self.drop_target_node = None
                self.drop_position = None

            self.canvas.queue_draw()
            return

        # Handle resizing - adjust parent container ratio based on mouse position
        if self.resize_node:
            parent = self.resize_node.parent
            if not parent:
                return  # Can't resize root

            # Find which child this is (0 or 1)
            child_index = 0 if parent.children[0] == self.resize_node else 1

            if self.resize_edge in ['left', 'right']:
                # Resizing horizontal edge
                if parent.split_type == 'horizontal':
                    # Calculate new ratio based on absolute mouse position within parent
                    parent_left = parent.x
                    parent_right = parent.x + parent.w

                    if self.resize_edge == 'left' and child_index == 1:
                        # Resizing left edge of right child
                        # Mouse position determines where the split should be
                        new_ratio = (nx - parent_left) / parent.w
                        new_ratio = max(0.15, min(0.85, new_ratio))
                        parent.ratio = new_ratio
                        self.update_node_coords(parent)
                    elif self.resize_edge == 'right' and child_index == 0:
                        # Resizing right edge of left child
                        new_ratio = (nx - parent_left) / parent.w
                        new_ratio = max(0.15, min(0.85, new_ratio))
                        parent.ratio = new_ratio
                        self.update_node_coords(parent)

            elif self.resize_edge in ['top', 'bottom']:
                # Resizing vertical edge
                if parent.split_type == 'vertical':
                    # Calculate new ratio based on absolute mouse position within parent
                    parent_top = parent.y
                    parent_bottom = parent.y + parent.h

                    if self.resize_edge == 'top' and child_index == 1:
                        # Resizing top edge of bottom child
                        new_ratio = (ny - parent_top) / parent.h
                        new_ratio = max(0.15, min(0.85, new_ratio))
                        parent.ratio = new_ratio
                        self.update_node_coords(parent)
                    elif self.resize_edge == 'bottom' and child_index == 0:
                        # Resizing bottom edge of top child
                        new_ratio = (ny - parent_top) / parent.h
                        new_ratio = max(0.15, min(0.85, new_ratio))
                        parent.ratio = new_ratio
                        self.update_node_coords(parent)

            self.canvas.queue_draw()
            return

        # Update hovered node and cursor
        self.hovered_node = self.find_leaf_at(self.root, nx, ny)

        # Update cursor based on what's under the mouse
        if self.hovered_node:
            edge = self.get_edge_at(self.hovered_node, x, y, width, height, threshold=12)
            if edge in ['left', 'right']:
                self.canvas.set_cursor(Gdk.Cursor.new_from_name("ew-resize", None))
            elif edge in ['top', 'bottom']:
                self.canvas.set_cursor(Gdk.Cursor.new_from_name("ns-resize", None))
            else:
                self.canvas.set_cursor(Gdk.Cursor.new_from_name("default", None))
        else:
            self.canvas.set_cursor(Gdk.Cursor.new_from_name("default", None))

        self.canvas.queue_draw()

    def on_key_pressed(self, controller, keyval, keycode, state):
        """Handle keyboard input"""
        # Check if Shift+D was pressed
        is_shift = state & Gdk.ModifierType.SHIFT_MASK

        if (keyval == Gdk.KEY_d or keyval == Gdk.KEY_D) and is_shift:
            # Convert to normalized coordinates
            width = self.canvas.get_width()
            height = self.canvas.get_height()
            nx = self.mouse_x / width
            ny = self.mouse_y / height

            # Find node under cursor
            node_under_cursor = self.find_leaf_at(self.root, nx, ny)
            if node_under_cursor:
                self.delete_node(node_under_cursor)
                self.canvas.queue_draw()
                return True
        return False

    def create_visual_tree_without_node(self, node, exclude_node):
        """Create a copy of the tree with exclude_node removed (for visual display only)"""
        if node == exclude_node:
            return None

        if node.is_leaf():
            # Copy leaf node
            copy = BSPNode(node.x, node.y, node.w, node.h, node.app)
            return copy

        # Container node - recursively copy children
        left_copy = self.create_visual_tree_without_node(node.children[0], exclude_node)
        right_copy = self.create_visual_tree_without_node(node.children[1], exclude_node)

        # If one child is excluded, promote the other
        if left_copy is None and right_copy is None:
            return None
        elif left_copy is None:
            # Expand right child to fill parent's space
            right_copy.x = node.x
            right_copy.y = node.y
            right_copy.w = node.w
            right_copy.h = node.h
            self.update_node_coords(right_copy)
            return right_copy
        elif right_copy is None:
            # Expand left child to fill parent's space
            left_copy.x = node.x
            left_copy.y = node.y
            left_copy.w = node.w
            left_copy.h = node.h
            self.update_node_coords(left_copy)
            return left_copy
        else:
            # Both children exist, copy container
            copy = BSPNode(node.x, node.y, node.w, node.h)
            copy.split_type = node.split_type
            copy.ratio = node.ratio
            copy.children = [left_copy, right_copy]
            left_copy.parent = copy
            right_copy.parent = copy
            return copy

    def swap_nodes(self, node1, node2):
        """Swap two nodes in the tree"""
        # Swap apps
        node1.app, node2.app = node2.app, node1.app

    def insert_node(self, drag_node, target_node, position):
        """Insert drag_node into target_node's position, creating a split"""
        if not target_node.is_leaf():
            # Target is already a container, can't split it
            return

        # Save target's current properties
        target_x = target_node.x
        target_y = target_node.y
        target_w = target_node.w
        target_h = target_node.h
        target_app = target_node.app

        # Convert target into a container (it was a leaf)
        target_node.app = None
        target_node.ratio = 0.5

        # Create split based on position
        if position in ['top', 'bottom']:
            target_node.split_type = 'vertical'
            if position == 'top':
                # Drag node on top, target on bottom
                top = BSPNode(target_x, target_y, target_w, target_h * 0.5, drag_node.app)
                bottom = BSPNode(target_x, target_y + target_h * 0.5, target_w, target_h * 0.5, target_app)
                target_node.children = [top, bottom]
            else:  # bottom
                top = BSPNode(target_x, target_y, target_w, target_h * 0.5, target_app)
                bottom = BSPNode(target_x, target_y + target_h * 0.5, target_w, target_h * 0.5, drag_node.app)
                target_node.children = [top, bottom]
        else:  # left or right
            target_node.split_type = 'horizontal'
            if position == 'left':
                # Drag node on left, target on right
                left = BSPNode(target_x, target_y, target_w * 0.5, target_h, drag_node.app)
                right = BSPNode(target_x + target_w * 0.5, target_y, target_w * 0.5, target_h, target_app)
                target_node.children = [left, right]
            else:  # right
                left = BSPNode(target_x, target_y, target_w * 0.5, target_h, target_app)
                right = BSPNode(target_x + target_w * 0.5, target_y, target_w * 0.5, target_h, drag_node.app)
                target_node.children = [left, right]

        # Set parent references
        target_node.children[0].parent = target_node
        target_node.children[1].parent = target_node

    def remove_node_from_tree(self, node):
        """Remove a node from the tree, having its sibling take its place"""
        if node == self.root:
            return

        parent = node.parent
        if not parent:
            return

        # Get sibling
        sibling = parent.children[1] if parent.children[0] == node else parent.children[0]

        # Sibling takes parent's position
        sibling.x = parent.x
        sibling.y = parent.y
        sibling.w = parent.w
        sibling.h = parent.h
        self.update_node_coords(sibling)

        # Replace parent with sibling in grandparent
        if parent == self.root:
            self.root = sibling
            self.root.parent = None
        else:
            grandparent = parent.parent
            if grandparent.children[0] == parent:
                grandparent.children[0] = sibling
            else:
                grandparent.children[1] = sibling
            sibling.parent = grandparent

    def delete_node(self, node):
        """Delete a node and restructure the tree"""
        # Can't delete root if it's the only node
        if node == self.root and node.is_leaf():
            print("Cannot delete the only node")
            return False

        # Can't delete root if it has children - this shouldn't happen as root should be leaf
        if node == self.root:
            print("Cannot delete root container node")
            return False

        parent = node.parent
        if not parent:
            return False

        # Get sibling
        sibling = None
        if parent.children[0] == node:
            sibling = parent.children[1]
        else:
            sibling = parent.children[0]

        # Sibling takes parent's full space
        sibling.x = parent.x
        sibling.y = parent.y
        sibling.w = parent.w
        sibling.h = parent.h

        # Update all children coordinates recursively
        self.update_node_coords(sibling)

        # If parent is root, promote sibling to root
        if parent == self.root:
            self.root = sibling
            self.root.parent = None
            self.selected_node = None
        else:
            # Replace parent with sibling in grandparent
            grandparent = parent.parent
            if grandparent.children[0] == parent:
                grandparent.children[0] = sibling
            else:
                grandparent.children[1] = sibling

            sibling.parent = grandparent
            self.selected_node = None

        return True

    def update_node_coords(self, node):
        """Recursively update child node coordinates based on parent"""
        if node.is_leaf():
            return

        # Recalculate children positions based on split
        if node.split_type == 'vertical':
            # Top/bottom split
            split_pos = node.h * node.ratio
            node.children[0].x = node.x
            node.children[0].y = node.y
            node.children[0].w = node.w
            node.children[0].h = split_pos

            node.children[1].x = node.x
            node.children[1].y = node.y + split_pos
            node.children[1].w = node.w
            node.children[1].h = node.h - split_pos
        else:
            # Horizontal split (left/right)
            split_pos = node.w * node.ratio
            node.children[0].x = node.x
            node.children[0].y = node.y
            node.children[0].w = split_pos
            node.children[0].h = node.h

            node.children[1].x = node.x + split_pos
            node.children[1].y = node.y
            node.children[1].w = node.w - split_pos
            node.children[1].h = node.h

        # Recursively update grandchildren
        for child in node.children:
            self.update_node_coords(child)

    def on_clear(self, widget):
        """Clear the layout and start fresh"""
        self.root = BSPNode(0, 0, 1, 1)
        self.selected_node = None
        self.editing_path = None
        self.canvas.queue_draw()

    def load_layout_from_file(self, filepath):
        """Load a layout from JSON file"""
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            # Convert JSON to BSP tree
            self.root = self.json_to_bsp(data, 0, 0, 1, 1)
            self.selected_node = None
            self.canvas.queue_draw()
        except Exception as e:
            print(f"Error loading layout: {e}")

    def json_to_bsp(self, data, x, y, w, h):
        """Recursively convert JSON layout to BSP tree"""
        if data['type'] == 'window':
            node = BSPNode(x, y, w, h, app=data.get('app'))
            return node
        else:
            # Container node
            node = BSPNode(x, y, w, h)
            node.split_type = data['split']
            node.ratio = data.get('ratio', 0.5)

            children_data = data.get('children', [])
            if len(children_data) == 2:
                if node.split_type == 'vertical':
                    # Top/bottom split
                    split_pos = h * node.ratio
                    left = self.json_to_bsp(children_data[0], x, y, w, split_pos)
                    right = self.json_to_bsp(children_data[1], x, y + split_pos, w, h - split_pos)
                else:
                    # Horizontal split (left/right)
                    split_pos = w * node.ratio
                    left = self.json_to_bsp(children_data[0], x, y, split_pos, h)
                    right = self.json_to_bsp(children_data[1], x + split_pos, y, w - split_pos, h)

                node.children = [left, right]
                left.parent = node
                right.parent = node

            return node


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
        delete_btn.add_css_class('delete-button')

        # Add hover controller
        hover_controller = Gtk.EventControllerMotion.new()
        def on_hover_enter(controller, x, y):
            delete_btn.add_css_class('delete-button-hover')
        def on_hover_leave(controller):
            delete_btn.remove_css_class('delete-button-hover')
        hover_controller.connect('enter', on_hover_enter)
        hover_controller.connect('leave', on_hover_leave)
        delete_btn.add_controller(hover_controller)

        def on_delete_click(widget):
            # Flash red background when clicked
            delete_btn.add_css_class('delete-button-clicked')

            # Call the actual delete
            on_delete(path, name)

            # Reset after delay
            def reset():
                delete_btn.remove_css_class('delete-button-clicked')
                return False
            GLib.timeout_add(300, reset)
        delete_btn.connect('clicked', on_delete_click)
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

        .delete-button {
            background: rgba(60, 20, 20, 0.8);
            color: #ff6b6b;
        }

        .delete-button-hover {
            background: rgba(80, 30, 30, 0.9);
            color: #ff4444;
            border: 1px solid #ff6b6b;
        }

        .delete-button-clicked {
            background: rgba(150, 20, 20, 1.0);
            color: #ffffff;
            border: 2px solid #ff0000;
        }

        .monitor-box {
            background: rgba(30, 30, 30, 0.6);
            border-radius: 10px;
            border: 2px solid rgba(60, 60, 60, 0.8);
            padding: 15px;
            min-width: 250px;
        }

        .workspace-button {
            background: rgba(50, 50, 50, 0.9);
            border: 1px solid rgba(80, 80, 80, 0.6);
            border-radius: 6px;
            padding: 8px;
        }

        .workspace-button:hover {
            background: rgba(70, 70, 70, 0.9);
            border: 1px solid rgba(100, 100, 100, 0.8);
        }

        .dim-label {
            opacity: 0.6;
            font-size: 0.9em;
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

        # Tab 3: Workspace Layout (combines editor and layout management)
        workspace_layout_page = self.create_workspace_layout_page()
        self.notebook.append_page(workspace_layout_page, Gtk.Label(label="Workspace Layout"))

        # Tab 5: Settings
        settings_page = self.create_settings_page()
        self.notebook.append_page(settings_page, Gtk.Label(label="Settings"))

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
        """Create the manage layouts page with list + preview structure"""
        page = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)

        # Left panel - List of saved layouts
        left_panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        left_panel.set_size_request(220, -1)
        left_panel.add_css_class('sidebar')

        # Header
        header = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        header.set_margin_start(15)
        header.set_margin_end(15)
        header.set_margin_top(15)
        header.set_margin_bottom(10)

        title = Gtk.Label()
        title.set_markup("<b>Saved Layouts</b>")
        title.set_halign(Gtk.Align.START)
        header.append(title)

        new_layout_btn = Gtk.Button(label="New Layout")
        new_layout_btn.connect('clicked', self.on_new_layout_embedded)
        new_layout_btn.set_margin_top(5)
        header.append(new_layout_btn)

        left_panel.append(header)

        # List of layouts
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)

        self.layouts_list = Gtk.ListBox()
        self.layouts_list.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.layouts_list.connect('row-selected', self.on_layout_selected)
        scrolled.set_child(self.layouts_list)

        left_panel.append(scrolled)

        page.append(left_panel)

        # Right panel - Layout preview/details
        right_panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        right_panel.set_hexpand(True)
        right_panel.set_margin_start(20)
        right_panel.set_margin_end(20)
        right_panel.set_margin_top(20)
        right_panel.set_margin_bottom(20)

        # Preview header with buttons
        preview_header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)

        self.layout_preview_title = Gtk.Label()
        self.layout_preview_title.set_markup("<big><b>Select a layout</b></big>")
        self.layout_preview_title.set_hexpand(True)
        self.layout_preview_title.set_halign(Gtk.Align.START)
        preview_header.append(self.layout_preview_title)

        # Buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        self.layout_apply_btn = Gtk.Button(label="Apply Layout")
        self.layout_apply_btn.connect('clicked', self.on_apply_layout)
        self.layout_apply_btn.set_sensitive(False)
        button_box.append(self.layout_apply_btn)

        self.layout_delete_btn = Gtk.Button(label="Delete")
        self.layout_delete_btn.add_css_class('destructive-action')
        self.layout_delete_btn.connect('clicked', self.on_delete_layout)
        self.layout_delete_btn.set_sensitive(False)
        button_box.append(self.layout_delete_btn)

        preview_header.append(button_box)
        right_panel.append(preview_header)

        # Designer container (embedded in right panel)
        self.layout_designer_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.layout_designer_container.set_vexpand(True)

        # Create embedded designer
        self.embedded_designer = BSPDesigner(
            on_back=None,  # No back button needed
            on_save=self.on_save_designer_layout
        )
        self.layout_designer_container.append(self.embedded_designer)

        right_panel.append(self.layout_designer_container)

        page.append(right_panel)

        # Track currently selected layout
        self.current_selected_layout = None

        # Load layouts
        self.load_saved_layouts()

        return page

    def create_workspace_editor_page(self):
        """Create the workspace editor page (for when it was a standalone tab)"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        page.set_margin_start(20)
        page.set_margin_end(20)
        page.set_margin_top(20)
        page.set_margin_bottom(20)

        # Title
        title = Gtk.Label()
        title.set_markup("<big><b>Workspace Editor</b></big>")
        title.set_halign(Gtk.Align.START)
        page.append(title)

        return self.create_workspace_editor_page_content_in(page)

    def create_workspace_editor_page_content(self):
        """Create the workspace editor page content without margins (for sub-tab use)"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        return self.create_workspace_editor_page_content_in(page)

    def create_workspace_editor_page_content_in(self, page):
        """Create the workspace editor page content in the provided container"""

        # Scrolled window for workspace list
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)
        scrolled.set_hexpand(True)
        scrolled.set_margin_top(20)

        self.workspace_editor_list = Gtk.ListBox()
        self.workspace_editor_list.set_selection_mode(Gtk.SelectionMode.NONE)
        scrolled.set_child(self.workspace_editor_list)

        page.append(scrolled)

        # Add workspace button
        add_btn = Gtk.Button(label="Add Workspace")
        add_btn.connect('clicked', self.on_add_workspace)
        add_btn.set_margin_top(10)
        page.append(add_btn)

        # Load workspaces
        self.refresh_workspace_editor()

        return page

    def refresh_workspace_editor(self):
        """Refresh the workspace editor list"""
        # Clear existing
        child = self.workspace_editor_list.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.workspace_editor_list.remove(child)
            child = next_child

        # Get workspaces from config
        workspaces = self.get_saved_workspaces()

        # Get live workspaces to show status
        live_workspaces = self.get_workspaces()
        live_ws_dict = {ws.get('id'): ws for ws in live_workspaces}

        for ws in sorted(workspaces, key=lambda x: x.get('id', 0)):
            row = self.create_workspace_editor_row(ws, ws.get('id') in live_ws_dict)
            self.workspace_editor_list.append(row)

    def create_workspace_editor_row(self, workspace, is_active):
        """Create a row for workspace editor"""
        row = Gtk.ListBoxRow()
        row.set_selectable(False)
        row.set_activatable(False)

        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        box.set_margin_start(15)
        box.set_margin_end(15)
        box.set_margin_top(15)
        box.set_margin_bottom(15)

        # Workspace info
        info_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        info_box.set_hexpand(True)

        ws_id = workspace.get('id')
        monitor = workspace.get('monitor', 'Unknown')

        name_label = Gtk.Label(label=f"Workspace {ws_id}")
        name_label.set_halign(Gtk.Align.START)
        name_label.add_css_class('title-3')
        info_box.append(name_label)

        detail_label = Gtk.Label(label=f"Monitor: {monitor} • Status: {'Active' if is_active else 'Inactive'}")
        detail_label.set_halign(Gtk.Align.START)
        detail_label.add_css_class('dim-label')
        info_box.append(detail_label)

        box.append(info_box)

        # Buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        edit_btn = Gtk.Button(label="Edit")
        edit_btn.connect('clicked', lambda w: self.on_edit_workspace(ws_id))
        button_box.append(edit_btn)

        delete_btn = Gtk.Button(label="Delete")
        delete_btn.add_css_class('destructive-action')
        delete_btn.connect('clicked', lambda w: self.on_delete_workspace(ws_id))
        button_box.append(delete_btn)

        box.append(button_box)

        row.set_child(box)
        return row

    def on_add_workspace(self, widget):
        """Add a new workspace"""
        dialog = Gtk.Dialog(
            title="Add Workspace",
            transient_for=self,
            modal=True
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Add", Gtk.ResponseType.OK)

        content = dialog.get_content_area()
        content.set_margin_start(20)
        content.set_margin_end(20)
        content.set_margin_top(20)
        content.set_margin_bottom(20)

        # Workspace ID
        id_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        id_label = Gtk.Label(label="Workspace ID:")
        id_label.set_width_chars(15)
        id_label.set_halign(Gtk.Align.START)
        id_entry = Gtk.Entry()
        id_entry.set_placeholder_text("e.g., 6")
        id_box.append(id_label)
        id_box.append(id_entry)
        content.append(id_box)

        # Monitor selection
        monitor_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        monitor_box.set_margin_top(10)
        monitor_label = Gtk.Label(label="Monitor:")
        monitor_label.set_width_chars(15)
        monitor_label.set_halign(Gtk.Align.START)

        monitor_dropdown = Gtk.DropDown()
        monitors = self.get_monitors()
        monitor_names = [m['name'] for m in monitors]
        monitor_dropdown.set_model(Gtk.StringList.new(monitor_names))

        monitor_box.append(monitor_label)
        monitor_box.append(monitor_dropdown)
        content.append(monitor_box)

        def on_response(dlg, response):
            if response == Gtk.ResponseType.OK:
                ws_id = id_entry.get_text().strip()
                if ws_id and ws_id.isdigit():
                    monitor_idx = monitor_dropdown.get_selected()
                    monitor_name = monitor_names[monitor_idx] if monitor_idx < len(monitor_names) else monitors[0]['name']
                    self.add_workspace_to_config(int(ws_id), monitor_name)
            dlg.close()

        dialog.connect('response', on_response)
        dialog.present()

    def on_edit_workspace(self, ws_id):
        """Edit a workspace"""
        # Get current workspace info
        workspaces = self.get_saved_workspaces()
        workspace = next((ws for ws in workspaces if ws.get('id') == ws_id), None)

        if not workspace:
            return

        dialog = Gtk.Dialog(
            title=f"Edit Workspace {ws_id}",
            transient_for=self,
            modal=True
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Save", Gtk.ResponseType.OK)

        content = dialog.get_content_area()
        content.set_margin_start(20)
        content.set_margin_end(20)
        content.set_margin_top(20)
        content.set_margin_bottom(20)

        # Monitor selection
        monitor_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        monitor_label = Gtk.Label(label="Monitor:")
        monitor_label.set_width_chars(15)
        monitor_label.set_halign(Gtk.Align.START)

        monitor_dropdown = Gtk.DropDown()
        monitors = self.get_monitors()
        monitor_names = [m['name'] for m in monitors]
        monitor_dropdown.set_model(Gtk.StringList.new(monitor_names))

        # Set current monitor
        current_monitor = workspace.get('monitor')
        if current_monitor in monitor_names:
            monitor_dropdown.set_selected(monitor_names.index(current_monitor))

        monitor_box.append(monitor_label)
        monitor_box.append(monitor_dropdown)
        content.append(monitor_box)

        def on_response(dlg, response):
            if response == Gtk.ResponseType.OK:
                monitor_idx = monitor_dropdown.get_selected()
                monitor_name = monitor_names[monitor_idx] if monitor_idx < len(monitor_names) else monitors[0]['name']
                self.update_workspace_monitor_in_config(str(ws_id), monitor_name)
                self.refresh_workspace_editor()
            dlg.close()

        dialog.connect('response', on_response)
        dialog.present()

    def on_delete_workspace(self, ws_id):
        """Delete a workspace"""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            modal=True,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text="Delete Workspace?"
        )
        dialog.set_secondary_text(f"Are you sure you want to delete workspace {ws_id}?")

        def on_response(dlg, response):
            if response == Gtk.ResponseType.YES:
                self.delete_workspace_from_config(ws_id)
                self.refresh_workspace_editor()
            dlg.close()

        dialog.connect('response', on_response)
        dialog.present()

    def add_workspace_to_config(self, ws_id, monitor):
        """Add a workspace to config file"""
        config_path = Path.home() / '.config' / 'hypr' / 'custom' / 'rules.conf'

        try:
            lines = []
            if config_path.exists():
                with open(config_path, 'r') as f:
                    lines = f.readlines()

            # Check if workspace already exists
            for line in lines:
                if line.strip().startswith('workspace =') and f'name:{ws_id}' in line:
                    # Already exists
                    return

            # Find workspace section or create it
            workspace_section_start = -1
            for i, line in enumerate(lines):
                if line.strip().startswith('workspace ='):
                    if workspace_section_start == -1:
                        workspace_section_start = i
                elif workspace_section_start != -1 and not line.strip().startswith('workspace ='):
                    break

            if workspace_section_start == -1:
                # No workspace section, create it
                if lines and not lines[-1].endswith('\n'):
                    lines.append('\n')
                lines.append('\n# Workspace assignments\n')
                workspace_section_start = len(lines)

            # Add new workspace
            new_line = f'workspace = name:{ws_id}, monitor:{monitor}, default:true\n'

            # Insert in sorted position
            insert_pos = workspace_section_start
            for i in range(workspace_section_start, len(lines)):
                if not lines[i].strip().startswith('workspace ='):
                    break
                # Extract workspace ID from line
                if 'name:' in lines[i]:
                    try:
                        existing_id = int(lines[i].split('name:')[1].split(',')[0].strip())
                        if ws_id < existing_id:
                            insert_pos = i
                            break
                        insert_pos = i + 1
                    except:
                        pass

            lines.insert(insert_pos, new_line)

            # Write back
            with open(config_path, 'w') as f:
                f.writelines(lines)

            self.refresh_workspace_editor()

        except Exception as e:
            print(f"Failed to add workspace: {e}")

    def delete_workspace_from_config(self, ws_id):
        """Delete a workspace from config file"""
        config_path = Path.home() / '.config' / 'hypr' / 'custom' / 'rules.conf'

        try:
            with open(config_path, 'r') as f:
                lines = f.readlines()

            # Remove the workspace line
            new_lines = []
            for line in lines:
                if line.strip().startswith('workspace =') and f'name:{ws_id}' in line:
                    continue
                new_lines.append(line)

            # Write back
            with open(config_path, 'w') as f:
                f.writelines(new_lines)

        except Exception as e:
            print(f"Failed to delete workspace: {e}")

    def create_workspace_layout_page(self):
        """Create the workspace layout management page with sub-tabs"""
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)

        # Sub-tabs for Live and Saved
        self.workspace_tabs = Gtk.Notebook()
        self.workspace_tabs.set_margin_start(20)
        self.workspace_tabs.set_margin_end(20)
        self.workspace_tabs.set_margin_top(20)
        self.workspace_tabs.set_margin_bottom(20)

        # Auto-refresh when switching tabs
        def on_tab_switch(notebook, page, page_num):
            if page_num == 0:  # Live tab
                self.refresh_live_workspaces()
            elif page_num == 1:  # Workspaces tab
                self.refresh_workspaces_tab()
        self.workspace_tabs.connect('switch-page', on_tab_switch)

        # Live workspaces tab
        live_page = self.create_live_workspace_tab()
        self.workspace_tabs.append_page(live_page, Gtk.Label(label="Live"))

        # Workspaces editor tab (config list + editor)
        workspaces_page = self.create_workspaces_tab()
        self.workspace_tabs.append_page(workspaces_page, Gtk.Label(label="Workspaces"))

        page.append(self.workspace_tabs)
        return page

    def create_workspaces_tab(self):
        """Create the workspaces tab with config list and editor"""
        tab = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)

        # Left panel - List of saved configs
        left_panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        left_panel.set_size_request(300, -1)
        left_panel.add_css_class('sidebar')

        # Header
        header = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        header.set_margin_start(15)
        header.set_margin_end(15)
        header.set_margin_top(15)
        header.set_margin_bottom(10)

        title = Gtk.Label()
        title.set_markup("<b>Saved Configurations</b>")
        title.set_halign(Gtk.Align.START)
        header.append(title)

        new_btn = Gtk.Button(label="New Configuration")
        new_btn.connect('clicked', self.on_new_workspace_config_editor)
        new_btn.set_margin_top(5)
        header.append(new_btn)

        left_panel.append(header)

        # List of configs
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)

        self.workspaces_config_list = Gtk.ListBox()
        self.workspaces_config_list.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.workspaces_config_list.connect('row-selected', self.on_workspace_config_selected)
        scrolled.set_child(self.workspaces_config_list)

        left_panel.append(scrolled)

        tab.append(left_panel)

        # Right panel - Editor
        right_panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        right_panel.set_hexpand(True)
        right_panel.set_margin_start(20)
        right_panel.set_margin_end(20)
        right_panel.set_margin_top(20)
        right_panel.set_margin_bottom(20)

        # Editor header with buttons
        editor_header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)

        self.workspace_editor_title = Gtk.Label()
        self.workspace_editor_title.set_markup("<big><b>Select a configuration</b></big>")
        self.workspace_editor_title.set_hexpand(True)
        self.workspace_editor_title.set_halign(Gtk.Align.START)
        editor_header.append(self.workspace_editor_title)

        # Buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        self.workspace_save_btn = Gtk.Button(label="Save")
        self.workspace_save_btn.connect('clicked', self.on_save_workspace_editor)
        self.workspace_save_btn.set_sensitive(False)
        button_box.append(self.workspace_save_btn)

        self.workspace_apply_btn = Gtk.Button(label="Apply to Live")
        self.workspace_apply_btn.connect('clicked', self.on_apply_workspace_editor)
        self.workspace_apply_btn.set_sensitive(False)
        button_box.append(self.workspace_apply_btn)

        self.workspace_delete_btn = Gtk.Button(label="Delete")
        self.workspace_delete_btn.add_css_class('destructive-action')
        self.workspace_delete_btn.connect('clicked', self.on_delete_workspace_editor)
        self.workspace_delete_btn.set_sensitive(False)
        button_box.append(self.workspace_delete_btn)

        editor_header.append(button_box)
        right_panel.append(editor_header)

        # Editor content (drag-and-drop monitors like Live)
        self.workspaces_editor_container = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=30)
        self.workspaces_editor_container.set_halign(Gtk.Align.FILL)
        self.workspaces_editor_container.set_valign(Gtk.Align.FILL)
        self.workspaces_editor_container.set_hexpand(True)
        self.workspaces_editor_container.set_vexpand(True)

        right_panel.append(self.workspaces_editor_container)

        tab.append(right_panel)

        # Track currently edited config
        self.current_editing_config = None

        # Track editor state (which workspaces are on which monitors)
        self.editor_state = {}  # {monitor_name: [ws_id, ws_id, ...]}

        # Load config list
        self.refresh_workspaces_tab()

        return tab

    def refresh_workspaces_tab(self):
        """Refresh the workspaces config list"""
        # Clear list
        child = self.workspaces_config_list.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.workspaces_config_list.remove(child)
            child = next_child

        # Get saved configs
        saved_dir = Path.home() / '.config' / 'hypr' / 'layouts' / 'saved'
        if not saved_dir.exists():
            return

        config_files = list(saved_dir.glob('*.json'))
        for config_file in sorted(config_files):
            row = Gtk.ListBoxRow()
            label = Gtk.Label(label=config_file.stem)
            label.set_halign(Gtk.Align.START)
            label.set_margin_start(15)
            label.set_margin_end(15)
            label.set_margin_top(10)
            label.set_margin_bottom(10)
            row.set_child(label)
            row.config_file = config_file
            self.workspaces_config_list.append(row)

    def on_workspace_config_selected(self, list_box, row):
        """Load selected config into editor"""
        if not row:
            return

        config_file = row.config_file
        self.current_editing_config = config_file

        # Update title
        self.workspace_editor_title.set_markup(f"<big><b>{config_file.stem}</b></big>")

        # Enable buttons
        self.workspace_save_btn.set_sensitive(True)
        self.workspace_apply_btn.set_sensitive(True)
        self.workspace_delete_btn.set_sensitive(True)

        # Load config and populate editor
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)

            workspaces = config.get('workspaces', [])

            # Initialize editor state
            monitors = self.get_monitors()
            self.editor_state = {m['name']: [] for m in monitors}

            for ws in workspaces:
                monitor = ws.get('monitor')
                ws_id = ws.get('id')
                if monitor in self.editor_state:
                    self.editor_state[monitor].append(ws_id)

            # Clear editor
            child = self.workspaces_editor_container.get_first_child()
            while child:
                next_child = child.get_next_sibling()
                self.workspaces_editor_container.remove(child)
                child = next_child

            # Create monitor boxes (editable)
            for monitor in monitors:
                monitor_name = monitor['name']
                monitor_box = self.create_editable_monitor_box(monitor_name)
                self.workspaces_editor_container.append(monitor_box)

        except Exception as e:
            print(f"Error loading config: {e}")

    def create_editable_monitor_box(self, monitor_name):
        """Create an editable monitor box with add/remove functionality"""
        container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        container.add_css_class('monitor-box')
        container.set_hexpand(True)

        # Monitor label
        label = Gtk.Label()
        label.set_markup(f"<span size='large'><b>{monitor_name}</b></span>")
        label.set_margin_bottom(5)
        container.append(label)

        # Workspace list container (like Live view)
        ws_list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        ws_list.set_margin_start(15)
        ws_list.set_margin_end(15)
        ws_list.set_margin_top(15)
        ws_list.set_margin_bottom(15)
        ws_list.set_vexpand(True)
        ws_list.add_css_class('workspace-list')

        # Add workspaces from editor state
        if monitor_name in self.editor_state and self.editor_state[monitor_name]:
            for ws_id in sorted(self.editor_state[monitor_name]):
                ws_card = self.create_editable_workspace_card(ws_id, monitor_name)
                ws_list.append(ws_card)
        else:
            empty_label = Gtk.Label(label="Right-click to add workspace")
            empty_label.add_css_class('dim-label')
            ws_list.append(empty_label)

        # Make droppable (attach to ws_list like Live view)
        drop_target = Gtk.DropTarget.new(type=str, actions=Gdk.DragAction.MOVE)

        def on_drop(target, value, x, y):
            ws_id = int(value)
            # Remove from old monitor
            for mon, ws_ids in self.editor_state.items():
                if ws_id in ws_ids:
                    ws_ids.remove(ws_id)
                    self.refresh_editor_monitor_box(mon)
                    break

            # Add to new monitor
            if monitor_name not in self.editor_state:
                self.editor_state[monitor_name] = []
            if ws_id not in self.editor_state[monitor_name]:
                self.editor_state[monitor_name].append(ws_id)
                self.editor_state[monitor_name].sort()
                self.refresh_editor_monitor_box(monitor_name)

            return True

        def on_enter(target, x, y):
            container.add_css_class('drag-target')
            return Gdk.DragAction.MOVE

        def on_leave(target):
            container.remove_css_class('drag-target')

        drop_target.connect('drop', on_drop)
        drop_target.connect('enter', on_enter)
        drop_target.connect('leave', on_leave)
        ws_list.add_controller(drop_target)

        # Add right-click menu to container
        gesture = Gtk.GestureClick(button=3)
        gesture.connect('released', lambda g, n, x, y: self.show_monitor_context_menu(monitor_name))
        container.add_controller(gesture)

        container.append(ws_list)

        # Store reference for later updates
        container.workspace_container = ws_list
        container.monitor_name = monitor_name

        return container

    def create_editable_workspace_card(self, ws_id, monitor_name):
        """Create a draggable workspace card that can be removed"""
        # Main container
        container = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        # Button with workspace info
        button_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)

        ws_label = Gtk.Label()
        ws_label.set_markup(f"<b>Workspace {ws_id}</b>")
        button_box.append(ws_label)

        button = Gtk.Button()
        button.set_child(button_box)
        button.set_hexpand(True)
        button.add_css_class('workspace-button')

        # Set up as drag source
        drag_source = Gtk.DragSource.new()
        drag_source.set_actions(Gdk.DragAction.MOVE)

        def on_prepare(source, x, y):
            value = str(ws_id)
            return Gdk.ContentProvider.new_for_value(value)

        def on_drag_begin(source, drag):
            paintable = Gtk.WidgetPaintable.new(button)
            source.set_icon(paintable, button.get_width() // 2, button.get_height() // 2)

        drag_source.connect('prepare', on_prepare)
        drag_source.connect('drag-begin', on_drag_begin)
        button.add_controller(drag_source)

        container.append(button)

        # Remove button
        remove_btn = Gtk.Button(label="×")
        remove_btn.add_css_class('circular')
        remove_btn.connect('clicked', lambda w: self.remove_workspace_from_editor(ws_id, monitor_name))
        container.append(remove_btn)

        return container

    def show_monitor_context_menu(self, monitor_name):
        """Show context menu to add workspace"""
        dialog = Gtk.Dialog(
            title="Add Workspace",
            transient_for=self,
            modal=True
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Add", Gtk.ResponseType.OK)

        content = dialog.get_content_area()
        content.set_margin_start(20)
        content.set_margin_end(20)
        content.set_margin_top(20)
        content.set_margin_bottom(20)

        label = Gtk.Label(label="Workspace Number:")
        content.append(label)

        entry = Gtk.Entry()
        entry.set_placeholder_text("e.g., 5")
        entry.set_margin_top(10)
        content.append(entry)

        def on_response(dlg, response):
            dlg.close()
            if response == Gtk.ResponseType.OK:
                ws_num = entry.get_text().strip()
                if ws_num and ws_num.isdigit():
                    ws_id = int(ws_num)
                    # Add to editor state
                    if monitor_name not in self.editor_state:
                        self.editor_state[monitor_name] = []
                    if ws_id not in self.editor_state[monitor_name]:
                        self.editor_state[monitor_name].append(ws_id)
                        self.editor_state[monitor_name].sort()

                        # Refresh the monitor box
                        self.refresh_editor_monitor_box(monitor_name)

        dialog.connect('response', on_response)
        dialog.present()

    def remove_workspace_from_editor(self, ws_id, monitor_name):
        """Remove a workspace from the editor"""
        if monitor_name in self.editor_state and ws_id in self.editor_state[monitor_name]:
            self.editor_state[monitor_name].remove(ws_id)
            self.refresh_editor_monitor_box(monitor_name)

    def refresh_editor_monitor_box(self, monitor_name):
        """Refresh a specific monitor box in the editor"""
        # Find the monitor box
        child = self.workspaces_editor_container.get_first_child()
        while child:
            if hasattr(child, 'monitor_name') and child.monitor_name == monitor_name:
                # Clear workspace container
                ws_container = child.workspace_container
                ws_child = ws_container.get_first_child()
                while ws_child:
                    next_child = ws_child.get_next_sibling()
                    ws_container.remove(ws_child)
                    ws_child = next_child

                # Re-add workspaces
                if monitor_name in self.editor_state and self.editor_state[monitor_name]:
                    for ws_id in sorted(self.editor_state[monitor_name]):
                        ws_card = self.create_editable_workspace_card(ws_id, monitor_name)
                        ws_container.append(ws_card)
                else:
                    # Show empty state
                    empty_label = Gtk.Label(label="Right-click to add workspace")
                    empty_label.add_css_class('dim-label')
                    ws_container.append(empty_label)
                break
            child = child.get_next_sibling()

    def on_new_workspace_config_editor(self, widget):
        """Create a new workspace configuration"""
        dialog = Gtk.Dialog(
            title="New Configuration",
            transient_for=self,
            modal=True
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Create", Gtk.ResponseType.OK)

        content = dialog.get_content_area()
        content.set_margin_start(20)
        content.set_margin_end(20)
        content.set_margin_top(20)
        content.set_margin_bottom(20)

        label = Gtk.Label(label="Configuration Name:")
        content.append(label)

        entry = Gtk.Entry()
        entry.set_placeholder_text("e.g., work, gaming, default")
        entry.set_margin_top(10)
        content.append(entry)

        def on_response(dlg, response):
            dlg.close()
            if response == Gtk.ResponseType.OK:
                name = entry.get_text().strip()
                if name:
                    # Create empty config
                    self.save_workspace_config_to_file(name, [])
                    self.refresh_workspaces_tab()

                    # Auto-select the newly created config
                    saved_dir = Path.home() / '.config' / 'hypr' / 'layouts' / 'saved'
                    config_file = saved_dir / f"{name}.json"

                    # Find and select the row
                    row = self.workspaces_config_list.get_first_child()
                    while row:
                        if hasattr(row, 'config_file') and row.config_file == config_file:
                            self.workspaces_config_list.select_row(row)
                            break
                        row = row.get_next_sibling()

        dialog.connect('response', on_response)
        dialog.present()

    def on_save_workspace_editor(self, widget):
        """Save changes to the current config from editor state"""
        if not self.current_editing_config:
            return

        try:
            # Build workspaces list from editor state
            workspaces = []
            for monitor_name, ws_ids in self.editor_state.items():
                for ws_id in ws_ids:
                    workspaces.append({
                        'id': ws_id,
                        'monitor': monitor_name
                    })

            # Sort by workspace ID
            workspaces.sort(key=lambda x: x['id'])

            # Read config name
            with open(self.current_editing_config, 'r') as f:
                config = json.load(f)

            name = config.get('name', self.current_editing_config.stem)

            # Update config
            config['workspaces'] = workspaces

            # Save back to file
            with open(self.current_editing_config, 'w') as f:
                json.dump(config, f, indent=2)

            dialog = Gtk.Dialog(
                title="Success",
                transient_for=self,
                modal=True
            )
            dialog.add_button("OK", Gtk.ResponseType.OK)

            content = dialog.get_content_area()
            content.set_margin_start(20)
            content.set_margin_end(20)
            content.set_margin_top(20)
            content.set_margin_bottom(20)

            label = Gtk.Label(label=f"Saved changes to '{name}'")
            content.append(label)

            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

        except Exception as e:
            dialog = Gtk.Dialog(
                title="Error",
                transient_for=self,
                modal=True
            )
            dialog.add_button("OK", Gtk.ResponseType.OK)

            content = dialog.get_content_area()
            content.set_margin_start(20)
            content.set_margin_end(20)
            content.set_margin_top(20)
            content.set_margin_bottom(20)

            label = Gtk.Label(label=f"Error saving: {str(e)}")
            content.append(label)

            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

    def on_apply_workspace_editor(self, widget):
        """Apply the edited config to live workspaces"""
        if not self.current_editing_config:
            return

        self.load_workspace_config_from_file(self.current_editing_config)

    def on_delete_workspace_editor(self, widget):
        """Delete the current config"""
        if not self.current_editing_config:
            return

        config_to_delete = self.current_editing_config

        dialog = Gtk.Dialog(
            title="Delete Configuration?",
            transient_for=self,
            modal=True
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Delete", Gtk.ResponseType.YES)

        content = dialog.get_content_area()
        content.set_margin_start(20)
        content.set_margin_end(20)
        content.set_margin_top(20)
        content.set_margin_bottom(20)

        label = Gtk.Label(label=f"Are you sure you want to delete '{config_to_delete.stem}'?")
        label.set_wrap(True)
        content.append(label)

        def on_response(dlg, response):
            if response == Gtk.ResponseType.YES:
                try:
                    config_to_delete.unlink()
                    self.current_editing_config = None

                    # Clear editor
                    child = self.workspaces_editor_container.get_first_child()
                    while child:
                        next_child = child.get_next_sibling()
                        self.workspaces_editor_container.remove(child)
                        child = next_child

                    # Reset UI
                    self.workspace_editor_title.set_markup("<big><b>Select a configuration</b></big>")
                    self.workspace_save_btn.set_sensitive(False)
                    self.workspace_apply_btn.set_sensitive(False)
                    self.workspace_delete_btn.set_sensitive(False)

                    # Refresh list
                    self.refresh_workspaces_tab()
                except Exception as e:
                    error_dialog = Gtk.Dialog(
                        title="Error",
                        transient_for=self,
                        modal=True
                    )
                    error_dialog.add_button("OK", Gtk.ResponseType.OK)
                    error_content = error_dialog.get_content_area()
                    error_content.set_margin_start(20)
                    error_content.set_margin_end(20)
                    error_content.set_margin_top(20)
                    error_content.set_margin_bottom(20)
                    error_label = Gtk.Label(label=f"Error deleting: {str(e)}")
                    error_content.append(error_label)
                    error_dialog.connect('response', lambda d, r: d.close())
                    error_dialog.present()
            dlg.close()

        dialog.connect('response', on_response)
        dialog.present()

    def create_live_workspace_tab(self):
        """Create the live workspaces tab"""
        tab = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)

        # Header with save button
        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        header.set_halign(Gtk.Align.CENTER)
        header.set_margin_top(10)

        self.save_btn = Gtk.Button(label="Save Current Layout")
        self.save_btn.connect('clicked', self.on_save_workspace_config)
        header.append(self.save_btn)

        tab.append(header)

        # Track current config being edited
        self.current_config_name = None

        # Container for monitor boxes - no scrolling, expand to fill
        self.live_monitors_container = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=30)
        self.live_monitors_container.set_halign(Gtk.Align.FILL)
        self.live_monitors_container.set_valign(Gtk.Align.FILL)
        self.live_monitors_container.set_hexpand(True)
        self.live_monitors_container.set_vexpand(True)
        self.live_monitors_container.set_margin_top(20)
        self.live_monitors_container.set_margin_start(20)
        self.live_monitors_container.set_margin_end(20)
        self.live_monitors_container.set_margin_bottom(20)

        tab.append(self.live_monitors_container)

        # Load initial data
        self.refresh_live_workspaces()

        return tab

    def create_saved_workspace_tab(self):
        """Create the saved workspaces tab"""
        tab = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)

        # Container for monitor boxes - no scrolling, expand to fill
        self.saved_monitors_container = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=30)
        self.saved_monitors_container.set_halign(Gtk.Align.FILL)
        self.saved_monitors_container.set_valign(Gtk.Align.FILL)
        self.saved_monitors_container.set_hexpand(True)
        self.saved_monitors_container.set_vexpand(True)
        self.saved_monitors_container.set_margin_top(20)
        self.saved_monitors_container.set_margin_start(20)
        self.saved_monitors_container.set_margin_end(20)
        self.saved_monitors_container.set_margin_bottom(20)

        tab.append(self.saved_monitors_container)

        # Load initial data
        self.refresh_saved_workspaces()

        return tab

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

    def get_saved_workspaces(self):
        """Get saved workspace configuration from config file"""
        config_path = Path.home() / '.config' / 'hypr' / 'custom' / 'rules.conf'
        workspaces = []

        try:
            with open(config_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Parse workspace rules like: workspace = name:1, monitor:eDP-1, default:true
                    if line.startswith('workspace =') and 'name:' in line:
                        parts = line.replace('workspace =', '').strip().split(',')
                        ws_data = {'id': 0, 'monitor': 'Unknown', 'windows': 0}

                        for part in parts:
                            part = part.strip()
                            if part.startswith('name:'):
                                ws_data['id'] = int(part.replace('name:', ''))
                            elif part.startswith('monitor:'):
                                ws_data['monitor'] = part.replace('monitor:', '')

                        workspaces.append(ws_data)
        except Exception as e:
            print(f"Error reading saved workspaces: {e}")

        return workspaces

    def refresh_live_workspaces(self):
        """Refresh live workspace data"""
        # Clear existing monitor boxes
        child = self.live_monitors_container.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.live_monitors_container.remove(child)
            child = next_child

        # Get data
        monitors = self.get_monitors()
        live_workspaces = self.get_workspaces()
        saved_workspaces = self.get_saved_workspaces()

        # Create a dict of live workspaces by ID for lookup
        live_ws_dict = {ws.get('id'): ws for ws in live_workspaces}

        # Merge: use live data if workspace exists, otherwise create placeholder from saved config
        all_workspaces = []
        for saved_ws in saved_workspaces:
            ws_id = saved_ws.get('id')
            if ws_id in live_ws_dict:
                # Use live workspace data
                all_workspaces.append(live_ws_dict[ws_id])
            else:
                # Create placeholder from saved config
                all_workspaces.append({
                    'id': ws_id,
                    'monitor': saved_ws.get('monitor', 'Unknown'),
                    'windows': 0
                })

        # Group workspaces by monitor
        ws_by_monitor = {}
        for ws in all_workspaces:
            monitor_name = ws.get('monitor', 'Unknown')
            if monitor_name not in ws_by_monitor:
                ws_by_monitor[monitor_name] = []
            ws_by_monitor[monitor_name].append(ws)

        # Create a visual box for each monitor
        for monitor in monitors:
            monitor_name = monitor['name']
            monitor_box = self.create_monitor_box(monitor_name, ws_by_monitor.get(monitor_name, []))
            self.live_monitors_container.append(monitor_box)

    def refresh_saved_workspaces(self):
        """Refresh list of saved workspace configurations"""
        # Clear existing content
        child = self.saved_monitors_container.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.saved_monitors_container.remove(child)
            child = next_child

        # Get saved config files
        saved_dir = Path.home() / '.config' / 'hypr' / 'layouts' / 'saved'

        if not saved_dir.exists():
            label = Gtk.Label(label="No saved configurations yet")
            label.add_css_class('dim-label')
            self.saved_monitors_container.append(label)
            return

        config_files = list(saved_dir.glob('*.json'))

        if not config_files:
            label = Gtk.Label(label="No saved configurations yet")
            label.add_css_class('dim-label')
            self.saved_monitors_container.append(label)
            return

        # Create a list box for saved configs
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)
        scrolled.set_hexpand(True)

        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        scrolled.set_child(list_box)

        # Add each saved config as a row
        for config_file in sorted(config_files):
            row = self.create_saved_config_row(config_file)
            list_box.append(row)

        self.saved_monitors_container.append(scrolled)

    def create_saved_config_row(self, config_file):
        """Create a row for a saved configuration"""
        row = Gtk.ListBoxRow()
        row.set_selectable(False)
        row.set_activatable(False)

        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        box.set_margin_start(15)
        box.set_margin_end(15)
        box.set_margin_top(15)
        box.set_margin_bottom(15)

        # Config info
        info_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        info_box.set_hexpand(True)

        name_label = Gtk.Label(label=config_file.stem)
        name_label.set_halign(Gtk.Align.START)
        name_label.add_css_class('title-3')
        info_box.append(name_label)

        # Read config to show details
        try:
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            workspaces = config_data.get('workspaces', [])

            # Show workspace assignments
            details = []
            for ws in sorted(workspaces, key=lambda x: x.get('id', 0)):
                details.append(f"WS {ws['id']} → {ws['monitor']}")

            detail_label = Gtk.Label(label=", ".join(details))
            detail_label.set_halign(Gtk.Align.START)
            detail_label.add_css_class('dim-label')
            detail_label.set_wrap(True)
            detail_label.set_max_width_chars(60)
            info_box.append(detail_label)
        except:
            pass

        box.append(info_box)

        # Buttons
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        edit_btn = Gtk.Button(label="Edit")
        edit_btn.connect('clicked', lambda w: self.edit_workspace_config(config_file))
        button_box.append(edit_btn)

        load_btn = Gtk.Button(label="Load")
        load_btn.connect('clicked', lambda w: self.load_workspace_config_from_file(config_file))
        button_box.append(load_btn)

        delete_btn = Gtk.Button(label="Delete")
        delete_btn.add_css_class('destructive-action')
        delete_btn.connect('clicked', lambda w: self.delete_saved_config(config_file))
        button_box.append(delete_btn)

        box.append(button_box)

        row.set_child(box)
        return row

    def delete_saved_config(self, config_file):
        """Delete a saved configuration"""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            modal=True,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text="Delete Configuration?"
        )
        dialog.set_secondary_text(f"Are you sure you want to delete '{config_file.stem}'?")

        def on_response(dlg, response):
            if response == Gtk.ResponseType.YES:
                try:
                    config_file.unlink()
                    self.refresh_saved_workspaces()
                except Exception as e:
                    error_dialog = Gtk.MessageDialog(
                        transient_for=self,
                        modal=True,
                        message_type=Gtk.MessageType.ERROR,
                        buttons=Gtk.ButtonsType.OK,
                        text="Error Deleting Config"
                    )
                    error_dialog.set_secondary_text(str(e))
                    error_dialog.connect('response', lambda d, r: d.close())
                    error_dialog.present()
            dlg.close()

        dialog.connect('response', on_response)
        dialog.present()

    def edit_workspace_config(self, config_file):
        """Load a configuration for editing"""
        try:
            # Load and apply the config
            with open(config_file, 'r') as f:
                config = json.load(f)

            workspaces = config.get('workspaces', [])
            if not workspaces:
                return

            # Get current live workspaces
            live_workspaces = self.get_workspaces()
            live_ws_dict = {ws.get('id'): ws for ws in live_workspaces}

            # Apply saved assignments
            for saved_ws in workspaces:
                ws_id = saved_ws.get('id')
                target_monitor = saved_ws.get('monitor')

                # Check if workspace exists and is on wrong monitor
                if ws_id in live_ws_dict:
                    current_monitor = live_ws_dict[ws_id].get('monitor')
                    if current_monitor != target_monitor:
                        # Move workspace to correct monitor
                        subprocess.run([
                            'hyprctl',
                            'dispatch',
                            'moveworkspacetomonitor',
                            str(ws_id),
                            target_monitor
                        ])
                        time.sleep(0.05)

            # Set current config name and update button
            self.current_config_name = config.get('name', config_file.stem)
            self.save_btn.set_label(f"Save '{self.current_config_name}'")

            # Switch to Live Workspaces tab
            self.workspace_tabs.set_current_page(0)

            # Refresh live view
            self.refresh_live_workspaces()

        except Exception as e:
            dialog = Gtk.MessageDialog(
                transient_for=self,
                modal=True,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text="Error Loading Config"
            )
            dialog.set_secondary_text(str(e))
            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

    def create_monitor_box(self, monitor_name, workspaces):
        """Create a visual box representing a monitor with its workspaces"""
        # Main container - expand to fill available space
        container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        container.add_css_class('monitor-box')
        container.set_hexpand(True)

        # Monitor label
        label = Gtk.Label()
        label.set_markup(f"<span size='large'><b>{monitor_name}</b></span>")
        label.set_margin_bottom(5)
        container.append(label)

        # List box to hold workspaces vertically
        ws_list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        ws_list.set_margin_start(15)
        ws_list.set_margin_end(15)
        ws_list.set_margin_top(15)
        ws_list.set_margin_bottom(15)
        ws_list.set_vexpand(True)
        ws_list.add_css_class('workspace-list')

        # Add workspaces as draggable buttons
        if workspaces:
            for ws in sorted(workspaces, key=lambda x: x.get('id', 0)):
                ws_button = self.create_workspace_button(ws)
                ws_list.append(ws_button)
        else:
            empty_label = Gtk.Label(label="No workspaces")
            empty_label.add_css_class('dim-label')
            ws_list.append(empty_label)

        # Set up as drop destination (GTK4) - entire list area
        drop_target = Gtk.DropTarget.new(type=str, actions=Gdk.DragAction.MOVE)
        drop_target.connect('drop', self.on_workspace_dropped, monitor_name)

        # Add visual feedback for the container
        def on_container_enter(target, x, y):
            container.add_css_class('drag-target')
            return Gdk.DragAction.MOVE

        def on_container_leave(target):
            container.remove_css_class('drag-target')

        drop_target.connect('enter', on_container_enter)
        drop_target.connect('leave', on_container_leave)
        ws_list.add_controller(drop_target)

        container.append(ws_list)
        return container

    def create_workspace_button(self, workspace):
        """Create a draggable button for a workspace"""
        ws_id = workspace.get('id', 0)
        ws_name = workspace.get('name', f"Workspace {ws_id}")
        windows = workspace.get('windows', 0)
        monitor = workspace.get('monitor', 'Unknown')

        # Create button with workspace info
        button_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)

        ws_label = Gtk.Label()
        ws_label.set_markup(f"<b>Workspace {ws_id}</b>")
        button_box.append(ws_label)

        if windows > 0:
            win_label = Gtk.Label(label=f"{windows} window{'s' if windows != 1 else ''}")
            win_label.add_css_class('dim-label')
            button_box.append(win_label)

        button = Gtk.Button()
        button.set_child(button_box)
        button.set_hexpand(True)
        button.add_css_class('workspace-button')

        # Set up as drag source (GTK4)
        drag_source = Gtk.DragSource.new()
        drag_source.set_actions(Gdk.DragAction.MOVE)

        # Prepare drag data
        def on_prepare(source, x, y):
            value = str(ws_id)
            return Gdk.ContentProvider.new_for_value(value)

        # Create drag icon showing workspace being dragged
        def on_drag_begin(source, drag):
            # Use the button widget itself as the drag icon
            paintable = Gtk.WidgetPaintable.new(button)
            source.set_icon(paintable, button.get_width() // 2, button.get_height() // 2)

        drag_source.connect('prepare', on_prepare)
        drag_source.connect('drag-begin', on_drag_begin)
        button.add_controller(drag_source)

        # Set up as drop target (GTK4) - can drop other workspaces onto this one
        drop_target = Gtk.DropTarget.new(type=str, actions=Gdk.DragAction.MOVE)
        drop_target.connect('drop', self.on_workspace_dropped_on_workspace, monitor)

        # Add visual feedback on drag enter/leave
        def on_drag_enter(target, x, y):
            button.add_css_class('drag-hover')
            return Gdk.DragAction.MOVE

        def on_drag_leave(target):
            button.remove_css_class('drag-hover')

        drop_target.connect('enter', on_drag_enter)
        drop_target.connect('leave', on_drag_leave)
        button.add_controller(drop_target)

        return button

    def on_workspace_dropped_on_workspace(self, drop_target, value, x, y, target_monitor):
        """Handle workspace dropped onto another workspace"""
        workspace_id = value
        if workspace_id:
            try:
                # Check if workspace exists (has windows)
                live_workspaces = self.get_workspaces()
                workspace_exists = any(ws.get('id') == int(workspace_id) for ws in live_workspaces)

                if workspace_exists:
                    # Get current active workspace and monitor before moving
                    active_ws_output = subprocess.run(
                        ['hyprctl', 'activeworkspace', '-j'],
                        capture_output=True,
                        text=True
                    )
                    current_workspace = None
                    current_monitor = None
                    source_monitor = None
                    if active_ws_output.returncode == 0:
                        active_ws = json.loads(active_ws_output.stdout)
                        current_workspace = str(active_ws['id'])
                        current_monitor = active_ws['monitor']

                    # Find source monitor of the workspace being moved
                    for ws in live_workspaces:
                        if ws.get('id') == int(workspace_id):
                            source_monitor = ws.get('monitor')
                            break

                    # Move workspace to target monitor
                    subprocess.run([
                        'hyprctl',
                        'dispatch',
                        'moveworkspacetomonitor',
                        workspace_id,
                        target_monitor
                    ])

                    # Small delay to let Hyprland settle (see GitHub issue #2154)
                    time.sleep(0.1)

                    # Handle focus based on whether we moved the active workspace
                    if current_workspace == workspace_id:
                        # We moved the active workspace - follow it to target monitor
                        subprocess.run([
                            'hyprctl',
                            'dispatch',
                            'workspace',
                            workspace_id
                        ])

                        # Switch source monitor to another workspace if available
                        if source_monitor and source_monitor != current_monitor:
                            other_workspace = None
                            for ws in live_workspaces:
                                ws_id = str(ws.get('id'))
                                if ws.get('monitor') == source_monitor and ws_id != workspace_id:
                                    other_workspace = ws_id
                                    break

                            if other_workspace:
                                subprocess.run([
                                    'hyprctl',
                                    'dispatch',
                                    'workspace',
                                    other_workspace
                                ])
                    else:
                        # We moved a non-active workspace - stay on current workspace
                        if current_workspace and current_monitor:
                            subprocess.run([
                                'hyprctl',
                                'dispatch',
                                'workspace',
                                current_workspace
                            ])
                else:
                    # Update saved config for empty workspace
                    self.update_workspace_monitor_in_config(workspace_id, target_monitor)

                # Refresh live workspaces
                self.refresh_live_workspaces()
                return True
            except Exception as e:
                print(f"Move failed: {e}")
                return False
        return False

    def on_workspace_dropped(self, drop_target, value, x, y, target_monitor):
        """Handle workspace drop on a monitor container (GTK4)"""
        workspace_id = value
        if workspace_id:
            try:
                # Check if workspace exists (has windows)
                live_workspaces = self.get_workspaces()
                workspace_exists = any(ws.get('id') == int(workspace_id) for ws in live_workspaces)

                if workspace_exists:
                    # Get current active workspace and monitor before moving
                    active_ws_output = subprocess.run(
                        ['hyprctl', 'activeworkspace', '-j'],
                        capture_output=True,
                        text=True
                    )
                    current_workspace = None
                    current_monitor = None
                    source_monitor = None
                    if active_ws_output.returncode == 0:
                        active_ws = json.loads(active_ws_output.stdout)
                        current_workspace = str(active_ws['id'])
                        current_monitor = active_ws['monitor']

                    # Find source monitor of the workspace being moved
                    for ws in live_workspaces:
                        if ws.get('id') == int(workspace_id):
                            source_monitor = ws.get('monitor')
                            break

                    # Move workspace to target monitor
                    subprocess.run([
                        'hyprctl',
                        'dispatch',
                        'moveworkspacetomonitor',
                        workspace_id,
                        target_monitor
                    ])

                    # Small delay to let Hyprland settle (see GitHub issue #2154)
                    time.sleep(0.1)

                    # Handle focus based on whether we moved the active workspace
                    if current_workspace == workspace_id:
                        # We moved the active workspace - follow it to target monitor
                        subprocess.run([
                            'hyprctl',
                            'dispatch',
                            'workspace',
                            workspace_id
                        ])

                        # Switch source monitor to another workspace if available
                        if source_monitor and source_monitor != current_monitor:
                            other_workspace = None
                            for ws in live_workspaces:
                                ws_id = str(ws.get('id'))
                                if ws.get('monitor') == source_monitor and ws_id != workspace_id:
                                    other_workspace = ws_id
                                    break

                            if other_workspace:
                                subprocess.run([
                                    'hyprctl',
                                    'dispatch',
                                    'workspace',
                                    other_workspace
                                ])
                    else:
                        # We moved a non-active workspace - stay on current workspace
                        if current_workspace and current_monitor:
                            subprocess.run([
                                'hyprctl',
                                'dispatch',
                                'workspace',
                                current_workspace
                            ])
                else:
                    # Update saved config for empty workspace
                    self.update_workspace_monitor_in_config(workspace_id, target_monitor)

                # Refresh live workspaces
                self.refresh_live_workspaces()
                return True
            except Exception as e:
                print(f"Move failed: {e}")
                return False
        return False

    def update_workspace_monitor_in_config(self, workspace_id, new_monitor):
        """Update workspace monitor assignment in config file"""
        config_path = Path.home() / '.config' / 'hypr' / 'custom' / 'rules.conf'

        try:
            with open(config_path, 'r') as f:
                lines = f.readlines()

            # Update the line with the workspace assignment
            updated = False
            for i, line in enumerate(lines):
                if line.strip().startswith('workspace =') and f'name:{workspace_id}' in line:
                    # Parse and update the monitor assignment
                    parts = line.split(',')
                    new_parts = []
                    for part in parts:
                        part = part.strip()
                        if part.startswith('monitor:'):
                            new_parts.append(f'monitor:{new_monitor}')
                        else:
                            new_parts.append(part)
                    lines[i] = ', '.join(new_parts) + '\n'
                    updated = True
                    break

            if updated:
                # Write back to config
                with open(config_path, 'w') as f:
                    f.writelines(lines)

                # Reload Hyprland config
                subprocess.run(['hyprctl', 'reload'])

        except Exception as e:
            print(f"Failed to update config: {e}")

    def on_save_workspace_config(self, widget):
        """Save current workspace configuration to a named file"""
        try:
            # Get current workspaces
            workspaces = self.get_workspaces()

            if not workspaces:
                dialog = Gtk.MessageDialog(
                    transient_for=self,
                    modal=True,
                    message_type=Gtk.MessageType.WARNING,
                    buttons=Gtk.ButtonsType.OK,
                    text="No Workspaces Found"
                )
                dialog.set_secondary_text("There are no active workspaces to save.")
                dialog.connect('response', lambda d, r: d.close())
                dialog.present()
                return

            # Prompt for config name
            dialog = Gtk.Dialog(
                title="Save Workspace Configuration",
                transient_for=self,
                modal=True
            )
            dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
            if self.current_config_name:
                dialog.add_button("Save as New", Gtk.ResponseType.APPLY)
            dialog.add_button("Save", Gtk.ResponseType.OK)

            content = dialog.get_content_area()
            content.set_margin_start(20)
            content.set_margin_end(20)
            content.set_margin_top(20)
            content.set_margin_bottom(20)

            label = Gtk.Label(label="Configuration Name:")
            content.append(label)

            entry = Gtk.Entry()
            entry.set_placeholder_text("e.g., work, gaming, default")
            entry.set_margin_top(10)

            # Pre-fill with current config name if editing
            if self.current_config_name:
                entry.set_text(self.current_config_name)

            content.append(entry)

            def on_response(dlg, response):
                if response == Gtk.ResponseType.OK:
                    name = entry.get_text().strip()
                    if name:
                        dlg.close()
                        self.save_workspace_config_to_file(name, workspaces)
                    else:
                        dlg.close()
                elif response == Gtk.ResponseType.APPLY:
                    # Save as New - clear the entry to force new name
                    entry.set_text("")
                    entry.grab_focus()
                    return  # Don't close dialog
                else:
                    dlg.close()

            dialog.connect('response', on_response)
            dialog.present()

        except Exception as e:
            dialog = Gtk.MessageDialog(
                transient_for=self,
                modal=True,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text="Error Saving Config"
            )
            dialog.set_secondary_text(str(e))
            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

    def save_workspace_config_to_file(self, name, workspaces):
        """Save workspace configuration to a JSON file"""
        try:
            # Create saved configs directory
            saved_dir = Path.home() / '.config' / 'hypr' / 'layouts' / 'saved'
            saved_dir.mkdir(parents=True, exist_ok=True)

            # Create config data
            config = {
                'name': name,
                'workspaces': []
            }

            for ws in sorted(workspaces, key=lambda x: x.get('id', 0)):
                config['workspaces'].append({
                    'id': ws.get('id'),
                    'monitor': ws.get('monitor')
                })

            # Save to file
            config_file = saved_dir / f"{name}.json"
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)

            # Update current config tracking (for Live tab compatibility)
            if hasattr(self, 'current_config_name'):
                self.current_config_name = name
            if hasattr(self, 'save_btn'):
                self.save_btn.set_label(f"Save '{name}'")

        except Exception as e:
            dialog = Gtk.MessageDialog(
                transient_for=self,
                modal=True,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text="Error Saving Config"
            )
            dialog.set_secondary_text(str(e))
            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

    def on_load_workspace_config(self, widget):
        """Show list of saved configurations to load"""
        try:
            # Get list of saved configs
            saved_dir = Path.home() / '.config' / 'hypr' / 'layouts' / 'saved'

            if not saved_dir.exists():
                dialog = Gtk.MessageDialog(
                    transient_for=self,
                    modal=True,
                    message_type=Gtk.MessageType.WARNING,
                    buttons=Gtk.ButtonsType.OK,
                    text="No Saved Configurations"
                )
                dialog.set_secondary_text("No saved workspace configurations found. Save one first!")
                dialog.connect('response', lambda d, r: d.close())
                dialog.present()
                return

            # Get all .json files
            config_files = list(saved_dir.glob('*.json'))

            if not config_files:
                dialog = Gtk.MessageDialog(
                    transient_for=self,
                    modal=True,
                    message_type=Gtk.MessageType.WARNING,
                    buttons=Gtk.ButtonsType.OK,
                    text="No Saved Configurations"
                )
                dialog.set_secondary_text("No saved workspace configurations found. Save one first!")
                dialog.connect('response', lambda d, r: d.close())
                dialog.present()
                return

            # Create selection dialog
            dialog = Gtk.Dialog(
                title="Load Workspace Configuration",
                transient_for=self,
                modal=True
            )
            dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
            dialog.add_button("Load", Gtk.ResponseType.OK)
            dialog.set_default_size(400, 300)

            content = dialog.get_content_area()
            content.set_margin_start(20)
            content.set_margin_end(20)
            content.set_margin_top(20)
            content.set_margin_bottom(20)

            label = Gtk.Label(label="Select a configuration to load:")
            label.set_halign(Gtk.Align.START)
            content.append(label)

            # Create scrolled list
            scrolled = Gtk.ScrolledWindow()
            scrolled.set_vexpand(True)
            scrolled.set_margin_top(10)
            scrolled.set_margin_bottom(10)

            list_box = Gtk.ListBox()
            list_box.set_selection_mode(Gtk.SelectionMode.SINGLE)
            scrolled.set_child(list_box)

            # Add configs to list
            for config_file in sorted(config_files):
                row = Gtk.ListBoxRow()
                box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
                box.set_margin_start(10)
                box.set_margin_end(10)
                box.set_margin_top(10)
                box.set_margin_bottom(10)

                name_label = Gtk.Label(label=config_file.stem)
                name_label.set_halign(Gtk.Align.START)
                name_label.add_css_class('title-4')
                box.append(name_label)

                # Read config to show details
                try:
                    with open(config_file, 'r') as f:
                        config_data = json.load(f)
                    ws_count = len(config_data.get('workspaces', []))
                    info_label = Gtk.Label(label=f"{ws_count} workspaces")
                    info_label.set_halign(Gtk.Align.START)
                    info_label.add_css_class('dim-label')
                    box.append(info_label)
                except:
                    pass

                row.set_child(box)
                row.config_file = config_file  # Store reference
                list_box.append(row)

            content.append(scrolled)

            def on_response(dlg, response):
                if response == Gtk.ResponseType.OK:
                    selected_row = list_box.get_selected_row()
                    if selected_row:
                        self.load_workspace_config_from_file(selected_row.config_file)
                dlg.close()

            dialog.connect('response', on_response)
            dialog.present()

        except Exception as e:
            dialog = Gtk.MessageDialog(
                transient_for=self,
                modal=True,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text="Error Loading Config"
            )
            dialog.set_secondary_text(str(e))
            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

    def load_workspace_config_from_file(self, config_file):
        """Load and apply a workspace configuration from a file"""
        try:
            # Read config
            with open(config_file, 'r') as f:
                config = json.load(f)

            workspaces = config.get('workspaces', [])
            if not workspaces:
                return

            # Get current live workspaces
            live_workspaces = self.get_workspaces()
            live_ws_dict = {ws.get('id'): ws for ws in live_workspaces}

            # Apply saved assignments
            moved_count = 0
            for saved_ws in workspaces:
                ws_id = saved_ws.get('id')
                target_monitor = saved_ws.get('monitor')

                # Check if workspace exists and is on wrong monitor
                if ws_id in live_ws_dict:
                    current_monitor = live_ws_dict[ws_id].get('monitor')
                    if current_monitor != target_monitor:
                        # Move workspace to correct monitor
                        subprocess.run([
                            'hyprctl',
                            'dispatch',
                            'moveworkspacetomonitor',
                            str(ws_id),
                            target_monitor
                        ])
                        moved_count += 1
                        time.sleep(0.05)  # Small delay between moves

            # Show confirmation
            config_name = config.get('name', config_file.stem)
            dialog = Gtk.MessageDialog(
                transient_for=self,
                modal=True,
                message_type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="Configuration Loaded"
            )
            dialog.set_secondary_text(f"Loaded '{config_name}' ({moved_count} workspaces moved)")
            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

            # Refresh live view
            self.refresh_live_workspaces()

        except Exception as e:
            dialog = Gtk.MessageDialog(
                transient_for=self,
                modal=True,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text="Error Loading Config"
            )
            dialog.set_secondary_text(str(e))
            dialog.connect('response', lambda d, r: d.close())
            dialog.present()

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
        """Load saved layouts into list"""
        # Clear existing items
        child = self.layouts_list.get_first_child()
        while child:
            next_child = child.get_next_sibling()
            self.layouts_list.remove(child)
            child = next_child

        if not os.path.exists(self.layouts_dir):
            return

        # Load all layout files
        for root, dirs, files in os.walk(self.layouts_dir):
            for file in files:
                if file.endswith('.json'):
                    path = os.path.join(root, file)
                    name = os.path.splitext(file)[0].replace('_', ' ').title()

                    row = Gtk.ListBoxRow()
                    label = Gtk.Label(label=name)
                    label.set_halign(Gtk.Align.START)
                    label.set_margin_start(15)
                    label.set_margin_end(15)
                    label.set_margin_top(10)
                    label.set_margin_bottom(10)
                    row.set_child(label)
                    row.layout_path = path
                    row.layout_name = name
                    self.layouts_list.append(row)

    def on_layout_selected(self, list_box, row):
        """Handle layout selection - load into designer"""
        if not row:
            return

        self.current_selected_layout = row.layout_path
        layout_name = row.layout_name

        # Update title
        self.layout_preview_title.set_markup(f"<big><b>{layout_name}</b></big>")

        # Enable buttons
        self.layout_apply_btn.set_sensitive(True)
        self.layout_delete_btn.set_sensitive(True)

        # Load layout into embedded designer
        try:
            self.embedded_designer.load_layout_from_file(row.layout_path)
            self.embedded_designer.editing_path = row.layout_path
        except Exception as e:
            print(f"Error loading layout into designer: {e}")

    def on_new_layout(self, widget):
        """Create a new layout"""
        # Switch to Manage Layouts tab and create new layout
        self.notebook.set_current_page(1)  # Manage Layouts tab
        self.on_new_layout_embedded(None)

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

    def on_apply_layout(self, widget):
        """Apply the selected layout"""
        if not self.current_selected_layout:
            return

        apply_script = os.path.join(self.scripts_dir, 'apply_layout.py')
        subprocess.Popen([apply_script, self.current_selected_layout])
        print(f"[Layout Manager] Applying layout")

    def on_delete_layout(self, widget):
        """Delete the selected layout"""
        if not self.current_selected_layout:
            return

        dialog = Gtk.Dialog(
            title="Delete Layout?",
            transient_for=self,
            modal=True
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        dialog.add_button("Delete", Gtk.ResponseType.YES)

        content = dialog.get_content_area()
        content.set_margin_start(20)
        content.set_margin_end(20)
        content.set_margin_top(20)
        content.set_margin_bottom(20)

        label = Gtk.Label(label="Are you sure you want to delete this layout?")
        label.set_wrap(True)
        content.append(label)

        def on_response(dlg, response):
            if response == Gtk.ResponseType.YES:
                try:
                    if os.path.exists(self.current_selected_layout):
                        os.remove(self.current_selected_layout)
                        self.current_selected_layout = None

                        # Reset UI
                        self.layout_preview_title.set_markup("<big><b>Select a layout</b></big>")
                        self.layout_apply_btn.set_sensitive(False)
                        self.layout_delete_btn.set_sensitive(False)

                        # Clear embedded designer
                        self.embedded_designer.on_clear(None)

                        # Refresh list
                        self.load_saved_layouts()
                except Exception as e:
                    error_dialog = Gtk.Dialog(
                        title="Error",
                        transient_for=self,
                        modal=True
                    )
                    error_dialog.add_button("OK", Gtk.ResponseType.OK)
                    error_content = error_dialog.get_content_area()
                    error_content.set_margin_start(20)
                    error_content.set_margin_end(20)
                    error_content.set_margin_top(20)
                    error_content.set_margin_bottom(20)
                    error_label = Gtk.Label(label=f"Error deleting: {str(e)}")
                    error_content.append(error_label)
                    error_dialog.connect('response', lambda d, r: d.close())
                    error_dialog.present()
            dlg.close()

        dialog.connect('response', on_response)
        dialog.present()

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

    def on_new_layout_embedded(self, widget):
        """Create a new layout in embedded designer"""
        self.embedded_designer.on_clear(None)
        self.current_selected_layout = None
        self.embedded_designer.editing_path = None
        self.layout_preview_title.set_markup("<big><b>New Layout</b></big>")
        self.layout_apply_btn.set_sensitive(False)
        self.layout_delete_btn.set_sensitive(False)
        self.layouts_list.unselect_all()

    def on_save_designer_layout(self, root_node):
        """Save the layout from the embedded designer"""
        # If editing existing layout, save directly
        if self.embedded_designer.editing_path:
            try:
                layout_data = root_node.to_dict()
                with open(self.embedded_designer.editing_path, 'w') as f:
                    json.dump(layout_data, f, indent=2)

                self.load_saved_layouts()
                return
            except Exception as e:
                self.show_error_dialog("Save Failed", str(e))
                return

        # Otherwise, show save dialog for new layout
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
                    self.embedded_designer.editing_path = filepath
                    self.load_saved_layouts()

                    # Find and select the newly created layout
                    row = self.layouts_list.get_first_child()
                    while row:
                        if hasattr(row, 'layout_path') and row.layout_path == filepath:
                            self.layouts_list.select_row(row)
                            break
                        row = row.get_next_sibling()
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
