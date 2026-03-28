import { app } from "../../scripts/app.js";
import { tryImportShared, initUEExtension, hookLinkRenderController, toggleUseEverywhereRendering } from "./ue-extension.js";
import { getDragState, updateDragState } from "./shared-state.js";

// Initialize UE extension module import
tryImportShared();

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

        const originalSettings = {
            links: 0,
            render_shadows: null,
            draw_shadows: null,
            render_connections_border: null,
            highquality_render: null,
            render_collapsed_slots: null,
            ue_showlinks: null, // Store original UE showlinks setting value for restoration
        };

        // Initialize UE extension integration
        const ueIntegration = await initUEExtension(app);

        if (ueIntegration) {
            const { linkRenderController } = ueIntegration;
            
            // Hook the link render controller methods
            hookLinkRenderController(linkRenderController);
        }

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
            console.log("ARZUMATA LGCTinyPerf: Shadows and FX Disabled");
        };

        // Restore original settings
        const enableFX = (canvas) => {
            if (!canvas) return;
            
            if (originalSettings.render_shadows !== null) canvas.render_shadows = originalSettings.render_shadows;
            if (originalSettings.draw_shadows !== null) canvas.draw_shadows = originalSettings.draw_shadows;
            if (originalSettings.render_connections_border !== null) canvas.render_connections_border = originalSettings.render_connections_border;
            if (originalSettings.highquality_render !== null) canvas.highquality_render = originalSettings.highquality_render;
            if (originalSettings.render_collapsed_slots !== null) canvas.render_collapsed_slots = originalSettings.render_collapsed_slots;
            
            console.log("ARZUMATA LGCTinyPerf: Shadows and FX Enabled");
        };

        // Handle DisableFX setting change
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
                toggleUseEverywhereRendering(app, false, originalSettings);
            }
        };

        const showLinks = () => {
            if (!linksHidden) return;
            app.canvas.links_render_mode = originalSettings.links;
            linksHidden = false;
            
            // Restore cg_use_everywhere links when no longer ghosting
            toggleUseEverywhereRendering(app, true, originalSettings);
        };

        /**
         * Apply minimal CSS to Vue nodes with colored headers.
         * Hides all slots, widgets, and body content - only shows header bar.
         */
        const applyVueNodesGhostCSS = () => {
            if (!app.canvas || !LiteGraph.vueNodesMode) return;
            
            const ghostEnabled = app.ui.settings.getSettingValue('LGCTinyPerf.GhostingEnabled');
            if (!ghostEnabled) {
                removeVueNodesGhostCSS();
                return;
            }

            if (isGhosting) return;
            
            isGhosting = true;
            
            let ghostStyle = document.getElementById('lgctinyperf-ghost-style');
            if (!ghostStyle) {
                ghostStyle = document.createElement('style');
                ghostStyle.id = 'lgctinyperf-ghost-style';
                ghostStyle.type = 'text/css';
                document.head.appendChild(ghostStyle);
            }

            // Minimal CSS - hide all slots, widgets, body content; only header visible
            const minimalCSS = `
                
                /* Hide node body container */
                
                .bg-component-node-background {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                }
                
                /* Hide widgets grid container */
                [class*="grid-cols-"][class*="gap-y-"] {
                    display: none !important;
                }
            `;

            ghostStyle.textContent = minimalCSS;
            
            // Force reflow to apply styles immediately
            document.body.offsetHeight;
            
            // console.log("ARZUMATA LGCTinyPerf: Vue Nodes Minimal CSS Applied (header only)");
        };

        /**
         * Remove simplified CSS and restore normal styling.
         */
        const removeVueNodesGhostCSS = () => {
            if (!isGhosting) return;
            
            isGhosting = false;
            
            const ghostStyle = document.getElementById('lgctinyperf-ghost-style');
            if (ghostStyle) {
                ghostStyle.remove();
            }
            
            // console.log("ARZUMATA LGCTinyPerf: Vue Nodes CSS Restored");
        };

        // Hook the Prototypes
        const originalDraw = LGC.prototype.draw;
        const originalDrawNode = LGC.prototype.drawNode;
        const originalDrawGroups = LGC.prototype.drawGroups;
        const originalDrawConnections = LGC.prototype.drawConnections;
        
        // Hook the Draw Loop
        LGC.prototype.draw = function() {
            // Update shared drag state for extension hooks to use live values
            updateDragState(this.state.draggingCanvas, this.state.draggingItems);
            
            // Only apply ghosting if setting is enabled
            const ghostEnabled = app.ui.settings.getSettingValue('LGCTinyPerf.GhostingEnabled');
            let hideConnections = app.ui.settings.getSettingValue('LGCTinyPerf.HideConnections');

            if (ghostEnabled && !LiteGraph.vueNodesMode) {
                if (this.state.draggingCanvas && !isGhosting) {
                    startGhosting(this);
                } else if (!this.state.draggingCanvas && isGhosting) {
                    stopGhosting(this);
                }
            }
            
            // Apply Vue nodes minimal CSS during interactions
            if (ghostEnabled && LiteGraph.vueNodesMode) {
                if ((this.state.draggingCanvas || this.state.draggingItems) && !isGhosting) {
                    applyVueNodesGhostCSS();
                } else if (!this.state.draggingCanvas && !this.state.draggingItems && isGhosting) {
                    removeVueNodesGhostCSS();
                }
            }

            if (hideConnections) {
                if (this.state.draggingItems || isGhosting) {
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
            if (isGhosting && ghostEnabled && !LiteGraph.vueNodesMode) {
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
        
        // Initialize Vue nodes ghost CSS state
        if (LiteGraph.vueNodesMode && app.canvas) {
            const ghostEnabled = app.ui.settings.getSettingValue('LGCTinyPerf.GhostingEnabled');
            if (ghostEnabled && (app.canvas.state.draggingCanvas || app.canvas.state.draggingItems)) {
                applyVueNodesGhostCSS();
            }
        }
        
        console.log("ARZUMATA LGCTinyPerf: Optimized and Ready.");
    }
});
