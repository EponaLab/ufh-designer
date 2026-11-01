// UFH Designer Application
class UFHDesigner {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Drawing state
        this.currentTool = 'select';
        this.walls = [];
        this.windows = [];
        this.selectedElement = null;
        this.drawingWall = null;
        this.previewEndPoint = null; // For wall drawing preview
        this.draggingHandle = null; // { wallIds: [...], point: 'start'|'end', x, y }
        this.draggingWindow = null; // { window, wallId }
        this.gridSize = 0.5; // meters
        this.scale = 50; // pixels per meter
        this.snapTolerance = 20; // pixels - distance to snap endpoints together
        
        // Pan and zoom state
        this.panOffset = { x: 100, y: 100 }; // Start with some offset
        this.zoom = 1.0;
        this.minZoom = 0.1;
        this.maxZoom = 5.0;
        this.isPanning = false;
        this.lastPanPoint = null;
        this.touchState = { touches: [], lastDistance: 0 };
        
        // Material properties (U-values in W/m²K)
        this.materials = {
            walls: {
                brick: { name: 'Brick Wall (0.3m)', u: 0.5 },
                concrete: { name: 'Concrete (0.2m)', u: 0.8 },
                lightweight: { name: 'Lightweight Block', u: 0.3 },
                insulated: { name: 'Insulated Wall', u: 0.2 }
            },
            floors: {
                concrete: { name: 'Concrete Slab', u: 0.7, resistance: 0.05 },
                tile: { name: 'Tile on Concrete', u: 0.8, resistance: 0.01 },
                wood: { name: 'Wood Flooring', u: 0.5, resistance: 0.10 },
                carpet: { name: 'Carpet', u: 0.3, resistance: 0.15 }
            },
            ceilings: {
                concrete: { name: 'Concrete', u: 0.7 },
                plaster: { name: 'Plaster on Concrete', u: 0.6 },
                wood: { name: 'Wood', u: 0.4 }
            }
        };
        
        // UFH pipe spacing heat output factors (relative to 150mm baseline)
        this.pipeSpacingFactors = {
            100: 1.25,  // +25% output
            150: 1.0,   // baseline
            200: 0.85,  // -15% output
            300: 0.65   // -35% output
        };
        
        // UFH installation system properties
        this.ufhSystems = {
            'wet': {
                name: 'Wet System (Screed/Concrete)',
                resistanceAbovePipes: 0.045,  // 65mm screed
                downwardLossFactor: 0.05,     // Minimal downward loss (well insulated below)
                spacingEffectiveness: 1.0     // Full pipe spacing effect
            },
            'overlay-aluminum': {
                name: 'Overlay - Aluminum Spreader Plates',
                resistanceAbovePipes: 0.012,  // Thin aluminum + panel
                downwardLossFactor: 0.25,     // 25% base downward loss (before insulation)
                spacingEffectiveness: 0.90    // Slightly reduced due to lateral spread
            },
            'overlay-grooved': {
                name: 'Overlay - Grooved Panels',
                resistanceAbovePipes: 0.018,  // Grooved panel without aluminum
                downwardLossFactor: 0.30,     // 30% base downward loss
                spacingEffectiveness: 0.85    // More reduced effectiveness
            },
            'overlay-basic': {
                name: 'Overlay - Basic (No Plates)',
                resistanceAbovePipes: 0.025,  // Just panel/boards
                downwardLossFactor: 0.35,     // 35% base downward loss
                spacingEffectiveness: 0.75    // Significantly reduced
            }
        };
        
        // Insulation effectiveness (reduces downward loss)
        this.insulationFactors = {
            0: 1.0,    // No insulation - full downward loss
            10: 0.70,  // 10mm - 30% reduction in downward loss
            20: 0.50,  // 20mm - 50% reduction
            30: 0.35,  // 30mm - 65% reduction
            50: 0.20   // 50mm - 80% reduction
        };
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Event listeners - Mouse
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Event listeners - Touch
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
            });
        });
        
        // Parameter inputs
        document.getElementById('gridSize').addEventListener('change', (e) => {
            this.gridSize = parseFloat(e.target.value);
            this.draw();
        });
        
        // Installation type change handler
        document.getElementById('installationType').addEventListener('change', (e) => {
            const overlayOptions = document.getElementById('overlayOptions');
            overlayOptions.style.display = e.target.value.startsWith('overlay') ? 'block' : 'none';
        });
        
        // Calculate button
        document.getElementById('calculate').addEventListener('click', () => {
            this.calculate();
        });
        
        // New project
        document.getElementById('newProject').addEventListener('click', () => {
            if (confirm('Start a new project? This will clear all current data.')) {
                this.walls = [];
                this.windows = [];
                this.selectedElement = null;
                this.draw();
                document.getElementById('resultsSection').style.display = 'none';
                document.getElementById('resultsSection').classList.remove('active');
            }
        });
        
        // Mobile UI handlers
        this.initMobileUI();
        
        this.draw();
    }
    
    initMobileUI() {
        // Mobile bottom toolbar handlers
        const mobileToolBtns = document.querySelectorAll('.mobile-tool-btn[data-tool]');
        const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
        const mobileCalculateBtn = document.getElementById('mobileCalculateBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        const resultsSection = document.getElementById('resultsSection');
        
        // Mobile tool buttons (Select, Wall, Window)
        mobileToolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
                
                // Update active state on mobile toolbar
                mobileToolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Mobile settings button - toggle settings panel
        if (mobileSettingsBtn) {
            mobileSettingsBtn.addEventListener('click', () => {
                if (settingsPanel) {
                    settingsPanel.classList.toggle('active');
                }
            });
        }
        
        // Mobile calculate button - run calculation
        if (mobileCalculateBtn) {
            mobileCalculateBtn.addEventListener('click', () => {
                console.log('Mobile calculate clicked');
                this.calculate();
            });
        }
        
        // Close settings panel button
        const closeProperties = document.getElementById('closeProperties');
        if (closeProperties) {
            closeProperties.addEventListener('click', () => {
                if (settingsPanel) {
                    settingsPanel.classList.remove('active');
                }
            });
        }
        
        // Close results button
        const closeResults = document.getElementById('closeResults');
        if (closeResults) {
            closeResults.addEventListener('click', () => {
                resultsSection.style.display = 'none';
                resultsSection.classList.remove('active');
            });
        }
        
        // Sync duplicate inputs (outdoor temp, room height, grid size)
        const outdoorTemp = document.getElementById('outdoorTemp');
        const outdoorTemp2 = document.getElementById('outdoorTemp2');
        const roomHeight = document.getElementById('roomHeight');
        const roomHeight2 = document.getElementById('roomHeight2');
        const gridSize = document.getElementById('gridSize');
        const gridSize2 = document.getElementById('gridSize2');
        
        if (outdoorTemp && outdoorTemp2) {
            outdoorTemp.addEventListener('change', () => {
                outdoorTemp2.value = outdoorTemp.value;
            });
            outdoorTemp2.addEventListener('change', () => {
                outdoorTemp.value = outdoorTemp2.value;
            });
        }
        
        if (roomHeight && roomHeight2) {
            roomHeight.addEventListener('change', () => {
                roomHeight2.value = roomHeight.value;
            });
            roomHeight2.addEventListener('change', () => {
                roomHeight.value = roomHeight2.value;
            });
        }
        
        if (gridSize && gridSize2) {
            gridSize.addEventListener('change', () => {
                gridSize2.value = gridSize.value;
                this.gridSize = parseFloat(gridSize2.value);
                this.draw();
            });
            gridSize2.addEventListener('change', () => {
                gridSize.value = gridSize2.value;
                this.gridSize = parseFloat(gridSize2.value);
                this.draw();
            });
        }
    }
    
    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height - 40; // Subtract info bar height
        this.draw();
    }
    
    setTool(tool) {
        this.currentTool = tool;
        
        // Update desktop toolbar
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        // Update mobile toolbar
        document.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        this.drawingWall = null;
        this.updateStatus();
    }
    
    snapToGrid(x, y) {
        const gridPixels = this.gridSize * this.scale;
        return {
            x: Math.round(x / gridPixels) * gridPixels,
            y: Math.round(y / gridPixels) * gridPixels
        };
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.panOffset.y) / this.zoom;
        return { x, y };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0] || e.changedTouches[0];
        const x = (touch.clientX - rect.left - this.panOffset.x) / this.zoom;
        const y = (touch.clientY - rect.top - this.panOffset.y) / this.zoom;
        return { x, y };
    }
    
    getScreenPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    pixelsToMeters(pixels) {
        return pixels / this.scale;
    }
    
    metersToPixels(meters) {
        return meters * this.scale;
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        
        if (this.currentTool === 'pan' || (this.currentTool === 'select' && e.button === 1)) {
            // Middle mouse button or pan tool
            this.isPanning = true;
            this.lastPanPoint = this.getScreenPos(e);
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        if (this.currentTool === 'select') {
            // Check if clicking on a handle first
            const handle = this.findHandleAt(pos.x, pos.y);
            if (handle) {
                this.draggingHandle = handle;
                this.canvas.style.cursor = 'grabbing';
                return;
            }
            
            // Check if clicking on a window
            const element = this.findElementAt(pos.x, pos.y);
            if (element && element.type === 'window') {
                this.draggingWindow = element;
                this.selectedElement = element;
                this.showProperties(element);
                this.canvas.style.cursor = 'grabbing';
                this.draw();
                return;
            }
            
            // Otherwise select element
            this.handleSelectAction(pos);
        }
    }
    
    handleMouseMove(e) {
        // Handle panning
        if (this.isPanning && this.lastPanPoint) {
            const screenPos = this.getScreenPos(e);
            this.panOffset.x += screenPos.x - this.lastPanPoint.x;
            this.panOffset.y += screenPos.y - this.lastPanPoint.y;
            this.lastPanPoint = screenPos;
            this.draw();
            return;
        }
        
        const pos = this.getMousePos(e);
        const snapped = this.snapToGrid(pos.x, pos.y);
        
        // Update cursor position
        const xMeters = this.pixelsToMeters(snapped.x).toFixed(1);
        const yMeters = this.pixelsToMeters(snapped.y).toFixed(1);
        document.getElementById('cursorPos').textContent = `X: ${xMeters}m, Y: ${yMeters}m`;
        
        // Handle dragging window
        if (this.draggingWindow) {
            const wall = this.walls.find(w => w.id === this.draggingWindow.wallId);
            if (wall) {
                // Project mouse position onto wall line
                const projected = this.projectPointOntoLine(
                    pos.x, pos.y,
                    wall.x1, wall.y1,
                    wall.x2, wall.y2
                );
                
                this.draggingWindow.x = projected.x;
                this.draggingWindow.y = projected.y;
                this.draggingWindow.positionRatio = this.getPositionRatioOnWall(wall, projected.x, projected.y);
                
                // Constrain window to stay within wall bounds
                this.constrainWindowPosition(this.draggingWindow, wall);
                
                this.draw();
            }
            return;
        }
        
        // Handle dragging
        if (this.draggingHandle) {
            // Update all walls connected to this handle
            this.draggingHandle.wallIds.forEach(wallId => {
                const wall = this.walls.find(w => w.id === wallId);
                if (!wall) return;
                
                const points = this.draggingHandle.points[wallId];
                points.forEach(point => {
                    if (point === 'start') {
                        wall.x1 = snapped.x;
                        wall.y1 = snapped.y;
                    } else {
                        wall.x2 = snapped.x;
                        wall.y2 = snapped.y;
                    }
                });
                
                // Update windows on this wall
                this.windows.forEach(win => {
                    if (win.wallId === wallId) {
                        // Recalculate window position (project onto new wall line)
                        const ratio = win.positionRatio || 0.5;
                        win.x = wall.x1 + (wall.x2 - wall.x1) * ratio;
                        win.y = wall.y1 + (wall.y2 - wall.y1) * ratio;
                        
                        // Constrain to ensure window stays within wall bounds
                        this.constrainWindowPosition(win, wall);
                    }
                });
            });
            
            this.draw();
            return;
        }
        
        // Update cursor based on hover
        if (this.currentTool === 'select') {
            const handle = this.findHandleAt(pos.x, pos.y);
            const element = this.findElementAt(pos.x, pos.y);
            if (handle) {
                this.canvas.style.cursor = 'grab';
            } else if (element && element.type === 'window') {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        } else if (this.currentTool === 'pan') {
            this.canvas.style.cursor = 'grab';
        }
        
        // Preview drawing
        if (this.drawingWall) {
            this.previewEndPoint = snapped;
            this.draw();
        }
    }
    
    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPanPoint = null;
            this.canvas.style.cursor = this.currentTool === 'pan' ? 'grab' : 'default';
        }
        if (this.draggingWindow) {
            this.draggingWindow = null;
            this.canvas.style.cursor = 'default';
            this.draw();
        }
        if (this.draggingHandle) {
            this.draggingHandle = null;
            this.canvas.style.cursor = 'default';
            this.draw();
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const screenPos = this.getScreenPos(e);
        const worldPosBefore = {
            x: (screenPos.x - this.panOffset.x) / this.zoom,
            y: (screenPos.y - this.panOffset.y) / this.zoom
        };
        
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
        
        // Adjust pan to keep mouse position fixed
        this.panOffset.x = screenPos.x - worldPosBefore.x * this.zoom;
        this.panOffset.y = screenPos.y - worldPosBefore.y * this.zoom;
        
        this.draw();
    }
    
    handleClick(e) {
        const pos = this.getMousePos(e);
        const snapped = this.snapToGrid(pos.x, pos.y);
        
        this.handleDrawAction(snapped);
    }
    
    getTouchDistance(touches) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }
    
    handleSelectAction(pos) {
        if (this.currentTool === 'select') {
            const element = this.findElementAt(pos.x, pos.y);
            if (element) {
                this.selectedElement = element;
                this.showProperties(this.selectedElement);
                this.draw();
            } else {
                // Clicked on empty space - deselect
                this.selectedElement = null;
                this.hideContextualToolbar();
                this.draw();
            }
        }
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        
        // Handle multi-touch (pinch/pan)
        if (e.touches.length === 2) {
            this.touchState.touches = [
                { x: e.touches[0].clientX, y: e.touches[0].clientY },
                { x: e.touches[1].clientX, y: e.touches[1].clientY }
            ];
            this.touchState.lastDistance = this.getTouchDistance(e.touches);
            return;
        }
        
        const pos = this.getTouchPos(e);
        const snapped = this.snapToGrid(pos.x, pos.y);
        this.lastTouchPos = pos;
        
        if (this.currentTool === 'pan') {
            this.isPanning = true;
            this.lastPanPoint = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            return;
        }
        
        if (this.currentTool === 'select') {
            // Check if touching a handle
            const handle = this.findHandleAt(pos.x, pos.y);
            if (handle) {
                this.draggingHandle = handle;
                return;
            }
            
            // Check if touching a window
            const element = this.findElementAt(pos.x, pos.y);
            if (element && element.type === 'window') {
                this.draggingWindow = element;
                this.selectedElement = element;
                this.showProperties(element);
                this.draw();
                return;
            }
            
            this.handleSelectAction(pos);
        } else if (this.currentTool === 'wall') {
            // Start drawing wall immediately on touch
            this.drawingWall = {
                x1: snapped.x,
                y1: snapped.y
            };
            this.updateStatus('Drag to draw wall, release to finish');
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (!e.touches.length) return;
        
        // Handle two-finger gestures (works in any tool mode)
        if (e.touches.length === 2) {
            // Initialize touch state if needed
            if (this.touchState.touches.length !== 2) {
                this.touchState.touches = [
                    { x: e.touches[0].clientX, y: e.touches[0].clientY },
                    { x: e.touches[1].clientX, y: e.touches[1].clientY }
                ];
                this.touchState.lastDistance = this.getTouchDistance(e.touches);
                return;
            }
            
            const currentDistance = this.getTouchDistance(e.touches);
            const currentCenter = this.getTouchCenter(e.touches);
            const lastCenter = {
                x: (this.touchState.touches[0].x + this.touchState.touches[1].x) / 2,
                y: (this.touchState.touches[0].y + this.touchState.touches[1].y) / 2
            };
            
            // Pinch zoom
            if (this.touchState.lastDistance > 0) {
                const rect = this.canvas.getBoundingClientRect();
                const zoomFactor = currentDistance / this.touchState.lastDistance;
                const oldZoom = this.zoom;
                this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
                
                // Adjust pan to keep center point fixed
                const centerX = currentCenter.x - rect.left;
                const centerY = currentCenter.y - rect.top;
                const worldX = (centerX - this.panOffset.x) / oldZoom;
                const worldY = (centerY - this.panOffset.y) / oldZoom;
                this.panOffset.x = centerX - worldX * this.zoom;
                this.panOffset.y = centerY - worldY * this.zoom;
            }
            
            // Two-finger pan
            this.panOffset.x += currentCenter.x - lastCenter.x;
            this.panOffset.y += currentCenter.y - lastCenter.y;
            
            this.touchState.touches = [
                { x: e.touches[0].clientX, y: e.touches[0].clientY },
                { x: e.touches[1].clientX, y: e.touches[1].clientY }
            ];
            this.touchState.lastDistance = currentDistance;
            
            this.draw();
            return;
        }
        
        // Reset multi-touch state when down to one finger
        if (e.touches.length === 1 && this.touchState.touches.length === 2) {
            this.touchState.touches = [];
            this.touchState.lastDistance = 0;
        }
        
        // Handle single-finger pan in pan mode
        if (this.isPanning && e.touches.length === 1 && this.lastPanPoint) {
            const touch = e.touches[0];
            this.panOffset.x += touch.clientX - this.lastPanPoint.x;
            this.panOffset.y += touch.clientY - this.lastPanPoint.y;
            this.lastPanPoint = { x: touch.clientX, y: touch.clientY };
            this.draw();
            return;
        }
        
        const pos = this.getTouchPos(e);
        const snapped = this.snapToGrid(pos.x, pos.y);
        
        // Update cursor position
        const xMeters = this.pixelsToMeters(snapped.x).toFixed(1);
        const yMeters = this.pixelsToMeters(snapped.y).toFixed(1);
        document.getElementById('cursorPos').textContent = `X: ${xMeters}m, Y: ${yMeters}m`;
        
        // Handle dragging window
        if (this.draggingWindow) {
            const wall = this.walls.find(w => w.id === this.draggingWindow.wallId);
            if (wall) {
                const projected = this.projectPointOntoLine(
                    pos.x, pos.y,
                    wall.x1, wall.y1,
                    wall.x2, wall.y2
                );
                
                this.draggingWindow.x = projected.x;
                this.draggingWindow.y = projected.y;
                this.draggingWindow.positionRatio = this.getPositionRatioOnWall(wall, projected.x, projected.y);
                
                // Constrain window to stay within wall bounds
                this.constrainWindowPosition(this.draggingWindow, wall);
                
                this.draw();
            }
            this.lastTouchPos = pos;
            return;
        }
        
        // Handle dragging
        if (this.draggingHandle) {
            // Update all walls connected to this handle
            this.draggingHandle.wallIds.forEach(wallId => {
                const wall = this.walls.find(w => w.id === wallId);
                if (!wall) return;
                
                const points = this.draggingHandle.points[wallId];
                points.forEach(point => {
                    if (point === 'start') {
                        wall.x1 = snapped.x;
                        wall.y1 = snapped.y;
                    } else {
                        wall.x2 = snapped.x;
                        wall.y2 = snapped.y;
                    }
                });
                
                // Update windows on this wall
                this.windows.forEach(win => {
                    if (win.wallId === wallId) {
                        const ratio = win.positionRatio || 0.5;
                        win.x = wall.x1 + (wall.x2 - wall.x1) * ratio;
                        win.y = wall.y1 + (wall.y2 - wall.y1) * ratio;
                        
                        // Constrain to ensure window stays within wall bounds
                        this.constrainWindowPosition(win, wall);
                    }
                });
            });
            
            this.draw();
            this.lastTouchPos = pos;
            return;
        }
        
        // Preview drawing wall
        if (this.drawingWall) {
            this.previewEndPoint = snapped;
            this.draw();
        }
        
        this.lastTouchPos = pos;
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        // Reset multi-touch state
        if (e.touches.length < 2) {
            this.touchState.touches = [];
            this.touchState.lastDistance = 0;
        }
        
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPanPoint = null;
        }
        
        if (this.draggingWindow) {
            this.draggingWindow = null;
            this.draw();
            this.lastTouchPos = null;
            return;
        }
        
        if (this.draggingHandle) {
            this.draggingHandle = null;
            this.draw();
            this.lastTouchPos = null;
            return;
        }
        
        if (this.drawingWall && this.lastTouchPos) {
            // Complete wall on release
            const snapped = this.snapToGrid(this.lastTouchPos.x, this.lastTouchPos.y);
            
            // Only create wall if it has some length
            const dx = snapped.x - this.drawingWall.x1;
            const dy = snapped.y - this.drawingWall.y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length > 10) { // Minimum 10 pixels
                const wall = {
                    id: Date.now(),
                    type: 'wall',
                    x1: this.drawingWall.x1,
                    y1: this.drawingWall.y1,
                    x2: snapped.x,
                    y2: snapped.y,
                    material: 'brick',
                    facing: 'outdoor'
                };
                this.walls.push(wall);
            }
            
            this.drawingWall = null;
            this.previewEndPoint = null;
            this.updateStatus('Touch and drag to draw another wall');
            this.draw();
        }
        
        // Handle other tools (window, delete)
        if (!this.drawingWall && this.lastTouchPos && this.currentTool !== 'select' && this.currentTool !== 'wall') {
            const snapped = this.snapToGrid(this.lastTouchPos.x, this.lastTouchPos.y);
            this.handleDrawAction(snapped);
        }
        
        this.lastTouchPos = null;
    }
    
    handleDrawAction(snapped) {
        
        if (this.currentTool === 'wall') {
            // For mouse: two-click interaction
            if (!this.drawingWall) {
                // Start new wall
                this.drawingWall = {
                    x1: snapped.x,
                    y1: snapped.y
                };
                this.updateStatus('Click to place wall end point');
            } else {
                // Complete wall
                const wall = {
                    id: Date.now(),
                    type: 'wall',
                    x1: this.drawingWall.x1,
                    y1: this.drawingWall.y1,
                    x2: snapped.x,
                    y2: snapped.y,
                    material: 'brick',
                    facing: 'outdoor' // outdoor, indoor, unheated
                };
                this.walls.push(wall);
                this.drawingWall = null;
                this.previewEndPoint = null;
                this.updateStatus('Click to place wall start point');
                this.draw();
            }
        } else if (this.currentTool === 'window') {
            // Find wall at click position
            const wall = this.findWallAt(snapped.x, snapped.y);
            if (wall) {
                const window = {
                    id: Date.now(),
                    type: 'window',
                    wallId: wall.id,
                    x: snapped.x,
                    y: snapped.y,
                    width: 1.2, // meters
                    height: 1.5, // meters
                    uValue: 1.1, // W/m²K (triple glazing)
                    positionRatio: this.getPositionRatioOnWall(wall, snapped.x, snapped.y)
                };
                
                // Constrain window to stay within wall bounds
                this.constrainWindowPosition(window, wall);
                
                this.windows.push(window);
                this.draw();
            } else {
                alert('Click on a wall to place a window');
            }
        } else if (this.currentTool === 'delete') {
            const element = this.findElementAt(snapped.x, snapped.y);
            if (element) {
                this.deleteElement(element.id);
            }
        }
    }
    
    findHandleAt(x, y) {
        const handleRadius = 30; // Touch-friendly hit area
        const handles = new Map(); // key: "x,y", value: {wallIds, points}
        
        // Collect all endpoints
        this.walls.forEach(wall => {
            const start = `${wall.x1.toFixed(1)},${wall.y1.toFixed(1)}`;
            const end = `${wall.x2.toFixed(1)},${wall.y2.toFixed(1)}`;
            
            if (!handles.has(start)) {
                handles.set(start, { x: wall.x1, y: wall.y1, wallIds: [], points: {} });
            }
            handles.get(start).wallIds.push(wall.id);
            if (!handles.get(start).points[wall.id]) {
                handles.get(start).points[wall.id] = [];
            }
            handles.get(start).points[wall.id].push('start');
            
            if (!handles.has(end)) {
                handles.set(end, { x: wall.x2, y: wall.y2, wallIds: [], points: {} });
            }
            handles.get(end).wallIds.push(wall.id);
            if (!handles.get(end).points[wall.id]) {
                handles.get(end).points[wall.id] = [];
            }
            handles.get(end).points[wall.id].push('end');
        });
        
        // Find handle at click position
        for (const handle of handles.values()) {
            const dist = Math.sqrt((handle.x - x) ** 2 + (handle.y - y) ** 2);
            if (dist < handleRadius) {
                return handle;
            }
        }
        
        return null;
    }
    
    getPositionRatioOnWall(wall, x, y) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) return 0.5;
        
        const t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / lengthSq;
        return Math.max(0, Math.min(1, t));
    }
    
    projectPointOntoLine(x, y, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) return { x: x1, y: y1 };
        
        let t = ((x - x1) * dx + (y - y1) * dy) / lengthSq;
        
        // Clamp t to [0, 1] to keep point on the line segment
        t = Math.max(0, Math.min(1, t));
        
        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }
    
    constrainWindowPosition(window, wall) {
        // Get window width in pixels
        const windowWidth = this.metersToPixels(window.width);
        const halfWidth = windowWidth / 2;
        
        // Calculate wall length
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const wallLength = Math.sqrt(dx * dx + dy * dy);
        
        // Get position ratio
        const ratio = window.positionRatio || 0.5;
        
        // Calculate minimum and maximum ratios to keep window within wall
        const minRatio = halfWidth / wallLength;
        const maxRatio = 1 - (halfWidth / wallLength);
        
        // Constrain ratio
        const constrainedRatio = Math.max(minRatio, Math.min(maxRatio, ratio));
        
        // Update window position and ratio
        window.positionRatio = constrainedRatio;
        window.x = wall.x1 + (wall.x2 - wall.x1) * constrainedRatio;
        window.y = wall.y1 + (wall.y2 - wall.y1) * constrainedRatio;
        
        return window;
    }
    
    findElementAt(x, y) {
        // Check windows first (smaller targets)
        // Use larger hit radius for touch-friendly interaction
        const hitRadius = 30;
        for (const window of this.windows) {
            const dist = Math.sqrt((window.x - x) ** 2 + (window.y - y) ** 2);
            if (dist < hitRadius) {
                return window;
            }
        }
        
        // Check walls
        return this.findWallAt(x, y);
    }
    
    findWallAt(x, y) {
        // Use larger hit distance for touch-friendly interaction
        const hitDistance = 15;
        for (const wall of this.walls) {
            const dist = this.pointToLineDistance(x, y, wall.x1, wall.y1, wall.x2, wall.y2);
            if (dist < hitDistance) {
                return wall;
            }
        }
        return null;
    }
    
    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context and apply transformations
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Draw grid
        this.drawGrid();
        
        // Draw walls
        this.walls.forEach(wall => this.drawWall(wall));
        
        // Draw preview wall if currently drawing
        if (this.drawingWall && this.previewEndPoint) {
            this.ctx.strokeStyle = '#2563eb';
            this.ctx.lineWidth = 8;
            this.ctx.globalAlpha = 0.6;
            this.ctx.beginPath();
            this.ctx.moveTo(this.drawingWall.x1, this.drawingWall.y1);
            this.ctx.lineTo(this.previewEndPoint.x, this.previewEndPoint.y);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
            
            // Draw dimension for preview
            const length = this.pixelsToMeters(
                Math.sqrt(
                    (this.previewEndPoint.x - this.drawingWall.x1) ** 2 + 
                    (this.previewEndPoint.y - this.drawingWall.y1) ** 2
                )
            );
            this.drawDimension(
                this.drawingWall.x1, this.drawingWall.y1,
                this.previewEndPoint.x, this.previewEndPoint.y,
                length,
                true // preview mode
            );
        }
        
        // Draw dimensions on walls
        this.walls.forEach(wall => {
            const length = this.getWallLength(wall);
            this.drawDimension(wall.x1, wall.y1, wall.x2, wall.y2, length, false);
        });
        
        // Draw windows
        this.windows.forEach(window => this.drawWindow(window));
        
        // Draw window dimensions
        this.windows.forEach(window => this.drawWindowDimensions(window));
        
        // Draw handles (when in select mode)
        if (this.currentTool === 'select') {
            this.drawHandles();
        }
        
        // Highlight selected element
        if (this.selectedElement) {
            this.highlightElement(this.selectedElement);
        }
        
        // Draw floor area
        this.drawFloorArea();
        
        // Restore context
        this.ctx.restore();
        
        // Draw zoom level indicator (not transformed)
        this.drawZoomIndicator();
    }
    
    drawDimension(x1, y1, x2, y2, lengthMeters, isPreview = false) {
        // Calculate wall angle and midpoint
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.atan2(dy, dx);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Offset distance from wall
        const offset = 25;
        const offsetX = -Math.sin(angle) * offset;
        const offsetY = Math.cos(angle) * offset;
        
        // Dimension line endpoints
        const dimX1 = x1 + offsetX;
        const dimY1 = y1 + offsetY;
        const dimX2 = x2 + offsetX;
        const dimY2 = y2 + offsetY;
        
        // Extension lines
        const extLen = 15;
        const extX = -Math.sin(angle) * extLen;
        const extY = Math.cos(angle) * extLen;
        
        this.ctx.strokeStyle = isPreview ? '#2563eb' : '#64748b';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        
        // Draw extension lines
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x1 + extX, y1 + extY);
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(x2 + extX, y2 + extY);
        this.ctx.stroke();
        
        // Draw dimension line
        this.ctx.beginPath();
        this.ctx.moveTo(dimX1, dimY1);
        this.ctx.lineTo(dimX2, dimY2);
        this.ctx.stroke();
        
        // Draw arrow heads
        const arrowSize = 8;
        const arrowAngle = Math.PI / 6;
        
        // Arrow at start
        this.ctx.beginPath();
        this.ctx.moveTo(dimX1, dimY1);
        this.ctx.lineTo(
            dimX1 + arrowSize * Math.cos(angle + Math.PI + arrowAngle),
            dimY1 + arrowSize * Math.sin(angle + Math.PI + arrowAngle)
        );
        this.ctx.moveTo(dimX1, dimY1);
        this.ctx.lineTo(
            dimX1 + arrowSize * Math.cos(angle + Math.PI - arrowAngle),
            dimY1 + arrowSize * Math.sin(angle + Math.PI - arrowAngle)
        );
        this.ctx.stroke();
        
        // Arrow at end
        this.ctx.beginPath();
        this.ctx.moveTo(dimX2, dimY2);
        this.ctx.lineTo(
            dimX2 + arrowSize * Math.cos(angle + arrowAngle),
            dimY2 + arrowSize * Math.sin(angle + arrowAngle)
        );
        this.ctx.moveTo(dimX2, dimY2);
        this.ctx.lineTo(
            dimX2 + arrowSize * Math.cos(angle - arrowAngle),
            dimY2 + arrowSize * Math.sin(angle - arrowAngle)
        );
        this.ctx.stroke();
        
        // Draw dimension text
        const text = `${lengthMeters.toFixed(2)} m`;
        const textX = midX + offsetX;
        const textY = midY + offsetY;
        
        this.ctx.save();
        this.ctx.translate(textX, textY);
        
        // Rotate text to align with dimension line
        let textAngle = angle;
        if (Math.abs(angle) > Math.PI / 2) {
            textAngle = angle + Math.PI; // Flip text if upside down
        }
        this.ctx.rotate(textAngle);
        
        // Draw text background
        this.ctx.font = '12px sans-serif';
        const metrics = this.ctx.measureText(text);
        const padding = 4;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(
            -metrics.width / 2 - padding,
            -8 - padding,
            metrics.width + padding * 2,
            16 + padding * 2
        );
        
        // Draw text
        this.ctx.fillStyle = isPreview ? '#2563eb' : '#1e293b';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, 0, 0);
        
        this.ctx.restore();
    }
    
    drawHandles() {
        const handles = new Map();
        
        // Collect unique endpoints
        this.walls.forEach(wall => {
            const start = `${wall.x1.toFixed(1)},${wall.y1.toFixed(1)}`;
            const end = `${wall.x2.toFixed(1)},${wall.y2.toFixed(1)}`;
            
            if (!handles.has(start)) {
                handles.set(start, { x: wall.x1, y: wall.y1, count: 0 });
            }
            handles.get(start).count++;
            
            if (!handles.has(end)) {
                handles.set(end, { x: wall.x2, y: wall.y2, count: 0 });
            }
            handles.get(end).count++;
        });
        
        // Draw handles
        handles.forEach(handle => {
            // Color based on connection count
            const isNode = handle.count > 1;
            this.ctx.fillStyle = isNode ? '#2563eb' : '#94a3b8';
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(handle.x, handle.y, isNode ? 8 : 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }
    
    drawFloorArea() {
        if (this.walls.length < 3) return; // Need at least 3 walls to form a polygon
        
        // Build polygon from connected walls
        const polygon = this.buildPolygonFromWalls();
        
        // Only show area if we have a valid polygon (at least 3 points)
        if (polygon.length < 3) return;
        
        const floorArea = this.calculateFloorArea();
        
        // Only show if area is reasonable (> 0.5 m²)
        if (floorArea < 0.5) return;
        
        // Find center of polygon for placement
        let sumX = 0, sumY = 0;
        polygon.forEach(point => {
            sumX += point.x;
            sumY += point.y;
        });
        const centerX = sumX / polygon.length;
        const centerY = sumY / polygon.length;
        
        // Highlight the floor area with a semi-transparent fill
        this.ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
        this.ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
            this.ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw floor area text
        const text = `Floor Area: ${floorArea.toFixed(2)} m²`;
        this.ctx.font = 'bold 16px sans-serif';
        const metrics = this.ctx.measureText(text);
        const padding = 8;
        
        // Background
        this.ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
        this.ctx.fillRect(
            centerX - metrics.width / 2 - padding,
            centerY - 12 - padding,
            metrics.width + padding * 2,
            24 + padding * 2
        );
        
        // Text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, centerX, centerY);
    }
    
    drawZoomIndicator() {
        // Draw zoom level in bottom-right corner (not transformed)
        const text = `${(this.zoom * 100).toFixed(0)}%`;
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#64748b';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(text, this.canvas.width - 10, this.canvas.height - 10);
    }
    
    drawGrid() {
        const gridPixels = this.gridSize * this.scale;
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x < this.canvas.width; x += gridPixels) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < this.canvas.height; y += gridPixels) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawWall(wall) {
        this.ctx.strokeStyle = wall.facing === 'outdoor' ? '#475569' : 
                               wall.facing === 'unheated' ? '#94a3b8' : '#cbd5e1';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(wall.x1, wall.y1);
        this.ctx.lineTo(wall.x2, wall.y2);
        this.ctx.stroke();
    }
    
    drawWindow(window) {
        // Find the wall this window is on
        const wall = this.walls.find(w => w.id === window.wallId);
        if (!wall) return;
        
        // Calculate wall angle
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const angle = Math.atan2(dy, dx);
        
        // Window width in pixels (perpendicular to wall)
        const width = this.metersToPixels(window.width);
        const thickness = 15; // Visual thickness of window in top view
        
        this.ctx.save();
        this.ctx.translate(window.x, window.y);
        this.ctx.rotate(angle);
        
        // Draw window opening (gap in wall)
        this.ctx.fillStyle = '#93c5fd';
        this.ctx.fillRect(-width/2, -thickness/2, width, thickness);
        
        // Draw window frame
        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-width/2, -thickness/2, width, thickness);
        
        // Draw window panes (two lines to indicate glass)
        this.ctx.strokeStyle = '#1e40af';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(-width/2 + 3, -thickness/2 + 3);
        this.ctx.lineTo(width/2 - 3, -thickness/2 + 3);
        this.ctx.moveTo(-width/2 + 3, thickness/2 - 3);
        this.ctx.lineTo(width/2 - 3, thickness/2 - 3);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawWindowDimensions(window) {
        const wall = this.walls.find(w => w.id === window.wallId);
        if (!wall) return;
        
        // Calculate wall angle
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const angle = Math.atan2(dy, dx);
        const wallLength = Math.sqrt(dx * dx + dy * dy);
        
        // Window width along the wall (half on each side of center)
        const windowWidth = this.metersToPixels(window.width);
        const halfWidth = windowWidth / 2;
        
        // Calculate window edge positions along the wall
        const unitX = dx / wallLength;
        const unitY = dy / wallLength;
        
        const windowStartX = window.x - unitX * halfWidth;
        const windowStartY = window.y - unitY * halfWidth;
        const windowEndX = window.x + unitX * halfWidth;
        const windowEndY = window.y + unitY * halfWidth;
        
        // Calculate distances from window edges to wall ends
        const distToStart = this.pixelsToMeters(
            Math.sqrt(
                (windowStartX - wall.x1) ** 2 + (windowStartY - wall.y1) ** 2
            )
        );
        
        const distToEnd = this.pixelsToMeters(
            Math.sqrt(
                (windowEndX - wall.x2) ** 2 + (windowEndY - wall.y2) ** 2
            )
        );
        
        // Ensure no negative dimensions
        const safeDistToStart = Math.max(0, distToStart);
        const safeDistToEnd = Math.max(0, distToEnd);
        
        // Offset for dimensions (opposite side from wall dimensions)
        const offset = -45;
        const offsetX = -Math.sin(angle) * offset;
        const offsetY = Math.cos(angle) * offset;
        
        // Draw dimension from start to window start edge
        this.drawWindowSegmentDimension(
            wall.x1, wall.y1,
            windowStartX, windowStartY,
            safeDistToStart,
            offsetX, offsetY, angle
        );
        
        // Draw dimension from window end edge to wall end
        this.drawWindowSegmentDimension(
            windowEndX, windowEndY,
            wall.x2, wall.y2,
            safeDistToEnd,
            offsetX, offsetY, angle
        );
    }
    
    drawWindowSegmentDimension(x1, y1, x2, y2, lengthMeters, offsetX, offsetY, angle) {
        // Don't draw dimension if length is zero or very small
        if (lengthMeters < 0.01) return;
        
        // Ensure dimension is positive
        const displayLength = Math.abs(lengthMeters);
        
        // Dimension line endpoints
        const dimX1 = x1 + offsetX;
        const dimY1 = y1 + offsetY;
        const dimX2 = x2 + offsetX;
        const dimY2 = y2 + offsetY;
        
        // Extension lines
        const extLen = 10;
        const extX = -Math.sin(angle) * extLen;
        const extY = Math.cos(angle) * extLen;
        
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        
        // Draw extension lines
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x1 + offsetX + extX, y1 + offsetY + extY);
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(x2 + offsetX + extX, y2 + offsetY + extY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Draw dimension line
        this.ctx.beginPath();
        this.ctx.moveTo(dimX1, dimY1);
        this.ctx.lineTo(dimX2, dimY2);
        this.ctx.stroke();
        
        // Draw small arrows
        const arrowSize = 6;
        const arrowAngle = Math.PI / 6;
        
        // Arrow at start
        this.ctx.beginPath();
        this.ctx.moveTo(dimX1, dimY1);
        this.ctx.lineTo(
            dimX1 + arrowSize * Math.cos(angle + Math.PI + arrowAngle),
            dimY1 + arrowSize * Math.sin(angle + Math.PI + arrowAngle)
        );
        this.ctx.moveTo(dimX1, dimY1);
        this.ctx.lineTo(
            dimX1 + arrowSize * Math.cos(angle + Math.PI - arrowAngle),
            dimY1 + arrowSize * Math.sin(angle + Math.PI - arrowAngle)
        );
        this.ctx.stroke();
        
        // Arrow at end
        this.ctx.beginPath();
        this.ctx.moveTo(dimX2, dimY2);
        this.ctx.lineTo(
            dimX2 + arrowSize * Math.cos(angle + arrowAngle),
            dimY2 + arrowSize * Math.sin(angle + arrowAngle)
        );
        this.ctx.moveTo(dimX2, dimY2);
        this.ctx.lineTo(
            dimX2 + arrowSize * Math.cos(angle - arrowAngle),
            dimY2 + arrowSize * Math.sin(angle - arrowAngle)
        );
        this.ctx.stroke();
        
        // Draw dimension text
        const text = `${displayLength.toFixed(2)}`;
        const midX = (dimX1 + dimX2) / 2;
        const midY = (dimY1 + dimY2) / 2;
        
        this.ctx.save();
        this.ctx.translate(midX, midY);
        
        // Rotate text to align with dimension line
        let textAngle = angle;
        if (Math.abs(angle) > Math.PI / 2) {
            textAngle = angle + Math.PI;
        }
        this.ctx.rotate(textAngle);
        
        // Draw text background
        this.ctx.font = '10px sans-serif';
        const metrics = this.ctx.measureText(text);
        const padding = 2;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(
            -metrics.width / 2 - padding,
            -6 - padding,
            metrics.width + padding * 2,
            12 + padding * 2
        );
        
        // Draw text
        this.ctx.fillStyle = '#64748b';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, 0, 0);
        
        this.ctx.restore();
    }
    
    highlightElement(element) {
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        
        if (element.type === 'wall') {
            this.ctx.beginPath();
            this.ctx.moveTo(element.x1, element.y1);
            this.ctx.lineTo(element.x2, element.y2);
            this.ctx.stroke();
        } else if (element.type === 'window') {
            const wall = this.walls.find(w => w.id === element.wallId);
            if (!wall) return;
            
            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const angle = Math.atan2(dy, dx);
            const width = this.metersToPixels(element.width);
            const thickness = 15;
            
            this.ctx.save();
            this.ctx.translate(element.x, element.y);
            this.ctx.rotate(angle);
            this.ctx.strokeRect(-width/2, -thickness/2, width, thickness);
            this.ctx.restore();
        }
        
        this.ctx.setLineDash([]);
    }
    
    showProperties(element) {
        const toolbar = document.getElementById('contextualToolbar');
        
        // Calculate position near element (in screen space)
        let screenX, screenY;
        if (element.type === 'wall') {
            // Position near center of wall
            const midX = (element.x1 + element.x2) / 2;
            const midY = (element.y1 + element.y2) / 2;
            screenX = midX * this.zoom + this.panOffset.x;
            screenY = midY * this.zoom + this.panOffset.y;
        } else if (element.type === 'window') {
            // Position near window
            screenX = element.x * this.zoom + this.panOffset.x;
            screenY = element.y * this.zoom + this.panOffset.y;
        }
        
        if (element.type === 'wall') {
            toolbar.innerHTML = `
                <div class="contextual-toolbar-header">
                    <div class="contextual-toolbar-title">
                        <i class="fas fa-grip-lines"></i>
                        <span>Wall Properties</span>
                    </div>
                    <button class="contextual-close" onclick="window.app.hideContextualToolbar()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="contextual-toolbar-body">
                    <div class="contextual-field">
                        <label>Material</label>
                        <select id="ctxMaterial">
                            ${Object.entries(this.materials.walls).map(([key, mat]) => 
                                `<option value="${key}" ${element.material === key ? 'selected' : ''}>
                                    ${mat.name}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="contextual-field">
                        <label>Outer Face Facing</label>
                        <select id="ctxFacing">
                            <option value="outdoor" ${element.facing === 'outdoor' ? 'selected' : ''}>Outdoor</option>
                            <option value="unheated" ${element.facing === 'unheated' ? 'selected' : ''}>Unheated Space</option>
                            <option value="indoor" ${element.facing === 'indoor' ? 'selected' : ''}>Indoor Heated</option>
                        </select>
                    </div>
                    
                    <div class="contextual-info">
                        <i class="fas fa-ruler"></i> Length: ${this.getWallLength(element).toFixed(2)} m
                    </div>
                    
                    <div class="contextual-actions">
                        <button class="contextual-btn contextual-btn-delete" onclick="window.app.deleteElement(${element.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            setTimeout(() => {
                document.getElementById('ctxMaterial').addEventListener('change', (e) => {
                    element.material = e.target.value;
                    this.draw();
                    // Update info display
                    this.showProperties(element);
                });
                
                document.getElementById('ctxFacing').addEventListener('change', (e) => {
                    element.facing = e.target.value;
                    this.draw();
                });
            }, 0);
            
        } else if (element.type === 'window') {
            toolbar.innerHTML = `
                <div class="contextual-toolbar-header">
                    <div class="contextual-toolbar-title">
                        <i class="fas fa-border-none"></i>
                        <span>Window Properties</span>
                    </div>
                    <button class="contextual-close" onclick="window.app.hideContextualToolbar()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="contextual-toolbar-body">
                    <div class="contextual-field-inline">
                        <label>Width (m)</label>
                        <input type="number" id="ctxWidth" value="${element.width}" step="0.1" min="0.5">
                    </div>
                    
                    <div class="contextual-field-inline">
                        <label>Height (m)</label>
                        <input type="number" id="ctxHeight" value="${element.height}" step="0.1" min="0.5">
                    </div>
                    
                    <div class="contextual-field-inline">
                        <label>U-Value</label>
                        <input type="number" id="ctxUValue" value="${element.uValue}" step="0.1" min="0.5">
                    </div>
                    
                    <div class="contextual-info">
                        <i class="fas fa-ruler-combined"></i> Area: ${(element.width * element.height).toFixed(2)} m²
                    </div>
                    
                    <div class="contextual-actions">
                        <button class="contextual-btn contextual-btn-delete" onclick="window.app.deleteElement(${element.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            setTimeout(() => {
                document.getElementById('ctxWidth').addEventListener('change', (e) => {
                    element.width = parseFloat(e.target.value);
                    
                    // Constrain window to wall bounds after width change
                    const wall = this.walls.find(w => w.id === element.wallId);
                    if (wall) {
                        this.constrainWindowPosition(element, wall);
                    }
                    
                    this.draw();
                    this.showProperties(element);
                });
                
                document.getElementById('ctxHeight').addEventListener('change', (e) => {
                    element.height = parseFloat(e.target.value);
                    this.draw();
                    this.showProperties(element);
                });
                
                document.getElementById('ctxUValue').addEventListener('change', (e) => {
                    element.uValue = parseFloat(e.target.value);
                });
            }, 0);
        }
        
        // Position and show toolbar
        this.positionContextualToolbar(toolbar, screenX, screenY);
    }
    
    positionContextualToolbar(toolbar, screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const toolbarWidth = 300;
        const toolbarHeight = 250; // approximate
        const offset = 20;
        
        // On mobile, show as bottom sheet
        if (window.innerWidth <= 768) {
            toolbar.style.left = '0';
            toolbar.style.right = '0';
            toolbar.style.bottom = '0';
            toolbar.style.top = 'auto';
            toolbar.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
            toolbar.classList.add('active');
            return;
        }
        
        // Desktop: position near element
        let left = screenX + offset;
        let top = screenY - toolbarHeight / 2;
        let arrowClass = 'arrow-left';
        
        // Check if goes off right edge
        if (left + toolbarWidth > rect.width) {
            left = screenX - toolbarWidth - offset;
            arrowClass = 'arrow-right';
        }
        
        // Check if goes off bottom
        if (top + toolbarHeight > rect.height) {
            top = rect.height - toolbarHeight - 20;
        }
        
        // Check if goes off top
        if (top < 20) {
            top = 20;
        }
        
        toolbar.style.left = `${left}px`;
        toolbar.style.top = `${top}px`;
        toolbar.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
        toolbar.classList.add(arrowClass);
        toolbar.classList.add('active');
    }
    
    hideContextualToolbar() {
        const toolbar = document.getElementById('contextualToolbar');
        toolbar.classList.remove('active');
        this.selectedElement = null;
        this.draw();
    }
    
    deleteElement(elementId) {
        // Find and delete element
        const wallIndex = this.walls.findIndex(w => w.id === elementId);
        if (wallIndex !== -1) {
            this.walls.splice(wallIndex, 1);
            // Remove windows on this wall
            this.windows = this.windows.filter(w => w.wallId !== elementId);
        }
        
        const windowIndex = this.windows.findIndex(w => w.id === elementId);
        if (windowIndex !== -1) {
            this.windows.splice(windowIndex, 1);
        }
        
        this.hideContextualToolbar();
        this.draw();
    }
    
    showEmptyProperties() {
        this.hideContextualToolbar();
    }
    
    getWallLength(wall) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        return this.pixelsToMeters(Math.sqrt(dx * dx + dy * dy));
    }
    
    updateStatus(message) {
        const statusEl = document.getElementById('canvasStatus');
        if (message) {
            statusEl.textContent = message;
        } else {
            const messages = {
                'select': 'Select elements to edit properties',
                'wall': 'Touch and drag to draw wall (or click start/end points)',
                'window': 'Click on a wall to place a window',
                'pan': 'Click and drag to pan view (or use two fingers on mobile)',
                'delete': 'Click on an element to delete it'
            };
            statusEl.textContent = messages[this.currentTool] || '';
        }
    }
    
    calculate() {
        if (this.walls.length === 0) {
            alert('Please draw at least one wall before calculating.');
            return;
        }
        
        // Get parameters
        const indoorTemp = parseFloat(document.getElementById('indoorTemp').value);
        const outdoorTemp = parseFloat(document.getElementById('outdoorTemp').value);
        const roomHeight = parseFloat(document.getElementById('roomHeight').value);
        const floorMaterial = document.getElementById('floorMaterial').value;
        const floorBelow = document.getElementById('floorBelow').value;
        const ceilingMaterial = document.getElementById('ceilingMaterial').value;
        const ceilingAbove = document.getElementById('ceilingAbove').value;
        
        // UFH System parameters
        const installationType = document.getElementById('installationType').value;
        const insulationBelow = parseInt(document.getElementById('insulationBelow').value);
        const pipeSpacing = parseInt(document.getElementById('pipeSpacing').value);
        const supplyTemp = parseFloat(document.getElementById('supplyTemp').value);
        const returnTemp = parseFloat(document.getElementById('returnTemp').value);
        
        // Validate UFH temperatures
        if (supplyTemp <= returnTemp) {
            alert('Supply temperature must be higher than return temperature.');
            return;
        }
        if (supplyTemp <= indoorTemp) {
            alert('Supply temperature must be higher than indoor temperature.');
            return;
        }
        
        // Calculate floor area (simple polygon area)
        const floorArea = this.calculateFloorArea();
        if (floorArea === 0) {
            alert('Cannot calculate floor area. Please draw a closed room perimeter.');
            return;
        }
        
        const breakdown = [];
        let totalLoss = 0;
        
        // Calculate wall heat loss
        this.walls.forEach(wall => {
            const length = this.getWallLength(wall);
            const area = length * roomHeight;
            
            // Subtract window areas
            let windowArea = 0;
            this.windows.forEach(win => {
                if (win.wallId === wall.id) {
                    windowArea += win.width * win.height;
                }
            });
            
            const netArea = Math.max(0, area - windowArea);
            const uValue = this.materials.walls[wall.material].u;
            
            let deltaT;
            if (wall.facing === 'outdoor') {
                deltaT = indoorTemp - outdoorTemp;
            } else if (wall.facing === 'unheated') {
                // Assume unheated space averages between indoor and outdoor
                const unheatedTemp = (indoorTemp + outdoorTemp) / 2;
                deltaT = indoorTemp - unheatedTemp;
            } else {
                deltaT = 0; // Indoor to indoor
            }
            
            const loss = netArea * uValue * deltaT;
            
            if (loss > 0) {
                totalLoss += loss;
                breakdown.push({
                    name: `Wall (${wall.facing})`,
                    area: netArea.toFixed(2),
                    uValue: uValue,
                    deltaT: deltaT.toFixed(1),
                    loss: loss.toFixed(0)
                });
            }
        });
        
        // Calculate window heat loss
        this.windows.forEach(win => {
            const area = win.width * win.height;
            const deltaT = indoorTemp - outdoorTemp; // Windows always face outdoor
            const loss = area * win.uValue * deltaT;
            
            totalLoss += loss;
            breakdown.push({
                name: 'Window',
                area: area.toFixed(2),
                uValue: win.uValue,
                deltaT: deltaT.toFixed(1),
                loss: loss.toFixed(0)
            });
        });
        
        // Calculate floor heat loss
        const floorU = this.materials.floors[floorMaterial].u;
        let floorDeltaT;
        if (floorBelow === 'ground') {
            // Ground temperature typically warmer than outdoor in winter
            const groundTemp = outdoorTemp + 5; // Simplified assumption
            floorDeltaT = indoorTemp - groundTemp;
        } else if (floorBelow === 'heated') {
            floorDeltaT = 0;
        } else {
            const unheatedTemp = (indoorTemp + outdoorTemp) / 2;
            floorDeltaT = indoorTemp - unheatedTemp;
        }
        
        const floorLoss = floorArea * floorU * floorDeltaT;
        if (floorLoss > 0) {
            totalLoss += floorLoss;
            breakdown.push({
                name: `Floor (${floorBelow})`,
                area: floorArea.toFixed(2),
                uValue: floorU,
                deltaT: floorDeltaT.toFixed(1),
                loss: floorLoss.toFixed(0)
            });
        }
        
        // Calculate ceiling heat loss
        const ceilingU = this.materials.ceilings[ceilingMaterial].u;
        let ceilingDeltaT;
        if (ceilingAbove === 'outdoor') {
            ceilingDeltaT = indoorTemp - outdoorTemp;
        } else if (ceilingAbove === 'heated') {
            ceilingDeltaT = 0;
        } else {
            const unheatedTemp = (indoorTemp + outdoorTemp) / 2;
            ceilingDeltaT = indoorTemp - unheatedTemp;
        }
        
        const ceilingLoss = floorArea * ceilingU * ceilingDeltaT;
        if (ceilingLoss > 0) {
            totalLoss += ceilingLoss;
            breakdown.push({
                name: `Ceiling (${ceilingAbove})`,
                area: floorArea.toFixed(2),
                uValue: ceilingU,
                deltaT: ceilingDeltaT.toFixed(1),
                loss: ceilingLoss.toFixed(0)
            });
        }
        
        // Calculate UFH system performance
        const ufhRequired = totalLoss / floorArea; // Required heat flux W/m²
        const ufhTotal = totalLoss; // Total heat loss W
        
        // Calculate UFH system capability
        const ufhPerformance = this.calculateUFHPerformance(
            supplyTemp,
            returnTemp,
            indoorTemp,
            floorMaterial,
            pipeSpacing,
            installationType,
            insulationBelow
        );
        
        // Display results
        this.displayResults(
            totalLoss, 
            ufhTotal, 
            ufhRequired, 
            ufhPerformance, 
            floorArea, 
            breakdown,
            supplyTemp,
            returnTemp,
            pipeSpacing
        );
    }
    
    calculateUFHPerformance(supplyTemp, returnTemp, indoorTemp, floorMaterial, pipeSpacing, installationType, insulationBelow) {
        // Mean water temperature
        const meanWaterTemp = (supplyTemp + returnTemp) / 2;
        
        // Get system properties
        const systemProps = this.ufhSystems[installationType];
        
        // Floor covering thermal resistance (m²K/W)
        const floorResistance = this.materials.floors[floorMaterial].resistance;
        
        // Surface heat transfer coefficient: 1/10.8 ≈ 0.093 m²K/W (convection + radiation)
        const surfaceResistance = 0.093;
        
        // Resistance above pipes depends on system type
        const resistanceAbovePipes = systemProps.resistanceAbovePipes;
        
        // Total thermal resistance from water to room air (upward path)
        const totalResistanceUpward = floorResistance + resistanceAbovePipes + surfaceResistance;
        
        // Temperature difference
        const deltaT = meanWaterTemp - indoorTemp;
        
        // Base upward heat flux (W/m²) at 150mm spacing
        const baseUpwardFlux = deltaT / totalResistanceUpward;
        
        // Calculate downward heat loss for overlay systems
        let downwardLossFraction = 0;
        let netEfficiency = 1.0;
        
        if (installationType.startsWith('overlay')) {
            // Base downward loss factor from system type
            let baseDownwardLoss = systemProps.downwardLossFactor;
            
            // Insulation reduces downward loss
            const insulationFactor = this.insulationFactors[insulationBelow] || 1.0;
            downwardLossFraction = baseDownwardLoss * insulationFactor;
            
            // Net efficiency = fraction that goes upward
            netEfficiency = 1.0 - downwardLossFraction;
        }
        
        // Adjust for pipe spacing and system effectiveness
        const spacingFactor = this.pipeSpacingFactors[pipeSpacing] || 1.0;
        const spacingEffectiveness = systemProps.spacingEffectiveness;
        
        // Achievable upward heat flux (after accounting for downward losses and spacing)
        const achievableHeatFlux = baseUpwardFlux * spacingFactor * spacingEffectiveness * netEfficiency;
        
        // Calculate floor surface temperature
        // Heat flux through floor covering = (T_surface - T_room) / R_covering
        // So: T_surface = T_room + heat_flux_upward * (R_covering + R_surface)
        const upwardFluxThroughFloor = baseUpwardFlux * spacingFactor * spacingEffectiveness * netEfficiency;
        const floorSurfaceTemp = indoorTemp + upwardFluxThroughFloor * (floorResistance + surfaceResistance);
        
        return {
            achievableHeatFlux: achievableHeatFlux,
            floorSurfaceTemp: floorSurfaceTemp,
            meanWaterTemp: meanWaterTemp,
            totalResistanceUpward: totalResistanceUpward,
            spacingFactor: spacingFactor,
            spacingEffectiveness: spacingEffectiveness,
            netEfficiency: netEfficiency,
            downwardLossFraction: downwardLossFraction,
            installationType: installationType,
            insulationBelow: insulationBelow
        };
    }
    
    calculateFloorArea() {
        if (this.walls.length === 0) return 0;
        
        // Build polygon from connected walls
        const polygon = this.buildPolygonFromWalls();
        
        if (polygon.length < 3) {
            // Fallback to bounding box if can't form closed polygon
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            this.walls.forEach(wall => {
                minX = Math.min(minX, wall.x1, wall.x2);
                maxX = Math.max(maxX, wall.x1, wall.x2);
                minY = Math.min(minY, wall.y1, wall.y2);
                maxY = Math.max(maxY, wall.y1, wall.y2);
            });
            
            const width = this.pixelsToMeters(maxX - minX);
            const height = this.pixelsToMeters(maxY - minY);
            return width * height;
        }
        
        // Calculate polygon area using shoelace formula
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const xi = this.pixelsToMeters(polygon[i].x);
            const yi = this.pixelsToMeters(polygon[i].y);
            const xj = this.pixelsToMeters(polygon[j].x);
            const yj = this.pixelsToMeters(polygon[j].y);
            area += xi * yj - xj * yi;
        }
        
        return Math.abs(area / 2);
    }
    
    buildPolygonFromWalls() {
        if (this.walls.length === 0) return [];
        
        // Start with first wall
        const polygon = [{ x: this.walls[0].x1, y: this.walls[0].y1 }];
        const used = new Set();
        used.add(0);
        
        let current = { x: this.walls[0].x2, y: this.walls[0].y2 };
        polygon.push({ ...current });
        
        const tolerance = this.snapTolerance;
        
        // Try to find connected walls
        for (let iterations = 0; iterations < this.walls.length * 2; iterations++) {
            let found = false;
            
            for (let i = 0; i < this.walls.length; i++) {
                if (used.has(i)) continue;
                
                const wall = this.walls[i];
                
                // Check if wall start connects to current point
                const distToStart = Math.sqrt(
                    (wall.x1 - current.x) ** 2 + (wall.y1 - current.y) ** 2
                );
                if (distToStart < tolerance) {
                    current = { x: wall.x2, y: wall.y2 };
                    polygon.push({ ...current });
                    used.add(i);
                    found = true;
                    break;
                }
                
                // Check if wall end connects to current point
                const distToEnd = Math.sqrt(
                    (wall.x2 - current.x) ** 2 + (wall.y2 - current.y) ** 2
                );
                if (distToEnd < tolerance) {
                    current = { x: wall.x1, y: wall.y1 };
                    polygon.push({ ...current });
                    used.add(i);
                    found = true;
                    break;
                }
            }
            
            if (!found) break;
            
            // Check if we've closed the loop
            const distToStart = Math.sqrt(
                (current.x - polygon[0].x) ** 2 + (current.y - polygon[0].y) ** 2
            );
            if (distToStart < tolerance) {
                polygon.pop(); // Remove duplicate closing point
                break;
            }
        }
        
        return polygon;
    }
    
    displayResults(totalLoss, ufhTotal, ufhRequired, ufhPerformance, floorArea, breakdown, supplyTemp, returnTemp, pipeSpacing) {
        document.getElementById('totalLoss').textContent = `${(totalLoss / 1000).toFixed(2)} kW (${totalLoss.toFixed(0)} W)`;
        document.getElementById('ufhRequired').textContent = `${ufhRequired.toFixed(1)} W/m² (${(ufhTotal / 1000).toFixed(2)} kW total)`;
        document.getElementById('floorTemp').textContent = `${ufhPerformance.floorSurfaceTemp.toFixed(1)} °C`;
        
        // Validation based on achievable heat flux
        const achievable = ufhPerformance.achievableHeatFlux;
        const validationDiv = document.getElementById('validationStatus');
        
        // Check floor surface temperature limit (EN 1264: max 29°C for occupied areas)
        const maxFloorTemp = 29;
        const floorTempExceeded = ufhPerformance.floorSurfaceTemp > maxFloorTemp;
        
        if (ufhRequired <= achievable && !floorTempExceeded) {
            const systemName = this.ufhSystems[ufhPerformance.installationType].name;
            let efficiencyInfo = '';
            if (ufhPerformance.installationType.startsWith('overlay')) {
                const efficiency = (ufhPerformance.netEfficiency * 100).toFixed(0);
                const downward = (ufhPerformance.downwardLossFraction * 100).toFixed(0);
                efficiencyInfo = ` | Upward: ${efficiency}% (${downward}% lost downward)`;
            }
            validationDiv.className = 'validation-status success';
            validationDiv.innerHTML = `
                <i class="fas fa-check-circle"></i> 
                UFH system adequate: ${achievable.toFixed(1)} W/m² available vs ${ufhRequired.toFixed(1)} W/m² required
                <div style="font-size: 0.8em; margin-top: 0.25rem;">
                    ${systemName} | Water: ${supplyTemp}°C/${returnTemp}°C | Spacing: ${pipeSpacing}mm${efficiencyInfo}
                </div>
            `;
        } else if (floorTempExceeded) {
            validationDiv.className = 'validation-status error';
            const requiredWaterTemp = this.calculateRequiredWaterTemp(
                ufhRequired, 
                document.getElementById('indoorTemp').value,
                document.getElementById('floorMaterial').value,
                pipeSpacing
            );
            validationDiv.innerHTML = `
                <i class="fas fa-times-circle"></i> 
                Floor surface temperature too high: ${ufhPerformance.floorSurfaceTemp.toFixed(1)}°C (max ${maxFloorTemp}°C per EN 1264)
                <div style="font-size: 0.8em; margin-top: 0.25rem;">
                    Reduce water temperature or improve insulation
                </div>
            `;
        } else {
            validationDiv.className = 'validation-status error';
            const requiredWaterTemp = this.calculateRequiredWaterTemp(
                ufhRequired, 
                parseFloat(document.getElementById('indoorTemp').value),
                document.getElementById('floorMaterial').value,
                pipeSpacing,
                ufhPerformance.installationType,
                ufhPerformance.insulationBelow
            );
            const deficit = ufhRequired - achievable;
            
            let recommendations = `Increase water temp to ~${requiredWaterTemp.toFixed(0)}°C, reduce pipe spacing`;
            if (ufhPerformance.installationType.startsWith('overlay')) {
                if (ufhPerformance.insulationBelow < 50) {
                    recommendations += `, add/improve insulation below pipes (current: ${ufhPerformance.insulationBelow}mm)`;
                }
                recommendations += `, or upgrade to aluminum plate system`;
            } else {
                recommendations += `, or improve building insulation`;
            }
            
            validationDiv.innerHTML = `
                <i class="fas fa-times-circle"></i> 
                UFH insufficient: ${achievable.toFixed(1)} W/m² available but ${ufhRequired.toFixed(1)} W/m² required (${deficit.toFixed(1)} W/m² deficit)
                <div style="font-size: 0.8em; margin-top: 0.25rem;">
                    Options: ${recommendations}
                </div>
            `;
        }
        
        // Breakdown
        const breakdownDiv = document.getElementById('breakdownDetails');
        breakdownDiv.innerHTML = breakdown.map(item => `
            <div class="breakdown-item">
                <div class="breakdown-item-header">
                    <span>${item.name}</span>
                    <span>${item.loss} W</span>
                </div>
                <div class="breakdown-item-details">
                    Area: ${item.area} m² | U: ${item.uValue} W/m²K | ΔT: ${item.deltaT} °C
                </div>
            </div>
        `).join('');
        
        document.getElementById('resultsSection').style.display = 'block';
        
        // On mobile, show as modal
        if (window.innerWidth <= 1024) {
            setTimeout(() => {
                document.getElementById('resultsSection').classList.add('active');
            }, 100);
        }
    }
    
    calculateRequiredWaterTemp(requiredHeatFlux, indoorTemp, floorMaterial, pipeSpacing, installationType, insulationBelow) {
        const floorResistance = this.materials.floors[floorMaterial].resistance;
        const systemProps = this.ufhSystems[installationType];
        const resistanceAbovePipes = systemProps.resistanceAbovePipes;
        const surfaceResistance = 0.093;
        const totalResistance = floorResistance + resistanceAbovePipes + surfaceResistance;
        
        const spacingFactor = this.pipeSpacingFactors[pipeSpacing] || 1.0;
        const spacingEffectiveness = systemProps.spacingEffectiveness;
        
        // Calculate net efficiency for overlay systems
        let netEfficiency = 1.0;
        if (installationType.startsWith('overlay')) {
            const baseDownwardLoss = systemProps.downwardLossFactor;
            const insulationFactor = this.insulationFactors[insulationBelow] || 1.0;
            const downwardLossFraction = baseDownwardLoss * insulationFactor;
            netEfficiency = 1.0 - downwardLossFraction;
        }
        
        // q_net = ΔT / R * spacingFactor * effectiveness * efficiency
        // ΔT = q_net * R / (spacingFactor * effectiveness * efficiency)
        const requiredDeltaT = (requiredHeatFlux * totalResistance) / (spacingFactor * spacingEffectiveness * netEfficiency);
        const requiredMeanWaterTemp = indoorTemp + requiredDeltaT;
        
        // Assume 5°C drop, so supply is mean + 2.5°C
        return requiredMeanWaterTemp + 2.5;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UFHDesigner();
});
