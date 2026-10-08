# The Degamed editor

Degamed has two modes, switched in the top-right corner:

- **Simple**: the running game, an AI Copilot and a few sliders. Phones always use this mode.
- **Pro**: a full engine layout, described below.

## Layout (Pro)

| Area | What it's for |
|---|---|
| **Menu bar** (Game, Edit, Scene, View, Run, Help) | Every command, with its shortcut |
| **Workspaces** (top centre) | **Scene** builds levels, **Game** runs them, **Code** edits scripts, **Art** manages images and sounds |
| **Run controls** (top right) | Run the game (F5), run the open scene (F6), pause (F7), stop (F8) |
| **Hierarchy** (top left) | The entities in the open scene, as a tree. Drag to reorder or put one inside another. Filter by name or tag. Eye icon switches an entity off. |
| **Files** (bottom left) | Everything in the project. Drag a picture onto the scene to place it, a script onto an entity to attach it. Drop files from your computer to import them. |
| **Properties** (right) | Edit the selected entities. Several selected → edit what they share. Nothing selected → the scene's own settings and background layers. The ↺ arrow resets a value. |
| **History** (right, second tab) | Every change; click one to go back to it |
| **Console / Problems / Animation** (bottom) | Logs and errors from the running game; broken references found without running; the frame-animation editor |

Panels can be resized by dragging their edges. **View → Reset Panel Layout** puts them back. **Focus Mode** (Ctrl+Shift+F) hides all panels.

## Scene view

| Tool | Key | |
|---|---|---|
| Select | Q | Click to select, drag to move, drag on empty space to box-select |
| Move | W | Arrows: drag red for x only, green for y only, yellow for both |
| Rotate | E | Drag around the entity. Snaps to 15° (hold Alt for free rotation) |
| Scale | S | Drag the square handles |
| Pan | H | Or hold Space, or drag with the middle mouse button |
| Measure | R | Drag to measure distance and angle |

- **Snap** (Shift+G) snaps positions to the grid; the arrow next to it sets the step.
- **Zoom**: mouse wheel or pinch; the % button resets to 100%.
- **Arrow keys** nudge by 1 px (Shift: one grid step).
- **Alt+click** picks the entity underneath.
- **F** frames the selection; **Shift+F** shows the whole level.
- **Right-click** an entity for its menu, or empty space for *Add Entity Here*.

The purple rectangle is the game screen when the scene starts; the dashed cyan one is the edge of the world.

## Shortcuts

| | |
|---|---|
| Ctrl+A | Add entity |
| Ctrl+D | Duplicate |
| Ctrl+C / X / V | Copy / cut / paste |
| Del | Delete |
| F2 | Rename |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Ctrl+1…4 | Scene / Game / Code / Art |
| Ctrl+, | Game settings |
| Ctrl+J | Show or hide the bottom panel |
| Ctrl+Shift+P or Ctrl+K | Command palette |
| Ctrl+/ | All shortcuts |

On a Mac, Ctrl is ⌘.

## Saving

Every change saves to this device automatically. Cloud saving arrives with project storage.
