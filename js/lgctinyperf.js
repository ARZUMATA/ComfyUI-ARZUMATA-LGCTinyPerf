import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ARZUMATA.LGCTinyPerf",
    async setup() {
        const LGC = LGraphCanvas;
        if (!LGC) return;

        // Persistent State
        let isGhosting = false;
        const originalSettings = { links: 0 };

        // Permanent UI Tweaks
        const disableFX = (canvas) => {
            if (!canvas) return;
            canvas.render_shadows = false;              // No node shadows
            canvas.draw_shadows = false;                // Double check
            canvas.render_connections_border = false;   // No connection border
            canvas.highquality_render = false;          // Force standard render
            canvas.render_collapsed_slots = false;      // Green dot thingy on collapsed nodes
            console.log("ARZUMATA LGCTinyPerf Patch: Shadows and FX Disabled");
        };

        const startGhosting = (canvas) => {
            if (isGhosting) return;
            originalSettings.links = canvas.links_render_mode;
            canvas.links_render_mode = -1; // Kill links
            isGhosting = true;
        };

        const stopGhosting = (canvas) => {
            if (!isGhosting) return;
            canvas.links_render_mode = originalSettings.links;
            isGhosting = false;
            canvas.setDirty(true, true);
        };

        // Force reset on mouse release
        window.addEventListener("mouseup", () => {
            if (isGhosting) stopGhosting(app.canvas);
        });

        // Hook the Prototypes
        const originalDraw = LGC.prototype.draw;
        const originalDrawNode = LGC.prototype.drawNode;
        const originalDrawGroups = LGC.prototype.drawGroups;

        // Hook the Draw Loop
        LGC.prototype.draw = function() {
            // Check every frame if we are moving
            const moving = this.dragging_canvas;
            
            if (moving) startGhosting(this);
            else stopGhosting(this);

            return originalDraw.apply(this, arguments);
        };

        // Hook Node Drawing
        LGC.prototype.drawNode = function(node, ctx) {
            // We use the 'isGhosting' flag set in the draw loop above
            if (isGhosting) {
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