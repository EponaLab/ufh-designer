# UFH Designer - Complete Feature Documentation

Version: 1.1.0  
Last Updated: 2024-10-31

## Table of Contents
1. [Drawing & Editing](#drawing--editing)
2. [Navigation](#navigation)
3. [Materials & Configuration](#materials--configuration)
4. [Heat Loss Calculations](#heat-loss-calculations)
5. [UFH System Performance](#ufh-system-performance)
6. [User Interface](#user-interface)
7. [Technical Implementation](#technical-implementation)

---

## Drawing & Editing

### Wall Drawing

**Desktop (Mouse):**
- Select Wall tool from toolbar
- Click to place start point
- Click to place end point
- Wall is created and snapped to grid
- Status bar shows "Click to place wall start point"

**Mobile/Tablet (Touch):**
- Select Wall tool from toolbar
- Touch and hold to place start point
- Drag finger to desired end point
- Release to complete wall
- Preview wall appears in semi-transparent blue while dragging
- Dimension annotation shows length in real-time
- Minimum wall length: 10 pixels (prevents accidental tiny walls)

**Behavior:**
- All walls snap to configurable grid (default 0.5m)
- Walls drawn at any zoom level appear at correct position
- Preview uses same coordinate system as final wall
- Each wall has unique ID (timestamp-based)

### Wall Editing

**Draggable Handles:**
- Handles appear at all wall endpoints when in Select mode
- **Visual distinction:**
  - Blue circles (8px): Nodes (2+ walls connected)
  - Gray circles (6px): Free endpoints
  
**Handle Dragging:**
- Click/touch and drag any handle to reposition
- Connected walls (nodes) move together as a unit
- Windows on affected walls maintain relative position (ratio 0-1 along wall)
- Cursor changes to "grab" when hovering over handles
- 30px hit radius for touch-friendly interaction

**Smart Snapping:**
- Endpoints within 20px automatically snap together
- Creates nodes when walls connect
- Snap tolerance configurable via `this.snapTolerance`

### Window Placement

**Adding Windows:**
- Select Window tool from toolbar
- Click on any wall to place window
- Default dimensions:
  - Width: 1.2m
  - Height: 1.5m (height not shown in top-down view)
  - U-value: 1.1 W/m²K (triple glazing)

**Window Display (Top-Down View):**
- Window appears as opening in wall
- Width shown perpendicular to wall direction
- Thickness: 15px (fixed visual representation)
- Light blue fill (#93c5fd) with darker blue frame (#2563eb)
- Two horizontal lines indicate glass panes
- Rotated to align with wall angle

**Window Positioning:**
- Position stored as ratio (0-1) along wall length
- Automatically constrained to stay within wall boundaries
- Minimum distance from wall edges = half window width
- When wall is resized/moved, windows maintain ratio position

**Window Dragging:**
- Select tool, click/touch and drag window
- Window slides along its wall (constrained to wall line)
- Cursor changes to "move" when hovering over windows
- Position projected onto wall line (can't drag perpendicular)
- Real-time constraint checking prevents exceeding wall bounds

**Window Dimensions:**
- Two dimension lines show distances from window edges to wall endpoints
- Measured from window start edge to wall start
- Measured from window end edge to wall end
- Displayed on opposite side from wall dimensions (no overlap)
- Gray color (#94a3b8), smaller arrows (6px vs 8px)
- Dashed extension lines for visual distinction
- Dimensions always positive (Math.abs applied)
- Hidden if < 0.01m to prevent clutter

### Element Selection

**Selection:**
- Select tool active by default
- Click/touch any element to select
- Orange dashed outline (#f59e0b) highlights selected element
- Properties panel shows element properties

**Deletion:**
- Select Delete tool
- Click/touch element to delete
- Deleting wall also removes all windows on that wall
- No confirmation dialog (immediate deletion)

---

## Navigation

### Pan

**Desktop:**
- Select Pan tool and drag with left mouse button
- Hold middle mouse button (any tool) and drag
- Cursor changes to "grabbing" while panning

**Mobile/Tablet:**
- Two-finger drag works in **any tool mode** (no need to select Pan tool)
- Or select Pan tool and drag with one finger
- Smooth, responsive panning

**Implementation:**
- Pan offset stored as `{x, y}` in pixels
- Applied via canvas translation before zoom
- Affects all drawing operations uniformly

### Zoom

**Desktop:**
- Scroll mouse wheel: up = zoom in, down = zoom out
- Zoom centers on cursor position
- Point under cursor remains fixed during zoom

**Mobile/Tablet:**
- Pinch gesture: fingers apart = zoom in, closer = zoom out
- Works in **any tool mode** globally
- Zoom centers on pinch midpoint
- Two-finger gestures prioritized over single-touch drawing

**Zoom Range:**
- Minimum: 10% (0.1x)
- Maximum: 500% (5.0x)
- Zoom indicator shows current level in bottom-right corner

**Implementation:**
- Zoom stored as scalar multiplier (`this.zoom`)
- Applied via canvas scale transformation
- Coordinate conversion: `world = (screen - panOffset) / zoom`
- Maintains correct transformations for all drawing operations

### Grid System

**Grid Display:**
- Light gray lines (#e2e8f0)
- Spacing matches user-configured grid size (default 0.5m)
- Scales with zoom level
- Always visible as reference

**Snapping:**
- All wall endpoints snap to grid
- Snap applies after coordinate transformation (world space)
- Formula: `Math.round(coord / gridSize) * gridSize`

---

## Materials & Configuration

### Wall Materials

Each wall can be assigned a material with thermal properties:

| Material | Description | U-value (W/m²K) |
|----------|-------------|-----------------|
| Brick | Brick Wall (0.3m) | 0.5 |
| Concrete | Concrete (0.2m) | 0.8 |
| Lightweight | Lightweight Block | 0.3 |
| Insulated | Insulated Wall | 0.2 |

### Wall Boundary Conditions

Each wall has an "outer face facing" property:

- **Outdoor**: Wall faces external environment (uses outdoor temperature)
- **Unheated Space**: Faces garage, basement, etc. (assumed at midpoint between indoor and outdoor)
- **Indoor Heated Space**: Faces another heated room (no heat loss)

**Visual Coding:**
- Outdoor: Dark gray (#475569)
- Unheated: Medium gray (#94a3b8)
- Indoor: Light gray (#cbd5e1)

### Floor Materials

| Material | Description | U-value | Thermal Resistance (m²K/W) |
|----------|-------------|---------|---------------------------|
| Concrete | Concrete Slab | 0.7 | 0.05 |
| Tile | Ceramic/Stone Tile | 0.8 | 0.01 |
| Wood | Wood Flooring | 0.5 | 0.10 |
| Carpet | Carpet | 0.3 | 0.15 |

**Thermal Resistance Impact:**
- Tile: Best UFH performance (minimal resistance)
- Wood: ~30% reduction in UFH output
- Carpet: ~50% reduction in UFH output

### Floor Boundary Conditions

- **Ground**: Below ground floor (ground temp = outdoor + 5°C)
- **Heated Space**: Above another heated room (no heat loss)
- **Unheated Space**: Above unheated basement/garage

### Ceiling Materials

| Material | U-value (W/m²K) |
|----------|-----------------|
| Concrete | 0.7 |
| Plaster | 0.6 |
| Wood | 0.4 |

### Ceiling Boundary Conditions

- **Outdoor**: Roof with outdoor exposure
- **Heated Space**: Below another heated floor
- **Unheated Space**: Below unheated attic

### UFH System Parameters

**Pipe Spacing:**
- 100mm: High output (×1.25 factor)
- 150mm: Standard (×1.0 baseline)
- 200mm: Medium (×0.85 factor)
- 300mm: Low output (×0.65 factor)

**Water Temperatures:**
- Supply: 30-55°C (default 40°C)
- Return: 25-50°C (default 35°C)
- Validation: Supply > Return > Indoor temp

---

## Heat Loss Calculations

### Calculation Method: EN 12831 (Simplified)

Steady-state heat loss calculation for each building element.

### Formula

```
Q = U × A × ΔT
```

Where:
- Q = Heat loss (W)
- U = Thermal transmittance (W/m²K)
- A = Area (m²)
- ΔT = Temperature difference (°C or K)

### Wall Heat Loss

1. Calculate gross wall area: `length × room_height`
2. Subtract window areas on that wall
3. Get net area
4. Calculate ΔT based on boundary condition:
   - Outdoor: `indoor_temp - outdoor_temp`
   - Unheated: `indoor_temp - (indoor_temp + outdoor_temp)/2`
   - Indoor: `0` (no heat loss)
5. Heat loss: `net_area × U_wall × ΔT`

### Window Heat Loss

- Windows always face outdoor (assumption)
- Area: `width × height`
- ΔT: `indoor_temp - outdoor_temp`
- Heat loss: `area × U_window × ΔT`

### Floor Heat Loss

- Area: Calculated from room polygon
- ΔT depends on below-floor condition:
  - Ground: `indoor_temp - (outdoor_temp + 5°C)`
  - Heated: `0`
  - Unheated: `indoor_temp - (indoor_temp + outdoor_temp)/2`
- Heat loss: `floor_area × U_floor × ΔT`

### Ceiling Heat Loss

- Area: Same as floor area
- ΔT depends on above-ceiling condition:
  - Outdoor: `indoor_temp - outdoor_temp`
  - Heated: `0`
  - Unheated: `indoor_temp - (indoor_temp + outdoor_temp)/2`
- Heat loss: `ceiling_area × U_ceiling × ΔT`

### Floor Area Calculation

**Polygon Detection:**
1. Start from first wall
2. Trace connected walls (endpoints within snap tolerance)
3. Build polygon by following wall chain
4. Detect closure when returning to starting point within tolerance
5. Remove duplicate closing point

**Area Formula (Shoelace/Surveyor's):**
```
Area = ½ |Σ(x_i × y_{i+1} - x_{i+1} × y_i)|
```

**Fallback:**
- If polygon can't be formed: Use bounding box
- Bounding box = max dimensions of all wall extents

**Visual Feedback:**
- Polygon area shown only when valid (≥3 points, area ≥ 0.5 m²)
- Semi-transparent blue fill (15% opacity)
- Dashed blue border (40% opacity)
- Area label at polygon centroid

---

## UFH System Performance

### Thermodynamic Model

**Achievable Heat Flux:**
```
q = (T_water_mean - T_indoor) / R_total × spacing_factor
```

**Components:**

1. **Mean Water Temperature:**
   ```
   T_mean = (T_supply + T_return) / 2
   ```

2. **Total Thermal Resistance:**
   ```
   R_total = R_floor_covering + R_screed + R_surface
   ```
   
   - R_floor_covering: Material-dependent (0.01-0.15 m²K/W)
   - R_screed: 0.045 m²K/W (65mm screed above pipes)
   - R_surface: 0.093 m²K/W (convection + radiation ≈ 10.8 W/m²K)

3. **Pipe Spacing Factor:**
   - Accounts for reduced/increased pipe density
   - Applied as multiplier to base heat flux

### Floor Surface Temperature

```
T_surface = T_indoor + q × (R_floor_covering + R_surface)
```

**EN 1264-3 Compliance:**
- Maximum floor surface temperature: 29°C (occupied areas)
- Maximum: 33°C (bathrooms)
- Maximum: 35°C (perimeter zones)
- Current implementation enforces 29°C limit

### System Validation

**Success Criteria:**
1. Achievable heat flux ≥ Required heat flux
2. Floor surface temperature ≤ 29°C

**Failure Modes:**
- **Insufficient capacity**: Achievable < Required
  - Shows deficit (W/m²)
  - Calculates required water temperature
  - Suggests pipe spacing reduction
  - Suggests insulation improvements
  
- **Excessive floor temperature**: Surface temp > 29°C
  - Warning per EN 1264-3
  - Suggests reducing water temperature
  - Suggests improving building insulation

### Required Water Temperature Calculation

When system is insufficient, calculate water temp needed:

```
q_required = ΔT_required / R_total × spacing_factor
ΔT_required = q_required × R_total / spacing_factor
T_water_mean_required = T_indoor + ΔT_required
T_supply_required = T_water_mean_required + 2.5°C  (assuming 5°C drop)
```

---

## User Interface

### Header
- Application title: "UFH Designer"
- Fire icon (Font Awesome)
- Version number (e.g., "v1.1.0") in gray
- New Project button (resets application)

### Toolbar (Left Panel, 240px)

**Tools Section:**
- Select (mouse pointer icon) - default
- Wall (horizontal lines icon)
- Window (border icon)
- Pan (hand icon)
- Delete (trash icon)

**Parameters Section:**
- Indoor Temperature (°C): default 20, step 0.5
- Outdoor Temperature (°C): default -10, step 0.5
- Room Height (m): default 2.7, step 0.1, min 2
- Grid Size (m): default 0.5, step 0.1, min 0.1

**Actions:**
- Calculate button (primary blue)

### Canvas (Center, Flexible)

**Elements:**
- Grid background
- Walls (colored by boundary condition)
- Wall dimensions (CAD-style annotations)
- Windows (top-down view)
- Window dimensions (from edges to wall ends)
- Handles (when in Select mode)
- Floor area highlight (when closed polygon)
- Preview wall (when drawing)

**Info Bar (Bottom):**
- Cursor position (world coordinates in meters)
- Status message (context-sensitive instructions)

**Zoom Indicator:**
- Bottom-right corner
- Shows percentage (e.g., "150%")
- Not affected by canvas transformations

### Properties Panel (Right, 320px)

**Empty State:**
- Hand pointer icon
- "Select an element to view properties"

**Wall Properties:**
- Material dropdown (4 options)
- Outer Face Facing dropdown (3 options)
- Length display (read-only, meters)

**Window Properties:**
- Width (m): step 0.1, min 0.5
- Height (m): step 0.1, min 0.5
- U-Value (W/m²K): step 0.1, min 0.5
- Area display (calculated, read-only)

**Floor Configuration:**
- Floor Material dropdown (4 options)
- Below Floor dropdown (3 options)
- UFH System subsection:
  - Pipe Spacing dropdown (4 options)
  - Supply Temperature (°C): step 1, min 30, max 55
  - Return Temperature (°C): step 1, min 25, max 50

**Ceiling Configuration:**
- Ceiling Material dropdown (3 options)
- Above Ceiling dropdown (3 options)

**Results Section (shown after Calculate):**
- Total Heat Loss (kW and W)
- UFH Required (W/m² and kW total)
- Floor Surface Temperature (°C)
- Validation Status (color-coded box):
  - Success: Green with checkmark
  - Error: Red with X
  - Detailed message with system status
  - Recommendations when insufficient
- Breakdown section (collapsible list):
  - Each surface listed separately
  - Shows: name, heat loss (W), area, U-value, ΔT

### Visual Styling

**Color Palette:**
- Primary: #2563eb (blue)
- Success: #10b981 (green)
- Warning: #f59e0b (orange)
- Danger: #ef4444 (red)
- Background: #f8fafc (light gray)
- Text: #0f172a (dark)
- Text Secondary: #64748b (gray)

**Typography:**
- Font: Inter, system fonts fallback
- Headers: 600 weight
- Body: 400 weight
- Sizes: 0.75rem - 1.25rem

---

## Technical Implementation

### Architecture

**Class Structure:**
```javascript
class UFHDesigner {
    constructor()
    init()
    
    // Drawing methods
    draw()
    drawGrid()
    drawWall()
    drawWindow()
    drawWindowDimensions()
    drawDimension()
    drawHandles()
    drawFloorArea()
    drawZoomIndicator()
    
    // Event handlers
    handleMouseDown/Move/Up()
    handleTouchStart/Move/End()
    handleWheel()
    handleClick()
    
    // Coordinate transformations
    getMousePos()
    getTouchPos()
    getScreenPos()
    snapToGrid()
    pixelsToMeters()
    metersToPixels()
    
    // Geometry
    projectPointOntoLine()
    pointToLineDistance()
    getWallLength()
    getPositionRatioOnWall()
    constrainWindowPosition()
    findElementAt()
    findWallAt()
    findHandleAt()
    
    // Calculations
    calculate()
    calculateFloorArea()
    calculateUFHPerformance()
    calculateRequiredWaterTemp()
    buildPolygonFromWalls()
    
    // UI
    showProperties()
    showEmptyProperties()
    updateStatus()
    displayResults()
}
```

### State Management

**Drawing State:**
```javascript
this.currentTool = 'select'|'wall'|'window'|'pan'|'delete'
this.walls = []  // Array of wall objects
this.windows = []  // Array of window objects
this.selectedElement = null  // Currently selected element
this.drawingWall = null  // { x1, y1 } during wall drawing
this.previewEndPoint = null  // { x, y } for preview
this.draggingHandle = null  // Handle being dragged
this.draggingWindow = null  // Window being dragged
```

**Navigation State:**
```javascript
this.panOffset = { x: 100, y: 100 }  // Pan in screen pixels
this.zoom = 1.0  // Scale factor
this.isPanning = false  // Pan mode active
this.lastPanPoint = null  // { x, y } for pan delta
```

**Touch State:**
```javascript
this.touchState = {
    touches: [],  // [{x, y}, {x, y}] for two-finger gestures
    lastDistance: 0  // Previous pinch distance
}
```

### Data Structures

**Wall Object:**
```javascript
{
    id: timestamp,
    type: 'wall',
    x1: number,  // Start X in world coordinates
    y1: number,  // Start Y in world coordinates
    x2: number,  // End X in world coordinates
    y2: number,  // End Y in world coordinates
    material: 'brick'|'concrete'|'lightweight'|'insulated',
    facing: 'outdoor'|'unheated'|'indoor'
}
```

**Window Object:**
```javascript
{
    id: timestamp,
    type: 'window',
    wallId: number,  // Parent wall ID
    x: number,  // Center X in world coordinates
    y: number,  // Center Y in world coordinates
    width: number,  // Width in meters
    height: number,  // Height in meters (for calculations only)
    uValue: number,  // W/m²K
    positionRatio: number  // 0-1 position along wall
}
```

### Canvas Rendering Pipeline

1. **Clear canvas** (white background)
2. **Save context** and apply transformations:
   - Translate by panOffset
   - Scale by zoom
3. **Draw in world coordinates:**
   - Grid
   - Walls
   - Preview wall (if drawing)
   - Wall dimensions
   - Windows
   - Window dimensions
   - Handles (if Select mode)
   - Floor area (if valid polygon)
4. **Restore context**
5. **Draw UI overlay** (zoom indicator, not transformed)

### Coordinate Systems

**Screen Space:**
- Canvas pixel coordinates
- Origin: top-left corner
- Used for: mouse events, pan offset, zoom indicator

**World Space:**
- Logical drawing coordinates
- Origin: determined by pan offset
- Units: pixels (converted to/from meters for display)
- Used for: all geometric elements, calculations

**Conversion:**
```javascript
// Screen → World
world.x = (screen.x - panOffset.x) / zoom
world.y = (screen.y - panOffset.y) / zoom

// World → Screen
screen.x = world.x * zoom + panOffset.x
screen.y = world.y * zoom + panOffset.y
```

### Performance Optimizations

- Canvas redraws only on state changes (not continuous)
- Grid drawn with simple line primitives
- Polygon area cached per calculation
- Touch gesture state minimizes recalculations
- Snap tolerance prevents excessive updates

### Browser Compatibility

- Modern browsers with Canvas API
- Touch Events API for mobile
- Wheel Event for zoom
- ES6+ JavaScript features
- Font Awesome 6.4.0 CDN
- No external JavaScript libraries (vanilla JS)

---

## Version History

### v1.1.0 (Current)
- Thermodynamic UFH system modeling
- Water temperature inputs
- Pipe spacing selection
- Floor surface temperature calculation
- EN 1264-3 compliance checking
- Required water temperature calculation

### v1.0.2
- Fixed floor area polygon detection
- Improved closure logic
- Increased highlight visibility

### v1.0.1
- Fixed wall preview positioning at zoom levels
- Added preview endpoint state management

### v1.0.0
- Initial release with basic features
