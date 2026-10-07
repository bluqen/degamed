# Animation in Degamed

Degamed's animation tools follow Godot's ideas, so they'll feel familiar if you've used it.

| Godot | Degamed |
|---|---|
| SpriteFrames resource | `*.frames.json` file |
| AnimatedSprite2D | `AnimatedSprite` component |
| AnimationTree (simple state machine) | `"auto": true` on the AnimatedSprite |
| Tween | `kit.tween()` |
| AnimationPlayer (keyframes) | Coming next: the timeline editor |

## 1. A frames file
A sprite sheet is cut into equal frames, numbered left to right and top to bottom from 0. Animations list frame numbers:
```json
{
  "sheet": "assets/sprites/knight-sheet.png",
  "frameWidth": 16,
  "frameHeight": 16,
  "animations": {
    "idle": { "frames": [0, 1], "fps": 3, "loop": true },
    "run":  { "frames": [2, 3, 4, 3], "fps": 10, "loop": true },
    "jump": { "frames": [5], "fps": 1, "loop": true },
    "fall": { "frames": [6], "fps": 1, "loop": true }
  }
}
```
To edit it visually, go to **Editor → Pro → click the `.frames.json` file**. Click frames to add them, then set the FPS and looping. Each animation shows a live preview.

## 2. Put it on an entity
```json
"AnimatedSprite": { "frames": "assets/anims/knight.frames.json", "auto": true }
```
- `animation`: which animation to start with (defaults to the first one).
- `auto`: picks **idle / run / jump / fall** each frame from the physics body. Missing names fall back sensibly, so `walk` is used if there's no `run`.

## 3. Control it from scripts
```js
import { Behaviour, Input, kit } from 'degamed';

export default class Player extends Behaviour {
  onUpdate() {
    if (Input.pressed('action')) this.playOnce('attack'); // plays over auto mode, then auto resumes
  }
  onAnimationEnd(name) {
    if (name === 'attack') kit.shake(0.005, 80);
  }
}
```
- `this.play('run')` switches animations. It doesn't restart one that's already playing; pass `{ restart: true }` to restart.
- `this.entity.animation` is the name of the current animation.
- `this.entity.autoAnimate = false` takes full manual control.
- `kit.tween(this.entity, { alpha: 0, y: 40 }, { duration: 400, ease: 'Sine.InOut', yoyo: true, repeat: -1 })` animates any value over time.

## Camera zoom and UI
`"Camera": { "follow": "player", "zoom": 2.5 }` zooms the world. Entities tagged `ui` stay unzoomed on their own layer, like Godot's CanvasLayer.
