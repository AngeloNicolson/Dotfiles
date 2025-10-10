#!/usr/bin/env python3
"""
Visual Layout Designer for Hyprland
Creates and edits window layouts with a visual GTK interface
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
import json
import sys
import os
import subprocess
from pathlib import Path

class LayoutNode:
    """Represents a node in the layout tree (container or window)"""
    def __init__(self, split_type='horizontal', size_ratio=0.5, app=None):
        self.split_type = split_type  # 'horizontal', 'vertical', or 'window'
        self.size_ratio = size_ratio  # 0.0 to 1.0
        self.app = app  # Application command/name if this is a window
        self.children = []  # Child nodes if this is a container
        self.parent = None  # Parent node reference

    def is_window(self):
        return self.split_type == 'window'

    def to_dict(self):
        """Convert node to dictionary for JSON serialization"""
        if self.is_window():
            return {
                'type': 'window',
                'app': self.app
            }
        else:
            return {
                'type': 'container',
                'split': self.split_type,
                'ratio': self.size_ratio,
                'children': [child.to_dict() for child in self.children]
            }

    @staticmethod
    def from_dict(data, parent=None):
        """Create node from dictionary"""
        if data['type'] == 'window':
            node = LayoutNode(split_type='window', app=data.get('app'))
            node.parent = parent
            return node
        else:
            node = LayoutNode(
                split_type=data['split'],
                size_ratio=data.get('ratio', 0.5)
            )
            node.parent = parent
            node.children = [LayoutNode.from_dict(child, parent=node) for child in data.get('children', [])]
            return node

    def add_child(self, child):
        """Add a child node and set parent relationship"""
        child.parent = self
        self.children.append(child)

    def get_sibling(self):
        """Get the sibling node (if any)"""
        if not self.parent or len(self.parent.children) != 2:
            return None

        if self.parent.children[0] == self:
            return self.parent.children[1]
        else:
            return self.parent.children[0]

    def swap_with_sibling(self):
        """Swap this node with its sibling"""
        if not self.parent or len(self.parent.children) != 2:
            return False

        # Swap the children
        self.parent.children[0], self.parent.children[1] = \
            self.parent.children[1], self.parent.children[0]
        return True


class LayoutDesigner(Gtk.Window):
    """Main application window for the layout designer"""

    def __init__(self, layout_file=None, apps_conf=None):
        super().__init__(title="Hyprland Layout Designer")
        self.set_default_size(1200, 800)
        self.set_border_width(10)

        # Store apps.conf path
        self.apps_conf = apps_conf or os.path.expanduser("~/.config/hypr/apps.conf")

        # Initialize layout
        self.current_file = layout_file
        if layout_file and os.path.exists(layout_file):
            self.root_node = self.load_layout(layout_file)
        else:
            self.root_node = LayoutNode(split_type='horizontal')
            child1 = LayoutNode(split_type='window', app='firefox')
            child2 = LayoutNode(split_type='window', app='kitty')
            child1.parent = self.root_node
            child2.parent = self.root_node
            self.root_node.children = [child1, child2]

        self.selected_node = None
        self.setup_ui()

    def setup_ui(self):
        """Set up the main UI"""
        # Main container
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(main_box)

        # Toolbar
        toolbar = self.create_toolbar()
        main_box.pack_start(toolbar, False, False, 0)

        # Main content area with sidebar and canvas
        content_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        main_box.pack_start(content_box, True, True, 0)

        # Sidebar
        sidebar = self.create_sidebar()
        content_box.pack_start(sidebar, False, False, 0)

        # Canvas area
        self.canvas = Gtk.DrawingArea()
        self.canvas.set_size_request(800, 600)
        self.canvas.connect('draw', self.on_draw)
        self.canvas.connect('button-press-event', self.on_canvas_click)
        self.canvas.connect('button-release-event', self.on_canvas_release)
        self.canvas.connect('motion-notify-event', self.on_canvas_motion)
        self.canvas.set_events(
            Gdk.EventMask.BUTTON_PRESS_MASK |
            Gdk.EventMask.BUTTON_RELEASE_MASK |
            Gdk.EventMask.POINTER_MOTION_MASK
        )

        # Drag state
        self.drag_node = None
        self.drag_start_x = 0
        self.drag_start_y = 0
        self.node_rects = {}  # Store node rectangles for hit testing

        canvas_frame = Gtk.Frame()
        canvas_frame.add(self.canvas)
        content_box.pack_start(canvas_frame, True, True, 0)

    def create_toolbar(self):
        """Create the toolbar"""
        toolbar = Gtk.Toolbar()
        toolbar.set_style(Gtk.ToolbarStyle.BOTH)

        # New button
        new_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_NEW)
        new_btn.connect('clicked', self.on_new)
        toolbar.insert(new_btn, -1)

        # Open button
        open_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_OPEN)
        open_btn.connect('clicked', self.on_open)
        toolbar.insert(open_btn, -1)

        # Save button
        save_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_SAVE)
        save_btn.connect('clicked', self.on_save)
        toolbar.insert(save_btn, -1)

        # Save As button
        save_as_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_SAVE_AS)
        save_as_btn.connect('clicked', self.on_save_as)
        toolbar.insert(save_as_btn, -1)

        toolbar.insert(Gtk.SeparatorToolItem(), -1)

        # Apply button
        apply_btn = Gtk.ToolButton(stock_id=Gtk.STOCK_APPLY)
        apply_btn.set_label("Apply Layout")
        apply_btn.connect('clicked', self.on_apply)
        toolbar.insert(apply_btn, -1)

        return toolbar

    def create_sidebar(self):
        """Create the sidebar with controls"""
        sidebar = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        sidebar.set_size_request(250, -1)

        # Properties frame
        props_frame = Gtk.Frame(label="Properties")
        props_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        props_box.set_border_width(10)
        props_frame.add(props_box)

        # Split type
        props_box.pack_start(Gtk.Label(label="Split Type:", xalign=0), False, False, 0)
        self.split_combo = Gtk.ComboBoxText()
        self.split_combo.append_text("Horizontal")
        self.split_combo.append_text("Vertical")
        self.split_combo.set_active(0)
        self.split_combo.connect('changed', self.on_split_changed)
        props_box.pack_start(self.split_combo, False, False, 0)

        # Size ratio
        props_box.pack_start(Gtk.Label(label="Size Ratio:", xalign=0), False, False, 0)
        self.ratio_scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0.1, 0.9, 0.05)
        self.ratio_scale.set_value(0.5)
        self.ratio_scale.connect('value-changed', self.on_ratio_changed)
        props_box.pack_start(self.ratio_scale, False, False, 0)

        sidebar.pack_start(props_frame, False, False, 0)

        # Actions frame
        actions_frame = Gtk.Frame(label="Actions")
        actions_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        actions_box.set_border_width(10)
        actions_frame.add(actions_box)

        # Split horizontal button
        split_h_btn = Gtk.Button(label="Split Horizontal")
        split_h_btn.connect('clicked', lambda w: self.split_node('horizontal'))
        actions_box.pack_start(split_h_btn, False, False, 0)

        # Split vertical button
        split_v_btn = Gtk.Button(label="Split Vertical")
        split_v_btn.connect('clicked', lambda w: self.split_node('vertical'))
        actions_box.pack_start(split_v_btn, False, False, 0)

        # Assign app button
        assign_btn = Gtk.Button(label="Assign Application")
        assign_btn.connect('clicked', self.on_assign_app)
        actions_box.pack_start(assign_btn, False, False, 0)

        # Delete node button
        delete_btn = Gtk.Button(label="Delete Node")
        delete_btn.connect('clicked', self.on_delete_node)
        actions_box.pack_start(delete_btn, False, False, 0)

        # Separator
        actions_box.pack_start(Gtk.Separator(), False, False, 0)

        # Move node buttons
        move_label = Gtk.Label(label="Move Node:")
        move_label.set_markup("<b>Move Node:</b>")
        actions_box.pack_start(move_label, False, False, 0)

        swap_btn = Gtk.Button(label="Swap with Sibling")
        swap_btn.connect('clicked', self.on_swap_with_sibling)
        actions_box.pack_start(swap_btn, False, False, 0)

        sidebar.pack_start(actions_frame, False, False, 0)

        return sidebar

    def on_draw(self, widget, cr):
        """Draw the layout on the canvas"""
        allocation = widget.get_allocation()
        width = allocation.width
        height = allocation.height

        # Clear background
        cr.set_source_rgb(0.95, 0.95, 0.95)
        cr.rectangle(0, 0, width, height)
        cr.fill()

        # Clear node rectangles and rebuild
        self.node_rects = {}

        # Draw layout
        self.draw_node(cr, self.root_node, 0, 0, width, height)

        return False

    def draw_node(self, cr, node, x, y, width, height):
        """Recursively draw a layout node"""
        # Store node rectangle for hit testing
        self.node_rects[id(node)] = (x, y, width, height)

        # Draw border
        if node == self.drag_node:
            # Being dragged - green highlight
            cr.set_source_rgb(0.2, 0.8, 0.2)
            cr.set_line_width(4)
        elif node == self.selected_node:
            # Selected - blue highlight
            cr.set_source_rgb(0.2, 0.4, 0.8)
            cr.set_line_width(3)
        else:
            # Normal - gray
            cr.set_source_rgb(0.3, 0.3, 0.3)
            cr.set_line_width(1)

        cr.rectangle(x, y, width, height)
        cr.stroke()

        if node.is_window():
            # Draw window background
            if node == self.drag_node:
                cr.set_source_rgb(0.8, 1.0, 0.8)  # Light green when dragging
            else:
                cr.set_source_rgb(0.9, 0.9, 1.0)  # Light blue normally
            cr.rectangle(x + 2, y + 2, width - 4, height - 4)
            cr.fill()

            # Draw app name
            cr.set_source_rgb(0, 0, 0)
            cr.select_font_face("Sans", 0, 0)
            cr.set_font_size(14)
            app_text = node.app or "No app"
            x_bearing, y_bearing, text_width, text_height, x_advance, y_advance = cr.text_extents(app_text)
            cr.move_to(x + width/2 - text_width/2, y + height/2 + text_height/2)
            cr.show_text(app_text)
        else:
            # Draw container with children
            if len(node.children) >= 2:
                if node.split_type == 'horizontal':
                    split_x = x + width * node.size_ratio
                    self.draw_node(cr, node.children[0], x, y, width * node.size_ratio, height)
                    self.draw_node(cr, node.children[1], split_x, y, width * (1 - node.size_ratio), height)
                else:  # vertical
                    split_y = y + height * node.size_ratio
                    self.draw_node(cr, node.children[0], x, y, width, height * node.size_ratio)
                    self.draw_node(cr, node.children[1], x, split_y, width, height * (1 - node.size_ratio))

    def on_canvas_click(self, widget, event):
        """Handle clicks on the canvas"""
        allocation = widget.get_allocation()
        node = self.find_node_at_position(
            self.root_node,
            event.x, event.y,
            0, 0,
            allocation.width, allocation.height
        )

        if not node:
            return True

        # Right-click: show context menu
        if event.button == 3:
            self.show_context_menu(node, event)
            return True

        # Shift+click: split on longest side
        if event.button == 1 and event.state & Gdk.ModifierType.SHIFT_MASK:
            self.split_on_longest_side(node)
            return True

        # Normal left click: select node and prepare for drag
        if event.button == 1:
            self.selected_node = node
            self.drag_node = node if node.is_window() else None  # Only drag window nodes
            self.drag_start_x = event.x
            self.drag_start_y = event.y
            self.update_properties_panel()
            widget.queue_draw()

        return True

    def find_node_at_position(self, node, click_x, click_y, x, y, width, height):
        """Find which node was clicked"""
        if not (x <= click_x <= x + width and y <= click_y <= y + height):
            return None

        if node.is_window() or len(node.children) < 2:
            return node

        if node.split_type == 'horizontal':
            split_x = x + width * node.size_ratio
            if click_x < split_x:
                return self.find_node_at_position(
                    node.children[0], click_x, click_y,
                    x, y, width * node.size_ratio, height
                )
            else:
                return self.find_node_at_position(
                    node.children[1], click_x, click_y,
                    split_x, y, width * (1 - node.size_ratio), height
                )
        else:  # vertical
            split_y = y + height * node.size_ratio
            if click_y < split_y:
                return self.find_node_at_position(
                    node.children[0], click_x, click_y,
                    x, y, width, height * node.size_ratio
                )
            else:
                return self.find_node_at_position(
                    node.children[1], click_x, click_y,
                    x, split_y, width, height * (1 - node.size_ratio)
                )

    def update_properties_panel(self):
        """Update the properties panel based on selected node"""
        if not self.selected_node:
            return

        if not self.selected_node.is_window():
            if self.selected_node.split_type == 'horizontal':
                self.split_combo.set_active(0)
            else:
                self.split_combo.set_active(1)
            self.ratio_scale.set_value(self.selected_node.size_ratio)

    def split_on_longest_side(self, node):
        """Split a node based on its longest dimension"""
        if not node.is_window():
            return  # Already a container

        # Get node dimensions
        node_id = id(node)
        if node_id not in self.node_rects:
            return

        x, y, width, height = self.node_rects[node_id]

        # Determine split type based on longest side
        if width > height:
            # Wider than tall: split vertically (creates left/right)
            split_type = 'vertical'
        else:
            # Taller than wide: split horizontally (creates top/bottom)
            split_type = 'horizontal'

        # Perform the split
        old_app = node.app
        node.split_type = split_type
        node.app = None
        child1 = LayoutNode(split_type='window', app=old_app)
        child2 = LayoutNode(split_type='window', app=None)
        child1.parent = node
        child2.parent = node
        node.children = [child1, child2]

        self.selected_node = child2  # Select the new empty node
        self.canvas.queue_draw()

    def show_context_menu(self, node, event):
        """Show context menu for a node"""
        menu = Gtk.Menu()

        if node.is_window():
            # Assign application item
            assign_item = Gtk.MenuItem(label="Assign Application...")
            assign_item.connect('activate', lambda w: self.assign_app_to_node(node))
            menu.append(assign_item)

            # Clear application
            if node.app:
                clear_item = Gtk.MenuItem(label="Clear Application")
                clear_item.connect('activate', lambda w: self.clear_app_from_node(node))
                menu.append(clear_item)

            menu.append(Gtk.SeparatorMenuItem())

            # Split horizontal
            split_h_item = Gtk.MenuItem(label="Split Horizontal")
            split_h_item.connect('activate', lambda w: self.split_node_from_menu(node, 'horizontal'))
            menu.append(split_h_item)

            # Split vertical
            split_v_item = Gtk.MenuItem(label="Split Vertical")
            split_v_item.connect('activate', lambda w: self.split_node_from_menu(node, 'vertical'))
            menu.append(split_v_item)
        else:
            # Container node
            change_item = Gtk.MenuItem(label="Change Split Direction")
            change_item.connect('activate', lambda w: self.toggle_split_direction(node))
            menu.append(change_item)

        menu.show_all()
        menu.popup(None, None, None, None, event.button, event.time)

    def clear_app_from_node(self, node):
        """Clear the app assignment from a node"""
        node.app = None
        self.canvas.queue_draw()

    def split_node_from_menu(self, node, split_type):
        """Split a node from the context menu"""
        self.selected_node = node
        self.split_node(split_type)

    def toggle_split_direction(self, node):
        """Toggle container split direction"""
        if node.is_window():
            return
        if node.split_type == 'horizontal':
            node.split_type = 'vertical'
        else:
            node.split_type = 'horizontal'
        self.canvas.queue_draw()

    def assign_app_to_node(self, node):
        """Assign an application to a specific node"""
        app_command = self.show_app_assignment_dialog(node)
        if app_command:
            node.app = app_command
            self.canvas.queue_draw()

    def on_canvas_release(self, widget, event):
        """Handle mouse button release"""
        if event.button == 1 and self.drag_node:
            # Check if we actually dragged (moved more than a threshold)
            drag_distance = ((event.x - self.drag_start_x) ** 2 +
                           (event.y - self.drag_start_y) ** 2) ** 0.5

            if drag_distance > 10:  # Minimum drag threshold
                # Find target node at drop position
                allocation = widget.get_allocation()
                target_node = self.find_node_at_position(
                    self.root_node,
                    event.x, event.y,
                    0, 0,
                    allocation.width, allocation.height
                )

                # Swap nodes if valid target
                if (target_node and
                    target_node != self.drag_node and
                    target_node.is_window()):
                    self.swap_nodes(self.drag_node, target_node)

            # End drag operation
            self.drag_node = None
            widget.queue_draw()
        return True

    def on_canvas_motion(self, widget, event):
        """Handle mouse motion"""
        if self.drag_node:
            # Could add visual feedback here (e.g., draw a highlight)
            widget.queue_draw()
        return True

    def swap_nodes(self, node1, node2):
        """Swap two window nodes in the tree"""
        if not node1.is_window() or not node2.is_window():
            return

        # Swap their app assignments
        node1.app, node2.app = node2.app, node1.app
        self.canvas.queue_draw()

    def load_apps(self):
        """Load applications from apps.conf file"""
        apps = []
        try:
            import os
            # Try to find apps.conf in the same directory as this script
            if os.path.exists(self.apps_conf):
                apps_path = self.apps_conf
            else:
                # Try default location
                script_dir = os.path.dirname(os.path.abspath(__file__))
                apps_path = os.path.join(script_dir, '..', 'apps.conf')

            if os.path.exists(apps_path):
                with open(apps_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        # Skip comments and empty lines
                        if not line or line.startswith('#'):
                            continue
                        # Parse format: category|app_name|command|icon
                        parts = line.split('|')
                        if len(parts) >= 3:
                            category = parts[0]
                            app_name = parts[1]
                            command = parts[2]
                            apps.append({
                                'category': category,
                                'name': app_name,
                                'command': command
                            })
        except Exception as e:
            print(f"Warning: Could not load apps.conf: {e}", file=sys.stderr)

        return apps

    def show_app_assignment_dialog(self, node):
        """Show dialog to assign an app to a window"""
        dialog = Gtk.Dialog(
            title="Assign Application",
            parent=self,
            flags=0
        )
        dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OK, Gtk.ResponseType.OK
        )

        box = dialog.get_content_area()
        box.set_spacing(10)
        box.set_margin_top(10)
        box.set_margin_bottom(10)
        box.set_margin_start(10)
        box.set_margin_end(10)

        label = Gtk.Label(label="Select an application:")
        box.pack_start(label, False, False, 0)

        # Load apps
        apps = self.load_apps()

        # Create list store and tree view
        store = Gtk.ListStore(str, str)
        for app in apps:
            store.append([app['name'], app['command']])

        tree_view = Gtk.TreeView(model=store)
        renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Application", renderer, text=0)
        tree_view.append_column(column)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_size_request(400, 300)
        scrolled.add(tree_view)
        box.pack_start(scrolled, True, True, 0)

        dialog.show_all()
        response = dialog.run()

        app_command = None
        if response == Gtk.ResponseType.OK:
            selection = tree_view.get_selection()
            model, tree_iter = selection.get_selected()
            if tree_iter:
                app_command = model[tree_iter][1]

        dialog.destroy()
        return app_command

    def split_node(self, split_type):
        """Split the selected node"""
        if not self.selected_node:
            return

        if not self.selected_node.is_window():
            # Already a container, just change split type
            self.selected_node.split_type = split_type
        else:
            # Convert window to container
            old_app = self.selected_node.app
            self.selected_node.split_type = split_type
            self.selected_node.app = None
            child1 = LayoutNode(split_type='window', app=old_app)
            child2 = LayoutNode(split_type='window', app=None)
            child1.parent = self.selected_node
            child2.parent = self.selected_node
            self.selected_node.children = [child1, child2]

        self.canvas.queue_draw()

    def on_assign_app(self, widget):
        """Assign an application to the selected window"""
        if not self.selected_node or not self.selected_node.is_window():
            return

        app_command = self.show_app_assignment_dialog(self.selected_node)
        if app_command:
            self.selected_node.app = app_command
            self.canvas.queue_draw()

    def on_delete_node(self, widget):
        """Delete the selected node"""
        if not self.selected_node or self.selected_node == self.root_node:
            return

        # Find parent and remove node
        # This is simplified - would need proper parent tracking
        self.canvas.queue_draw()

    def on_swap_with_sibling(self, widget):
        """Swap the selected node with its sibling"""
        if not self.selected_node:
            dialog = Gtk.MessageDialog(
                parent=self,
                flags=0,
                type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="No node selected"
            )
            dialog.format_secondary_text("Please select a node first.")
            dialog.run()
            dialog.destroy()
            return

        if self.selected_node == self.root_node:
            dialog = Gtk.MessageDialog(
                parent=self,
                flags=0,
                type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="Cannot swap root node"
            )
            dialog.format_secondary_text("The root node has no sibling.")
            dialog.run()
            dialog.destroy()
            return

        if self.selected_node.swap_with_sibling():
            self.canvas.queue_draw()
        else:
            dialog = Gtk.MessageDialog(
                parent=self,
                flags=0,
                type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="Cannot swap"
            )
            dialog.format_secondary_text("This node has no sibling to swap with.")
            dialog.run()
            dialog.destroy()

    def on_split_changed(self, combo):
        """Handle split type change"""
        if not self.selected_node or self.selected_node.is_window():
            return

        if combo.get_active() == 0:
            self.selected_node.split_type = 'horizontal'
        else:
            self.selected_node.split_type = 'vertical'

        self.canvas.queue_draw()

    def on_ratio_changed(self, scale):
        """Handle ratio change"""
        if not self.selected_node or self.selected_node.is_window():
            return

        self.selected_node.size_ratio = scale.get_value()
        self.canvas.queue_draw()

    def on_new(self, widget):
        """Create a new layout"""
        self.root_node = LayoutNode(split_type='horizontal')
        child1 = LayoutNode(split_type='window', app=None)
        child2 = LayoutNode(split_type='window', app=None)
        child1.parent = self.root_node
        child2.parent = self.root_node
        self.root_node.children = [child1, child2]
        self.selected_node = None
        self.current_file = None
        self.canvas.queue_draw()

    def on_open(self, widget):
        """Open a layout file"""
        dialog = Gtk.FileChooserDialog(
            title="Open Layout",
            parent=self,
            action=Gtk.FileChooserAction.OPEN
        )
        dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN, Gtk.ResponseType.OK
        )

        filter_json = Gtk.FileFilter()
        filter_json.set_name("JSON files")
        filter_json.add_pattern("*.json")
        dialog.add_filter(filter_json)

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.root_node = self.load_layout(filename)
            self.current_file = filename
            self.selected_node = None
            self.canvas.queue_draw()

        dialog.destroy()

    def on_save(self, widget):
        """Save the current layout"""
        if self.current_file:
            self.save_layout(self.current_file)
        else:
            self.on_save_as(widget)

    def on_save_as(self, widget):
        """Save the current layout with a new name"""
        dialog = Gtk.FileChooserDialog(
            title="Save Layout As",
            parent=self,
            action=Gtk.FileChooserAction.SAVE
        )
        dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_SAVE, Gtk.ResponseType.OK
        )
        dialog.set_do_overwrite_confirmation(True)

        filter_json = Gtk.FileFilter()
        filter_json.set_name("JSON files")
        filter_json.add_pattern("*.json")
        dialog.add_filter(filter_json)

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            if not filename.endswith('.json'):
                filename += '.json'
            self.save_layout(filename)
            self.current_file = filename

        dialog.destroy()

    def on_apply(self, widget):
        """Apply the current layout"""
        if not self.current_file:
            # Save first
            self.on_save(widget)

        if self.current_file:
            script_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'apply_layout.py'
            )
            subprocess.Popen([script_path, self.current_file])

    def load_layout(self, filename):
        """Load a layout from file"""
        try:
            with open(filename, 'r') as f:
                data = json.load(f)
            return LayoutNode.from_dict(data)
        except Exception as e:
            print(f"Error loading layout: {e}", file=sys.stderr)
            return LayoutNode(split_type='horizontal')

    def save_layout(self, filename):
        """Save the current layout to file"""
        try:
            data = self.root_node.to_dict()
            with open(filename, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"Layout saved to {filename}")
        except Exception as e:
            print(f"Error saving layout: {e}", file=sys.stderr)


def main():
    import sys

    layout_file = None
    apps_conf = None

    if len(sys.argv) > 1:
        layout_file = sys.argv[1]
    if len(sys.argv) > 2:
        apps_conf = sys.argv[2]

    win = LayoutDesigner(layout_file, apps_conf)
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()


if __name__ == '__main__':
    main()
