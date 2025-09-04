# **Tactica Arena v1.0**

*Now with a backend-only d20 rules engine. UI, player-facing stats, and all approved systems remain unchanged; only the **internal math** is swapped.*

## **1\) Product narrative & vision**

Tactics Arena is a competitive, story-less tactics game where players assemble faction-flavored armies and fight synchronous, turn-based battles on procedurally generated, tile-based maps. Skill trees, promotions, terrain mastery, and smart positioning decide outcomes—not spending. Ownership and legacy matter: **Units, Armies, and Weapons are NFTs**, and key match events are **anchored on-chain** for verifiable history. The game prizes clarity: previews for hit, damage, and movement keep depth knowable.

**Launch goals**: fair depth, evergreen replayability, integrity (server-authoritative \+ on-chain attestations), and collectible legacy without pay-to-win.

---

## **2\) Player fantasy & core loop**

You craft a **signature roster** (own \>12, deploy up to 12, max 2/class, 1 Leader), tune loadouts (gear \+ consumables), preview the map seed, deploy under placement rules, and duel in a crisp **per-unit initiative** battle with AP economy. Post-match, you bank **Unit XP, Army XP**, soft currency, and repair gear durability. Practice vs AI supports playtesting; friendly matches let friends battle outside the ranked window.

---

## **3\) Platforms, tech & ops**

* **PC & Mac** at launch; server-authoritative simulation with deterministic RNG.  
* **Unity/Godot** (finalized via technical spike).  
* **Accounts**: email/SSO; **reconnect** window 120s; latency-aware matchmaking.  
* **Security**: anti-cheat sanity checks, turn checksums, deterministic replays.

---

## **4\) Web3 ownership & on-chain logging (unchanged)**

* **NFTs**: Armies/Units/Weapons \= ERC-721; Consumables/Materials \= ERC-1155; royalties via ERC-2981.  
* **Mastery SBT** (non-transferable) binds **earned power** to the **owner wallet** (attunement gates for transferred units/weapons).  
* **MatchCommit/MatchResult** events anchor fairness and results (replay hash \+ IPFS pointer); batching via Merkle roots.  
* **Custody UX**: embedded smart wallet (AA, meta-tx) \+ optional external wallets.

---

## **5\) Army, factions, classes (narrative)**

Players can **own more than 12** units and **deploy up to 12** (or fewer, at risk). No more than **2 of any class** per deployment. Armies have a **Leader**; on Leader KO, the team suffers a short morale debuff (not instant defeat). **Factions**create identity via passives and faction-only skills; **classes** define tactical chassis and promotions at Lv **20/40**. Respec exists only by **creating a new army**.

### **5.1 Class archetype matrix (seed set)**

| Class | Role | Weapons | Armor | Signature | Promotion (20/40) |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Swordsman | Melee DPS | Sword, Dual\* | Medium | Dash \+ Finisher | Duelist / Blademaster |
| Guardian | Tank/Control | Shield+1H | Heavy | Guard \+ ZoC aura | Bulwark / Warden |
| Archer | Ranged DPS | Bow/Crossbow | Light | Barrage \+ Mark | Marksman / Falconer |
| Ranger | Skirmisher | Spear/Sword | Medium | Disengage \+ Trap | Hunter / Pathfinder |
| Mage | Caster DPS | Staff/Tome | Light | AoE spells | Elementalist / Arcanist |
| Cleric | Healer/Support | Mace/Staff | Light | Heal \+ Cleanse | Templar / Oracle |
| Rogue | Assassin | Daggers/Dual | Light | Backstab \+ Smoke | Nightblade / Saboteur |
| Spearmaster | Control | Spear/Halberd | Medium | Reach \+ Brace | Hoplite / Dragoon |

\*Dual-wield where class allows (exception rule).

### **5.2 Faction identity matrix (examples)**

| Faction | Theme | Passive | Faction-only Skill | Element Lean |
| ----- | ----- | ----- | ----- | ----- |
| Human Kingdom | Discipline | \+5% morale resist | Shield Wall (team DEF aura) | Neutral/Holy |
| Elven Court | Agility/Magic | \+1 AGL baseline | Windstep (free 1-tile move) | Wind/Lightning |
| Dwarven Clans | Armor/Engineering | −10% durability loss | Overhaul (temp gear buff) | Earth/Fire |
| Umbral League | Trickery | \+5% flank crit | Veil (short stealth pulse) | Dark/Poison |
| Tidemarch | Amphibious | Water tiles cost 1 | Undertow (pull 1 tile) | Water/Ice |

---

## **6\) Visible stats & combat (narrative — unchanged UI)**

Players see and reason with these **visible stats**: **HP, MP, ATK, DEF, MAG, RES, AGL, INT, MOV, RNG, LCK**.

* **AGL** drives initiative & evasion; **INT** adds a capped XP multiplier and contributes with **LCK** to crit threat range.  
* **3 AP** per turn; facing, height, ZoC/AoO, LOS, and **friendly-fire** for AoE are on.  
* Elements exist, but not all classes/factions use them.

### **6.1 Core stats matrix (player-facing)**

| Stat | Meaning | Typical Range | Primary Users |
| ----- | ----- | ----- | ----- |
| HP | Health | 100–600 | Tanks/Frontliners |
| MP | Skill resource | 20–200 | Casters/Hybrids |
| ATK | Physical damage scaling | 10–80 | Melee/Ranged physical |
| DEF | Physical mitigation | 5–60 | Tanks |
| MAG | Spell damage scaling | 10–80 | Casters |
| RES | Magical mitigation | 5–60 | Clerics/Casters |
| **AGL** | Initiative & evasion | **5–40** | Skirmishers/Rogues |
| **INT** | XP mod & crit factor | **5–40** | Casters/Leaders |
| MOV | Tiles per turn | 3–7 | Scouts/Light troops |
| RNG | Weapon/skill range | 1–6 | Archers/Mages |
| LCK | Tiebreakers/crit factor | 1–20 | Rogues/Leaders |

---

## **7\) Skills: the main “types” you’ll use to build variations**

| Archetype | Summary | AP | Tags | Notes |
| ----- | ----- | ----- | ----- | ----- |
| Strike (ST) | Single-target attack | 1 | Physical/Mag | Baseline; scales with ATK/MAG |
| Barrage (AoE) | Small area | 2–3 | **FF** | Friendly-fire enabled |
| Dash/Gap-close | Move \+ hit | 2 | Mobility, Melee | Can ignore ZoC if stated |
| Disengage | Move w/o AoO | 1 | Mobility | Counter to ZoC traps |
| Guard/Shield | Damage reduction | 1 | Buff | Scales with DEF/RES |
| Inspire (Leader) | Team buff (ATK/AGL) | 2 | Buff | Leader identity |
| Mark/Expose | Debuff (−DEF/−RES/Reveal) | 1 | Debuff, Vision | Anti-cover/stealth |
| Cleanse | Remove negatives | 1 | Support | Counters Hypnotise/CC |
| Control | Stun/Root/Slow/Hypnotise | 2 | Control | Resist via RES/LCK |
| Teleport/Phase | Reposition | 2–3 | Mag, Mobility | LOS/fog limits |
| Terrain Shape | Place cover/hazard | 2–3 | Map, Control | Interior analogs apply |
| Scout’s Eye | Extend vision | 1 | Vision | Fog tool |
| Heal | Restore HP/cleanse | 1–2 | Support | Resource-gated |
| Finisher | Bonus vs low HP | 1 | Execute | Risk/reward window |

---

## **8\) Maps, tiles, biomes (narrative)**

Ranked maps are **24×24** (Standard) and **18×18** (Quick). Seed preview shows biome, size, placement pattern (Clustered/Dispersed/Flanked). **Fog** is **OFF** by default and only enabled if **both players agree**. Chest spawns are symmetric and **match-only** (temporary buffs/consumables; no persistent drops in ranked). Interior biomes (castle halls, ships) map to the same tactical categories as outdoor tiles to keep rules legible across themes.

### **8.1 Tile/biome matrix (core categories)**

| Tile (Outdoor / Interior) | Move Cost | Evasion | Cover | LOS | Height | Specials |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Plains / Hall | 1 | 0 | 0 | Clear | 0 | Baseline |
| Forest / Pillars | 2 (heavy \+1) | \+10% | Half | Blocked | 0 | Dense: penalize ranged |
| Mountain / Balcony | 3 | 0 | Half | Partial | **\+1/+2** | Height aids ranged, melee DEF |
| Water / Gap | Impassable\* | 0 | 0 | Clear | 0 | \*Flyers/Amphibious pass |
| Road / Carpet | 0.5 (min 1\) | 0 | 0 | Clear | 0 | Speed lanes |
| Ruins / Crates | 2 | \+5% | **Full** | Blocked | 0 | Destructibles **OFF** in ranked |
| Rigging / Catwalk | 1–2 | \+5% | Half | Partial | \+1 | Knockback checks (events) |

---

## **9\) Progression, equipment, economy (narrative — unchanged)**

* **Level cap 80**; major spikes at **10/20/40**; **promotions at 20/40**; **3-branch** trees with occasional forks.  
* **Gear**: 4 **flex** slots per unit (normally max **1 weapon & 1 armor**; remaining are accessories; class exceptions like dual-wield).  
* **Consumables**: up to **4** per unit; Mule traits/skills can raise capacity.  
* **Durability**: yes (6–10 matches typical); repair with soft currency; never breaks mid-match.  
* **Economy**: single soft currency; **IAP \= cosmetics/battle pass only**; underdog bonuses; daily/weekly challenges with cosmetics/currency (no power).

---

## **10\) Ranking, modes, integrity (narrative — unchanged)**

* **Ranked 1v1** with **level windowing**; lower-level can challenge up to **\+5**; downward stomps blocked.  
* **Friendly** (no XP) for out-of-window friend matches.  
* **Practice vs AI**: Easy/Normal/Hard/Expert.  
* **MMR/ELO** hidden \+ visible **tiers** (Bronze → Mythic). **10-week seasons** with cosmetic rewards.  
* **Replays** at launch (deterministic); **Spectate** post-launch.

---

## **11\) Backend-only d20 rules engine (invisible to players)**

The following exists **only in the server logic**. No UI strings, numbers, tips, or logs should reference d20, ability scores, DCs, or saves.

**Hidden abilities**: STR, DEX, CON, INT, WIS, CHA (3–18+). **Modifier** \= ⌊(Score − 10\) / 2⌋.  
**Proficiency** scales by level (Lv 1–10: \+2; 11–20: \+3; 21–40: \+4; 41–60: \+5; 61–80: \+6).  
**Visible stats** on the client remain exactly as-is; they’re **derived** internally.

### **11.1 Backend derivation (examples; do not surface)**

* ATK bonuses: STR mod (melee) or DEX mod (ranged) \+ proficiency \+ item/skill adds.  
* DEF value component: Armor tier \+ CON mod.  
* MAG scaling & spell attack: INT mod \+ proficiency.  
* RES mitigation & Will saves: WIS mod \+ RES tier.  
* AGL order & Reflex saves: DEX mod \+ AGL base; tie-break uses LCK.  
* **Crits**: Natural 20 \= crit; threat range extends with **(LCK mod \+ INT mod)** to 19–20, then 18–20 (cap). Natural 1 \= fumble.

### **11.2 Backend resolution (do not surface formulae)**

* **Physical hit**: `(d20 + prof + STR/DEX mod + situational) ≥ DV_Phys`, where `DV_Phys = 10 + Armor + AGL mod + cover + height + buffs`.  
* **Spell hit**: `(d20 + prof + INT mod + situational) ≥ DV_Mag = 10 + RES + WIS mod + cover(if any) + buffs`.  
* **Saves** (for AoE/control incl. **Hypnotise**):  
  * **Save DC** \= `8 + prof + INT mod (+ bonuses)`  
  * **Fortitude** \= `d20 + CON mod + DEF tier`  
  * **Reflex** \= `d20 + AGL mod (+ small LCK mod)`  
  * **Will** \= `d20 + WIS mod + RES tier`  
* **Advantage/Disadvantage**: 2d20 pick high/low (from backstab, height, cover, blind, etc.).  
* **Damage**: weapon/spell dice \+ relevant mod; crit doubles dice (mods once).

**Client contract**: Only show the **same previews** (hit %, damage range, AP costs) we already planned; derive those from backend results without exposing d20 terminology.

---

## **12\) BDD user stories (selected, *math invisibility baked in*)**

Only examples that touched math are shown; the rest of the PRD’s stories stand unchanged.

**F-1 Hit Resolution (Physical)**

* **Given** I target an enemy with a melee or ranged strike  
* **When** the system computes hit and damage  
* **Then** the UI shows the **final hit chance and expected damage** preview, and on resolve the attack either hits (with possible crit) or misses  
  **Acceptance:** No UI references to d20/DC/advantage; backstab/high-ground/cover effects are reflected in previews and outcomes; friendly-fire previews for AoE remain.

**F-6 Status: Hypnotise**

* **Given** I cast Hypnotise  
* **When** the system resolves the effect  
* **Then** the target either **resists** or becomes **controlled by the enemy for X turns**  
  **Acceptance:** UI never mentions Will/Save/DC; only shows “Resisted” or applied duration; Cleanse/immunity tags work as specified.

**E-3 Terrain rules**

* **Given** I move/attack through/into Forest, Mountain, Water, Road, Cover, or interior analogs  
* **When** the system previews outcome  
* **Then** the preview reflects hit/evasion/crit modifiers, movement costs, and LOS without exposing backend math  
  **Acceptance:** Tooltips explain effects in plain language; no d20 terms.

---

## **13\) Quick matrices (unchanged but consolidated)**

### **13.1 Equipment tiers (sidegrades)**

| Tier | Example Effect | Gate |
| ----- | ----- | ----- |
| Common | \+5 ATK or \+5 DEF | None |
| Rare | −1 AP on 1 skill (cooldown \+1) | Class gate |
| Epic | Small aura/conditional proc | Mastery Lv X |
| Legendary | Cosmetic VFX \+ sidegrade | Mastery Lv Y \+ faction |

### **13.2 Leader morale effects**

| Trigger | Effect | Duration |
| ----- | ----- | ----- |
| Leader KO | −10% ATK/AGL teamwide | 2 turns |
| Leader Inspire (skill) | \+10% AGL (non-stack) | 1 turn (2 AP) |

### **13.3 AI practice bands**

| Band | Behavior |
| ----- | ----- |
| Easy | Greedy damage; ignores LOS/ZoC |
| Normal | Basic terrain use; avoids AoO |
| Hard | Focus fire; backstabs |
| Expert | AP baiting; height/fog control; chest denial |

---

## **14\) Non-functional requirements**

60 FPS on mid PCs; pathfinding ≤100 ms p95; deterministic replays; GDPR/CCPA compliant telemetry opt-out; region autoscaling.

---

## **15\) Roadmap (post-launch)**

Spectate → Guilds → 2v2 → seasonal alt objectives → creator program (map editor) → mobile feasibility → rental (ERC-4907, with ranked restrictions).