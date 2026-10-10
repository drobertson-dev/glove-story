# Glove Story

A little 3D glove-and-ball platformer that runs in a web browser (phones included), made as a homage to *Glover* (1998).

**Play it:** https://glove-story-ochre.vercel.app

**The goal:** pick up your ball and carry it to the portal at the end of the level.

You play a magic glove guiding a crystal ball through the floating islands of **Sunny Isles**. Along the way you:

- dribble, throw and slap the ball
- ride on top of it
- change it into rubber or bowling ball form with potions
- pick up 35 garibs (the gold collectibles)

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

This repo is connected to Vercel, so every push to `main` redeploys https://glove-story-ochre.vercel.app automatically.

To host it somewhere else:

```bash
npm run build
```

This creates a `dist/` folder of plain static files, which you can host anywhere:

- **Netlify Drop (easiest):** go to https://app.netlify.com/drop and drag the `dist` folder onto the page. You get a link you can text to anyone.
- **GitHub Pages, Vercel or Cloudflare Pages:** these work too. The build uses relative paths, so it works from any sub-folder.

On a phone, use **Share → Add to Home Screen**. The game then launches full-screen like an app.

## Where things live

- `src/level1.js`: the whole level as data (islands, garibs, enemies, signs). Easy to edit.
- `src/game.js`: glove movement, ball physics and all the interactions
- `src/physics.js`: a tiny sphere-vs-box/cylinder collision engine
- `src/glover.js`: the glove's model and animation (built from simple shapes)
- `src/ball.js`: the three ball forms and their tuning (bounce, weight, breaking speed)
- `src/audio.js`: all sound effects and music, synthesised live (no audio files)
- `src/input.js`: touch joystick and buttons, keyboard and gamepad

Open `?debug` (for example `http://localhost:5173/?debug`) to load a test harness in the console. `T.autoplay()` plays through the whole level by itself.

All art, sound and music are original, made from code. Nothing is taken from the original game.
