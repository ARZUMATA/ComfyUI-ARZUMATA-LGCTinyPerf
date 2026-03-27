// UE Extension Shared Module Loader
// Handles dynamic import of cg-use-everywhere shared module and extension hooks

import { getDragState } from "./shared-state.js";

let ueExtensionShared = null;

/**
 * Dynamically imports the cg-use-everywhere shared module.
 * Non-blocking: logs error if module is not found but doesn't throw.
 */
async function tryImportShared() {
    try {
        const imported = await import("../cg-use-everywhere/shared.js");
        ueExtensionShared = imported.shared;
        console.log('[LGCTinyPerf] cg-use-everywhere shared module loaded');
    } catch (e) {
        console.log('[LGCTinyPerf] cg-use-everywhere not installed, link rendering hooks disabled');
    }
}

/**
 * Initializes the UE extension integration.
 * @param {Object} app - ComfyUI app instance
 * @returns {Promise<Object>} Object containing ueExtensionShared and linkRenderController, or null if unavailable
 */
async function initUEExtension(app) {
    // Wait for shared module import to complete with timeout
    const maxWaitTime = 500; // Maximum wait time in ms
    const checkInterval = 50; // Check every 50ms
    let waitedTime = 0;

    while (!ueExtensionShared && waitedTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitedTime += checkInterval;
    }

    if (!ueExtensionShared) {
        console.log('[LGCTinyPerf] Shared module import timed out');
        return null;
    }

    // Hook cg.customnodes.use_everywhere extension for link rendering control
    const ueExtension = app.extensions.find(e => e.name === "cg.customnodes.use_everywhere");
    
    if (ueExtension && ueExtensionShared?.linkRenderController) {
        console.log('[LGCTinyPerf] use_everywhere extension found with shared module');
        
        // Get link render controller from imported shared module
        const linkRC = ueExtensionShared.linkRenderController;
        
        return {
            ueExtension,
            ueExtensionShared,
            linkRenderController: linkRC
        };
    } else {
        console.log('[LGCTinyPerf] use_everywhere extension not found or no linkRenderController');
        return null;
    }
}

/**
 * Hooks the link render controller methods to skip disabling/enabling during drag operations.
 * Uses shared state for live drag detection instead of captured values.
 * @param {Object} linkRC - Link render controller instance
 */
function hookLinkRenderController(linkRC) {
    // Store original method references BEFORE replacing
    const originalDisableAll = linkRC.disable_all_connected_widgets;
    const originalEnableAll = linkRC.enable_all_disabled_widgets;

    console.log('[LGCTinyPerf] Methods found:', {
        disable_all_connected_widgets: typeof originalDisableAll,
        enable_all_disabled_widgets: typeof originalEnableAll,
    });

    // Hook disable_all_connected_widgets
    if (typeof originalDisableAll === 'function') {
        linkRC.disable_all_connected_widgets = function(...args) {
            const dragState = getDragState();
            if (dragState.draggingCanvas || dragState.draggingItems) {
                return;
            }
            return originalDisableAll.apply(this, args);
        };
        // console.log('[LGCTinyPerf] Hooked linkRC.disable_all_connected_widgets');
    }

    // Hook enable_all_disabled_widgets
    if (typeof originalEnableAll === 'function') {
        linkRC.enable_all_disabled_widgets = function(...args) {
            const dragState = getDragState();
            if (dragState.draggingCanvas || dragState.draggingItems) {
                return;
            }
            return originalEnableAll.apply(this, args);
        };
        // console.log('[LGCTinyPerf] Hooked linkRC.enable_all_disabled_widgets');
    }
}

/**
 * Toggles cg_use_everywhere link rendering based on ghosting state.
 * @param {Object} app - ComfyUI app instance
 * @param {boolean} enabled - Whether to enable links (restore) or disable them
 * @param {Object} settingsObj - Settings object containing ue_showlinks for restoration
 */
function toggleUseEverywhereRendering(app, enabled, settingsObj) {
    try {
        if (!app.extensions.some(e => e.name === "cg.customnodes.use_everywhere")) {
            console.log('[LGCTinyPerf] Skipping UE toggle - extension not detected');
            return;
        }

        if (app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks') !== undefined) {
            const currentMode = app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks');
            
            if (enabled) {
                // Restore to the original user setting value
                if (settingsObj.ue_showlinks !== null && settingsObj.ue_showlinks !== currentMode) {
                    app.ui.settings.setSettingValue('Use Everywhere.Graphics.showlinks', settingsObj.ue_showlinks);
                }
            } else {
                settingsObj.ue_showlinks = currentMode;
                app.ui.settings.setSettingValue('Use Everywhere.Graphics.showlinks', 0);
            }
        } else {
            console.warn(`[LGCTinyPerf] Use Everywhere Graphics.showlinks setting not found`);
        }
    } catch (e) {
        console.error(`[LGCTinyPerf] Error toggling UE rendering:`, e);
    }
}

// Export for use in other modules
export { tryImportShared, initUEExtension, hookLinkRenderController, toggleUseEverywhereRendering };
