import { app } from "../../scripts/app.js";

// Check if cg.customnodes.use_everywhere extension is installed
function isUseEverywhereInstalled() {
    try {
        // The use_everywhere extension registers its settings under "Use Everywhere" namespace
        return app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks') !== undefined;
    } catch (e) {
        return false;
    }
}

// Get the full list of registered extensions to check for use_everywhere
function getRegisteredExtensions() {
    try {
        if (app.extensionList && Array.isArray(app.extensionList)) {
            return app.extensionList.map(ext => ext.name || null);
        }
    } catch (e) {
        console.warn('[LGCTinyPerf] Could not access extension list:', e);
    }
    return [];
}

// Check if use_everywhere is in the registered extensions
function checkExtensionInList() {
    const extensions = getRegisteredExtensions();
    return extensions.includes('cg.customnodes.use_everywhere');
}

app.registerExtension({
    name: "ARZUMATA.LGCTinyPerf",
    settings: [
        {
            id: 'LGCTinyPerf.GhostingEnabled',
            category: ['LGCTinyPerf', 'General', 'GhostingEnabled'],
            name: 'Ghost mode enabled.',
            type: 'boolean',
            defaultValue: true,
            tooltip: "When dragging canvas, nodes are simplified to colored boxes for better performance.",
        },
        {
            id: "LGCTinyPerf.HideConnections",
            category: ['LGCTinyPerf', 'General', 'HideConnections'],
            name: "Hide connections while dragging nodes",
            type: "boolean",
            tooltip: "When enabled, connection lines are hidden when dragging nodes.",
            defaultValue: true,
        },
        {
            id: "LGCTinyPerf.DisableFX",
            category: ['LGCTinyPerf', 'General', 'DisableFX'],
            name: "Disable FX",
            type: "boolean",
            tooltip: "Disables shadows, connection borders, and high-quality rendering. Requires page refresh to take effect.",
            defaultValue: true,
        },
        {
            id: "LGCTinyPerf.ToggleUELinks",
            category: ['LGCTinyPerf', 'UE Nodes', 'ToggleUELinks'],
            name: 'Toggle cg_use_everywhere links during ghosting',
            type: 'boolean',
            defaultValue: true,
            tooltip: "Automatically hides cg_use_everywhere links when dragging nodes for better performance.",
        },
    ],

    async setup() {
        const LGC = LGraphCanvas;
        if (!LGC) return;

        // Persistent State
        let isGhosting = false;
        let nodes_moving = false; // tracks if nodes are being moved
        let linksHidden = false;

        // Check every frame if we are dragging something
        let draggingCanvas = false;
        let draggingItems = false;

        const originalSettings = {
            links: 0,
            render_shadows: null,
            draw_shadows: null,
            render_connections_border: null,
            highquality_render: null,
            render_collapsed_slots: null,
            ue_showlinks: null, // Store original UE showlinks setting value for restoration
        };

        // Check if use_everywhere is installed and log accordingly
        const hasUseEverywhere = isUseEverywhereInstalled() || checkExtensionInList();
        console.log(`[LGCTinyPerf] cg.customnodes.use_everywhere detected: ${hasUseEverywhere}`);

        // Disable FX and save original values first
        const disableFX = (canvas) => {
            const canDisableFX = app.ui.settings.getSettingValue('LGCTinyPerf.DisableFX');

            if (!canvas || !canDisableFX) return;

            // Save original settings before disabling
            originalSettings.render_shadows = canvas.render_shadows;
            originalSettings.draw_shadows = canvas.draw_shadows;
            originalSettings.render_connections_border = canvas.render_connections_border;
            originalSettings.highquality_render = canvas.highquality_render;
            originalSettings.render_collapsed_slots = canvas.render_collapsed_slots;

            canvas.render_shadows = false;              // No node shadows
            canvas.draw_shadows = false;                // Double check
            canvas.render_connections_border = false;   // No connection border
            canvas.highquality_render = false;          // Force standard render
            canvas.render_collapsed_slots = false;      // Green dot thingy on collapsed nodes
            console.log("ARZUMATA LGCTinyPerf Patch: Shadows and FX Disabled");
        };

        // Restore original settings - Enable FX (only restore non-null values)
        const enableFX = (canvas) => {
            if (!canvas) return;
            
            if (originalSettings.render_shadows !== null) canvas.render_shadows = originalSettings.render_shadows;
            if (originalSettings.draw_shadows !== null) canvas.draw_shadows = originalSettings.draw_shadows;
            if (originalSettings.render_connections_border !== null) canvas.render_connections_border = originalSettings.render_connections_border;
            if (originalSettings.highquality_render !== null) canvas.highquality_render = originalSettings.highquality_render;
            if (originalSettings.render_collapsed_slots !== null) canvas.render_collapsed_slots = originalSettings.render_collapsed_slots;
            
            console.log("ARZUMATA LGCTinyPerf Patch: Shadows and FX Enabled");
        };

        // Handle DisableFX setting change - apply or revert based on checkbox state
        const handleDisableFXSettingChange = (newValue) => {
            if (!app.canvas) return;
            
            if (newValue === true) {
                disableFX(app.canvas);
            } else {
                enableFX(app.canvas);
            }
        };

        // Listen for setting changes on LGCTinyPerf.DisableFX
        app.ui.settings.addEventListener('settingChanged', (event) => {
            if (event.detail?.id === 'LGCTinyPerf.DisableFX') {
                handleDisableFXSettingChange(event.detail.value);
            }
        });

        // Toggle cg_use_everywhere link rendering when nodes are moving or ghosting
        const toggleUseEverywhereRendering = (enabled) => {
            try {
                if (!hasUseEverywhere) {
                    console.log('[LGCTinyPerf] Skipping UE toggle - extension not detected');
                    return;
                }

                if (app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks') !== undefined) {
                    const currentMode = app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks');
                    
                    if (enabled) {
                        // Restore to the original user setting value
                        if (originalSettings.ue_showlinks !== null && originalSettings.ue_showlinks !== currentMode) {
                            app.ui.settings.setSettingValue('Use Everywhere.Graphics.showlinks', originalSettings.ue_showlinks);
                        }
                    } else {
                        originalSettings.ue_showlinks = currentMode;
                        app.ui.settings.setSettingValue('Use Everywhere.Graphics.showlinks', 0);
                    }
                } else {
                    console.warn(`[LGCTinyPerf] Use Everywhere Graphics.showlinks setting not found`);
                }
            } catch (e) {
                console.error(`[LGCTinyPerf] Error toggling UE rendering:`, e);
            }
        };

        const startGhosting = (canvas) => {
            if (isGhosting) return;
            isGhosting = true;
            hideLinks();
        };

        const stopGhosting = (canvas) => {
            if (!isGhosting) return;
            showLinks();
            isGhosting = false;
            canvas.setDirty(true, true);
        };

        const hideLinks = () => {
            if (linksHidden) return;
            originalSettings.links = app.canvas.links_render_mode;
            app.canvas.links_render_mode = -1; // Kill links
            linksHidden = true;
            
            // Hide cg_use_everywhere links during ghosting for better performance
            const toggleUELinks = app.ui.settings.getSettingValue('LGCTinyPerf.ToggleUELinks');
            if (toggleUELinks) {
                toggleUseEverywhereRendering(false);
            }
        };

        const showLinks = () => {
            if (!linksHidden) return;
            app.canvas.links_render_mode = originalSettings.links;
            linksHidden = false;
            
            // Restore cg_use_everywhere links when no longer ghosting
            toggleUseEverywhereRendering(true);
        };

        // Hook the Prototypes
        const originalDraw = LGC.prototype.draw;
        const originalDrawNode = LGC.prototype.drawNode;
        const originalDrawGroups = LGC.prototype.drawGroups;
        const originalDrawConnections = LGC.prototype.drawConnections;
        
        // Hook the Draw Loop
        LGC.prototype.draw = function() {
            // Check every frame if we are dragging something
            draggingCanvas = this.state.draggingCanvas;
            draggingItems = this.state.draggingItems;
            
            // Only apply ghosting if setting is enabled
            const ghostEnabled = app.ui.settings.getSettingValue('LGCTinyPerf.GhostingEnabled');
            let hideConnections = app.ui.settings.getSettingValue('LGCTinyPerf.HideConnections');

            if (ghostEnabled) {
                if (draggingCanvas && !isGhosting) {
                    startGhosting(this);
                } else if (!draggingCanvas && isGhosting) {
                    stopGhosting(this);
                }
            }

            if (hideConnections) {
                if (draggingItems || isGhosting) {
                    hideLinks();
                } else {
                    showLinks();
                }
            }

            return originalDraw.apply(this, arguments);
        };

        // Hook Node Drawing
        LGC.prototype.drawNode = function(node, ctx) {
            // Only apply ghost mode if setting is enabled and we're in ghost state
            const ghostEnabled = app.ui.settings.getSettingValue('LGCTinyPerf.GhostingEnabled');

            // We use the 'isGhosting' flag set in the draw loop above
            if (isGhosting && ghostEnabled) {
                let [w, h] = node.renderingSize;
                
                // We also have title height as it's positioned above the node body
                const titleHeight = LiteGraph?.NODE_TITLE_HEIGHT || 30;
                h = node.flags?.collapsed ? titleHeight : h + titleHeight;
                
                if (node.flags?.collapsed) {
                    w = node._collapsed_width || LiteGraph?.NODE_COLLAPSED_WIDTH || 100;
                }

                const color = node.color || "#333";

                // Simple Box - draw at proper position with title height in mind
                ctx.fillStyle = "#1a1a1a";
                ctx.beginPath();
                ctx.roundRect(0, -titleHeight, w, h, 4);
                ctx.fill();

                // Colored Header
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(0, -titleHeight, w, titleHeight, [4, 4, 0, 0]);
                ctx.fill();

                ctx.strokeStyle = color;
                ctx.strokeRect(0, -titleHeight, w, h);
                
                return; // SKIP everything else
            }
            return originalDrawNode.apply(this, arguments);
        };

        // Hook Group Drawing
        LGC.prototype.drawGroups = function(ctx) {
            if (isGhosting) return; // Completely skip group rendering
            return originalDrawGroups.apply(this, arguments);
        };

        // Kickstart the first run
        setTimeout(() => disableFX(app.canvas), 1000);
        console.log("ARZUMATA LGCTinyPerf: Optimized and Ready.");
    }
});
