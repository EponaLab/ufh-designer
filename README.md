# Underfloor Heating Designer

A browser-based application for designing and verifying underfloor heating (UFH) systems with heat loss calculations based on EN 12831 principles and thermodynamic UFH modeling.

**Version:** 1.1.0

**Live App:** https://eponalab.github.io/ufh-designer/

## 📚 Documentation

- **[FEATURES.md](FEATURES.md)** - Complete feature documentation and technical implementation details
- **[TESTS.md](TESTS.md)** - Comprehensive test specifications with calculation validation
- **[README.md](README.md)** - This file (quick start and overview)

## Features

### Drawing & Design
- 2D snap-to-grid canvas for drawing room perimeter
- **Pan and zoom controls:**
  - Mouse wheel or pinch gesture to zoom in/out (10% - 500%)
  - **Two-finger pan/zoom works globally** - no need to switch tools
  - Pan tool or middle mouse button to pan (desktop)
  - Zoom indicator shows current zoom level
- **Touch-optimized wall drawing** - touch and drag to draw (release to finish)
- **Mouse support** - click start/end points for desktop users
- Wall drawing tool with material selection
- **Real-time visual preview** with semi-transparent wall while drawing
- **Live dimension updates** - measurements shown and updated continuously during drawing
- **CAD-style dimension annotations** showing wall lengths in meters
- **Closed polygon detection** - floor area shown only when walls form complete loop
- **Visual floor area highlight** - semi-transparent blue fill with area label
- **Draggable handles** at wall endpoints for easy editing
- **Smart node connection** - walls sharing endpoints move together
- **Draggable windows** - click and drag to reposition windows along their wall
- **Window position dimensions** - shows distance from both wall endpoints
- Window placement with customizable dimensions and U-values
- Interactive element selection and editing
- Delete tool for removing elements
- Visual distinction between nodes (blue) and free endpoints (gray)
- Dimension lines with arrows and text labels auto-rotate for readability

### Floor Area Calculation
- **Automatic polygon detection** - traces connected walls to form enclosed space
- **Closed polygon highlighting** - semi-transparent blue fill indicates valid closed room
- **Shoelace formula** for accurate area calculation of complex polygons
- Floor area only displayed when walls form a complete closed loop
- Real-time area updates when dragging wall handles
- Visual feedback: polygon fill + area label at center

### Materials & Configuration
- Wall materials: Brick, Concrete, Lightweight Block, Insulated Wall
- Floor materials: Concrete Slab, Tile, Wood Flooring
- Ceiling materials: Concrete, Plaster, Wood
- Boundary conditions:
  - Outdoor facing (external walls)
  - Unheated space (e.g., garages, basements)
  - Indoor heated space (internal walls)

### Heat Loss Calculations
- EN 12831-based steady-state heat loss calculation
- Individual surface breakdown (walls, windows, floor, ceiling)
- Temperature differentials for each boundary type
- Unheated spaces assumed at midpoint between indoor and outdoor temps
- Ground temperature compensation for floors

### UFH System Validation
- **Thermodynamic calculation** based on water temperatures and floor construction
- **Pipe spacing selection**: 100mm / 150mm / 200mm / 300mm with appropriate output factors
- **Water temperature inputs**: Supply and return temperatures
- Calculated achievable heat flux considering:
  - Mean water temperature ((supply + return) / 2)
  - Floor covering thermal resistance (tile ~0.01, wood ~0.10, carpet ~0.15 m²K/W)
  - Screed thermal resistance (~0.045 m²K/W for 65mm)
  - Surface heat transfer coefficient (~10.8 W/m²K)
  - Pipe spacing adjustment factors
- **Floor surface temperature** calculation and EN 1264 compliance check (max 29°C)
- Color-coded validation status:
  - ✅ Green: System adequate, floor temp OK
  - ❌ Red: Insufficient capacity OR floor temp exceeds limits
- **Actionable recommendations** when system insufficient:
  - Required water temperature to meet load
  - Pipe spacing reduction options
  - Insulation improvement suggestions

### Results Display
- Total heat loss (kW/W)
- Required UFH power density (W/m²)
- Floor surface temperature estimate
- Detailed breakdown per surface:
  - Area (m²)
  - U-value (W/m²K)
  - Temperature differential (°C)
  - Heat loss (W)

## How to Use

### 1. Set Parameters
- **Indoor Temperature**: Desired room temperature (default: 20°C)
- **Outdoor Temperature**: Design outdoor temperature (default: -10°C)
- **Room Height**: Ceiling height in meters (default: 2.7m)
- **Grid Size**: Drawing grid spacing (default: 0.5m)

### 2. Navigate the Canvas

**Zoom:**
- Desktop: Scroll mouse wheel up/down
- Mobile/Tablet: Pinch gesture (two fingers closer/apart)
- Range: 10% to 500%
- Zoom indicator shows current level in bottom-right

**Pan:**
- Desktop: Select Pan tool and drag, or hold middle mouse button
- Mobile/Tablet: Two-finger drag (works in any tool mode), or select Pan tool and drag with one finger
- Tip: Pan to view different areas of large designs
- Two-finger gestures work globally - no need to switch to Pan tool

### 3. Draw the Room

**Touch Devices (Mobile/Tablet):**
- Select the **Wall** tool
- Touch and hold on the canvas to start a wall
- Drag your finger to the desired end point
- Release to complete the wall
- Dimension updates continuously as you drag
- Repeat to create room perimeter

**Mouse/Desktop:**
- Select the **Wall** tool
- Click to place wall start point
- Click again to place wall end point
- Repeat to create room perimeter

**Tips:**
- Walls snap to the grid automatically
- Walls that connect at endpoints will snap together
- Dimensions shown in real-time with CAD-style annotations
- **Floor area** is automatically calculated and displayed at room center

### 4. Edit the Layout
- Use **Select** tool to enter edit mode
- **Draggable handles** appear at wall endpoints
- Click and drag handles to adjust wall positions
- **Connected walls** (nodes) move together when you drag their shared endpoint
- Blue handles = nodes (2+ walls connected)
- Gray handles = free endpoints

### 5. Configure Walls
- Use **Select** tool to click on a wall
- In the properties panel:
  - Choose wall material
  - Set what the outer face is facing (outdoor/unheated/indoor)

### 6. Add Windows
- Select the **Window** tool
- Click on a wall to place a window
- Use **Select** tool to edit window properties:
  - Width and height (meters)
  - U-value (W/m²K) - default 1.1 for triple glazing
- **Drag windows** along the wall to reposition
- **Distance dimensions** shown from both wall ends (measured from window edges)
- Windows automatically constrained to stay within wall boundaries
- Dimensions are always positive and never negative

### 7. Configure Floor & Ceiling
- In the right panel, set:
  - **Floor Material** (affects UFH performance significantly):
    - Tile: Best heat transfer (~0.01 m²K/W)
    - Wood: Moderate (~0.10 m²K/W, reduces output ~30%)
    - Carpet: Poor (~0.15 m²K/W, reduces output ~50%)
  - What's below floor (ground/heated/unheated)
  - **UFH System Parameters:**
    - Pipe spacing: 100/150/200/300mm (closer = higher output)
    - Supply temperature: typically 35-45°C
    - Return temperature: typically 5-10°C below supply
  - **Ceiling Material** and what's above (heated/unheated/outdoor)

### 8. Calculate
- Click **Calculate** button
- Review results:
  - Total heat loss
  - Required UFH power
  - Floor temperature
  - Validation status
  - Detailed breakdown

## Technical Details

### Wall Connection & Editing
- Walls within 20px of each other snap together at endpoints
- Shared endpoints (nodes) are detected automatically
- Dragging a node updates all connected walls simultaneously
- Windows maintain relative position on walls during editing (stored as ratio 0-1)

### Floor Area Calculation
The app attempts to build a closed polygon from the walls by:
1. Starting with the first wall
2. Finding connected walls (endpoints within snap tolerance)
3. Tracing the perimeter until returning to start

Once a polygon is formed, it uses the **Shoelace formula** (surveyor's formula):
```
Area = ½ |Σ(x_i × y_{i+1} - x_{i+1} × y_i)|
```

If walls don't form a closed loop, falls back to bounding box calculation.

### UFH System Performance

The app calculates achievable heat flux based on:

```
q = (T_water_mean - T_room) / R_total × spacing_factor
```

Where:
- **T_water_mean** = (supply + return) / 2
- **R_total** = R_floor_covering + R_screed + R_surface
  - Floor covering: 0.01-0.15 m²K/W (depends on material)
  - Screed: 0.045 m²K/W (typical 65mm above pipes)
  - Surface: 0.093 m²K/W (convection + radiation, ~10.8 W/m²K)
- **spacing_factor** = Adjustment for pipe spacing
  - 100mm: ×1.25 (25% more output)
  - 150mm: ×1.0 (baseline)
  - 200mm: ×0.85 (15% less)
  - 300mm: ×0.65 (35% less)

**Floor Surface Temperature:**
```
T_surface = T_room + q × (R_floor + R_surface)
```

Must not exceed 29°C per EN 1264-3 for occupied areas.

**Typical Outputs:**
- Tile, 40°C mean water, 150mm: ~80-100 W/m²
- Wood, 40°C mean water, 150mm: ~60-70 W/m²
- Carpet, 40°C mean water, 150mm: ~40-50 W/m²

### Calculation Method
Based on EN 12831 (European heating system standard):

**Heat Loss Formula:**
```
Q = U × A × ΔT
```

Where:
- Q = Heat loss (W)
- U = Thermal transmittance (W/m²K)
- A = Area (m²)
- ΔT = Temperature difference (K or °C)

### Temperature Assumptions
- **Heated spaces**: Constant at indoor temperature
- **Unheated spaces**: Midpoint between indoor and outdoor
- **Ground**: Outdoor temperature + 5°C (simplified)

### U-Values (W/m²K)
**Walls:**
- Brick Wall (0.3m): 0.5
- Concrete (0.2m): 0.8
- Lightweight Block: 0.3
- Insulated Wall: 0.2

**Floors:**
- Concrete Slab: 0.7
- Tile on Concrete: 0.8
- Wood Flooring: 0.5

**Ceilings:**
- Concrete: 0.7
- Plaster on Concrete: 0.6
- Wood: 0.4

**Windows:**
- User-defined (typical: 1.1 for triple glazing, 1.4 for double)

### UFH Floor Temperature
Simplified calculation assuming convective + radiative heat transfer:
```
T_floor = T_indoor + (q_UFH / (h_combined + U_floor))
```

Where h_combined ≈ 8.3 W/m²K (convection + radiation)

## Limitations (MVP)

- Single room/zone only
- Simplified floor area calculation (bounding box)
- No infiltration/ventilation heat loss
- No thermal bridges consideration
- Steady-state calculation only (no dynamic behavior)
- Simplified ground/unheated space temperature assumptions

## 📖 Complete Documentation

For in-depth information:

### FEATURES.md - Complete Technical Documentation
Comprehensive documentation covering:
- Drawing & editing system (walls, windows, handles)
- Navigation (pan, zoom, coordinate systems)
- Materials & configuration (all properties and boundary conditions)
- Heat loss calculations (EN 12831 formulas and methodology)
- UFH system performance (thermodynamic modeling)
- User interface (all controls and panels)
- Technical implementation (architecture, data structures, rendering pipeline)
- Version history

**Read:** [FEATURES.md](FEATURES.md)

### TESTS.md - Test Specifications & Validation
Complete test suite with:
- Unit tests for all calculation functions
- Expected inputs and outputs with tolerances
- Integration tests for complete flows
- End-to-end test scenarios
- Edge cases and error handling
- Regression test checklist
- Example test data sets
- Automated test structure (Jest)

**Read:** [TESTS.md](TESTS.md)

### Calculation Validation

All formulas have been documented with:
- Step-by-step calculations
- Expected results
- Tolerance ranges (±0.5% for unit tests, ±1% for integration)
- Real-world example scenarios

To verify calculations, run the test cases in TESTS.md against the live application.

## Browser Compatibility

- Modern browsers with HTML5 Canvas support
- Tested on Chrome, Firefox, Safari, Edge
- Requires JavaScript enabled

## Development

The app is a React + TypeScript project built with Vite.

```bash
npm install
npm run dev        # start dev server
npm run typecheck  # TypeScript check
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Deployment to GitHub Pages runs from `.github/workflows/deploy.yml` on every push to `main`
(Pages source must be set to "GitHub Actions" in the repository settings).

### Project structure

```
src/
  main.tsx                 # entry point, global CSS imports
  App.tsx                  # top-level state and layout
  types.ts                 # domain types (Room, Tool, Viewport, ...)
  constants.ts             # materials, UFH systems, defaults, select options
  lib/geometry.ts          # coordinate transforms, snapping, zoom, wall derivation
  lib/heatLoss.ts          # heat-loss + UFH performance calculations (pure)
  lib/renderer.ts          # canvas drawing (pure function of the scene)
  state/projectReducer.ts  # rooms / selection reducer
  hooks/useWindowWidth.ts
  components/              # Header, Toolbar, DrawingCanvas, ContextualToolbar,
                           # SettingsPanel, ResultsPanel, form fields
  styles/app.css           # single stylesheet (zinc/monochrome tokens, floating panels)
```

## Files

- `index.html` - HTML shell (mounts the React app)
- `src/` - Application source (see Project structure above)
- `app-v1.js` - Legacy wall-based version (unused, kept for reference)
- `FEATURES.md` - Complete feature documentation
- `TESTS.md` - Test specifications and validation
- `README.md` - This file

## Version

**Current:** v1.1.0  
**Major Features:** Thermodynamic UFH modeling, water temperature control, pipe spacing selection, EN 1264 compliance

## License

MIT License - Free to use and modify

