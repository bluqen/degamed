/**
 * Behaviour scripts shipped inside kit-built projects. They're plain JavaScript (people can open
 * and edit them in the Advanced editor), so they're written to be readable.
 */

export const PLAYER_JS = `import { Behaviour, Input, Game, kit } from 'degamed';

// A platformer hero with game feel built in: acceleration, coyote time, jump buffering,
// variable jump height, squash and stretch, landing dust, hit-stop, checkpoints and a proper
// death, respawn and level-complete moment. Change the numbers in "props" to tune it.
export default class Player extends Behaviour {
  static props = {
    speed: 150, jump: 330, gravity: 900, accel: 1500, airAccel: 1100,
    coyote: 0.1, buffer: 0.12, lives: 3, health: 1, doubleJump: false, attack: false, climb: false,
    killY: 400, dust: '#C8C0B0', accent: '#FFE38A', goalText: 'LEVEL CLEAR!',
  };

  onStart() {
    this.spawn = { x: this.entity.x, y: this.entity.y };
    this.left = this.lives;
    this.hp = this.health;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.wasOnFloor = false;
    this.airJumps = 0;
    this.dead = false;
    this.won = false;
    this.invuln = 0;
    this.attackT = 0;
    this.ladderT = -1;
    this.climbing = false;
    this.facing = 1;
    this.fall = 0;
    this.dustT = 0;
    this.startTime = Game.time;
    this.totalCoins = Game.findAll('coin').length;
    this.coins = 0;
    this.publish();
  }

  publish() {
    Game.state.lives = this.left;
    Game.state.hp = this.hp;
    Game.state.maxHp = this.health;
    Game.state.coins = this.coins;
    Game.state.totalCoins = this.totalCoins;
  }

  feet() {
    const b = this.entity.body;
    return b ? b.bottom : this.entity.y + 8;
  }

  onUpdate(dt) {
    if (this.dead || this.won) {
      if (this.waiting && (Input.pressed('jump') || Input.pressed('action'))) this.again();
      return;
    }
    const v = this.velocity;
    const onFloor = this.onFloor;
    if (onFloor && !this.wasOnFloor) this.land();
    if (!onFloor) this.fall = Math.max(this.fall, v.y);
    this.wasOnFloor = onFloor;
    this.invuln = Math.max(0, this.invuln - dt);
    this.entity.alpha = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0 ? 0.35 : 1;

    if (this.climb && this.updateClimb(dt)) return;

    // Run: accelerate towards the target speed (snappier on the ground than in the air).
    const dir = Input.axis('horizontal');
    const target = dir * this.speed;
    const step = (onFloor ? this.accel : this.airAccel) * dt;
    if (onFloor && dir !== 0 && Math.sign(v.x) === -dir && Math.abs(v.x) > this.speed * 0.6) {
      kit.dust(this.entity.x, this.feet(), { count: 3, dir: -dir, color: this.dust });
    }
    v.x = Math.abs(target - v.x) <= step ? target : v.x + Math.sign(target - v.x) * step;
    if (dir !== 0) {
      this.facing = dir;
      this.entity.flipX = dir < 0;
    }
    if (onFloor && Math.abs(v.x) > this.speed * 0.85) {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.22;
        kit.dust(this.entity.x - this.facing * 4, this.feet(), { count: 1, dir: -this.facing, color: this.dust });
      }
    }

    // Jump: coyote time (a moment after leaving a ledge) and buffering (pressed just before landing).
    this.coyoteT = onFloor ? this.coyote : Math.max(0, this.coyoteT - dt);
    this.bufferT = Input.pressed('jump') ? this.buffer : Math.max(0, this.bufferT - dt);
    if (onFloor) this.airJumps = this.doubleJump ? 1 : 0;
    if (this.bufferT > 0) {
      if (this.coyoteT > 0) this.doJump(1);
      else if (this.airJumps > 0) {
        this.airJumps -= 1;
        this.doJump(0.85);
        kit.burst(this.entity.x, this.feet(), { color: this.accent, count: 8, glow: true, speed: 60 });
      }
    }
    // Variable height: let go early for a short hop.
    if (!Input.down('jump') && v.y < -this.jump * 0.42) v.y = -this.jump * 0.42;
    // Snappier falls with a little hang time at the top of the arc.
    if (v.y > -30 && v.y < 30) v.y += this.gravity * -0.35 * dt;
    else if (v.y > 0) v.y = Math.min(v.y + this.gravity * 0.45 * dt, 560);

    if (this.attack) {
      this.attackT = Math.max(0, this.attackT - dt);
      if (Input.pressed('attack') && this.attackT === 0) this.swing();
    }

    if (this.entity.y > this.killY) this.die();
  }

  doJump(power) {
    this.velocity.y = -this.jump * power;
    this.bufferT = 0;
    this.coyoteT = 0;
    this.fall = 0;
    kit.squash(this.entity, 1.28, 200);
    kit.dust(this.entity.x, this.feet(), { count: 4, color: this.dust });
    Game.sound('jump');
  }

  land() {
    const hard = this.fall > 380;
    kit.squash(this.entity, hard ? 0.62 : 0.8, hard ? 220 : 160);
    kit.dust(this.entity.x, this.feet(), { count: hard ? 10 : 5, color: this.dust });
    if (hard) kit.shake(0.004, 90);
    if (this.fall > 120) Game.sound('land');
    this.fall = 0;
  }

  updateClimb(dt) {
    const near = Game.time - this.ladderT < 0.08;
    const vert = Input.axis('vertical');
    if (!this.climbing && near && vert !== 0) {
      this.climbing = true;
      this.entity.gravity = false;
    }
    if (!this.climbing) return false;
    if (!near || Input.pressed('jump')) {
      this.climbing = false;
      this.entity.gravity = true;
      if (Input.pressed('jump')) this.doJump(0.8);
      return false;
    }
    const v = this.velocity;
    v.x = (this.ladderX - this.entity.x) * 10;
    v.y = vert * this.speed * 0.6;
    if (Input.axis('horizontal') !== 0 && vert === 0) {
      this.climbing = false;
      this.entity.gravity = true;
    }
    return true;
  }

  swing() {
    this.attackT = 0.32;
    if (this.entity.hasAnimation('attack')) this.playOnce('attack');
    else kit.squash(this.entity, 0.85, 120);
    Game.sound('swing');
    const reach = 30;
    const hx = this.entity.x + this.facing * reach * 0.6;
    kit.burst(hx, this.entity.y, { color: '#FFFFFF', count: 5, glow: true, speed: 50 });
    for (const e of Game.findAll('enemy')) {
      const dx = (e.x - this.entity.x) * this.facing;
      if (dx > -6 && dx < reach && Math.abs(e.y - this.entity.y) < 22) {
        for (const b of e.behaviours) b.hurt && b.hurt(this.facing);
        kit.hitStop(60);
        kit.shake(0.005, 90);
        kit.flashLight(e.x, e.y, { color: '#FFFFFF', radius: 40, ms: 160 });
      }
    }
  }

  onCollide(other) {
    if (this.dead || this.won) return;
    if (other.hasTag('coin')) {
      kit.sparkle(other.x, other.y, this.accent);
      kit.floatText(other.x, other.y - 10, '+1', this.accent);
      other.destroy();
      Game.score += 1;
      this.coins += 1;
      Game.sound('coin');
      this.publish();
    } else if (other.hasTag('heart')) {
      other.destroy();
      this.hp = Math.min(this.health, this.hp + 1);
      kit.sparkle(other.x, other.y, '#FF6A6A');
      Game.sound('powerup');
      this.publish();
    } else if (other.hasTag('enemy')) {
      const me = this.entity.body;
      const them = other.body;
      const stomp = me && them && this.velocity.y >= 0 && me.bottom <= them.top + 8;
      if (stomp) {
        this.velocity.y = -this.jump * 0.75;
        kit.hitStop(55);
        kit.shake(0.006, 110);
        for (const b of other.behaviours) b.hurt ? b.hurt(0, true) : other.destroy();
        Game.sound('stomp');
      } else this.hurt(Math.sign(this.entity.x - other.x) || 1);
    } else if (other.hasTag('hazard')) {
      this.hurt(-this.facing, true);
    } else if (other.hasTag('checkpoint')) {
      if (this.spawn.from !== other.id) {
        this.spawn = { x: other.x, y: other.y - 12, from: other.id };
        for (const b of other.behaviours) b.activate && b.activate();
      }
    } else if (other.hasTag('ladder')) {
      this.ladderT = Game.time;
      this.ladderX = other.x;
    } else if (other.hasTag('goal')) {
      const need = Number(other.behaviours[0]?.need ?? 0);
      if (this.coins >= need) this.win(other);
      else if (!this.nagT || Game.time - this.nagT > 2) {
        this.nagT = Game.time;
        kit.floatText(other.x, other.y - 30, 'FIND ' + (need - this.coins) + ' MORE', '#FFFFFF');
      }
    }
  }

  hurt(dir, deadly) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= 1;
    this.publish();
    kit.hitStop(90);
    kit.shake(0.012, 200);
    kit.flash('#FF4A4A', 90);
    Game.sound('hit');
    if (this.hp <= 0 || deadly) return this.die();
    this.invuln = 1.1;
    this.velocity.x = dir * 170;
    this.velocity.y = -190;
    if (this.entity.hasAnimation('hurt')) this.playOnce('hurt');
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.climbing = false;
    this.entity.gravity = true;
    Game.sound('die');
    kit.hitStop(120);
    kit.shake(0.016, 320);
    kit.burst(this.entity.x, this.entity.y, { color: '#FFFFFF', count: 22, speed: 160 });
    kit.burst(this.entity.x, this.entity.y, { color: this.accent, count: 12, glow: true, speed: 90 });
    kit.flashLight(this.entity.x, this.entity.y, { color: '#FF7A5A', radius: 90, ms: 500 });
    this.entity.visible = false;
    this.entity.solid = false;
    this.left -= 1;
    this.publish();
    kit.after(700, () => {
      if (this.left <= 0) {
        kit.banner('GAME OVER', 'SCORE ' + Game.score, { color: '#FF6A6A', hint: 'PRESS JUMP TO TRY AGAIN' });
        kit.after(600, () => (this.waiting = true));
      } else kit.transition(() => this.respawn(), { ms: 260 });
    });
  }

  respawn() {
    this.entity.solid = true;
    this.entity.setPosition(this.spawn.x, this.spawn.y);
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.entity.visible = true;
    this.hp = this.health;
    this.invuln = 1.2;
    this.dead = false;
    this.publish();
    kit.squash(this.entity, 1.3, 260);
    kit.burst(this.spawn.x, this.spawn.y, { color: this.accent, count: 14, glow: true, speed: 70 });
  }

  win(goal) {
    this.won = true;
    this.velocity.x = 0;
    Game.sound('win');
    kit.slowMo(0.3, 900);
    kit.shake(0.006, 260);
    kit.flashLight(goal.x, goal.y, { color: this.accent, radius: 170, ms: 1600, intensity: 1.4 });
    kit.burst(goal.x, goal.y - 16, { color: this.accent, count: 40, glow: true, speed: 150 });
    if (goal.hasAnimation && goal.hasAnimation('open')) goal.play('open');
    const t = Math.max(0, Game.time - this.startTime);
    const time = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    const coins = this.totalCoins ? '◆ ' + this.coins + '/' + this.totalCoins + '   ' : '';
    kit.after(350, () => kit.banner(this.goalText, coins + 'TIME ' + time, { color: this.accent, hint: 'PRESS JUMP TO PLAY AGAIN' }));
    kit.after(1300, () => (this.waiting = true));
  }

  again() {
    for (const k of Object.keys(Game.state)) delete Game.state[k];
    Game.restart();
  }
}
`;

export const WALKER_JS = `import { Behaviour, Game, kit } from 'degamed';

// Walks back and forth along its ledge and turns at walls. Stomp it or hit it to defeat it.
export default class Walker extends Behaviour {
  static props = { speed: 32, left: 0, right: 0, hp: 1, color: '#A7F070', facesLeft: false };

  onStart() {
    // Patrol range is relative to where it starts (so copies spawned anywhere work too).
    this.minX = this.entity.x - this.left;
    this.maxX = this.entity.x + this.right;
    this.dir = this.entity.x % 2 < 1 ? -1 : 1;
    this.stun = 0;
    this.life = this.hp;
  }

  onUpdate(dt) {
    if (this.stun > 0) {
      this.stun -= dt;
      this.velocity.x *= 0.9;
      return;
    }
    const x = this.entity.x;
    if (this.maxX > this.minX) {
      if (x <= this.minX) this.dir = 1;
      else if (x >= this.maxX) this.dir = -1;
    }
    if (this.entity.onWall) this.dir = -this.entity.onWall;
    this.velocity.x = this.dir * this.speed;
    this.entity.flipX = this.facesLeft ? this.dir > 0 : this.dir < 0;
  }

  hurt(dir, stomped) {
    this.life -= stomped ? this.life : 1;
    kit.burst(this.entity.x, this.entity.y, { color: this.color, count: 10 });
    if (this.life <= 0) return this.defeat();
    this.stun = 0.35;
    this.velocity.x = dir * 160;
    this.velocity.y = -120;
    this.entity.tint = '#FF8080';
    kit.after(120, () => !this.entity.destroyed && (this.entity.tint = null));
    if (this.entity.hasAnimation('hurt')) this.playOnce('hurt');
    Game.sound('hit');
  }

  defeat() {
    kit.burst(this.entity.x, this.entity.y, { color: this.color, count: 16, speed: 150 });
    kit.dust(this.entity.x, this.entity.y + 6, { count: 8 });
    kit.floatText(this.entity.x, this.entity.y - 12, '+5', '#FFFFFF');
    Game.score += 5;
    Game.sound('stomp');
    this.entity.destroy();
  }
}
`;

export const FLYER_JS = `import { Behaviour, Game, kit } from 'degamed';

// Hovers on a gentle wave between two points, and swoops towards the hero when it gets close.
export default class Flyer extends Behaviour {
  static props = { speed: 40, range: 56, chase: 90, color: '#C8A0FF', facesLeft: false };

  onStart() {
    this.minX = this.entity.x - this.range;
    this.maxX = this.entity.x + this.range;
    this.baseY = this.entity.y;
    this.t = this.entity.x * 0.01;
    this.dir = 1;
    this.stun = 0;
    this.entity.gravity = false;
  }

  onUpdate(dt) {
    this.t += dt;
    if (this.stun > 0) {
      this.stun -= dt;
      return;
    }
    const hero = Game.find('player');
    const v = this.velocity;
    let tx;
    let ty = this.baseY + Math.sin(this.t * 2.6) * 10;
    if (hero && hero.visible && Math.hypot(hero.x - this.entity.x, hero.y - this.entity.y) < this.chase) {
      tx = hero.x;
      ty = hero.y - 4;
    } else {
      if (this.entity.x <= this.minX) this.dir = 1;
      if (this.entity.x >= this.maxX) this.dir = -1;
      tx = this.entity.x + this.dir * 40;
    }
    v.x += ((Math.sign(tx - this.entity.x) * this.speed) - v.x) * Math.min(1, dt * 3);
    v.y = (ty - this.entity.y) * 3;
    if (Math.abs(v.x) > 2) this.entity.flipX = this.facesLeft ? v.x > 0 : v.x < 0;
  }

  hurt(dir) {
    kit.burst(this.entity.x, this.entity.y, { color: this.color, count: 16, speed: 150 });
    kit.floatText(this.entity.x, this.entity.y - 12, '+5', '#FFFFFF');
    Game.score += 5;
    Game.sound('stomp');
    this.entity.destroy();
  }
}
`;

export const PICKUP_JS = `import { Behaviour, Game } from 'degamed';

// Gently bobs up and down.
export default class Pickup extends Behaviour {
  onStart() {
    this.baseY = this.entity.y;
    this.offset = this.entity.x * 0.05;
  }

  onUpdate() {
    this.entity.y = this.baseY + Math.sin(Game.time * 3 + this.offset) * 2;
  }
}
`;

export const CHECKPOINT_JS = `import { Behaviour, Game, kit } from 'degamed';

// Lights up when the hero touches it; you come back here after a fall.
export default class Checkpoint extends Behaviour {
  static props = { color: '#FFE38A' };

  onStart() {
    this.lit = false;
    kit.light(this.entity, { color: this.color, radius: 26, intensity: 0.35, flicker: 0.2 });
  }

  activate() {
    if (this.lit) return;
    this.lit = true;
    if (this.entity.hasAnimation('lit')) this.play('lit');
    kit.light(this.entity, { radius: 90, intensity: 1.1, flicker: 0.12 });
    kit.sparkle(this.entity.x, this.entity.y - 10, this.color);
    kit.floatText(this.entity.x, this.entity.y - 26, 'CHECKPOINT', this.color);
    Game.sound('checkpoint');
  }
}
`;

export const GOAL_JS = `import { Behaviour, Game, kit } from 'degamed';

// The way out. "need" is how many pickups you must collect before it opens.
export default class Goal extends Behaviour {
  static props = { need: 0, color: '#9FF5D8' };

  onStart() {
    this.open = this.need <= 0;
    this.pulse = Math.random() * 6;
  }

  onUpdate(dt) {
    this.pulse += dt;
    if (!this.open && (Game.state.coins || 0) >= this.need) {
      this.open = true;
      kit.sparkle(this.entity.x, this.entity.y - 16, this.color);
      kit.floatText(this.entity.x, this.entity.y - 34, 'THE WAY IS OPEN', this.color);
      Game.sound('powerup');
    }
    if (this.entity.light) {
      const base = this.open ? 1 : 0.35;
      this.entity.light.intensity = base + Math.sin(this.pulse * 2) * 0.1;
    }
  }
}
`;

export const HUD_JS = `import { Behaviour, Game } from 'degamed';

// Shows lives, health and pickups from Game.state (the hero script keeps it up to date).
export default class Hud extends Behaviour {
  static props = { show: 'lives,coins', pickup: 'COINS' };

  onUpdate() {
    const s = Game.state;
    const parts = [];
    const show = String(this.show).split(',');
    if (show.includes('health') && s.maxHp > 1) parts.push('♥'.repeat(Math.max(0, s.hp ?? 0)) + '-'.repeat(Math.max(0, (s.maxHp ?? 0) - (s.hp ?? 0))));
    if (show.includes('lives')) parts.push('♥ ' + (s.lives ?? 0));
    if (show.includes('coins')) parts.push('◆ ' + String(s.coins ?? Game.score).padStart(2, '0') + (s.totalCoins ? '/' + s.totalCoins : ''));
    if (show.includes('distance')) parts.push(String(s.distance ?? 0) + ' M' + (s.best ? '   BEST ' + s.best + ' M' : ''));
    this.entity.text = parts.join('    ');
  }
}
`;

export const RUNNER_JS = `import { Behaviour, Input, Game, kit } from 'degamed';

// Runs on its own and keeps speeding up. Jump over gaps and enemies, slide under barriers.
export default class Runner extends Behaviour {
  static props = {
    speed: 170, maxSpeed: 300, rampUp: 3, jump: 340, gravity: 1000, coyote: 0.1, buffer: 0.14,
    slideTime: 0.55, killY: 400, dust: '#C8C0B0', accent: '#FFE38A', width: 12, height: 22,
  };

  onStart() {
    this.startX = this.entity.x;
    this.dead = false;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.slideT = 0;
    this.wasOnFloor = false;
    this.fall = 0;
    this.dustT = 0;
    this.started = false;
    Game.state.distance = 0;
    Game.state.best = Game.state.best || 0;
  }

  feet() {
    const b = this.entity.body;
    return b ? b.bottom : this.entity.y + 8;
  }

  onUpdate(dt) {
    if (this.dead) {
      if (this.waiting && Input.pressed('jump')) Game.restart();
      return;
    }
    const v = this.velocity;
    if (!this.started) {
      this.started = Input.pressed('jump') || Input.down('right') || Game.time > 1.2;
      v.x = 0;
      if (!this.started) return;
    }
    const onFloor = this.onFloor;
    if (onFloor && !this.wasOnFloor) {
      kit.squash(this.entity, this.fall > 360 ? 0.65 : 0.8, 160);
      kit.dust(this.entity.x, this.feet(), { count: 5, color: this.dust });
      if (this.fall > 150) Game.sound('land');
      this.fall = 0;
    }
    if (!onFloor) this.fall = Math.max(this.fall, v.y);
    this.wasOnFloor = onFloor;

    const run = Math.min(this.maxSpeed, this.speed + this.rampUp * Game.time);
    v.x = run;
    this.dustT -= dt;
    if (onFloor && this.dustT <= 0) {
      this.dustT = this.slideT > 0 ? 0.05 : 0.2;
      kit.dust(this.entity.x - 6, this.feet(), { count: this.slideT > 0 ? 2 : 1, dir: -1, color: this.dust });
    }

    this.coyoteT = onFloor ? this.coyote : Math.max(0, this.coyoteT - dt);
    this.bufferT = Input.pressed('jump') || Input.pressed('up') ? this.buffer : Math.max(0, this.bufferT - dt);
    if (this.bufferT > 0 && this.coyoteT > 0) {
      this.endSlide();
      v.y = -this.jump;
      this.bufferT = 0;
      this.coyoteT = 0;
      kit.squash(this.entity, 1.28, 200);
      Game.sound('jump');
    }
    if (!Input.down('jump') && !Input.down('up') && v.y < -this.jump * 0.45) v.y = -this.jump * 0.45;
    if (v.y > 0) v.y = Math.min(v.y + this.gravity * 0.4 * dt, 600);

    // Slide: duck under barriers (or drop faster in the air).
    if (Input.pressed('down')) {
      if (onFloor && this.slideT <= 0) {
        this.slideT = this.slideTime;
        this.entity.setHitbox(this.width, Math.round(this.height * 0.5));
        if (this.entity.hasAnimation('crouch')) this.entity.play('crouch');
        kit.squash(this.entity, 0.7, 140);
        Game.sound('slide');
      } else if (!onFloor) v.y = Math.max(v.y, this.jump * 0.8);
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (this.slideT <= 0 && !this.entity.onCeiling) this.endSlide();
      else if (this.slideT <= 0) this.slideT = 0.05;
    }

    Game.state.distance = Math.max(0, Math.floor((this.entity.x - this.startX) / 16));
    if (this.entity.y > this.killY) this.die();
  }

  endSlide() {
    const b = this.entity.body;
    this.slideT = 0;
    if (b && b.height !== this.height) this.entity.setHitbox(this.width, this.height);
  }

  onCollide(other) {
    if (this.dead) return;
    if (other.hasTag('coin')) {
      kit.sparkle(other.x, other.y, this.accent);
      other.destroy();
      Game.score += 1;
      Game.sound('coin');
    } else if (other.hasTag('enemy')) {
      const me = this.entity.body;
      const them = other.body;
      if (me && them && this.velocity.y >= 0 && me.bottom <= them.top + 8) {
        this.velocity.y = -this.jump * 0.7;
        kit.hitStop(50);
        kit.shake(0.006, 100);
        for (const b of other.behaviours) b.hurt ? b.hurt(0, true) : other.destroy();
        Game.sound('stomp');
      } else this.die();
    } else if (other.hasTag('hazard')) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.velocity.x = 0;
    Game.sound('die');
    kit.hitStop(120);
    kit.shake(0.016, 320);
    kit.burst(this.entity.x, this.entity.y, { color: '#FFFFFF', count: 22, speed: 160 });
    kit.flashLight(this.entity.x, this.entity.y, { color: '#FF7A5A', radius: 90, ms: 500 });
    this.entity.visible = false;
    this.entity.solid = false;
    const d = Game.state.distance;
    const best = Math.max(d, Game.state.best || 0);
    const record = d > (Game.state.best || 0) && d > 0;
    Game.state.best = best;
    kit.after(650, () => {
      kit.banner('YOU RAN ' + d + ' M', record ? 'NEW BEST!   COINS ' + Game.score : 'BEST ' + best + ' M   COINS ' + Game.score, {
        color: record ? this.accent : '#FFFFFF',
        hint: 'PRESS JUMP TO RUN AGAIN',
      });
      kit.after(500, () => (this.waiting = true));
    });
  }
}
`;

/** The runner's chunk spawner. `chunks` is "name:width:difficulty;…". */
export const SPAWNER_JS = `import { Behaviour, Game } from 'degamed';

// Builds the endless track: spawns hand-made chunks ahead of the camera and removes old ones.
export default class Spawner extends Behaviour {
  static props = { chunks: '', start: 0, tile: 16, ahead: 520, behind: 520, difficulty: 2, seed: 1 };

  onStart() {
    this.list = String(this.chunks).split(';').filter(Boolean).map((s) => {
      const [name, width, level] = s.split(':');
      return { name, width: Number(width) * this.tile, level: Number(level) };
    });
    this.nextX = Number(this.start);
    this.live = [];
    this.rand = this.random(Number(this.seed) + (Game.state.runs = (Game.state.runs || 0) + 1));
    this.last = '';
  }

  random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  pick() {
    // Harder chunks unlock the further you run.
    const unlocked = Math.min(this.difficulty, 1 + Math.floor((Game.state.distance || 0) / 120));
    const pool = this.list.filter((c) => c.level <= unlocked && c.name !== this.last && c.level > 0);
    const from = pool.length ? pool : this.list.filter((c) => c.level > 0);
    const c = from[Math.floor(this.rand() * from.length)];
    this.last = c.name;
    return c;
  }

  onUpdate() {
    if (!this.list.length) return;
    const cam = Game.camera;
    while (this.nextX < cam.x + cam.width + this.ahead) {
      const c = this.pick();
      const h = Game.spawn(c.name, this.nextX, 0);
      if (h) this.live.push({ h, end: this.nextX + c.width });
      this.nextX += c.width;
    }
    while (this.live.length && this.live[0].end < cam.x - this.behind) this.live.shift().h.destroy();
  }
}
`;
