// UFH Designer v2.0 - Room-Based Architecture
class UFHDesigner {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Drawing state
        this.currentTool = 'select';
        this.rooms = []; // NEW: Array of room objects
        this.windows = []; // Windows attached to room edges
        this.selectedElement = null;
        this.drawingRoom = null; // { startX, startY } when drawing new room
        this.draggingRoom = null; // { room, offsetX, offsetY } when moving room
        this.resizingRoom = null; // { room, edge: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw' }
        this.draggingWindow = null;
        this.nextRoomId = 1;
        this.nextWindowId = 1;
        this.gridSize = 0.5; // meters
        this.scale = 50; // pixels per meter
        
        // Pan and zoom state
        this.panOffset = { x: 100, y: 100 };
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
        
        // UFH pipe spacing heat output factors
        this.pipeSpacingFactors = {
            100: 1.25,
            150: 1.0,
            200: 0.85,
            300: 0.65
        };
        
        // UFH installation system properties
        this.ufhSystems = {
            'wet': {
                name: 'Wet System (Screed/Concrete)',
                resistanceAbovePipes: 0.045,
                downwardLossFactor: 0.05,
                spacingEffectiveness: 1.0
            },
            'overlay-aluminum': {
                name: 'Overlay - Aluminum Spreader Plates',
                resistanceAbovePipes: 0.012,
                downwardLossFactor: 0.25,
                spacingEffectiveness: 0.90
            },
            'overlay-grooved': {
                name: 'Overlay - Grooved Panels',
                resistanceAbovePipes: 0.018,
                downwardLossFactor: 0.30,
                spacingEffectiveness: 0.85
            },
            'overlay-basic': {
                name: 'Overlay - Basic (No Plates)',
                resistanceAbovePipes: 0.025,
                downwardLossFactor: 0.35,
                spacingEffectiveness: 0.75
            }
        };
        
        // Insulation effectiveness
        this.insulationFactors = {
            0: 1.0,
            10: 0.70,
            20: 0.50,
            30: 0.35,
            50: 0.20
        };
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Tool selection
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
        });
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Calculate button
        document.getElementById('calculate').addEventListener('click', () => {
            this.calculate();
        });
        
        // New project
        document.getElementById('newProject').addEventListener('click', () => {
            if (confirm('Start a new project? This will clear all current data.')) {
                this.rooms = [];
                this.windows = [];
                this.selectedElement = null;
                this.nextRoomId = 1;
                this.nextWindowId = 1;
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
        
        // Mobile tool buttons
        mobileToolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
                mobileToolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Mobile settings button
        if (mobileSettingsBtn) {
            mobileSettingsBtn.addEventListener('click', () => {
                if (settingsPanel) {
                    settingsPanel.classList.toggle('active');
                }
            });
        }
        
        // Mobile calculate button
        if (mobileCalculateBtn) {
            mobileCalculateBtn.addEventListener('click', () => {
                this.calculate();
            });
        }
        
        // Close settings panel
        const closeProperties = document.getElementById('closeProperties');
        if (closeProperties) {
            closeProperties.addEventListener('click', () => {
                if (settingsPanel) {
                    settingsPanel.classList.remove('active');
                }
            });
        }
        
        // Close results
        const closeResults = document.getElementById('closeResults');
        if (closeResults) {
            closeResults.addEventListener('click', () => {
                resultsSection.style.display = 'none';
                resultsSection.classList.remove('active');
            });
        }
        
        // Sync duplicate inputs
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
        this.canvas.height = rect.height - 40;
        this.draw();
    }
    
    setTool(tool) {
        console.log('Setting tool to:', tool);
        this.currentTool = tool;
        
        // Update desktop toolbar
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        // Update mobile toolbar
        document.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        this.drawingRoom = null;
        this.updateStatus();
    }
    
    snapToGrid(x, y) {
        const gridPixels = this.gridSize * this.scale * this.zoom;
        const worldX = (x - this.panOffset.x) / this.zoom;
        const worldY = (y - this.panOffset.y) / this.zoom;
        const snappedWorldX = Math.round(worldX / (this.gridSize * this.scale)) * (this.gridSize * this.scale);
        const snappedWorldY = Math.round(worldY / (this.gridSize * this.scale)) * (this.gridSize * this.scale);
        return {
            x: snappedWorldX * this.zoom + this.panOffset.x,
            y: snappedWorldY * this.zoom + this.panOffset.y,
            worldX: snappedWorldX,
            worldY: snappedWorldY
        };
    }
    
    toWorldCoords(screenX, screenY) {
        return {
            x: (screenX - this.panOffset.x) / this.zoom,
            y: (screenY - this.panOffset.y) / this.zoom
        };
    }
    
    toScreenCoords(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.panOffset.x,
            y: worldY * this.zoom + this.panOffset.y
        };
    }
    
    updateStatus() {
        const status = document.getElementById('canvasStatus');
        if (this.currentTool === 'select') {
            status.textContent = 'Click to select a room or zone';
        } else if (this.currentTool === 'room') {
            status.textContent = 'Click and drag to create a heated room (with UFH)';
        } else if (this.currentTool === 'zone') {
            status.textContent = 'Click and drag to create an unheated zone (no UFH)';
        } else if (this.currentTool === 'window') {
            status.textContent = 'Click on a room edge to add window';
        }
    }
    
    // Mouse and touch event handlers
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        console.log('Mouse down - Tool:', this.currentTool, 'Button:', e.button, 'Position:', x, y);
        
        // Middle mouse button for panning
        if (e.button === 1) {
            this.isPanning = true;
            this.lastPanPoint = { x, y };
            e.preventDefault();
            return;
        }
        
        // Left click tool actions
        if (e.button === 0) {
            if (this.currentTool === 'select') {
                this.handleSelectMouseDown(x, y);
            } else if (this.currentTool === 'room' || this.currentTool === 'zone') {
                this.handleRoomMouseDown(x, y);
            } else if (this.currentTool === 'window') {
                this.handleWindowMouseDown(x, y);
            }
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Update cursor position display
        const world = this.toWorldCoords(x, y);
        const meters = {
            x: world.x / this.scale,
            y: world.y / this.scale
        };
        document.getElementById('cursorPos').textContent = `X: ${meters.x.toFixed(1)}m, Y: ${meters.y.toFixed(1)}m`;
        
        // Panning
        if (this.isPanning && this.lastPanPoint) {
            const dx = x - this.lastPanPoint.x;
            const dy = y - this.lastPanPoint.y;
            this.panOffset.x += dx;
            this.panOffset.y += dy;
            this.lastPanPoint = { x, y };
            this.draw();
            return;
        }
        
        // Tool-specific move handlers
        if (this.currentTool === 'room' && this.drawingRoom) {
            this.handleRoomMouseMove(x, y);
        } else if (this.draggingRoom) {
            this.handleRoomDrag(x, y);
        } else if (this.resizingRoom) {
            this.handleRoomResize(x, y);
        }
        
        this.draw();
    }
    
    handleMouseUp(e) {
        if (e.button === 1) {
            this.isPanning = false;
            this.lastPanPoint = null;
            return;
        }
        
        if (e.button === 0) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.currentTool === 'room' && this.drawingRoom) {
                this.handleRoomMouseUp(x, y);
            } else if (this.draggingRoom) {
                this.draggingRoom = null;
                this.draw();
            } else if (this.resizingRoom) {
                this.resizingRoom = null;
                this.draw();
            }
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
        
        // Zoom toward mouse position
        const worldBefore = this.toWorldCoords(mouseX, mouseY);
        this.zoom = newZoom;
        const worldAfter = this.toWorldCoords(mouseX, mouseY);
        
        this.panOffset.x += (worldAfter.x - worldBefore.x) * this.zoom;
        this.panOffset.y += (worldAfter.y - worldBefore.y) * this.zoom;
        
        this.draw();
    }
    
    // Touch event handlers (simplified for now)
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            // Simulate mouse down
            this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0, preventDefault: () => {} });
        } else if (e.touches.length === 2) {
            // Two-finger pan/zoom
            this.touchState.touches = Array.from(e.touches);
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.touchState.lastDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        } else if (e.touches.length === 2 && this.touchState.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // Pinch zoom
            if (this.touchState.lastDistance > 0) {
                const zoomFactor = distance / this.touchState.lastDistance;
                this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
            }
            
            // Two-finger pan
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            const oldCenterX = (this.touchState.touches[0].clientX + this.touchState.touches[1].clientX) / 2;
            const oldCenterY = (this.touchState.touches[0].clientY + this.touchState.touches[1].clientY) / 2;
            
            this.panOffset.x += centerX - oldCenterX;
            this.panOffset.y += centerY - oldCenterY;
            
            this.touchState.touches = Array.from(e.touches);
            this.touchState.lastDistance = distance;
            this.draw();
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        if (e.touches.length === 0) {
            // Simulate mouse up
            this.handleMouseUp({ button: 0 });
            this.touchState.touches = [];
        } else if (e.touches.length === 1) {
            this.touchState.touches = [];
            this.touchState.lastDistance = 0;
        }
    }
    
    // Room creation handlers
    handleRoomMouseDown(x, y) {
        console.log('Room mouse down:', x, y, 'Tool:', this.currentTool);
        const snapped = this.snapToGrid(x, y);
        console.log('Snapped:', snapped);
        this.drawingRoom = {
            startX: snapped.worldX,
            startY: snapped.worldY
        };
        console.log('Drawing room started:', this.drawingRoom);
    }
    
    handleRoomMouseMove(x, y) {
        if (!this.drawingRoom) return;
        const snapped = this.snapToGrid(x, y);
        this.drawingRoom.endX = snapped.worldX;
        this.drawingRoom.endY = snapped.worldY;
    }
    
    handleRoomMouseUp(x, y) {
        console.log('Room/Zone mouse up, drawingRoom:', this.drawingRoom, 'Tool:', this.currentTool);
        if (!this.drawingRoom) return;
        
        const snapped = this.snapToGrid(x, y);
        const startX = this.drawingRoom.startX;
        const startY = this.drawingRoom.startY;
        const endX = snapped.worldX;
        const endY = snapped.worldY;
        
        const width = Math.abs(endX - startX) / this.scale;
        const height = Math.abs(endY - startY) / this.scale;
        
        console.log('Room/Zone dimensions:', width, 'x', height, 'meters');
        
        // Minimum size: 1m x 1m
        if (width >= 1 && height >= 1) {
            const isZone = this.currentTool === 'zone';
            const room = {
                id: this.nextRoomId++,
                type: isZone ? 'zone' : 'room',
                isZone: isZone,
                name: isZone ? `Zone ${this.nextRoomId - 1}` : `Room ${this.nextRoomId - 1}`,
                x: Math.min(startX, endX) / this.scale,
                y: Math.min(startY, endY) / this.scale,
                width: width,
                height: height,
                indoorTemp: isZone ? 15 : 20, // Zones default to 15°C (unheated)
                floorMaterial: 'tile',
                floorBelow: 'ground',
                installationType: 'wet',
                insulationBelow: 20,
                pipeSpacing: 150,
                supplyTemp: 40,
                returnTemp: 35,
                ceilingMaterial: 'plaster',
                ceilingAbove: 'heated'
            };
            
            console.log('Created room/zone:', room);
            this.rooms.push(room);
            this.selectedElement = room;
            this.showProperties(room);
        } else {
            console.log('Room/Zone too small, ignored');
        }
        
        this.drawingRoom = null;
        this.draw();
    }
    
    // Select tool handlers
    handleSelectMouseDown(x, y) {
        const world = this.toWorldCoords(x, y);
        const meters = {
            x: world.x / this.scale,
            y: world.y / this.scale
        };
        
        // Check if clicking on a room
        const room = this.findRoomAt(meters.x, meters.y);
        if (room) {
            this.selectedElement = room;
            this.draggingRoom = {
                room: room,
                offsetX: meters.x - room.x,
                offsetY: meters.y - room.y
            };
            this.showProperties(room);
            this.draw();
            return;
        }
        
        // Clicked on empty space
        this.selectedElement = null;
        this.hideContextualToolbar();
        this.draw();
    }
    
    handleRoomDrag(x, y) {
        if (!this.draggingRoom) return;
        
        const world = this.toWorldCoords(x, y);
        const meters = {
            x: world.x / this.scale,
            y: world.y / this.scale
        };
        
        this.draggingRoom.room.x = meters.x - this.draggingRoom.offsetX;
        this.draggingRoom.room.y = meters.y - this.draggingRoom.offsetY;
        
        // Snap to grid
        this.draggingRoom.room.x = Math.round(this.draggingRoom.room.x / this.gridSize) * this.gridSize;
        this.draggingRoom.room.y = Math.round(this.draggingRoom.room.y / this.gridSize) * this.gridSize;
    }
    
    handleRoomResize(x, y) {
        // TODO: Implement room resizing
    }
    
    // Window handlers (placeholder)
    handleWindowMouseDown(x, y) {
        // TODO: Implement window placement on room edges
    }
    
    findRoomAt(x, y) {
        for (let i = this.rooms.length - 1; i >= 0; i--) {
            const room = this.rooms[i];
            if (x >= room.x && x <= room.x + room.width &&
                y >= room.y && y <= room.y + room.height) {
                return room;
            }
        }
        return null;
    }
    
    // Generate walls from rooms for calculation
    generateWallsFromRooms() {
        const walls = [];
        const wallMap = new Map(); // Key: "x1,y1,x2,y2", Value: { wall, rooms: [] }
        
        // Generate walls for each room
        this.rooms.forEach(room => {
            const edges = [
                { x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y, side: 'north' }, // Top
                { x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.height, side: 'east' }, // Right
                { x1: room.x, y1: room.y + room.height, x2: room.x + room.width, y2: room.y + room.height, side: 'south' }, // Bottom
                { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.height, side: 'west' } // Left
            ];
            
            edges.forEach(edge => {
                // Normalize wall key (ensure consistent direction)
                const key = this.getWallKey(edge.x1, edge.y1, edge.x2, edge.y2);
                
                if (!wallMap.has(key)) {
                    wallMap.set(key, {
                        wall: edge,
                        rooms: [room]
                    });
                } else {
                    // This wall is shared between rooms
                    wallMap.get(key).rooms.push(room);
                }
            });
        });
        
        // Convert map to walls array with type (internal/external)
        wallMap.forEach((value, key) => {
            const wall = value.wall;
            wall.isInternal = value.rooms.length > 1;
            wall.adjacentRooms = value.rooms;
            walls.push(wall);
        });
        
        return walls;
    }
    
    getWallKey(x1, y1, x2, y2) {
        // Normalize to ensure same wall gets same key regardless of direction
        if (x1 === x2) {
            // Vertical wall
            return `${x1.toFixed(2)},${Math.min(y1, y2).toFixed(2)},${x1.toFixed(2)},${Math.max(y1, y2).toFixed(2)}`;
        } else {
            // Horizontal wall
            return `${Math.min(x1, x2).toFixed(2)},${y1.toFixed(2)},${Math.max(x1, x2).toFixed(2)},${y1.toFixed(2)}`;
        }
    }
    
    getWallLength(wall) {
        return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    }
    
    // Drawing functions
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context
        ctx.save();
        
        // Apply pan and zoom
        ctx.translate(this.panOffset.x, this.panOffset.y);
        ctx.scale(this.zoom, this.zoom);
        
        // Draw grid
        this.drawGrid();
        
        // Draw rooms
        this.drawRooms();
        
        // Draw room being created
        if (this.drawingRoom && this.drawingRoom.endX !== undefined) {
            this.drawRoomPreview();
        }
        
        // Restore context
        ctx.restore();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        const gridSize = this.gridSize * this.scale;
        const startX = Math.floor(-this.panOffset.x / this.zoom / gridSize) * gridSize;
        const startY = Math.floor(-this.panOffset.y / this.zoom / gridSize) * gridSize;
        const endX = startX + (this.canvas.width / this.zoom) + gridSize;
        const endY = startY + (this.canvas.height / this.zoom) + gridSize;
        
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5 / this.zoom;
        ctx.beginPath();
        
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        
        ctx.stroke();
    }
    
    drawRooms() {
        const ctx = this.ctx;
        
        this.rooms.forEach(room => {
            const x = room.x * this.scale;
            const y = room.y * this.scale;
            const width = room.width * this.scale;
            const height = room.height * this.scale;
            const isZone = room.isZone || room.type === 'zone';
            
            // Fill - zones in gray, rooms in blue
            if (this.selectedElement === room) {
                ctx.fillStyle = isZone ? 'rgba(148, 163, 184, 0.2)' : 'rgba(59, 130, 246, 0.1)';
            } else {
                ctx.fillStyle = isZone ? 'rgba(203, 213, 225, 0.3)' : 'rgba(191, 219, 254, 0.3)';
            }
            ctx.fillRect(x, y, width, height);
            
            // Border - zones in gray, rooms in dark
            const borderColor = isZone ? '#64748b' : '#1e293b';
            ctx.strokeStyle = this.selectedElement === room ? (isZone ? '#475569' : '#3b82f6') : borderColor;
            ctx.lineWidth = (this.selectedElement === room ? 3 : 2) / this.zoom;
            ctx.strokeRect(x, y, width, height);
            
            // Room/Zone name and area
            ctx.fillStyle = isZone ? '#64748b' : '#1e293b';
            ctx.font = `${14 / this.zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const area = room.width * room.height;
            const label = isZone ? ' (No UFH)' : '';
            ctx.fillText(`${room.name}${label}`, x + width / 2, y + height / 2 - 10 / this.zoom);
            ctx.fillText(`${area.toFixed(1)} m² | ${room.indoorTemp}°C`, x + width / 2, y + height / 2 + 10 / this.zoom);
            
            // Dimensions
            ctx.fillStyle = '#64748b';
            ctx.font = `${12 / this.zoom}px sans-serif`;
            // Width (top)
            ctx.fillText(`${room.width.toFixed(2)} m`, x + width / 2, y - 10 / this.zoom);
            // Height (left)
            ctx.save();
            ctx.translate(x - 10 / this.zoom, y + height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(`${room.height.toFixed(2)} m`, 0, 0);
            ctx.restore();
        });
    }
    
    drawRoomPreview() {
        if (!this.drawingRoom || this.drawingRoom.endX === undefined) return;
        
        const ctx = this.ctx;
        const x = Math.min(this.drawingRoom.startX, this.drawingRoom.endX);
        const y = Math.min(this.drawingRoom.startY, this.drawingRoom.endY);
        const width = Math.abs(this.drawingRoom.endX - this.drawingRoom.startX);
        const height = Math.abs(this.drawingRoom.endY - this.drawingRoom.startY);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / this.zoom;
        ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
        
        // Show dimensions
        const widthM = width / this.scale;
        const heightM = height / this.scale;
        ctx.fillStyle = '#3b82f6';
        ctx.font = `${14 / this.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${widthM.toFixed(2)} m × ${heightM.toFixed(2)} m`, x + width / 2, y + height / 2);
    }
    
    // Properties panel
    showProperties(room) {
        const toolbar = document.getElementById('contextualToolbar');
        
        // Calculate position
        const centerX = (room.x + room.width / 2) * this.scale;
        const centerY = (room.y + room.height / 2) * this.scale;
        const screenX = centerX * this.zoom + this.panOffset.x;
        const screenY = centerY * this.zoom + this.panOffset.y;
        const isZone = room.isZone || room.type === 'zone';
        const icon = isZone ? 'fa-square-dashed' : 'fa-vector-square';
        const typeLabel = isZone ? 'Zone (No UFH)' : 'Room';
        const tempLabel = isZone ? 'Zone Temp (°C)' : 'Indoor Temp (°C)';
        
        toolbar.innerHTML = `
            <div class="contextual-toolbar-header">
                <div class="contextual-toolbar-title">
                    <i class="fas ${icon}"></i>
                    <span>${room.name}</span>
                </div>
                <button class="contextual-close" onclick="window.app.hideContextualToolbar()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="contextual-toolbar-body">
                <div class="contextual-field-inline">
                    <label>Name</label>
                    <input type="text" id="ctxRoomName" value="${room.name}">
                </div>
                
                <div class="contextual-field-inline">
                    <label>${tempLabel}</label>
                    <input type="number" id="ctxIndoorTemp" value="${room.indoorTemp}" step="0.5">
                </div>
                
                <div class="contextual-info">
                    <i class="fas fa-ruler-combined"></i> ${room.width.toFixed(2)}m × ${room.height.toFixed(2)}m = ${(room.width * room.height).toFixed(1)} m²
                </div>
                
                ${isZone ? '' : `
                <div class="contextual-actions">
                    <button class="contextual-btn contextual-btn-secondary" onclick="window.app.editRoomSettings(${room.id})">
                        <i class="fas fa-cog"></i> UFH Settings
                    </button>
                </div>
                `}
                
                <div class="contextual-actions">
                    <button class="contextual-btn contextual-btn-delete" onclick="window.app.deleteRoom(${room.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        setTimeout(() => {
            const nameInput = document.getElementById('ctxRoomName');
            const tempInput = document.getElementById('ctxIndoorTemp');
            
            if (nameInput) {
                nameInput.addEventListener('change', () => {
                    room.name = nameInput.value;
                    this.draw();
                });
            }
            
            if (tempInput) {
                tempInput.addEventListener('change', () => {
                    room.indoorTemp = parseFloat(tempInput.value);
                    this.draw();
                });
            }
        }, 0);
        
        // Position and show toolbar
        this.positionContextualToolbar(toolbar, screenX, screenY);
    }
    
    positionContextualToolbar(toolbar, screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const toolbarWidth = 300;
        const toolbarHeight = 250;
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
        
        if (left + toolbarWidth > rect.width) {
            left = screenX - toolbarWidth - offset;
            arrowClass = 'arrow-right';
        }
        
        if (top + toolbarHeight > rect.height) {
            top = rect.height - toolbarHeight - 20;
        }
        
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
    
    editRoomSettings(roomId) {
        // Open settings panel with this room's settings
        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return;
        
        // Populate settings panel
        document.getElementById('indoorTemp').value = room.indoorTemp;
        document.getElementById('floorMaterial').value = room.floorMaterial;
        document.getElementById('floorBelow').value = room.floorBelow;
        document.getElementById('installationType').value = room.installationType;
        document.getElementById('insulationBelow').value = room.insulationBelow;
        document.getElementById('pipeSpacing').value = room.pipeSpacing;
        document.getElementById('supplyTemp').value = room.supplyTemp;
        document.getElementById('returnTemp').value = room.returnTemp;
        document.getElementById('ceilingMaterial').value = room.ceilingMaterial;
        document.getElementById('ceilingAbove').value = room.ceilingAbove;
        
        // Show settings panel
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) {
            settingsPanel.classList.add('active');
        }
        
        // Hide contextual toolbar
        this.hideContextualToolbar();
    }
    
    deleteRoom(roomId) {
        if (confirm('Delete this room?')) {
            this.rooms = this.rooms.filter(r => r.id !== roomId);
            this.hideContextualToolbar();
            this.draw();
        }
    }
    
    // Heat loss calculation
    calculate() {
        if (this.rooms.length === 0) {
            alert('Please add at least one room before calculating.');
            return;
        }
        
        const outdoorTemp = parseFloat(document.getElementById('outdoorTemp').value);
        const roomHeight = parseFloat(document.getElementById('roomHeight').value);
        
        const breakdown = [];
        let totalLoss = 0;
        let totalArea = 0;
        let ufhResults = [];
        
        // Calculate for each room
        this.rooms.forEach(room => {
            const roomArea = room.width * room.height;
            totalArea += roomArea;
            
            let roomTotalLoss = 0;
            
            // Get room settings (from room object or defaults)
            const indoorTemp = room.indoorTemp;
            const floorMaterial = room.floorMaterial || 'tile';
            const floorBelow = room.floorBelow || 'ground';
            const ceilingMaterial = room.ceilingMaterial || 'plaster';
            const ceilingAbove = room.ceilingAbove || 'heated';
            
            // Generate walls for this room
            const walls = this.generateWallsFromRooms().filter(wall => 
                wall.adjacentRooms.includes(room)
            );
            
            // Calculate wall heat loss
            walls.forEach(wall => {
                const length = this.getWallLength(wall);
                const area = length * roomHeight;
                const uValue = 0.5; // Default brick wall
                
                let deltaT;
                if (wall.isInternal && wall.adjacentRooms.length === 2) {
                    // Internal wall between two rooms
                    const otherRoom = wall.adjacentRooms.find(r => r !== room);
                    deltaT = Math.abs(room.indoorTemp - otherRoom.indoorTemp);
                } else {
                    // External wall
                    deltaT = indoorTemp - outdoorTemp;
                }
                
                const loss = area * uValue * deltaT;
                roomTotalLoss += loss;
                
                if (loss > 0.1) {
                    breakdown.push({
                        room: room.name,
                        name: wall.isInternal ? 'Internal Wall' : 'External Wall',
                        area: area.toFixed(2),
                        uValue: uValue,
                        deltaT: deltaT.toFixed(1),
                        loss: loss.toFixed(0)
                    });
                }
            });
            
            // Floor heat loss
            const floorU = this.materials.floors[floorMaterial].u;
            let floorDeltaT;
            if (floorBelow === 'ground') {
                const groundTemp = outdoorTemp + 5;
                floorDeltaT = indoorTemp - groundTemp;
            } else if (floorBelow === 'heated') {
                floorDeltaT = 0;
            } else {
                const unheatedTemp = (indoorTemp + outdoorTemp) / 2;
                floorDeltaT = indoorTemp - unheatedTemp;
            }
            
            const floorLoss = roomArea * floorU * floorDeltaT;
            if (floorLoss > 0) {
                roomTotalLoss += floorLoss;
                breakdown.push({
                    room: room.name,
                    name: `Floor (${floorBelow})`,
                    area: roomArea.toFixed(2),
                    uValue: floorU,
                    deltaT: floorDeltaT.toFixed(1),
                    loss: floorLoss.toFixed(0)
                });
            }
            
            // Ceiling heat loss
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
            
            const ceilingLoss = roomArea * ceilingU * ceilingDeltaT;
            if (ceilingLoss > 0) {
                roomTotalLoss += ceilingLoss;
                breakdown.push({
                    room: room.name,
                    name: `Ceiling (${ceilingAbove})`,
                    area: roomArea.toFixed(2),
                    uValue: ceilingU,
                    deltaT: ceilingDeltaT.toFixed(1),
                    loss: ceilingLoss.toFixed(0)
                });
            }
            
            totalLoss += roomTotalLoss;
            
            // Calculate UFH only for heated rooms (not zones)
            const isZone = room.isZone || room.type === 'zone';
            if (!isZone) {
                const ufhRequired = roomTotalLoss / roomArea;
                const ufhPerformance = this.calculateUFHPerformance(
                    room.supplyTemp || 40,
                    room.returnTemp || 35,
                    indoorTemp,
                    floorMaterial,
                    room.pipeSpacing || 150,
                    room.installationType || 'wet',
                    room.insulationBelow || 20
                );
                
                ufhResults.push({
                    room: room.name,
                    area: roomArea,
                    loss: roomTotalLoss,
                    ufhRequired: ufhRequired,
                    ufhPerformance: ufhPerformance
                });
            }
        });
        
        // Display aggregated results
        this.displayResults(totalLoss, totalArea, ufhResults, breakdown);
    }
    
    calculateUFHPerformance(supplyTemp, returnTemp, indoorTemp, floorMaterial, pipeSpacing, installationType, insulationBelow) {
        const meanWaterTemp = (supplyTemp + returnTemp) / 2;
        const systemProps = this.ufhSystems[installationType];
        const floorResistance = this.materials.floors[floorMaterial].resistance;
        const surfaceResistance = 0.093;
        const resistanceAbovePipes = systemProps.resistanceAbovePipes;
        const totalResistanceUpward = floorResistance + resistanceAbovePipes + surfaceResistance;
        const deltaT = meanWaterTemp - indoorTemp;
        const baseHeatFlux = deltaT / totalResistanceUpward;
        const spacingFactor = this.pipeSpacingFactors[pipeSpacing] || 1.0;
        const spacingEffectiveness = systemProps.spacingEffectiveness;
        
        let netEfficiency = 1.0;
        let downwardLossFraction = 0;
        if (installationType.startsWith('overlay')) {
            const baseDownwardLoss = systemProps.downwardLossFactor;
            const insulationFactor = this.insulationFactors[insulationBelow] || 1.0;
            downwardLossFraction = baseDownwardLoss * insulationFactor;
            netEfficiency = 1.0 - downwardLossFraction;
        }
        
        const achievableHeatFlux = baseHeatFlux * spacingFactor * spacingEffectiveness * netEfficiency;
        const floorSurfaceTemp = indoorTemp + achievableHeatFlux * (floorResistance + surfaceResistance);
        
        return {
            achievableHeatFlux: achievableHeatFlux,
            floorSurfaceTemp: floorSurfaceTemp,
            netEfficiency: netEfficiency,
            downwardLossFraction: downwardLossFraction,
            installationType: installationType,
            insulationBelow: insulationBelow
        };
    }
    
    displayResults(totalLoss, totalArea, ufhResults, breakdown) {
        // Calculate weighted average UFH performance
        let totalUfhRequired = 0;
        let totalAchievable = 0;
        let avgFloorTemp = 0;
        
        ufhResults.forEach(result => {
            totalUfhRequired += result.ufhRequired * result.area;
            totalAchievable += result.ufhPerformance.achievableHeatFlux * result.area;
            avgFloorTemp += result.ufhPerformance.floorSurfaceTemp * result.area;
        });
        
        const avgUfhRequired = totalUfhRequired / totalArea;
        const avgAchievable = totalAchievable / totalArea;
        avgFloorTemp = avgFloorTemp / totalArea;
        
        document.getElementById('totalLoss').textContent = `${(totalLoss / 1000).toFixed(2)} kW (${totalLoss.toFixed(0)} W)`;
        document.getElementById('ufhRequired').textContent = `${avgUfhRequired.toFixed(1)} W/m² (${(totalLoss / 1000).toFixed(2)} kW total)`;
        document.getElementById('floorTemp').textContent = `${avgFloorTemp.toFixed(1)} °C (avg)`;
        
        // Validation
        const validationDiv = document.getElementById('validationStatus');
        const maxFloorTemp = 29;
        const floorTempExceeded = avgFloorTemp > maxFloorTemp;
        
        if (avgUfhRequired <= avgAchievable && !floorTempExceeded) {
            validationDiv.className = 'validation-status success';
            validationDiv.innerHTML = `
                <i class="fas fa-check-circle"></i> 
                UFH system adequate: ${avgAchievable.toFixed(1)} W/m² available vs ${avgUfhRequired.toFixed(1)} W/m² required
            `;
        } else if (floorTempExceeded) {
            validationDiv.className = 'validation-status error';
            validationDiv.innerHTML = `
                <i class="fas fa-times-circle"></i> 
                Floor surface temperature too high: ${avgFloorTemp.toFixed(1)}°C (max ${maxFloorTemp}°C per EN 1264)
            `;
        } else {
            validationDiv.className = 'validation-status error';
            const deficit = avgUfhRequired - avgAchievable;
            validationDiv.innerHTML = `
                <i class="fas fa-times-circle"></i> 
                UFH insufficient: ${avgAchievable.toFixed(1)} W/m² available but ${avgUfhRequired.toFixed(1)} W/m² required (${deficit.toFixed(1)} W/m² deficit)
            `;
        }
        
        // Breakdown
        const breakdownDiv = document.getElementById('breakdownDetails');
        breakdownDiv.innerHTML = breakdown.map(item => `
            <div class="breakdown-item">
                <div class="breakdown-item-header">
                    <span><strong>${item.room}</strong>: ${item.name}</span>
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UFHDesigner();
});
