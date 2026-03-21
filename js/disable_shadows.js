import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Custom.DisableNodeShadows",
    async setup() {
        const disableFX = () => {
            if (app.canvas) {
                app.canvas.render_shadows = false;              // No node shadows
                app.canvas.draw_shadows = false;                // Double check
                app.canvas.render_connections_border = false;   // No connection border
                app.canvas.render_collapsed_slots   = false;    // Green dot thingy on collapsed nodes
                app.canvas.highquality_render = false;          // Force standard render
                
                console.log("Performance Patch: Shadows and FX Disabled");
                app.canvas.setDirty(true, true);
            } else {
                setTimeout(disableFX, 100);
            }
        };
        disableFX();
    }
});