## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Core Concepts](#2-core-concepts)
3. [Weapon Item Structure](#3-weapon-item-structure)
4. [toolSettings Reference (Complete)](#4-toolsettings-reference-complete)
5. [Creating a Gun](#5-creating-a-gun)
6. [Creating a Melee Weapon](#6-creating-a-melee-weapon)
7. [Creating a Grenade](#7-creating-a-grenade)
8. [Creating a Utility Item](#8-creating-a-utility-item)
9. [Attachments System](#9-attachments-system)
10. [Weapon Upgrades (Modification System)](#10-weapon-upgrades-modification-system)
11. [Animations & Sounds](#11-animations--sounds)
12. [Input Binding System](#12-input-binding-system)
13. [Viewmodel & Camera System](#13-viewmodel--camera-system)
14. [Server-Side Handling](#14-server-side-handling)
15. [Lag Resilience & Networking](#15-lag-resilience--networking)
16. [Advanced Topics](#16-advanced-topics)
17. [Quick Reference Cheatsheet](#17-quick-reference-cheatsheet)

---

## 1. Overview & Architecture

ItemManager is a client-side weapon framework that handles equipping, firing, reloading, melee attacks, grenade throwing, aiming, viewmodel rendering, recoil, and more. It is a ModuleScript located at `StarterPlayer.StarterPlayerScripts.client.ItemManager`.

**Architecture flow:**

```
Player selects weapon from Satchel (backpack)
  → Client script calls itemHandler:equip(weaponTool)
    → ItemManager clones weapon, creates viewmodel, binds inputs
    → Server is invoked via weaponEquip remote to get ServerWep model
    → Server creates "variables" folder (magazine, reserve, boltPulled, firingMode)
  → Every frame: itemHandler:update(deltaTime) runs
    → Updates viewmodel CFrame, crosshair, recoil, sway, walk cycle
  → Player presses inputs (fire, reload, aim, etc.)
    → ItemManager handles locally, syncs to server via remotes
  → Player unequips or switches weapon
    → itemHandler:remove() cleans up viewmodel, inputs, GUI
```

**Key modules ItemManager depends on:**

| Module | Path | Purpose |
|--------|------|---------|
| `raycastHitbox` | `ReplicatedStorage.modules.raycastHitbox` | Melee hitbox detection |
| `fastCastHandler` | `ReplicatedStorage.modules.fastCastHandler` | Projectile raycasting |
| `spring` | `ReplicatedStorage.modules.spring` | Physics-based spring interpolation |
| `soundHandler` | `ReplicatedStorage.modules.soundHandler` | 3D sound playback |
| `muzzleHandler` | `ReplicatedStorage.modules.muzzleHandler` | Muzzle flash effects |
| `casingHandler` | `ReplicatedStorage.modules.casingHandler` | Shell ejection |
| `createViewmodel` | `ReplicatedStorage.modules.createViewmodel` | First-person viewmodel creation |
| `toolUtils` | `ReplicatedStorage.modules.toolUtils` | Tool optimization (gut/reassemble) |
| `inputManager` | `ReplicatedStorage.modules.inputManager` | Input binding/unbinding |
| `satchel` | `ReplicatedStorage.modules.satchel` | Backpack/inventory management |
| `hitmarker` | `ReplicatedStorage.modules.hitmarker` | Hit detection & impact FX |
| `blood` | `ReplicatedStorage.modules.blood` | Blood particle effects |
| `screen3D` | `ReplicatedStorage.modules.screen3D` | 3D-screen GUI components |
| `glyphManager` | `ReplicatedStorage.modules.glyphManager` | Controller/keyboard glyph icons |

---

## 2. Core Concepts

### The ItemManager Instance

Created via `itemManager.new()`, returns a table with metatable pointing to the `handler` module. All public methods are called with colon syntax: `itemHandler:equip(tool)`, `itemHandler:update(dt)`, `itemHandler:remove()`.

### Lifecycle

1. **`handler.new()`** — Creates the instance, initializes springs, GUI references, and helper functions.
2. **`handler:equip(item)`** — Equips a weapon. Clones the weapon model, creates a viewmodel, loads settings/animations/sounds, binds inputs, and syncs with the server.
3. **`handler:update(deltaTime)`** — Called every frame. Updates viewmodel position, crosshair, recoil springs, camera effects, walk cycle, and sway.
4. **`handler:remove(isDropping)`** — Unequips. Cleans up viewmodel, stops animations, unbinds inputs, hides GUI, and optionally drops the weapon.

### State Tracking

The instance tracks many state flags:

- `self.equipped` — Weapon is equipped (setup complete)
- `self.actuallyEquipped` — Equip animation finished, weapon is usable
- `self.firing` — Player is holding the fire button
- `self.reloading` — Currently reloading
- `self.chambering` — Currently chambering a round
- `self.aiming` — Currently aiming down sights
- `self.sprinting` — Player is sprinting
- `self.crouching` — Player is crouching
- `self.firstPerson` — Camera is in first person
- `self.pushing` — Currently performing a push attack
- `self.isLocalOnlyMode` — Server sync failed, operating locally only

---

## 3. Weapon Item Structure

Every weapon is a `Tool` instance (or Model with a `RootPart`) stored in `ReplicatedStorage.weapons`. The weapon must have the **"Weapon" tag** applied to it.

### Required Children

```
WeaponTool (Tool, tagged "Weapon")
├── toolSettings (ModuleScript)      — Returns the settings table
├── RootPart (MeshPart or Part)      — Primary part for welding/physics
├── offset (ModuleScript, optional)  — Returns CFrame for hand positioning
├── AimPoint (Part, optional)         — Reference for ADS positioning
├── ReticlePart (Part, optional)     — Scope reticle for parallax
├── Bullets (Model, optional)         — Visible bullet models in magazine
├── Mag (MeshPart, optional)         — Magazine mesh
└── components (Folder, optional)    — Holds muzzleFX, etc.
```

### The `offset` Module

A simple ModuleScript returning a CFrame that adjusts the weapon's position in the character's hand:

```luau
return CFrame.new(0, -0.1, -0.2)
```

### The `variables` Folder

Created by the **server** when the weapon is equipped. Contains:

| Child | Type | Purpose |
|-------|------|---------|
| `magazine` | IntValue | Current ammo in magazine |
| `reserve` | IntValue | Current reserve ammo |
| `boltPulled` | BoolValue | Whether the bolt is chambered |
| `firingMode` | IntValue | Current fire mode index |

The client reads these via `self.loadVariables()` on equip.

---

## 4. toolSettings Reference (Complete)

The `toolSettings` ModuleScript is the heart of each weapon. It returns a Lua table with all configuration. Below is the **complete reference** of every known setting, grouped by category.

### General Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `toolType` | string | — | `"gun"`, `"melee"`, `"grenade"`, or `"item"` |
| `toolClass` | string | — | Sub-class, e.g. `"pump shotgun"`, `"blunt"`, `"throwable"`, `"utility"` |
| `equippingTime` | number | — | Seconds before weapon is usable after equip |
| `displayName` | string | — | Name shown in UI |
| `itemName` | string | nil | Optional internal name |
| `hideCrosshair` | boolean | false | Hides the crosshair entirely |
| `motorOrientationFix` | CFrame | nil | Overrides the ToolGrip C0 orientation |

### Crosshair Settings

| Setting | Type | Description |
|---------|------|-------------|
| `crosshairSize` | number | Base crosshair gap size |
| `crosshairFiringExpansion` | number | How much crosshair expands on fire |
| `crosshairDamper` | number | Spring damper for crosshair movement |
| `crosshairSpeed` | number | Spring speed for crosshair movement |
| `firingShotgunCrosshair` | boolean | Uses circular crosshair instead of lines |

### Firing Settings (Guns)

| Setting | Type | Description |
|---------|------|-------------|
| `firingEnabled` | boolean | Enables firing system |
| `firingRPM` | number | Rounds per minute |
| `firingBurstRPM` | number | RPM between burst shots |
| `firingBulletsPerBurst` | number | Shots per burst fire |
| `firingBulletsPerShot` | number | Pellets per shot (shotguns) |
| `firingSpread` | number | Bullet spread in degrees |
| `firingDamage` | {min, max} | Damage range |
| `firingHeadMultiplier` | number | Headshot damage multiplier |
| `firingLimbMultiplier` | number | Limb damage multiplier |
| `firingDistanceFall` | {minDist, maxDist} | Damage falloff range |
| `firingBlurSize` | number | Camera blur intensity on fire |
| `firingClickSound` | boolean | Play click sound on empty fire |
| `firingChargeEnabled` | boolean | Requires charging before firing |
| `firingChargeTime` | number | Charge time in seconds |
| `firingVisibleBulletModels` | boolean | Show/hide bullet models in magazine |
| `firingLowAmmoIndicationSound` | boolean | Pitch shift sound at low ammo |

### Bullet Physics

| Setting | Type | Description |
|---------|------|-------------|
| `firingBulletVelocity` | number | Bullet speed (studs/sec) |
| `firingBulletMaxDistance` | number | Max travel distance |
| `firingBulletAcceleration` | Vector3 | Gravity/acceleration applied |
| `firingBulletSize` | number | Cosmetic bullet size |
| `firingBulletName` | string | Name of bullet model in storage |
| `firingPlayerPierceCount` | number | Max players a bullet can pierce |
| `firingPierceMaxThickness` | number | Max material thickness to pierce |

### Recoil

| Setting | Type | Description |
|---------|------|-------------|
| `firingRecoilEnabled` | boolean | Enables camera recoil |
| `firingRecoilScale` | number | Base recoil intensity |
| `firingRecoilAccuracy` | number | Recoil randomness precision |
| `firingRecoilDamper` | number | Recoil spring damper |
| `firingRecoilSpeed` | number | Recoil spring speed |
| `firingRecoilPattern` | table | Indexed table of {min=Vector3, max=Vector3} recoil steps |
| `crouchingRecoilReductionEnabled` | boolean | Reduces recoil when crouching |
| `crouchingRecoilReductionPercent` | number | Reduction multiplier (0-1) |
| `aimingRecoilReduction` | number | Recoil reduction while aiming (0-1) |

### Ammo & Reloading

| Setting | Type | Description |
|---------|------|-------------|
| `magazineCapacity` | number | Rounds in magazine (`math.huge` for infinite) |
| `firingReserveCapacity` | number | Reserve ammo (`1e9` for infinite) |
| `firingLimitedAmmo` | boolean | Whether reserve is consumed |
| `firingReloadTime` | number | Reload duration (seconds) |
| `firingEmptyReloadTime` | number | Reload duration when empty |
| `firingDoEmptyReload` | boolean | Uses separate empty reload animation |
| `firingReloadWhileAim` | boolean | Can reload while aiming |
| `firingShellInsertReload` | boolean | Shell-by-shell reload (shotguns) |
| `firingShellInsertTime` | number | Time per shell insert |
| `firingShellInsertCount` | number | Shells inserted per animation |
| `firingPreReloadEnabled` | boolean | Has pre-reload animation phase |
| `firingPreReloadTime` | number | Pre-reload duration |
| `firingPostReloadEnabled` | boolean | Has post-reload animation phase |
| `firingPostReloadTime` | number | Post-reload duration |
| `firingBulletResetTime` | number | Delay to reset bullet models after reload |
| `firingBulletResetEmptyTime` | number | Delay for empty reload bullet reset |

### Manual Chambering

| Setting | Type | Description |
|---------|------|-------------|
| `manualChamberingEnabled` | boolean | Requires manual chambering |
| `firingChamberTime` | number | Chamber animation duration |
| `firingChamberWhileAim` | boolean | Can chamber while aiming |
| `firingChamberShellDelay` | number | Delay before shell ejects on chamber |
| `firingChamberShotgun` | boolean | Shotgun-style chambering (requires chamber per shot) |
| `firingSlideEx` | CFrame | Bolt/slide offset when pulled back |
| `firingSlideLock` | boolean | Locks slide back when empty |

### Shell Ejection

| Setting | Type | Description |
|---------|------|-------------|
| `firingShellEjecting` | boolean | Enables shell ejection |
| `firingShellWhenShot` | boolean | Eject shell on each shot |
| `firingShellName` | string | Shell model name in storage |
| `firingShellVelocity` | number | Ejection speed |
| `firingShellRotVelocity` | number | Ejection rotational speed |
| `firingShellOrientation` | Vector3 | Ejection orientation offset |
| `firingShellCollide` | boolean | Shells collide with ground |
| `firingShellLifetime` | number | Shell lifetime in seconds |

### Fire Modes

| Setting | Type | Description |
|---------|------|-------------|
| `firingModes` | table | Array of mode strings: `"Semi"`, `"Automatic"`, `"Burst"`, `"Safety"` |
| `canChangeFiringMode` | boolean | Player can switch fire modes |

### Muzzle FX

| Setting | Type | Description |
|---------|------|-------------|
| `firingMuzzleFX` | boolean | Show muzzle flash |
| `firingMuzzleLightEnabled` | boolean | Dynamic light on muzzle |
| `firingMuzzleLightRange` | number | Light range |
| `firingMuzzleLightBrightness` | number | Light brightness |
| `firingMuzzleLightColor` | Color3 | Light color |
| `firingMuzzleLightLifetime` | number | Light duration |

### Aiming / ADS

| Setting | Type | Description |
|---------|------|-------------|
| `aimingEnabled` | boolean | Enables aiming |
| `aimPoints` | table | Array of Part names that serve as aim references |
| `aimingFieldOfView` | number | FOV when aiming (aim point 1) |
| `aimingFieldOfView2` | number | FOV when aiming (aim point 2, optional) |
| `aimingSensitivity` | number | ADS sensitivity multiplier |
| `aimingRecoilReduction` | number | Recoil reduction while ADS (0-1) |
| `aimingSpreadReduction` | number | Spread reduction while ADS (0-1) |
| `aimingEasingStyle` | Enum.EasingStyle | Camera tween style |
| `aimingEasingDirection` | Enum.EasingDirection | Camera tween direction |
| `aimingKickbackReductionPercent` | number | Lerp speed for aim point (0-1) |
| `aimingKickbackReductionPercent2` | number | Same, for aim point 2 |
| `aimingScopingEnabled` | boolean | Enables scope overlay |
| `aimingSwayDisabled` | boolean | Disables sway while aiming |
| `aimSpringAdjustment` | boolean | Adjusts walk cycle spring while aiming |
| `aimSpringDampening` | number | Walk cycle damper while aiming |
| `aimSpringSpeed` | number | Walk cycle speed while aiming |
| `aimDepthOfView` | boolean | Enables depth of field while aiming |
| `scopeGlare` | boolean | Enables scope glare reflection |
| `reticleParts` | table | Part names that get reticle parallax |
| `scopingObjectsToHide` | table | Part names hidden when scoped |

### Melee Settings

| Setting | Type | Description |
|---------|------|-------------|
| `meleeEnabled` | boolean | Enables melee system |
| `attackingRate` | number | Cooldown between attacks (seconds) |
| `attackingTable` | table | Array of animation type names for attack combo |
| `attackingHitboxTime` | {start, end} | When hitbox is active during animation |
| `attackingDamage` | {min, max} | Damage range |
| `attackingHeadMultiplier` | number | Headshot multiplier |
| `attackingLimbMultiplier` | number | Limb damage multiplier |
| `attackingScreenShakeEnabled` | boolean | Screen shake on melee hit |
| `attackingScreenShakeScale` | number | Shake intensity |
| `attackingScreenShakeMin` | Vector3 | Min shake direction |
| `attackingScreenShakeMax` | Vector3 | Max shake direction |
| `attackingScreenShakeAccuracy` | number | Shake randomness |
| `attackingScreenShakeDamper` | number | Shake spring damper |
| `attackingScreenShakeSpeed` | number | Shake spring speed |
| `attackingGibEnabled` | boolean | Can gib on hit |
| `attackingGibSharp` | boolean | Sharp gib (blade) vs blunt |
| `attackingGibLimbs` | table/nil | Specific limbs to gib (nil = all) |
| `attackingGibMultiplier` | number | Gib force multiplier |
| `attackingConcussionEnabled` | boolean | Can cause concussion |
| `attackingConcussionTime` | number | Concussion duration |
| `attackingConcussionChance` | number | Chance (0-100) |
| `attackingBoneBreakEnabled` | boolean | Can break bones |
| `attackingBoneBreakLimbs` | table/nil | Specific limbs (nil = all) |
| `attackingBoneBreakMultiplier` | number | Break force multiplier |
| `attackingKnockbackEnabled` | boolean | Knockback on hit |
| `attackingKnockbackPower` | number | Knockback force |
| `attackingKnockbackDuration` | number | Knockback duration |
| `attackingStunEnabled` | boolean | Can stun |
| `attackingStunTime` | number | Stun duration |
| `attackingStunChance` | number | Stun chance (0-100) |
| `attackingHitDecalEnabled` | boolean | Leaves decals on hit |
| `attackingHitDecalName` | string | Decal name |
| `attackingHitDecalChance` | number | Decal chance (0-100) |
| `attackingHitDecalScale` | number | Decal scale |
| `fistAttack` | boolean | Uses character fist as hitbox source |
| `finisherEnabled` | boolean | Enables finisher moves |

### Push Settings

| Setting | Type | Description |
|---------|------|-------------|
| `pushingEnabled` | boolean | Enables push attack |
| `attackingPushRate` | number | Push cooldown |
| `attackingPushHitboxTime` | {start, end} | Hitbox window for push |
| `attackingPushDamage` | boolean/number | Whether push deals damage |
| `attackingPushKnockbackPower` | number | Push knockback force |
| `attackingPushKnockbackDuration` | number | Push knockback duration |

### Grenade Settings

| Setting | Type | Description |
|---------|------|-------------|
| `nadeEnabled` | boolean | Enables grenade system |
| `nadePinEnabled` | boolean | Requires pulling pin |
| `nadePinTime` | number | Pin pull duration |
| `nadeThrowTime` | number | Throw animation duration |
| `nadeThrowVelocity` | number | Throw speed |
| `nadeDetonationTime` | number | Fuse time after pin pull |
| `nadeLifetime` | number | Max lifetime |
| `nadeDestroyOnExplode` | boolean | Destroy model on explosion |
| `nadeExplodeOnImpact` | boolean | Explodes on contact |
| `nadeExplodeSoundEnabled` | boolean | Play explosion sound |
| `nadeExplodeSoundIds` | table | Array of sound IDs |
| `nadeExplodeSoundVolume` | number | Sound volume |
| `nadeExplodeSoundPitch` | number | Sound pitch |
| `nadeExplosionMarkEnabled` | boolean | Leaves scorch mark |
| `nadeExplosionMarkIds` | table | Decal IDs for mark |
| `nadeExplosionMarkLifetime` | number | Mark duration |
| `nadeExplosionMarkSize` | number | Mark scale |
| `nadeExplodeTable` | table | Explosion properties (see below) |

**`nadeExplodeTable` sub-fields:**

| Field | Type | Description |
|-------|------|-------------|
| `explosionEnabled` | boolean | Creates explosion |
| `explosionRadius` | number | Blast radius |
| `explosionRagdollTime` | number | Ragdoll duration on hit |
| `explosionBaseDamage` | number | Damage at center |
| `explosionKnockbackEnabled` | boolean | Knockback on explosion |
| `explosionKnockbackPower` | number | Knockback force |
| `explosionKnockbackDuration` | number | Knockback duration |
| `explosionGibEnabled` | boolean | Can gib on explosion |
| `explosionGibLimbs` | table/nil | Specific limbs |
| `explosionGibMultiplier` | number | Gib force |

### Inspection

| Setting | Type | Description |
|---------|------|-------------|
| `inspectionEnabled` | boolean | Enables inspection animation |
| `inspectionTime` | number | Inspection duration |

### Haptics

| Setting | Type | Description |
|---------|------|-------------|
| `hapticStrength` | number | Controller vibration strength (0-1) |
| `hapticDuration` | number | Vibration duration (seconds) |

### Sprint

| Setting | Type | Description |
|---------|------|-------------|
| `sprintSpring` | Vector3 | Sprint viewmodel offset/rotation spring |

### Custom Actions (Advanced)

| Setting | Type | Description |
|---------|------|-------------|
| `customActionTable` | table | Array of custom input bindings |
| `customSource` | function | Custom initialization function, receives `self` |

### Knockback (Ranged)

| Setting | Type | Description |
|---------|------|-------------|
| `firingKnockbackEnabled` | boolean | Bullets cause knockback |
| `firingKnockbackPower` | number | Knockback force |
| `firingKnockbackDuration` | number | Knockback duration |

### Gib (Ranged)

| Setting | Type | Description |
|---------|------|-------------|
| `firingGibEnabled` | boolean | Bullets can gib |
| `firingGibLimbs` | table/nil | Specific limbs |
| `firingGibMultiplier` | number | Gib force |

---

## 5. Creating a Gun

### Step-by-Step

**1. Create the Tool model:**

```
ReplicatedStorage.weapons.MyGun (Tool)
├── toolSettings (ModuleScript)
├── RootPart (MeshPart)          — Your weapon mesh
├── AimPoint (Part)              — Invisible part for ADS reference
├── ReticlePart (Part, optional) — For scope reticle
├── offset (ModuleScript)        — Hand positioning
├── firePoint (Attachment)       — On RootPart, points forward
├── muzzlePoint (Attachment)     — On RootPart, for muzzle FX
├── chamberPoint (Attachment)    — On RootPart, for shell ejection
└── components (Folder, optional)
    └── muzzleFX (ParticleEmitter) — Custom muzzle particles
```

**2. Add the "Weapon" tag** to the Tool instance.

**3. Write the toolSettings ModuleScript:**

```luau
return {
    toolType = "gun";
    toolClass = "assault rifle";
    equippingTime = 1.2;
    displayName = "My Gun";

    -- Crosshair
    crosshairSize = 5.5;
    crosshairFiringExpansion = 325;
    crosshairDamper = 0.7;
    crosshairSpeed = 35;

    -- Firing
    firingEnabled = true;
    firingRPM = 600;
    firingSpread = 2;
    firingBulletsPerShot = 1;
    firingDamage = {10, 25};
    firingHeadMultiplier = 3;
    firingLimbMultiplier = 1;
    firingDistanceFall = {100, 2000};
    firingBlurSize = 2;
    firingClickSound = true;

    -- Bullet physics
    firingBulletVelocity = 3000;
    firingBulletMaxDistance = 5000;
    firingBulletAcceleration = Vector3.new(0, 0, 0);
    firingBulletSize = 0.4;
    firingBulletName = "bullet";

    -- Recoil
    firingRecoilEnabled = true;
    firingRecoilScale = 0.1;
    firingRecoilAccuracy = 0.01;
    firingRecoilDamper = 0.10;
    firingRecoilSpeed = 17;
    firingRecoilPattern = {
        [1] = { min = Vector3.new(1, -0.45, 0.15), max = Vector3.new(1.5, 0.45, 0.4) },
    };
    crouchingRecoilReductionEnabled = true;
    crouchingRecoilReductionPercent = 0.75;

    -- Fire modes
    firingModes = {"Automatic", "Semi"};
    canChangeFiringMode = true;

    -- Ammo
    magazineCapacity = 30;
    firingReserveCapacity = 120;
    firingLimitedAmmo = true;
    firingReloadTime = 2.5;
    firingReloadWhileAim = false;

    -- Slide
    firingSlideEx = CFrame.new(-0.4, 0, 0);
    firingSlideLock = false;

    -- Shell ejection
    firingShellEjecting = true;
    firingShellWhenShot = true;
    firingShellName = "5.56x45mm";
    firingShellVelocity = 30;
    firingShellRotVelocity = 15;
    firingShellOrientation = Vector3.new(0, -90, 0);
    firingShellCollide = true;
    firingShellLifetime = 1.5;

    -- Muzzle FX
    firingMuzzleFX = true;
    firingMuzzleLightEnabled = true;
    firingMuzzleLightRange = 15;
    firingMuzzleLightBrightness = 5;
    firingMuzzleLightColor = Color3.fromRGB(255, 210, 137);
    firingMuzzleLightLifetime = 0.01;

    -- Aiming
    aimingEnabled = true;
    aimPoints = {script.Parent.AimPoint};
    aimingFieldOfView = 40;
    aimingRecoilReduction = 0.6;
    aimingSpreadReduction = 0.3;
    aimingScopingEnabled = false;
    aimDepthOfView = false;

    -- Inspection
    inspectionEnabled = true;

    -- Haptics
    hapticStrength = 1;
    hapticDuration = 0.1;

    -- Sprint
    sprintSpring = Vector3.new(-0.25, 0.25, 0.5);

    -- Animations
    animationsTable = {
        {type = "idle", id = 0};
        {type = "fire", id = 0};
        {type = "reload", id = 0};
        {type = "equip", id = 0};
        {type = "inspect", id = 0};
    };

    -- Sounds
    soundsTable = {
        {type = "equip", id = 0, volume = 0.3};
        {type = "fire", id = 0, volume = 0.7};
        {type = "reload", id = 0, volume = 0.3};
        {type = "click", id = 0};
    };
}
```

**4. Create the `offset` ModuleScript:**

```luau
return CFrame.new(0, -0.1, -0.2)
```

**5. Ensure `firePoint` and `muzzlePoint` Attachments exist on RootPart**, pointing in the forward direction (the LookVector should point where bullets go).

### Shotgun-Specific Additions

For a pump shotgun, add these settings:

```luau
    manualChamberingEnabled = true;
    firingChamberShotgun = true;
    firingChamberTime = 1;
    firingChamberShellDelay = 0.75;
    firingShellInsertReload = true;
    firingShellInsertTime = 0.5;
    firingShellInsertCount = 1;
    firingShotgunCrosshair = true;
    firingBulletsPerShot = 8; -- pellets
    firingSpread = 6;
    firingModes = {"Semi"};
    canChangeFiringMode = false;
```

### Bolt-Action Sniper-Specific Additions

```luau
    manualChamberingEnabled = true;
    firingChamberShotgun = false; -- chamber per mag, not per shot
    firingChamberTime = 1.5;
    firingChamberShellDelay = 0.75;
    firingSlideEx = CFrame.new(-0.4, 0, 0);
    firingSlideLock = true;
    firingModes = {"Semi"};
    canChangeFiringMode = false;
    aimingScopingEnabled = true;
    aimingFieldOfView = 10;
    reticleParts = {"ReticlePart"};
```

---

## 6. Creating a Melee Weapon

### Structure

```
ReplicatedStorage.weapons.MyMelee (Tool, tagged "Weapon")
├── toolSettings (ModuleScript)
├── RootPart (MeshPart) — The weapon mesh
├── offset (ModuleScript)
└── Left Arm Root (Part, optional) — For left-hand grip animation
```

### toolSettings

```luau
return {
    toolType = "melee";
    toolClass = "blunt"; -- or "blade"
    equippingTime = 1.0;
    displayName = "My Melee";

    crosshairSize = 1.5;
    crosshairFiringExpansion = 250;
    crosshairDamper = 0.7;
    crosshairSpeed = 35;

    -- Melee
    meleeEnabled = true;
    attackingRate = 1.2;
    attackingTable = {"attack_left", "attack_right", "attack_down"};
    attackingHitboxTime = {0.06, 0.3};
    attackingDamage = {40, 60};
    attackingHeadMultiplier = 2;
    attackingLimbMultiplier = 1;

    -- Screen shake
    attackingScreenShakeEnabled = true;
    attackingScreenShakeScale = 120;
    attackingScreenShakeMin = Vector3.new(-1, -1, -1);
    attackingScreenShakeMax = Vector3.new(1, 1, 1);
    attackingScreenShakeAccuracy = 0.01;
    attackingScreenShakeDamper = 0.23;
    attackingScreenShakeSpeed = 22;

    -- Effects
    attackingGibEnabled = true;
    attackingGibSharp = false; -- true for blades
    attackingGibMultiplier = 0.5;
    attackingConcussionEnabled = true;
    attackingConcussionTime = 8;
    attackingConcussionChance = 100;
    attackingBoneBreakEnabled = true;
    attackingBoneBreakMultiplier = 2;
    attackingStunEnabled = true;
    attackingStunTime = 1.5;
    attackingStunChance = 40;
    attackingKnockbackEnabled = true;
    attackingKnockbackPower = 1;
    attackingKnockbackDuration = 0.25;

    -- Push (alt attack)
    pushingEnabled = true;
    attackingPushRate = 2;
    attackingPushHitboxTime = {0.1, 0.3};
    attackingPushDamage = false;

    inspectionEnabled = true;
    hapticStrength = 8;
    hapticDuration = 0.5;

    animationsTable = {
        {type = "idle", id = 0};
        {type = "attack_left", id = 0, hitboxTime = {0.25, 0.53}, speed = 1};
        {type = "attack_right", id = 0, hitboxTime = {0.3, 0.55}, speed = 1};
        {type = "attack_down", id = 0, hitboxTime = {0.4, 0.8}, speed = 1};
        {type = "push", id = 0, hitboxes = {"Right Arm"}, hitboxTime = {0.1, 0.3}};
        {type = "equip", id = 0};
        {type = "inspect", id = 0};
    };

    soundsTable = {
        {type = "equip", id = 0, volume = 0.3};
        {type = "impact", id = 0, volume = 1};
        {type = "slash", id = 0, volume = 0.6}; -- swing sound
    };
}
```

### How Melee Hitboxes Work

Each attack animation entry can specify:
- `hitboxTime = {start, end}` — When during the animation the hitbox is active (overrides `attackingHitboxTime`)
- `hitboxes = {"PartName"}` — For push attacks, which character parts act as hitbox sources
- `fist = "PartName"` — For fist-based attacks, uses a specific character part
- `speed = number` — Animation playback speed (affects hitbox timing)

The `raycastHitbox` module is used with `PartMode(true)`, meaning it raycasts from the specified part(s) each frame during the active window. On hit, it triggers `hitmarker.checkForHumanoid()` and fires the `hitMelee` remote to the server.

### Combo System

The `attackingTable` is an array of animation type names. Each attack increments `self.attackIndex`. When it exceeds the table length, it wraps to 1. This creates a combo chain (e.g., left swing → right swing → overhead).

---

## 7. Creating a Grenade

### Structure

```
ReplicatedStorage.weapons.MyGrenade (Tool, tagged "Weapon")
├── toolSettings (ModuleScript)
├── RootPart (Part)
└── offset (ModuleScript)
```

### toolSettings

```luau
return {
    toolType = "grenade";
    toolClass = "throwable";
    equippingTime = 0.3;
    displayName = "Frag Grenade";

    crosshairSize = 0;
    crosshairDamper = 0.7;
    crosshairSpeed = 20;

    nadeEnabled = true;
    nadePinEnabled = true;
    nadePinTime = 0.4;
    nadeThrowTime = 0.16;
    nadeThrowVelocity = 90;
    nadeDetonationTime = 4;
    nadeLifetime = 30;
    nadeDestroyOnExplode = true;
    nadeExplodeOnImpact = false;

    nadeExplodeSoundEnabled = true;
    nadeExplodeSoundIds = {0}; -- replace with real IDs
    nadeExplodeSoundVolume = 0.6;
    nadeExplodeSoundPitch = 1;

    nadeExplosionMarkEnabled = true;
    nadeExplosionMarkIds = {0};
    nadeExplosionMarkLifetime = 15;
    nadeExplosionMarkSize = 2;

    nadeExplodeTable = {
        explosionEnabled = true;
        explosionRadius = 30;
        explosionRagdollTime = 12;
        explosionBaseDamage = 400;
        explosionKnockbackEnabled = true;
        explosionKnockbackPower = 15;
        explosionKnockbackDuration = 0.1;
        explosionGibEnabled = true;
        explosionGibLimbs = nil;
        explosionGibMultiplier = 6;
    };

    animationsTable = {
        {type = "idle", id = 0};
        {type = "pin", id = 0};
        {type = "hold", id = 0};
        {type = "throw", id = 0};
        {type = "equip", id = 0};
    };

    soundsTable = {
        {type = "equip", id = 0, volume = 0.3};
        {type = "pin", id = 0};
        {type = "throw", id = 0};
    };
}
```

### How Grenades Work

1. Player holds fire (MouseButton1) → pin pull animation plays for `nadePinTime`
2. If still holding → grenade is "armed", hold animation plays
3. Player releases fire → throw animation plays for `nadeThrowTime`
4. `throwNade` remote fires to server with mouse hit position
5. Server clones the nade model, calculates trajectory, throws it
6. After `nadeDetonationTime` or on impact (if `nadeExplodeOnImpact`), server creates explosion
7. The weapon is removed from inventory after throwing

---

## 8. Creating a Utility Item

Utility items (stims, medkits, etc.) use the `customActionTable` and `customSource` settings for unique behavior.

### toolSettings

```luau
return {
    toolType = "item";
    toolClass = "utility";
    equippingTime = 1.0;
    displayName = "Med Stim";
    hideCrosshair = true;
    inspectionEnabled = false;

    customActionTable = {
        {
            mouseBind = "MouseButton1",
            controllerBind = "ButtonR2",
            keyBind = nil,
            execFunction = function(toggle, self)
                -- toggle is true on press, false on release
                -- self is the ItemManager instance
                if toggle then
                    self.playAnimation("use")
                    self.playSound("inject")

                    -- Access character, humanoid, etc.
                    local char = self.character
                    local humanoid = char:FindFirstChildOfClass("Humanoid")
                    if humanoid then
                        humanoid.Health = math.min(humanoid.Health + 50, humanoid.MaxHealth)
                    end

                    -- Remove the item after use
                    task.delay(2, function()
                        self:remove()
                    end)
                end
            end,
            contextName = "inject"
        }
    },

    customSource = function(self)
        -- Called during equip, before inputs are bound
        -- Use to set up custom state on the ItemManager instance
        self.refillHealth = function()
            local char = self.character
            local humanoid = char and char:FindFirstChildOfClass("Humanoid")
            if humanoid then
                humanoid.Health = humanoid.MaxHealth
            end
        end
    end,

    animationsTable = {
        {type = "idle", id = 0};
        {type = "equip", id = 0};
        {type = "use", id = 0, speed = 1.5};
    };

    soundsTable = {
        {type = "equip", id = 0, volume = 0.3};
        {type = "inject", id = 0, volume = 0.2};
    };
}
```

### How Custom Actions Work

- Each entry in `customActionTable` is bound via `bindInput(data, true)` — the `true` flag means it's external, so `self` is passed to `execFunction`
- `mouseBind` — maps to `Enum.UserInputType` (e.g. `"MouseButton1"`)
- `keyBind` — maps to `Enum.KeyCode` (e.g. `"F"`)
- `controllerBind` — maps to `Enum.KeyCode` for gamepad (e.g. `"ButtonR2"`)
- `contextName` — Display name for control hints and mobile button matching
- `mobileToggle` — If true, acts as a toggle button on mobile instead of hold

---

## 9. Attachments System

### Overview

Attachments are physical model modifications to weapons (scopes, extended mags, grips, etc.) that also modify the weapon's `toolSettings` via an `upgradeSettings` function.

### Attachment Storage

```
ReplicatedStorage.WeaponAttachments
└── [WeaponName]               — Folder named after the weapon
    └── [AttachmentName]       — Model of the attachment
        └── AttachmentData     — ModuleScript with attachment info
```

### AttachmentData Module Structure

```luau
return {
    attachmentInfo = {
        description = "Extended magazine for increased capacity",
        weapon = "G36",              -- Must match the weapon's name
        type = "magazine",           -- Attachment type category
        playerLevelNeeded = 60,     -- Optional level requirement
        customRootPart = "Mag",     -- Optional: weld to this part instead of RootPart
    },
    removeTargets = {                -- Parts on the weapon to hide when this is attached
        "MagModel", "E1", "E2"
    },
    upgradeSettings = function(toolSettings)
        -- Receives the current toolSettings table
        -- Returns a table of settings to override
        return {
            magazineCapacity = 90,
            firingReserveCapacity = 180,
            firingReloadTime = 4.1,
            -- Can also replace entire tables:
            soundsTable = modifiedSoundsTable,
            animationsTable = modifiedAnimsTable,
        }
    end
}
```

### How Attachments Are Applied

1. **WeaponCustomizationLoader** (`ReplicatedStorage.modules.WeaponCustomizationLoader`) handles loading:
   - Looks up the attachment in `ReplicatedStorage.WeaponAttachments/[WeaponName]/[AttachmentName]`
   - Validates compatibility via `attachmentInfo.weapon`
   - Removes any existing attachment of the same type
   - Clones the attachment model, welds it to the weapon's `RootPart` (or `customRootPart`)
   - Hides conflicting parts listed in `removeTargets` (sets Transparency=1, adds `HiddenByAttachment` attribute)
   - Creates a new ModuleScript child on the weapon named `[type]Attachment` with the `attachmentData` tag
   - Stores a reference to the original AttachmentData in an `AttachmentRef` ObjectValue

2. **ItemManager's `checkForUpgrades()`** runs during equip:
   - Iterates through weapon children looking for `attachmentData` or `modificationSettings` tags
   - For attachments: follows `AttachmentRef` → requires the original module → calls `upgradeSettings(self.settings)`
   - Applies returned settings to `self.settings`
   - Tracks modified settings in `self.upgradeModifiedSettings`
   - Adds `attachmentApplied` tag to prevent re-application
   - Updates animation speed modifiers for timing-related settings
   - Displays upgrade percentages in the inspect UI

### Creating a New Attachment

**1. Create the attachment model:**

```
ReplicatedStorage.WeaponAttachments.MyGun
└── ExtendedMag
    ├── AttachmentData (ModuleScript)
    └── [MeshParts/Parts for the attachment visual]
```

**2. Write the AttachmentData:**

```luau
return {
    attachmentInfo = {
        description = "Extended magazine (+50% capacity)",
        weapon = "MyGun",
        type = "magazine",
    },
    removeTargets = {"Mag"},
    upgradeSettings = function(toolSettings)
        return {
            magazineCapacity = math.floor(toolSettings.magazineCapacity * 1.5),
            firingReloadTime = toolSettings.firingReloadTime * 1.2,
        }
    end
}
```

**3. The attachment is now available.** The WeaponCustomizationLoader will handle welding it to the weapon when applied.

### Attachment Types

Common attachment types include:
- `magazine` — Extended mags, drum mags
- `sight` / `scope` — Optics that change aim points and FOV
- `grip` — Foregrips that reduce recoil
- `barrel` — Barrel modifications (suppressors, muzzle devices)
- `stock` — Stock modifications
- `handguard` — Handguard replacements

---

## 10. Weapon Upgrades (Modification System)

### Overview

Weapon upgrades are permanent modifications stored in `ReplicatedStorage.WeaponUpgradeModules`. They are ModuleScripts tagged with `modificationSettings`.

### Upgrade Module Structure

```luau
return {
    upgradeInfo = {
        name = "Rapid Fire",
        description = "+20% fire rate",
        cost = 4500,
        stackable = false,
    },
    upgradeSettings = function(toolSettings)
        return {
            firingRPM = math.floor(toolSettings.firingRPM * 1.2),
        }
    end
}
```

### How Upgrades Differ from Attachments

| Aspect | Attachments | Upgrades |
|--------|-------------|----------|
| Tag | `attachmentData` | `modificationSettings` |
| Visual model | Yes (physical model) | No (stat only) |
| Applied tag | `attachmentApplied` | `modificationApplied` |
| Reference | Via `AttachmentRef` ObjectValue | Direct require of module |
| Display | Hidden from upgrade display | Shown in upgrade display |

### Available Upgrades

| Name | Effect | Cost | Stackable |
|------|--------|------|-----------|
| Supersonic | +25% bullet range | 3300 | No |
| Rapid Fire | +20% fire rate | 4500 | No |
| Sight | -40% firing blur | 3300 | No |
| Piercing | +2 body penetration (sniper) | 900 | No |
| Extended Magazine | +10% mag capacity | 1200 | Yes |
| Control | -30% aiming kickback | 4200 | No |
| Aim Precision | +15% ADS spread reduction | 4800 | Yes |
| Fast Hands | -40% equip time | 3900 | No |
| Fast Fingers | -30% shell insert time | 3600 | No |
| Double Trouble | +10% damage | 6000 | No |
| Tuber | -30% pre-reload time | 3000 | No |
| Aim Stability | +25% aiming recoil reduction | 3600 | Yes |

### Animation Speed Modifiers

When an upgrade changes a timing-related setting, the ItemManager automatically adjusts animation playback speed. The mapping is:

| Setting | Animation Type |
|---------|---------------|
| `equippingTime` | `equip` |
| `firingReloadTime` | `reload` |
| `firingShellInsertTime` | `shell_insert` |
| `firingPreReloadTime` | `prereload` |
| `firingChamberTime` | `chamber` |
| `firingEmptyReloadTime` | `reloadEmpty` |

The speed modifier is calculated as: `1 / (newTime / originalTime)` — so if reload time is halved, the animation plays 2x faster.

---

## 11. Animations & Sounds

### Animation System

Animations are defined in `animationsTable` inside `toolSettings`. Each entry:

```luau
{
    type = "fire",          -- String key used to play/stop this animation
    id = 123456789,         -- Roblox Animation ID (0 = skip)
    speed = 1,              -- Playback speed multiplier (optional)
    hitboxTime = {0.3, 0.55}, -- For melee: when hitbox is active (optional)
    hitboxes = {"Right Arm"}, -- For push: which parts are hitbox sources (optional)
    fist = "RightHand",     -- For fist attacks: which part is the hitbox (optional)
}
```

**Standard animation types:**

| Type | When it plays |
|------|---------------|
| `idle` | Looping idle animation |
| `fire` | Each shot |
| `equip` | On equip |
| `reload` | Reloading (partial mag) |
| `reloadEmpty` | Reloading (empty mag) |
| `prereload` | Before main reload |
| `postreload` | After main reload |
| `shell_insert` | Each shell insert (shotguns) |
| `chamber` | Chambering a round |
| `inspect` | Inspection (hold I) |
| `selector` | Fire mode switch |
| `holddown` | Safety mode hold |
| `attack_left` | Melee left swing |
| `attack_right` | Melee right swing |
| `attack_down` | Melee overhead |
| `push` | Push attack |
| `pin` | Grenade pin pull |
| `hold` | Grenade hold (armed) |
| `throw` | Grenade throw |
| `vault` | Vaulting (from MovementAnims) |
| `barSwing` | Bar swinging (from MovementAnims) |

**Animation markers (in the animation itself):**

| Marker | Effect |
|--------|--------|
| `playSound` | Calls `self.playSound(soundName)` with the marker's text |
| `callFunction` | Calls `self[functionName]()` with the marker's text |
| `spawnSpeedloader` | Shows speedloader parts |
| `removeSpeedloader` | Hides speedloader parts |
| `restoreBullets` | Resets visible bullet models |
| `boltBack` | Moves bolt to back position |
| `boltForward` | Moves bolt to normal position |

### Sound System

Sounds are defined in `soundsTable`:

```luau
{
    type = "fire",       -- Key used to play this sound
    id = 123456789,      -- Roblox Sound ID
    volume = 0.7,        -- Playback volume
    pitch = 1,           -- Playback pitch
    rollOffMax = 100,    -- 3D rolloff max distance
    rollOffMin = 5,      -- 3D rolloff min distance
}
```

**Sound types and when they play:**

| Type | When |
|------|------|
| `equip` | On equip |
| `fire` | Each shot (uses special fire sound handler) |
| `reload` | During reload |
| `chamber` | During chambering |
| `click` | Dry fire (empty magazine) |
| `selector` | Fire mode switch |
| `impact` | Melee hit on humanoid |
| `slash` | Melee swing |
| `push` | Push attack |
| `pin` | Grenade pin pull |
| `throw` | Grenade throw |
| `boltBack` | Bolt pulled back |
| `boltForward` | Bolt returned forward |
| `magIn` | Magazine inserted |
| `magOut` | Magazine removed |
| `pumpBack` | Shotgun pump back |
| `pumpForward` | Shotgun pump forward |
| `insert` | Shell inserted |
| `shake` | Shotgun shell shake |

Multiple sounds with the same `type` are randomly selected on play.

---

## 12. Input Binding System

### How Inputs Are Bound

During `updateInputs()`, the ItemManager creates input bindings based on which features are enabled in `toolSettings`. Each binding is created via `bindInput()`:

```luau
bindInput({
    mouseBind = "MouseButton1",     -- Enum.UserInputType name (or nil)
    keyBind = "R",                  -- Enum.KeyCode name (or nil)
    controllerBind = "ButtonX",    -- Enum.KeyCode name for gamepad
    execFunction = function(toggle) -- Called with true on press, false on release
        self:reload(toggle)
    end,
    contextName = "reload",        -- Display name for control hints
    mobileToggle = false,          -- Optional: toggle behavior on mobile
})
```

### Default Input Bindings

| Action | Mouse | Keyboard | Controller | Condition |
|--------|-------|----------|------------|-----------|
| Fire | MouseButton1 | — | ButtonR2 | `firingEnabled` |
| Reload | — | R | ButtonX | `firingEnabled` and finite mag |
| Chamber | MouseButton1 | — | ButtonR2 | `manualChamberingEnabled` |
| Melee swing | MouseButton1 | — | ButtonR2 | `meleeEnabled` |
| Push (gun) | — | F | ButtonR3 | `pushingEnabled` (with firing) |
| Push (melee) | — | F | ButtonL2 | `pushingEnabled` (with melee) |
| Aim | MouseButton2 | — | ButtonL2 | `aimingEnabled` |
| Inspect | — | I | DPadUp | `inspectionEnabled` |
| Change sight | — | X | DPadLeft | Multiple aim points |
| Fire mode | — | V | DPadDown | `canChangeFiringMode` |
| Throw grenade | MouseButton1 | — | ButtonR2 | `nadeEnabled` |
| Finisher | — | Q | ButtonY | `finisherEnabled` |

### Mobile Support

On mobile devices, the system looks for `ImageButton` instances in `PlayerGui.mobileControls.itemControls` whose names match the `contextName`. If found, touch events are bound to the same `execFunction`.

### Control Hints

Non-mobile platforms show animated control hint UI elements with platform-appropriate glyphs (PC keyboard, Xbox, PlayStation) via the `glyphManager` module.

---

## 13. Viewmodel & Camera System

### Viewmodel Creation

On equip, `createViewmodel` (`ReplicatedStorage.modules.createViewmodel`) is called:
- Clones a base viewmodel from `ReplicatedStorage.storage.framework.viewmodel`
- Copies the player's clothing and shoulder accessories onto the viewmodel
- Listens for `ChildAdded`/`ChildRemoved`/`DescendantAdded` on the character to sync cosmetics
- The viewmodel is parented to `workspace.Camera` (only visible in first person)

### Weapon Attachment to Viewmodel

The weapon model is cloned and parented into the viewmodel. The `ToolGrip` Motor6D on the viewmodel's Right Arm is set to connect to the weapon's `RootPart`. If the weapon has `Left Arm Root` or `Right Arm Root` parts, additional welds are created.

### Viewmodel Positioning

Every frame in `update()`, the viewmodel Head CFrame is computed by combining:
1. Camera CFrame
2. Offset CFrame (from `offset` module + user settings)
3. Aim point lerp (when aiming)
4. Walk cycle (figure-8 bobbing based on movement speed)
5. Secondary walk cycle
6. Sway (mouse delta + controller look)
7. Breathing (idle spring)
8. Recoil (viewmodel recoil spring)
9. Movement spring (landing, freefall)
10. Sprint spring

### First/Third Person Switching

The `getCameraDistance()` function checks the distance from the camera to the character's HumanoidRootPart + 1.5 studs. If less than 2 studs, first-person mode is active:
- Viewmodel is parented to camera (visible)
- Server weapon parts get `LocalTransparencyModifier = 1` (hidden)
- If distance >= 2: viewmodel is unparented (hidden), server weapon is shown

### Tool Optimization

`toolUtils` handles performance optimization:
- **`gut(tool)`** — Strips a weapon to just RootPart + basic geometry, stores full version in `ReplicatedStorage.weaponModels`
- **`reassembleTool(tool, lowDetail)`** — Restores from cache, optionally in low detail
- **`show(tool, chunkSize)`** — Gradually reveals parts over multiple frames to spread rendering cost
- **`hide(tool)`** — Sets all parts to transparent, stores original values
- **`trim(tool)`** — Removes HighDetail-tagged parts
- **`incinerate(tool)`** — Removes all parts except RootPart

---

## 14. Server-Side Handling

### weaponEquip (RemoteFunction — InvokeServer)

**Client calls:** `replicatedStorage.remotes.weaponEquip:InvokeServer(item)`

**Server does:**
1. Enables all scripts inside the weapon model
2. Requires `toolSettings` to get weapon properties
3. Sets `CanCollide = false` on all parts
4. Creates a `variables` folder with `magazine`, `reserve`, `boltPulled`, `firingMode` IntValues/BoolValues
5. Creates a `ToolGrip` Motor6D on the character's Right Arm to wield the weapon
6. Returns the server weapon model to the client

### syncAmmo (RemoteEvent — FireServer)

**Client calls:** `replicatedStorage.remotes.syncAmmo:FireServer(weapon, magazine, reserve, firemodeIndex)`

**Server does:** Updates the `variables` folder values on the weapon.

### syncBoltPull (RemoteEvent — FireServer)

**Client calls:** `replicatedStorage.remotes.syncBoltPull:FireServer(weapon, boltPulled)`

**Server does:** Updates the `boltPulled` BoolValue.

### hitMelee (RemoteEvent — FireServer)

**Client calls:** `replicatedStorage.remotes.hitMelee:FireServer(weapon, part, position, normal, material, offset)`

**Server does:**
1. Validates target has a Humanoid
2. Prevents friendly fire and forcefield hits
3. Tags the player as the attacker via `combat.tagPlayer()`
4. Applies random damage from `attackingDamage` range
5. Handles headshot multiplier, concussion, bone breaking, stun, hit decals, knockback, and gibbing

### hitPush (RemoteEvent — FireServer)

**Client calls:** `replicatedStorage.remotes.hitPush:FireServer(weapon, part, position, normal, material, offset)`

**Server does:**
1. Triggers ragdoll on the victim
2. Applies knockback via BodyVelocity
3. Tags the attacker

### hitBullet (RemoteEvent — FireServer)

Called by `fastCastHandler` when a bullet ray hits something. Server applies damage, handles gibbing, knockback, etc.

### throwNade (RemoteEvent — FireServer)

**Client calls:** `replicatedStorage.remotes.throwNade:FireServer(weapon, mouseHitPosition)`

**Server does:**
1. Clones nade model from `ReplicatedStorage.storage.nadeModels`
2. Sets network owner to the player
3. Calculates throw trajectory using `combat.angleOfReach()`
4. Destroys the weapon from inventory
5. Explodes on impact or after `nadeDetonationTime`
6. Creates explosion via `combat.createExplosion()`

### dropItem (RemoteEvent — FireServer)

**Client calls:** `replicatedStorage.remotes.dropItem:FireServer(weapon)`

**Server does:**
1. Detaches weapon from Right Arm
2. Creates a lootable item with ProximityPrompt via `createLootableItem`
3. Sets network owner to player
4. Moves to `workspace.DroppedItems`

### fakeBreakPart (RemoteEvent — FireServer)

Used for breaking glass/structures. Requires a secret passcode. Makes parts transparent and removes collision.

---

## 15. Lag Resilience & Networking

### Configuration

```luau
local LAG_RESILIENCE = {
    SYNC_AMMO_INTERVAL = 0.5,    -- Sync ammo every 0.5s instead of per shot
    EQUIP_TIMEOUT = 5,          -- Timeout for equip operation
    MAX_PENDING_SYNC = 3,        -- Max pending syncs before forcing update
    QUICK_EQUIP_WAIT = 0.5,      -- Quick wait before local-only fallback
    SERVER_CALL_TIMEOUT = 3,     -- Timeout for any server call
    MAX_ACTION_QUEUE_SIZE = 50,  -- Max queued actions before dropping oldest
}
```

### Connection Quality Tracking

The system tracks `connectionQuality` with:
- `roundTripTime` — Measured during equip
- `isHighLag` — RTT > 0.5s
- `isCriticalLag` — RTT > 2.0s
- `failedCalls` / `successfulCalls` — Running counters

### Local-Only Mode

If the server doesn't respond within `QUICK_EQUIP_WAIT` (0.5s), the system enters `isLocalOnlyMode`:
- Uses a local fallback weapon model
- Continues to wait for server in background
- When server responds, swaps to server model and re-syncs
- If too many failures (>5), enters local-only mode
- Exits local-only mode when failures drop below 3

### Ammo Sync Strategy

- Client is the source of truth for ammo state
- `syncAmmo()` only fires to server when values actually change
- A periodic loop (`startAmmoSyncLoop`) runs every 0.5s to retry failed syncs
- Force sync on critical events (reload finish, unequip)
- `pendingAmmoSync` flag marks dirty state for next interval

---

## 16. Advanced Topics

### Custom Source Function

The `customSource` setting allows custom initialization during equip:

```luau
customSource = function(self)
    -- self is the ItemManager instance
    -- Called after settings are loaded, before inputs are bound
    -- Can define custom functions on self
    self.myCustomFunc = function()
        -- ...
    end
end
```

### Animation Markers for Custom Logic

Animation keyframe markers can call functions on the ItemManager instance:

```luau
-- In an animation, add a keyframe marker named "callFunction"
-- with text "myCustomFunc"
-- Then define it:
customSource = function(self)
    self.myCustomFunc = function()
        self.playSound("customSound")
        -- any custom logic
    end
end
```

### Reticle Parallax

Weapons with `reticleParts` get parallax effects on their scope reticles. The `reticleParallax` module is cloned for each reticle part, creating a realistic scope parallax effect.

### Scope Glare

When `scopeGlare` is enabled, the `toggleScopeGlare` remote fires to the server, which handles the glare reflection visible to other players.

### Crouching Integration

The ItemManager reads `self.crouching` (set by the external client script) to:
- Reduce recoil by `crouchingRecoilReductionPercent`
- Reduce crosshair scale to 0.75

### Sprinting Integration

The external client script sets `self.sprinting = true/false`. When sprinting:
- Sprint spring applies viewmodel offset
- Aiming is cancelled
- Walk cycle amplitude increases (4x multiplier)
- Fire button cancels sprint

### Multiple Aim Points

Weapons can have multiple aim points (e.g., iron sights + red dot + scope):
```luau
aimPoints = {script.Parent.IronSights, script.Parent.RedDot, script.Parent.Scope}
aimingFieldOfView = 50    -- iron sights
aimingFieldOfView2 = 40   -- red dot
aimingFieldOfView3 = 10   -- scope
aimingKickbackReductionPercent = 0.5   -- iron sights
aimingKickbackReductionPercent2 = 0.5 -- red dot
aimingKickbackReductionPercent3 = 0.3 -- scope
```

Players press X (or DPadLeft) to cycle aim points. Each aim point Part can be tagged with "Scope" to trigger the scope overlay.

### Error Handling

The ItemManager has comprehensive error handling:
- `safeCall(func, contextName, ...)` wraps functions in xpcall with traceback
- `setErrorCallback(callback)` allows the external script to receive error notifications
- On error during equip or update, the weapon is automatically unequipped (if `UNEQUIP_ON_ERROR` is true)
- Errors are logged to console and optionally shown as notifications

### Creating a Weapon from Scratch — Checklist

1. Create a Tool in `ReplicatedStorage.weapons` with the "Weapon" tag
2. Add a `RootPart` (MeshPart) with `firePoint`, `muzzlePoint`, `chamberPoint` Attachments
3. Add an `AimPoint` Part (invisible, positioned where the camera should align)
4. Add a `toolSettings` ModuleScript with all required settings
5. Add an `offset` ModuleScript returning a CFrame
6. Create/upload animations and add their IDs to `animationsTable`
7. Create/upload sounds and add their IDs to `soundsTable`
8. If making a gun: ensure `firingEnabled = true` and configure ammo/recoil
9. If making a melee: ensure `meleeEnabled = true` and configure attack table
10. If making a grenade: ensure `nadeEnabled = true` and configure explosion
11. Test in Studio by placing the weapon in the player's Backpack

---

## 17. Quick Reference Cheatsheet

### Minimum Viable Gun

```luau
return {
    toolType = "gun",
    equippingTime = 1,
    displayName = "Pistol",
    firingEnabled = true,
    firingRPM = 300,
    firingSpread = 2,
    firingDamage = {15, 25},
    firingHeadMultiplier = 3,
    firingLimbMultiplier = 1,
    firingDistanceFall = {50, 1000},
    magazineCapacity = 12,
    firingReserveCapacity = 60,
    firingLimitedAmmo = true,
    firingReloadTime = 2,
    firingModes = {"Semi"},
    canChangeFiringMode = false,
    aimingEnabled = true,
    aimPoints = {script.Parent.AimPoint},
    aimingFieldOfView = 50,
    firingRecoilEnabled = true,
    firingRecoilScale = 0.1,
    firingRecoilPattern = {
        [1] = {min = Vector3.new(1, -0.3, 0), max = Vector3.new(1.5, 0.3, 0.3)},
    },
    firingRecoilDamper = 0.1,
    firingRecoilSpeed = 17,
    inspectionEnabled = true,
    hapticStrength = 1,
    hapticDuration = 0.1,
    animationsTable = {
        {type = "idle", id = 0},
        {type = "fire", id = 0},
        {type = "reload", id = 0},
        {type = "equip", id = 0},
        {type = "inspect", id = 0},
    },
    soundsTable = {
        {type = "equip", id = 0, volume = 0.3},
        {type = "fire", id = 0, volume = 0.7},
        {type = "reload", id = 0, volume = 0.3},
    },
}
```

### Minimum Viable Melee

```luau
return {
    toolType = "melee",
    equippingTime = 1,
    displayName = "Knife",
    meleeEnabled = true,
    attackingRate = 0.8,
    attackingTable = {"slash"},
    attackingHitboxTime = {0.1, 0.3},
    attackingDamage = {30, 50},
    attackingHeadMultiplier = 2,
    attackingLimbMultiplier = 1,
    attackingScreenShakeEnabled = true,
    attackingScreenShakeScale = 80,
    attackingScreenShakeMin = Vector3.new(-1, -1, -1),
    attackingScreenShakeMax = Vector3.new(1, 1, 1),
    attackingScreenShakeAccuracy = 0.01,
    attackingScreenShakeDamper = 0.23,
    attackingScreenShakeSpeed = 22,
    attackingGibEnabled = true,
    attackingGibSharp = true,
    attackingGibMultiplier = 0.5,
    attackingKnockbackEnabled = true,
    attackingKnockbackPower = 0.5,
    attackingKnockbackDuration = 0.2,
    inspectionEnabled = true,
    hapticStrength = 5,
    hapticDuration = 0.3,
    animationsTable = {
        {type = "idle", id = 0},
        {type = "slash", id = 0, hitboxTime = {0.1, 0.3}, speed = 1},
        {type = "equip", id = 0},
        {type = "inspect", id = 0},
    },
    soundsTable = {
        {type = "equip", id = 0, volume = 0.3},
        {type = "impact", id = 0, volume = 1},
        {type = "slash", id = 0, volume = 0.6},
    },
}
```

### ItemManager Public API

| Method | Description |
|--------|-------------|
| `handler.new()` | Creates a new ItemManager instance |
| `handler:equip(item)` | Equips a weapon Tool |
| `handler:update(deltaTime)` | Per-frame update (viewmodel, crosshair, recoil) |
| `handler:remove(isDropping)` | Unequips, optionally drops weapon |
| `handler:fire(tofire)` | Fire weapon (true = start, false = stop) |
| `handler:reload(toreload)` | Reload weapon |
| `handler:chamber(tochamber)` | Chamber a round |
| `handler:aim(toaim, forced, noSpring, switching)` | Aim down sights |
| `handler:attack(toattack)` | Melee attack |
| `handler:push(topush)` | Push attack |
| `handler:throwNade(tothrow)` | Throw grenade |
| `handler:selector(toswitch)` | Switch fire mode |
| `handler:inspect(actionToggle)` | Inspect weapon |
| `handler:switchAimpoint(toswitch)` | Cycle aim points |
| `handler:scope(value)` | Toggle scope overlay |
| `handler:setErrorCallback(callback)` | Set error handler |
| `handler:hideServerTextures(toggle)` | Hide/show server weapon textures |
| `handler.safeCall(func, context, ...)` | Safe function execution |
| `self.playAnimation(name)` | Play animation by type |
| `self.stopAnimation(name)` | Stop animation by type |
| `self.playSound(name, pitchMultiplier)` | Play sound by type |
| `self.setCrosshairScale(scale)` | Set crosshair scale |
| `self.syncAmmo(forceSync)` | Sync ammo to server |
| `self.updateGUI()` | Refresh ammo/firemode UI |
| `self.updateInputs()` | Rebind all inputs |
| `self.loadData()` | Load animations and sounds |
| `self.loadVariables()` | Read variables from server |