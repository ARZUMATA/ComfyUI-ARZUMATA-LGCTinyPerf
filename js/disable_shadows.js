import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ARZUMATA.LGCTinyPerf",
    async setup() {
        const LGC = LGraphCanvas;
        if (!LGC) return;

        // Persistent State
        let isGhosting = false;
        
        // Permanent UI Tweaks
        const disableFX = (canvas) => {
            canvas.render_shadows = false;              // No node shadows
            canvas.draw_shadows = false;                // Double check
            canvas.render_connections_border = false;   // No connection border
            canvas.highquality_render = false;          // Force standard render
            canvas.render_collapsed_slots = false;      // Green dot thingy on collapsed nodes
            console.log("ARZUMATA LGCTinyPerf Patch: Shadows and FX Disabled");
        };

        const originalDraw = LGC.prototype.draw;
        const originalDrawNode = LGC.prototype.drawNode;

        // Hook the Draw Loop
        LGC.prototype.draw = function() {
            disableFX(this);

            // Check every frame if we are moving
            const moving = this.dragging_canvas;

            if (moving) {
                if (!isGhosting) {
                    console.log("ARZUMATA LGCTinyPerf Ghost Mode: ON");
                    isGhosting = true;
                }
                this.links_render_mode = -1; // Kill links
            } else {
                if (isGhosting) {
                    console.log("ARZUMATA LGCTinyPerf Ghost Mode: OFF");
                    isGhosting = false;
                    this.links_render_mode = 0; // Restore to Straight
                    this.setDirty(true, true);
                }
            }

            return originalDraw.apply(this, arguments);
        };

        // Hook Node Drawing
        LGC.prototype.drawNode = function(node, ctx) {
            // We use the 'isGhosting' flag set in the draw loop above
            if (isGhosting) {
                const [w, h] = node.size;
                ctx.fillStyle = "#1a1a1a";
                ctx.beginPath();
                ctx.roundRect(0, 0, w, h, 4);
                ctx.fill();
                ctx.strokeStyle = "#444";
                ctx.stroke();
                return; // SKIP everything else
            }
            return originalDrawNode.apply(this, arguments);
        };

        console.log("ARZUMATA LGCTinyPerf Patch: Persistence Patch Loaded.");
    }
});