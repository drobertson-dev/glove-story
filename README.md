# Glove Story

A little 3D glove-and-ball platformer that runs in a web browser (phones included), made as a homage to *Glover* (1998).

**Play it:** https://glovestory.app

**The goal:** pick up your ball and carry it to the portal at the end of the level.

You play a magic glove guiding a ball through four worlds. Along the way you:

- dribble, throw and slap the ball
- ride on top of it
- change it into rubber or bowling ball form with potions
- pick up the garibs (the gold collectibles)

| World | What's new |
|---|---|
| 1. Sunny Isles | the basics: carrying, throwing, bounce pads, riding the ball, crates |
| 2. Splash Lagoon | swimming, a rubber ball that floats (paddle it across the sea), ball switches that raise bridges, crabs |
| 3. Carnival Chaos | conveyor belts, pinball bumpers, a ferris wheel, a strongman bell only a bowling ball can ring, crumbling platforms |
| 4. Spooky Spires | ghosts that chase you, a lift, pop-up spike traps, crumbling floors, a portcullis |

Each world unlocks the next, and progress is saved on the device. Falling off or losing the ball costs a heart, not a life.

## Controls

| | Phone | Keyboard | Controller |
|---|---|---|---|
| Move | left thumb (anywhere on the left side) | WASD / arrows | left stick |
| Camera | drag on the right side | Q / E or drag the mouse | right stick |
| Jump (tap twice to double jump) | JUMP | Space | A |
| Grab / put down / throw | GRAB | Z or J | X |
| Slap (in the air: slam) | SLAP | X or K | B |
| Pause | ❚❚ | Esc | Start |

What GRAB does while you're holding the ball:

- **Standing still:** puts the ball down.
- **Moving, in the air, or at a ledge:** throws it.

On touch, the button label switches between DROP and THROW to show which one you'll get.

## Running it

```bash
npm install
npm run dev
```

The dev server also shows a **Network** address, such as `http://192.168.x.x:5173`. Open that address on a phone on the same Wi-Fi to play it right away.

## Sharing it

This repo is connected to Vercel, so every push to `main` redeploys https://glovestory.app automatically.

To host it somewhere else:

```bash
npm run build
```

This creates a `dist/` folder of plain static files, which you can host anywhere:

- **Netlify Drop (easiest):** go to https://app.netlify.com/drop and drag the `dist` folder onto the page. You get a link you can text to anyone.
- **GitHub Pages, Vercel or Cloudflare Pages:** these work too. The build uses relative paths, so it works from any sub-folder.

On a phone, use **Share → Add to Home Screen**. The game then launches full-screen like an app.

## Where things live

- `src/levels/`: each world as plain data (islands, garibs, enemies, signs, switches...). Easy to edit.
- `src/themes.js`: each world's sky, colours, scenery style and music
- `src/world.js`: turns level data into meshes and colliders, and moves the moving parts
- `src/game.js`: glove movement, ball physics and all the interactions
- `src/physics.js`: a tiny sphere-vs-box/cylinder collision engine
- `src/glover.js`: the glove's model and animation (built from simple shapes)
- `src/ball.js`: the three ball forms and their tuning (bounce, weight, breaking speed)
- `src/audio.js`: all sound effects and music, synthesised live (no audio files)
- `src/input.js`: touch joystick and buttons, keyboard and gamepad

Open `?debug` (for example `http://localhost:5173/?debug&unlock`) to load a test harness in the console. `T.level(n)` loads a world (0-3), and `T.autoplay()` plays through the current world by itself. `&unlock` unlocks every world on the map.

All art, sound and music are original, made from code. Nothing is taken from the original game.
